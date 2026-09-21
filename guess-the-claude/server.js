#!/usr/bin/env node
// Guess the Claude: entry point.
//
//   ANTHROPIC_API_KEY=sk-ant-... node server.js   -> live mode, four real models
//   node server.js                                 -> demo mode with canned answers
//   GAME_MODE=demo node server.js                  -> force demo even with a key
//   PORT=4000 node server.js                       -> pick a port (default 3000)

import http from 'node:http';
import { createApp } from './src/app.js';

const port = Number(process.env.PORT) || 3000;
const hasCredentials = Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
const wantLive = process.env.GAME_MODE !== 'demo' && (hasCredentials || process.env.GAME_MODE === 'live');

let client = null;
if (wantLive) {
  try {
    const { default: Anthropic } = await import('@anthropic-ai/sdk');
    // A game round should not hang: one retry, one minute per model.
    client = new Anthropic({ timeout: 60_000, maxRetries: 1 });
  } catch (err) {
    console.error('Could not load @anthropic-ai/sdk. Run `npm install` for live mode.');
    console.error(String(err.message ?? err));
    process.exit(1);
  }
}

const app = createApp({ client, mode: client ? 'live' : 'demo' });
http.createServer(app).listen(port, () => {
  const mode = client ? 'LIVE (real Claude models)' : 'DEMO (canned answers; set ANTHROPIC_API_KEY for live play)';
  console.log(`Guess the Claude  ->  http://localhost:${port}   mode: ${mode}`);
});
