# Room Areas, Floor/Wall Finishes and Wood-Tone UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user draw each room's floor area in 2D, pick a floor and wall finish per room (preset + free color), see it in 2D patterns and 3D procedural textures, and restyle the whole UI chrome in a wood-tone theme.

**Architecture:** `Room` gets optional `polygon`/`floor`/`wall`; `Plan.finish` holds defaults (schema v4, no-op migration). Pure helpers live in `geometry/polygon.ts` and a new React-free `src/materials/` folder (presets, plank/tile layout, wall-face→room assignment). The 2D editor gets an `area` tool (click vertices, close on first point/Enter) rendered by `Rooms2D` with SVG patterns; 3D renders per-room `ShapeGeometry` floors with canvas textures and 6-material wall boxes. `styles.css` is rebuilt on design tokens.

**Tech Stack:** TypeScript, React 19, zustand, zod, react-three-fiber + three (`CanvasTexture`, `ShapeGeometry`), SVG `<pattern>`, Vitest, Playwright.

**Spec:** `docs/superpowers/specs/2026-10-08-homefit-design.md` §19 (also §5 schema rules, §14.4 migration rules).

## Global Constraints

- Integer **cm** in the plan; 3D is 1 unit = 1 m via `cmToM` (`src/model/units.ts`) / `toWorld` (`src/scene3d/units.ts`) only.
- Schema change → `CURRENT_VERSION` 3→4, migration step with test (`migrating-plan-schema` skill). Optional-only fields: `(raw) => ({ ...raw, version: 4 })`.
- `geometry/`, `materials/` (new), `validation/`, `persistence/` stay React-free with colocated `*.test.ts`. `materials/textures.ts` may import `three` but no React.
- Store edits only through `model/store.ts` actions (one undo step per user action; drags use `beginDrag`/`endDrag`). Screen-only state in `ui/uiStore.ts`.
- No new dependency. UI copy Korean; icon buttons need `aria-label`.
- Never edit expected values or skip tests to get green. Never use a direct store call in e2e in place of the real user action.
- Colors in `styles.css` only via tokens from §19.4; no new hex literals outside `:root`. 2D selection accent stays blue (`--accent`).
- Run from the worktree `~/Projects/homefit-room-finish` on branch `feat/room-finish`. Commit each task with Conventional Commits and the attribution line `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

## Review Focus

1. Polygon with <3 points or with repeated/collinear points — must never be saved; area tool refuses to close, store action rejects. (Task 3, Task 4 tests)
2. Concave (L-shaped) polygon — `pointInPolygon`, `polygonArea`, `centroid`, 3D `ShapeGeometry` and wall-face assignment must all be correct for concave shapes, not just rectangles. (Task 2, Task 8 tests)
3. Wall face whose probe point lies in **two** overlapping room polygons or in none — must pick deterministically (first room in plan order) or fall back to `plan.finish.wall`, never crash. (Task 8 test)
4. Old saved plan (v3, no `finish`, rooms without `polygon`) — loads, renders exactly as before (label only, default oak floor, white walls). (Task 1, Task 5 tests)
5. Color input with invalid text (e.g. `red`, `#abc`) — schema must reject on load, UI uses `<input type="color">` so it can only emit `#rrggbb`; store action normalizes to lowercase. (Task 1, Task 3 tests)

---

### Task 1: Schema v4 — room polygon, finishes, plan defaults, presets

**Files:**
- Modify: `src/model/schema.ts`
- Modify: `src/persistence/parse.ts`, `src/persistence/parse.test.ts`
- Create: `src/materials/presets.ts`, `src/materials/presets.test.ts`
- Modify: `src/model/samplePlan.ts` (`version: 4`), any `*.test.ts` fixture with `version: 3` (`grep -rn "version: 3" src e2e`), `src/persistence/homePreset.test.ts` if it builds a literal.

**Interfaces:**
- Produces: `FinishSchema`, `FloorMaterialSchema = z.enum(['wood','tile','plain'])`, `WallMaterialSchema = z.enum(['paint','wallpaper'])`, types `Finish`, `FloorMaterial`, `WallMaterial`, `PlanFinish = { floor: Finish; wall: Finish }`; `Room.polygon?: Vec2[]`, `Room.floor?: Finish`, `Room.wall?: Finish`; `Plan.finish?: PlanFinish`.
- Produces: `src/materials/presets.ts`: `FLOOR_PRESETS: readonly { id: string; label: string; finish: Finish }[]`, `WALL_PRESETS` (same shape), `DEFAULT_FINISH: PlanFinish`, `planFinish(plan: Pick<Plan,'finish'>): PlanFinish`, `roomFloor(room: Room, plan): Finish`, `roomWall(room: Room, plan): Finish`.

- [ ] **Step 1: Write failing schema tests** in `src/persistence/parse.test.ts` (append inside `describe('parsePlan')`):

```ts
  it('v3 파일은 v4로 올라가고 마감 필드 없이도 통과한다', () => {
    const r = parsePlan({ ...JSON.parse(JSON.stringify(SAMPLE_PLAN)), version: 3 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.plan.version).toBe(4);
  });

  it('방 영역·마감과 기본 마감을 받는다', () => {
    const raw = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw.rooms[0] = { ...raw.rooms[0], polygon: [{ x: 10, y: 10 }, { x: 340, y: 10 }, { x: 340, y: 390 }, { x: 10, y: 390 }], floor: { material: 'wood', color: '#c9a06c' }, wall: { material: 'paint', color: '#f4f1ec' } };
    raw.finish = { floor: { material: 'tile', color: '#b8b5ae' }, wall: { material: 'wallpaper', color: '#e8dcc8' } };
    const r = parsePlan(raw);
    expect(r.ok).toBe(true);
  });

  it('영역은 3점 이상, 색은 #rrggbb만 받는다', () => {
    const raw = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw.rooms[0] = { ...raw.rooms[0], polygon: [{ x: 0, y: 0 }, { x: 1, y: 1 }] };
    expect(parsePlan(raw).ok).toBe(false);
    const raw2 = JSON.parse(JSON.stringify(SAMPLE_PLAN));
    raw2.rooms[0] = { ...raw2.rooms[0], floor: { material: 'wood', color: 'red' } };
    expect(parsePlan(raw2).ok).toBe(false);
  });
```

Also update the existing test `'parsePlan은 버전이 다르면 실패한다'` to use `version: 5` and error text `'지원하지 않는 파일 버전입니다: 5'`, and in `describe('migrate')` change `{ version: 3, a: 1 }` to `{ version: 4, a: 1 }`.

- [ ] **Step 2: Run** `npx vitest run src/persistence/parse.test.ts` — expect FAIL (version literal 3).

- [ ] **Step 3: Implement schema** in `src/model/schema.ts`. Replace `RoomSchema` and add finish schemas; add `finish` to `PlanSchema`; bump literal to 4:

```ts
export const FloorMaterialSchema = z.enum(['wood', 'tile', 'plain']);
export const WallMaterialSchema = z.enum(['paint', 'wallpaper']);
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, '#rrggbb 형식이어야 합니다');
export const FinishSchema = z.object({ material: z.union([FloorMaterialSchema, WallMaterialSchema]), color: hexColor });
export const FloorFinishSchema = z.object({ material: FloorMaterialSchema, color: hexColor });
export const WallFinishSchema = z.object({ material: WallMaterialSchema, color: hexColor });
export const PlanFinishSchema = z.object({ floor: FloorFinishSchema, wall: WallFinishSchema });

export const RoomSchema = z.object({
  id,
  name: z.string(),
  label: Vec2Schema,
  polygon: z.array(Vec2Schema).min(3).optional(), // 바닥 영역(마감면 기준 꼭짓점, cm)
  floor: FloorFinishSchema.optional(),
  wall: WallFinishSchema.optional(),
});
```

In `PlanSchema`: `version: z.literal(4)`, add `finish: PlanFinishSchema.optional()` after `rooms`. Add types:

```ts
export type FloorMaterial = z.infer<typeof FloorMaterialSchema>;
export type WallMaterial = z.infer<typeof WallMaterialSchema>;
export type FloorFinish = z.infer<typeof FloorFinishSchema>;
export type WallFinish = z.infer<typeof WallFinishSchema>;
export type Finish = FloorFinish | WallFinish;
export type PlanFinish = z.infer<typeof PlanFinishSchema>;
```

(Drop the generic `FinishSchema` if unused after typecheck.)

- [ ] **Step 4: Migration** in `src/persistence/parse.ts`: `CURRENT_VERSION = 4`; add

```ts
  // v4: 방 영역(polygon)·바닥/벽 마감, 평면 기본 마감 추가. 모두 선택이라 버전만 올린다
  3: (raw) => ({ ...raw, version: 4 }),
```

- [ ] **Step 5: Fix fixtures.** `src/model/samplePlan.ts` → `version: 4`. `grep -rn "version: 3" src e2e` and update each Plan literal. Run `npm run typecheck`.

