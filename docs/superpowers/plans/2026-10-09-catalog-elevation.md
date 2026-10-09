# Catalog Expansion + Item Elevation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fill the catalog with the generic-dimension products and 9 procedural builders from spec §20.3, and give items an installation height (elevation) that the 3D view, 2D view, collision checks, properties panel and PDF all honour.

**Architecture:** Schema v5 adds optional `Item.elevation`, `Product.elevation`, `mount: 'ceiling'`, category `bath` and four builder ids. A pure `catalog/elevation.ts` resolves the effective height (item → product → `builderParams.mountHeight` → mount rule); `geometry/vertical.ts` gives span overlap; `validation/validate.ts` filters every obstacle by vertical span. Builders stay one file each under `catalog/builders/` and are registered in `index.ts`; `builders.test.ts` already checks every `CATALOG` entry's bounding box, so each new product automatically tests its builder.

**Tech Stack:** TypeScript, zod, three.js (procedural geometry), React 19, zustand, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-homefit-design.md` §20 (reads with §7 builders, §14.1 lock/verified, §15.3 PDF, §19.1 schema v4 precedent).

## Global Constraints

- Integer **cm** in the model; 3D is metres only via `cmToM`/`mToCm` (`src/model/units.ts`). Builders receive `meters(p.dims)`.
- Schema change ⇒ `CURRENT_VERSION` 4 → 5 with a migration step and a test (`migrating-plan-schema` skill). Never edit an old migration step.
- Items are read/written only through `activeItems` / `withActiveItems`; store edits go through `model/store.ts` actions (one action = one undo step).
- `geometry/`, `validation/`, `checklist/`, `export/pages.ts`, `catalog/elevation.ts` stay React-free with colocated `*.test.ts`.
- UI copy is Korean; icon buttons need `aria-label`. No new dependency.
- Products with generic dimensions: appliance `brand: '삼성'` with id suffix `-sample`; furniture/bath `brand: '일반'`. No `sourceUrl` until official specs arrive.
- Bounding box of every builder output must equal `dims` (m), sit on y=0, be centred on x/z (`builders.test.ts`).
- Never put private data (address, complex name, floor-plan image) in tracked files.
- Before each commit: `npm run typecheck && npm test`.

## Review Focus

1. **Elevated item saved then reloaded from an older v4 JSON** — a v4 file has no `elevation`; it must parse to v5 and every item resolves to the product default (test in Task 1).
2. **Elevation input of a negative or non-integer number** — must clamp to an integer ≥ 0, never throw or store a float (store test in Task 5).
3. **Ceiling item in a plan with no walls** — default elevation must fall back to 230 − h, not `-Infinity` (test in Task 1).
4. **Two items whose vertical spans merely touch (dryer on washer: 0–110 and 110–195)** — must *not* collide (test in Task 2).
5. **Wall-mounted item inside a door swing at door height** — upper cabinet 145–215 overlapping door 0–210 must report `blocksDoor`; a ceiling AC fully above a 210 door (215–240) must not (test in Task 2).

---

### Task 1: Schema v5, migration, elevation resolver

**Files:**
- Modify: `src/model/schema.ts` (ItemSchema, ProductSchema, CategorySchema, BuilderIdSchema, PlanSchema version)
- Modify: `src/persistence/parse.ts` (`CURRENT_VERSION`, `MIGRATIONS[4]`)
- Modify: `src/persistence/parse.test.ts`
- Modify: `src/model/samplePlan.ts`, `src/geometry/pick.test.ts`, `src/editor2d/tools.test.ts`, `src/validation/validate.test.ts` (`version: 4` → `version: 5`)
- Create: `src/catalog/elevation.ts`, `src/catalog/elevation.test.ts`
- Modify: `src/catalog/builders/index.ts` (`mountHeightCm` delegates), `src/catalog/products.ts` (`CATEGORY_ORDER`, `CATEGORY_LABEL` gain `bath`)

**Interfaces:**
- Produces: `Item.elevation?: number`, `Product.elevation?: number`, `Product.mount: 'floor' | 'wall' | 'ceiling'`, `Category` includes `'bath'`, `BuilderId` includes `'toilet' | 'basin' | 'shower' | 'ceiling-ac'`.
- Produces (`src/catalog/elevation.ts`):
  ```ts
  export const DEFAULT_CEILING_CM = 230;
  export const DEFAULT_WALL_MOUNT_CM = 90;
  export function ceilingHeightCm(plan: Pick<Plan, 'walls'>): number;
  export function productElevationCm(product: Product, ceiling: number): number;
  export function itemElevationCm(item: Pick<Item, 'elevation'>, product: Product, ceiling: number): number;
  ```

- [ ] **Step 1: Read the skill and spec**

Read `.claude/skills/migrating-plan-schema/SKILL.md` and spec §20.1.

- [ ] **Step 2: Write the failing tests**

Append to `src/persistence/parse.test.ts` inside `describe('parsePlan', …)` (next to the existing v3→v4 test):

```ts
  it('v4 파일은 v5로 올라가고 elevation 없이도 통과한다', () => {
    const r = parsePlan({ ...JSON.parse(JSON.stringify(SAMPLE_PLAN)), version: 4 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.version).toBe(5);
  });

  it('v5: 아이템 elevation은 0 이상 정수, 제품 mount는 ceiling도 된다', () => {
    const raw = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw.customProducts = [{
      id: 'c1', brand: '일반', model: '', name: '천장 박스', category: 'bath', dims: { w: 80, d: 80, h: 25 },
      variants: [{ id: 'v', label: '기본', colors: {} }], builder: 'ceiling-ac', clearances: [], builtIn: false, mount: 'ceiling', elevation: 205,
    }];
    raw.layouts[0].items = [{ id: 'i1', productId: 'c1', variantId: 'v', x: 100, y: 100, rotation: 0, elevation: 200 }];
    expect(parsePlan(raw).ok).toBe(true);
    raw.layouts[0].items[0].elevation = -1;
    expect(parsePlan(raw).ok).toBe(false);
    raw.layouts[0].items[0].elevation = 1.5;
    expect(parsePlan(raw).ok).toBe(false);
  });
```

Also update the existing `migrate` tests: `{ version: 4, a: 1 }` identity case becomes `{ version: 5, a: 1 }`, and `expect(migrate({ version: 5 })).toBeNull()` becomes `expect(migrate({ version: 6 })).toBeNull()`.

Create `src/catalog/elevation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Product } from '../model/schema';
import { ceilingHeightCm, DEFAULT_CEILING_CM, itemElevationCm, productElevationCm } from './elevation';

