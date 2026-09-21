# Guess the Claude

A browser party game built on the Claude API. Every round, the same prompt is
sent to four different Claude models. Their answers come back shuffled and
anonymous, and you have to work out who wrote what.

The contestants:

| Card | Model ID            | Nickname        |
| ---- | ------------------- | --------------- |
| Fable 5.1 | `claude-fable-5-1` | The Heavyweight |
| Opus 5    | `claude-opus-5`    | The Flagship    |
| Sonnet 5  | `claude-sonnet-5`  | The All-rounder |
| Haiku 4.5 | `claude-haiku-4-5` | The Sprinter    |

## Play

```bash
cd guess-the-claude
npm install                       # only needed for live mode
ANTHROPIC_API_KEY=sk-ant-... npm start
# open http://localhost:3000
```

No key? `npm run demo` starts the game with canned answers written in each
model's voice, and needs no dependencies at all.

| Variable            | Effect                                                  |
| ------------------- | ------------------------------------------------------- |
| `ANTHROPIC_API_KEY` | Enables live mode (an `ant auth login` profile or `ANTHROPIC_AUTH_TOKEN` works too when you set `GAME_MODE=live`). |
| `GAME_MODE=demo`    | Force demo mode even when a key is present.             |
| `PORT`              | Listen port, default 3000.                              |

## Rules

- Five rounds per game. Pick a suggested prompt or type your own (300 characters max).
- +25 points per correct match. All four right is a Perfect Lineup: +50, plus
  +25 for every consecutive perfect round before it.
- One hint per round reveals a card's author for −15.
- The final screen shows your lifetime hit rate per model, stored in the browser.

In live mode the reveal also shows each model's latency and output token count,
which is often the tell.

## How the API calls work

`src/models.js` builds a different request per contestant, because the four
models do not share one request shape:

- **Fable 5.1** — thinking is always on, so no `thinking` parameter is sent.
  Uses `client.beta.messages.create` with `betas: ["server-side-fallback-2026-07-01"]`
  and `fallbacks: "default"`, so a safety-classifier decline is answered by a
  fallback model inside the same call instead of leaving an empty card.
- **Opus 5** — adaptive thinking, same fallback setup as Fable.
- **Sonnet 5** — adaptive thinking, plain `client.messages.create`.
- **Haiku 4.5** — no thinking and no `effort` (Haiku rejects it).

All four run in parallel with `effort: "low"` so a round comes back quickly.
A model that errors out or refuses still gets a card, marked as unavailable or
declined, so the round can always be scored. The answer key lives only on the
server until you lock in.

## Development

```bash
npm test          # node --test: game logic, request shapes, HTTP API with a fake SDK client
```

Files:

```
server.js          entry point: picks live or demo mode and starts the server
src/models.js      the four contestants and their request builders
src/game.js        dealing, scoring, round store (pure logic)
src/app.js         HTTP handlers and static file serving
src/demo-bank.js   canned rounds for demo mode
public/index.html  the game UI (no build step)
test/              node:test suites
```
