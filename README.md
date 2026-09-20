# fluffy-tribble

Small browser games, each a single self-contained HTML file with no build step. Open a file in any modern browser to play.

## Park Tycoon 3D (`park-tycoon.html`)

Build and run a theme park in 3D, rendered with Three.js (loaded from unpkg, so it needs an internet connection):

- Lay footpaths from the entrance, then place rides, food and drink stalls, restrooms, and scenery.
- Guests arrive based on your park rating and ticket price. They get hungry, thirsty, tired, and nauseous, and leave when unhappy.
- Rides break down over time. Hire mechanics to repair them, janitors to clear litter, and entertainers to lift moods.
- Set admission and per-ride prices, run ad campaigns, and take loans from the Park tab. Upkeep and wages are charged nightly.
- Reach milestones for cash bonuses. Progress auto-saves to your browser at the end of each day.

Controls: left-click to build or select, drag to draw paths or bulldoze, right-drag to rotate the camera, mouse wheel to zoom, arrow keys to pan, `R` to reset the view, `Esc` to cancel a tool, `Space` to pause, `1`/`2`/`3` to change speed, `P` for path, `B` for bulldoze.

Animated rides include a spinning carousel and teacups, a turning Ferris wheel, bumper cars, a haunted house, a log flume, a drop tower, and a roller coaster train that follows a looping track. The sun moves across the sky and lamps light up toward evening.

`park-tycoon-2d.html` is the same game with a 2D top-down canvas renderer and no external dependencies.

## City Tycoon 3D (`index.html`)

An isometric city builder rendered with Three.js.
