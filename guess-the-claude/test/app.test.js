import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createApp } from '../src/app.js';
import { MODELS } from '../src/models.js';

/** A stand-in for the Anthropic SDK client that records requests. */
function fakeClient({ failFor = [] } = {}) {
  const calls = [];
  const respond = (params) => {
    calls.push(params);
    if (failFor.includes(params.model)) {
      const err = new Error('overloaded'); err.status = 529; return Promise.reject(err);
    }
    return Promise.resolve({
      model: params.model, stop_reason: 'end_turn',
      content: [{ type: 'text', text: `[${params.model}] answering: ${params.messages[0].content}` }],
      usage: { input_tokens: 42, output_tokens: 17 },
    });
  };
  return { calls, messages: { create: respond }, beta: { messages: { create: respond } } };
}

async function listen(handler) {
  const server = http.createServer(handler);
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${server.address().port}`;
  const call = async (path, body) => {
    const res = await fetch(base + path, body ? { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : undefined);
    return { status: res.status, body: await res.json().catch(() => null), headers: res.headers };
  };
  return { server, base, call };
}

let live, demo, client;
before(async () => {
  client = fakeClient({ failFor: ['claude-sonnet-5'] });
  live = await listen(createApp({ client, mode: 'live' }));
  demo = await listen(createApp({ mode: 'demo', rng: () => 0.1 }));
});
after(() => { live.server.close(); demo.server.close(); });

test('GET /api/config reports the mode and the four contestants', async () => {
  const { status, body } = await live.call('/api/config');
  assert.equal(status, 200);
  assert.equal(body.mode, 'live');
  assert.deepEqual(body.models.map((m) => m.id), MODELS.map((m) => m.id));
  assert.equal(body.models.some((m) => 'build' in m), false, 'internal fields must not leak');
});

test('live round: asks every model once, hides the key, scores the reveal', async () => {
  const before = client.calls.length;
  const round = await live.call('/api/round', { prompt: '  Is a hot dog   a sandwich? ' });
  assert.equal(round.status, 200);
  assert.equal(client.calls.length - before, 4);
  assert.deepEqual(client.calls.slice(before).map((c) => c.model).sort(), MODELS.map((m) => m.id).sort());
  assert.equal(client.calls[before].messages[0].content, 'Is a hot dog a sandwich?', 'prompt whitespace is normalized');
  assert.equal(round.body.answers.length, 4);
  assert.equal('key' in round.body, false, 'the answer key must stay server-side');

  // Work out the key from the fake answers, which embed the model id.
  const guesses = {};
  for (const a of round.body.answers) {
    const m = MODELS.find((mm) => a.text.includes(mm.id));
    guesses[a.slot] = m ? m.key : 'sonnet'; // sonnet failed, so its card has the fallback text
  }
  const unavailable = round.body.answers.filter((a) => a.unavailable);
  assert.equal(unavailable.length, 1, 'the failed model shows as unavailable');

  const reveal = await live.call('/api/reveal', { roundId: round.body.roundId, guesses, streak: 1 });
  assert.equal(reveal.status, 200);
  assert.equal(reveal.body.correct, 4);
  assert.equal(reveal.body.perfect, true);
  assert.equal(reveal.body.points, 100 + 50 + 25);
  assert.equal(reveal.body.answers.find((a) => a.error)?.error.includes('529'), true);

  const again = await live.call('/api/reveal', { roundId: round.body.roundId, guesses });
  assert.equal(again.status, 404, 'a round can only be revealed once');
});

test('hint reveals one slot, costs points, and is limited to one per round', async () => {
  const round = await demo.call('/api/round', { prompt: 'anything' });
  const hint = await demo.call('/api/hint', { roundId: round.body.roundId, slot: 'B' });
  assert.equal(hint.status, 200);
  assert.ok(MODELS.some((m) => m.key === hint.body.modelKey));
  const second = await demo.call('/api/hint', { roundId: round.body.roundId, slot: 'C' });
  assert.equal(second.status, 409);
  const reveal = await demo.call('/api/reveal', { roundId: round.body.roundId, guesses: { B: hint.body.modelKey } });
  assert.equal(reveal.body.correct, 1);
  assert.equal(reveal.body.points, 25 - 15);
});

test('demo mode serves a canned round matching the prompt when it can', async () => {
  const cfg = await demo.call('/api/config');
  assert.equal(cfg.body.mode, 'demo');
  const prompt = cfg.body.prompts[2];
  const round = await demo.call('/api/round', { prompt });
  assert.equal(round.body.prompt, prompt);
  assert.equal(round.body.answers.length, 4);
  const other = await demo.call('/api/round', { prompt: 'not in the bank' });
  assert.ok(cfg.body.prompts.includes(other.body.prompt), 'unknown prompts fall back to a bank entry');
});

test('validation: bad prompts, bad slots, unknown rounds', async () => {
  assert.equal((await demo.call('/api/round', { prompt: '' })).status, 400);
  assert.equal((await demo.call('/api/round', { prompt: 'x'.repeat(301) })).status, 400);
  assert.equal((await demo.call('/api/round', { prompt: 7 })).status, 400);
  assert.equal((await demo.call('/api/hint', { roundId: 'nope', slot: 'A' })).status, 404);
  const round = await demo.call('/api/round', { prompt: 'p' });
  assert.equal((await demo.call('/api/hint', { roundId: round.body.roundId, slot: 'Z' })).status, 400);
  assert.equal((await demo.call('/api/reveal', { roundId: round.body.roundId, guesses: { A: 'gpt' } })).status, 400);
  assert.equal((await demo.call('/api/nothing')).status, 404);
});

test('static files: index served, traversal blocked', async () => {
  const res = await fetch(demo.base + '/');
  assert.equal(res.status, 200);
  assert.match(res.headers.get('content-type'), /text\/html/);
  assert.match(await res.text(), /Guess the Claude/);
  const evil = await fetch(demo.base + '/..%2F..%2Fpackage.json');
  assert.notEqual(evil.status, 200);
  const missing = await fetch(demo.base + '/nope.css');
  assert.equal(missing.status, 404);
});