- [ ] **Step 6: Presets test** `src/materials/presets.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { DEFAULT_FINISH, FLOOR_PRESETS, WALL_PRESETS, planFinish, roomFloor, roomWall } from './presets';

describe('presets', () => {
  it('프리셋 id는 겹치지 않고 색은 #rrggbb', () => {
    for (const list of [FLOOR_PRESETS, WALL_PRESETS]) {
      expect(new Set(list.map((p) => p.id)).size).toBe(list.length);
      for (const p of list) expect(p.finish.color).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it('기본 마감은 평면 finish가 없으면 DEFAULT_FINISH', () => {
    expect(planFinish(SAMPLE_PLAN)).toEqual(DEFAULT_FINISH);
    const custom = { floor: { material: 'tile' as const, color: '#b8b5ae' }, wall: { material: 'paint' as const, color: '#ffffff' } };
    expect(planFinish({ finish: custom })).toEqual(custom);
  });
  it('방 마감이 없으면 평면 기본값을 쓴다', () => {
    const room = SAMPLE_PLAN.rooms[0];
    expect(roomFloor(room, SAMPLE_PLAN)).toEqual(DEFAULT_FINISH.floor);
    expect(roomWall({ ...room, wall: { material: 'paint', color: '#c7cfbf' } }, SAMPLE_PLAN)).toEqual({ material: 'paint', color: '#c7cfbf' });
  });
});
```

- [ ] **Step 7: Implement** `src/materials/presets.ts`:

```ts
import type { FloorFinish, Plan, PlanFinish, Room, WallFinish } from '../model/schema';

export type FloorPreset = { id: string; label: string; finish: FloorFinish };
export type WallPreset = { id: string; label: string; finish: WallFinish };

export const FLOOR_PRESETS: readonly FloorPreset[] = [
  { id: 'oak-natural', label: '내추럴 오크', finish: { material: 'wood', color: '#c9a06c' } },
  { id: 'oak-white', label: '화이트 오크', finish: { material: 'wood', color: '#e2d3b6' } },
  { id: 'walnut', label: '월넛', finish: { material: 'wood', color: '#7a5230' } },
  { id: 'porcelain-grey', label: '그레이 포세린', finish: { material: 'tile', color: '#b8b5ae' } },
  { id: 'mosaic-white', label: '화이트 모자이크', finish: { material: 'tile', color: '#ececea' } },
];

export const WALL_PRESETS: readonly WallPreset[] = [
  { id: 'white', label: '화이트', finish: { material: 'paint', color: '#f4f1ec' } },
  { id: 'warm-grey', label: '웜 그레이', finish: { material: 'paint', color: '#d9d3ca' } },
  { id: 'beige', label: '베이지', finish: { material: 'wallpaper', color: '#e8dcc8' } },
  { id: 'sage', label: '세이지', finish: { material: 'wallpaper', color: '#c7cfbf' } },
];

export const DEFAULT_FINISH: PlanFinish = { floor: FLOOR_PRESETS[0].finish, wall: WALL_PRESETS[0].finish };

export function planFinish(plan: Pick<Plan, 'finish'>): PlanFinish {
  return plan.finish ?? DEFAULT_FINISH;
}
export function roomFloor(room: Room, plan: Pick<Plan, 'finish'>): FloorFinish {
  return room.floor ?? planFinish(plan).floor;
}
export function roomWall(room: Room, plan: Pick<Plan, 'finish'>): WallFinish {
  return room.wall ?? planFinish(plan).wall;
}
```

- [ ] **Step 8: Run** `npm run typecheck && npm test` — expect all green.

- [ ] **Step 9: Docs + commit.** Add to `src/MODULE-MAP.md` a `materials/` section line: `- presets.ts — floor/wall finish presets, DEFAULT_FINISH, roomFloor/roomWall fallbacks (spec §19.1).` and update the `schema.ts` line to say version 4 + room polygon/finishes. Note in `HANDOFF.md` 「다음 할 일」 that `private/make-our-home.mjs` must emit `version: 4` (user reruns).

```bash
git add src/model/schema.ts src/persistence/parse.ts src/persistence/parse.test.ts src/materials/presets.ts src/materials/presets.test.ts src/model/samplePlan.ts src/MODULE-MAP.md HANDOFF.md
git commit -m "feat: schema v4 with room polygon, floor/wall finishes and presets (spec §19.1)"
```

---

### Task 2: `geometry/polygon.ts` — area, centroid, point-in-polygon, closing

**Files:**
- Create: `src/geometry/polygon.ts`, `src/geometry/polygon.test.ts`

**Interfaces:**
- Produces: `polygonArea(pts: Vec2[]): number` (cm², absolute), `polygonCentroid(pts: Vec2[]): Vec2` (rounded), `pointInPolygon(p: Vec2, pts: Vec2[]): boolean` (ray casting, boundary counts as inside), `isValidPolygon(pts: Vec2[]): boolean` (≥3 points, no two consecutive equal, area > 0), `closesPolygon(click: Vec2, first: Vec2, tolCm: number): boolean`, `areaM2(pts: Vec2[]): number` (1 decimal).

- [ ] **Step 1: Test** `src/geometry/polygon.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { areaM2, closesPolygon, isValidPolygon, pointInPolygon, polygonArea, polygonCentroid } from './polygon';

const rect = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 300 }, { x: 0, y: 300 }];
// L자: 400×300에서 오른쪽 아래 200×150을 뺀 모양
const L = [{ x: 0, y: 0 }, { x: 400, y: 0 }, { x: 400, y: 150 }, { x: 200, y: 150 }, { x: 200, y: 300 }, { x: 0, y: 300 }];

describe('polygon', () => {
  it('면적은 점 순서와 무관하게 양수', () => {
    expect(polygonArea(rect)).toBe(120000);
    expect(polygonArea([...rect].reverse())).toBe(120000);
    expect(polygonArea(L)).toBe(90000);
    expect(areaM2(L)).toBe(9);
    expect(areaM2([{ x: 0, y: 0 }, { x: 345, y: 0 }, { x: 345, y: 210 }, { x: 0, y: 210 }])).toBe(7.2);
  });
  it('무게중심', () => {
    expect(polygonCentroid(rect)).toEqual({ x: 200, y: 150 });
    const c = polygonCentroid(L);
    expect(c.x).toBeLessThan(200);
    expect(pointInPolygon(c, L)).toBe(true);
  });
  it('오목 다각형 내부 판정', () => {
    expect(pointInPolygon({ x: 100, y: 100 }, L)).toBe(true);
    expect(pointInPolygon({ x: 300, y: 250 }, L)).toBe(false);
    expect(pointInPolygon({ x: 0, y: 100 }, L)).toBe(true); // 경계
    expect(pointInPolygon({ x: -1, y: 100 }, L)).toBe(false);
  });
  it('유효성: 3점 미만·연속 중복·면적 0은 거부', () => {
    expect(isValidPolygon(rect)).toBe(true);
    expect(isValidPolygon(rect.slice(0, 2))).toBe(false);
    expect(isValidPolygon([{ x: 0, y: 0 }, { x: 0, y: 0 }, { x: 5, y: 5 }])).toBe(false);
    expect(isValidPolygon([{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 200, y: 0 }])).toBe(false);
  });
  it('첫 점 근처 클릭이면 닫는다', () => {
    expect(closesPolygon({ x: 10, y: 8 }, { x: 0, y: 0 }, 15)).toBe(true);
    expect(closesPolygon({ x: 20, y: 0 }, { x: 0, y: 0 }, 15)).toBe(false);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/geometry/polygon.test.ts` — FAIL (module missing).

- [ ] **Step 3: Implement** `src/geometry/polygon.ts`:

```ts
import type { Vec2 } from '../model/schema';

function signedArea2(pts: Vec2[]): number {
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    s += a.x * b.y - b.x * a.y;
  }
  return s;
}

export function polygonArea(pts: Vec2[]): number {
  return Math.abs(signedArea2(pts)) / 2;
}

export function areaM2(pts: Vec2[]): number {
  return Math.round(polygonArea(pts) / 10000 * 10) / 10;
}

export function polygonCentroid(pts: Vec2[]): Vec2 {
  const a2 = signedArea2(pts);
  if (a2 === 0) {
    const n = pts.length || 1;
    return { x: Math.round(pts.reduce((s, p) => s + p.x, 0) / n), y: Math.round(pts.reduce((s, p) => s + p.y, 0) / n) };
  }
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const f = a.x * b.y - b.x * a.y;
    cx += (a.x + b.x) * f;
    cy += (a.y + b.y) * f;
  }
  return { x: Math.round(cx / (3 * a2)), y: Math.round(cy / (3 * a2)) };
}

function onSegment(p: Vec2, a: Vec2, b: Vec2): boolean {
  const cross = (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  if (Math.abs(cross) > 1e-6) return false;
  return p.x >= Math.min(a.x, b.x) - 1e-6 && p.x <= Math.max(a.x, b.x) + 1e-6 && p.y >= Math.min(a.y, b.y) - 1e-6 && p.y <= Math.max(a.y, b.y) + 1e-6;
}

// 광선 교차법. 경계 위의 점은 내부로 본다
export function pointInPolygon(p: Vec2, pts: Vec2[]): boolean {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const a = pts[i];
    const b = pts[j];
    if (onSegment(p, a, b)) return true;
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

export function isValidPolygon(pts: Vec2[]): boolean {
  if (pts.length < 3) return false;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    if (a.x === b.x && a.y === b.y) return false;
  }
  return polygonArea(pts) > 0;
}

export function closesPolygon(click: Vec2, first: Vec2, tolCm: number): boolean {
  return Math.hypot(click.x - first.x, click.y - first.y) <= tolCm;
}
```