const base = (over: Partial<Product>): Product => ({
  id: 'x', brand: 't', model: 'm', name: 'n', category: 'kitchen', dims: { w: 60, d: 60, h: 70 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances: [], builtIn: false, mount: 'floor', ...over,
});

describe('ceilingHeightCm', () => {
  it('벽이 없으면 230', () => {
    expect(ceilingHeightCm({ walls: [] })).toBe(DEFAULT_CEILING_CM);
  });
  it('벽 높이의 최댓값', () => {
    const wall = (height: number) => ({ id: 'w' + height, a: { x: 0, y: 0 }, b: { x: 100, y: 0 }, thickness: 10, height });
    expect(ceilingHeightCm({ walls: [wall(230), wall(250), wall(220)] })).toBe(250);
  });
});

describe('productElevationCm', () => {
  it('floor 제품은 0, wall 제품은 90, ceiling 제품은 천장 − 높이', () => {
    expect(productElevationCm(base({}), 230)).toBe(0);
    expect(productElevationCm(base({ mount: 'wall' }), 230)).toBe(90);
    expect(productElevationCm(base({ mount: 'ceiling', dims: { w: 84, d: 84, h: 25 } }), 230)).toBe(205);
  });
  it('product.elevation이 builderParams.mountHeight보다 우선한다', () => {
    expect(productElevationCm(base({ mount: 'wall', builderParams: { mountHeight: 120 } }), 230)).toBe(120);
    expect(productElevationCm(base({ mount: 'wall', elevation: 145, builderParams: { mountHeight: 120 } }), 230)).toBe(145);
    expect(productElevationCm(base({ elevation: 87 }), 230)).toBe(87);
  });
  it('천장보다 높은 제품은 0에서 멈춘다', () => {
    expect(productElevationCm(base({ mount: 'ceiling', dims: { w: 10, d: 10, h: 300 } }), 230)).toBe(0);
  });
});

describe('itemElevationCm', () => {
  it('item.elevation이 있으면 그 값, 없으면 제품 기본값', () => {
    const p = base({ mount: 'wall', elevation: 145 });
    expect(itemElevationCm({ elevation: 30 }, p, 230)).toBe(30);
    expect(itemElevationCm({}, p, 230)).toBe(145);
    expect(itemElevationCm({ elevation: 0 }, p, 230)).toBe(0);
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/persistence/parse.test.ts src/catalog/elevation.test.ts`
Expected: FAIL (`./elevation` not found; v4 raw rejected with "지원하지 않는 파일 버전").

- [ ] **Step 4: Schema**

In `src/model/schema.ts`:

```ts
export const ItemSchema = z.object({
  id,
  productId: id,
  variantId: id,
  x: cm,
  y: cm,
  rotation: z.number(),
  elevation: cm.nonnegative().optional(), // 바닥에서 밑면까지 설치 높이(cm). 없으면 제품 기본값(catalog/elevation.ts)
  label: z.string().optional(),
  locked: z.boolean().optional(),
  verified: z.boolean().optional(),
});
```

```ts
export const BuilderIdSchema = z.enum([
  'box', 'fridge', 'front-loader', 'tv', 'sofa', 'bed', 'table',
  'stand-ac', 'built-in-appliance', 'cabinet-run', 'chair', 'wardrobe',
  'toilet', 'basin', 'shower', 'ceiling-ac',
]);

export const CategorySchema = z.enum(['kitchen', 'laundry', 'tv', 'climate', 'living', 'furniture', 'bath', 'custom']);
```

In `ProductSchema` replace `mount: z.enum(['floor', 'wall'])` with:

```ts
  mount: z.enum(['floor', 'wall', 'ceiling']),
  elevation: cm.nonnegative().optional(), // 제품 기본 설치 높이(cm). item.elevation → 이 값 → builderParams.mountHeight → mount 규칙
```

`PlanSchema`: `version: z.literal(5)`.

- [ ] **Step 5: Migration and fixtures**

`src/persistence/parse.ts`: `export const CURRENT_VERSION = 5;` and add

```ts
  // v5: 아이템·제품 설치 높이(elevation), mount 'ceiling', 분류 'bath', builder 4종 추가. 모두 선택·확장이라 버전만 올린다
  4: (raw) => ({ ...raw, version: 5 }),
```

Change `version: 4` to `version: 5` in `src/model/samplePlan.ts`, `src/geometry/pick.test.ts`, `src/editor2d/tools.test.ts`, `src/validation/validate.test.ts`. Run `grep -rn "version: 4" src e2e` — only `parse.ts` migration comments/tests may remain.

- [ ] **Step 6: Elevation resolver and category labels**

Create `src/catalog/elevation.ts`:

```ts
import type { Item, Plan, Product } from '../model/schema';

export const DEFAULT_CEILING_CM = 230;
export const DEFAULT_WALL_MOUNT_CM = 90;

// 천장 높이 = 평면 벽 높이의 최댓값(벽이 없으면 230)
export function ceilingHeightCm(plan: Pick<Plan, 'walls'>): number {
  return plan.walls.length > 0 ? Math.max(...plan.walls.map((w) => w.height)) : DEFAULT_CEILING_CM;
}

// 제품 기본 설치 높이(스펙 §20.1 우선순위)
export function productElevationCm(product: Product, ceiling: number): number {
  if (product.elevation !== undefined) return product.elevation;
  const legacy = product.builderParams?.mountHeight;
  if (typeof legacy === 'number') return legacy;
  if (product.mount === 'wall') return DEFAULT_WALL_MOUNT_CM;
  if (product.mount === 'ceiling') return Math.max(0, ceiling - product.dims.h);
  return 0;
}

export function itemElevationCm(item: Pick<Item, 'elevation'>, product: Product, ceiling: number): number {
  return item.elevation ?? productElevationCm(product, ceiling);
}
```

In `src/catalog/builders/index.ts` replace `mountHeightCm` with a delegate (keeps the existing test green):

```ts
import { DEFAULT_CEILING_CM, productElevationCm } from '../elevation';
// 제품 기본 설치 높이. 평면이 없는 곳(테스트·카탈로그)용; 화면은 itemElevationCm을 쓴다
export function mountHeightCm(p: Product): number {
  return productElevationCm(p, DEFAULT_CEILING_CM);
}
```

In `src/catalog/products.ts`:

```ts
export const CATEGORY_ORDER: Category[] = ['kitchen', 'laundry', 'tv', 'climate', 'living', 'furniture', 'bath', 'custom'];
```
and add `bath: '욕실',` to `CATEGORY_LABEL` (before `custom`).

- [ ] **Step 7: Run all checks**

Run: `npm run typecheck && npm test`
Expected: PASS. If a test file still builds a `version: 4` plan literal, typecheck names it — fix to 5.

- [ ] **Step 8: Commit**

```bash
git add src/model/schema.ts src/persistence/parse.ts src/persistence/parse.test.ts src/model/samplePlan.ts src/geometry/pick.test.ts src/editor2d/tools.test.ts src/validation/validate.test.ts src/catalog/elevation.ts src/catalog/elevation.test.ts src/catalog/builders/index.ts src/catalog/products.ts
git commit -m "feat: schema v5 with item/product elevation, ceiling mount, bath category (spec §20.1)"
```

---

### Task 2: Vertical spans in collision checks

**Files:**
- Create: `src/geometry/vertical.ts`, `src/geometry/vertical.test.ts`
- Modify: `src/validation/validate.ts`
- Modify: `src/validation/validate.test.ts`

**Interfaces:**
- Consumes: `itemElevationCm`, `ceilingHeightCm` from `src/catalog/elevation.ts` (Task 1).
- Produces (`src/geometry/vertical.ts`):
  ```ts
  export type Span = { lo: number; hi: number };
  export function spansOverlap(a: Span, b: Span): boolean; // a.lo < b.hi && b.lo < a.hi
  export function itemSpan(elevation: number, h: number): Span;
  ```
- `validatePlan(plan, resolve)` signature unchanged.

- [ ] **Step 1: Write the failing tests**

Create `src/geometry/vertical.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { itemSpan, spansOverlap } from './vertical';

describe('spansOverlap', () => {
  it('겹치면 true', () => {
    expect(spansOverlap({ lo: 0, hi: 100 }, { lo: 50, hi: 150 })).toBe(true);
    expect(spansOverlap({ lo: 50, hi: 60 }, { lo: 0, hi: 100 })).toBe(true);
  });
  it('경계만 닿으면 false (세탁기 0–110 위 건조기 110–195)', () => {
    expect(spansOverlap({ lo: 0, hi: 110 }, { lo: 110, hi: 195 })).toBe(false);
    expect(spansOverlap({ lo: 110, hi: 195 }, { lo: 0, hi: 110 })).toBe(false);
  });
  it('떨어져 있으면 false', () => {
    expect(spansOverlap({ lo: 0, hi: 80 }, { lo: 90, hi: 186 })).toBe(false);
  });
});

describe('itemSpan', () => {
  it('밑면 높이와 제품 높이로 구간을 만든다', () => {
    expect(itemSpan(87, 6)).toEqual({ lo: 87, hi: 93 });
  });
});
```

Append to `src/validation/validate.test.ts` (inside `describe('validatePlan')`). First extend the `products` map:

```ts
  upper: base({ id: 'upper', dims: { w: 240, d: 35, h: 70 }, mount: 'wall', elevation: 145, clearances: [{ kind: 'front', depth: 40 }] }),
  table: base({ id: 'table', dims: { w: 140, d: 80, h: 74 } }),
  counter: base({ id: 'counter', dims: { w: 240, d: 60, h: 87 } }),
  cooktop: base({ id: 'cooktop', dims: { w: 60, d: 52, h: 6 }, elevation: 87 }),
  ceilingAc: base({ id: 'ceilingAc', dims: { w: 84, d: 84, h: 25 }, mount: 'ceiling' }),
  washer: base({ id: 'washer', dims: { w: 70, d: 85, h: 110 } }),
  dryer: base({ id: 'dryer', dims: { w: 70, d: 85, h: 85 } }),
```

and `item` helper gains an optional elevation: `const item = (id: string, productId: string, x: number, y: number, rotation = 0, elevation?: number): Item => ({ id, productId, variantId: 'v', x, y, rotation, ...(elevation === undefined ? {} : { elevation }) });`

Tests:

```ts
  it('벽걸이 TV(90–180)와 냉장고(0–185)는 세로로 겹치므로 충돌', () => {
    const s = validatePlan(plan({ items: [item('t', 'tv', 100, 100), item('f', 'fridge', 100, 100)] }), resolve);
    expect(s.t.collides).toBe(true);
    expect(s.f.collides).toBe(true);
  });

  it('상판(0–87) 위 인덕션(87–93)은 충돌이 아니다', () => {
    const s = validatePlan(plan({ items: [item('c', 'counter', 120, 30), item('i', 'cooktop', 120, 30)] }), resolve);
    expect(s.c.collides).toBe(false);
    expect(s.i.collides).toBe(false);
  });

  it('세탁기 위 직렬 건조기(elevation 110)는 충돌이 아니고, 바닥에 두면 충돌', () => {
    const stacked = validatePlan(plan({ items: [item('w', 'washer', 100, 100), item('d', 'dryer', 100, 100, 0, 110)] }), resolve);
    expect(stacked.w.collides).toBe(false);
    expect(stacked.d.collides).toBe(false);
    const floor = validatePlan(plan({ items: [item('w', 'washer', 100, 100), item('d', 'dryer', 100, 100)] }), resolve);
    expect(floor.d.collides).toBe(true);
  });

  it('상부장 아래 식탁은 앞 공간을 막지 않고, 냉장고는 막는다', () => {
    const under = validatePlan(plan({ items: [item('u', 'upper', 120, 17), item('t', 'table', 120, 70)] }), resolve);
    expect(under.u.clearanceBlocked).toBe(false);
    const fridge = validatePlan(plan({ items: [item('u', 'upper', 120, 17), item('f', 'fridge', 120, 90)] }), resolve);
    expect(fridge.u.clearanceBlocked).toBe(true);
  });

  it('문 높이 구간과 겹치는 아이템만 blocksDoor: 상부장은 간섭, 문 위 천장형 에어컨은 아님', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 240 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 100, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true }];
    const s = validatePlan(plan({ walls, openings, items: [item('u', 'upper', 140, 60), item('a', 'ceilingAc', 140, 60)] }), resolve);
    expect(s.u.blocksDoor).toBe(true); // 145–215 vs 0–210
    expect(s.a.blocksDoor).toBe(false); // 천장 240 → 215–240 vs 0–210
  });

  it('벽 높이 위에 있는 아이템은 벽과 충돌하지 않는다', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20, height: 100 }];
    const s = validatePlan(plan({ walls, items: [item('a', 'cube', 100, 20, 0, 150)] }), resolve);
    expect(s.a.collides).toBe(false);
  });
