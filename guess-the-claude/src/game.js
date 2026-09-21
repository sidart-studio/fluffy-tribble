// Pure game logic: round bookkeeping and scoring. No I/O here so it is easy to test.

import { randomBytes } from 'node:crypto';
import { MODELS } from './models.js';

export const ROUNDS_PER_GAME = 5;
export const POINTS_PER_MATCH = 25;
export const PERFECT_BONUS = 50;
export const STREAK_BONUS = 25;
export const HINT_COST = 15;
export const SLOTS = ['A', 'B', 'C', 'D'];

export const SUGGESTED_PROMPTS = [
  'Explain black holes to a five-year-old in two sentences.',
  'Settle it once and for all: is a hot dog a sandwich?',
  'Write a haiku about Monday mornings.',
  'Describe the color blue to someone who has never seen.',
  'Give me one hot take about programming languages.',
  'Invent a new holiday and its single most important tradition.',
  'Pitch me a movie in exactly thirty words.',
  'What is the best way to cook an egg? Be opinionated.',
  'Tell me something surprising about octopuses.',
  'Write a two-line toast for a friend who just quit a job they hated.',
  'What would you name a pet rock, and why?',
  'Give me the worst possible advice for a first date, as a joke.',
];

export function shuffle(list, rng = Math.random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Assign the four model answers to slots A-D in random order. */
export function dealRound(answersByKey, rng = Math.random) {
  const keys = shuffle(MODELS.map((m) => m.key), rng);
  const key = {};
  const answers = SLOTS.map((slot, i) => {
    key[slot] = keys[i];
    return { slot, ...answersByKey[keys[i]] };
  });
  return { key, answers };
}

/**
 * Score a set of guesses against the answer key.
 * guesses: { A: 'fable', B: 'opus', ... }  (partial guesses allowed)
 * Returns points and details. Streak counts consecutive perfect rounds before this one.
 */
export function scoreRound({ key, guesses, hintsUsed = 0, streak = 0 }) {
  let correct = 0;
  const perSlot = {};
  for (const slot of SLOTS) {
    const ok = guesses?.[slot] === key[slot];
    perSlot[slot] = { guess: guesses?.[slot] ?? null, actual: key[slot], correct: ok };
    if (ok) correct++;
  }
  const perfect = correct === SLOTS.length;
  let points = correct * POINTS_PER_MATCH;
  let bonus = 0;
  if (perfect) {
    bonus = PERFECT_BONUS + streak * STREAK_BONUS;
    points += bonus;
  }
  points -= hintsUsed * HINT_COST;
  return { correct, perfect, points: Math.max(points, 0), bonus, hintPenalty: hintsUsed * HINT_COST, perSlot };
}

/** In-memory store of rounds awaiting a reveal. Entries expire after `ttlMs`. */
export class RoundStore {
  constructor({ ttlMs = 30 * 60 * 1000, now = Date.now } = {}) {
    this.ttlMs = ttlMs;
    this.now = now;
    this.rounds = new Map();
  }

  create(data) {
    this.sweep();
    const id = randomBytes(9).toString('base64url');
    const round = { id, createdAt: this.now(), hints: [], revealed: false, ...data };
    this.rounds.set(id, round);
    return round;
  }

  get(id) {
    const round = this.rounds.get(id);
    if (!round) return null;
    if (this.now() - round.createdAt > this.ttlMs) {
      this.rounds.delete(id);
      return null;
    }
    return round;
  }

  delete(id) {
    this.rounds.delete(id);
  }

  sweep() {
    const cutoff = this.now() - this.ttlMs;
    for (const [id, round] of this.rounds) {
      if (round.createdAt < cutoff) this.rounds.delete(id);
    }
  }
}
