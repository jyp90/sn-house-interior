# homefit 계획 1: 기반 + 3D 배치 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평면(JSON)을 불러와 3D로 벽을 세우고, 카탈로그의 실치수 가구·가전을 드래그로 배치하며 충돌·벽 거리·문 열림을 실시간 검증하고, 브라우저에 자동 저장하는 웹앱을 만든다.

**Architecture:** 데이터는 zod 스키마에서 타입을 유도한 단일 `Plan` 객체(정수 cm)이고, zustand vanilla 스토어가 plan·선택·undo 히스토리를 보유한다. 판정 로직(`geometry/`, `validation/`)과 저장(`persistence/`)은 React 없는 순수 함수이며, 3D 씬(`scene3d/`)과 패널(`ui/`)은 스토어를 구독해 그린다. 제품 형상은 `catalog/builders/`가 치수로부터 THREE.Group을 절차적으로 만든다.

**Tech Stack:** Vite 8, TypeScript 5.9, React 19.3, @react-three/fiber 9, @react-three/drei 10, three 0.186, zustand 5, zod 4, Vitest 5, Playwright 1.63

**Spec:** `docs/superpowers/specs/2026-10-08-homefit-design.md`

**전체 로드맵(이 문서는 1번):**
1. 기반 + 3D 배치 ← 이 계획
2. 2D 구조 편집기(트레이싱, 축척 보정, 벽·문·창·방 편집, 배경 이미지 IndexedDB)
3. 전기 계획 + 체크리스트 + PDF 내보내기
4. 카탈로그 확충(삼성 실제 모델, 나머지 builder) + GitHub Pages 배포 + 탐색 QA

## Global Constraints

- 저장 단위는 정수 cm, 3D 렌더 단위는 1 unit = 1 m. 2D (x, y) → 3D (x/100, 0, y/100). 2D 회전 θ(deg) → three `rotation.y = -θ·π/180`.
- 아이템 좌표 `(x, y)`는 바닥 점유 사각형의 중심. 제품 전면은 로컬 +y(2D) = 로컬 +z(3D).
- repo와 Pages는 공개된다. 주소·단지명·평면도 이미지·우리 집 프리셋은 `private/`(gitignored)에만 둔다. 앱 번들에는 익명 샘플 평면만 넣는다.
- UI 문구는 한국어.
- 외부 가이드(@gorane_home) 문구는 복제하지 않는다(이 계획 범위에는 해당 없음).
- 의존성 버전: vite ^8.3, react/react-dom ^19.3(<19.4, R3F peer), three ^0.186, @react-three/fiber ^9.8, @react-three/drei ^10.7, zustand ^5.0, zod ^4.6, vitest ^5.0, @playwright/test ^1.63, typescript ~5.9.
- zustand v5: `useStore(store, selector)`의 selector는 매번 새 객체/배열을 만들면 무한 렌더가 난다. 스토어에 있는 참조를 그대로 반환하거나 `useMemo`로 파생한다.

## Review Focus

1. **회전된 아이템의 충돌**: 45° 회전한 가구는 AABB로는 겹쳐 보여도 실제로는 안 겹칠 수 있다. OBB SAT로 판정해야 한다 → Task 3 테스트 `AABB는 겹치지만 회전 사각형은 안 겹친다`.
2. **드래그 한 번 = 실행 취소 한 번**: pointermove마다 히스토리가 쌓이면 Ctrl+Z를 수십 번 눌러야 한다 → Task 7 테스트 `드래그 전체가 실행 취소 한 번으로 되돌아간다`.
3. **잘못된 JSON 불러오기**: 깨진 파일이나 다른 버전 파일을 열면 오류만 보여주고 현재 작업은 그대로 남아야 한다 → Task 8 테스트 `parsePlan은 버전이 다르면 실패한다`, `readPlanFile은 JSON이 아니면 실패한다`, Task 11 E2E `잘못된 JSON을 열면 오류 배너가 뜨고 배치는 유지된다`.
4. **저장소 사용 불가(사생활 보호 모드/용량 초과)**: localStorage가 throw해도 앱은 샘플 평면으로 뜨고 저장 실패를 알린다 → Task 8 테스트 `저장소가 throw하면 null/false를 돌려준다`.
5. **카탈로그에서 사라진 제품을 참조하는 아이템**: 이전 버전 JSON의 productId가 없으면 크래시 없이 무시되고 회색 박스로 그려져야 한다 → Task 5 테스트 `알 수 없는 제품은 오류 없이 상태 false`, Task 9 `ItemMesh` 폴백.

추가로 길이 0인 벽(더블클릭 실수)에서 NaN이 나지 않아야 한다 → Task 3 테스트.

---

## File Structure

```
package.json, tsconfig.json, vite.config.ts, playwright.config.ts, index.html
src/
  main.tsx                      스토어 생성, 자동 저장 시작, 렌더
  App.tsx                       레이아웃
  styles.css
  model/
    schema.ts                   zod 스키마 + 타입(z.infer)
    samplePlan.ts               익명 샘플 평면
    store.ts                    createPlanStore (plan, 선택, 히스토리, 드래그 트랜잭션)
    StoreContext.tsx            PlanStoreContext, usePlanStore, usePlan
    useValidation.ts            plan → 아이템 상태 맵 (memo)
  geometry/
    obb.ts                      OBB 타입, corners/axes, SAT, itemObb, localToWorld
    walls.ts                    wallObb, wallSolidObbs, wallPieces, planWallObbs
    bounds.ts                   planBounds, planCenter
    clearance.ts                ClearanceShape, itemClearances, doorSwings
    distance.ts                 wallDistances (4방향 벽 거리)
    snap.ts                     snapToWalls
  validation/
    validate.ts                 validatePlan → Record<itemId, ItemStatus>
  catalog/
    products.ts                 CATALOG, findProduct, CATEGORY_LABEL, CATEGORY_ORDER
    builders/
      parts.ts                  box/cylinder 메시 헬퍼
      index.ts                  buildProduct, mountHeightCm
      fridge.ts frontLoader.ts tv.ts sofa.ts bed.ts table.ts box.ts
  persistence/
    parse.ts                    parsePlan (버전 확인 + zod)
    storage.ts                  loadFromStorage, saveToStorage, startAutosave
    file.ts                     planToJson, readPlanFile, downloadText
  scene3d/
    units.ts                    toWorld, FLOOR_PLANE
    Viewport.tsx                Canvas, 카메라, 컨트롤, 드롭 처리, WebGL 폴백
    DropBridge.tsx              화면 좌표 → 바닥 cm 변환 등록
    Floor.tsx                   바닥, 그리드, 방 이름
    Walls3D.tsx
    Items3D.tsx                 ItemMesh + 드래그
    Overlays.tsx                외곽선, 문 열림 영역, 거리선
  ui/
    uiStore.ts                  view, dragging, banner
    dnd.ts                      DND_MIME
    shortcuts.ts                applyShortcut (순수) + useShortcuts
    Toolbar.tsx  Banner.tsx  CatalogPanel.tsx  CustomBoxForm.tsx  PropertiesPanel.tsx
e2e/placement.spec.ts
private/ (gitignored)  make-our-home.mjs → our-home.local.json
```

---

### Task 1: 프로젝트 골격

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `src/smoke.test.ts`

**Interfaces:**
- Produces: `npm run dev | build | test | typecheck | e2e` 스크립트

- [ ] **Step 1: package.json과 의존성 설치**

`/Users/jypark/Projects/homefit/package.json`:
```json
{
  "name": "homefit",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview",
    "typecheck": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test"
  }
}
```

Run:
```bash
cd /Users/jypark/Projects/homefit
npm install react@^19.3 react-dom@^19.3 three@^0.186 @react-three/fiber@^9.8 @react-three/drei@^10.7 zustand@^5.0 zod@^4.6
npm install -D vite@^8.3 @vitejs/plugin-react@^6.1 typescript@~5.9 vitest@^5.0 jsdom @types/react @types/react-dom @types/three@^0.186 @types/node@^22 @playwright/test@^1.63
npx playwright install chromium
```
Expected: 오류 없이 설치. `npm ls react` 가 19.3.x.

- [ ] **Step 2: 설정 파일 작성**

`tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "resolveJsonModule": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

`vite.config.ts`:
```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    environment: 'node',
  },
});
```

`index.html`:
```html
<!doctype html>
<html lang="ko">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>homefit</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/App.tsx`:
```tsx
export function App() {
  return <div className="app">homefit</div>;
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/styles.css`:
```css
* { box-sizing: border-box; }
html, body, #root { margin: 0; height: 100%; }
body { font-family: -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', sans-serif; color: #1f2328; background: #f6f5f2; }
```

- [ ] **Step 3: 스모크 테스트 작성 후 실행**

`src/smoke.test.ts`:
```ts
import { describe, expect, it } from 'vitest';

describe('smoke', () => {
  it('테스트 러너가 동작한다', () => {
    expect(1 + 1).toBe(2);
  });
});
```

Run: `npm test && npm run build`
Expected: 1 passed, `dist/` 생성.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json tsconfig.json vite.config.ts index.html src
git commit -m "chore: scaffold vite react three app"
```

---

### Task 2: 스키마와 샘플 평면

**Files:**
- Create: `src/model/schema.ts`, `src/model/samplePlan.ts`
- Test: `src/model/schema.test.ts`

**Interfaces:**
- Produces:
  - 스키마: `PlanSchema`, `ProductSchema`, `ItemSchema`, `WallSchema`, `OpeningSchema`
  - 타입: `Vec2`, `Wall`, `Opening`, `Room`, `Item`, `Fixture`, `Clearance`, `Variant`, `Product`, `Category`, `BuilderId`, `Plan`
  - `SAMPLE_PLAN: Plan`, `emptyPlanFields(): Pick<Plan, 'fixtures' | 'checklist' | 'customProducts' | 'items'>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/schema.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PlanSchema } from './schema';
import { SAMPLE_PLAN } from './samplePlan';

describe('PlanSchema', () => {
  it('샘플 평면은 스키마를 통과한다', () => {
    expect(PlanSchema.safeParse(SAMPLE_PLAN).success).toBe(true);
  });

  it('아이템 좌표가 정수가 아니면 실패한다', () => {
    const bad = { ...SAMPLE_PLAN, items: [{ id: 'i1', productId: 'p', variantId: 'v', x: 1.5, y: 0, rotation: 0 }] };
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('알 수 없는 개구부 종류는 실패한다', () => {
    const bad = {
      ...SAMPLE_PLAN,
      openings: [{ ...SAMPLE_PLAN.openings[0], kind: 'garage' }],
    };
    expect(PlanSchema.safeParse(bad).success).toBe(false);
  });

  it('version이 1이 아니면 실패한다', () => {
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, version: 2 }).success).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model/schema.test.ts`
Expected: FAIL — `Cannot find module './schema'`

- [ ] **Step 3: 스키마 구현**

`src/model/schema.ts`:
```ts
import { z } from 'zod';

const id = z.string().min(1);
const cm = z.number().int();
const positiveCm = z.number().int().positive();

export const Vec2Schema = z.object({ x: z.number(), y: z.number() });

export const WallSchema = z.object({
  id,
  a: Vec2Schema,
  b: Vec2Schema,
  thickness: positiveCm,
  height: positiveCm,
});

export const OpeningSchema = z.object({
  id,
  wallId: id,
  kind: z.enum(['door', 'window', 'opening']),
  offset: cm.nonnegative(), // 벽 a점에서 개구부 시작까지
  width: positiveCm,
  height: positiveCm,
  sill: cm.nonnegative(),
  hinge: z.enum(['start', 'end']),
  swingIn: z.boolean(), // true: 벽 방향 u를 +90° 돌린 쪽(-uy, ux)으로 열림
});

export const RoomSchema = z.object({ id, name: z.string(), label: Vec2Schema });

export const ItemSchema = z.object({
  id,
  productId: id,
  variantId: id,
  x: cm,
  y: cm,
  rotation: z.number(),
  label: z.string().optional(),
});

export const FixtureSchema = z.object({
  id,
  kind: z.enum(['outlet', 'outlet-dedicated', 'outlet-waterproof', 'switch', 'light']),
  wallId: id.optional(),
  pos: Vec2Schema,
  height: cm.nonnegative(),
  memo: z.string().optional(),
});

export const ChecklistStateSchema = z.object({
  itemId: id,
  checked: z.boolean(),
  memo: z.string().optional(),
});

export const ClearanceSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('swing'), hinge: z.enum(['left', 'right']), radius: positiveCm }),
  z.object({ kind: z.literal('front'), depth: positiveCm }),
]);

export const BuilderIdSchema = z.enum([
  'box', 'fridge', 'front-loader', 'tv', 'sofa', 'bed', 'table',
  'stand-ac', 'built-in-appliance', 'cabinet-run', 'chair', 'wardrobe',
]);

export const CategorySchema = z.enum(['kitchen', 'laundry', 'tv', 'climate', 'living', 'furniture', 'custom']);

export const VariantSchema = z.object({
  id,
  label: z.string(),
  colors: z.record(z.string(), z.string()),
});

export const ProductSchema = z.object({
  id,
  brand: z.string(),
  model: z.string(),
  name: z.string(),
  category: CategorySchema,
  dims: z.object({ w: positiveCm, d: positiveCm, h: positiveCm }),
  variants: z.array(VariantSchema).min(1),
  builder: BuilderIdSchema,
  builderParams: z.record(z.string(), z.unknown()).optional(),
  clearances: z.array(ClearanceSchema),
  power: z.object({ watts: z.number().nonnegative(), dedicatedCircuit: z.boolean() }).optional(),
  builtIn: z.boolean(),
  mount: z.enum(['floor', 'wall']),
  sourceUrl: z.string().optional(),
});

export const PlanInfoSchema = z.object({
  title: z.string(),
  address: z.string().optional(),
  supplyArea: z.number().optional(),
  exclusiveArea: z.number().optional(),
  builtYear: z.number().int().optional(),
  moveInDate: z.string().optional(),
  scope: z.string().optional(),
  notes: z.string().optional(),
});

export const BackgroundSchema = z.object({
  imageRef: z.string(),
  cmPerPx: z.number().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
});

export const PlanSchema = z.object({
  version: z.literal(1),
  info: PlanInfoSchema,
  background: BackgroundSchema.optional(),
  walls: z.array(WallSchema),
  openings: z.array(OpeningSchema),
  rooms: z.array(RoomSchema),
  items: z.array(ItemSchema),
  fixtures: z.array(FixtureSchema),
  checklist: z.array(ChecklistStateSchema),
  customProducts: z.array(ProductSchema),
});

export type Vec2 = z.infer<typeof Vec2Schema>;
export type Wall = z.infer<typeof WallSchema>;
export type Opening = z.infer<typeof OpeningSchema>;
export type Room = z.infer<typeof RoomSchema>;
export type Item = z.infer<typeof ItemSchema>;
export type Fixture = z.infer<typeof FixtureSchema>;
export type Clearance = z.infer<typeof ClearanceSchema>;
export type Variant = z.infer<typeof VariantSchema>;
export type Product = z.infer<typeof ProductSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type BuilderId = z.infer<typeof BuilderIdSchema>;
export type Plan = z.infer<typeof PlanSchema>;
```

`src/model/samplePlan.ts`:
```ts
import type { Plan } from './schema';

export function emptyPlanFields(): Pick<Plan, 'items' | 'fixtures' | 'checklist' | 'customProducts'> {
  return { items: [], fixtures: [], checklist: [], customProducts: [] };
}

// 익명 샘플: 600×400cm, 칸막이 하나와 문 하나
export const SAMPLE_PLAN: Plan = {
  version: 1,
  info: { title: '샘플 평면' },
  walls: [
    { id: 'w1', a: { x: 0, y: 0 }, b: { x: 600, y: 0 }, thickness: 20, height: 230 },
    { id: 'w2', a: { x: 600, y: 0 }, b: { x: 600, y: 400 }, thickness: 20, height: 230 },
    { id: 'w3', a: { x: 600, y: 400 }, b: { x: 0, y: 400 }, thickness: 20, height: 230 },
    { id: 'w4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 20, height: 230 },
    { id: 'w5', a: { x: 350, y: 0 }, b: { x: 350, y: 400 }, thickness: 12, height: 230 },
  ],
  openings: [
    { id: 'o1', wallId: 'w5', kind: 'door', offset: 250, width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true },
    { id: 'o2', wallId: 'w1', kind: 'window', offset: 80, width: 180, height: 120, sill: 90, hinge: 'start', swingIn: false },
  ],
  rooms: [
    { id: 'r1', name: '거실', label: { x: 175, y: 200 } },
    { id: 'r2', name: '방', label: { x: 475, y: 200 } },
  ],
  ...emptyPlanFields(),
};
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/model/schema.test.ts`
Expected: 4 passed

- [ ] **Step 5: Commit**

```bash
git add src/model
git commit -m "feat: plan schema and anonymous sample plan"
```

---

### Task 3: OBB 충돌과 벽 기하

**Files:**
- Create: `src/geometry/obb.ts`, `src/geometry/walls.ts`, `src/geometry/bounds.ts`
- Test: `src/geometry/obb.test.ts`, `src/geometry/walls.test.ts`, `src/geometry/bounds.test.ts`

**Interfaces:**
- Consumes: `Vec2`, `Wall`, `Opening`, `Plan` (Task 2)
- Produces:
  - `type OBB = { cx: number; cy: number; hw: number; hd: number; angle: number }` (angle: rad, hw는 로컬 x 반폭, hd는 로컬 y 반폭)
  - `deg2rad(d: number): number`
  - `axes(o: OBB): [Vec2, Vec2]`, `corners(o: OBB): Vec2[]`, `localToWorld(o: OBB, lx: number, ly: number): Vec2`
  - `obbOverlap(a: OBB, b: OBB, eps?: number): boolean` (겹침 깊이가 eps(기본 0.5cm) 이하면 false: 맞닿음은 충돌 아님)
  - `itemObb(x: number, y: number, rotationDeg: number, w: number, d: number): OBB`
  - `wallLength(w: Wall): number`, `wallDir(w: Wall): Vec2`, `wallObb(w: Wall): OBB`
  - `wallSolidObbs(w: Wall, openings: Opening[]): OBB[]` (바닥 높이에서 막힌 구간)
  - `type WallPiece = { obb: OBB; y0: number; y1: number }`, `wallPieces(w: Wall, openings: Opening[]): WallPiece[]`
  - `planWallObbs(plan: Plan): OBB[]`
  - `FLOOR_CUT_SILL_CM = 10`
  - `planBounds(plan: Pick<Plan, 'walls'>): { minX: number; minY: number; maxX: number; maxY: number }`, `planCenter(plan: Pick<Plan, 'walls'>): Vec2` (정수 cm)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/geometry/obb.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { corners, deg2rad, itemObb, obbOverlap, type OBB } from './obb';

const box = (cx: number, cy: number, hw: number, hd: number, deg = 0): OBB => ({ cx, cy, hw, hd, angle: deg2rad(deg) });

describe('obbOverlap', () => {
  it('같은 위치의 사각형은 겹친다', () => {
    expect(obbOverlap(box(0, 0, 10, 10), box(0, 0, 10, 10))).toBe(true);
  });

  it('떨어진 사각형은 겹치지 않는다', () => {
    expect(obbOverlap(box(0, 0, 10, 10), box(30, 0, 10, 10))).toBe(false);
  });

  it('맞닿기만 하면 충돌이 아니다', () => {
    expect(obbOverlap(box(0, 0, 10, 10), box(20, 0, 10, 10))).toBe(false);
  });

  it('AABB는 겹치지만 회전 사각형은 안 겹친다', () => {
    const diagonal = box(0, 0, 50, 5, 45);
    expect(obbOverlap(diagonal, box(30, -30, 5, 5))).toBe(false);
  });

  it('회전 사각형이 대각선 위의 사각형과 겹친다', () => {
    expect(obbOverlap(box(0, 0, 50, 5, 45), box(20, 20, 5, 5))).toBe(true);
  });
});

describe('itemObb', () => {
  it('90° 회전하면 폭과 깊이 방향이 바뀐다', () => {
    const c = corners(itemObb(0, 0, 90, 100, 40));
    const xs = c.map((p) => p.x);
    const ys = c.map((p) => p.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(40);
    expect(Math.max(...ys) - Math.min(...ys)).toBeCloseTo(100);
  });
});
```

`src/geometry/walls.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '../model/schema';
import { wallObb, wallPieces, wallSolidObbs } from './walls';

const wall: Wall = { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 };
const opening = (o: Partial<Opening>): Opening => ({
  id: 'o', wallId: 'w', kind: 'door', offset: 100, width: 80, height: 210, sill: 0, hinge: 'start', swingIn: true, ...o,
});

describe('wallObb', () => {
  it('양 끝을 두께 절반만큼 늘린다', () => {
    const o = wallObb(wall);
    expect(o).toMatchObject({ cx: 200, cy: 0, hw: 205, hd: 5 });
    expect(o.angle).toBeCloseTo(0);
  });

  it('길이 0인 벽도 NaN 없이 처리한다', () => {
    const o = wallObb({ ...wall, b: { x: 0, y: 0 } });
    expect([o.cx, o.cy, o.hw, o.hd, o.angle].every(Number.isFinite)).toBe(true);
  });
});

describe('wallSolidObbs', () => {
  it('문은 벽을 두 구간으로 나눈다', () => {
    const parts = wallSolidObbs(wall, [opening({})]);
    expect(parts).toHaveLength(2);
    expect(parts[0].cx).toBeCloseTo(47.5);
    expect(parts[0].hw).toBeCloseTo(52.5);
    expect(parts[1].cx).toBeCloseTo(292.5);
    expect(parts[1].hw).toBeCloseTo(112.5);
  });

  it('창턱이 높은 창은 바닥에서 벽을 끊지 않는다', () => {
    expect(wallSolidObbs(wall, [opening({ kind: 'window', sill: 90, height: 120 })])).toHaveLength(1);
  });

  it('창턱이 10cm 미만인 창(발코니 미닫이)은 벽을 끊는다', () => {
    expect(wallSolidObbs(wall, [opening({ kind: 'window', sill: 0 })])).toHaveLength(2);
  });
});

describe('wallPieces', () => {
  it('창은 좌우 전체높이 + 창 아래 + 창 위 조각을 만든다', () => {
    const pieces = wallPieces(wall, [opening({ kind: 'window', offset: 100, width: 100, sill: 90, height: 120 })]);
    expect(pieces).toHaveLength(4);
    const below = pieces.find((p) => p.y0 === 0 && p.y1 === 90);
    const above = pieces.find((p) => p.y0 === 210 && p.y1 === 230);
    expect(below?.obb.cx).toBeCloseTo(150);
    expect(above?.obb.hw).toBeCloseTo(50);
  });

  it('문은 좌우 전체높이 + 문 위 조각을 만든다', () => {
    const pieces = wallPieces(wall, [opening({})]);
    expect(pieces).toHaveLength(3);
    expect(pieces.some((p) => p.y0 === 210 && p.y1 === 230)).toBe(true);
  });
});
```

`src/geometry/bounds.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { planBounds, planCenter } from './bounds';

describe('planBounds', () => {
  it('벽 끝점으로 범위를 구한다', () => {
    expect(planBounds(SAMPLE_PLAN)).toEqual({ minX: 0, minY: 0, maxX: 600, maxY: 400 });
    expect(planCenter(SAMPLE_PLAN)).toEqual({ x: 300, y: 200 });
  });

  it('벽이 없으면 기본 600×400 범위를 쓴다', () => {
    expect(planBounds({ ...SAMPLE_PLAN, walls: [] })).toEqual({ minX: 0, minY: 0, maxX: 600, maxY: 400 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/geometry`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/geometry/obb.ts`:
```ts
import type { Vec2 } from '../model/schema';

export type OBB = { cx: number; cy: number; hw: number; hd: number; angle: number };

export const deg2rad = (d: number) => (d * Math.PI) / 180;

export function axes(o: OBB): [Vec2, Vec2] {
  const c = Math.cos(o.angle);
  const s = Math.sin(o.angle);
  return [{ x: c, y: s }, { x: -s, y: c }];
}

export function localToWorld(o: OBB, lx: number, ly: number): Vec2 {
  const [u, v] = axes(o);
  return { x: o.cx + u.x * lx + v.x * ly, y: o.cy + u.y * lx + v.y * ly };
}

export function corners(o: OBB): Vec2[] {
  return [
    localToWorld(o, -o.hw, -o.hd),
    localToWorld(o, o.hw, -o.hd),
    localToWorld(o, o.hw, o.hd),
    localToWorld(o, -o.hw, o.hd),
  ];
}

function project(points: Vec2[], axis: Vec2): [number, number] {
  let min = Infinity;
  let max = -Infinity;
  for (const p of points) {
    const t = p.x * axis.x + p.y * axis.y;
    if (t < min) min = t;
    if (t > max) max = t;
  }
  return [min, max];
}

export function obbOverlap(a: OBB, b: OBB, eps = 0.5): boolean {
  const ca = corners(a);
  const cb = corners(b);
  for (const axis of [...axes(a), ...axes(b)]) {
    const [amin, amax] = project(ca, axis);
    const [bmin, bmax] = project(cb, axis);
    if (Math.min(amax, bmax) - Math.max(amin, bmin) <= eps) return false;
  }
  return true;
}

export function itemObb(x: number, y: number, rotationDeg: number, w: number, d: number): OBB {
  return { cx: x, cy: y, hw: w / 2, hd: d / 2, angle: deg2rad(rotationDeg) };
}
```

`src/geometry/walls.ts`:
```ts
import type { Opening, Plan, Vec2, Wall } from '../model/schema';
import type { OBB } from './obb';

export const FLOOR_CUT_SILL_CM = 10;

export type WallPiece = { obb: OBB; y0: number; y1: number };

export function wallLength(w: Wall): number {
  return Math.hypot(w.b.x - w.a.x, w.b.y - w.a.y);
}

export function wallDir(w: Wall): Vec2 {
  const len = wallLength(w);
  if (len === 0) return { x: 1, y: 0 };
  return { x: (w.b.x - w.a.x) / len, y: (w.b.y - w.a.y) / len };
}

// 벽 중심선 위 [s, e] 구간(a점 기준 cm)을 사각형으로
function segmentObb(w: Wall, s: number, e: number): OBB {
  const u = wallDir(w);
  const mid = (s + e) / 2;
  return {
    cx: w.a.x + u.x * mid,
    cy: w.a.y + u.y * mid,
    hw: (e - s) / 2,
    hd: w.thickness / 2,
    angle: Math.atan2(u.y, u.x),
  };
}

export function wallObb(w: Wall): OBB {
  return segmentObb(w, -w.thickness / 2, wallLength(w) + w.thickness / 2);
}

function clampToWall(o: Opening, len: number): [number, number] {
  return [Math.max(0, o.offset), Math.min(len, o.offset + o.width)];
}

function solidIntervals(w: Wall, cuts: Opening[]): [number, number][] {
  const len = wallLength(w);
  const lo = -w.thickness / 2;
  const hi = len + w.thickness / 2;
  const sorted = cuts
    .map((o) => clampToWall(o, len))
    .filter(([s, e]) => e > s)
    .sort((p, q) => p[0] - q[0]);
  const result: [number, number][] = [];
  let cursor = lo;
  for (const [s, e] of sorted) {
    if (s > cursor) result.push([cursor, s]);
    cursor = Math.max(cursor, e);
  }
  if (hi > cursor) result.push([cursor, hi]);
  return result.filter(([s, e]) => e - s > 0.01);
}

export function wallSolidObbs(w: Wall, openings: Opening[]): OBB[] {
  if (wallLength(w) === 0) return [wallObb(w)];
  const cuts = openings.filter((o) => o.kind !== 'window' || o.sill < FLOOR_CUT_SILL_CM);
  return solidIntervals(w, cuts).map(([s, e]) => segmentObb(w, s, e));
}

export function wallPieces(w: Wall, openings: Opening[]): WallPiece[] {
  const len = wallLength(w);
  if (len === 0) return [{ obb: wallObb(w), y0: 0, y1: w.height }];
  const pieces: WallPiece[] = solidIntervals(w, openings).map(([s, e]) => ({
    obb: segmentObb(w, s, e),
    y0: 0,
    y1: w.height,
  }));
  for (const o of openings) {
    const [s, e] = clampToWall(o, len);
    if (e <= s) continue;
    const obb = segmentObb(w, s, e);
    if (o.sill > 0) pieces.push({ obb, y0: 0, y1: Math.min(o.sill, w.height) });
    const top = o.sill + o.height;
    if (top < w.height) pieces.push({ obb, y0: top, y1: w.height });
  }
  return pieces;
}

export function planWallObbs(plan: Plan): OBB[] {
  return plan.walls.flatMap((w) => wallSolidObbs(w, plan.openings.filter((o) => o.wallId === w.id)));
}
```

`src/geometry/bounds.ts`:
```ts
import type { Plan, Vec2 } from '../model/schema';

export function planBounds(plan: Pick<Plan, 'walls'>) {
  if (plan.walls.length === 0) return { minX: 0, minY: 0, maxX: 600, maxY: 400 };
  const pts = plan.walls.flatMap((w) => [w.a, w.b]);
  return {
    minX: Math.min(...pts.map((p) => p.x)),
    minY: Math.min(...pts.map((p) => p.y)),
    maxX: Math.max(...pts.map((p) => p.x)),
    maxY: Math.max(...pts.map((p) => p.y)),
  };
}

export function planCenter(plan: Pick<Plan, 'walls'>): Vec2 {
  const b = planBounds(plan);
  return { x: Math.round((b.minX + b.maxX) / 2), y: Math.round((b.minY + b.maxY) / 2) };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/geometry`
Expected: 모두 PASS (obb 6, walls 7, bounds 2)

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: OBB collision and wall geometry"
```

---

### Task 4: 문 열림 영역, 벽 거리, 벽 스냅

**Files:**
- Create: `src/geometry/clearance.ts`, `src/geometry/distance.ts`, `src/geometry/snap.ts`
- Test: `src/geometry/clearance.test.ts`, `src/geometry/distance.test.ts`, `src/geometry/snap.test.ts`

**Interfaces:**
- Consumes: `OBB`, `axes`, `corners`, `localToWorld`, `itemObb`, `wallDir`, `wallLength` (Task 3), `Item`, `Product`, `Plan` (Task 2)
- Produces:
  - `type ClearanceShape = { kind: 'rect'; obb: OBB } | { kind: 'sector'; center: Vec2; radius: number; start: number; end: number; obb: OBB }` (각도는 2D 좌표계 rad, `start < end`; `obb`는 충돌용 반지름×반지름 정사각형)
  - `itemClearances(item: Item, product: Product): ClearanceShape[]`
  - `doorSwings(plan: Plan): ClearanceShape[]` (kind `door`인 개구부만)
  - `type DistanceRay = { dir: 'left' | 'right' | 'front' | 'back'; from: Vec2; to: Vec2; distance: number }`
  - `wallDistances(item: OBB, walls: OBB[], maxDist?: number): DistanceRay[]` (distance는 반올림 cm)
  - `WALL_SNAP_CM = 2`, `snapToWalls(item: OBB, walls: OBB[], threshold?: number): { cx: number; cy: number }`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/geometry/clearance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Item, Plan, Product } from '../model/schema';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { doorSwings, itemClearances } from './clearance';

const product = (clearances: Product['clearances']): Product => ({
  id: 'p', brand: 't', model: 'm', name: 'n', category: 'kitchen', dims: { w: 90, d: 70, h: 180 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances, builtIn: false, mount: 'floor',
});
const item: Item = { id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 };

describe('itemClearances', () => {
  it('왼쪽 경첩 문은 앞쪽으로 90° 부채꼴을 만든다', () => {
    const [s] = itemClearances(item, product([{ kind: 'swing', hinge: 'left', radius: 45 }]));
    if (s.kind !== 'sector') throw new Error('sector 기대');
    expect(s.center.x).toBeCloseTo(-45);
    expect(s.center.y).toBeCloseTo(35);
    expect(s.start).toBeCloseTo(0);
    expect(s.end).toBeCloseTo(Math.PI / 2);
    expect(s.obb.cx).toBeCloseTo(-22.5);
    expect(s.obb.cy).toBeCloseTo(57.5);
  });

  it('오른쪽 경첩 문은 반대쪽 사분면을 쓴다', () => {
    const [s] = itemClearances(item, product([{ kind: 'swing', hinge: 'right', radius: 45 }]));
    if (s.kind !== 'sector') throw new Error('sector 기대');
    expect(s.center.x).toBeCloseTo(45);
    expect(s.start).toBeCloseTo(Math.PI / 2);
    expect(s.end).toBeCloseTo(Math.PI);
    expect(s.obb.cx).toBeCloseTo(22.5);
  });

  it('front는 전면에 폭×깊이 사각형을 만든다', () => {
    const [r] = itemClearances(item, product([{ kind: 'front', depth: 60 }]));
    if (r.kind !== 'rect') throw new Error('rect 기대');
    expect(r.obb).toMatchObject({ hw: 45, hd: 30 });
    expect(r.obb.cx).toBeCloseTo(0);
    expect(r.obb.cy).toBeCloseTo(65);
  });
});

describe('doorSwings', () => {
  it('방문은 벽면에서 열림 방향으로 부채꼴을 만든다', () => {
    const plan: Plan = {
      ...SAMPLE_PLAN,
      walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }],
      openings: [{ id: 'o', wallId: 'w', kind: 'door', offset: 100, width: 80, height: 210, sill: 0, hinge: 'start', swingIn: true }],
    };
    const [s] = doorSwings(plan);
    if (s.kind !== 'sector') throw new Error('sector 기대');
    expect(s.center).toEqual({ x: 100, y: 5 });
    expect(s.obb.cx).toBeCloseTo(140);
    expect(s.obb.cy).toBeCloseTo(45);
  });

  it('창과 개구부는 부채꼴을 만들지 않는다', () => {
    expect(doorSwings({ ...SAMPLE_PLAN, openings: SAMPLE_PLAN.openings.filter((o) => o.kind !== 'door') })).toEqual([]);
  });
});
```

`src/geometry/distance.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Wall } from '../model/schema';
import { itemObb } from './obb';
import { wallObb } from './walls';
import { wallDistances } from './distance';

const room: Wall[] = [
  { id: '1', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 },
  { id: '2', a: { x: 400, y: 0 }, b: { x: 400, y: 400 }, thickness: 10, height: 230 },
  { id: '3', a: { x: 400, y: 400 }, b: { x: 0, y: 400 }, thickness: 10, height: 230 },
  { id: '4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 10, height: 230 },
];

describe('wallDistances', () => {
  it('4방향으로 가장 가까운 벽 안쪽 면까지 거리를 잰다', () => {
    const rays = wallDistances(itemObb(200, 200, 0, 100, 60), room.map(wallObb));
    const byDir = Object.fromEntries(rays.map((r) => [r.dir, r.distance]));
    expect(byDir).toEqual({ right: 145, left: 145, front: 165, back: 165 });
  });

  it('벽이 없으면 빈 배열', () => {
    expect(wallDistances(itemObb(0, 0, 0, 10, 10), [])).toEqual([]);
  });
});
```

`src/geometry/snap.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Wall } from '../model/schema';
import { itemObb } from './obb';
import { wallObb } from './walls';
import { snapToWalls } from './snap';

const walls: Wall[] = [
  { id: '1', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 },
  { id: '4', a: { x: 0, y: 400 }, b: { x: 0, y: 0 }, thickness: 10, height: 230 },
];
const obbs = walls.map(wallObb);

describe('snapToWalls', () => {
  it('벽면에서 2cm 이내면 밀착시킨다', () => {
    expect(snapToWalls(itemObb(200, 36.5, 0, 100, 60), obbs)).toEqual({ cx: 200, cy: 35 });
  });

  it('살짝 파고든 경우에도 벽면으로 밀어낸다', () => {
    expect(snapToWalls(itemObb(200, 34, 0, 100, 60), obbs)).toEqual({ cx: 200, cy: 35 });
  });

  it('2cm보다 멀면 그대로 둔다', () => {
    expect(snapToWalls(itemObb(200, 38, 0, 100, 60), obbs)).toEqual({ cx: 200, cy: 38 });
  });

  it('세로 벽에도 붙는다', () => {
    const r = snapToWalls(itemObb(56.5, 200, 0, 100, 60), obbs);
    expect(r.cx).toBeCloseTo(55);
    expect(r.cy).toBeCloseTo(200);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/geometry/clearance.test.ts src/geometry/distance.test.ts src/geometry/snap.test.ts`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/geometry/clearance.ts`:
```ts
import type { Item, Plan, Product, Vec2 } from '../model/schema';
import { axes, itemObb, localToWorld, type OBB } from './obb';
import { wallDir } from './walls';

export type ClearanceShape =
  | { kind: 'rect'; obb: OBB }
  | { kind: 'sector'; center: Vec2; radius: number; start: number; end: number; obb: OBB };

// hinge에서 closed 방향으로 닫혀 있던 문이 open 방향으로 90° 열린다
function sector(hinge: Vec2, closed: Vec2, open: Vec2, r: number): ClearanceShape {
  // [0, 2π)로 정규화: atan2(-0, -1)은 -π가 된다
  const a = (Math.atan2(closed.y, closed.x) + 2 * Math.PI) % (2 * Math.PI);
  const cross = closed.x * open.y - closed.y * open.x;
  const [start, end] = cross > 0 ? [a, a + Math.PI / 2] : [a - Math.PI / 2, a];
  return {
    kind: 'sector',
    center: hinge,
    radius: r,
    start,
    end,
    obb: {
      cx: hinge.x + (closed.x + open.x) * (r / 2),
      cy: hinge.y + (closed.y + open.y) * (r / 2),
      hw: r / 2,
      hd: r / 2,
      angle: a,
    },
  };
}

export function itemClearances(item: Item, product: Product): ClearanceShape[] {
  const { w, d } = product.dims;
  const fp = itemObb(item.x, item.y, item.rotation, w, d);
  const [u, v] = axes(fp);
  return product.clearances.map((c) => {
    if (c.kind === 'front') {
      const center = localToWorld(fp, 0, d / 2 + c.depth / 2);
      return { kind: 'rect', obb: { cx: center.x, cy: center.y, hw: w / 2, hd: c.depth / 2, angle: fp.angle } };
    }
    if (c.hinge === 'left') return sector(localToWorld(fp, -w / 2, d / 2), u, v, c.radius);
    return sector(localToWorld(fp, w / 2, d / 2), { x: -u.x, y: -u.y }, v, c.radius);
  });
}

export function doorSwings(plan: Plan): ClearanceShape[] {
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  return plan.openings.flatMap((o) => {
    const w = walls.get(o.wallId);
    if (!w || o.kind !== 'door') return [];
    const u = wallDir(w);
    const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
    const along = o.hinge === 'start' ? o.offset : o.offset + o.width;
    const hinge = {
      x: w.a.x + u.x * along + n.x * (w.thickness / 2),
      y: w.a.y + u.y * along + n.y * (w.thickness / 2),
    };
    const closed = o.hinge === 'start' ? u : { x: -u.x, y: -u.y };
    return [sector(hinge, closed, n, o.width)];
  });
}
```

`src/geometry/distance.ts`:
```ts
import type { Vec2 } from '../model/schema';
import { axes, corners, localToWorld, type OBB } from './obb';

export type DistanceRay = { dir: 'left' | 'right' | 'front' | 'back'; from: Vec2; to: Vec2; distance: number };

const cross = (a: Vec2, b: Vec2) => a.x * b.y - a.y * b.x;

function raySegment(p: Vec2, d: Vec2, q1: Vec2, q2: Vec2): number | null {
  const e = { x: q2.x - q1.x, y: q2.y - q1.y };
  const denom = cross(d, e);
  if (Math.abs(denom) < 1e-9) return null;
  const qp = { x: q1.x - p.x, y: q1.y - p.y };
  const t = cross(qp, e) / denom;
  const s = cross(qp, d) / denom;
  return t >= -1e-6 && s >= 0 && s <= 1 ? Math.max(0, t) : null;
}

export function wallDistances(item: OBB, walls: OBB[], maxDist = 2000): DistanceRay[] {
  const [u, v] = axes(item);
  const probes: [DistanceRay['dir'], Vec2, Vec2][] = [
    ['right', localToWorld(item, item.hw, 0), u],
    ['left', localToWorld(item, -item.hw, 0), { x: -u.x, y: -u.y }],
    ['front', localToWorld(item, 0, item.hd), v],
    ['back', localToWorld(item, 0, -item.hd), { x: -v.x, y: -v.y }],
  ];
  const edges = walls.flatMap((w) => {
    const c = corners(w);
    return c.map((p, i) => [p, c[(i + 1) % 4]] as const);
  });
  const rays: DistanceRay[] = [];
  for (const [dir, from, d] of probes) {
    let best = Infinity;
    for (const [q1, q2] of edges) {
      const t = raySegment(from, d, q1, q2);
      if (t !== null && t < best) best = t;
    }
    if (best <= maxDist) {
      rays.push({ dir, from, to: { x: from.x + d.x * best, y: from.y + d.y * best }, distance: Math.round(best) });
    }
  }
  return rays;
}
```

`src/geometry/snap.ts`:
```ts
import { axes, corners, type OBB } from './obb';

export const WALL_SNAP_CM = 2;

const dot = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x * b.x + a.y * b.y;

export function snapToWalls(item: OBB, walls: OBB[], threshold = WALL_SNAP_CM): { cx: number; cy: number } {
  const pts = corners(item);
  const center = { x: item.cx, y: item.cy };
  let best: { gap: number; shift: { x: number; y: number } } | null = null;
  for (const w of walls) {
    const [u, n] = axes(w);
    const wc = { x: w.cx, y: w.cy };
    const us = pts.map((p) => dot(p, u));
    const wu = dot(wc, u);
    if (Math.min(Math.max(...us), wu + w.hw) - Math.max(Math.min(...us), wu - w.hw) <= 0) continue;
    const ns = pts.map((p) => dot(p, n));
    const wn = dot(wc, n);
    const onPositive = dot(center, n) > wn;
    const gap = onPositive ? Math.min(...ns) - (wn + w.hd) : wn - w.hd - Math.max(...ns);
    if (Math.abs(gap) > threshold) continue;
    if (best && Math.abs(best.gap) <= Math.abs(gap)) continue;
    const k = onPositive ? -gap : gap;
    best = { gap, shift: { x: n.x * k, y: n.y * k } };
  }
  if (!best) return { cx: item.cx, cy: item.cy };
  return { cx: item.cx + best.shift.x, cy: item.cy + best.shift.y };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/geometry`
Expected: 모두 PASS. 부동소수 결과(`toEqual({cx: 200, cy: 35})`)가 1e-12 수준으로 어긋나 실패하면 snap 테스트를 `toBeCloseTo`로 바꾸지 말고 `snapToWalls` 반환값을 그대로 둔 채 원인(축 계산)을 먼저 확인한다. 축 정렬 벽에서는 정확히 떨어져야 한다.

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: clearance sectors, wall distances and wall snapping"
```

---

### Task 5: 카탈로그 데이터와 배치 검증

**Files:**
- Create: `src/catalog/products.ts`, `src/validation/validate.ts`
- Test: `src/catalog/products.test.ts`, `src/validation/validate.test.ts`

**Interfaces:**
- Consumes: `Product`, `Plan`, `ProductSchema` (Task 2); `itemObb`, `obbOverlap` (Task 3); `planWallObbs` (Task 3); `itemClearances`, `doorSwings` (Task 4)
- Produces:
  - `CATALOG: Product[]`, `findProduct(plan: Plan, productId: string): Product | undefined`
  - `CATEGORY_ORDER: Category[]`, `CATEGORY_LABEL: Record<Category, string>`
  - `type ItemStatus = { collides: boolean; clearanceBlocked: boolean; blocksDoor: boolean }`
  - `validatePlan(plan: Plan, resolve: (productId: string) => Product | undefined): Record<string, ItemStatus>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/catalog/products.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { ProductSchema } from '../model/schema';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { CATALOG, findProduct } from './products';

describe('CATALOG', () => {
  it('모든 제품이 스키마를 통과하고 id가 고유하다', () => {
    for (const p of CATALOG) expect(ProductSchema.safeParse(p).success, p.id).toBe(true);
    expect(new Set(CATALOG.map((p) => p.id)).size).toBe(CATALOG.length);
  });

  it('findProduct는 사용자 정의 제품을 먼저 찾는다', () => {
    const custom = { ...CATALOG[0], id: 'custom-1', name: '내 박스' };
    const plan = { ...SAMPLE_PLAN, customProducts: [custom] };
    expect(findProduct(plan, 'custom-1')?.name).toBe('내 박스');
    expect(findProduct(plan, CATALOG[0].id)?.id).toBe(CATALOG[0].id);
    expect(findProduct(plan, 'nope')).toBeUndefined();
  });
});
```

`src/validation/validate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Item, Plan, Product } from '../model/schema';
import { emptyPlanFields } from '../model/samplePlan';
import { validatePlan } from './validate';

const base = (over: Partial<Product>): Product => ({
  id: 'x', brand: 't', model: 'm', name: 'n', category: 'kitchen', dims: { w: 91, d: 93, h: 185 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances: [], builtIn: false, mount: 'floor', ...over,
});
const products: Record<string, Product> = {
  fridge: base({ id: 'fridge', clearances: [{ kind: 'swing', hinge: 'left', radius: 45 }, { kind: 'swing', hinge: 'right', radius: 45 }] }),
  bench: base({ id: 'bench', dims: { w: 100, d: 50, h: 45 } }),
  cube: base({ id: 'cube', dims: { w: 50, d: 50, h: 50 } }),
  tv: base({ id: 'tv', dims: { w: 160, d: 3, h: 90 }, mount: 'wall' }),
};
const resolve = (id: string) => products[id];
const item = (id: string, productId: string, x: number, y: number, rotation = 0): Item => ({ id, productId, variantId: 'v', x, y, rotation });
const plan = (over: Partial<Plan>): Plan => ({
  version: 1, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields(), ...over,
});

describe('validatePlan', () => {
  it('겹친 두 아이템은 둘 다 충돌', () => {
    const s = validatePlan(plan({ items: [item('a', 'fridge', 100, 100), item('b', 'fridge', 150, 100)] }), resolve);
    expect(s.a.collides).toBe(true);
    expect(s.b.collides).toBe(true);
  });

  it('냉장고 문 앞을 막으면 냉장고의 clearanceBlocked만 켜진다', () => {
    const s = validatePlan(plan({ items: [item('a', 'fridge', 100, 100), item('b', 'bench', 100, 175)] }), resolve);
    expect(s.a).toEqual({ collides: false, clearanceBlocked: true, blocksDoor: false });
    expect(s.b).toEqual({ collides: false, clearanceBlocked: false, blocksDoor: false });
  });

  it('벽을 파고들면 충돌', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20, height: 230 }];
    const s = validatePlan(plan({ walls, items: [item('a', 'cube', 100, 20)] }), resolve);
    expect(s.a.collides).toBe(true);
  });

  it('벽걸이 TV는 바닥 가구와 겹쳐도 충돌이 아니다', () => {
    const s = validatePlan(plan({ items: [item('t', 'tv', 100, 100), item('b', 'bench', 100, 100)] }), resolve);
    expect(s.t.collides).toBe(false);
    expect(s.b.collides).toBe(false);
  });

  it('방문 열림 영역 안의 아이템은 blocksDoor', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 100, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true }];
    const s = validatePlan(plan({ walls, openings, items: [item('a', 'cube', 140, 60)] }), resolve);
    expect(s.a).toEqual({ collides: false, clearanceBlocked: false, blocksDoor: true });
  });

  it('알 수 없는 제품은 오류 없이 상태 false이고 다른 아이템에 영향을 주지 않는다', () => {
    const s = validatePlan(plan({ items: [item('a', 'missing', 100, 100), item('b', 'cube', 100, 100)] }), resolve);
    expect(s.a).toEqual({ collides: false, clearanceBlocked: false, blocksDoor: false });
    expect(s.b.collides).toBe(false);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/catalog src/validation`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/catalog/products.ts`:
```ts
import type { Category, Plan, Product } from '../model/schema';

export const CATEGORY_ORDER: Category[] = ['kitchen', 'laundry', 'tv', 'climate', 'living', 'furniture', 'custom'];

export const CATEGORY_LABEL: Record<Category, string> = {
  kitchen: '주방가전',
  laundry: '세탁·건조',
  tv: 'TV',
  climate: '냉난방',
  living: '생활가전',
  furniture: '가구',
  custom: '사용자 정의',
};

// 삼성 제품 치수는 샘플 값이다. 계획 4에서 사용자가 준 모델 목록과 공식 사양으로 교체한다.
export const CATALOG: Product[] = [
  {
    id: 'samsung-bespoke-4door-sample',
    brand: 'samsung',
    model: 'BESPOKE 4도어 (샘플 치수)',
    name: '비스포크 냉장고 4도어',
    category: 'kitchen',
    dims: { w: 91, d: 93, h: 185 },
    variants: [
      { id: 'satin-white', label: '새틴 화이트', colors: { panel: '#e9e6df', body: '#c9c9c9' } },
      { id: 'glam-navy', label: '글램 네이비', colors: { panel: '#2b3446', body: '#c9c9c9' } },
    ],
    builder: 'fridge',
    builderParams: { split: '4door', topRatio: 0.58 },
    clearances: [
      { kind: 'swing', hinge: 'left', radius: 45 },
      { kind: 'swing', hinge: 'right', radius: 45 },
    ],
    power: { watts: 300, dedicatedCircuit: false },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-grande-washer-sample',
    brand: 'samsung',
    model: '그랑데 세탁기 (샘플 치수)',
    name: '그랑데 드럼세탁기',
    category: 'laundry',
    dims: { w: 70, d: 85, h: 110 },
    variants: [{ id: 'white', label: '화이트', colors: { body: '#eeeeee', door: '#3a404a' } }],
    builder: 'front-loader',
    clearances: [{ kind: 'front', depth: 60 }],
    power: { watts: 2000, dedicatedCircuit: true },
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'samsung-tv-75-sample',
    brand: 'samsung',
    model: '75인치 TV (샘플 치수)',
    name: '75인치 벽걸이 TV',
    category: 'tv',
    dims: { w: 167, d: 3, h: 96 },
    variants: [{ id: 'black', label: '블랙', colors: { frame: '#1d1d1f', screen: '#0b0c10' } }],
    builder: 'tv',
    builderParams: { mountHeight: 90 },
    clearances: [],
    power: { watts: 250, dedicatedCircuit: false },
    builtIn: false,
    mount: 'wall',
  },
  {
    id: 'sofa-3seat',
    brand: 'generic',
    model: '',
    name: '3인 소파',
    category: 'furniture',
    dims: { w: 210, d: 90, h: 80 },
    variants: [{ id: 'gray', label: '그레이', colors: { fabric: '#8a8f98' } }],
    builder: 'sofa',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'bed-queen',
    brand: 'generic',
    model: '',
    name: '퀸 침대',
    category: 'furniture',
    dims: { w: 165, d: 215, h: 100 },
    variants: [{ id: 'oak', label: '오크', colors: { frame: '#b08a62', mattress: '#f4f1ea' } }],
    builder: 'bed',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
  {
    id: 'table-dining-4',
    brand: 'generic',
    model: '',
    name: '4인 식탁',
    category: 'furniture',
    dims: { w: 140, d: 80, h: 74 },
    variants: [{ id: 'oak', label: '오크', colors: { wood: '#b08a62' } }],
    builder: 'table',
    clearances: [],
    builtIn: false,
    mount: 'floor',
  },
];

export function findProduct(plan: Plan, productId: string): Product | undefined {
  return plan.customProducts.find((p) => p.id === productId) ?? CATALOG.find((p) => p.id === productId);
}
```

`src/validation/validate.ts`:
```ts
import { itemClearances, doorSwings } from '../geometry/clearance';
import { itemObb, obbOverlap, type OBB } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import type { Plan, Product } from '../model/schema';

export type ItemStatus = { collides: boolean; clearanceBlocked: boolean; blocksDoor: boolean };

const OK: ItemStatus = { collides: false, clearanceBlocked: false, blocksDoor: false };

export function validatePlan(plan: Plan, resolve: (productId: string) => Product | undefined): Record<string, ItemStatus> {
  const walls = planWallObbs(plan);
  const doors = doorSwings(plan).map((s) => s.obb);
  const placed = plan.items.flatMap((item) => {
    const product = resolve(item.productId);
    if (!product) return [];
    return [{ item, product, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }];
  });
  const floor = placed.filter((p) => p.product.mount === 'floor');
  const hitsAny = (shape: OBB, others: OBB[]) => others.some((o) => obbOverlap(shape, o));

  const result: Record<string, ItemStatus> = {};
  for (const item of plan.items) result[item.id] = OK;
  for (const p of placed) {
    if (p.product.mount === 'wall') {
      result[p.item.id] = { ...OK, collides: hitsAny(p.fp, walls) };
      continue;
    }
    const others = floor.filter((o) => o.item.id !== p.item.id).map((o) => o.fp);
    const clearances = itemClearances(p.item, p.product).map((c) => c.obb);
    result[p.item.id] = {
      collides: hitsAny(p.fp, walls) || hitsAny(p.fp, others),
      clearanceBlocked: clearances.some((c) => hitsAny(c, walls) || hitsAny(c, others)),
      blocksDoor: hitsAny(p.fp, doors),
    };
  }
  return result;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/catalog src/validation`
Expected: 8 passed

- [ ] **Step 5: Commit**

```bash
git add src/catalog/products.ts src/catalog/products.test.ts src/validation
git commit -m "feat: sample catalog and placement validation"
```

---

### Task 6: 절차적 형상 builder

**Files:**
- Create: `src/catalog/builders/parts.ts`, `src/catalog/builders/box.ts`, `fridge.ts`, `frontLoader.ts`, `tv.ts`, `sofa.ts`, `bed.ts`, `table.ts`, `src/catalog/builders/index.ts`
- Test: `src/catalog/builders/builders.test.ts`

**Interfaces:**
- Consumes: `Product`, `Variant`, `BuilderId` (Task 2), `CATALOG` (Task 5)
- Produces:
  - `type Builder = (p: Product, v: Variant) => THREE.Group` (단위 m, 바닥 중심이 원점, 바닥 y=0, 전면 +z, 경계 상자 = dims/100)
  - `buildProduct(p: Product, variantId: string): THREE.Group` (builder가 없으면 `box`로 폴백, variant가 없으면 첫 번째 variant)
  - `mountHeightCm(p: Product): number` (`mount: 'wall'`이면 `builderParams.mountHeight` 기본 90, 아니면 0)
  - `disposeObject(o: THREE.Object3D): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/catalog/builders/builders.test.ts`:
```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import type { Product } from '../../model/schema';
import { CATALOG } from '../products';
import { buildProduct, mountHeightCm } from './index';

function bounds(p: Product) {
  const g = buildProduct(p, p.variants[0].id);
  g.updateMatrixWorld(true);
  return new THREE.Box3().setFromObject(g);
}

describe('buildProduct', () => {
  for (const p of CATALOG) {
    it(`${p.id}: 경계 상자가 실제 치수와 같고 바닥에 놓인다`, () => {
      const b = bounds(p);
      const size = b.getSize(new THREE.Vector3());
      expect(size.x).toBeCloseTo(p.dims.w / 100, 4);
      expect(size.y).toBeCloseTo(p.dims.h / 100, 4);
      expect(size.z).toBeCloseTo(p.dims.d / 100, 4);
      expect(b.min.y).toBeCloseTo(0, 4);
      expect(b.min.x).toBeCloseTo(-p.dims.w / 200, 4);
      expect(b.min.z).toBeCloseTo(-p.dims.d / 200, 4);
    });
  }

  it('builder가 아직 없는 제품은 박스로 그린다', () => {
    const p: Product = { ...CATALOG[0], id: 'ac', builder: 'stand-ac', dims: { w: 40, d: 40, h: 180 } };
    const size = bounds(p).getSize(new THREE.Vector3());
    expect(size.y).toBeCloseTo(1.8, 4);
  });

  it('variant id가 없으면 첫 번째 variant로 그린다', () => {
    expect(() => buildProduct(CATALOG[0], 'missing')).not.toThrow();
  });

  it('벽걸이 제품만 설치 높이를 갖는다', () => {
    expect(mountHeightCm(CATALOG.find((p) => p.mount === 'wall')!)).toBe(90);
    expect(mountHeightCm(CATALOG[0])).toBe(0);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/catalog/builders`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/catalog/builders/parts.ts`:
```ts
import * as THREE from 'three';

const materials = new Map<string, THREE.MeshStandardMaterial>();

export function material(color: string): THREE.MeshStandardMaterial {
  let m = materials.get(color);
  if (!m) {
    m = new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0.05 });
    materials.set(color, m);
  }
  return m;
}

// 크기(w,h,d)와 중심(x,y,z) 모두 m
export function box(w: number, h: number, d: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material(color));
  mesh.position.set(x, y, z);
  return mesh;
}

// 전면(+z)을 바라보는 원판
export function disc(r: number, thickness: number, color: string, x: number, y: number, z: number): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, thickness, 32), material(color));
  mesh.rotation.x = Math.PI / 2;
  mesh.position.set(x, y, z);
  return mesh;
}

export function group(...children: THREE.Object3D[]): THREE.Group {
  const g = new THREE.Group();
  g.add(...children);
  return g;
}

export function color(colors: Record<string, string>, key: string, fallback: string): string {
  return colors[key] ?? fallback;
}

export function meters(dims: { w: number; d: number; h: number }) {
  return { W: dims.w / 100, D: dims.d / 100, H: dims.h / 100 };
}
```

`src/catalog/builders/box.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

export function buildBox(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  return group(box(W, H, D, color(v.colors, 'body', '#c8b8a0'), 0, H / 2, 0));
}
```

`src/catalog/builders/fridge.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const PANEL = 0.02;
const GAP = 0.004;

export function buildFridge(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const split = (p.builderParams?.split as string | undefined) ?? '4door';
  const topRatio = (p.builderParams?.topRatio as number | undefined) ?? 0.6;
  const panel = color(v.colors, 'panel', '#e5e5e5');
  const body = box(W, H, D - PANEL, color(v.colors, 'body', '#cccccc'), 0, H / 2, -PANEL / 2);
  const z = D / 2 - PANEL / 2;
  const panels =
    split === '1door'
      ? [box(W - GAP, H - GAP, PANEL, panel, 0, H / 2, z)]
      : split === '2door'
        ? [
            box(W - GAP, H * topRatio - GAP, PANEL, panel, 0, H * (1 - topRatio) + (H * topRatio) / 2, z),
            box(W - GAP, H * (1 - topRatio) - GAP, PANEL, panel, 0, (H * (1 - topRatio)) / 2, z),
          ]
        : (() => {
            const topH = H * topRatio;
            const botH = H - topH;
            return [-1, 1].flatMap((side) => [
              box(W / 2 - GAP, topH - GAP, PANEL, panel, (side * W) / 4, botH + topH / 2, z),
              box(W / 2 - GAP, botH - GAP, PANEL, panel, (side * W) / 4, botH / 2, z),
            ]);
          })();
  return group(body, ...panels);
}
```

`src/catalog/builders/frontLoader.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, disc, group, meters } from './parts';

const DOOR = 0.015;

export function buildFrontLoader(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const r = Math.min(W * 0.32, H * 0.4);
  return group(
    box(W, H, D - DOOR, color(v.colors, 'body', '#eeeeee'), 0, H / 2, -DOOR / 2),
    disc(r, DOOR, color(v.colors, 'door', '#3a404a'), 0, H * 0.45, D / 2 - DOOR / 2),
  );
}
```

`src/catalog/builders/tv.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const SCREEN = 0.001;

export function buildTv(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const bezel = (p.builderParams?.bezel as number | undefined) ?? 0.01;
  return group(
    box(W, H, D - SCREEN, color(v.colors, 'frame', '#1d1d1f'), 0, H / 2, -SCREEN / 2),
    box(W - 2 * bezel, H - 2 * bezel, SCREEN, color(v.colors, 'screen', '#0b0c10'), 0, H / 2, D / 2 - SCREEN / 2),
  );
}
```

`src/catalog/builders/sofa.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

export function buildSofa(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const fabric = color(v.colors, 'fabric', '#8a8f98');
  const seatH = H * 0.5;
  const backD = D * 0.25;
  const armW = W * 0.08;
  return group(
    box(W, seatH, D, fabric, 0, seatH / 2, 0),
    box(W, H, backD, fabric, 0, H / 2, -D / 2 + backD / 2),
    box(armW, H * 0.75, D, fabric, -W / 2 + armW / 2, (H * 0.75) / 2, 0),
    box(armW, H * 0.75, D, fabric, W / 2 - armW / 2, (H * 0.75) / 2, 0),
  );
}
```

`src/catalog/builders/bed.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

export function buildBed(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const frame = color(v.colors, 'frame', '#b08a62');
  const frameH = Math.min(0.25, H * 0.4);
  const mattressH = Math.min(0.2, H - frameH);
  const head = 0.06;
  return group(
    box(W, frameH, D, frame, 0, frameH / 2, 0),
    box(W - 0.04, mattressH, D - head - 0.04, color(v.colors, 'mattress', '#f4f1ea'), 0, frameH + mattressH / 2, head / 2),
    box(W, H, head, frame, 0, H / 2, -D / 2 + head / 2),
  );
}
```

`src/catalog/builders/table.ts`:
```ts
import type { Product, Variant } from '../../model/schema';
import { box, color, group, meters } from './parts';

const TOP = 0.03;
const LEG = 0.05;

export function buildTable(p: Product, v: Variant) {
  const { W, D, H } = meters(p.dims);
  const wood = color(v.colors, 'wood', '#b08a62');
  const legH = H - TOP;
  const lx = W / 2 - LEG / 2 - 0.03;
  const lz = D / 2 - LEG / 2 - 0.03;
  return group(
    box(W, TOP, D, wood, 0, H - TOP / 2, 0),
    ...[-1, 1].flatMap((sx) => [-1, 1].map((sz) => box(LEG, legH, LEG, wood, sx * lx, legH / 2, sz * lz))),
  );
}
```

`src/catalog/builders/index.ts`:
```ts
import * as THREE from 'three';
import type { BuilderId, Product, Variant } from '../../model/schema';
import { buildBed } from './bed';
import { buildBox } from './box';
import { buildFridge } from './fridge';
import { buildFrontLoader } from './frontLoader';
import { buildSofa } from './sofa';
import { buildTable } from './table';
import { buildTv } from './tv';

export type Builder = (p: Product, v: Variant) => THREE.Group;

const BUILDERS: Partial<Record<BuilderId, Builder>> = {
  box: buildBox,
  fridge: buildFridge,
  'front-loader': buildFrontLoader,
  tv: buildTv,
  sofa: buildSofa,
  bed: buildBed,
  table: buildTable,
};

export function buildProduct(p: Product, variantId: string): THREE.Group {
  const variant = p.variants.find((v) => v.id === variantId) ?? p.variants[0];
  return (BUILDERS[p.builder] ?? buildBox)(p, variant);
}

export function mountHeightCm(p: Product): number {
  if (p.mount !== 'wall') return 0;
  return (p.builderParams?.mountHeight as number | undefined) ?? 90;
}

// 공유 재질(parts.material 캐시)은 해제하지 않고 지오메트리만 해제한다
export function disposeObject(o: THREE.Object3D): void {
  o.traverse((child) => {
    if (child instanceof THREE.Mesh) child.geometry.dispose();
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/catalog/builders`
Expected: CATALOG 6개 + 3개 = 9 passed

- [ ] **Step 5: Commit**

```bash
git add src/catalog/builders
git commit -m "feat: procedural product builders with exact bounding boxes"
```

---

### Task 7: 스토어(히스토리, 드래그 트랜잭션)

**Files:**
- Create: `src/model/store.ts`, `src/model/StoreContext.tsx`, `src/model/useValidation.ts`
- Test: `src/model/store.test.ts`

**Interfaces:**
- Consumes: `Plan`, `Item`, `Product`, `Vec2` (Task 2), `findProduct`, `validatePlan` (Task 5)
- Produces:
  - `type PlanState` (아래 코드 참고), `createPlanStore(initial: Plan): StoreApi<PlanState>`, `HISTORY_LIMIT = 100`
  - `PlanStoreContext`, `usePlanStore(): StoreApi<PlanState>`, `usePlan<T>(selector: (s: PlanState) => T): T`
  - `useValidation(): Record<string, ItemStatus>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/store.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from './samplePlan';
import { createPlanStore, HISTORY_LIMIT } from './store';

const P = 'samsung-bespoke-4door-sample';
const V = 'satin-white';

describe('createPlanStore', () => {
  it('addItem은 정수 좌표로 추가하고 선택한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 100.6, y: 50.2 });
    const st = s.getState();
    expect(st.plan.items).toEqual([{ id, productId: P, variantId: V, x: 101, y: 50, rotation: 0 }]);
    expect(st.selectedId).toBe(id);
  });

  it('undo/redo가 동작하고 새 변경은 redo를 비운다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { x: 10 });
    s.getState().undo();
    expect(s.getState().plan.items[0].x).toBe(0);
    s.getState().redo();
    expect(s.getState().plan.items[0].x).toBe(10);
    s.getState().undo();
    s.getState().rotateItem(id, 90);
    expect(s.getState().future).toEqual([]);
  });

  it('드래그 전체가 실행 취소 한 번으로 되돌아간다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    const pastBefore = s.getState().past.length;
    s.getState().beginDrag();
    for (let i = 1; i <= 30; i++) s.getState().dragItem(id, i * 3, i);
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(pastBefore + 1);
    expect(s.getState().plan.items[0]).toMatchObject({ x: 90, y: 30 });
    s.getState().undo();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 0, y: 0 });
  });

  it('움직이지 않은 드래그는 히스토리를 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 0, y: 0 });
    const n = s.getState().past.length;
    s.getState().beginDrag();
    s.getState().endDrag();
    expect(s.getState().past.length).toBe(n);
  });

  it('rotateItem은 0~360으로 정규화한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().rotateItem(id, -90);
    expect(s.getState().plan.items[0].rotation).toBe(270);
  });

  it('duplicateItem은 20cm 옆에 복제하고 선택한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 100, y: 100 });
    const copy = s.getState().duplicateItem(id)!;
    expect(s.getState().plan.items.find((i) => i.id === copy)).toMatchObject({ x: 120, y: 120 });
    expect(s.getState().selectedId).toBe(copy);
  });

  it('removeItem은 선택을 해제한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().removeItem(id);
    expect(s.getState().plan.items).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('addCustomProduct는 박스 제품을 만든다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const pid = s.getState().addCustomProduct({ name: '김치냉장고 자리', w: 70, d: 80, h: 90 });
    expect(s.getState().plan.customProducts[0]).toMatchObject({ id: pid, builder: 'box', category: 'custom', dims: { w: 70, d: 80, h: 90 } });
  });

  it('loadPlan은 히스토리와 선택을 초기화한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().loadPlan(SAMPLE_PLAN);
    expect(s.getState()).toMatchObject({ past: [], future: [], selectedId: null });
  });

  it(`히스토리는 ${HISTORY_LIMIT}개까지만 보관한다`, () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    for (let i = 0; i < HISTORY_LIMIT + 20; i++) s.getState().updateItem(id, { x: i + 1 });
    expect(s.getState().past.length).toBe(HISTORY_LIMIT);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model/store.test.ts`
Expected: FAIL — `Cannot find module './store'`

- [ ] **Step 3: 구현**

`src/model/store.ts`:
```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import type { Item, Plan, Product, Vec2 } from './schema';

export const HISTORY_LIMIT = 100;

export type PlanState = {
  plan: Plan;
  selectedId: string | null;
  past: Plan[];
  future: Plan[];
  dragOrigin: Plan | null;
  loadPlan(plan: Plan): void;
  select(id: string | null): void;
  addItem(productId: string, variantId: string, pos: Vec2): string;
  updateItem(id: string, patch: Partial<Omit<Item, 'id'>>): void;
  removeItem(id: string): void;
  duplicateItem(id: string): string | null;
  rotateItem(id: string, deltaDeg: number): void;
  beginDrag(): void;
  dragItem(id: string, x: number, y: number): void;
  endDrag(): void;
  addCustomProduct(input: { name: string; w: number; d: number; h: number }): string;
  undo(): void;
  redo(): void;
};

const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
const normalizeDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;

function normalizeItem(item: Item): Item {
  return { ...item, x: Math.round(item.x), y: Math.round(item.y), rotation: normalizeDeg(item.rotation) };
}

export function createPlanStore(initial: Plan): StoreApi<PlanState> {
  return createStore<PlanState>()((set, get) => {
    const commit = (plan: Plan, extra: Partial<PlanState> = {}) =>
      set((s) => ({ plan, past: [...s.past, s.plan].slice(-HISTORY_LIMIT), future: [], ...extra }));
    const withItems = (fn: (items: Item[]) => Item[]): Plan => ({ ...get().plan, items: fn(get().plan.items) });

    return {
      plan: initial,
      selectedId: null,
      past: [],
      future: [],
      dragOrigin: null,

      loadPlan: (plan) => set({ plan, past: [], future: [], selectedId: null, dragOrigin: null }),
      select: (id) => set({ selectedId: id }),

      addItem: (productId, variantId, pos) => {
        const item = normalizeItem({ id: newId('item'), productId, variantId, x: pos.x, y: pos.y, rotation: 0 });
        commit(withItems((items) => [...items, item]), { selectedId: item.id });
        return item.id;
      },

      updateItem: (id, patch) =>
        commit(withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, ...patch }) : i)))),

      removeItem: (id) =>
        commit(withItems((items) => items.filter((i) => i.id !== id)), {
          selectedId: get().selectedId === id ? null : get().selectedId,
        }),

      duplicateItem: (id) => {
        const src = get().plan.items.find((i) => i.id === id);
        if (!src) return null;
        const copy = { ...src, id: newId('item'), x: src.x + 20, y: src.y + 20 };
        commit(withItems((items) => [...items, copy]), { selectedId: copy.id });
        return copy.id;
      },

      rotateItem: (id, deltaDeg) => {
        const src = get().plan.items.find((i) => i.id === id);
        if (src) get().updateItem(id, { rotation: src.rotation + deltaDeg });
      },

      beginDrag: () => set({ dragOrigin: get().plan }),

      dragItem: (id, x, y) =>
        set({ plan: withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, x, y }) : i))) }),

      endDrag: () => {
        const { dragOrigin, plan, past } = get();
        if (dragOrigin && dragOrigin !== plan) {
          set({ past: [...past, dragOrigin].slice(-HISTORY_LIMIT), future: [], dragOrigin: null });
        } else {
          set({ dragOrigin: null });
        }
      },

      addCustomProduct: ({ name, w, d, h }) => {
        const product: Product = {
          id: newId('custom'),
          brand: 'custom',
          model: '',
          name,
          category: 'custom',
          dims: { w: Math.round(w), d: Math.round(d), h: Math.round(h) },
          variants: [{ id: 'default', label: '기본', colors: { body: '#c8b8a0' } }],
          builder: 'box',
          clearances: [],
          builtIn: false,
          mount: 'floor',
        };
        commit({ ...get().plan, customProducts: [...get().plan.customProducts, product] });
        return product.id;
      },

      undo: () => {
        const { past, plan, future } = get();
        if (past.length === 0) return;
        set({ plan: past[past.length - 1], past: past.slice(0, -1), future: [plan, ...future] });
      },

      redo: () => {
        const { past, plan, future } = get();
        if (future.length === 0) return;
        set({ plan: future[0], past: [...past, plan], future: future.slice(1) });
      },
    };
  });
}
```

`src/model/StoreContext.tsx`:
```tsx
import { createContext, useContext } from 'react';
import { useStore, type StoreApi } from 'zustand';
import type { PlanState } from './store';

export const PlanStoreContext = createContext<StoreApi<PlanState> | null>(null);

export function usePlanStore(): StoreApi<PlanState> {
  const store = useContext(PlanStoreContext);
  if (!store) throw new Error('PlanStoreContext.Provider가 없습니다');
  return store;
}

export function usePlan<T>(selector: (s: PlanState) => T): T {
  return useStore(usePlanStore(), selector);
}
```

`src/model/useValidation.ts`:
```ts
import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { validatePlan, type ItemStatus } from '../validation/validate';
import { usePlan } from './StoreContext';

export function useValidation(): Record<string, ItemStatus> {
  const plan = usePlan((s) => s.plan);
  return useMemo(() => validatePlan(plan, (id) => findProduct(plan, id)), [plan]);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/model && npm run typecheck`
Expected: store 10 passed, schema 4 passed, typecheck 오류 없음

- [ ] **Step 5: Commit**

```bash
git add src/model
git commit -m "feat: plan store with undo history and drag transactions"
```

---

### Task 8: 저장과 불러오기

**Files:**
- Create: `src/persistence/parse.ts`, `src/persistence/storage.ts`, `src/persistence/file.ts`
- Test: `src/persistence/parse.test.ts`, `src/persistence/storage.test.ts`, `src/persistence/file.test.ts`

**Interfaces:**
- Consumes: `PlanSchema`, `Plan` (Task 2), `createPlanStore`, `PlanState` (Task 7)
- Produces:
  - `type ParseResult = { ok: true; plan: Plan } | { ok: false; error: string }`, `parsePlan(raw: unknown): ParseResult`
  - `STORAGE_KEY = 'homefit:plan:v1'`
  - `loadFromStorage(storage?: Storage): Plan | null`, `saveToStorage(plan: Plan, storage?: Storage): boolean`
  - `startAutosave(store: StoreApi<PlanState>, opts?: { storage?: Storage; delayMs?: number; onResult?: (ok: boolean) => void }): () => void`
  - `planToJson(plan: Plan): string`, `readPlanFile(file: Blob): Promise<ParseResult>`, `downloadText(text: string, filename: string): void`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/persistence/parse.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { parsePlan } from './parse';

describe('parsePlan', () => {
  it('정상 평면은 통과한다', () => {
    expect(parsePlan(JSON.parse(JSON.stringify(SAMPLE_PLAN)))).toEqual({ ok: true, plan: SAMPLE_PLAN });
  });

  it('parsePlan은 버전이 다르면 실패한다', () => {
    const r = parsePlan({ ...SAMPLE_PLAN, version: 2 });
    expect(r).toEqual({ ok: false, error: '지원하지 않는 파일 버전입니다: 2' });
  });

  it('객체가 아니면 실패한다', () => {
    expect(parsePlan('hello').ok).toBe(false);
    expect(parsePlan(null).ok).toBe(false);
  });

  it('필드 오류는 경로를 포함한다', () => {
    const r = parsePlan({ ...SAMPLE_PLAN, walls: [{ ...SAMPLE_PLAN.walls[0], thickness: -1 }] });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain('walls.0.thickness');
  });
});
```

`src/persistence/storage.test.ts`:
```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { loadFromStorage, saveToStorage, startAutosave, STORAGE_KEY } from './storage';

function memoryStorage(): Storage {
  const m = new Map<string, string>();
  return {
    get length() { return m.size; },
    clear: () => m.clear(),
    getItem: (k) => m.get(k) ?? null,
    key: (i) => [...m.keys()][i] ?? null,
    removeItem: (k) => void m.delete(k),
    setItem: (k, v) => void m.set(k, v),
  };
}

function throwingStorage(): Storage {
  const s = memoryStorage();
  s.getItem = () => { throw new Error('SecurityError'); };
  s.setItem = () => { throw new Error('QuotaExceededError'); };
  return s;
}

afterEach(() => vi.useRealTimers());

describe('storage', () => {
  it('저장한 평면을 다시 읽는다', () => {
    const st = memoryStorage();
    expect(saveToStorage(SAMPLE_PLAN, st)).toBe(true);
    expect(loadFromStorage(st)).toEqual(SAMPLE_PLAN);
  });

  it('저장소가 throw하면 null/false를 돌려준다', () => {
    const st = throwingStorage();
    expect(loadFromStorage(st)).toBeNull();
    expect(saveToStorage(SAMPLE_PLAN, st)).toBe(false);
  });

  it('깨진 데이터는 null', () => {
    const st = memoryStorage();
    st.setItem(STORAGE_KEY, '{not json');
    expect(loadFromStorage(st)).toBeNull();
  });

  it('autosave는 디바운스 후 마지막 상태만 저장하고 결과를 알린다', () => {
    vi.useFakeTimers();
    const st = memoryStorage();
    const store = createPlanStore(SAMPLE_PLAN);
    const results: boolean[] = [];
    const stop = startAutosave(store, { storage: st, delayMs: 500, onResult: (ok) => results.push(ok) });
    const id = store.getState().addItem('p', 'v', { x: 0, y: 0 });
    store.getState().updateItem(id, { x: 50 });
    vi.advanceTimersByTime(499);
    expect(st.getItem(STORAGE_KEY)).toBeNull();
    vi.advanceTimersByTime(1);
    expect(loadFromStorage(st)?.items[0].x).toBe(50);
    expect(results).toEqual([true]);
    stop();
  });

  it('autosave 저장 실패를 알린다', () => {
    vi.useFakeTimers();
    const store = createPlanStore(SAMPLE_PLAN);
    const results: boolean[] = [];
    startAutosave(store, { storage: throwingStorage(), onResult: (ok) => results.push(ok) });
    store.getState().addItem('p', 'v', { x: 0, y: 0 });
    vi.advanceTimersByTime(500);
    expect(results).toEqual([false]);
  });
});
```

`src/persistence/file.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { planToJson, readPlanFile } from './file';

describe('file', () => {
  it('JSON으로 내보낸 평면을 다시 읽는다', async () => {
    const r = await readPlanFile(new Blob([planToJson(SAMPLE_PLAN)]));
    expect(r).toEqual({ ok: true, plan: SAMPLE_PLAN });
  });

  it('readPlanFile은 JSON이 아니면 실패한다', async () => {
    expect(await readPlanFile(new Blob(['<html>']))).toEqual({ ok: false, error: 'JSON 형식이 아닙니다' });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/persistence`
Expected: FAIL — 모듈 없음

- [ ] **Step 3: 구현**

`src/persistence/parse.ts`:
```ts
import { PlanSchema, type Plan } from '../model/schema';

export type ParseResult = { ok: true; plan: Plan } | { ok: false; error: string };

export function parsePlan(raw: unknown): ParseResult {
  if (typeof raw !== 'object' || raw === null) return { ok: false, error: '평면 파일 형식이 아닙니다' };
  const version = (raw as { version?: unknown }).version;
  if (version !== 1) return { ok: false, error: `지원하지 않는 파일 버전입니다: ${String(version)}` };
  const r = PlanSchema.safeParse(raw);
  if (r.success) return { ok: true, plan: r.data };
  const error = r.error.issues
    .slice(0, 3)
    .map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`)
    .join('\n');
  return { ok: false, error };
}
```

`src/persistence/storage.ts`:
```ts
import type { StoreApi } from 'zustand/vanilla';
import type { Plan } from '../model/schema';
import type { PlanState } from '../model/store';
import { parsePlan } from './parse';

export const STORAGE_KEY = 'homefit:plan:v1';

function defaultStorage(): Storage | undefined {
  try {
    return globalThis.localStorage;
  } catch {
    return undefined;
  }
}

export function loadFromStorage(storage: Storage | undefined = defaultStorage()): Plan | null {
  try {
    const raw = storage?.getItem(STORAGE_KEY);
    if (!raw) return null;
    const r = parsePlan(JSON.parse(raw));
    return r.ok ? r.plan : null;
  } catch {
    return null;
  }
}

export function saveToStorage(plan: Plan, storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(STORAGE_KEY, JSON.stringify(plan));
    return true;
  } catch {
    return false;
  }
}

export function startAutosave(
  store: StoreApi<PlanState>,
  opts: { storage?: Storage; delayMs?: number; onResult?: (ok: boolean) => void } = {},
): () => void {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const unsubscribe = store.subscribe((s, prev) => {
    if (s.plan === prev.plan) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      opts.onResult?.(saveToStorage(store.getState().plan, opts.storage ?? defaultStorage()));
    }, opts.delayMs ?? 500);
  });
  return () => {
    clearTimeout(timer);
    unsubscribe();
  };
}
```

`src/persistence/file.ts`:
```ts
import type { Plan } from '../model/schema';
import { parsePlan, type ParseResult } from './parse';

export function planToJson(plan: Plan): string {
  return JSON.stringify(plan, null, 2);
}

export async function readPlanFile(file: Blob): Promise<ParseResult> {
  let raw: unknown;
  try {
    raw = JSON.parse(await file.text());
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다' };
  }
  return parsePlan(raw);
}

export function downloadText(text: string, filename: string): void {
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/persistence`
Expected: 11 passed

- [ ] **Step 5: Commit**

```bash
git add src/persistence
git commit -m "feat: plan parsing, autosave and json file io"
```

---

### Task 9: 3D 뷰포트(벽, 아이템, 드래그, 검증 오버레이)

**Files:**
- Create: `src/ui/uiStore.ts`, `src/ui/dnd.ts`, `src/scene3d/units.ts`, `src/scene3d/DropBridge.tsx`, `src/scene3d/Floor.tsx`, `src/scene3d/Walls3D.tsx`, `src/scene3d/Items3D.tsx`, `src/scene3d/Overlays.tsx`, `src/scene3d/Viewport.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Test: `src/scene3d/units.test.ts`

**Interfaces:**
- Consumes: Task 2–8 전부(`usePlan`, `usePlanStore`, `useValidation`, `findProduct`, `buildProduct`, `mountHeightCm`, `disposeObject`, `wallPieces`, `planWallObbs`, `planBounds`, `planCenter`, `itemObb`, `snapToWalls`, `itemClearances`, `doorSwings`, `wallDistances`, `corners`, `deg2rad`, `createPlanStore`, `loadFromStorage`, `startAutosave`, `SAMPLE_PLAN`)
- Produces:
  - `useUi` (zustand hook): `{ view: 'persp' | 'top'; dragging: boolean; banner: { kind: 'error' | 'info'; text: string } | null; setView(v); setDragging(b); showBanner(b); clearBanner() }`
  - `DND_MIME = 'application/x-homefit-product'` (데이터 형식 `"<productId>|<variantId>"`)
  - `toWorld(p: Vec2, yCm?: number): [number, number, number]`, `sectorToCircleArgs(start: number, end: number): { thetaStart: number; thetaLength: number }`, `FLOOR_PLANE`
  - `screenToFloor: { current: ((clientX: number, clientY: number) => Vec2 | null) | null }`
  - `<Viewport />` (WebGL 미지원이면 안내 문구)
  - 개발 모드 전역 훅 `window.__homefit = { store }` (E2E용)

- [ ] **Step 1: 좌표 변환 테스트 작성**

`src/scene3d/units.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { sectorToCircleArgs, toWorld } from './units';

describe('units', () => {
  it('2D cm를 3D m로 바꾸고 y는 높이가 된다', () => {
    expect(toWorld({ x: 150, y: 250 })).toEqual([1.5, 0, 2.5]);
    expect(toWorld({ x: 0, y: 0 }, 90)).toEqual([0, 0.9, 0]);
  });

  it('2D 부채꼴 각도를 바닥에 눕힌 circleGeometry 각도로 바꾼다', () => {
    // 2D 각도 φ(y-down) → 바닥 원판의 로컬 각도 -φ
    expect(sectorToCircleArgs(0, Math.PI / 2)).toEqual({ thetaStart: -Math.PI / 2, thetaLength: Math.PI / 2 });
  });
});
```

Run: `npx vitest run src/scene3d/units.test.ts` → FAIL(모듈 없음)

- [ ] **Step 2: units와 ui 상태 구현 후 통과 확인**

`src/scene3d/units.ts`:
```ts
import * as THREE from 'three';
import type { Vec2 } from '../model/schema';

export const FLOOR_PLANE = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

export function toWorld(p: Vec2, yCm = 0): [number, number, number] {
  return [p.x / 100, yCm / 100, p.y / 100];
}

// circleGeometry를 rotation.x = -π/2로 눕히면 로컬 각도 θ는 2D 각도 -θ에 대응한다
export function sectorToCircleArgs(start: number, end: number) {
  return { thetaStart: -end, thetaLength: end - start };
}
```

`src/ui/uiStore.ts`:
```ts
import { create } from 'zustand';

export type Banner = { kind: 'error' | 'info'; text: string };

type UiState = {
  view: 'persp' | 'top';
  dragging: boolean;
  banner: Banner | null;
  setView(view: 'persp' | 'top'): void;
  setDragging(dragging: boolean): void;
  showBanner(banner: Banner): void;
  clearBanner(): void;
};

export const useUi = create<UiState>()((set) => ({
  view: 'persp',
  dragging: false,
  banner: null,
  setView: (view) => set({ view }),
  setDragging: (dragging) => set({ dragging }),
  showBanner: (banner) => set({ banner }),
  clearBanner: () => set({ banner: null }),
}));
```

`src/ui/dnd.ts`:
```ts
export const DND_MIME = 'application/x-homefit-product';
```

Run: `npx vitest run src/scene3d/units.test.ts` → 2 passed

- [ ] **Step 3: 씬 컴포넌트 구현**

`src/scene3d/DropBridge.tsx`:
```tsx
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { Vec2 } from '../model/schema';
import { FLOOR_PLANE } from './units';

export const screenToFloor: { current: ((clientX: number, clientY: number) => Vec2 | null) | null } = { current: null };

export function DropBridge() {
  const { camera, gl, raycaster } = useThree();
  useEffect(() => {
    screenToFloor.current = (clientX, clientY) => {
      const r = gl.domElement.getBoundingClientRect();
      const ndc = new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
      raycaster.setFromCamera(ndc, camera);
      const hit = new THREE.Vector3();
      if (!raycaster.ray.intersectPlane(FLOOR_PLANE, hit)) return null;
      return { x: Math.round(hit.x * 100), y: Math.round(hit.z * 100) };
    };
    return () => {
      screenToFloor.current = null;
    };
  }, [camera, gl, raycaster]);
  return null;
}
```

`src/scene3d/Floor.tsx`:
```tsx
import { Grid, Html } from '@react-three/drei';
import { useMemo } from 'react';
import { planBounds } from '../geometry/bounds';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { toWorld } from './units';

export function Floor() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const rooms = usePlan((s) => s.plan.rooms);
  const b = useMemo(() => planBounds({ walls }), [walls]);
  const margin = 200;
  const w = (b.maxX - b.minX + margin * 2) / 100;
  const d = (b.maxY - b.minY + margin * 2) / 100;
  const cx = (b.minX + b.maxX) / 200;
  const cz = (b.minY + b.maxY) / 200;
  return (
    <group>
      <mesh rotation-x={-Math.PI / 2} position={[cx, 0, cz]} onClick={() => store.getState().select(null)}>
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color="#e8e2d6" />
      </mesh>
      <Grid position={[cx, 0.001, cz]} args={[w, d]} cellSize={0.1} sectionSize={1} cellColor="#d6cfc2" sectionColor="#b9b0a0" fadeDistance={60} />
      {rooms.map((r) => (
        <Html key={r.id} position={toWorld(r.label, 1)} center className="room-label">
          {r.name}
        </Html>
      ))}
    </group>
  );
}
```

`src/scene3d/Walls3D.tsx`:
```tsx
import { useMemo } from 'react';
import { wallPieces } from '../geometry/walls';
import { usePlan } from '../model/StoreContext';

export function Walls3D() {
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const pieces = useMemo(
    () => walls.flatMap((w) => wallPieces(w, openings.filter((o) => o.wallId === w.id))),
    [walls, openings],
  );
  return (
    <group>
      {pieces.map((p, i) => (
        <mesh key={i} position={[p.obb.cx / 100, (p.y0 + p.y1) / 200, p.obb.cy / 100]} rotation={[0, -p.obb.angle, 0]}>
          <boxGeometry args={[(p.obb.hw * 2) / 100, (p.y1 - p.y0) / 100, (p.obb.hd * 2) / 100]} />
          <meshStandardMaterial color="#f4f1ec" />
        </mesh>
      ))}
    </group>
  );
}
```

`src/scene3d/Items3D.tsx`:
```tsx
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildProduct, disposeObject, mountHeightCm } from '../catalog/builders';
import { findProduct } from '../catalog/products';
import { deg2rad, itemObb } from '../geometry/obb';
import { snapToWalls } from '../geometry/snap';
import { planWallObbs } from '../geometry/walls';
import type { Item, Product } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { FLOOR_PLANE } from './units';

const MISSING = '#9aa0a6';

function ItemMesh({ item, product }: { item: Item; product: Product | undefined }) {
  const store = usePlanStore();
  const setDragging = useUi((s) => s.setDragging);
  const grab = useRef<{ dx: number; dy: number } | null>(null);
  const object = useMemo(() => (product ? buildProduct(product, item.variantId) : null), [product, item.variantId]);
  useEffect(() => () => {
    if (object) disposeObject(object);
  }, [object]);

  const floorPoint = (e: ThreeEvent<PointerEvent>) => {
    const p = new THREE.Vector3();
    return e.ray.intersectPlane(FLOOR_PLANE, p) ? { x: p.x * 100, y: p.z * 100 } : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    store.getState().select(item.id);
    const p = floorPoint(e);
    if (!p) return;
    grab.current = { dx: item.x - p.x, dy: item.y - p.y };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    store.getState().beginDrag();
    setDragging(true);
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    e.stopPropagation();
    const p = floorPoint(e);
    if (!p) return;
    const dims = product?.dims ?? { w: 50, d: 50 };
    const fp = itemObb(p.x + grab.current.dx, p.y + grab.current.dy, item.rotation, dims.w, dims.d);
    const snapped = snapToWalls(fp, planWallObbs(store.getState().plan));
    store.getState().dragItem(item.id, snapped.cx, snapped.cy);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    if (!grab.current) return;
    grab.current = null;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    store.getState().endDrag();
    setDragging(false);
  };

  const y = product ? mountHeightCm(product) / 100 : 0;
  return (
    <group
      position={[item.x / 100, y, item.y / 100]}
      rotation={[0, -deg2rad(item.rotation), 0]}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {object ? (
        <primitive object={object} />
      ) : (
        <mesh position={[0, 0.25, 0]}>
          <boxGeometry args={[0.5, 0.5, 0.5]} />
          <meshStandardMaterial color={MISSING} />
        </mesh>
      )}
    </group>
  );
}

export function Items3D() {
  const plan = usePlan((s) => s.plan);
  return (
    <group>
      {plan.items.map((item) => (
        <ItemMesh key={item.id} item={item} product={findProduct(plan, item.productId)} />
      ))}
    </group>
  );
}
```

`src/scene3d/Overlays.tsx`:
```tsx
import { Html, Line } from '@react-three/drei';
import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { doorSwings, itemClearances, type ClearanceShape } from '../geometry/clearance';
import { wallDistances } from '../geometry/distance';
import { corners, itemObb, type OBB } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import { usePlan } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { sectorToCircleArgs, toWorld } from './units';

const Y = 0.004;

function outline(o: OBB): [number, number, number][] {
  const c = corners(o);
  return [...c, c[0]].map((p) => [p.x / 100, Y * 2, p.y / 100]);
}

function Shape({ shape, color }: { shape: ClearanceShape; color: string }) {
  if (shape.kind === 'rect') {
    const o = shape.obb;
    return (
      <mesh position={[o.cx / 100, Y, o.cy / 100]} rotation={[-Math.PI / 2, 0, -o.angle]}>
        <planeGeometry args={[(o.hw * 2) / 100, (o.hd * 2) / 100]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
      </mesh>
    );
  }
  const { thetaStart, thetaLength } = sectorToCircleArgs(shape.start, shape.end);
  return (
    <mesh position={[shape.center.x / 100, Y, shape.center.y / 100]} rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[shape.radius / 100, 24, thetaStart, thetaLength]} />
      <meshBasicMaterial color={color} transparent opacity={0.25} depthWrite={false} />
    </mesh>
  );
}

export function Overlays() {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const wallObbs = useMemo(() => planWallObbs(plan), [plan]);
  const doors = useMemo(() => doorSwings(plan), [plan]);

  const placed = plan.items.flatMap((item) => {
    const product = findProduct(plan, item.productId);
    return product ? [{ item, product, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }] : [];
  });
  const selected = placed.find((p) => p.item.id === selectedId);
  const rays = selected ? wallDistances(selected.fp, wallObbs) : [];

  return (
    <group>
      {doors.map((s, i) => (
        <Shape key={`door-${i}`} shape={s} color="#8b8b8b" />
      ))}
      {placed.map(({ item, product, fp }) => {
        const st = status[item.id];
        const color = st?.collides || st?.blocksDoor ? '#e5484d' : st?.clearanceBlocked ? '#f5a524' : item.id === selectedId ? '#3b82f6' : null;
        return (
          <group key={item.id}>
            {itemClearances(item, product).map((s, i) => (
              <Shape key={i} shape={s} color={st?.clearanceBlocked ? '#f5a524' : '#4f9dde'} />
            ))}
            {color && <Line points={outline(fp)} color={color} lineWidth={2} />}
          </group>
        );
      })}
      {rays.map((r) => (
        <group key={r.dir}>
          <Line points={[toWorld(r.from, 1), toWorld(r.to, 1)]} color="#3b82f6" lineWidth={1.5} dashed dashSize={0.05} gapSize={0.03} />
          <Html position={toWorld({ x: (r.from.x + r.to.x) / 2, y: (r.from.y + r.to.y) / 2 }, 2)} center className="dist-label">
            {r.distance}cm
          </Html>
        </group>
      ))}
    </group>
  );
}
```

`src/scene3d/Viewport.tsx`:
```tsx
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useMemo, useState, type DragEvent } from 'react';
import { planCenter } from '../geometry/bounds';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { DND_MIME } from '../ui/dnd';
import { useUi } from '../ui/uiStore';
import { DropBridge, screenToFloor } from './DropBridge';
import { Floor } from './Floor';
import { Items3D } from './Items3D';
import { Overlays } from './Overlays';
import { Walls3D } from './Walls3D';

function hasWebGL(): boolean {
  try {
    const c = document.createElement('canvas');
    return !!(c.getContext('webgl2') || c.getContext('webgl'));
  } catch {
    return false;
  }
}

export function Viewport() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const view = useUi((s) => s.view);
  const dragging = useUi((s) => s.dragging);
  const [webgl] = useState(hasWebGL);
  // 벽이 바뀔 때만 카메라 기준점을 다시 계산한다(아이템 이동 때 카메라가 리셋되지 않도록)
  const c = useMemo(() => planCenter({ walls }), [walls]);
  const cx = c.x / 100;
  const cz = c.y / 100;

  if (!webgl) {
    return <div className="viewport viewport-fallback">이 브라우저는 WebGL을 지원하지 않아 3D 보기를 사용할 수 없습니다.</div>;
  }

  const onDragOver = (e: DragEvent) => {
    if (e.dataTransfer.types.includes(DND_MIME)) e.preventDefault();
  };
  const onDrop = (e: DragEvent) => {
    const data = e.dataTransfer.getData(DND_MIME);
    if (!data) return;
    e.preventDefault();
    const [productId, variantId] = data.split('|');
    const p = screenToFloor.current?.(e.clientX, e.clientY);
    if (p) store.getState().addItem(productId, variantId, p);
  };

  return (
    <div className="viewport" onDragOver={onDragOver} onDrop={onDrop}>
      <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }} onPointerMissed={() => store.getState().select(null)}>
        {view === 'top' ? (
          <OrthographicCamera makeDefault position={[cx, 30, cz + 0.01]} zoom={60} near={0.1} far={100} />
        ) : (
          <PerspectiveCamera makeDefault position={[cx + 4, 7, cz + 9]} fov={50} />
        )}
        <OrbitControls makeDefault target={[cx, 0, cz]} enabled={!dragging} enableRotate={view === 'persp'} />
        <ambientLight intensity={0.7} />
        <directionalLight position={[5, 10, 5]} intensity={1.1} />
        <Floor />
        <Walls3D />
        <Items3D />
        <Overlays />
        <DropBridge />
      </Canvas>
    </div>
  );
}
```

- [ ] **Step 4: 앱에 연결**

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import type { StoreApi } from 'zustand/vanilla';
import { App } from './App';
import { SAMPLE_PLAN } from './model/samplePlan';
import { createPlanStore, type PlanState } from './model/store';
import { PlanStoreContext } from './model/StoreContext';
import { loadFromStorage, startAutosave } from './persistence/storage';
import { useUi } from './ui/uiStore';
import './styles.css';

declare global {
  interface Window {
    __homefit?: { store: StoreApi<PlanState> };
  }
}

const store = createPlanStore(loadFromStorage() ?? SAMPLE_PLAN);
let saveFailedShown = false;
startAutosave(store, {
  onResult: (ok) => {
    if (ok) {
      saveFailedShown = false;
      return;
    }
    if (saveFailedShown) return;
    saveFailedShown = true;
    useUi.getState().showBanner({ kind: 'error', text: '브라우저 저장에 실패했습니다. 상단의 "JSON 저장"으로 백업하세요.' });
  },
});
if (import.meta.env.DEV) window.__homefit = { store };

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PlanStoreContext.Provider value={store}>
      <App />
    </PlanStoreContext.Provider>
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
import { Viewport } from './scene3d/Viewport';

export function App() {
  return (
    <div className="app">
      <main className="center">
        <Viewport />
      </main>
    </div>
  );
}
```

`src/styles.css`에 추가:
```css
.app { display: grid; grid-template-columns: 260px 1fr 280px; grid-template-rows: auto auto 1fr; height: 100vh; }
.center { grid-column: 2; grid-row: 3; position: relative; min-height: 0; }
.viewport { position: absolute; inset: 0; }
.viewport-fallback { display: flex; align-items: center; justify-content: center; padding: 24px; color: #6b7280; }
.room-label { font-size: 13px; color: #6b5e4b; white-space: nowrap; pointer-events: none; }
.dist-label { font-size: 11px; background: #3b82f6; color: #fff; padding: 1px 5px; border-radius: 4px; white-space: nowrap; pointer-events: none; }
```

- [ ] **Step 5: 동작 확인**

Run: `npm run typecheck && npm test`
Expected: 오류 없음, 전체 PASS

Run: `npm run dev -- --port 5180`, 브라우저에서 `http://localhost:5180` 열고 개발자 콘솔에서:
```js
const s = window.__homefit.store.getState();
s.addItem('samsung-bespoke-4door-sample', 'satin-white', { x: 150, y: 100 });
s.addItem('samsung-bespoke-4door-sample', 'glam-navy', { x: 200, y: 100 });
```
Expected: 샘플 평면 벽 5개(문 위 상인방, 창 아래·위 조각 포함), 냉장고 2대가 보이고 두 냉장고 외곽선이 빨간색. 냉장고를 드래그하면 바닥을 따라 움직이고, 마우스를 놓은 뒤 콘솔에서 `s.undo()` 한 번에 원위치. 선택한 냉장고 4방향에 파란 거리선과 `NNcm` 라벨이 보인다. 콘솔에 오류가 없어야 한다.

- [ ] **Step 6: Commit**

```bash
git add src
git commit -m "feat: 3D viewport with walls, draggable items and validation overlays"
```

---

### Task 10: 패널, 툴바, 단축키

**Files:**
- Create: `src/ui/shortcuts.ts`, `src/ui/Toolbar.tsx`, `src/ui/Banner.tsx`, `src/ui/CatalogPanel.tsx`, `src/ui/CustomBoxForm.tsx`, `src/ui/PropertiesPanel.tsx`
- Modify: `src/App.tsx`, `src/styles.css`
- Test: `src/ui/shortcuts.test.ts`

**Interfaces:**
- Consumes: `PlanState`, `createPlanStore` (Task 7), `useUi`, `DND_MIME` (Task 9), `CATALOG`, `CATEGORY_ORDER`, `CATEGORY_LABEL`, `findProduct` (Task 5), `planCenter` (Task 3), `readPlanFile`, `planToJson`, `downloadText` (Task 8), `useValidation` (Task 7)
- Produces:
  - `type KeyInput = { key: string; shiftKey: boolean; mod: boolean; targetTag?: string }`
  - `applyShortcut(s: PlanState, k: KeyInput): boolean` (처리했으면 true. 호출자가 preventDefault)
  - `useShortcuts(store: StoreApi<PlanState>): void`
  - DOM 테스트 id: `catalog-card-<productId>`, `properties-panel`, `status-collides`, `status-blocks-door`, `status-clearance`, `open-json`, `banner`

- [ ] **Step 1: 단축키 실패 테스트 작성**

`src/ui/shortcuts.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { applyShortcut } from './shortcuts';

function setup() {
  const store = createPlanStore(SAMPLE_PLAN);
  const id = store.getState().addItem('p', 'v', { x: 100, y: 100 });
  const press = (key: string, o: { shiftKey?: boolean; mod?: boolean; targetTag?: string } = {}) =>
    applyShortcut(store.getState(), { key, shiftKey: !!o.shiftKey, mod: !!o.mod, targetTag: o.targetTag });
  return { store, id, press };
}

describe('applyShortcut', () => {
  it('방향키는 1cm, Shift+방향키는 10cm 이동', () => {
    const { store, press } = setup();
    expect(press('ArrowRight')).toBe(true);
    press('ArrowUp', { shiftKey: true });
    expect(store.getState().plan.items[0]).toMatchObject({ x: 101, y: 90 });
  });

  it('R은 90° 회전', () => {
    const { store, press } = setup();
    press('r');
    expect(store.getState().plan.items[0].rotation).toBe(90);
  });

  it('Delete는 선택 아이템을 삭제', () => {
    const { store, press } = setup();
    press('Delete');
    expect(store.getState().plan.items).toHaveLength(0);
  });

  it('Ctrl+D는 복제, Ctrl+Z/Ctrl+Shift+Z는 실행 취소/다시 실행', () => {
    const { store, press } = setup();
    press('d', { mod: true });
    expect(store.getState().plan.items).toHaveLength(2);
    press('z', { mod: true });
    expect(store.getState().plan.items).toHaveLength(1);
    press('Z', { mod: true, shiftKey: true });
    expect(store.getState().plan.items).toHaveLength(2);
  });

  it('입력 필드에서는 무시한다', () => {
    const { store, press } = setup();
    expect(press('Delete', { targetTag: 'INPUT' })).toBe(false);
    expect(store.getState().plan.items).toHaveLength(1);
  });

  it('선택이 없으면 편집 단축키는 무시한다', () => {
    const { store, press } = setup();
    store.getState().select(null);
    expect(press('Delete')).toBe(false);
  });
});
```

Run: `npx vitest run src/ui/shortcuts.test.ts` → FAIL(모듈 없음)

- [ ] **Step 2: 단축키 구현 후 통과 확인**

`src/ui/shortcuts.ts`:
```ts
import { useEffect } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import type { PlanState } from '../model/store';

export type KeyInput = { key: string; shiftKey: boolean; mod: boolean; targetTag?: string };

const EDITABLE = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function applyShortcut(s: PlanState, k: KeyInput): boolean {
  if (k.targetTag && EDITABLE.has(k.targetTag)) return false;
  const key = k.key.toLowerCase();
  if (k.mod && key === 'z') {
    if (k.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  const item = s.plan.items.find((i) => i.id === s.selectedId);
  if (!item) return false;
  if (k.mod && key === 'd') {
    s.duplicateItem(item.id);
    return true;
  }
  if (k.key === 'Delete' || k.key === 'Backspace') {
    s.removeItem(item.id);
    return true;
  }
  if (!k.mod && key === 'r') {
    s.rotateItem(item.id, 90);
    return true;
  }
  const arrow = ARROWS[k.key];
  if (arrow) {
    const step = k.shiftKey ? 10 : 1;
    s.updateItem(item.id, { x: item.x + arrow[0] * step, y: item.y + arrow[1] * step });
    return true;
  }
  return false;
}

export function useShortcuts(store: StoreApi<PlanState>): void {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const handled = applyShortcut(store.getState(), {
        key: e.key,
        shiftKey: e.shiftKey,
        mod: e.metaKey || e.ctrlKey,
        targetTag: (e.target as HTMLElement | null)?.tagName,
      });
      if (handled) e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store]);
}
```

Run: `npx vitest run src/ui/shortcuts.test.ts` → 6 passed

- [ ] **Step 3: 패널 구현**

`src/ui/Banner.tsx`:
```tsx
import { useUi } from './uiStore';

export function Banner() {
  const banner = useUi((s) => s.banner);
  const clear = useUi((s) => s.clearBanner);
  if (!banner) return null;
  return (
    <div className={`banner banner-${banner.kind}`} data-testid="banner" role={banner.kind === 'error' ? 'alert' : 'status'}>
      <span style={{ whiteSpace: 'pre-line' }}>{banner.text}</span>
      <button type="button" onClick={clear} aria-label="닫기">×</button>
    </div>
  );
}
```

`src/ui/Toolbar.tsx`:
```tsx
import { useRef, type ChangeEvent } from 'react';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { downloadText, planToJson, readPlanFile } from '../persistence/file';
import { useUi } from './uiStore';

export function Toolbar() {
  const store = usePlanStore();
  const canUndo = usePlan((s) => s.past.length > 0);
  const canRedo = usePlan((s) => s.future.length > 0);
  const view = useUi((s) => s.view);
  const setView = useUi((s) => s.setView);
  const showBanner = useUi((s) => s.showBanner);
  const fileRef = useRef<HTMLInputElement>(null);

  const onOpen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await readPlanFile(file);
    if (r.ok) {
      store.getState().loadPlan(r.plan);
      showBanner({ kind: 'info', text: `"${r.plan.info.title}"을(를) 불러왔습니다.` });
    } else {
      showBanner({ kind: 'error', text: `불러오기 실패\n${r.error}` });
    }
  };

  return (
    <header className="toolbar">
      <strong className="brand">homefit</strong>
      <button type="button" onClick={() => fileRef.current?.click()}>JSON 열기</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="open-json" onChange={onOpen} />
      <button type="button" onClick={() => downloadText(planToJson(store.getState().plan), 'homefit-plan.json')}>JSON 저장</button>
      <span className="sep" />
      <button type="button" disabled={!canUndo} onClick={() => store.getState().undo()}>실행 취소</button>
      <button type="button" disabled={!canRedo} onClick={() => store.getState().redo()}>다시 실행</button>
      <span className="sep" />
      <button type="button" onClick={() => setView(view === 'persp' ? 'top' : 'persp')}>
        {view === 'persp' ? '탑뷰로 보기' : '원근으로 보기'}
      </button>
    </header>
  );
}
```

`src/ui/CustomBoxForm.tsx`:
```tsx
import { useState, type FormEvent } from 'react';
import { planCenter } from '../geometry/bounds';
import { usePlanStore } from '../model/StoreContext';

const FIELDS = [
  ['w', '폭 W'],
  ['d', '깊이 D'],
  ['h', '높이 H'],
] as const;

export function CustomBoxForm() {
  const store = usePlanStore();
  const [name, setName] = useState('');
  const [dims, setDims] = useState({ w: '60', d: '60', h: '90' });
  const [error, setError] = useState<string | null>(null);

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const n = { w: Number(dims.w), d: Number(dims.d), h: Number(dims.h) };
    const valid = Object.values(n).every((v) => Number.isInteger(v) && v >= 1 && v <= 1000);
    if (!name.trim() || !valid) {
      setError('이름과 1~1000 사이 정수 치수(cm)를 입력하세요.');
      return;
    }
    setError(null);
    const s = store.getState();
    const productId = s.addCustomProduct({ name: name.trim(), ...n });
    s.addItem(productId, 'default', planCenter(s.plan));
    setName('');
  };

  return (
    <form className="custom-box" onSubmit={onSubmit}>
      <h3>사용자 정의 박스</h3>
      <label>이름<input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 김치냉장고 자리" /></label>
      <div className="row">
        {FIELDS.map(([k, label]) => (
          <label key={k}>
            {label}
            <input inputMode="numeric" value={dims[k]} onChange={(e) => setDims({ ...dims, [k]: e.target.value })} />
          </label>
        ))}
      </div>
      {error && <p className="error">{error}</p>}
      <button type="submit">추가</button>
    </form>
  );
}
```

`src/ui/CatalogPanel.tsx`:
```tsx
import { useMemo } from 'react';
import { CATALOG, CATEGORY_LABEL, CATEGORY_ORDER } from '../catalog/products';
import { planCenter } from '../geometry/bounds';
import type { Product } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { CustomBoxForm } from './CustomBoxForm';
import { DND_MIME } from './dnd';

export function CatalogPanel() {
  const store = usePlanStore();
  const custom = usePlan((s) => s.plan.customProducts);
  const groups = useMemo(() => {
    const all = [...CATALOG, ...custom];
    return CATEGORY_ORDER.map((cat) => [cat, all.filter((p) => p.category === cat)] as const).filter(([, list]) => list.length > 0);
  }, [custom]);

  const addAtCenter = (p: Product) => {
    const s = store.getState();
    s.addItem(p.id, p.variants[0].id, planCenter(s.plan));
  };

  return (
    <div className="catalog">
      {groups.map(([cat, list]) => (
        <section key={cat}>
          <h3>{CATEGORY_LABEL[cat]}</h3>
          {list.map((p) => (
            <div
              key={p.id}
              className="card"
              draggable
              data-testid={`catalog-card-${p.id}`}
              onDragStart={(e) => {
                e.dataTransfer.setData(DND_MIME, `${p.id}|${p.variants[0].id}`);
                e.dataTransfer.effectAllowed = 'copy';
              }}
            >
              <div className="card-text">
                <div className="card-name">{p.name}</div>
                <div className="card-dims">{p.dims.w}×{p.dims.d}×{p.dims.h}cm</div>
              </div>
              <button type="button" onClick={() => addAtCenter(p)}>추가</button>
            </div>
          ))}
        </section>
      ))}
      <CustomBoxForm />
    </div>
  );
}
```

`src/ui/PropertiesPanel.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { findProduct } from '../catalog/products';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';

function NumberField({ label, value, onCommit }: { label: string; value: number; onCommit: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (Number.isFinite(v) && Math.round(v) !== value) onCommit(Math.round(v));
    else setText(String(value));
  };
  return (
    <label>
      {label}
      <input
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
    </label>
  );
}

export function PropertiesPanel() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const item = plan.items.find((i) => i.id === selectedId);

  if (!item) {
    return (
      <div className="props" data-testid="properties-panel">
        <p className="muted">아이템을 선택하세요.</p>
      </div>
    );
  }

  const product = findProduct(plan, item.productId);
  const st = status[item.id];
  const s = store.getState();
  return (
    <div className="props" data-testid="properties-panel">
      <h3>{product?.name ?? '알 수 없는 제품'}</h3>
      {product && (
        <p className="muted">
          {product.model && `${product.model} · `}
          {product.dims.w}×{product.dims.d}×{product.dims.h}cm
        </p>
      )}
      <div className="badges">
        {st?.collides && <span className="badge danger" data-testid="status-collides">충돌</span>}
        {st?.blocksDoor && <span className="badge danger" data-testid="status-blocks-door">방문 열림 간섭</span>}
        {st?.clearanceBlocked && <span className="badge warn" data-testid="status-clearance">문 열림 공간 부족</span>}
      </div>
      <NumberField label="X (cm)" value={item.x} onCommit={(v) => s.updateItem(item.id, { x: v })} />
      <NumberField label="Y (cm)" value={item.y} onCommit={(v) => s.updateItem(item.id, { y: v })} />
      <NumberField label="회전 (°)" value={item.rotation} onCommit={(v) => s.updateItem(item.id, { rotation: v })} />
      {product && product.variants.length > 1 && (
        <label>
          색상
          <select value={item.variantId} onChange={(e) => s.updateItem(item.id, { variantId: e.target.value })}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
      )}
      <div className="row">
        <button type="button" onClick={() => s.rotateItem(item.id, 90)}>90° 회전 (R)</button>
        <button type="button" onClick={() => s.duplicateItem(item.id)}>복제</button>
        <button type="button" className="danger" onClick={() => s.removeItem(item.id)}>삭제</button>
      </div>
    </div>
  );
}
```

`src/App.tsx`:
```tsx
import { usePlanStore } from './model/StoreContext';
import { Viewport } from './scene3d/Viewport';
import { Banner } from './ui/Banner';
import { CatalogPanel } from './ui/CatalogPanel';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { Toolbar } from './ui/Toolbar';

export function App() {
  useShortcuts(usePlanStore());
  return (
    <div className="app">
      <Toolbar />
      <Banner />
      <aside className="left">
        <CatalogPanel />
      </aside>
      <main className="center">
        <Viewport />
      </main>
      <aside className="right">
        <PropertiesPanel />
      </aside>
    </div>
  );
}
```

`src/styles.css`에 추가:
```css
.toolbar { grid-column: 1 / -1; display: flex; align-items: center; gap: 8px; padding: 8px 12px; background: #fff; border-bottom: 1px solid #e5e1d8; }
.toolbar .brand { margin-right: 12px; }
.toolbar .sep { width: 1px; height: 20px; background: #e5e1d8; }
.banner { grid-column: 1 / -1; display: flex; justify-content: space-between; gap: 12px; padding: 8px 12px; }
.banner-error { background: #fdecec; color: #8a1c1c; }
.banner-info { background: #e8f1fd; color: #1b4a8a; }
.left, .right { grid-row: 3; overflow-y: auto; background: #fff; padding: 12px; min-height: 0; }
.left { grid-column: 1; border-right: 1px solid #e5e1d8; }
.right { grid-column: 3; border-left: 1px solid #e5e1d8; }
.catalog h3, .props h3, .custom-box h3 { font-size: 13px; margin: 12px 0 6px; color: #6b5e4b; }
.card { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 8px; margin-bottom: 6px; border: 1px solid #e5e1d8; border-radius: 6px; cursor: grab; background: #fbfaf7; }
.card-name { font-size: 13px; }
.card-dims, .muted { font-size: 12px; color: #6b7280; }
.props label, .custom-box label { display: flex; flex-direction: column; gap: 2px; font-size: 12px; margin-bottom: 8px; }
.props input, .props select, .custom-box input { padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; font-size: 13px; }
.row { display: flex; gap: 6px; flex-wrap: wrap; }
.custom-box .row label { flex: 1; min-width: 0; }
.badges { display: flex; gap: 6px; margin-bottom: 8px; }
.badge { font-size: 12px; padding: 2px 8px; border-radius: 999px; }
.badge.danger { background: #fdecec; color: #b42318; }
.badge.warn { background: #fff4e5; color: #9a5b00; }
button.danger { color: #b42318; }
.error { color: #b42318; font-size: 12px; }
button { font: inherit; font-size: 13px; padding: 4px 10px; border: 1px solid #d6d0c4; border-radius: 4px; background: #fff; cursor: pointer; }
button:disabled { opacity: 0.4; cursor: default; }
```

- [ ] **Step 4: 동작 확인**

Run: `npm run typecheck && npm test`
Expected: 오류 없음, 전체 PASS

Run: `npm run dev -- --port 5180` 후 브라우저 확인:
1. 좌측 카드 "비스포크 냉장고 4도어"를 3D 뷰로 드래그 → 놓은 자리에 생성되고 우측 패널에 이름·치수 표시
2. 같은 카드의 "추가" 두 번 → 평면 중앙에 겹쳐 생성, 우측 패널에 "충돌" 배지
3. `R` → 90° 회전, 방향키 → 1cm 이동, `Delete` → 삭제, `Ctrl+Z` → 복구
4. "탑뷰로 보기" → 위에서 내려다보는 정투영, 회전 불가·이동/줌 가능
5. 사용자 정의 박스 "테스트 70×80×90" 추가 → 카탈로그 "사용자 정의"에 나타남
6. 새로고침 → 배치 유지

- [ ] **Step 5: Commit**

```bash
git add src
git commit -m "feat: catalog, properties panel, toolbar and keyboard shortcuts"
```

---

### Task 11: E2E 테스트

**Files:**
- Create: `playwright.config.ts`, `e2e/placement.spec.ts`

**Interfaces:**
- Consumes: Task 9–10의 테스트 id와 `window.__homefit`

- [ ] **Step 1: 설정과 테스트 작성**

`playwright.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5180',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run dev -- --port 5180 --strictPort',
    url: 'http://localhost:5180',
    reuseExistingServer: !process.env.CI,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```

`e2e/placement.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';

const itemCount = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan.items.length);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('카탈로그에서 가전을 드래그해 배치하고 충돌·삭제·자동저장이 동작한다', async ({ page }) => {
  const viewport = page.locator('.viewport');
  const box = (await viewport.boundingBox())!;
  await page.getByTestId('catalog-card-samsung-bespoke-4door-sample').dragTo(viewport, {
    sourcePosition: { x: 12, y: 12 },
    targetPosition: { x: box.width / 2, y: box.height / 2 },
  });
  await expect.poll(() => itemCount(page)).toBe(1);
  await expect(page.getByTestId('properties-panel')).toContainText('비스포크 냉장고 4도어');

  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    const it = s.plan.items[0];
    s.addItem(it.productId, it.variantId, { x: it.x + 10, y: it.y });
  });
  await expect(page.getByTestId('status-collides')).toBeVisible();

  await page.evaluate(() => {
    const s = window.__homefit!.store.getState();
    s.select(s.plan.items[1].id);
  });
  await page.keyboard.press('Delete');
  await expect.poll(() => itemCount(page)).toBe(1);

  await page.waitForTimeout(800);
  await page.reload();
  await expect.poll(() => itemCount(page)).toBe(1);
});

test('잘못된 JSON을 열면 오류 배너가 뜨고 배치는 유지된다', async ({ page }) => {
  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  await expect.poll(() => itemCount(page)).toBe(1);
  await page.getByTestId('open-json').setInputFiles({
    name: 'bad.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify({ version: 9 })),
  });
  await expect(page.getByTestId('banner')).toContainText('지원하지 않는 파일 버전입니다: 9');
  expect(await itemCount(page)).toBe(1);
});

test('탑뷰 전환 후에도 렌더링이 유지된다', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '탑뷰로 보기' }).click();
  await expect(page.getByRole('button', { name: '원근으로 보기' })).toBeVisible();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: 실행**

Run: `npm run e2e`
Expected: 3 passed. 첫 테스트에서 드래그 후 아이템이 0개면 `DropBridge`의 `screenToFloor.current`가 null인지(캔버스 미마운트) 또는 drop 이벤트가 `.viewport`까지 버블링되지 않는지 확인한다. Playwright의 HTML5 드래그가 막힌다고 해서 테스트를 store 호출로 바꾸지 않는다. 실제 사용자 동작을 검증하는 단계다.

- [ ] **Step 3: Commit**

```bash
git add playwright.config.ts e2e
git commit -m "test: e2e for drag placement, collision, autosave and bad json"
```

---

### Task 12: 우리 집 프리셋(비공개)

**Files:**
- Create (gitignored): `private/make-our-home.mjs`, `private/our-home.local.json`
- Create (커밋): `src/persistence/privatePlan.test.ts`

**Interfaces:**
- Consumes: `parsePlan` (Task 8), `planWallObbs` (Task 3)
- Produces: 앱 "JSON 열기"로 불러올 수 있는 `private/our-home.local.json`

치수 출처: 스펙 §3(벽 중심선, cm). 세대 내부 1010×690, 왼쪽 150은 발코니. 문 위치는 평면도 이미지에서 읽은 근사치다.

- [ ] **Step 1: 실패하는 테스트 작성(파일이 있을 때만 실행)**

`src/persistence/privatePlan.test.ts`:
```ts
import { existsSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { planWallObbs } from '../geometry/walls';
import { parsePlan } from './parse';

const FILE = 'private/our-home.local.json';

describe.skipIf(!existsSync(FILE))('비공개 우리 집 프리셋', () => {
  it('스키마를 통과하고 외곽이 1010×690이다', () => {
    const r = parsePlan(JSON.parse(readFileSync(FILE, 'utf8')));
    if (!r.ok) throw new Error(r.error);
    const xs = r.plan.walls.flatMap((w) => [w.a.x, w.b.x]);
    const ys = r.plan.walls.flatMap((w) => [w.a.y, w.b.y]);
    expect([Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)]).toEqual([0, 1010, 0, 690]);
    expect(planWallObbs(r.plan).length).toBeGreaterThan(r.plan.walls.length);
  });

  it('모든 개구부가 존재하는 벽을 참조하고 벽 길이 안에 있다', () => {
    const r = parsePlan(JSON.parse(readFileSync(FILE, 'utf8')));
    if (!r.ok) throw new Error(r.error);
    for (const o of r.plan.openings) {
      const w = r.plan.walls.find((x) => x.id === o.wallId);
      expect(w, o.id).toBeDefined();
      const len = Math.hypot(w!.b.x - w!.a.x, w!.b.y - w!.a.y);
      expect(o.offset + o.width, o.id).toBeLessThanOrEqual(len);
    }
  });
});
```

Run: `npx vitest run src/persistence/privatePlan.test.ts`
Expected: 파일이 없어서 skipped

- [ ] **Step 2: 생성 스크립트 작성(git에 올리지 않음)**

스크립트는 `private/make-our-home.mjs`(git 제외)에 있다. 좌표는 스펙 §3 치수에서 만들었고 문 위치는 평면도 이미지에서 읽은 근사치다.

- [ ] **Step 3: 생성하고 테스트 통과 확인**

Run:
```bash
node private/make-our-home.mjs
npx vitest run src/persistence/privatePlan.test.ts
git status --short
```
Expected: `wrote private/our-home.local.json`, 2 passed, `git status`에 `private/` 아래 파일이 **나타나지 않음**(gitignore 확인)

- [ ] **Step 4: 앱에서 확인**

`npm run dev -- --port 5180` → "JSON 열기"로 `private/our-home.local.json` 선택 → 8개 방 이름, 발코니 미닫이, 방문 부채꼴이 보인다. 탑뷰로 전환해 `private/home-floorplan.jpg`와 비교했을 때 방 배치가 같아야 한다(이미지 배경 겹쳐 보기는 계획 2).

- [ ] **Step 5: Commit(테스트 파일만)**

```bash
git add src/persistence/privatePlan.test.ts
git commit -m "test: validate private home preset when present"
```

---

## 완료 기준

- `npm run typecheck && npm test && npm run e2e` 모두 통과
- Task 10 Step 4의 수동 확인 6항목과 Task 12 Step 4 확인
- `git ls-files | grep -E 'private|naver|our-home'`에 `src/persistence/privatePlan.test.ts` 외에 결과 없음