```

Keep the existing test `'벽걸이 TV는 바닥 가구와 겹쳐도 충돌이 아니다'` (TV 90–180 vs bench 0–45 still passes).

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/geometry/vertical.test.ts src/validation/validate.test.ts`
Expected: FAIL (`./vertical` missing; TV+fridge expects collides true but current code skips wall items).

- [ ] **Step 3: Implement**

Create `src/geometry/vertical.ts`:

```ts
export type Span = { lo: number; hi: number };

// 경계가 닿기만 하면 겹침이 아니다(세탁기 위 건조기)
export function spansOverlap(a: Span, b: Span): boolean {
  return a.lo < b.hi && b.lo < a.hi;
}

export function itemSpan(elevation: number, h: number): Span {
  return { lo: elevation, hi: elevation + h };
}
```

Rewrite `src/validation/validate.ts` body of `validatePlan` (types above it unchanged except `Obstacle` gains `span`):

```ts
import { ceilingHeightCm, itemElevationCm } from '../catalog/elevation';
import { doorLeaves, itemClearances } from '../geometry/clearance';
import { itemObb, obbOverlap, type OBB } from '../geometry/obb';
import { itemSpan, spansOverlap, type Span } from '../geometry/vertical';
import { planWallObbsWithIds } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Plan, Product } from '../model/schema';

export type ConflictTarget = { kind: 'item' | 'wall' | 'door'; id: string };
export type Conflict = { type: 'collides' | 'clearance' | 'blocksDoor'; target: ConflictTarget };
export type ItemStatus = { collides: boolean; clearanceBlocked: boolean; blocksDoor: boolean; conflicts: Conflict[] };

type Obstacle = { target: ConflictTarget; obb: OBB; span: Span };

function statusOf(conflicts: Conflict[]): ItemStatus {
  return {
    collides: conflicts.some((c) => c.type === 'collides'),
    clearanceBlocked: conflicts.some((c) => c.type === 'clearance'),
    blocksDoor: conflicts.some((c) => c.type === 'blocksDoor'),
    conflicts,
  };
}

// 평면 OBB가 겹치고 세로 구간도 겹칠 때만 충돌(스펙 §20.2)
export function validatePlan(plan: Plan, resolve: (productId: string) => Product | undefined): Record<string, ItemStatus> {
  const ceiling = ceilingHeightCm(plan);
  const wallById = new Map(plan.walls.map((w) => [w.id, w]));
  const walls: Obstacle[] = planWallObbsWithIds(plan).map(({ wallId, obb }) => ({
    target: { kind: 'wall', id: wallId },
    obb,
    span: { lo: 0, hi: wallById.get(wallId)?.height ?? ceiling },
  }));
  const doors: Obstacle[] = plan.openings.flatMap((o) => {
    const w = wallById.get(o.wallId);
    if (!w || o.kind !== 'door') return [];
    const span = { lo: o.sill, hi: o.sill + o.height };
    return doorLeaves(w, o).map((l) => ({ target: { kind: 'door' as const, id: o.id }, obb: l.swing.obb, span }));
  });
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    if (!product) return [];
    const span = itemSpan(itemElevationCm(item, product, ceiling), product.dims.h);
    return [{ item, product, span, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }];
  });

  const result: Record<string, ItemStatus> = {};
  for (const item of activeItems(plan)) result[item.id] = statusOf([]);
  for (const p of placed) {
    const conflicts: Conflict[] = [];
    const seen = new Set<string>();
    const add = (type: Conflict['type'], shape: OBB, obstacles: Obstacle[]) => {
      for (const o of obstacles) {
        const key = `${type}:${o.target.kind}:${o.target.id}`;
        if (seen.has(key) || !spansOverlap(p.span, o.span) || !obbOverlap(shape, o.obb)) continue;
        seen.add(key);
        conflicts.push({ type, target: o.target });
      }
    };
    const others: Obstacle[] = placed
      .filter((o) => o.item.id !== p.item.id)
      .map((o) => ({ target: { kind: 'item', id: o.item.id }, obb: o.fp, span: o.span }));
    add('collides', p.fp, walls);
    add('collides', p.fp, others);
    for (const c of itemClearances(p.item, p.product)) {
      add('clearance', c.obb, walls);
      add('clearance', c.obb, others);
    }
    add('blocksDoor', p.fp, doors);
    result[p.item.id] = statusOf(conflicts);
  }
  return result;
}
```

- [ ] **Step 4: Run tests**

Run: `npm run typecheck && npm test`
Expected: PASS. If `checklist/items.test.ts` or `describe.test.ts` relied on wall items skipping item collisions, read the failing expectation and confirm it contradicts §20.2 before changing it — do not edit expected values to get green otherwise.

- [ ] **Step 5: Commit**

```bash
git add src/geometry/vertical.ts src/geometry/vertical.test.ts src/validation/validate.ts src/validation/validate.test.ts
git commit -m "feat: collision, clearance and door checks honour vertical spans (spec §20.2)"
```

---

### Task 3: Kitchen and climate builders + products

**Files:**
- Create: `src/catalog/builders/standAc.ts`, `src/catalog/builders/builtInAppliance.ts`, `src/catalog/builders/cabinetRun.ts`, `src/catalog/builders/ceilingAc.ts`
- Modify: `src/catalog/builders/index.ts` (register), `src/catalog/builders/builders.test.ts`, `src/catalog/products.ts` (12 products)
- Modify: `docs/superpowers/specs/2026-10-08-homefit-design.md` §20.3 (`built-in-appliance` params gain `'top'`; drop the unused `cooktop` mention from `cabinet-run`)

**Interfaces:**
- Consumes: `box`, `color`, `group`, `meters` from `parts.ts`; `Product`, `Variant` types.
- Produces: `buildStandAc`, `buildBuiltInAppliance`, `buildCabinetRun`, `buildCeilingAc` — each `(p: Product, v: Variant) => THREE.Group`; registered under `'stand-ac'`, `'built-in-appliance'`, `'cabinet-run'`, `'ceiling-ac'`.
- Product ids used later (Task 7 e2e, QA): `samsung-upper-cabinet-240-sample`, `samsung-sink-base-240-sample`, `samsung-dryer-sample`, `samsung-ceiling-ac-sample`.

- [ ] **Step 1: Spec touch-up**

In §20.3 builder table change the `built-in-appliance` row params to `` `panel: 'door' \| 'drawer' \| 'top'` (`top`: 상판 매립 인덕션, 검은 유리 윗면) `` and the `cabinet-run` 표현 cell to `하부장: 몸통 + 상판(4cm) + 문짝 줄눈; 상부장: 몸통 + 문짝 줄눈. \`sink\`가 있으면 상판에 싱크 홈`.

- [ ] **Step 2: Write the failing tests**

In `src/catalog/builders/builders.test.ts`:
- Change the "builder가 아직 없는 제품은 박스로 그린다" test to use an unregistered id: `builder: 'nope' as BuilderId` (import `BuilderId` type from `../../model/schema`).
- Append inside `describe('buildProduct')`:

