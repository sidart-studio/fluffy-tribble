# Model attribution

| File | Title | Author | License | Used as |
| ---- | ----- | ------ | ------- | ------- |
| `cash_register.glb` | Cash register | Poly by Google | CC-BY 3.0 | The register on the counter |
| `cash_stack.glb` | Cash Stack | J-Toastie | CC-BY 3.0 | Uncollected money on the register |
| `food_worker.glb` | Food Worker | J-Toastie | CC-BY 3.0 | The cashier, the chef (in whites with a toque), and tinted guests |
| `retail_worker.glb` | Retail Worker | J-Toastie | CC-BY 3.0 | Runners who carry plates, and tinted guests |
| `kebab.glb` | Kebab | Poly by Google | CC-BY 3.0 | Every skewer on the menu, meat recolored per dish |
| `the_light.glb` | the light | Ali12 | CC-BY 3.0 | Hanging lamps over the counters and tables; glows brighter as evening falls |
| `kitchen.glb` | Kitchen | sirkitree | CC-BY 3.0 | The kitchen at the back |
| `kitchen_cabinet.glb` | Kitchen Cabinet | Kay Lousberg | CC0 | Cabinet upgrade on the back wall |
| `chef_knife.glb` | Chef Knife | Kay Lousberg | CC0 | Knife upgrade on the pass (converted from FBX with `tools/fbx2glb.mjs`, textured with the kit's shared atlas) |

Poly models are distributed under the Creative Commons licenses shown above.
Licenses as listed on the original Poly pages; verify before redistributing.

## Manifest format

```json
{
  "models": {
    "chef": { "file": "chef.glb", "height": 1.8, "rotationY": 0, "credit": "Chef by … (license)" }
  }
}
```

- `height`: tallest dimension in world units after fitting. People are ~1.75, the counter is 0.95.
- `rotationY`: degrees, if the model's front faces the wrong way.
- Keys the game knows: `register`, `cashStack`, `cashier`, `runner`, `kitchen`, `cabinet`, `knife`, `kebab`, `light`, `chef`.
  Rigged characters may include `Idle`, `Walk`, `Jump` clips; the game plays them when it finds them.