- [ ] **Step 4: Run** the test — PASS. **Step 5: Commit** (`src/MODULE-MAP.md` geometry line: `- polygon.ts — area/centroid/point-in-polygon/validity for room floor polygons.`):

```bash
git add src/geometry/polygon.ts src/geometry/polygon.test.ts src/MODULE-MAP.md
git commit -m "feat: polygon geometry helpers for room areas"
```

---

### Task 3: Store actions for room areas and finishes

**Files:**
- Modify: `src/model/store.ts` (interface + implementation next to `addRoom`/`updateRoom`), `src/model/store.test.ts` (append)

**Interfaces:**
- Produces on `PlanState`:
  - `addRoomArea(polygon: Vec2[], name?: string): string | null` — rounds points, rejects invalid (`isValidPolygon`), name default `방 ${rooms.length + 1}`, label = `polygonCentroid`, returns id, selects it.
  - `setRoomPolygon(id: string, polygon: Vec2[]): boolean` — rejects invalid; moves label to centroid **only if** the old label is outside the new polygon.
  - `setRoomFinish(id: string, patch: { floor?: FloorFinish; wall?: WallFinish }): void` — colors lowercased.
  - `setPlanFinish(patch: Partial<PlanFinish>): void` — merges over `planFinish(plan)`.
  - `dragRoomVertex(id: string, index: number, to: Vec2): void` — during `beginDrag`/`endDrag`, like `dragEndpoint`; ignores moves that make the polygon invalid.

- [ ] **Step 1: Tests** — append to `src/model/store.test.ts` (read the top of that file for how a store is created; reuse its helper, e.g. `createPlanStore(SAMPLE_PLAN)`):

```ts
describe('room areas and finishes', () => {
  const sq = [{ x: 10, y: 10 }, { x: 340, y: 10 }, { x: 340, y: 390 }, { x: 10, y: 390 }];

  it('addRoomArea는 방을 만들고 라벨을 무게중심에 둔다 (한 undo 단위)', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addRoomArea(sq.map((p) => ({ x: p.x + 0.4, y: p.y })));
    expect(id).not.toBeNull();
    const room = s.getState().plan.rooms.find((r) => r.id === id)!;
    expect(room.polygon![0]).toEqual({ x: 10, y: 10 });
    expect(room.label).toEqual({ x: 175, y: 200 });
    expect(room.name).toBe('방 3');
    expect(s.getState().selectedId).toBe(id);
    s.getState().undo();
    expect(s.getState().plan.rooms).toHaveLength(2);
  });

  it('addRoomArea는 잘못된 다각형을 거부한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    expect(s.getState().addRoomArea(sq.slice(0, 2))).toBeNull();
    expect(s.getState().past).toHaveLength(0);
  });

  it('setRoomPolygon은 라벨이 영역 밖일 때만 옮긴다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    expect(s.getState().setRoomPolygon('r1', sq)).toBe(true);
    expect(s.getState().plan.rooms[0].label).toEqual({ x: 175, y: 200 }); // 원래 라벨이 안에 있어 유지
    const far = [{ x: 1000, y: 1000 }, { x: 1100, y: 1000 }, { x: 1100, y: 1100 }, { x: 1000, y: 1100 }];
    s.getState().setRoomPolygon('r1', far);
    expect(s.getState().plan.rooms[0].label).toEqual({ x: 1050, y: 1050 });
    expect(s.getState().setRoomPolygon('r1', [{ x: 0, y: 0 }])).toBe(false);
  });

  it('setRoomFinish / setPlanFinish', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setRoomFinish('r1', { floor: { material: 'tile', color: '#B8B5AE' } });
    expect(s.getState().plan.rooms[0].floor).toEqual({ material: 'tile', color: '#b8b5ae' });
    expect(s.getState().plan.rooms[0].wall).toBeUndefined();
    s.getState().setPlanFinish({ wall: { material: 'wallpaper', color: '#c7cfbf' } });
    expect(s.getState().plan.finish).toEqual({ floor: DEFAULT_FINISH.floor, wall: { material: 'wallpaper', color: '#c7cfbf' } });
    expect(s.getState().past).toHaveLength(2);
  });

  it('dragRoomVertex는 드래그 한 번이 undo 한 단위', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setRoomPolygon('r1', sq);
    s.getState().beginDrag();
    s.getState().dragRoomVertex('r1', 1, { x: 300, y: 20 });
    s.getState().dragRoomVertex('r1', 1, { x: 320, y: 30 });
    s.getState().endDrag();
    expect(s.getState().plan.rooms[0].polygon![1]).toEqual({ x: 320, y: 30 });
    expect(s.getState().past).toHaveLength(2);
    s.getState().beginDrag();
    s.getState().dragRoomVertex('r1', 1, { x: 10, y: 10 }); // 첫 점과 겹침 → 무시
    s.getState().endDrag();
    expect(s.getState().plan.rooms[0].polygon![1]).toEqual({ x: 320, y: 30 });
  });
});
```

Add the needed imports at the top (`DEFAULT_FINISH` from `../materials/presets`).

- [ ] **Step 2: Run** `npx vitest run src/model/store.test.ts` — FAIL.

- [ ] **Step 3: Implement.** In `src/model/store.ts` add to the `PlanState` type:

```ts
  addRoomArea(polygon: Vec2[], name?: string): string | null;
  setRoomPolygon(id: string, polygon: Vec2[]): boolean;
  setRoomFinish(id: string, patch: { floor?: FloorFinish; wall?: WallFinish }): void;
  setPlanFinish(patch: Partial<PlanFinish>): void;
  dragRoomVertex(id: string, index: number, to: Vec2): void;
```

Imports: `isValidPolygon, pointInPolygon, polygonCentroid` from `../geometry/polygon`; `planFinish` from `../materials/presets`; types `FloorFinish, PlanFinish, WallFinish`. Implementation (after `removeRoom`):

```ts
      addRoomArea: (polygon, name) => {
        const pts = polygon.map(roundVec);
        if (!isValidPolygon(pts)) return null;
        const plan = get().plan;
        const room: Room = { id: newId('room'), name: name ?? `방 ${plan.rooms.length + 1}`, label: polygonCentroid(pts), polygon: pts };
        commit({ ...plan, rooms: [...plan.rooms, room] }, { selectedId: room.id });
        return room.id;
      },

      setRoomPolygon: (id, polygon) => {
        const pts = polygon.map(roundVec);
        if (!isValidPolygon(pts)) return false;
        const plan = get().plan;
        const room = plan.rooms.find((r) => r.id === id);
        if (!room) return false;
        const label = pointInPolygon(room.label, pts) ? room.label : polygonCentroid(pts);
        commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? { ...r, polygon: pts, label } : r)) });
        return true;
      },

      setRoomFinish: (id, patch) => {
        const plan = get().plan;
        if (!plan.rooms.some((r) => r.id === id)) return;
        const norm = <T extends { color: string }>(f: T): T => ({ ...f, color: f.color.toLowerCase() });
        commit({
          ...plan,
          rooms: plan.rooms.map((r) =>
            r.id === id ? { ...r, ...(patch.floor ? { floor: norm(patch.floor) } : {}), ...(patch.wall ? { wall: norm(patch.wall) } : {}) } : r,
          ),
        });
      },

      setPlanFinish: (patch) => {
        const plan = get().plan;
        const cur = planFinish(plan);
        const lower = <T extends { color: string }>(f: T): T => ({ ...f, color: f.color.toLowerCase() });
        commit({ ...plan, finish: { floor: patch.floor ? lower(patch.floor) : cur.floor, wall: patch.wall ? lower(patch.wall) : cur.wall } });
      },

      dragRoomVertex: (id, index, to) => {
        const origin = get().dragOrigin;
        if (!origin) return;
        const room = origin.rooms.find((r) => r.id === id);
        if (!room?.polygon || index < 0 || index >= room.polygon.length) return;
        const polygon = room.polygon.map((p, i) => (i === index ? roundVec(to) : p));
        if (!isValidPolygon(polygon)) return;
        set({ plan: { ...get().plan, rooms: get().plan.rooms.map((r) => (r.id === id ? { ...r, polygon } : r)) } });
      },
```

Check `endDrag` already commits `plan` vs `dragOrigin` generically (it compares the whole plan) — read it; if it only handles items/walls, extend so a changed `rooms` array also records an undo step.

- [ ] **Step 4: Run** `npm run typecheck && npx vitest run src/model/store.test.ts` — PASS. **Step 5: Commit** (MODULE-MAP `store.ts` line: mention room area/finish actions):

```bash
git add src/model/store.ts src/model/store.test.ts src/MODULE-MAP.md
git commit -m "feat: store actions for room areas, vertex drag and finishes"
```