```ts
  it('하부장은 상판과 문짝 수만큼의 문이 있고, 싱크가 있으면 싱크 홈이 있다', () => {
    const p = CATALOG.find((x) => x.id === 'samsung-sink-base-240-sample')!;
    const g = buildProduct(p, p.variants[0].id);
    expect(countNamed(g, 'door')).toBe(4);
    expect(countNamed(g, 'counter')).toBe(1);
    expect(countNamed(g, 'sink')).toBe(1);
  });

  it('상부장은 상판이 없고 벽걸이 기본 높이 145', () => {
    const p = CATALOG.find((x) => x.id === 'samsung-upper-cabinet-240-sample')!;
    expect(countNamed(buildProduct(p, p.variants[0].id), 'counter')).toBe(0);
    expect(mountHeightCm(p)).toBe(145);
  });

  it('빌트인 가전은 전면 패널만 변형 색이고, 인덕션은 윗면 유리가 있다', () => {
    const dw = CATALOG.find((x) => x.id === 'samsung-dishwasher-sample')!;
    expect(countNamed(buildProduct(dw, dw.variants[0].id), 'front-panel')).toBe(1);
    const hob = CATALOG.find((x) => x.id === 'samsung-induction-sample')!;
    expect(countNamed(buildProduct(hob, hob.variants[0].id), 'cooktop-glass')).toBe(1);
    expect(mountHeightCm(hob)).toBe(87);
  });

  it('스탠드·천장형 에어컨은 토출구가 있고 천장형은 ceiling 기본 높이', () => {
    const stand = CATALOG.find((x) => x.id === 'samsung-stand-ac-sample')!;
    expect(countNamed(buildProduct(stand, stand.variants[0].id), 'vent')).toBe(1);
    const ceil = CATALOG.find((x) => x.id === 'samsung-ceiling-ac-sample')!;
    expect(countNamed(buildProduct(ceil, ceil.variants[0].id), 'vent')).toBe(4);
    expect(mountHeightCm(ceil)).toBe(230 - 25);
  });
```

(`countNamed` is already defined in that file; move its definition above these tests if it sits below.)

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run src/catalog/builders/builders.test.ts`
Expected: FAIL (products not found).

- [ ] **Step 4: Builders**

`src/catalog/builders/standAc.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const SKIN = 0.002;

// 좁고 긴 기둥 + 상단 토출구 띠
export function buildStandAc(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const ventH = H * 0.3;
  const vent = box(W - 0.008, ventH, SKIN, color(v.colors, 'vent', '#5c6066'), 0, H - ventH / 2 - 0.02, D / 2 - SKIN / 2);
  vent.name = 'vent';
  return group(box(W, H, D - SKIN, color(v.colors, 'body', '#f2f2f2'), 0, H / 2, -SKIN / 2), vent);
}
```

`src/catalog/builders/builtInAppliance.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.02;
const GAP = 0.004;

// 하부장 매립 가전: 본체는 짙은 회색, 전면 패널(또는 인덕션 윗면 유리)만 변형 색
export function buildBuiltInAppliance(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const kind = (p.builderParams?.panel as 'door' | 'drawer' | 'top' | undefined) ?? 'door';
  const body = box(W, H, kind === 'top' ? D : D - PANEL, color(v.colors, 'body', '#3a3d42'), 0, H / 2, kind === 'top' ? 0 : -PANEL / 2);
  if (kind === 'top') {
    const glass = box(W - 0.01, 0.002, D - 0.01, color(v.colors, 'panel', '#15171a'), 0, H - 0.001, 0);
    glass.name = 'cooktop-glass';
    return group(body, glass);
  }
  const panel = box(W - GAP, H - GAP, PANEL, color(v.colors, 'panel', '#e9e6df'), 0, H / 2, D / 2 - PANEL / 2);
  panel.name = 'front-panel';
  const handleY = kind === 'door' ? Math.max(0.03, H - 0.06) : H / 2;
  const handle = box(W * 0.8, 0.012, PANEL / 2, color(v.colors, 'handle', '#9a9a9a'), 0, handleY, D / 2 - PANEL / 4);
  handle.name = 'handle';
  return group(body, panel, handle);
}
```

`src/catalog/builders/cabinetRun.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const COUNTER = 0.04;
const PANEL = 0.018;
const GAP = 0.003;

// 주방 하부장(상판 포함)·상부장·TV장. 문짝 수는 doors, 상판은 base일 때 counter(기본 true)
export function buildCabinetRun(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const part = (p.builderParams?.part as 'base' | 'upper' | undefined) ?? 'base';
  const doors = Math.max(1, Math.round(Number(p.builderParams?.doors ?? 2)));
  const counter = part === 'base' && p.builderParams?.counter !== false;
  const sink = counter && p.builderParams?.sink === true;
  const bodyH = counter ? H - COUNTER : H;
  const parts = [box(W, bodyH, D - PANEL, color(v.colors, 'body', '#d9d3ca'), 0, bodyH / 2, -PANEL / 2)];
  const dw = W / doors;
  for (let i = 0; i < doors; i++) {
    const door = box(dw - GAP, bodyH - GAP, PANEL, color(v.colors, 'door', '#efe9df'), -W / 2 + dw * (i + 0.5), bodyH / 2, D / 2 - PANEL / 2);
    door.name = 'door';
    parts.push(door);
  }
  if (counter) {
    const top = box(W, COUNTER, D, color(v.colors, 'counter', '#bdb6ad'), 0, H - COUNTER / 2, 0);
    top.name = 'counter';
    parts.push(top);
  }
  if (sink) {
    const bowl = box(Math.min(0.8, W * 0.4), 0.002, D * 0.6, color(v.colors, 'sink', '#aeb4ba'), 0, H - 0.001, 0);
    bowl.name = 'sink';
    parts.push(bowl);
  }
  return group(...parts);
}
```

`src/catalog/builders/ceilingAc.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.01;
const VENT = 0.03;

// 천장 매립형: 납작한 본체 + 아랫면 패널 + 토출구 4면(아랫면 가장자리)
export function buildCeilingAc(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const body = box(W, H - PANEL, D, color(v.colors, 'body', '#f4f4f4'), 0, PANEL + (H - PANEL) / 2, 0);
  const panel = box(W, PANEL, D, color(v.colors, 'panel', '#ffffff'), 0, PANEL / 2, 0);
  const ventC = color(v.colors, 'vent', '#6b7075');
  const vents = [
    box(W * 0.7, 0.002, VENT, ventC, 0, 0.001, D / 2 - VENT),
    box(W * 0.7, 0.002, VENT, ventC, 0, 0.001, -D / 2 + VENT),
    box(VENT, 0.002, D * 0.7, ventC, W / 2 - VENT, 0.001, 0),
    box(VENT, 0.002, D * 0.7, ventC, -W / 2 + VENT, 0.001, 0),
  ];
  for (const m of vents) m.name = 'vent';
  return group(body, panel, ...vents);
}
```

Register in `src/catalog/builders/index.ts`:

```ts
import { buildBuiltInAppliance } from './builtInAppliance';
import { buildCabinetRun } from './cabinetRun';
import { buildCeilingAc } from './ceilingAc';
import { buildStandAc } from './standAc';
…
  'stand-ac': buildStandAc,
  'built-in-appliance': buildBuiltInAppliance,
  'cabinet-run': buildCabinetRun,
  'ceiling-ac': buildCeilingAc,
```

- [ ] **Step 5: Products**

Append to `CATALOG` in `src/catalog/products.ts` (after the existing six; keep the header comment and add `// 아래 치수는 일반값(§20.3). 삼성 모델 목록을 받으면 adding-catalog-product 절차로 교체한다`):

