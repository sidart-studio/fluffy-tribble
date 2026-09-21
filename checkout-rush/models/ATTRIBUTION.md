# Model attribution

| File | Title | Author | License |
| ---- | ----- | ------ | ------- |
| `cash_register.glb` | Cash register | Poly by Google | [CC-BY 3.0](https://creativecommons.org/licenses/by/3.0/) |

## Adding models

Drop a `.glb` (or `.gltf` with its sidecar files) into this folder and list it
in `manifest.json`:

```json
{
  "register": { "file": "cash_register.glb", "height": 1.15, "rotationY": 0, "credit": "…" },
  "items": [
    { "id": "soup", "file": "soup_can.glb", "height": 0.4, "rotationY": 90, "credit": "…" },
    { "id": "pineapple", "name": "Pineapple", "price": 3.49, "file": "pineapple.glb", "height": 0.5 }
  ],
  "decoys": [
    { "id": "sunglasses", "name": "Customer's sunglasses", "file": "sunglasses.glb", "height": 0.15 }
  ]
}
```

- `height` is the model's tallest dimension in world units after fitting
  (the counter is 0.9 tall, groceries look right around 0.35–0.6).
- `rotationY` is degrees, useful when a model's front faces the wrong way.
- An item `id` that matches an entry in `src/items.js` replaces that
  placeholder's look and keeps its name and price unless overridden.
  A new `id` adds a brand-new grocery (give it `name` and `price`).
- Entries under `decoys` are things the cashier must *not* scan.
- If a file fails to load, the game logs the error and falls back to the
  primitive placeholder so it never breaks.