---

### Task 4: `area` tool — uiStore, tools.ts, Editor2D keys, ToolPreview

**Files:**
- Modify: `src/ui/uiStore.ts` (Tool union + `areaTarget` + `startArea`), `src/editor2d/tools.ts`, `src/editor2d/tools.test.ts`, `src/editor2d/Editor2D.tsx`, `src/editor2d/ToolPreview.tsx`, `src/ui/StructurePanel.tsx` (tool button + hint), `src/styles.css` (preview polygon class only)

**Interfaces:**
- Consumes: `addRoomArea`, `setRoomPolygon` (Task 3); `closesPolygon`, `isValidPolygon` (Task 2); `wallToolPoint`, `snapToEndpoint` (`editor2d/snapping.ts`).
- Produces: `Tool` gains `'area'`; `UiState.areaTarget: string | null`; `startArea(roomId: string | null): void` (sets `tool: 'area'`, `areaTarget`); `setTool` resets `areaTarget: null`. `ToolContext` gains `areaPoints: Vec2[]`, `setAreaPoints(points: Vec2[]): void`. `export const AREA_CLOSE_CM = 15`. `export function areaToolPoint(raw, points, walls, snap): Vec2` (endpoint snap to wall endpoints **and wall corners** = `corners(wallObb(w))`, then 45° angle snap from the previous point like walls). `export function finishArea(store, points): boolean` — closes using `areaTarget` (set polygon on target room, else `addRoomArea`), shows banner `'영역은 꼭짓점 3개 이상이어야 합니다.'` on failure, resets tool to `select` on success.

- [ ] **Step 1: Tests** — append to `src/editor2d/tools.test.ts` (read the file's existing setup for how `useUi` and the store are prepared in tests, mirror it; imports needed: `createPlanStore` from `../model/store`, `SAMPLE_PLAN` from `../model/samplePlan`, `useUi` from `../ui/uiStore`, `applyToolClick, finishArea` from `./tools`, type `Vec2`). Note the sample plan's wall `w1` has thickness 20, so its OBB corner is at (-10,-10) and (10,10) — the first test clicks (13,12) and expects the snap to (10,10):

```ts
describe('area tool', () => {
  const ctx = () => {
    const store = createPlanStore(SAMPLE_PLAN);
    let areaPoints: Vec2[] = [];
    return { store, get: () => areaPoints, ctx: { store, wallPoints: [], setWallPoints: () => {}, areaPoints, setAreaPoints: (p: Vec2[]) => { areaPoints = p; } } };
  };

  it('클릭마다 점을 더하고 벽 모서리에 스냅한다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, snap: true });
    const c = ctx();
    applyToolClick('area', { x: 13, y: 12 }, c.ctx); // w1 모서리(10,10)로 스냅
    expect(c.get()).toEqual([{ x: 10, y: 10 }]);
  });

  it('첫 점을 다시 클릭하면 방을 만든다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, snap: false });
    const c = ctx();
    const pts = [{ x: 20, y: 20 }, { x: 300, y: 20 }, { x: 300, y: 300 }];
    for (const p of pts) {
      applyToolClick('area', p, { ...c.ctx, areaPoints: c.get() });
    }
    applyToolClick('area', { x: 24, y: 18 }, { ...c.ctx, areaPoints: c.get() });
    const rooms = c.store.getState().plan.rooms;
    expect(rooms).toHaveLength(3);
    expect(rooms[2].polygon).toEqual(pts);
    expect(useUi.getState().tool).toBe('select');
  });

  it('areaTarget이 있으면 그 방에 영역을 넣는다', () => {
    useUi.setState({ tool: 'area', areaTarget: 'r1', snap: false });
    const c = ctx();
    expect(finishArea(c.store, [{ x: 20, y: 20 }, { x: 300, y: 20 }, { x: 300, y: 300 }, { x: 20, y: 300 }])).toBe(true);
    expect(c.store.getState().plan.rooms).toHaveLength(2);
    expect(c.store.getState().plan.rooms[0].polygon).toHaveLength(4);
    expect(useUi.getState().areaTarget).toBeNull();
  });

  it('점이 3개 미만이면 닫지 않고 배너를 띄운다', () => {
    useUi.setState({ tool: 'area', areaTarget: null, banner: null });
    const c = ctx();
    expect(finishArea(c.store, [{ x: 0, y: 0 }, { x: 10, y: 0 }])).toBe(false);
    expect(useUi.getState().banner?.kind).toBe('error');
    expect(useUi.getState().tool).toBe('area');
  });
});
```

- [ ] **Step 2: Run** `npx vitest run src/editor2d/tools.test.ts` — FAIL.

- [ ] **Step 3: uiStore.** `Tool` union add `'area'`. Add state `areaTarget: string | null` (initial `null`), action `startArea(roomId: string | null): void` → `set({ tool: 'area', areaTarget: roomId, candidates: null, calibration: null })`. In `setMode`, `setTool`, `setFixtureTool`, `cancelCalibration` add `areaTarget: null`.

- [ ] **Step 4: tools.ts.** Extend `ToolContext`:

```ts
type ToolContext = {
  store: StoreApi<PlanState>;
  wallPoints: Vec2[];
  setWallPoints(points: Vec2[]): void;
  areaPoints: Vec2[];
  setAreaPoints(points: Vec2[]): void;
};
export const AREA_CLOSE_CM = 15;

export function areaSnapPoints(walls: Wall[]): Vec2[] {
  return walls.flatMap((w) => [w.a, w.b, ...corners(wallObb(w)).map(round)]);
}

export function areaToolPoint(raw: Vec2, points: Vec2[], walls: Wall[], snap: boolean): Vec2 {
  return wallToolPoint(raw, points.at(-1) ?? null, [...areaSnapPoints(walls), ...points], snap);
}

export function finishArea(store: StoreApi<PlanState>, points: Vec2[]): boolean {
  const ui = useUi.getState();
  const s = store.getState();
  if (!isValidPolygon(points)) {
    ui.showBanner({ kind: 'error', text: '영역은 꼭짓점 3개 이상이어야 합니다.' });
    return false;
  }
  const ok = ui.areaTarget ? s.setRoomPolygon(ui.areaTarget, points) : s.addRoomArea(points) !== null;
  if (!ok) {
    ui.showBanner({ kind: 'error', text: '영역을 저장하지 못했습니다.' });
    return false;
  }
  if (ui.areaTarget) s.select(ui.areaTarget);
  ui.setTool('select');
  return true;
}
```

`applyToolClick` case:

```ts
    case 'area': {
      const first = ctx.areaPoints[0];
      if (first && ctx.areaPoints.length >= 3 && closesPolygon(raw, first, AREA_CLOSE_CM)) {
        if (finishArea(ctx.store, ctx.areaPoints)) ctx.setAreaPoints([]);
        return;
      }
      ctx.setAreaPoints([...ctx.areaPoints, areaToolPoint(raw, ctx.areaPoints, s.plan.walls, ui.snap)]);
      return;
    }
```

Imports: `corners` from `../geometry/obb`, `wallObb` from `../geometry/walls`, `closesPolygon, isValidPolygon` from `../geometry/polygon`, type `Wall`.

- [ ] **Step 5: Editor2D.** Add `const [areaPoints, setAreaPoints] = useState<Vec2[]>([]);` reset in the `[tool]` effect; pass to `applyToolClick` ctx and `ToolPreview` (`areaPoints` prop). Key handler: before the Escape branch add

```ts
      if (tool === 'area') {
        if (e.key === 'Enter' && areaPoints.length > 0) {
          e.preventDefault();
          if (finishArea(store, areaPoints)) setAreaPoints([]);
          return;
        }
        if (e.key === 'Escape') {
          setAreaPoints([]);
          useUi.getState().setTool('select');
          return;
        }
      }
```

Add `areaPoints` to the effect deps. `onDoubleClick`: also finish area when `tool === 'area' && areaPoints.length >= 3`.

- [ ] **Step 6: ToolPreview.** Add prop `areaPoints: Vec2[]`; branch:

```tsx
  if (tool === 'area' && (areaPoints.length > 0 || cursor)) {
    const next = cursor ? areaToolPoint(cursor, areaPoints, walls, snap) : null;
    const pts = next ? [...areaPoints, next] : areaPoints;
    return (
      <g className="tool-preview">
        {pts.length >= 2 && <polygon points={pointsAttr(pts)} className="tool-preview-area" />}
        {areaPoints.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={(i === 0 ? 6 : 4) * px} />
        ))}
        {pts.length >= 3 && (
          <text x={pts[0].x + 8 * px} y={pts[0].y - 8 * px} fontSize={11 * px}>{areaM2(pts)}㎡</text>
        )}
      </g>
    );
  }
```

CSS (`src/styles.css`, next to `.tool-preview-room`): `.tool-preview-area { fill: rgba(59, 130, 246, 0.08); stroke: var(--accent); stroke-dasharray: 6 4; stroke-width: 1.5; vector-effect: non-scaling-stroke; }`.

- [ ] **Step 7: StructurePanel.** Add `['area', '영역']` to `TOOLS` after `'label'`. Hint: `{tool === 'area' && <p className="muted">{areaTarget ? '이 방의 바닥 꼭짓점을 차례로 클릭하세요.' : '바닥 꼭짓점을 차례로 클릭하세요.'} 첫 점을 다시 클릭하거나 Enter로 닫고, Esc로 취소합니다.</p>}` (read `areaTarget` via `useUi`).

- [ ] **Step 8: Run** `npm run typecheck && npm test` — PASS. **Step 9: Commit** (MODULE-MAP `tools.ts`, `uiStore.ts`, `ToolPreview` lines):

```bash
git add src/ui/uiStore.ts src/editor2d/tools.ts src/editor2d/tools.test.ts src/editor2d/Editor2D.tsx src/editor2d/ToolPreview.tsx src/ui/StructurePanel.tsx src/styles.css src/MODULE-MAP.md
git commit -m "feat: area tool to draw room floor polygons in the 2D editor (spec §19.2)"
```

---

### Task 5: 2D rendering — floor patterns, polygon fill, vertex handles

**Files:**
- Create: `src/editor2d/floorPattern.tsx`, `src/editor2d/floorPattern.test.ts`
- Modify: `src/editor2d/Rooms2D.tsx`, `src/styles.css` (room polygon classes), `src/editor2d/Editor2D.tsx` (no change if `Rooms2D` already sits under `Walls2D` — it does)

**Interfaces:**
- Consumes: `roomFloor` (Task 1), `dragRoomVertex` (Task 3), `snapToEndpoint`, `areaSnapPoints` (Task 4).
- Produces: `floorPatternId(roomId: string): string` → `floor-${roomId}`; `FloorPatternDefs({ rooms, plan })` renders one `<pattern>` per room with polygon (wood: 120×15cm planks staggered in 4 rows, `plain`: no pattern needed — direct fill; tile: 60×60 grid with 0.3cm grout). Pure helper `patternSpec(finish: FloorFinish): { w: number; h: number; shapes: { x: number; y: number; w: number; h: number; shade: number }[] } | null` in `floorPattern.tsx` is tested (no React in the test).

- [ ] **Step 1: Test** `src/editor2d/floorPattern.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { patternSpec, shade } from './floorPattern';

describe('floor pattern', () => {
  it('마루는 120×15 널판 4줄, 줄마다 엇갈림', () => {
    const s = patternSpec({ material: 'wood', color: '#c9a06c' })!;
    expect(s.w).toBe(240);
    expect(s.h).toBe(60);
    expect(s.shapes.length).toBeGreaterThanOrEqual(8);
    const rows = new Set(s.shapes.map((r) => r.y));
    expect(rows.size).toBe(4);
    expect(s.shapes.every((r) => r.h === 15)).toBe(true);
  });
  it('타일은 60×60 한 칸, 줄눈 0.3', () => {
    const s = patternSpec({ material: 'tile', color: '#b8b5ae' })!;
    expect(s.w).toBe(60);
    expect(s.shapes).toEqual([{ x: 0.15, y: 0.15, w: 59.7, h: 59.7, shade: 0 }]);
  });
  it('plain은 패턴 없음', () => {
    expect(patternSpec({ material: 'plain', color: '#ffffff' })).toBeNull();
  });
  it('shade는 색을 밝거나 어둡게 하고 #rrggbb를 돌려준다', () => {
    expect(shade('#808080', 0)).toBe('#808080');
    expect(shade('#808080', 0.1)).toBe('#8d8d8d');
    expect(shade('#808080', -0.1)).toBe('#737373');
    expect(shade('#ffffff', 0.5)).toBe('#ffffff');
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement** `src/editor2d/floorPattern.tsx`:

```tsx
import type { FloorFinish, Plan, Room } from '../model/schema';
import { roomFloor } from '../materials/presets';

export type PatternShape = { x: number; y: number; w: number; h: number; shade: number };
export type PatternSpec = { w: number; h: number; shapes: PatternShape[] };

const PLANK_W = 120;
const PLANK_H = 15;
const TILE = 60;
const GROUT = 0.3;

export function shade(hex: string, amount: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(v + (amount >= 0 ? (255 - v) * amount : v * amount))));
  const r = ch((n >> 16) & 255);
  const g = ch((n >> 8) & 255);
  const b = ch(n & 255);
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}

