# Short Order Tycoon

A 3D kebab diner tycoon built with Three.js around the models in `models/`:
the Poly by Google cash register and kebab, J-Toastie's Food Worker (the
cashier), Retail Worker (the runner) and Cash Stack, Kay Lousberg's kitchen
cabinet and chef's knife, sirkitree's kitchen, and Ali12's hanging light, which
lights the counters and every dining table. Every person in the game,
guests and chef included, is one of the two J-Toastie character rigs with a
different tint; every skewer on the menu is the Poly kebab with its meat
recolored per dish.

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
| Camera views | Overview / Register / Kitchen / Tables buttons, or V to cycle |

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
| Mood lighting | Two more Ali12 lamps over the dining room; guests wait 12% longer and tip 10% more per level |
| Second register | A second cash register and cashier; guests split into two lines |
| Neon sign | 25% more walk-ins per level |
| Expand the menu | Unlocks veggie skewers, shakes and smoothies, then lamb and the mixed platter, then the Chef's Special |
| Cash drawer | The cashier banks the register automatically |

## Playing, not just watching

- **Hustle:** click any staff member (cashiers, runners, the chef) for six
  seconds of double speed. They need a breather before the next one.
- **Calm a guest:** click a waiting guest once to top up their patience.
- **Quests:** the panel under your cash shows the current goal and its cash
  reward. Eighteen quests take you from "serve five guests" to five stars.
- **Streak:** every happy guest in a row raises the tip multiplier, up to
  double at twenty. A walkout resets it.
- **Food critics:** a golden guest with a crown appears now and then. Serve
  them fast for a big reputation jump and triple tip; lose them and it hurts.
- **Second register:** an upgrade adds another cash register and cashier, and
  guests split into two lines.
- **Music and ambience:** a procedural diner tune and a crowd murmur that
  grows with the room. Toggle with the Music button; Mute silences everything.
- Your star rating lights up on the roof sign outside.

## The kitchen

Orders go through the chef's hands. He preps each order at the cutting
board on the pass (faster with a better knife), starts it on a free stove
(more stoves cook more at once, cabinets shorten cook time), and when it is
done he carries the plate from the stove to the pass, where a runner picks
it up. One chef, so the prep step is the bottleneck a bigger kitchen relieves.

## A day in the diner

Each day lasts two minutes. Daylight fades into a warm evening in the last
third and the lamps take over. Just after midday a rush hour doubles walk-ins
for a while. Guests show a speech bubble with what they ordered and a
patience bar; when the bar runs out they leave and cost you a star. Seated
guests lift the skewer to their mouth and eat it bite by bite. At
closing time a summary card shows sales, tips, guests, walkouts and rating.

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
`chef` slot is reserved for a dedicated chef model: until one is listed, the
chef is the Food Worker rig in whites with a toque. See `models/ATTRIBUTION.md`.

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
