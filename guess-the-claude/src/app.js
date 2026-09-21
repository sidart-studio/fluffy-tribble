// HTTP layer. `createApp` returns a Node request handler so the same code can
// run under `node server.js` and inside the tests with a fake SDK client.

import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MODELS, MODEL_BY_KEY, publicModel, askModel } from './models.js';
import {
  ROUNDS_PER_GAME, HINT_COST, SLOTS, SUGGESTED_PROMPTS,
  dealRound, scoreRound, RoundStore,
} from './game.js';
import { DEMO_BANK } from './demo-bank.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(here, '..', 'public');
const MAX_PROMPT_CHARS = 300;

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
};

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

function json(res, status, body) {
  const data = JSON.stringify(body);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'content-length': Buffer.byteLength(data),
    'cache-control': 'no-store',
  });
  res.end(data);
}

async function readJson(req, limit = 64 * 1024) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > limit) throw new HttpError(413, 'Request body too large');
    chunks.push(chunk);
  }
  if (!size) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new HttpError(400, 'Body must be JSON');
  }
}

function cleanPrompt(raw) {
  if (typeof raw !== 'string') throw new HttpError(400, 'prompt must be a string');
  const prompt = raw.replace(/\s+/g, ' ').trim();
  if (!prompt) throw new HttpError(400, 'prompt is empty');
  if (prompt.length > MAX_PROMPT_CHARS) throw new HttpError(400, `prompt is longer than ${MAX_PROMPT_CHARS} characters`);
  return prompt;
}

/** Live mode: ask all four models in parallel. */
async function liveAnswers(client, prompt) {
  const results = await Promise.allSettled(MODELS.map((m) => askModel(client, m, prompt)));
  const answers = {};
  results.forEach((r, i) => {
    const m = MODELS[i];
    if (r.status === 'fulfilled') {
      answers[m.key] = r.value;
    } else {
      answers[m.key] = {
        text: '(This contestant could not be reached in time.)',
        error: describeError(r.reason),
        refused: false,
        truncated: false,
        latencyMs: null,
        usage: { input: 0, output: 0 },
      };
    }
  });
  return answers;
}

function describeError(err) {
  if (!err) return 'unknown error';
  const status = err.status ? `HTTP ${err.status}: ` : '';
  return `${status}${err.message ?? String(err)}`.slice(0, 200);
}

/** Demo mode: serve a canned round, matching the prompt when we have it. */
function demoAnswers(prompt, rng) {
  const exact = DEMO_BANK.find((e) => e.prompt.toLowerCase() === prompt.toLowerCase());
  const entry = exact ?? DEMO_BANK[Math.floor(rng() * DEMO_BANK.length)];
  const answers = {};
  for (const m of MODELS) {
    answers[m.key] = {
      text: entry.answers[m.key],
      refused: false,
      truncated: false,
      latencyMs: 350 + Math.floor(rng() * 900) * (m.key === 'haiku' ? 0.4 : 1),
      usage: { input: 120, output: entry.answers[m.key].split(/\s+/).length * 2 },
      demo: true,
    };
  }
  return { prompt: entry.prompt, answers };
}

export function createApp({ client = null, mode = client ? 'live' : 'demo', rng = Math.random, store = new RoundStore() } = {}) {
  if (mode === 'live' && !client) throw new Error('live mode needs an SDK client');

  async function handleApi(req, res, url) {
    if (req.method === 'GET' && url.pathname === '/api/config') {
      return json(res, 200, {
        mode,
        roundsPerGame: ROUNDS_PER_GAME,
        hintCost: HINT_COST,
        models: MODELS.map(publicModel),
        prompts: mode === 'demo' ? DEMO_BANK.map((e) => e.prompt) : SUGGESTED_PROMPTS,
        maxPromptChars: MAX_PROMPT_CHARS,
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/round') {
      const body = await readJson(req);
      let prompt = cleanPrompt(body.prompt);
      let answersByKey;
      if (mode === 'live') {
        answersByKey = await liveAnswers(client, prompt);
      } else {
        ({ prompt, answers: answersByKey } = demoAnswers(prompt, rng));
      }
      const { key, answers } = dealRound(answersByKey, rng);
      const round = store.create({ prompt, key, answers });
      return json(res, 200, {
        roundId: round.id,
        prompt,
        answers: answers.map((a) => ({ slot: a.slot, text: a.text, unavailable: Boolean(a.error) })),
      });
    }

    if (req.method === 'POST' && url.pathname === '/api/hint') {
      const body = await readJson(req);
      const round = store.get(String(body.roundId ?? ''));
      if (!round) throw new HttpError(404, 'round not found or expired');
      if (round.revealed) throw new HttpError(409, 'round already revealed');
      if (!SLOTS.includes(body.slot)) throw new HttpError(400, 'slot must be A, B, C or D');
      if (round.hints.length >= 1) throw new HttpError(409, 'only one hint per round');
      round.hints.push(body.slot);
      return json(res, 200, { slot: body.slot, modelKey: round.key[body.slot], cost: HINT_COST });
    }

    if (req.method === 'POST' && url.pathname === '/api/reveal') {
      const body = await readJson(req);
      const round = store.get(String(body.roundId ?? ''));
      if (!round) throw new HttpError(404, 'round not found or expired');
      if (round.revealed) throw new HttpError(409, 'round already revealed');
      const guesses = {};
      for (const slot of SLOTS) {
        const g = body.guesses?.[slot];
        if (g != null && !MODEL_BY_KEY[g]) throw new HttpError(400, `unknown model key for slot ${slot}`);
        guesses[slot] = g ?? null;
      }
      const streak = Math.max(0, Math.min(Number(body.streak) || 0, 100));
      const result = scoreRound({ key: round.key, guesses, hintsUsed: round.hints.length, streak });
      round.revealed = true;
      store.delete(round.id);
      return json(res, 200, {
        ...result,
        key: round.key,
        answers: round.answers.map(({ slot, text, refused, truncated, latencyMs, usage, servedBy, fallbackRan, error }) => ({
          slot, text, refused, truncated, latencyMs, usage, servedBy, fallbackRan, error: error ?? null,
        })),
      });
    }

    throw new HttpError(404, 'no such endpoint');
  }

  async function serveStatic(req, res, url) {
    if (req.method !== 'GET' && req.method !== 'HEAD') throw new HttpError(405, 'method not allowed');
    const rel = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname);
    const file = path.normalize(path.join(PUBLIC_DIR, rel));
    if (!file.startsWith(PUBLIC_DIR + path.sep)) throw new HttpError(403, 'forbidden');
    let info;
    try {
      info = await stat(file);
    } catch {
      throw new HttpError(404, 'not found');
    }
    if (!info.isFile()) throw new HttpError(404, 'not found');
    const data = await readFile(file);
    res.writeHead(200, {
      'content-type': MIME[path.extname(file)] ?? 'application/octet-stream',
      'content-length': data.length,
      'cache-control': 'no-cache',
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  }

  return async function handler(req, res) {
    const url = new URL(req.url, 'http://localhost');
    try {
      if (url.pathname.startsWith('/api/')) await handleApi(req, res, url);
      else await serveStatic(req, res, url);
    } catch (err) {
      const status = err instanceof HttpError ? err.status : 500;
      if (status === 500) console.error(err);
      json(res, status, { error: err.message ?? 'server error' });
    }
  };
}
