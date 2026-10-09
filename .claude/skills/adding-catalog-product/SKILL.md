---
name: adding-catalog-product
description: Use when adding or updating a Samsung appliance or furniture product in the sn-house-interior catalog, replacing sample dimensions with official specs, or adding a new 3D builder (all §7/§20.3 builders exist; see `src/catalog/builders/`).
---

# Adding a catalog product

Read spec §7 and §13 first. Collision, wall-gap and door-swing checks are only as good as these numbers.

## Product (`src/catalog/products.ts`, schema `ProductSchema`)

| Field | Rule |
|---|---|
| `id` | `samsung-<line>-<model-ish>` kebab; `-sample` suffix only for placeholder dims |
| `model` / `name` | official model code / Korean display name |
| `dims` | integer cm W×D×H from the official spec page (round up) |
| `sourceUrl` | required for real products: the spec page you read |
| `power` | `watts` from spec; `dedicatedCircuit: true` for oven/induction/dryer/AC class |
| `clearances` | door `swing` (hinge, radius = door width) and/or `front` depth needed to use it |
| `builder` / `builderParams` | from `BuilderIdSchema`; params express model differences (`cabinet-run` part/doors/counter/sink, `built-in-appliance` panel door/drawer/top, `wardrobe` doors, `basin` cabinet) |
| `mount`, `builtIn`, `category`, `variants` (≥1, colors) | as the spec says |

Verify dims with WebFetch/WebSearch on the official page; never guess. Can't find it → ask the user, keep `-sample`.

## New builder (`src/catalog/builders/`)
1. `<name>.ts` exports `build<Name>(p, v): THREE.Group`, using `parts.ts` helpers and cached materials.
2. Bounding box must equal `dims` (m), sit on y=0, centered on x/z: `builders.test.ts` checks every `CATALOG` entry automatically.
3. Register in `BUILDERS` (`index.ts`). Unregistered ids fall back to `box`.
4. Raised / wall / ceiling products: `mount: 'wall' | 'ceiling'` and `elevation` (cm, product default; spec §20.1). `builderParams.mountHeight` is legacy.

## Then
- `npm run typecheck && npm test`; drag it in the 3D view (exploratory-qa) to see shape, swing fan and collision.
- MODULE-MAP `catalog/` line; `HANDOFF.md` plan 5 progress (syncing-docs).