// 널판 4줄, 줄마다 1/4씩 엇갈리게. 타일 한 칸은 줄눈을 뺀 사각형
export function patternSpec(finish: FloorFinish): PatternSpec | null {
  if (finish.material === 'plain') return null;
  if (finish.material === 'tile') return { w: TILE, h: TILE, shapes: [{ x: GROUT / 2, y: GROUT / 2, w: TILE - GROUT, h: TILE - GROUT, shade: 0 }] };
  const shapes: PatternShape[] = [];
  const shades = [0, -0.06, 0.05, -0.03];
  for (let row = 0; row < 4; row++) {
    const offset = (row * PLANK_W) / 4;
    for (let x = -PLANK_W + offset; x < PLANK_W * 2; x += PLANK_W) {
      shapes.push({ x, y: row * PLANK_H, w: PLANK_W - 0.6, h: PLANK_H, shade: shades[(row + Math.round(x / PLANK_W) + 8) % 4] });
    }
  }
  return { w: PLANK_W * 2, h: PLANK_H * 4, shapes };
}

export function floorPatternId(roomId: string): string {
  return `floor-${roomId}`;
}

export function FloorPatternDefs({ rooms, plan }: { rooms: Room[]; plan: Pick<Plan, 'finish'> }) {
  return (
    <defs>
      {rooms.map((r) => {
        const finish = roomFloor(r, plan);
        const spec = patternSpec(finish);
        if (!spec) return null;
        const grout = finish.material === 'tile' ? shade(finish.color, -0.25) : shade(finish.color, -0.35);
        return (
          <pattern key={r.id} id={floorPatternId(r.id)} patternUnits="userSpaceOnUse" width={spec.w} height={spec.h}>
            <rect width={spec.w} height={spec.h} fill={grout} />
            {spec.shapes.map((s, i) => (
              <rect key={i} x={s.x} y={s.y} width={s.w} height={s.h} fill={shade(finish.color, s.shade)} />
            ))}
          </pattern>
        );
      })}
    </defs>
  );
}

export function floorFill(room: Room, plan: Pick<Plan, 'finish'>): string {
  const finish = roomFloor(room, plan);
  return patternSpec(finish) ? `url(#${floorPatternId(room.id)})` : finish.color;
}
```

- [ ] **Step 4: Rooms2D.** Render, before the labels: `<FloorPatternDefs rooms={roomsWithPolygon} plan={plan} />`, then per room with polygon:

```tsx
<polygon
  key={r.id}
  points={pointsAttr(r.polygon)}
  fill={floorFill(r, plan)}
  className={r.id === selectedId ? 'room-area room-area-selected' : 'room-area'}
  data-testid={`room-area-${r.id}`}
  onPointerDown={interactive ? (e) => { e.stopPropagation(); store.getState().select(r.id); } : undefined}
/>
```

`plan` = `usePlan((s) => s.plan)` is too broad; select `finish = usePlan((s) => s.plan.finish)` and pass `{ finish }`. Then, when `interactive && r.id === selectedId && r.polygon`, render a `VertexHandle` per point (copy `EndpointHandle` from `Walls2D.tsx`, but `onMove` computes `to = snap ? (snapToEndpoint(raw, areaSnapPoints(s.plan.walls)) ?? raw) : raw` and calls `s.dragRoomVertex(r.id, i, to)`; `onDown` → `beginDrag`, `onUp` → `endDrag`; `className="endpoint-handle"`, `data-testid={`room-vertex-${r.id}-${i}`}`). Labels keep their existing rendering (on top).

CSS: `.room-area { stroke: none; cursor: pointer; } .room-area-selected { stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; }`. In `.mode-place`/non-structure modes the polygon should not steal clicks: add `.editor2d:not(.mode-structure) .room-area { pointer-events: none; }`.

- [ ] **Step 5: Render test** (Review Focus #4): add to `src/editor2d/floorPattern.test.ts`? No — React render tests are not used in this repo for editor layers; instead verify by `npm run typecheck`, `npm test`, and the e2e in Task 10. Run both. **Step 6: Commit** (MODULE-MAP: `floorPattern.tsx`, `Rooms2D.tsx` lines):

```bash
git add src/editor2d/floorPattern.tsx src/editor2d/floorPattern.test.ts src/editor2d/Rooms2D.tsx src/styles.css src/MODULE-MAP.md
git commit -m "feat: draw room floor polygons with wood/tile patterns and vertex handles in 2D"
```

---

### Task 6: Properties UI — finish picker, room finishes/area, plan defaults

**Files:**
- Create: `src/ui/FinishPicker.tsx`
- Modify: `src/ui/properties/RoomProperties.tsx`, `src/ui/StructurePanel.tsx` (「기본 마감」 section at the bottom), `src/styles.css` (picker classes; use existing tokens for now — Task 9 re-tokenizes)

**Interfaces:**
- Consumes: `FLOOR_PRESETS`, `WALL_PRESETS`, `roomFloor`, `roomWall`, `planFinish` (Task 1); `setRoomFinish`, `setPlanFinish`, `addRoomArea`/`startArea` (Tasks 3–4); `areaM2` (Task 2).
- Produces: `FinishPicker<F extends FloorFinish | WallFinish>({ label, value, presets, onChange }: { label: string; value: F; presets: readonly { id: string; label: string; finish: F }[]; onChange: (f: F) => void })` — preset chips (`button[aria-pressed]`, each with inline swatch), material `<select aria-label={`${label} 재질`}>`, `<input type="color" aria-label={`${label} 색`}>`.

- [ ] **Step 1: FinishPicker**:

```tsx
import type { FloorFinish, WallFinish } from '../model/schema';