```ts
  {
    id: 'samsung-kimchi-4door-sample',
    brand: '삼성',
    model: '김치플러스 4도어 (샘플 치수)',
    name: '김치냉장고 4도어',
    category: 'kitchen',
    dims: { w: 92, d: 80, h: 185 },
    variants: [{ id: 'white', label: '화이트', colors: { panel: '#eeece6', body: '#c9c9c9' } }],
    builder: 'fridge',
    builderParams: { split: '4door', topRatio: 0.55 },
    clearances: [
      { kind: 'swing', hinge: 'left', radius: 46 },
      { kind: 'swing', hinge: 'right', radius: 46 },
    ],
    power: { watts: 250, dedicatedCircuit: false },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-induction-sample',
    brand: '삼성',
    model: '인덕션 3구 (샘플 치수)',
    name: '인덕션 3구',
    category: 'kitchen',
    dims: { w: 60, d: 52, h: 6 },
    variants: [{ id: 'black', label: '블랙', colors: { panel: '#15171a', body: '#3a3d42' } }],
    builder: 'built-in-appliance',
    builderParams: { panel: 'top' },
    clearances: [],
    power: { watts: 7200, dedicatedCircuit: true },
    builtIn: true,
    mount: 'floor',
    elevation: 87,
  },
  {
    id: 'samsung-dishwasher-sample',
    brand: '삼성',
    model: '빌트인 식기세척기 (샘플 치수)',
    name: '빌트인 식기세척기',
    category: 'kitchen',
    dims: { w: 60, d: 57, h: 82 },
    variants: [{ id: 'white', label: '화이트', colors: { panel: '#e9e6df', body: '#3a3d42' } }],
    builder: 'built-in-appliance',
    builderParams: { panel: 'door' },
    clearances: [{ kind: 'front', depth: 60 }],
    power: { watts: 2000, dedicatedCircuit: true },
    builtIn: true,
    mount: 'floor',
  },
  {
    id: 'samsung-oven-sample',
    brand: '삼성',
    model: '빌트인 오븐 (샘플 치수)',
    name: '빌트인 오븐',
    category: 'kitchen',
    dims: { w: 60, d: 57, h: 45 },
    variants: [{ id: 'black', label: '블랙', colors: { panel: '#2a2d31', body: '#3a3d42' } }],
    builder: 'built-in-appliance',
    builderParams: { panel: 'door' },
    clearances: [{ kind: 'front', depth: 50 }],
    power: { watts: 3000, dedicatedCircuit: true },
    builtIn: true,
    mount: 'floor',
    elevation: 60,
  },
  {
    id: 'samsung-sink-base-240-sample',
    brand: '삼성',
    model: '싱크대 하부장 240 (샘플 치수)',
    name: '싱크대 하부장 240',
    category: 'kitchen',
    dims: { w: 240, d: 60, h: 87 },
    variants: [
      { id: 'white', label: '화이트', colors: { body: '#d9d3ca', door: '#efe9df', counter: '#bdb6ad' } },
      { id: 'oak', label: '오크', colors: { body: '#b08a62', door: '#c9a06c', counter: '#e8e2d6' } },
    ],
    builder: 'cabinet-run',
    builderParams: { part: 'base', doors: 4, counter: true, sink: true },
    clearances: [{ kind: 'front', depth: 60 }],
    builtIn: true,
    mount: 'floor',
  },
  {
    id: 'samsung-sink-base-180-sample',
    brand: '삼성',
    model: '싱크대 하부장 180 (샘플 치수)',
    name: '싱크대 하부장 180',
    category: 'kitchen',
    dims: { w: 180, d: 60, h: 87 },
    variants: [
      { id: 'white', label: '화이트', colors: { body: '#d9d3ca', door: '#efe9df', counter: '#bdb6ad' } },
      { id: 'oak', label: '오크', colors: { body: '#b08a62', door: '#c9a06c', counter: '#e8e2d6' } },
    ],
    builder: 'cabinet-run',
    builderParams: { part: 'base', doors: 3, counter: true },
    clearances: [{ kind: 'front', depth: 60 }],
    builtIn: true,
    mount: 'floor',
  },
  {
    id: 'samsung-upper-cabinet-240-sample',
    brand: '삼성',
    model: '상부장 240 (샘플 치수)',
    name: '상부장 240',
    category: 'kitchen',
    dims: { w: 240, d: 35, h: 70 },
    variants: [
      { id: 'white', label: '화이트', colors: { body: '#d9d3ca', door: '#efe9df' } },
      { id: 'oak', label: '오크', colors: { body: '#b08a62', door: '#c9a06c' } },
    ],
    builder: 'cabinet-run',
    builderParams: { part: 'upper', doors: 4 },
    clearances: [{ kind: 'front', depth: 40 }],
    builtIn: true,
    mount: 'wall',
    elevation: 145,
  },
  {
    id: 'samsung-dryer-sample',
    brand: '삼성',
    model: '그랑데 건조기 (샘플 치수)',
    name: '그랑데 건조기',
    category: 'laundry',
    dims: { w: 60, d: 66, h: 85 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#eeeeee', door: '#3a404a' } }],
    builder: 'front-loader',
    clearances: [{ kind: 'front', depth: 60 }],
    power: { watts: 1800, dedicatedCircuit: true },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-stand-ac-sample',
    brand: '삼성',
    model: '무풍 스탠드 에어컨 (샘플 치수)',
    name: '스탠드 에어컨',
    category: 'climate',
    dims: { w: 38, d: 36, h: 188 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#f2f2f2', vent: '#5c6066' } }],
    builder: 'stand-ac',
    clearances: [{ kind: 'front', depth: 30 }],
    power: { watts: 2200, dedicatedCircuit: true },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-wall-ac-sample',
    brand: '삼성',
    model: '벽걸이 에어컨 (샘플 치수)',
    name: '벽걸이 에어컨',
    category: 'climate',
    dims: { w: 85, d: 25, h: 30 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#f4f4f4' } }],
    builder: 'box',
    clearances: [],
    power: { watts: 900, dedicatedCircuit: true },
    builtIn: false,
    mount: 'wall',
    elevation: 195,
  },
  {
    id: 'samsung-ceiling-ac-sample',
    brand: '삼성',
    model: '천장형 시스템 에어컨 (샘플 치수)',
    name: '천장형 시스템 에어컨',
    category: 'climate',
    dims: { w: 84, d: 84, h: 25 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#f4f4f4', panel: '#ffffff', vent: '#6b7075' } }],
    builder: 'ceiling-ac',
    clearances: [],
    power: { watts: 2500, dedicatedCircuit: true },
    builtIn: true,
    mount: 'ceiling',
  },
  {
    id: 'samsung-air-purifier-sample',
    brand: '삼성',
    model: '공기청정기 (샘플 치수)',
    name: '공기청정기',
    category: 'living',
    dims: { w: 37, d: 37, h: 60 },
    variants: [{ id: 'gray', label: '그레이', colors: { body: '#d8d9db' } }],
    builder: 'box',
    clearances: [],
    power: { watts: 60, dedicatedCircuit: false },
    builtIn: false,
    mount: 'floor',
  },
```

- [ ] **Step 6: Run tests**

Run: `npm run typecheck && npm test`
Expected: PASS, including one auto bounding-box test per new product. A failing bounds test names the product: fix the builder (a part protrudes past `dims`), never the expected values.

- [ ] **Step 7: Commit**

```bash
git add src/catalog/builders/standAc.ts src/catalog/builders/builtInAppliance.ts src/catalog/builders/cabinetRun.ts src/catalog/builders/ceilingAc.ts src/catalog/builders/index.ts src/catalog/builders/builders.test.ts src/catalog/products.ts docs/superpowers/specs/2026-10-08-homefit-design.md
git commit -m "feat: kitchen and climate builders with 12 generic products (spec §20.3)"
```

---

### Task 4: Furniture and bath builders + products

**Files:**
- Modify: `src/catalog/builders/parts.ts` (add `cylinder`, `glass`)
- Create: `src/catalog/builders/chair.ts`, `src/catalog/builders/wardrobe.ts`, `src/catalog/builders/toilet.ts`, `src/catalog/builders/basin.ts`, `src/catalog/builders/shower.ts`
- Modify: `src/catalog/builders/index.ts`, `src/catalog/builders/builders.test.ts`, `src/catalog/products.ts` (11 products)

**Interfaces:**
- Produces (`parts.ts`): `cylinder(r: number, h: number, color: string, x: number, y: number, z: number): THREE.Mesh` (axis y, centre at x,y,z); `glass(w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh` (shared transparent material, not disposed).
- Produces builders `buildChair`, `buildWardrobe`, `buildToilet`, `buildBasin`, `buildShower` registered under `'chair'`, `'wardrobe'`, `'toilet'`, `'basin'`, `'shower'`.
- Product ids used later: `wardrobe-builtin-240`, `desk-140`, `chair-dining`, `toilet-std`, `basin-std`, `shower-90`, `bathtub-150`.

- [ ] **Step 1: Write the failing tests**

Append to `builders.test.ts`:

```ts
  it('옷장은 문짝 수만큼 문과 손잡이가 있다', () => {
    const p = CATALOG.find((x) => x.id === 'wardrobe-builtin-240')!;
    const g = buildProduct(p, p.variants[0].id);
    expect(countNamed(g, 'door')).toBe(4);
    expect(countNamed(g, 'handle')).toBe(4);
  });

  it('의자는 다리 4개와 등받이가 있다', () => {
    const p = CATALOG.find((x) => x.id === 'chair-dining')!;
    const g = buildProduct(p, p.variants[0].id);
    expect(countNamed(g, 'leg')).toBe(4);
    expect(countNamed(g, 'back')).toBe(1);
  });

  it('욕실: 양변기 물탱크, 세면대 수전, 샤워부스 유리 2면', () => {
    const t = CATALOG.find((x) => x.id === 'toilet-std')!;
    expect(countNamed(buildProduct(t, t.variants[0].id), 'tank')).toBe(1);
    const b = CATALOG.find((x) => x.id === 'basin-std')!;
    expect(countNamed(buildProduct(b, b.variants[0].id), 'tap')).toBe(1);
    const s = CATALOG.find((x) => x.id === 'shower-90')!;
    expect(countNamed(buildProduct(s, s.variants[0].id), 'glass')).toBe(2);
  });

  it('욕실 분류가 카탈로그 순서에 있다', () => {
    expect(CATEGORY_ORDER.indexOf('bath')).toBeGreaterThan(CATEGORY_ORDER.indexOf('furniture'));
    expect(CATEGORY_LABEL.bath).toBe('욕실');
  });
```

Import `CATEGORY_LABEL, CATEGORY_ORDER` from `../products` at the top.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/catalog/builders/builders.test.ts`
Expected: FAIL (products missing).

- [ ] **Step 3: parts helpers**

Append to `src/catalog/builders/parts.ts`:

```ts
// 세로(y축) 원기둥, 중심 (x,y,z)
export function cylinder(r: number, h: number, c: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 24), material(c));
  mesh.position.set(x, y, z);
  return mesh;
}

// 반투명 유리(공유 재질, 해제하지 않음)
const glassMaterial = new THREE.MeshStandardMaterial({ color: '#cfe3ea', transparent: true, opacity: 0.35, roughness: 0.1, metalness: 0 });
export function glass(w: number, h: number, d: number, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), glassMaterial);
  mesh.position.set(x, y, z);
  mesh.name = 'glass';
  return mesh;
}
```

- [ ] **Step 4: Builders**

`src/catalog/builders/chair.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const SEAT_T = 0.04;
const LEG = 0.035;
const BACK_T = 0.03;

