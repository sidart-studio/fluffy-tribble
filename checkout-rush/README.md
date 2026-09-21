# Checkout Rush

A 3D cashier game built with Three.js around the **Cash register by Poly by
Google** model. Groceries ride a conveyor belt toward the register. Scan each
one while it sits in the glowing scanner zone, leave the customer's own
belongings alone, then ring up the total for a bonus. Three strikes and the
shift is over.

## Play

Any static file server works. From this folder:

```bash
npx serve .            # or: python3 -m http.server 8000
# open the printed URL
```

Opening `index.html` directly from disk will not work: browsers block
`fetch()` of the `.glb` and the ES modules over `file://`.

No build step, no CDN. Three.js r160 is vendored in `vendor/three/` and the
glTF loader is a small local module, so the game runs fully offline.

On phones, landscape gives the best view of the belt. Portrait works but
items appear closer to the scanner, so you get less warning.

## Controls

| Action | Input |
| ------ | ----- |
| Scan an item | Click / tap it while it is in the red zone |
| Ring up the total | Space, Enter, the Total button, or tap the register |
| Pause | P |
| Mute | M |

## Scoring

- +10 per scan, multiplied ×2 / ×3 / ×4 at 5 / 10 / 15 combo.
- Scanning too early resets the combo. Missing an item or scanning a decoy is a strike.
- Letting a decoy roll past untouched: +5.
- Each paid customer: +50, plus a speed bonus and +75 for a flawless checkout.
- Every customer brings more items, a faster belt, and more decoys.

## Adding your own models

See [`models/ATTRIBUTION.md`](models/ATTRIBUTION.md). In short: drop a `.glb`
into `models/`, add it to `models/manifest.json`, reload. Item models replace
the primitive placeholder groceries; the loader (`src/glb-loader.js`) handles
glTF 2.0 static meshes with PBR materials and embedded or external textures.

## Files

```
index.html          page, HUD and overlays
src/game.js         scene, belt, customers, scoring
src/items.js        placeholder groceries and decoys (primitives)
src/glb-loader.js   glTF / GLB loader for Three.js
src/audio.js        synthesized sound effects (WebAudio)
models/             cash_register.glb, manifest.json, attribution
vendor/three/       Three.js r160 (MIT)
```