type AnyFinish = FloorFinish | WallFinish;
type Props<F extends AnyFinish> = {
  label: string;
  value: F;
  presets: readonly { id: string; label: string; finish: F }[];
  materials: readonly [F['material'], string][];
  onChange: (f: F) => void;
};

export function FinishPicker<F extends AnyFinish>({ label, value, presets, materials, onChange }: Props<F>) {
  return (
    <fieldset className="finish">
      <legend>{label}</legend>
      <div className="finish-presets">
        {presets.map((p) => {
          const active = p.finish.material === value.material && p.finish.color === value.color;
          return (
            <button key={p.id} type="button" className="finish-chip" aria-pressed={active} onClick={() => onChange(p.finish)}>
              <span className="swatch" style={{ background: p.finish.color }} aria-hidden="true" />
              {p.label}
            </button>
          );
        })}
      </div>
      <div className="row">
        <select aria-label={`${label} 재질`} value={value.material} onChange={(e) => onChange({ ...value, material: e.target.value as F['material'] })}>
          {materials.map(([m, text]) => (
            <option key={m} value={m}>{text}</option>
          ))}
        </select>
        <input type="color" aria-label={`${label} 색`} value={value.color} onChange={(e) => onChange({ ...value, color: e.target.value })} />
      </div>
    </fieldset>
  );
}

export const FLOOR_MATERIALS: readonly [FloorFinish['material'], string][] = [['wood', '마루'], ['tile', '타일'], ['plain', '단색']];
export const WALL_MATERIALS: readonly [WallFinish['material'], string][] = [['paint', '페인트'], ['wallpaper', '벽지']];
```

- [ ] **Step 2: RoomProperties** — after the X/Y fields:

```tsx
      <h3>바닥 영역</h3>
      {room.polygon ? (
        <p className="muted">꼭짓점 {room.polygon.length}개 · {areaM2(room.polygon)}㎡</p>
      ) : (
        <p className="muted">영역이 없습니다. 바닥재·벽지를 보려면 영역을 그리세요.</p>
      )}
      <button type="button" onClick={() => useUi.getState().startArea(room.id)}>{room.polygon ? '영역 다시 그리기' : '영역 그리기'}</button>
      <FinishPicker label="바닥재" value={roomFloor(room, plan)} presets={FLOOR_PRESETS} materials={FLOOR_MATERIALS} onChange={(floor) => s.setRoomFinish(room.id, { floor })} />
      <FinishPicker label="벽 마감" value={roomWall(room, plan)} presets={WALL_PRESETS} materials={WALL_MATERIALS} onChange={(wall) => s.setRoomFinish(room.id, { wall })} />
```

Get `plan` finish via `const finish = usePlan((st) => st.plan.finish)` and pass `{ finish }`. Rename the delete button copy to `방 삭제`.

- [ ] **Step 3: StructurePanel** — at the end of the panel add:

```tsx
      <h3>기본 마감</h3>
      <FinishPicker label="기본 바닥재" value={planFinish({ finish }).floor} presets={FLOOR_PRESETS} materials={FLOOR_MATERIALS} onChange={(floor) => store.getState().setPlanFinish({ floor })} />
      <FinishPicker label="기본 벽 마감" value={planFinish({ finish }).wall} presets={WALL_PRESETS} materials={WALL_MATERIALS} onChange={(wall) => store.getState().setPlanFinish({ wall })} />