export function buildChair(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const wood = color(v.colors, 'wood', '#b08a62');
  const seatH = Math.min(0.45, H * 0.52);
  const legs = ([[-1, -1], [1, -1], [-1, 1], [1, 1]] as const).map(([sx, sz]) => {
    const m = box(LEG, seatH - SEAT_T, LEG, wood, sx * (W / 2 - LEG / 2), (seatH - SEAT_T) / 2, sz * (D / 2 - LEG / 2));
    m.name = 'leg';
    return m;
  });
  const back = box(W, H - seatH, BACK_T, wood, 0, seatH + (H - seatH) / 2, -D / 2 + BACK_T / 2);
  back.name = 'back';
  return group(...legs, box(W, SEAT_T, D, color(v.colors, 'seat', '#d8cfc0'), 0, seatH - SEAT_T / 2, 0), back);
}
```

`src/catalog/builders/wardrobe.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.018;
const GAP = 0.003;

// 옷장·붙박이장·신발장: 몸통 + 문짝(doors) + 손잡이(문짝마다, 이웃 문과 마주 보게)
export function buildWardrobe(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const doors = Math.max(1, Math.round(Number(p.builderParams?.doors ?? 2)));
  const handleC = color(v.colors, 'handle', '#8a8a8a');
  const dw = W / doors;
  const parts = [box(W, H, D - PANEL, color(v.colors, 'body', '#d9d3ca'), 0, H / 2, -PANEL / 2)];
  for (let i = 0; i < doors; i++) {
    const x = -W / 2 + dw * (i + 0.5);
    const door = box(dw - GAP, H - GAP, PANEL, color(v.colors, 'door', '#efe9df'), x, H / 2, D / 2 - PANEL / 2);
    door.name = 'door';
    const hx = x + (i % 2 === 0 ? dw / 2 - 0.04 : -dw / 2 + 0.04);
    const handle = box(0.012, Math.min(0.3, H * 0.2), PANEL / 2, handleC, hx, H / 2, D / 2 - PANEL / 4);
    handle.name = 'handle';
    parts.push(door, handle);
  }
  return group(...parts);
}
```

`src/catalog/builders/toilet.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, cylinder, group, meters } from './parts';

// 물탱크(뒤) + 변기 몸통 + 둥근 앞부분
export function buildToilet(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const c = color(v.colors, 'body', '#f7f7f5');
  const tankD = D * 0.25;
  const seatH = H * 0.55;
  const r = W / 2;
  const tank = box(W, H, tankD, c, 0, H / 2, -D / 2 + tankD / 2);
  tank.name = 'tank';
  const bodyLen = D - tankD - r;
  const bodyZ = -D / 2 + tankD + bodyLen / 2;
  return group(
    tank,
    box(W * 0.6, seatH - 0.02, bodyLen, c, 0, (seatH - 0.02) / 2, bodyZ),
    box(W, 0.02, bodyLen, c, 0, seatH - 0.01, bodyZ),
    cylinder(r, seatH, c, 0, seatH / 2, D / 2 - r),
  );
}
```

`src/catalog/builders/basin.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, cylinder, group, meters } from './parts';

const BOWL_H = 0.15;
const TAP_H = 0.02;

// 세면볼 + 받침(기둥 또는 하부장) + 수전
export function buildBasin(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const c = color(v.colors, 'body', '#f7f7f5');
  const supportH = H - BOWL_H - TAP_H;
  const support = p.builderParams?.cabinet === true
    ? box(W - 0.02, supportH, D - 0.05, color(v.colors, 'cabinet', '#d9d3ca'), 0, supportH / 2, -0.025)
    : cylinder(Math.min(W, D) * 0.12, supportH, c, 0, supportH / 2, -D * 0.1);
  const bowl = box(W, BOWL_H, D, c, 0, supportH + BOWL_H / 2, 0);
  const tap = cylinder(0.012, TAP_H, color(v.colors, 'tap', '#b9bcc0'), 0, H - TAP_H / 2, -D / 2 + 0.04);
  tap.name = 'tap';
  return group(support, bowl, tap);
}
```

`src/catalog/builders/shower.ts`:

```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, glass, group, meters } from './parts';

const TRAY = 0.05;
const GLASS = 0.008;
const FRAME = 0.02;

