# 🏙️ Mega City Tycoon — 3D

A browser-based 3D city-building tycoon game. Place income-generating buildings
on a grid, watch your cash grow, unlock bigger structures, and grow your
skyline from a single house into a sprawling arcology metropolis.

Built with [Three.js](https://threejs.org/) — **no build step, no install**.

![type: web game](https://img.shields.io/badge/type-3D%20web%20game-4ade80)

## ▶️ Play

The game loads Three.js from a CDN, so it needs to be served over HTTP (opening
the file directly with `file://` will be blocked by the browser's module/CORS
rules). From the project root:

```bash
# Python (any 3.x)
python3 -m http.server 8000

# …or Node
npx serve .
```

Then open <http://localhost:8000> in a modern browser.

## 🎮 How to play

- **Pick a building** from the left toolbar (or press number keys `1`–`8`).
- **Click a tile** on the green plot to build it. Each building costs cash and
  earns a steady income per second.
- **Orbit** the camera by dragging, **zoom** with the scroll wheel.
- **Bulldoze** (🚧) sells a building back for 50% of its cost.
- **Esc** deselects the current tool.

Bigger, more profitable buildings unlock as your total building count rises —
from humble **Houses** all the way up to the **Arcology**. Your income ticks up
every second, so reinvest it to expand faster.

| Building | Cost | Income/s | Unlocks at |
|----------|------|----------|------------|
| 🏠 House | $100 | $1 | start |
| 🏪 Corner Shop | $600 | $7 | 3 buildings |
| ☕ Café | $2k | $24 | 8 |
| 🏭 Factory | $7.5k | $90 | 14 |
| 🏢 Office Block | $28k | $320 | 22 |
| 🏨 Grand Hotel | $110k | $1.2k | 32 |
| 🏙️ Skyscraper | $450k | $5k | 45 |
| 🌆 Arcology | $2M | $24k | 60 |

## 💾 Saving

Your city autosaves to the browser's `localStorage` every 15 seconds and on
exit. Use **💾 Save** to save manually or **♻️ Reset** to start over.

## 📁 Project structure

```
index.html        — markup, HUD, import map for Three.js
src/styles.css     — UI styling
src/buildings.js   — building catalogue (economics + appearance)
src/main.js        — scene, rendering, interaction, economy loop
```

## 🛠️ Tech

- Three.js r160 (ES modules via CDN import map)
- `OrbitControls` for camera, raycasting for tile placement
- Soft shadows, hemisphere + directional lighting, slow day/night sun drift
- Pure vanilla JS — no framework, no bundler
