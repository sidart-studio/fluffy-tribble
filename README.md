# fluffy-tribble

Single-file browser games. Open the HTML file directly in a browser – no build step or dependencies.

| Game | File | Notes |
|------|------|-------|
| 🎢 Coaster Park Tycoon | `roller-coaster-tycoon.html` | Isometric theme-park tycoon with a roller coaster designer. Pure Canvas 2D, works offline. |
| 🏙 City Tycoon 3D | `index.html` | 3D city builder (loads Three.js from a CDN). |

## Coaster Park Tycoon

- Lay paths from the entrance, place rides and shops next to them, and decorate with scenery.
- Design custom roller coasters: click or drag across tiles to lay track, `Q`/`E` to change the next piece's height, click the first piece to close the circuit, then **Finish**. Excitement, intensity and nausea are rated from the layout, and a physics-driven train runs the track.
- Guests have cash, hunger, thirst, restroom needs, energy, nausea and a preferred thrill level. They queue, ride, shop, and leave when unhappy or broke.
- Set the entry fee and per-ride ticket prices, pay daily upkeep, and deal with breakdowns.
- Goal: park rating 750 with 150 guests. The park autosaves to the browser's local storage.
