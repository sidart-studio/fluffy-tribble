import { test } from 'node:test';
import assert from 'node:assert/strict';
import { dealRound, scoreRound, RoundStore, SLOTS } from '../src/game.js';
import { MODELS, buildRequest, extractAnswer, MODEL_BY_KEY } from '../src/models.js';

const fakeAnswers = Object.fromEntries(MODELS.map((m) => [m.key, { text: `answer from ${m.key}` }]));

test('dealRound puts every model in exactly one slot', () => {
  const { key, answers } = dealRound(fakeAnswers, () => 0.42);
  assert.deepEqual(Object.keys(key).sort(), SLOTS);
  assert.deepEqual(Object.values(key).sort(), MODELS.map((m) => m.key).sort());
  for (const a of answers) assert.equal(a.text, `answer from ${key[a.slot]}`);
});

test('scoreRound: perfect lineup earns bonus and streak', () => {
  const key = { A: 'fable', B: 'opus', C: 'sonnet', D: 'haiku' };
  const r = scoreRound({ key, guesses: { ...key }, streak: 2 });
  assert.equal(r.correct, 4);
  assert.equal(r.perfect, true);
  assert.equal(r.bonus, 50 + 2 * 25);
  assert.equal(r.points, 100 + 100);
});

test('scoreRound: partial guesses, hint penalty, never negative', () => {
  const key = { A: 'fable', B: 'opus', C: 'sonnet', D: 'haiku' };
  const r = scoreRound({ key, guesses: { A: 'fable', B: 'haiku' }, hintsUsed: 1 });
  assert.equal(r.correct, 1);
  assert.equal(r.perfect, false);
  assert.equal(r.points, 25 - 15);
  assert.equal(r.perSlot.C.guess, null);
  const zero = scoreRound({ key, guesses: {}, hintsUsed: 1 });
  assert.equal(zero.points, 0);
});

test('RoundStore expires rounds after the TTL', () => {
  let now = 1000;
  const store = new RoundStore({ ttlMs: 100, now: () => now });
  const round = store.create({ prompt: 'p' });
  assert.ok(store.get(round.id));
  now += 101;
  assert.equal(store.get(round.id), null);
});

test('buildRequest: each model gets the request shape its API accepts', () => {
  const prompt = 'Say hi.';
  const fable = buildRequest(MODEL_BY_KEY.fable, prompt);
  assert.equal(fable.model, 'claude-fable-5-1');
  assert.equal('thinking' in fable, false, 'Fable 5.1 must not receive an explicit thinking param');
  assert.deepEqual(fable.betas, ['server-side-fallback-2026-07-01']);
  assert.equal(fable.fallbacks, 'default');
  assert.equal(fable.output_config.effort, 'low');

  const opus = buildRequest(MODEL_BY_KEY.opus, prompt);
  assert.equal(opus.model, 'claude-opus-5');
  assert.deepEqual(opus.thinking, { type: 'adaptive' });
  assert.equal(opus.fallbacks, 'default');

  const sonnet = buildRequest(MODEL_BY_KEY.sonnet, prompt);
  assert.equal(sonnet.model, 'claude-sonnet-5');
  assert.deepEqual(sonnet.thinking, { type: 'adaptive' });
  assert.equal('fallbacks' in sonnet, false);
  assert.equal('betas' in sonnet, false);

  const haiku = buildRequest(MODEL_BY_KEY.haiku, prompt);
  assert.equal(haiku.model, 'claude-haiku-4-5');
  assert.equal('thinking' in haiku, false);
  assert.equal('output_config' in haiku, false, 'effort is rejected on Haiku 4.5');
  for (const r of [fable, opus, sonnet, haiku]) {
    assert.deepEqual(r.messages, [{ role: 'user', content: prompt }]);
    assert.ok(r.max_tokens >= 1024);
    assert.ok(typeof r.system === 'string' && r.system.length > 0);
  }
});

test('extractAnswer joins text blocks and flags refusals and fallbacks', () => {
  const ok = extractAnswer({
    model: 'claude-opus-5', stop_reason: 'end_turn',
    content: [{ type: 'thinking', thinking: '' }, { type: 'text', text: 'Hello ' }, { type: 'text', text: 'there.' }],
    usage: { input_tokens: 10, output_tokens: 5 },
  });
  assert.equal(ok.text, 'Hello there.');
  assert.equal(ok.refused, false);
  assert.equal(ok.usage.output, 5);

  const refused = extractAnswer({ stop_reason: 'refusal', content: [], usage: {} });
  assert.equal(refused.refused, true);
  assert.match(refused.text, /declined/);

  const fb = extractAnswer({
    model: 'claude-opus-4-8', stop_reason: 'end_turn',
    content: [{ type: 'fallback', from: { model: 'claude-fable-5-1' }, to: { model: 'claude-opus-4-8' } }, { type: 'text', text: 'ok' }],
    usage: { iterations: [{ type: 'message' }, { type: 'fallback_message' }] },
  });
  assert.equal(fb.fallbackRan, true);
  assert.equal(fb.servedBy, 'claude-opus-4-8');
});
