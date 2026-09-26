# Short Order City

A 3D city tycoon built with Three.js. You start as mayor of a crossroads with
one diner on it and build the city around it: homes, workplaces, food
businesses, parks, schools, power plants, all the way to a metropolis. People
move in when there are homes, jobs and food, pay tax every minute, and leave
again when they are hungry, unemployed or breathing factory smoke.

The models in `models/` are all in the game: the Poly by Google cash register
and kebab, J-Toastie's Food Worker (the cashier and the chefs), Retail Worker
(the runners) and Cash Stack, Kay Lousberg's kitchen cabinet and chef's knife,
sirkitree's kitchen, Ali12's hanging light, the Poly hot dog and jeremy's
hamburger. Every person in the city, citizens and diner guests included, is
one of the two J-Toastie character rigs with a different tint; the hot dog,
hamburger and kebab sit on the roofs of the city's food businesses and on the
diner's menu.

The diner at the centre is a fully simulated business of its own: guests
queue at the register, the cashier takes their money, the kitchen cooks, a
runner carries plates to the pickup counter, and the cash stack on the
register grows until you bank it. Citizens walk over from the city to eat
there, so a bigger city means a busier diner.

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
| Build | Pick a category in the bottom bar, pick a building, click an empty block |
| Inspect, upgrade or demolish a building | Click it |
| Bulldoze | Bulldoze button or X, then click a building |
| Buy the next ring of land | Buy land button |
| City view | City button or C |
| Diner: bank the register | Zoom in, then click the register, the Collect button, or Space |
| Diner upgrades | Diner upgrades button or B |
| Game speed | 1× / 2× / 3× button, or keys 1, 2, 3 |
| Pause | P |
| Look around | Drag to orbit, wheel to zoom, right-drag to pan |
| Camera views | City / Diner / Register / Kitchen buttons, or V to cycle |
| Walk as the mayor | WASD or arrows (Shift to run), Walk button or M for the follow camera |
| Talk to a citizen | E next to them, or click them |

## The city

The map is a 9x9 grid of blocks with the diner in the middle. You start with
the 3x3 around it and buy three more rings of land as you grow. The street
grid powers 8 buildings for free; after that you need power plants or the
newest buildings go dark and do nothing.

| Building | Effect |
| -------- | ------ |
| Family houses / Apartments / Residential tower | Homes for 6 / 24 / 90 people |
| Workshop / Office block / Factory | 12 / 40 / 70 jobs paying wages into the treasury; the factory costs happiness |
| Hot dog stand / Kebab house / Burger joint | Food businesses that earn per customer; the uploaded hot dog, kebab and hamburger are their signs |
| Corner shop / Shopping mall | Shops that earn from foot traffic; the mall also employs 25 |
| City park / School / Hospital / Stadium | Happiness, plus faster move-ins (school, hospital) and a food sales boost (stadium) |
| Power plant | Powers 12 more buildings |

Every building can be upgraded to level 3 (1.5x and 2x its numbers).
Ranks unlock buildings: Village at 25 people, Town at 100, City at 300,
Metropolis at 800. Income per minute is tax (per citizen, scaled by
happiness) plus wages plus sales, and the day report shows the split.

## A day in the city

The clock runs from 06:00 to 06:00 (daytime is slower than the night).
Shops and the diner open at 08:00 and close at 18:00. Citizens live in the
homes you build: they step out of their front doors in the morning, walk to
work or go shopping, eat at your diner, and go back inside at night. Every
shop has a worker who opens up, serves at the counter, sweeps the shop front
at closing time and then walks home. The diner staff do the same: they walk
in through the door in the morning, and at 18:00 they serve the last guests,
clean the diner and walk home while the lights go off.

You are the mayor. Press WASD (or the Walk button, M) to walk around the city
as yourself. Walk up to a citizen and press E, or click anyone, to see where
they live and work and what they are doing, then praise them (the whole
city gets a little happier) or fine them ($10 for the treasury, and a
grumble).

## Diner upgrades

| Upgrade | Effect |
| ------- | ------ |
| Hire a runner | Another Retail Worker carries plates (up to 3) |
| Runner sneakers | Runners walk 20% faster per level |
| Cashier training | Orders taken 15% faster per level |
| Chef's knife | Places the knife model on the pass; prep 20% faster per level |
| Sous chef | A second cook with their own board and burner; roughly doubles kitchen output |
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
- **Quests:** the panel under your treasury shows the current goal and its
  cash reward. Twenty-seven quests take you from your first homes to a
  metropolis with a five-star diner.
- **City events:** street food festivals, tourist coaches and government
  grants come around once your town has people in it.
- **Streak:** every happy guest in a row raises the tip multiplier, up to
  double at twenty. A walkout resets it.
- **Food critics:** a golden guest with a crown appears now and then. Serve
  them fast for a big reputation jump and triple tip; lose them and it hurts.
- **Second register:** an upgrade adds another cash register and cashier, and
  guests split into two lines.
- **Music and ambience:** a procedural diner tune and a crowd murmur that
  grows with the room. Toggle with the Music button; Mute silences everything.
- Your star rating lights up on the roof sign outside.

## Nobody walks through anything

Movement runs on a walkability grid (`src/nav.js`): walls, counters, the
kitchen's actual furniture footprints and every table you buy are painted
onto it, A* finds routes around them, and the routes are straightened so
people walk naturally. Guests enter and leave through the door, staff stay
behind the counters, the chef stays in the kitchen, and a soft separation
step keeps people from overlapping while they walk.

## The kitchen

Orders go through the chef's hands. He preps each order at the cutting
board on the pass (faster with a better knife), starts it on a free stove
(more stoves cook more at once, cabinets shorten cook time), and when it is
done he carries the plate from the stove to the pass, where a runner picks
it up. Prep is the bottleneck: a sharper knife speeds it up and a sous chef
doubles it, which you will need once a second register brings in more guests.

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
src/config.js       menu, upgrade costs, quests, milestones, timing
src/nav.js          walkability grid, A* pathfinding, crowd separation
src/city.js         city grid, land rings, buildings, population/economy sim, citizens and cars
src/fx.js           sprite particles (steam, sparkles, hearts, confetti)
src/glb-loader.js   glTF/GLB loader with skins and animations for Three.js
src/audio.js        synthesized sound effects
tools/build.mjs     bundler
tools/fbx2glb.mjs   FBX to GLB converter
tools/model-viewer.html  preview page for everything in models/
models/             .glb files, manifest.json, ATTRIBUTION.md
vendor/three/       Three.js r160 + OrbitControls (MIT)
```
