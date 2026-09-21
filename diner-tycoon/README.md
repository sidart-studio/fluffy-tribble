# Short Order Tycoon

A 3D diner tycoon built with Three.js around the models in `models/`: the
Poly by Google cash register, J-Toastie's Food Worker (the cashier), Retail
Worker (the runner) and Cash Stack, Kay Lousberg's kitchen cabinet and chef's
knife, and sirkitree's kitchen.

Guests queue at the register. The cashier takes their order and their money,
which piles up as a cash stack on the register until you bank it. The kitchen
cooks, the runner carries plates to the pickup counter, guests eat in at
tables or take it to go, and happy guests raise your star rating, which
brings in more guests. Spend the cash on staff, kitchen gear, tables, a neon
sign, and a bigger menu.

## Play it

- **Just play:** open `dist/short-order-tycoon.html` in any modern browser.
  It is a single file with everything embedded, so it works from a USB stick
  or a double-click.
- **Develop:** run a static server here and open `index.html`
  (`npx serve .` or `python3 -m http.server`). Modules and models load
  separately, so edits show up on reload.

The game saves itself in the browser every few seconds and offers **Continue**
on the title screen.

## Controls

| Action | Input |
| ------ | ----- |
| Bank the cash on the register | Click the register, the Collect button, or Space |
| Open the shop | Shop button or B |
| Game speed | 1× / 2× / 3× button, or keys 1, 2, 3 |
| Pause | P |
| Look around | Drag to orbit, wheel to zoom, right-drag to pan |

## Upgrades

| Upgrade | Effect |
| ------- | ------ |
| Hire a runner | Another Retail Worker carries plates (up to 3) |
| Runner sneakers | Runners walk 20% faster per level |
| Cashier training | Orders taken 15% faster per level |
| Chef's knife | Places the knife model on the pass; prep 20% faster per level |
| Extra stove | One more dish cooks at once |
| Kitchen cabinet | Places a cabinet on the back wall; cook time −12% each |
| Dining table | Four seats; seated guests tip and rate you higher |
| Neon sign | 25% more walk-ins per level |
| Expand the menu | Unlocks shakes and pizza, then pasta and steak, then the Chef's Special |
| Cash drawer | The cashier banks the register automatically |

## Building

```bash
node tools/build.mjs
```

Regenerates `index.html` (dev page) and `dist/short-order-tycoon.html`
(standalone) plus `dist/artifact.html` (fragment for hosting on claude.ai).
Everything is bundled from `page.html`, `src/` and `models/` with no
dependencies beyond Node.

## Adding models

Drop a `.glb` into `models/` and describe it in `models/manifest.json`. The
`chef` slot is reserved for the chef model: when a file is listed there, it
replaces the placeholder cook in the kitchen. See `models/ATTRIBUTION.md`.

FBX files can be converted with the bundled tool:

```bash
node tools/fbx2glb.mjs input.fbx models/output.glb --texture atlas.png --name Thing
```

## Files

```
page.html           markup + styles for the game page (source of truth)
index.html          generated dev page
src/game.js         simulation: guests, cashier, kitchen, runners, shop, save/load
src/world.js        diner scene builders and primitive placeholders
src/config.js       menu, upgrade costs, milestones, timing
src/glb-loader.js   glTF/GLB loader with skins and animations for Three.js
src/audio.js        synthesized sound effects
tools/build.mjs     bundler
tools/fbx2glb.mjs   FBX to GLB converter
tools/model-viewer.html  preview page for everything in models/
models/             .glb files, manifest.json, ATTRIBUTION.md
vendor/three/       Three.js r160 + OrbitControls (MIT)
```