```

- [ ] **Step 4: CSS** (minimal; Task 9 restyles):

```css
.finish { border: 1px solid #e5e1d8; border-radius: 6px; margin: 8px 0; padding: 8px; }
.finish legend { font-size: 12px; color: #6b5e4b; padding: 0 4px; }
.finish-presets { display: flex; flex-wrap: wrap; gap: 4px; margin-bottom: 6px; }
.finish-chip { display: inline-flex; align-items: center; gap: 4px; font-size: 12px; padding: 2px 8px; }
.swatch { width: 12px; height: 12px; border-radius: 3px; border: 1px solid rgba(0, 0, 0, 0.15); }
.finish input[type='color'] { width: 36px; height: 28px; padding: 0; border: 1px solid #d6d0c4; border-radius: 4px; background: none; }
```

- [ ] **Step 5: Run** `npm run typecheck && npm test`, then `npm run dev` smoke in a browser: select a room → chips change `plan.rooms[i].floor` (check via `window.__homefit.store.getState().plan`). **Step 6: Commit** (MODULE-MAP: `ui/FinishPicker.tsx`, RoomProperties, StructurePanel lines):

```bash
git add src/ui/FinishPicker.tsx src/ui/properties/RoomProperties.tsx src/ui/StructurePanel.tsx src/styles.css src/MODULE-MAP.md
git commit -m "feat: finish pickers for rooms and plan defaults, draw-area button"
```

---

### Task 7: 3D floors — procedural textures and per-room polygon meshes

**Files:**
- Create: `src/materials/textures.ts` (three + canvas, no React), `src/materials/pattern.ts`, `src/materials/pattern.test.ts`
- Modify: `src/scene3d/Floor.tsx`, `src/scene3d/Viewport.tsx` (lighting/background per §19.3)

**Interfaces:**
- Consumes: `patternSpec`/`shade` — **move** them from `editor2d/floorPattern.tsx` into `src/materials/pattern.ts` (React-free) and re-export from `floorPattern.tsx` so Task 5's imports keep working; move the tests too.
- Produces: `textures.ts`: `floorTexture(finish: FloorFinish): THREE.Texture | null` (cached by `${material}:${color}`; `plain` → `null`), `wallTexture(finish: WallFinish): THREE.Texture | null` (`wallpaper` → faint 2cm linen cross-hatch, `paint` → `null`), `TEXTURE_CM = { wood: 240×60, tile: 60×60, wallpaper: 50×50 }`. Textures use `RepeatWrapping`, `repeat` set per mesh so that 1 texture tile = pattern size in metres (`cmToM(spec.w)`), `colorSpace = SRGBColorSpace`.

- [ ] **Step 1: Move + test.** Create `src/materials/pattern.ts` with `shade`, `patternSpec`, `PatternSpec`, `PatternShape` (same code as Task 5), add `wallPatternSpec(finish: WallFinish): PatternSpec | null` (`paint` → `null`; `wallpaper` → `{ w: 2, h: 2, shapes: [{ x: 0, y: 0, w: 2, h: 0.4, shade: -0.04 }, { x: 0, y: 0, w: 0.4, h: 2, shade: -0.04 }] }`). Move the Task 5 tests to `src/materials/pattern.test.ts` and add:

```ts
  it('벽지는 2cm 격자, 페인트는 없음', () => {
    expect(wallPatternSpec({ material: 'paint', color: '#ffffff' })).toBeNull();
    expect(wallPatternSpec({ material: 'wallpaper', color: '#e8dcc8' })!.w).toBe(2);
  });
```

`editor2d/floorPattern.tsx` keeps only React parts and re-exports: `export { patternSpec, shade } from '../materials/pattern';`.

- [ ] **Step 2: Run** `npm test` — PASS (moved tests). **Step 3: textures.ts**:

```ts
import * as THREE from 'three';
import type { FloorFinish, WallFinish } from '../model/schema';
import { patternSpec, shade, wallPatternSpec, type PatternSpec } from './pattern';

const cache = new Map<string, THREE.Texture>();
const PX_PER_CM = 4;

function drawSpec(spec: PatternSpec, color: string, groutShade: number): THREE.Texture {
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(spec.w * PX_PER_CM);
  canvas.height = Math.round(spec.h * PX_PER_CM);
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = shade(color, groutShade);
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  for (const s of spec.shapes) {
    ctx.fillStyle = shade(color, s.shade);
    ctx.fillRect(s.x * PX_PER_CM, s.y * PX_PER_CM, s.w * PX_PER_CM, s.h * PX_PER_CM);
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function cached(key: string, make: () => THREE.Texture): THREE.Texture {
  let t = cache.get(key);
  if (!t) {
    t = make();
    cache.set(key, t);
  }
  return t;
}

export function floorTexture(finish: FloorFinish): { texture: THREE.Texture; sizeCm: { w: number; h: number } } | null {
  const spec = patternSpec(finish);
  if (!spec) return null;
  const grout = finish.material === 'tile' ? -0.25 : -0.35;
  return { texture: cached(`floor:${finish.material}:${finish.color}`, () => drawSpec(spec, finish.color, grout)), sizeCm: { w: spec.w, h: spec.h } };
}

export function wallTexture(finish: WallFinish): { texture: THREE.Texture; sizeCm: { w: number; h: number } } | null {
  const spec = wallPatternSpec(finish);
  if (!spec) return null;
  return { texture: cached(`wall:${finish.material}:${finish.color}`, () => drawSpec(spec, finish.color, 0)), sizeCm: { w: spec.w, h: spec.h } };
}
```

- [ ] **Step 4: Floor.tsx.** Keep the base plane but colour it with `planFinish(plan).floor.color` (no texture on the base — it is the "outside" floor) and keep the Grid. Add per-room meshes:

```tsx
function RoomFloor({ room, finish }: { room: Room; finish: FloorFinish }) {
  const polygon = room.polygon!;
  const geometry = useMemo(() => {
    const shape = new THREE.Shape(polygon.map((p) => new THREE.Vector2(cmToM(p.x), cmToM(p.y))));
    const g = new THREE.ShapeGeometry(shape);
    // 평면(x, y) → 바닥(x, z): rotation.x = -π/2 로 눕히면 y가 -z가 되므로 z 반전을 위해 scale 처리 대신 미리 y를 뒤집지 않고 회전만 쓴다
    return g;
  }, [polygon]);
  const tex = floorTexture(finish);
  const material = useMemo(() => {
    const m = new THREE.MeshStandardMaterial({ color: tex ? '#ffffff' : finish.color, roughness: 0.85 });
    if (tex) {
      const t = tex.texture.clone();
      t.needsUpdate = true;
      t.repeat.set(1 / cmToM(tex.sizeCm.w), 1 / cmToM(tex.sizeCm.h));
      m.map = t;
    }
    return m;
  }, [tex, finish.color]);
  return <mesh geometry={geometry} material={material} rotation-x={Math.PI / 2} scale={[1, -1, 1]} position={[0, 0.002, 0]} onClick={() => { store.getState().select(null); useUi.getState().clearCandidates(); }} />;
}
```

**Orientation check:** `toWorld` maps plan `(x, y)` → world `(x, 0, y)`. `ShapeGeometry` lies in local XY; `rotation-x = Math.PI/2` sends local +y to world **+z**, but flips the face downward — hence `scale=[1,-1,1]` to restore an upward normal while keeping `y→z`. Verify in the browser that the floor renders on top (not back-face-culled) and lands exactly under the 2D polygon corners (compare with a wall corner). If it is mirrored, use `rotation-x={-Math.PI/2}` with the shape built from `(x, -y)` instead; pick whichever matches and leave a one-line comment.

In `Floor()` render `{rooms.filter((r) => r.polygon).map((r) => <RoomFloor key={r.id} room={r} finish={roomFloor(r, { finish })} />)}` after the Grid (`finish = usePlan((s) => s.plan.finish)`). Set `map.repeat`/texture per material; dispose on unmount via `useEffect(() => () => { material.dispose(); geometry.dispose(); }, [material, geometry])`.

- [ ] **Step 5: Viewport.** `<ambientLight intensity={0.75} color="#fff4e6" />`, `<directionalLight position={[5, 10, 5]} intensity={1.0} />`, add `<color attach="background" args={['#efeae2']} />` inside the Canvas.

- [ ] **Step 6: Verify** `npm run typecheck && npm test`; browser: draw an area, pick 월넛, switch to 3D/탑뷰 — planks visible and aligned with 2D. **Step 7: Commit** (MODULE-MAP `materials/pattern.ts`, `textures.ts`, `scene3d/Floor.tsx`):

```bash
git add src/materials/pattern.ts src/materials/pattern.test.ts src/materials/textures.ts src/editor2d/floorPattern.tsx src/editor2d/floorPattern.test.ts src/scene3d/Floor.tsx src/scene3d/Viewport.tsx src/MODULE-MAP.md
git commit -m "feat: per-room 3D floors with procedural wood and tile textures (spec §19.3)"
```

(If `src/editor2d/floorPattern.test.ts` becomes empty, delete it and `git add` the deletion.)

---

### Task 8: 3D walls — per-face finish by room, dark top

**Files:**
- Create: `src/materials/wallFaces.ts`, `src/materials/wallFaces.test.ts`
- Modify: `src/scene3d/Walls3D.tsx`

**Interfaces:**
- Consumes: `WallPiece` (`geometry/walls.ts`), `axes`/`OBB` (`geometry/obb.ts`), `pointInPolygon` (Task 2), `roomWall`/`planFinish` (Task 1), `wallTexture` (Task 7).
- Produces: `wallFaceRooms(piece: OBB, rooms: Room[]): { front: Room | null; back: Room | null }` where `front` is the side in direction `+normal` (= local +y of the OBB, i.e. `axes(obb)[1]`) and `back` is `-normal`. Probe point = `center ± normal * (hd + 1)`. First matching room in plan order wins; rooms without `polygon` are skipped. `WALL_TOP_COLOR = '#3f3a33'`.

- [ ] **Step 1: Test** `src/materials/wallFaces.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import type { Room } from '../model/schema';
import { wallFaceRooms } from './wallFaces';

const room = (id: string, polygon: Room['polygon']): Room => ({ id, name: id, label: polygon![0], polygon });
const left = room('L', [{ x: 0, y: 0 }, { x: 300, y: 0 }, { x: 300, y: 300 }, { x: 0, y: 300 }]);
const right = room('R', [{ x: 310, y: 0 }, { x: 600, y: 0 }, { x: 600, y: 300 }, { x: 310, y: 300 }]);
const noPoly: Room = { id: 'N', name: 'N', label: { x: 0, y: 0 } };
// 벽 중심 x=305, 두께 10, 세로로 놓인 벽 (angle = π/2)
const piece = { cx: 305, cy: 150, hw: 150, hd: 5, angle: Math.PI / 2 };

describe('wallFaceRooms', () => {
  it('양 측면이 속한 방을 찾는다', () => {
    const r = wallFaceRooms(piece, [noPoly, left, right]);
    expect(new Set([r.front?.id, r.back?.id])).toEqual(new Set(['L', 'R']));
  });
  it('어느 방에도 없으면 null', () => {
    const r = wallFaceRooms({ ...piece, cx: 1000 }, [left, right]);
    expect(r).toEqual({ front: null, back: null });
  });
  it('겹치는 방은 먼저 나온 방이 이긴다', () => {
    const big = room('B', [{ x: -10, y: -10 }, { x: 700, y: -10 }, { x: 700, y: 400 }, { x: -10, y: 400 }]);
    const r = wallFaceRooms(piece, [big, left, right]);
    expect(r.front?.id).toBe('B');
    expect(r.back?.id).toBe('B');
  });
});
```

- [ ] **Step 2: Run** — FAIL. **Step 3: Implement**:

```ts
import { axes, type OBB } from '../geometry/obb';
import { pointInPolygon } from '../geometry/polygon';
import type { Room } from '../model/schema';

export const WALL_TOP_COLOR = '#3f3a33';
const PROBE_CM = 1;

function roomAt(p: { x: number; y: number }, rooms: Room[]): Room | null {
  for (const r of rooms) if (r.polygon && pointInPolygon(p, r.polygon)) return r;
  return null;
}

// 벽 조각의 두 측면(법선 ±v 방향)이 어느 방 안에 있는지. front = +v 쪽
export function wallFaceRooms(piece: OBB, rooms: Room[]): { front: Room | null; back: Room | null } {
  const [, v] = axes(piece);
  const d = piece.hd + PROBE_CM;
  return {
    front: roomAt({ x: piece.cx + v.x * d, y: piece.cy + v.y * d }, rooms),
    back: roomAt({ x: piece.cx - v.x * d, y: piece.cy - v.y * d }, rooms),
  };
}
```

Read `axes()` in `geometry/obb.ts` to confirm `[u, v]` with `v` the thickness direction; adjust if the second axis is not the normal.

- [ ] **Step 4: Walls3D.** For each piece compute `{ front, back }`; materials:

```tsx
const finishFront = front ? roomWall(front, { finish }) : planFinish({ finish }).wall;
const finishBack = back ? roomWall(back, { finish }) : planFinish({ finish }).wall;
```

Build a memoised `THREE.MeshStandardMaterial` per finish via a small `useWallMaterial(finish)` helper in `Walls3D.tsx` (module-level `Map<string, MeshStandardMaterial>` keyed `${material}:${color}`; `map` from `wallTexture` with `repeat` = `1/cmToM(sizeCm.w)`, roughness 0.9) plus a shared `TOP` material `new MeshStandardMaterial({ color: WALL_TOP_COLOR })`. `boxGeometry` material order is `[+x, -x, +y, -y, +z, -z]`; with the mesh rotation `[0, -angle, 0]` and `args=[len, h, thick]`, the thickness faces are `+z`/`-z`. Determine which of `+z`/`-z` corresponds to `front` (+v): plan `y` maps to world `z`, and the mesh rotates by `-angle` about Y, so local +z corresponds to plan +v → **`+z` = front, `-z` = back**. Verify in the browser with two rooms of different wall colours either side of `w5` in the sample plan; if swapped, swap the two and leave a comment. Render:

```tsx
<mesh key={i} position={…} rotation={…} material={[base, base, TOP, base, matFront, matBack]}>
  <boxGeometry args={…} />
</mesh>
```

where `base` is the plan default wall material.

- [ ] **Step 5: Verify** `npm run typecheck && npm test`; browser check as above. **Step 6: Commit** (MODULE-MAP `wallFaces.ts`, `Walls3D.tsx`):

```bash
git add src/materials/wallFaces.ts src/materials/wallFaces.test.ts src/scene3d/Walls3D.tsx src/MODULE-MAP.md
git commit -m "feat: wall faces take the finish of the room they face, dark wall tops"
```

---

### Task 9: Wood-tone UI theme

**Files:**
- Modify: `src/styles.css` (whole file), `src/docs/DocLinks.css`

**Interfaces:** none (CSS only). Keep every class name; e2e selectors rely on roles/testids, not styles.

- [ ] **Step 1: Tokens.** Replace the `:root` line with:

```css
:root {
  --bg: #f3eee6; --panel: #fbf9f5; --panel-2: #f6f1e9; --border: #e2d9cc; --border-strong: #cfc3b1;
  --text: #2b2520; --text-2: #7a6c5d; --text-3: #a3968a;
  --walnut: #8b5e3c; --walnut-2: #6f4a2f; --brass: #b8893f; --cream: #fbf6ee;
  --danger: #c8463f; --danger-bg: #fbeae8; --warn: #d9941f; --warn-bg: #fff3dd; --info-bg: #ebe4d8; --info-text: #5a4632;
  --accent: #3b82f6; /* 2D 선택 강조는 파란색 유지 */
  --radius: 10px; --radius-s: 6px; --shadow: 0 1px 2px rgba(43, 37, 32, 0.06), 0 6px 18px rgba(43, 37, 32, 0.08);
}
```

- [ ] **Step 2: Rewrite chrome rules** using tokens only — body (`background: var(--bg); color: var(--text)`), `.toolbar` (panel bg, bottom border, `box-shadow: var(--shadow)`, brand in `font-weight: 700; letter-spacing: 0.02em; color: var(--walnut-2)`), `.left/.right` (panel bg + border tokens), `h3` captions (`font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: var(--text-2)` — Korean text ignores uppercase, fine), `.card` (`border-radius: var(--radius); background: var(--panel-2); transition: transform .12s, box-shadow .12s; &:hover { transform: translateY(-1px); box-shadow: var(--shadow); }`), `button` (`border-radius: var(--radius-s); background: var(--panel); border-color: var(--border-strong); transition: …; &:hover:not(:disabled) { border-color: var(--walnut); transform: translateY(-1px); box-shadow: var(--shadow); }`), `button[aria-pressed='true']` (`background: var(--walnut); color: var(--cream); border-color: var(--walnut)`), `.segmented` (`border-radius: 999px; padding: 2px; background: var(--panel-2); gap: 2px; border: 1px solid var(--border)` with inner buttons `border-radius: 999px` and no dividers), inputs/selects/textarea (`border: 1px solid var(--border-strong); border-radius: var(--radius-s); background: #fff` → use `var(--panel)`), badges/banners (danger/warn/info tokens), `.history`, `.layout-bar`, checklist (`.cl-*`: replace `#1f2328` checkbox with `var(--walnut)`, hover rows `var(--panel-2)`, memo bg `var(--panel-2)`), `.export-view`, `.finish-*` (Task 6), `.room-label` (3D Html: `color: var(--text-2); background: rgba(251,249,245,.8); padding: 1px 6px; border-radius: 999px`). `.editor2d-bg` → `#f8f4ee` is a 2D canvas colour; keep as a literal inside the editor section with a comment `/* 2D 캔버스 */` (allowed: editor drawing colours are not chrome). Keep `--accent` usages.

- [ ] **Step 3: Scan** for leftover chrome hex literals: `grep -nE "#[0-9a-fA-F]{3,6}" src/styles.css` — only `:root` and the `/* 2D 캔버스 */`-commented editor drawing rules (walls, openings, dims, swings) may remain. `DocLinks.css` → tokens.

- [ ] **Step 4: Visual check** in the browser: all five modes, tabs, pressed states, cards, checklist, export page, history panel, banner. Contrast of `--cream` on `--walnut` ≥ 4.5:1 (it is ≈ 6.1:1). **Step 5: Run** `npm run typecheck && npm test && npm run e2e` (styles can break Playwright visibility — e.g. `visibility: hidden` memo buttons remain as before). **Step 6: Commit**:

```bash
git add src/styles.css src/docs/DocLinks.css
git commit -m "style: wood-tone design tokens for tabs, buttons, panels and pages (spec §19.4)"
```

---

### Task 10: e2e, docs, final checks

**Files:**
- Create: `e2e/roomFinish.spec.ts`
- Modify: `src/MODULE-MAP.md` (verify every new module listed), `HANDOFF.md`, `CLAUDE.md` 「Work in progress」, `docs/README.md` 「Feature map」/plan index

- [ ] **Step 1: e2e** `e2e/roomFinish.spec.ts` (copy `getPlan`, `planToClient`, `clickPlan` helpers from `e2e/editor2d.spec.ts`):

```ts
import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };
const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
async function clickPlan(page: Page, p: P) {
  const c = await page.evaluate(({ x, y }) => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="editor2d"]')!;
    const pt = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
    return { x: pt.x, y: pt.y };
  }, p);
  await page.mouse.click(c.x, c.y);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('영역 도구로 방을 그리고 바닥재를 바꾸면 2D 패턴과 3D에 반영된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  await page.getByRole('button', { name: '영역', exact: true }).click();
  await clickPlan(page, { x: 40, y: 40 });
  await clickPlan(page, { x: 300, y: 40 });
  await clickPlan(page, { x: 300, y: 340 });
  await clickPlan(page, { x: 40, y: 340 });
  await clickPlan(page, { x: 40, y: 40 }); // 첫 점 → 닫기

  let plan = await getPlan(page);
  const room = plan.rooms[plan.rooms.length - 1];
  expect(room.polygon).toHaveLength(4);
  expect(room.name).toBe('방 3');
  await expect(page.getByTestId(`room-area-${room.id}`)).toBeVisible();

  await page.getByRole('button', { name: '월넛' }).click();
  plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.floor).toEqual({ material: 'wood', color: '#7a5230' });
  await expect(page.getByTestId(`room-area-${room.id}`)).toHaveAttribute('fill', `url(#floor-${room.id})`);

  await page.getByRole('button', { name: '그레이 포세린' }).click();
  plan = await getPlan(page);
  expect(plan.rooms.find((r) => r.id === room.id)!.floor!.material).toBe('tile');

  await page.getByRole('button', { name: '배치' }).click();
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();

  // 영역 없이 Enter로 닫으면 오류 배너
  await page.getByRole('button', { name: '구조' }).click();
  await page.getByRole('button', { name: '영역', exact: true }).click();
  await clickPlan(page, { x: 500, y: 100 });
  await clickPlan(page, { x: 560, y: 100 });
  await page.keyboard.press('Enter');
  await expect(page.getByText('영역은 꼭짓점 3개 이상이어야 합니다.')).toBeVisible();
  await page.keyboard.press('Escape');
});
```

- [ ] **Step 2: Run** `lsof -i :5180` (must be free), then `npx playwright test e2e/roomFinish.spec.ts` — PASS; fix product code, never the expectations, if red.

- [ ] **Step 3: Full checks** `npm run typecheck && npm test && npm run e2e`. Record counts.

- [ ] **Step 4: Exploratory QA** — REQUIRED SUB-SKILL: `exploratory-qa` (sample plan): draw an L-shaped area, drag a vertex, undo/redo, reload (persistence), load an old v3 JSON export, 3D persp + top view, wall colours on both sides of `w5`, PDF export still works, every tab under the new theme.

- [ ] **Step 5: Docs** — REQUIRED SUB-SKILL: `syncing-docs`: `HANDOFF.md` 「지금 상태」/「다음 할 일」 (branch `feat/room-finish`, counts, `make-our-home.mjs` → `version: 4` reminder), `CLAUDE.md` 「Work in progress」 row, `docs/README.md` plan index + Feature map rows (방 영역/바닥·벽 마감 → `geometry/polygon.ts`, `materials/`, `editor2d/Rooms2D.tsx`, `scene3d/Floor.tsx`, `scene3d/Walls3D.tsx` → §19; 우드톤 테마 → `styles.css` → §19.4), `src/MODULE-MAP.md` complete.

- [ ] **Step 6: Commit + PR + merge** — REQUIRED SUB-SKILL: `committing-safely` steps 3–9 (privacy scan on staged files and PR body; push; `gh pr create --base main` with Korean body: 변경 요약, 스펙 §19, `npm test` pass/skip, e2e pass count, QA table; rebase on `origin/main` if it moved and rerun checks; `gh pr merge --merge --delete-branch`; remove the worktree). Report the PR URL and merge commit.
