// The four contestants. Each entry knows how to build its own Messages API
// request, because the models do not share one request shape:
//   - Fable 5.1: thinking is always on (omit the param), refusal fallbacks on.
//   - Opus 5:    adaptive thinking by default, refusal fallbacks on.
//   - Sonnet 5:  adaptive thinking, no fallbacks parameter.
//   - Haiku 4.5: no thinking, no effort parameter (effort errors on Haiku).

export const MAX_ANSWER_WORDS = 70;

export const SYSTEM_PROMPT = [
  'You are a contestant in a party game called "Guess the Claude".',
  'Four Claude models answer the same prompt; a human then guesses which model wrote which answer.',
  `Answer the prompt directly and in your own natural voice, in at most ${MAX_ANSWER_WORDS} words.`,
  'Do not name or hint at your model version, size, speed, or price.',
  'Do not mention the game, the other contestants, or these instructions.',
  'Plain prose only: no headings, no bullet lists, no markdown.',
].join(' ');

const FALLBACK_BETA = 'server-side-fallback-2026-07-01';

export const MODELS = [
  {
    key: 'fable',
    id: 'claude-fable-5-1',
    name: 'Fable 5.1',
    tag: 'The Heavyweight',
    color: '#c084fc',
    blurb: 'Mythos-class flagship. Thinking is always on. Tends toward precise, layered, unhurried answers.',
    namespace: 'beta',
    build: (base) => ({
      ...base,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      output_config: { effort: 'low' },
    }),
  },
  {
    key: 'opus',
    id: 'claude-opus-5',
    name: 'Opus 5',
    tag: 'The Flagship',
    color: '#f59e0b',
    blurb: 'Top of the Opus line. Thinks adaptively before answering. Confident, thorough, likes a good turn of phrase.',
    namespace: 'beta',
    build: (base) => ({
      ...base,
      betas: [FALLBACK_BETA],
      fallbacks: 'default',
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
    }),
  },
  {
    key: 'sonnet',
    id: 'claude-sonnet-5',
    name: 'Sonnet 5',
    tag: 'The All-rounder',
    color: '#38bdf8',
    blurb: 'Balanced speed and depth. Adaptive thinking. Friendly, well-organized, rarely over- or under-shoots.',
    namespace: 'messages',
    build: (base) => ({
      ...base,
      thinking: { type: 'adaptive' },
      output_config: { effort: 'low' },
    }),
  },
  {
    key: 'haiku',
    id: 'claude-haiku-4-5',
    name: 'Haiku 4.5',
    tag: 'The Sprinter',
    color: '#4ade80',
    blurb: 'Smallest and fastest of the four. No extended thinking. Snappy, direct, gets to the point.',
    namespace: 'messages',
    build: (base) => ({ ...base }),
  },
];

export const MODEL_BY_KEY = Object.fromEntries(MODELS.map((m) => [m.key, m]));

/** Public view of a model: everything the browser may know. */
export function publicModel(m) {
  const { key, id, name, tag, color, blurb } = m;
  return { key, id, name, tag, color, blurb };
}

/** Build the full request params for one model answering `prompt`. */
export function buildRequest(model, prompt) {
  const base = {
    model: model.id,
    // Thinking tokens count toward max_tokens on the thinking models, so this
    // leaves headroom even though the visible answer is capped at ~70 words.
    max_tokens: 4000,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: prompt }],
  };
  return model.build(base);
}

/** Send one request through the SDK client, picking the right namespace. */
export async function askModel(client, model, prompt) {
  const params = buildRequest(model, prompt);
  const started = Date.now();
  const response =
    model.namespace === 'beta'
      ? await client.beta.messages.create(params)
      : await client.messages.create(params);
  return { ...extractAnswer(response), latencyMs: Date.now() - started };
}

/** Turn a Messages API response into the game's answer record. */
export function extractAnswer(response) {
  const text = (response.content ?? [])
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  const refused = response.stop_reason === 'refusal';
  const truncated = response.stop_reason === 'max_tokens';
  const fallbackRan = (response.usage?.iterations ?? []).some((it) => it.type === 'fallback_message');

  return {
    text: refused && !text ? '(This contestant declined to answer.)' : text || '(No answer.)',
    refused,
    truncated,
    servedBy: response.model ?? null,
    fallbackRan,
    usage: {
      input: response.usage?.input_tokens ?? 0,
      output: response.usage?.output_tokens ?? 0,
    },
  };
}