// 바닥 트레이 + 유리 2면(앞 +z, 오른쪽 +x) + 상단 프레임. 뒤·왼쪽은 벽에 붙인다
export function buildShower(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const frameC = color(v.colors, 'frame', '#8a8a8a');
  return group(
    box(W, TRAY, D, color(v.colors, 'tray', '#e8e8e6'), 0, TRAY / 2, 0),
    glass(W, H - TRAY - FRAME, GLASS, 0, TRAY + (H - TRAY - FRAME) / 2, D / 2 - GLASS / 2),
    glass(GLASS, H - TRAY - FRAME, D, W / 2 - GLASS / 2, TRAY + (H - TRAY - FRAME) / 2, 0),
    box(W, FRAME, FRAME, frameC, 0, H - FRAME / 2, D / 2 - FRAME / 2),
    box(FRAME, FRAME, D, frameC, W / 2 - FRAME / 2, H - FRAME / 2, 0),
  );
}
```

Register all five in `index.ts` (`chair: buildChair, wardrobe: buildWardrobe, toilet: buildToilet, basin: buildBasin, shower: buildShower`). After this, every `BuilderId` has a builder; `BUILDERS` can become `Record<BuilderId, Builder>` (drop `Partial`) while keeping the `?? buildBox` fallback for ids from old custom products.

- [ ] **Step 5: Products**

Append to `CATALOG`:

```ts
  {
    id: 'wardrobe-builtin-240',
    brand: '일반',
    model: '',
    name: '붙박이장 240',
    category: 'furniture',
    dims: { w: 240, d: 60, h: 230 },
    variants: [
      { id: 'white', label: '화이트', colors: { body: '#d9d3ca', door: '#efe9df' } },
      { id: 'oak', label: '오크', colors: { body: '#b08a62', door: '#c9a06c' } },
    ],
    builder: 'wardrobe',
    builderParams: { doors: 4 },
    clearances: [{ kind: 'front', depth: 60 }],
    builtIn: true,
    mount: 'floor',
  },
  {
    id: 'wardrobe-120',
    brand: '일반',
    model: '',
    name: '옷장 120',
    category: 'furniture',
    dims: { w: 120, d: 60, h: 200 },
    variants: [{ id: 'oak', label: '오크', colors: { body: '#b08a62', door: '#c9a06c' } }],
    builder: 'wardrobe',
    builderParams: { doors: 2 },
    clearances: [
      { kind: 'swing', hinge: 'left', radius: 60 },
      { kind: 'swing', hinge: 'right', radius: 60 },
    ],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'shoe-cabinet-120',
    brand: '일반',
    model: '',
    name: '신발장 120',
    category: 'furniture',
    dims: { w: 120, d: 40, h: 180 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#d9d3ca', door: '#efe9df' } }],
    builder: 'wardrobe',
    builderParams: { doors: 2 },
    clearances: [{ kind: 'front', depth: 40 }],
    builtIn: true,
    mount: 'floor',
  },
  {
    id: 'desk-140',
    brand: '일반',
    model: '',
    name: '책상 140',
    category: 'furniture',
    dims: { w: 140, d: 70, h: 73 },
    variants: [{ id: 'oak', label: '오크', colors: { wood: '#b08a62' } }],
    builder: 'table',
    clearances: [{ kind: 'front', depth: 60 }],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'chair-dining',
    brand: '일반',
    model: '',
    name: '의자',
    category: 'furniture',
    dims: { w: 45, d: 50, h: 85 },
    variants: [{ id: 'oak', label: '오크', colors: { wood: '#b08a62', seat: '#d8cfc0' } }],
    builder: 'chair',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'tv-stand-180',
    brand: '일반',
    model: '',
    name: 'TV장 180',
    category: 'furniture',
    dims: { w: 180, d: 40, h: 45 },
    variants: [{ id: 'walnut', label: '월넛', colors: { body: '#7a5230', door: '#8c6240' } }],
    builder: 'cabinet-run',
    builderParams: { part: 'base', doors: 3, counter: false },
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'bed-super-single',
    brand: '일반',
    model: '',
    name: '슈퍼싱글 침대',
    category: 'furniture',
    dims: { w: 110, d: 205, h: 100 },
    variants: [{ id: 'oak', label: '오크', colors: { frame: '#b08a62', mattress: '#f4f1ea' } }],
    builder: 'bed',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'toilet-std',
    brand: '일반',
    model: '',
    name: '양변기',
    category: 'bath',
    dims: { w: 38, d: 70, h: 78 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#f7f7f5' } }],
    builder: 'toilet',
    clearances: [{ kind: 'front', depth: 50 }],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'basin-std',
    brand: '일반',
    model: '',
    name: '세면대',
    category: 'bath',
    dims: { w: 55, d: 45, h: 85 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#f7f7f5', cabinet: '#d9d3ca' } }],
    builder: 'basin',
    builderParams: { cabinet: true },
    clearances: [{ kind: 'front', depth: 50 }],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'shower-90',
    brand: '일반',
    model: '',
    name: '샤워부스 90',
    category: 'bath',
    dims: { w: 90, d: 90, h: 200 },
    variants: [{ id: 'clear', label: '투명', colors: { tray: '#e8e8e6', frame: '#8a8a8a' } }],
    builder: 'shower',
    clearances: [{ kind: 'front', depth: 60 }],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'bathtub-150',
    brand: '일반',
    model: '',
    name: '욕조 150',
    category: 'bath',
    dims: { w: 150, d: 75, h: 55 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#f7f7f5' } }],
    builder: 'box',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
```

- [ ] **Step 6: Run tests**

Run: `npm run typecheck && npm test`
Expected: PASS. The 2D colour helper `itemColor` picks `panel/body/fabric/frame/wood`; bath/shower products have `tray`/`body` so they get a colour — fine.

- [ ] **Step 7: Commit**

```bash
git add src/catalog/builders/parts.ts src/catalog/builders/chair.ts src/catalog/builders/wardrobe.ts src/catalog/builders/toilet.ts src/catalog/builders/basin.ts src/catalog/builders/shower.ts src/catalog/builders/index.ts src/catalog/builders/builders.test.ts src/catalog/products.ts
git commit -m "feat: furniture and bath builders with 11 generic products (spec §20.3)"
```

---

### Task 5: Elevation in store, 3D, 2D and properties panel; catalog filter

**Files:**
- Modify: `src/model/store.ts` (`normalizeItem`), `src/model/store.test.ts`
- Modify: `src/scene3d/Items3D.tsx` (group y)
- Modify: `src/editor2d/Items2D.tsx` (dashed class), `src/styles.css`
- Modify: `src/ui/properties/ItemProperties.tsx` (설치 높이 + 기본값)
- Modify: `src/ui/CatalogPanel.tsx` (filter input), create `src/ui/catalogFilter.ts`, `src/ui/catalogFilter.test.ts`

**Interfaces:**
- Consumes: `ceilingHeightCm`, `itemElevationCm` (Task 1).
- Produces: `updateItem(id, { elevation })` stores `Math.max(0, Math.round(v))`; `updateItem(id, { elevation: undefined })` removes the key. `filterCatalog(products: Product[], query: string): Product[]` (case-insensitive substring on `name` and `model`, trimmed; empty query returns all).
- 2D polygon class `item2d-elevated` (elevation > 0) and `item2d-ceiling` (mount ceiling); `data-elevation` attribute with the effective height for e2e.

- [ ] **Step 1: Write the failing tests**

In `src/model/store.test.ts` add (use the file's existing store factory and a product the sample plan resolves — `sofa-3seat`):

```ts
  it('updateItem elevation은 0 이상 정수로 저장하고 undefined면 키를 지운다 (한 번의 실행 취소 단위)', () => {
    const s = store.getState();
    const id = s.addItem('sofa-3seat', 'gray', { x: 100, y: 100 });
    s.updateItem(id, { elevation: 87.6 });
    expect(activeItems(store.getState().plan).find((i) => i.id === id)!.elevation).toBe(88);
    s.updateItem(id, { elevation: -5 });
    expect(activeItems(store.getState().plan).find((i) => i.id === id)!.elevation).toBe(0);
    s.updateItem(id, { elevation: undefined });
    expect('elevation' in activeItems(store.getState().plan).find((i) => i.id === id)!).toBe(false);
    s.undo();
    expect(activeItems(store.getState().plan).find((i) => i.id === id)!.elevation).toBe(0);
  });
```

Create `src/ui/catalogFilter.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/products';
import { filterCatalog } from './catalogFilter';

describe('filterCatalog', () => {
  it('빈 문자열이면 전부', () => {
    expect(filterCatalog(CATALOG, '  ')).toHaveLength(CATALOG.length);
  });
  it('이름·모델명 부분 일치, 대소문자 무시', () => {
    expect(filterCatalog(CATALOG, '에어컨').map((p) => p.id)).toEqual(['samsung-stand-ac-sample', 'samsung-wall-ac-sample', 'samsung-ceiling-ac-sample']);
    expect(filterCatalog(CATALOG, 'tv').length).toBeGreaterThan(0);
    expect(filterCatalog(CATALOG, '없는제품')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/model/store.test.ts src/ui/catalogFilter.test.ts`
Expected: FAIL (elevation kept as 87.6 / `./catalogFilter` missing).

- [ ] **Step 3: Store**

In `src/model/store.ts`:

```ts
function normalizeItem(item: Item): Item {
  const next: Item = { ...item, x: Math.round(item.x), y: Math.round(item.y), rotation: normalizeDeg(item.rotation) };
  if (item.elevation === undefined) delete next.elevation;
  else next.elevation = Math.max(0, Math.round(item.elevation));
  return next;
}
```

- [ ] **Step 4: 3D and 2D**

`src/scene3d/Items3D.tsx`: replace `mountHeightCm` import with `import { ceilingHeightCm, itemElevationCm } from '../catalog/elevation';`, and in `ItemMesh` compute

```ts
  const ceiling = usePlan((s) => ceilingHeightCm(s.plan));
  const y = product ? cmToM(itemElevationCm(item, product, ceiling)) : 0;
```

(`usePlan` selector returns a number, so no re-render churn.)

`src/editor2d/Items2D.tsx`: import `ceilingHeightCm, itemElevationCm`; compute `const ceiling = ceilingHeightCm(plan);` once above the map; inside the map

```ts
        const elevation = product ? itemElevationCm(item, product, ceiling) : 0;
```

add to `cls`: `elevation > 0 ? 'item2d-elevated' : ''`, `product?.mount === 'ceiling' ? 'item2d-ceiling' : ''`, and on the `<polygon>` add `data-elevation={elevation}`.

`src/styles.css` after `.item2d-danger`:

```css
.item2d-elevated { stroke-dasharray: 5 3; }
.item2d-ceiling { fill-opacity: 0.5; }
```

- [ ] **Step 5: Properties panel**

In `src/ui/properties/ItemProperties.tsx` import `ceilingHeightCm, itemElevationCm` from `../../catalog/elevation` and after the 회전 field:

```tsx
      {product && (
        <div className="row">
          <NumberField
            key={`${item.id}-e`}
            label="설치 높이"
            unit="cm"
            value={itemElevationCm(item, product, ceilingHeightCm(plan))}
            disabled={locked}
            onCommit={(v) => s.updateItem(item.id, { elevation: Math.max(0, v) })}
          />
          {item.elevation !== undefined && (
            <button type="button" disabled={locked} onClick={() => s.updateItem(item.id, { elevation: undefined })}>기본값</button>
          )}
        </div>
      )}
```

Add a muted hint under it: `<p className="muted">바닥에서 밑면까지. 벽걸이·상부장·천장형은 제품 기본값에서 시작합니다.</p>`.

- [ ] **Step 6: Catalog filter**

Create `src/ui/catalogFilter.ts`:

```ts
import type { Product } from '../model/schema';

export function filterCatalog(products: Product[], query: string): Product[] {
  const q = query.trim().toLowerCase();
  if (!q) return products;
  return products.filter((p) => p.name.toLowerCase().includes(q) || p.model.toLowerCase().includes(q));
}
```

In `src/ui/CatalogPanel.tsx`: add `const [query, setQuery] = useState('');`, build `groups` from `filterCatalog([...CATALOG, ...custom], query)` (dependency `[custom, query]`), and render above the groups:

```tsx
      <label className="field">
        제품 찾기
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="이름·모델명" aria-label="제품 찾기" />
      </label>
      {groups.length === 0 && <p className="muted">일치하는 제품이 없습니다.</p>}
```

- [ ] **Step 7: Run tests**

Run: `npm run typecheck && npm test`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/model/store.ts src/model/store.test.ts src/scene3d/Items3D.tsx src/editor2d/Items2D.tsx src/styles.css src/ui/properties/ItemProperties.tsx src/ui/CatalogPanel.tsx src/ui/catalogFilter.ts src/ui/catalogFilter.test.ts
git commit -m "feat: item elevation in 3D/2D and properties panel, catalog name filter (spec §20.4)"
```

---

### Task 6: Elevation in PDF product list, built-in detail and checklist

**Files:**
- Modify: `src/export/pages.ts`, `src/export/pages.test.ts`
- Modify: `src/checklist/items.ts`, `src/checklist/items.test.ts`

**Interfaces:**
- Consumes: `ceilingHeightCm`, `itemElevationCm`.
- Produces: 제품 목록 columns `['번호', '모델명', '이름', 'W×D×H (cm)', '설치 높이', '소비전력', '전용회로']` widths `15/60/50/42/30/30/40`; 빌트인 상세 「벽 기준 위치」 cell gets `, 바닥에서 Ncm` appended when N > 0; auto checklist 빌트인 text gets the same suffix.

- [ ] **Step 1: Write the failing tests**

In `src/export/pages.test.ts` change the 제품 목록 test expectation to the new columns and rows:

```ts
    expect(products.columns.map((c) => c.label)).toEqual(['번호', '모델명', '이름', 'W×D×H (cm)', '설치 높이', '소비전력', '전용회로']);
    expect(products.rows.map((r) => r.map((c) => c.join(' ')))).toEqual([
      ['1', '-', '3인 소파', '≈210×90×80', '-', '-', '-'],
      ['2', '그랑데 세탁기 (샘플 치수)', '그랑데 드럼세탁기', '≈70×85×110', '-', '2000W', '필요 (콘센트 없음)'],
    ]);
```

Add:

```ts
  it('제품 목록·빌트인 상세에 설치 높이가 들어간다', () => {
    const upper: Product = {
      id: 'c-upper', brand: 'custom', model: '', name: '상부장', category: 'kitchen',
      dims: { w: 240, d: 35, h: 70 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'cabinet-run', clearances: [], builtIn: true, mount: 'wall', elevation: 145,
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [
        { id: 'u', productId: 'c-upper', variantId: 'v', x: 150, y: 40, rotation: 0 },
        { id: 'u2', productId: 'c-upper', variantId: 'v', x: 150, y: 300, rotation: 0, elevation: 160 },
      ]),
      customProducts: [upper],
    };
    const doc = buildPdf(plan, input);
    const products = doc.pages.find((p) => p.title.startsWith('제품 목록')) as TablePage;
    expect(products.rows.map((r) => r[4].join(' '))).toEqual(['145cm', '160cm']);
    const builtIn = doc.pages.find((p) => p.title === '빌트인 상세') as TablePage;
    expect(builtIn.rows[0][3].join(' ')).toMatch(/, 바닥에서 145cm$/);
    expect(builtIn.rows[1][3].join(' ')).toMatch(/, 바닥에서 160cm$/);
  });
```

In `src/checklist/items.test.ts` add a case with the same custom `upper` product placed once: the `auto-builtin-<id>` text ends with `, 바닥에서 145cm`. Follow the file's existing plan/resolve helpers.

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run src/export/pages.test.ts src/checklist/items.test.ts`
Expected: FAIL (6 columns, no suffix).

- [ ] **Step 3: Implement**

`src/export/pages.ts`: import `ceilingHeightCm, itemElevationCm` from `../catalog/elevation`. In `buildPdf` after `sizeText`:

```ts
  const ceiling = ceilingHeightCm(plan);
  const elevationCm = (item: Item, product: Product) => itemElevationCm(item, product, ceiling);
  const elevationSuffix = (item: Item, product: Product) => {
    const e = elevationCm(item, product);
    return e > 0 ? `, 바닥에서 ${e}cm` : '';
  };
```

빌트인 상세 row: `wallReferenceText(plan, item, product) + elevationSuffix(item, product)`.

제품 목록 columns:

```ts
        { label: '번호', width: 15 },
        { label: '모델명', width: 60 },
        { label: '이름', width: 50 },
        { label: 'W×D×H (cm)', width: 42 },
        { label: '설치 높이', width: 30 },
        { label: '소비전력', width: 30 },
        { label: '전용회로', width: 40 },
```

and row cell after `sizeText(item, product)`: `elevationCm(item, product) > 0 ? `${elevationCm(item, product)}cm` : '-'`.

`src/checklist/items.ts`: same imports; compute `const ceiling = ceilingHeightCm(plan);` at the top of `autoChecklist`; in the 빌트인 loop append to `text`: `` + (e > 0 ? `, 바닥에서 ${e}cm` : '') `` where `const e = itemElevationCm(item, product, ceiling);`.

- [ ] **Step 4: Run tests**

Run: `npm run typecheck && npm test`
Expected: PASS (`e2e/pdf.spec.ts` page-count lower bound is unaffected; the PDF renderer reads column widths from page data).

- [ ] **Step 5: Commit**

```bash
git add src/export/pages.ts src/export/pages.test.ts src/checklist/items.ts src/checklist/items.test.ts
git commit -m "feat: installation height in PDF product list, built-in detail and checklist (spec §20.4)"
```

---

### Task 7: e2e, module map

**Files:**
- Create: `e2e/elevation.spec.ts`
- Modify: `src/MODULE-MAP.md` (`catalog/`, `geometry/`, `validation/`, `ui/` lines)

**Interfaces:**
- Consumes: product ids `samsung-upper-cabinet-240-sample`, `table-dining-4`; `data-elevation` on `item2d-<id>`; properties panel `설치 높이` field; `window.__homefit.store` (dev only, present under the e2e dev server).

- [ ] **Step 1: Write the e2e**

`e2e/elevation.spec.ts`:

```ts
import { expect, test, type Page } from '@playwright/test';

const items = (page: Page) =>
  page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.layouts.find((l) => l.id === p.activeLayoutId)!.items;
  });

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('상부장을 놓고 설치 높이를 바꾸면 2D 점선·충돌 제외·새로고침 유지가 동작한다', async ({ page }) => {
  await page.getByLabel('제품 찾기').fill('상부장');
  await page.getByTestId('catalog-card-samsung-upper-cabinet-240-sample').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await items(page)).length).toBe(1);
  const upper = (await items(page))[0];

  await page.getByRole('button', { name: '2D', exact: true }).click();
  const poly = page.getByTestId(`item2d-${upper.id}`);
  await expect(poly).toHaveAttribute('data-elevation', '145');
  await expect(poly).toHaveClass(/item2d-elevated/);

  const props = page.getByTestId('properties-panel');
  const field = props.getByLabel('설치 높이');
  await field.fill('160');
  await field.press('Enter');
  await expect(poly).toHaveAttribute('data-elevation', '160');

  await page.getByLabel('제품 찾기').fill('');
  await page.getByTestId('catalog-card-table-dining-4').getByRole('button', { name: '추가' }).click();
  await expect.poll(async () => (await items(page)).length).toBe(2);
  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    const [u, t] = s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items;
    s.updateItem(t.id, { x: u.x, y: u.y });
  });
  await expect(page.getByTestId('status-collides')).toHaveCount(0);

  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    s.select(s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items[0].id);
  });
  await props.getByRole('button', { name: '기본값' }).click();
  await expect(poly).toHaveAttribute('data-elevation', '145');
  await page.keyboard.press('Meta+z');
  await expect(poly).toHaveAttribute('data-elevation', '160');

  await page.waitForTimeout(800);
  await page.reload();
  await expect(page.getByTestId(`item2d-${upper.id}`)).toHaveAttribute('data-elevation', '160');
});
```

If the `2D` toggle button has a different accessible name, read `src/ui/Toolbar.tsx` and use it; if the undo shortcut on the Playwright platform is `Control+z` (see `e2e/editor2d.spec.ts` for the convention used), follow that file. If `getByLabel('설치 높이')` does not resolve because `NumberField` wraps the input in a `<label>` with extra text, use `props.locator('label', { hasText: '설치 높이' }).locator('input')`.

- [ ] **Step 2: Run the e2e**

Check `lsof -i :5180` is free first. Run: `npx playwright test e2e/elevation.spec.ts`
Expected: PASS. Then the full suite: `npm run e2e` — all green.

- [ ] **Step 3: Module map**

In `src/MODULE-MAP.md`:
- `catalog/`: add `` `elevation.ts` — effective installation height (item → product → legacy mountHeight → mount rule), ceiling height = max wall height (230 default). `` and extend the builders line to list `standAc`, `builtInAppliance`, `cabinetRun`, `ceilingAc`, `chair`, `wardrobe`, `toilet`, `basin`, `shower`; remove "Missing builders" note; mention `parts.ts` `cylinder`/`glass`.
- `geometry/`: add `` `vertical.ts` — vertical span overlap (touching ≠ overlap). ``
- `validation/`: note that every obstacle (wall, item, door swing) is filtered by vertical span (spec §20.2).
- `ui/`: add `catalogFilter.ts` (name/model substring filter) and the 설치 높이 field in `ItemProperties`.

- [ ] **Step 4: Commit**

```bash
git add e2e/elevation.spec.ts src/MODULE-MAP.md
git commit -m "test: e2e for item elevation; module map for catalog, vertical spans and filter"
```

---

## Self-review notes

- Spec coverage: §20.1 → Task 1; §20.2 → Task 2; §20.3 builders 9 + products 23 → Tasks 3–4 (12 + 11); §20.4 panel/2D/3D/filter → Task 5, PDF/checklist → Task 6; §20.5 tests → each task + Task 7 e2e; §20.6 out of scope untouched.
- Names used across tasks: `itemElevationCm`, `ceilingHeightCm`, `productElevationCm` (Task 1) consumed in 2, 5, 6; `spansOverlap`/`itemSpan` (Task 2); product ids in Task 3/4 referenced by tests in 3/4/5/7; `data-elevation`, `item2d-elevated`, `제품 찾기`, `설치 높이`, `기본값` (Task 5) used by Task 7.
- After merge the main session runs exploratory QA (every new product in 3D, stacked dryer, ceiling AC, PDF column) and syncs `HANDOFF.md`, `CLAUDE.md` Work in progress, `docs/README.md`.
