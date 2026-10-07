# homefit 계획 3: 배치안 A/B · 비교 · PNG 내보내기 · 복구 이력 · 간섭 설명 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 같은 집 구조 위에 가구 배치안을 여러 개(A안, B안…) 만들어 같은 시점에서 비교하고, 배치안을 2D/3D PNG로 내보내며, 로컬 복구 이력에서 이전 상태로 되돌리고, 간섭 경고를 누르면 무엇과 겹치는지 보여준다.

**Architecture:** 평면 스키마를 v2로 올려 `items`를 `layouts[{ id, name, memo?, items }]` + `activeLayoutId`로 옮긴다(v1 파일은 자동 마이그레이션). 구조(벽·문·창·방·전기)는 배치안이 공유하고, 아이템 접근은 계속 `activeItems`/`withActiveItems`만 쓴다. 검증은 사유(`conflicts`)까지 돌려주고, 내보내기는 화면 CSS에 의존하지 않는 순수 SVG 렌더러(`export/planSvg.ts`)와 3D 캔버스 캡처로 만든다. 복구 이력은 localStorage에 최근 20개 스냅샷을 둔다.

**Tech Stack:** 계획 1·2와 동일. 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-08-homefit-design.md` — §14.1(배치안 A/B, 이미지 내보내기, 복구 이력, 간섭 경고 설명, 저장 상태), §14.4(스키마 v2), §14.5-3. 사용자 설계서 `docs/references/2026-10-08-planner5d-research-design.md` §6 배치안 비교 화면, §7 F08–F12.

## Global Constraints

- 저장 단위는 정수 cm. cm↔m 변환은 `src/model/units.ts`만 쓴다.
- 아이템 목록 접근은 `activeItems(plan)` / `withActiveItems(plan, items)` / `activeLayout(plan)`만 쓴다(`plan.layouts`를 직접 읽는 것은 `src/model/layout.ts`, `src/model/store.ts`의 배치안 액션, `src/persistence/parse.ts` 마이그레이션, 배치안 UI(`src/ui/LayoutBar.tsx`)뿐).
- 평면 스키마는 v2: `version: 2`, `layouts`는 1개 이상, `activeLayoutId`는 `layouts` 안의 id. v1 파일·자동 저장은 `parsePlan`이 v2로 올린다(`items` → `layouts[0] = { id: 'layout-a', name: 'A안', items }`).
- 구조(벽·개구부·방·배경·전기·체크리스트·사용자 정의 제품)는 모든 배치안이 공유한다.
- 새 런타임/개발 의존성 금지. UI 문구는 한국어, 숫자 입력 옆 단위 표시.
- 2D 에디터와 3D 뷰는 항상 마운트(비활성 쪽은 `.layer-hidden`, `<Viewport active={...} />`) — 계획 2에서 정한 구조를 유지한다.
- repo는 공개 예정: 개인 평면·이미지·프리셋을 커밋하지 않는다. 내보낸 PNG에는 배경 이미지를 넣지 않는다.
- 커밋 트레일러(빈 줄 뒤 정확히): `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **예전 파일·예전 자동 저장 열기**: v1 JSON(우리 집 프리셋 포함)과 v1 localStorage 데이터가 아이템을 잃지 않고 `A안`으로 열려야 한다 → Task 1 테스트 `v1 평면은 아이템을 A안으로 옮겨 v2가 된다`, `privatePlan.test.ts`(기존).
2. **활성 배치안 삭제**: 지우면 다른 배치안이 활성화되고 선택이 풀려야 하며, 마지막 하나는 지울 수 없다 → Task 2 테스트 `활성 배치안을 지우면 남은 첫 배치안이 활성화된다`, `마지막 배치안은 지울 수 없다`.
3. **구조 변경이 모든 배치안에 반영되고 간섭이 다시 계산됨**(F09) → Task 2 테스트 `벽을 추가하면 모든 배치안에서 보이고, 전환하면 그 배치안 기준으로 간섭을 다시 계산한다`.
4. **이력 복원이 현재 작업을 잃지 않음**: 복원은 실행 취소할 수 있어야 하고 저장소가 가득 차도 앱이 멈추지 않아야 한다 → Task 4 테스트 `복원은 실행 취소 한 번으로 되돌아간다`, `저장소가 throw하면 false`.
5. **내보내기 문자 처리**: 방·제품·배치안 이름에 `<`, `&`, `"`가 있어도 올바른 SVG/PNG가 나와야 한다 → Task 5 테스트 `이름의 특수문자를 XML로 이스케이프한다`.

---

## File Structure

```
src/
  model/
    schema.ts       (수정) LayoutSchema, PlanSchema v2(layouts, activeLayoutId, refine)
    layout.ts       (수정) DEFAULT_LAYOUT_ID, activeLayout, activeItems, withActiveItems, nextLayoutName, compareItems
    samplePlan.ts   (수정) v2, emptyPlanFields에 layouts/activeLayoutId
    store.ts        (수정) addLayout, renameLayout, setLayoutMemo, removeLayout, switchLayout
  persistence/
    parse.ts        (수정) CURRENT_VERSION 2, v1→v2 마이그레이션
    storage.ts      (수정) defaultStorage export
    file.ts         (수정) downloadBlob
    revisions.ts    (신규) 복구 이력 저장소
  validation/
    validate.ts     (수정) conflicts(사유)
    describe.ts     (신규) conflictLines: 사유 → 한국어 문장
  geometry/walls.ts (수정) planWallObbsWithIds
  export/
    planSvg.ts      (신규) 순수 SVG 렌더러, unverifiedCount, escapeXml
    png.ts          (신규) svgToPngBlob, canvasWithHeader (브라우저 전용)
  scene3d/
    CaptureBridge.tsx (신규) 3D 캔버스 캡처 등록
    Viewport.tsx    (수정) CaptureBridge 추가
  editor2d/Overlays2D.tsx (수정) 비교 배치안 겹쳐 보기
  ui/
    uiStore.ts      (수정) compareLayoutId, historyOpen
    LayoutBar.tsx   (신규) 배치안 전환·복제·이름·메모·삭제·비교
    HistoryPanel.tsx (신규) 복구 이력 목록·복원·지금 저장
    ExportButtons.tsx (신규) 2D PNG / 3D PNG
    CatalogPanel.tsx (수정) 위에 LayoutBar
    Toolbar.tsx     (수정) 이력·내보내기 버튼
    properties/ItemProperties.tsx (수정) 경고 배지 → 사유 펼치기
  App.tsx main.tsx styles.css (수정)
e2e/
  placement.spec.ts editor2d.spec.ts (수정: 활성 배치안 아이템 읽기)
  layouts.spec.ts   (신규)
```

---

### Task 1: 스키마 v2(배치안)와 마이그레이션

**Files:**
- Modify: `src/model/schema.ts`, `src/model/layout.ts`, `src/model/samplePlan.ts`, `src/persistence/parse.ts`
- Modify (테스트 기계적 수정): `src/model/layout.test.ts`, `src/model/schema.test.ts`, `src/model/entities.test.ts`, `src/model/store.test.ts`, `src/persistence/parse.test.ts`, `src/persistence/storage.test.ts`, `src/geometry/pick.test.ts`, `src/validation/validate.test.ts`, `src/ui/shortcuts.test.ts`, `src/editor2d/tools.test.ts`, `e2e/placement.spec.ts`, `e2e/editor2d.spec.ts`

**Interfaces:**
- Produces:
  - `LayoutSchema`, 타입 `Layout = { id: string; name: string; memo?: string; items: Item[] }`
  - `Plan`: `version: 2`, `layouts: Layout[]`(≥1), `activeLayoutId: string`; `items` 필드는 없어진다
  - `DEFAULT_LAYOUT_ID = 'layout-a'`, `activeLayout(plan: Plan): Layout`(id가 없으면 첫 배치안), `activeItems(plan): Item[]`, `withActiveItems(plan, items): Plan`
  - `CURRENT_VERSION = 2`, 마이그레이션 1→2

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/layout.test.ts`에 추가(import에 `activeLayout` 추가):
```ts
  it('activeLayoutId가 없으면 첫 배치안을 쓴다', () => {
    const plan = { ...SAMPLE_PLAN, activeLayoutId: 'missing' };
    expect(activeLayout(plan).id).toBe('layout-a');
  });

  it('withActiveItems는 활성 배치안의 아이템만 바꾼다', () => {
    const other = { id: 'layout-b', name: 'B안', items: [] };
    const plan = { ...SAMPLE_PLAN, layouts: [...SAMPLE_PLAN.layouts, other] };
    const items = [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }];
    const next = withActiveItems(plan, items);
    expect(next.layouts[0].items).toBe(items);
    expect(next.layouts[1]).toBe(other);
  });
```

`src/persistence/parse.test.ts`의 `describe('migrate', ...)` 안에 추가:
```ts
  it('v1 평면은 아이템을 A안으로 옮겨 v2가 된다', () => {
    const item = { id: 'i', productId: 'p', variantId: 'v', x: 1, y: 2, rotation: 0 };
    const v1 = {
      version: 1,
      info: SAMPLE_PLAN.info,
      walls: SAMPLE_PLAN.walls,
      openings: SAMPLE_PLAN.openings,
      rooms: SAMPLE_PLAN.rooms,
      items: [item],
      fixtures: [],
      checklist: [],
      customProducts: [],
    };
    const r = parsePlan(v1);
    if (!r.ok) throw new Error(r.error);
    expect(r.plan.version).toBe(2);
    expect(r.plan.layouts).toEqual([{ id: 'layout-a', name: 'A안', items: [item] }]);
    expect(r.plan.activeLayoutId).toBe('layout-a');
  });
```

`src/model/schema.test.ts`의 `describe('PlanSchema', ...)` 안에 추가:
```ts
  it('배치안은 하나 이상이고 activeLayoutId는 그 안에 있어야 한다', () => {
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, layouts: [] }).success).toBe(false);
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, activeLayoutId: 'nope' }).success).toBe(false);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model/layout.test.ts src/persistence/parse.test.ts src/model/schema.test.ts`
Expected: `activeLayout` 없음, `layouts` 없음 등으로 FAIL

- [ ] **Step 3: 구현**

`src/model/schema.ts`:
- `ItemSchema` 정의 뒤에 추가:
```ts
export const LayoutSchema = z.object({
  id,
  name: z.string().min(1),
  memo: z.string().optional(),
  items: z.array(ItemSchema),
});
```
- `PlanSchema`를 다음으로 교체:
```ts
export const PlanSchema = z
  .object({
    version: z.literal(2),
    info: PlanInfoSchema,
    background: BackgroundSchema.optional(),
    walls: z.array(WallSchema),
    openings: z.array(OpeningSchema),
    rooms: z.array(RoomSchema),
    layouts: z.array(LayoutSchema).min(1),
    activeLayoutId: id,
    fixtures: z.array(FixtureSchema),
    checklist: z.array(ChecklistStateSchema),
    customProducts: z.array(ProductSchema),
  })
  .refine((p) => p.layouts.some((l) => l.id === p.activeLayoutId), {
    message: 'activeLayoutId가 layouts에 없습니다',
    path: ['activeLayoutId'],
  });
```
- 타입에 `export type Layout = z.infer<typeof LayoutSchema>;` 추가

`src/model/layout.ts` 전체 교체:
```ts
import type { Item, Layout, Plan } from './schema';

export const DEFAULT_LAYOUT_ID = 'layout-a';

// 아이템 목록은 이 함수들로만 읽고 쓴다(스펙 §14.4). 구조는 모든 배치안이 공유한다
export function activeLayout(plan: Plan): Layout {
  return plan.layouts.find((l) => l.id === plan.activeLayoutId) ?? plan.layouts[0];
}

export function activeItems(plan: Plan): Item[] {
  return activeLayout(plan).items;
}

export function withActiveItems(plan: Plan, items: Item[]): Plan {
  const id = activeLayout(plan).id;
  return { ...plan, layouts: plan.layouts.map((l) => (l.id === id ? { ...l, items } : l)) };
}
```

`src/model/samplePlan.ts`: import에 `DEFAULT_LAYOUT_ID`(from `./layout`)를 추가하고 다음으로 바꾼다.
```ts
export function emptyPlanFields(): Pick<Plan, 'layouts' | 'activeLayoutId' | 'fixtures' | 'checklist' | 'customProducts'> {
  return {
    layouts: [{ id: DEFAULT_LAYOUT_ID, name: 'A안', items: [] }],
    activeLayoutId: DEFAULT_LAYOUT_ID,
    fixtures: [],
    checklist: [],
    customProducts: [],
  };
}
```
`SAMPLE_PLAN`의 `version: 1`을 `version: 2`로 바꾼다.

`src/persistence/parse.ts`:
- import에 `import { DEFAULT_LAYOUT_ID } from '../model/layout';` 추가
- `CURRENT_VERSION = 1`을 `2`로, `MIGRATIONS`를 다음으로 교체:
```ts
// version N → N+1 변환. 스키마 버전을 올릴 때 여기에 추가한다.
const MIGRATIONS: Record<number, (raw: RawPlan) => RawPlan> = {
  // v2: 배치안 도입. 기존 아이템은 A안으로 옮긴다
  1: ({ items, ...rest }) => ({
    ...rest,
    version: 2,
    layouts: [{ id: DEFAULT_LAYOUT_ID, name: 'A안', items: Array.isArray(items) ? items : [] }],
    activeLayoutId: DEFAULT_LAYOUT_ID,
  }),
};
```

테스트·E2E 기계적 수정(동작 기대값은 바꾸지 않는다):
1. `src/**/*.test.ts`의 `X.plan.items` 읽기를 `activeItems(X.plan)`로 바꾼다. 예: `store.getState().plan.items[0]` → `activeItems(store.getState().plan)[0]`, `s.getState().plan.items.find(` → `activeItems(s.getState().plan).find(`, `st.plan.items` → `activeItems(st.plan)`. 각 파일에 `activeItems` import(상대 경로 `../model/layout` 또는 `./layout`)를 추가한다. 대상: `src/model/store.test.ts`, `src/ui/shortcuts.test.ts`.
2. `src/persistence/storage.test.ts`: `loadFromStorage(st)?.items[0].x` → `activeItems(loadFromStorage(st)!)[0].x`(2곳), import 추가.
3. 평면 리터럴에 `items:`를 넣던 곳은 `withActiveItems(base, items)`로 바꾼다.
   - `src/model/schema.test.ts`: `const bad = { ...SAMPLE_PLAN, items: [...] }` → `const bad = withActiveItems(SAMPLE_PLAN, [...])`; `verified·locked` 테스트의 `{ ...SAMPLE_PLAN, walls: [...], items: [...] }` → `withActiveItems({ ...SAMPLE_PLAN, walls: [...] }, [...])`; `'version이 1이 아니면 실패한다'` 테스트는 이름을 `'version이 2가 아니면 실패한다'`로, 값을 `version: 1`로 바꾼다.
   - `src/model/entities.test.ts`: `const plan = withActiveItems(SAMPLE_PLAN, [{ id: 'item-1', ... }])`.
   - `src/geometry/pick.test.ts`: 평면을 `withActiveItems({ version: 2 as const, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields() }, [ ...세 아이템... ])`로.
   - `src/validation/validate.test.ts`: 팩토리를 다음으로 교체(호출부는 그대로):
```ts
const plan = ({ items = [], ...over }: Partial<Plan> & { items?: Item[] }): Plan =>
  withActiveItems({ version: 2, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields(), ...over }, items);
```
   - `src/editor2d/tools.test.ts`: `version: 1 as const` → `version: 2 as const`.
4. `src/persistence/parse.test.ts`: `'현재 버전은 그대로 돌려준다'`의 `{ version: 1, a: 1 }` → `{ version: 2, a: 1 }`; `'parsePlan은 버전이 다르면 실패한다'`는 `version: 3`과 메시지 `'지원하지 않는 파일 버전입니다: 3'`으로; `'변환이 없거나 현재보다 높은 버전은 null'`의 `migrate({ version: 2 })` → `migrate({ version: 3 })`.
5. `e2e/placement.spec.ts`:
```ts
const itemCount = (page: Page) =>
  page.evaluate(() => {
    const p = window.__homefit!.store.getState().plan;
    return p.layouts.find((l) => l.id === p.activeLayoutId)!.items.length;
  });
```
   첫 테스트의 `const it = s.plan.items[0];` → `const it = s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items[0];`, `s.select(s.plan.items[1].id);` → `s.select(s.plan.layouts.find((l) => l.id === s.plan.activeLayoutId)!.items[1].id);`
6. `e2e/editor2d.spec.ts`: 파일 상단에 `const itemsOf = (plan: Awaited<ReturnType<typeof getPlan>>) => plan.layouts.find((l) => l.id === plan.activeLayoutId)!.items;`를 두고 `(await getPlan(page)).items` → `itemsOf(await getPlan(page))`로 바꾼다.

- [ ] **Step 4: 통과 확인**

Run:
```bash
npx vitest run
npm run typecheck
grep -rn -E 'plan\.items|\.items\[' src --include='*.ts' --include='*.tsx' | grep -v 'src/model/layout.ts'
npm run e2e
```
Expected: 전체 PASS(비공개 프리셋 테스트 포함 — v1 파일이 마이그레이션된다), typecheck 오류 없음, grep 결과 없음, E2E 9 passed

- [ ] **Step 5: Commit**

```bash
git add src/model/schema.ts src/model/layout.ts src/model/layout.test.ts src/model/samplePlan.ts src/persistence/parse.ts src/persistence/parse.test.ts src/persistence/storage.test.ts src/model/schema.test.ts src/model/entities.test.ts src/model/store.test.ts src/geometry/pick.test.ts src/validation/validate.test.ts src/ui/shortcuts.test.ts src/editor2d/tools.test.ts e2e/placement.spec.ts e2e/editor2d.spec.ts
git commit -m "feat: plan schema v2 with layouts and v1 migration"
```

---

### Task 2: 배치안 액션(복제·이름·메모·삭제·전환)과 비교 대상 아이템

**Files:**
- Modify: `src/model/store.ts`, `src/model/layout.ts`
- Test: `src/model/store.test.ts`, `src/model/layout.test.ts`

**Interfaces:**
- Consumes: `activeLayout`, `newId`, `validatePlan` (테스트용)
- Produces:
  - `nextLayoutName(names: string[]): string` — `A안`…`Z안` 중 처음 비는 이름, 다 차면 `배치안 N`
  - `compareItems(plan: Plan, layoutId: string | null): Item[]` — 활성 배치안이 아니고 존재하는 배치안이면 그 아이템, 아니면 `[]`
  - 스토어: `addLayout(): string`(활성 배치안을 새 아이템 id로 복제하고 활성화, 선택 해제), `renameLayout(id, name)`(공백이면 무시), `setLayoutMemo(id, memo)`(빈 문자열은 메모 삭제), `removeLayout(id)`(1개 남으면 무시, 활성 배치안이면 남은 첫 배치안 활성화+선택 해제), `switchLayout(id)`(선택 해제). 모두 실행 취소 한 단계

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/layout.test.ts`에 추가(import에 `compareItems`, `nextLayoutName` 추가):
```ts
describe('nextLayoutName / compareItems', () => {
  it('처음 비는 알파벳 이름을 고른다', () => {
    expect(nextLayoutName(['A안'])).toBe('B안');
    expect(nextLayoutName(['A안', 'C안'])).toBe('B안');
  });

  it('비교 대상은 활성 배치안이 아닌 존재하는 배치안만', () => {
    const b = { id: 'layout-b', name: 'B안', items: [{ id: 'x', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }] };
    const plan = { ...SAMPLE_PLAN, layouts: [...SAMPLE_PLAN.layouts, b] };
    expect(compareItems(plan, 'layout-b')).toBe(b.items);
    expect(compareItems(plan, 'layout-a')).toEqual([]);
    expect(compareItems(plan, 'nope')).toEqual([]);
    expect(compareItems(plan, null)).toEqual([]);
  });
});
```

`src/model/store.test.ts` 끝에 추가(import에 `findProduct`(`../catalog/products`), `validatePlan`(`../validation/validate`) 추가):
```ts
describe('배치안', () => {
  it('복제하면 아이템을 새 id로 복사한 B안이 활성화되고 실행 취소 한 번에 사라진다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const itemId = s.getState().addItem(P, V, { x: 100, y: 100 });
    const pastLen = s.getState().past.length;
    const id = s.getState().addLayout();
    const plan = s.getState().plan;
    expect(plan.activeLayoutId).toBe(id);
    expect(plan.layouts.map((l) => l.name)).toEqual(['A안', 'B안']);
    expect(activeItems(plan)[0]).toMatchObject({ x: 100, y: 100 });
    expect(activeItems(plan)[0].id).not.toBe(itemId);
    expect(s.getState().selectedId).toBeNull();
    expect(s.getState().past.length).toBe(pastLen + 1);
    s.getState().undo();
    expect(s.getState().plan.layouts).toHaveLength(1);
  });

  it('B안에서 옮겨도 A안은 그대로다 (F09)', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 100, y: 100 });
    s.getState().addLayout();
    const moved = activeItems(s.getState().plan)[0].id;
    s.getState().updateItem(moved, { x: 300 });
    s.getState().switchLayout('layout-a');
    expect(activeItems(s.getState().plan)[0].x).toBe(100);
  });

  it('벽을 추가하면 모든 배치안에서 보이고, 전환하면 그 배치안 기준으로 간섭을 다시 계산한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem(P, V, { x: 100, y: 100 });
    const b = s.getState().addLayout();
    s.getState().updateItem(activeItems(s.getState().plan)[0].id, { x: 250 });
    s.getState().addWalls([{ a: { x: 100, y: 40 }, b: { x: 100, y: 160 }, thickness: 10, height: 230 }]);
    const status = () => {
      const plan = s.getState().plan;
      return Object.values(validatePlan(plan, (id) => findProduct(plan, id)))[0].collides;
    };
    expect(status()).toBe(false);
    s.getState().switchLayout('layout-a');
    expect(s.getState().plan.walls).toHaveLength(6);
    expect(status()).toBe(true);
    s.getState().switchLayout(b);
    expect(status()).toBe(false);
  });

  it('이름과 메모를 바꾸고, 빈 이름은 무시한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().renameLayout('layout-a', '  창가 소파안 ');
    s.getState().renameLayout('layout-a', '   ');
    s.getState().setLayoutMemo('layout-a', '거실 넓게');
    expect(s.getState().plan.layouts[0]).toMatchObject({ name: '창가 소파안', memo: '거실 넓게' });
    s.getState().setLayoutMemo('layout-a', '');
    expect(s.getState().plan.layouts[0].memo).toBeUndefined();
  });

  it('활성 배치안을 지우면 남은 첫 배치안이 활성화된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const b = s.getState().addLayout();
    s.getState().removeLayout(b);
    expect(s.getState().plan.activeLayoutId).toBe('layout-a');
    expect(s.getState().plan.layouts).toHaveLength(1);
  });

  it('마지막 배치안은 지울 수 없다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const pastLen = s.getState().past.length;
    s.getState().removeLayout('layout-a');
    expect(s.getState().plan.layouts).toHaveLength(1);
    expect(s.getState().past.length).toBe(pastLen);
  });

  it('없는 배치안이나 이미 활성인 배치안으로의 전환은 히스토리를 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const pastLen = s.getState().past.length;
    s.getState().switchLayout('layout-a');
    s.getState().switchLayout('nope');
    expect(s.getState().past.length).toBe(pastLen);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model`
Expected: 새 함수·액션 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/model/layout.ts` 끝에 추가:
```ts
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function nextLayoutName(names: string[]): string {
  for (const c of LETTERS) {
    const name = `${c}안`;
    if (!names.includes(name)) return name;
  }
  return `배치안 ${names.length + 1}`;
}

export function compareItems(plan: Plan, layoutId: string | null): Item[] {
  if (!layoutId || layoutId === activeLayout(plan).id) return [];
  return plan.layouts.find((l) => l.id === layoutId)?.items ?? [];
}
```

`src/model/store.ts`:
- import를 `import { activeItems, activeLayout, nextLayoutName, withActiveItems } from './layout';`로 바꾼다
- `PlanState` 타입에 추가:
```ts
  addLayout(): string;
  renameLayout(id: string, name: string): void;
  setLayoutMemo(id: string, memo: string): void;
  removeLayout(id: string): void;
  switchLayout(id: string): void;
```
- 스토어 객체(`setBackground` 앞)에 추가:
```ts
      addLayout: () => {
        const plan = get().plan;
        const source = activeLayout(plan);
        const layout = {
          id: newId('layout'),
          name: nextLayoutName(plan.layouts.map((l) => l.name)),
          items: source.items.map((i) => ({ ...i, id: newId('item') })),
        };
        commit({ ...plan, layouts: [...plan.layouts, layout], activeLayoutId: layout.id }, { selectedId: null });
        return layout.id;
      },

      renameLayout: (id, name) => {
        const plan = get().plan;
        const trimmed = name.trim();
        if (!trimmed || !plan.layouts.some((l) => l.id === id)) return;
        commit({ ...plan, layouts: plan.layouts.map((l) => (l.id === id ? { ...l, name: trimmed } : l)) });
      },

      setLayoutMemo: (id, memo) => {
        const plan = get().plan;
        if (!plan.layouts.some((l) => l.id === id)) return;
        const trimmed = memo.trim();
        commit({
          ...plan,
          layouts: plan.layouts.map((l) => {
            if (l.id !== id) return l;
            const next: Layout = { ...l };
            delete next.memo;
            return trimmed ? { ...next, memo: trimmed } : next;
          }),
        });
      },

      removeLayout: (id) => {
        const plan = get().plan;
        if (plan.layouts.length <= 1 || !plan.layouts.some((l) => l.id === id)) return;
        const layouts = plan.layouts.filter((l) => l.id !== id);
        const wasActive = activeLayout(plan).id === id;
        commit(
          { ...plan, layouts, activeLayoutId: wasActive ? layouts[0].id : plan.activeLayoutId },
          wasActive ? { selectedId: null } : {},
        );
      },

      switchLayout: (id) => {
        const plan = get().plan;
        if (id === activeLayout(plan).id || !plan.layouts.some((l) => l.id === id)) return;
        commit({ ...plan, activeLayoutId: id }, { selectedId: null });
      },
```
(`Layout` 타입을 `./schema` import에 추가한다.)

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/model && npm run typecheck && npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/model/store.ts src/model/store.test.ts src/model/layout.ts src/model/layout.test.ts
git commit -m "feat: layout actions to duplicate, rename, annotate, remove and switch layouts"
```

---

### Task 3: 간섭 사유와 경고 설명

**Files:**
- Modify: `src/geometry/walls.ts`, `src/validation/validate.ts`, `src/ui/properties/ItemProperties.tsx`, `src/styles.css`
- Create: `src/validation/describe.ts`, `src/validation/describe.test.ts`
- Test: `src/validation/validate.test.ts`, `src/geometry/walls.test.ts`

**Interfaces:**
- Consumes: `wallSolidObbs`, `doorSwing`, `itemClearances`, `obbOverlap`, `itemObb`, `activeItems`, `findProduct`
- Produces:
  - `planWallObbsWithIds(plan: Plan): { wallId: string; obb: OBB }[]` (`planWallObbs`는 이것을 쓴다)
  - `type ConflictTarget = { kind: 'item' | 'wall' | 'door'; id: string }`, `type Conflict = { type: 'collides' | 'clearance' | 'blocksDoor'; target: ConflictTarget }`
  - `ItemStatus = { collides; clearanceBlocked; blocksDoor; conflicts: Conflict[] }` — 같은 (type, target)은 한 번만
  - `conflictLines(status: ItemStatus, plan: Plan): string[]` — 예 `['충돌: 3인 소파, 벽', '문 열림 공간 부족: 벽', '방문 열림 간섭: 문']`
  - 속성창 배지(`충돌`, `방문 열림 간섭`, `문 열림 공간 부족`)를 누르면(`aria-expanded`) 사유 목록 `data-testid="conflict-details"`가 펼쳐진다

- [ ] **Step 1: 실패하는 테스트 작성**

`src/validation/validate.test.ts`:
- 기존 `toEqual({ collides: ..., clearanceBlocked: ..., blocksDoor: ... })` 4곳을 `toMatchObject({...})`로 바꾼다(기대값 그대로).
- 추가:
```ts
  it('사유에 상대 아이템·벽·문을 담고 같은 대상은 한 번만', () => {
    const walls = [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 20, height: 230 }];
    const openings = [{ id: 'o', wallId: 'w', kind: 'door' as const, offset: 200, width: 80, height: 210, sill: 0, hinge: 'start' as const, swingIn: true }];
    const s = validatePlan(plan({ walls, openings, items: [item('a', 'cube', 100, 20), item('b', 'cube', 120, 30), item('c', 'cube', 240, 50)] }), resolve);
    expect(s.a.conflicts).toEqual([
      { type: 'collides', target: { kind: 'wall', id: 'w' } },
      { type: 'collides', target: { kind: 'item', id: 'b' } },
    ]);
    expect(s.c.conflicts).toEqual([{ type: 'blocksDoor', target: { kind: 'door', id: 'o' } }]);
  });
```

`src/geometry/walls.test.ts`에 추가(import에 `planWallObbsWithIds`):
```ts
describe('planWallObbsWithIds', () => {
  it('문으로 나뉜 조각마다 벽 id를 붙인다', () => {
    const plan = { ...SAMPLE_PLAN, walls: [wall], openings: [opening({})] };
    expect(planWallObbsWithIds(plan).map((x) => x.wallId)).toEqual(['w', 'w']);
  });
});
```
(파일 상단에 `import { SAMPLE_PLAN } from '../model/samplePlan';` 추가)

`src/validation/describe.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { conflictLines } from './describe';

const sofa = CATALOG.find((p) => p.id === 'sofa-3seat')!;

describe('conflictLines', () => {
  it('사유를 종류별 한국어 문장으로', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [{ id: 'b', productId: sofa.id, variantId: 'gray', x: 0, y: 0, rotation: 0 }]);
    const lines = conflictLines(
      {
        collides: true,
        clearanceBlocked: true,
        blocksDoor: true,
        conflicts: [
          { type: 'collides', target: { kind: 'item', id: 'b' } },
          { type: 'collides', target: { kind: 'wall', id: 'w1' } },
          { type: 'clearance', target: { kind: 'wall', id: 'w1' } },
          { type: 'blocksDoor', target: { kind: 'door', id: 'o1' } },
        ],
      },
      plan,
    );
    expect(lines).toEqual(['충돌: 3인 소파, 벽', '문 열림 공간 부족: 벽', '방문 열림 간섭: 문']);
  });

  it('사라진 아이템은 알 수 없는 제품', () => {
    const lines = conflictLines(
      { collides: true, clearanceBlocked: false, blocksDoor: false, conflicts: [{ type: 'collides', target: { kind: 'item', id: 'gone' } }] },
      SAMPLE_PLAN,
    );
    expect(lines).toEqual(['충돌: 알 수 없는 제품']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/validation src/geometry/walls.test.ts`
Expected: FAIL(conflicts·describe·planWallObbsWithIds 없음)

- [ ] **Step 3: 구현**

`src/geometry/walls.ts`의 `planWallObbs`를 다음으로 교체:
```ts
export function planWallObbsWithIds(plan: Plan): { wallId: string; obb: OBB }[] {
  return plan.walls.flatMap((w) =>
    wallSolidObbs(w, plan.openings.filter((o) => o.wallId === w.id)).map((obb) => ({ wallId: w.id, obb })),
  );
}

export function planWallObbs(plan: Plan): OBB[] {
  return planWallObbsWithIds(plan).map((x) => x.obb);
}
```

`src/validation/validate.ts` 전체 교체:
```ts
import { doorSwing, itemClearances } from '../geometry/clearance';
import { itemObb, obbOverlap, type OBB } from '../geometry/obb';
import { planWallObbsWithIds } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Plan, Product } from '../model/schema';

export type ConflictTarget = { kind: 'item' | 'wall' | 'door'; id: string };
export type Conflict = { type: 'collides' | 'clearance' | 'blocksDoor'; target: ConflictTarget };
export type ItemStatus = { collides: boolean; clearanceBlocked: boolean; blocksDoor: boolean; conflicts: Conflict[] };

type Obstacle = { target: ConflictTarget; obb: OBB };

function statusOf(conflicts: Conflict[]): ItemStatus {
  return {
    collides: conflicts.some((c) => c.type === 'collides'),
    clearanceBlocked: conflicts.some((c) => c.type === 'clearance'),
    blocksDoor: conflicts.some((c) => c.type === 'blocksDoor'),
    conflicts,
  };
}

export function validatePlan(plan: Plan, resolve: (productId: string) => Product | undefined): Record<string, ItemStatus> {
  const walls: Obstacle[] = planWallObbsWithIds(plan).map(({ wallId, obb }) => ({ target: { kind: 'wall', id: wallId }, obb }));
  const wallById = new Map(plan.walls.map((w) => [w.id, w]));
  const doors: Obstacle[] = plan.openings.flatMap((o) => {
    const w = wallById.get(o.wallId);
    return w && o.kind === 'door' ? [{ target: { kind: 'door' as const, id: o.id }, obb: doorSwing(w, o).obb }] : [];
  });
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    if (!product) return [];
    return [{ item, product, fp: itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d) }];
  });
  const floor = placed.filter((p) => p.product.mount === 'floor');

  const result: Record<string, ItemStatus> = {};
  for (const item of activeItems(plan)) result[item.id] = statusOf([]);
  for (const p of placed) {
    const conflicts: Conflict[] = [];
    const seen = new Set<string>();
    const add = (type: Conflict['type'], shape: OBB, obstacles: Obstacle[]) => {
      for (const o of obstacles) {
        const key = `${type}:${o.target.kind}:${o.target.id}`;
        if (seen.has(key) || !obbOverlap(shape, o.obb)) continue;
        seen.add(key);
        conflicts.push({ type, target: o.target });
      }
    };
    if (p.product.mount === 'wall') {
      add('collides', p.fp, walls);
      result[p.item.id] = statusOf(conflicts);
      continue;
    }
    const others: Obstacle[] = floor
      .filter((o) => o.item.id !== p.item.id)
      .map((o) => ({ target: { kind: 'item', id: o.item.id }, obb: o.fp }));
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

`src/validation/describe.ts`:
```ts
import { findProduct } from '../catalog/products';
import { activeItems } from '../model/layout';
import type { Plan } from '../model/schema';
import type { Conflict, ItemStatus } from './validate';

const TYPE_LABEL: Record<Conflict['type'], string> = {
  collides: '충돌',
  clearance: '문 열림 공간 부족',
  blocksDoor: '방문 열림 간섭',
};

function targetName(plan: Plan, c: Conflict): string {
  if (c.target.kind === 'wall') return '벽';
  if (c.target.kind === 'door') return '문';
  const item = activeItems(plan).find((i) => i.id === c.target.id);
  return (item && findProduct(plan, item.productId)?.name) || '알 수 없는 제품';
}

export function conflictLines(status: ItemStatus, plan: Plan): string[] {
  return (Object.keys(TYPE_LABEL) as Conflict['type'][]).flatMap((type) => {
    const names = [...new Set(status.conflicts.filter((c) => c.type === type).map((c) => targetName(plan, c)))];
    return names.length ? [`${TYPE_LABEL[type]}: ${names.join(', ')}`] : [];
  });
}
```

`src/ui/properties/ItemProperties.tsx`: 배지 영역을 다음으로 교체(`useState` import, `conflictLines` import):
```tsx
      {st && (st.collides || st.blocksDoor || st.clearanceBlocked) && (
        <>
          <div className="badges">
            {st.collides && (
              <button type="button" className="badge danger" data-testid="status-collides" aria-expanded={open} onClick={() => setOpen(!open)}>충돌</button>
            )}
            {st.blocksDoor && (
              <button type="button" className="badge danger" data-testid="status-blocks-door" aria-expanded={open} onClick={() => setOpen(!open)}>방문 열림 간섭</button>
            )}
            {st.clearanceBlocked && (
              <button type="button" className="badge warn" data-testid="status-clearance" aria-expanded={open} onClick={() => setOpen(!open)}>문 열림 공간 부족</button>
            )}
          </div>
          {open && (
            <ul className="conflicts" data-testid="conflict-details">
              {conflictLines(st, plan).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          )}
        </>
      )}
```
컴포넌트 맨 위에 `const [open, setOpen] = useState(false);`를 둔다(다른 아이템을 고르면 `PropertiesPanel`이 같은 컴포넌트를 재사용하므로, `PropertiesPanel.tsx`에서 `<ItemProperties key={entity.item.id} item={entity.item} />`로 key를 준다).

`src/styles.css` 끝에 추가:
```css
button.badge { border: 0; cursor: pointer; font: inherit; font-size: 12px; }
.conflicts { margin: 0 0 8px; padding-left: 18px; font-size: 12px; color: #b42318; }
```

- [ ] **Step 4: 통과와 브라우저 확인**

Run: `npx vitest run src/validation src/geometry && npm run typecheck && npm test && npm run e2e`
Expected: PASS(E2E의 `status-collides` 가시성 확인은 버튼이어도 그대로 통과)

브라우저 확인(일회용 Playwright, scratchpad): 소파 두 개를 겹치고 벽에 걸친 뒤 속성창 `충돌` 배지를 누르면 `conflict-details`에 `충돌: 3인 소파, 벽`이 보인다. pageerror 없음.

- [ ] **Step 5: Commit**

```bash
git add src/geometry/walls.ts src/geometry/walls.test.ts src/validation src/ui/properties/ItemProperties.tsx src/ui/PropertiesPanel.tsx src/styles.css
git commit -m "feat: conflict reasons in validation and expandable warning details"
```

---
### Task 4: 복구 이력

**Files:**
- Create: `src/persistence/revisions.ts`, `src/persistence/revisions.test.ts`, `src/ui/HistoryPanel.tsx`
- Modify: `src/persistence/storage.ts` (`defaultStorage` export), `src/main.tsx`, `src/ui/uiStore.ts`, `src/ui/uiStore.test.ts`, `src/ui/Toolbar.tsx`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `parsePlan`, `newId`, 스토어 `replacePlan`/`undo`, `useUi`
- Produces:
  - `REVISIONS_KEY = 'homefit:revisions:v1'`, `MAX_REVISIONS = 20`, `AUTO_REVISION_MS = 300000`
  - `type Revision = { id: string; at: number; label?: string; plan: Plan }`
  - `loadRevisions(storage?): Revision[]`(깨진 항목은 건너뛰고 v1 평면은 마이그레이션), `saveRevisions(list, storage?): boolean`, `addRevision(list, plan, now, label?): Revision[]`(최근 20개), `shouldAutoSnapshot(list, now, interval?): boolean`, `recordAutoRevision(plan, now, storage?): boolean`, `formatRevisionTime(at): string`(`YYYY-MM-DD HH:MM`)
  - `useUi`: `historyOpen: boolean`, `setHistoryOpen(open: boolean)`
  - 툴바 `이력` 버튼 → `<HistoryPanel />`(`role="dialog"`, `aria-label="복구 이력"`, `data-testid="history-panel"`): `버전 이름` 입력 + `지금 버전 저장`, 최신순 목록(시각·이름·배치안 수·벽 수) + `복원`, `닫기`
  - 자동 저장이 성공할 때마다 마지막 이력에서 5분이 지났으면 스냅샷 1개 추가

- [ ] **Step 1: 실패하는 테스트 작성**

`src/persistence/revisions.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { activeItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import {
  addRevision, AUTO_REVISION_MS, formatRevisionTime, loadRevisions, MAX_REVISIONS, recordAutoRevision, REVISIONS_KEY, saveRevisions, shouldAutoSnapshot,
} from './revisions';

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

describe('revisions', () => {
  it('최근 20개만 남기고 이름은 앞뒤 공백을 지운다', () => {
    let list = addRevision([], SAMPLE_PLAN, 0, '  처음 ');
    expect(list[0]).toMatchObject({ at: 0, label: '처음', plan: SAMPLE_PLAN });
    for (let i = 1; i <= 25; i++) list = addRevision(list, SAMPLE_PLAN, i);
    expect(list).toHaveLength(MAX_REVISIONS);
    expect(list[0].at).toBe(6);
  });

  it('저장한 이력을 다시 읽고, 깨진 항목은 건너뛴다', () => {
    const st = memoryStorage();
    const list = addRevision([], SAMPLE_PLAN, 10);
    expect(saveRevisions(list, st)).toBe(true);
    const raw = JSON.parse(st.getItem(REVISIONS_KEY)!);
    st.setItem(REVISIONS_KEY, JSON.stringify([...raw, { id: 'x', at: 1, plan: { version: 9 } }, 'junk']));
    expect(loadRevisions(st)).toEqual(list);
  });

  it('v1 평면 이력도 v2로 읽는다', () => {
    const st = memoryStorage();
    const v1 = { version: 1, info: SAMPLE_PLAN.info, walls: [], openings: [], rooms: [], items: [], fixtures: [], checklist: [], customProducts: [] };
    st.setItem(REVISIONS_KEY, JSON.stringify([{ id: 'r', at: 5, plan: v1 }]));
    expect(loadRevisions(st)[0].plan.layouts[0].name).toBe('A안');
  });

  it('저장소가 throw하면 빈 목록과 false', () => {
    const st = throwingStorage();
    expect(loadRevisions(st)).toEqual([]);
    expect(saveRevisions([], st)).toBe(false);
    expect(recordAutoRevision(SAMPLE_PLAN, 0, st)).toBe(false);
  });

  it('자동 스냅샷은 마지막 이력에서 5분이 지났을 때만', () => {
    const st = memoryStorage();
    expect(recordAutoRevision(SAMPLE_PLAN, 1000, st)).toBe(true);
    expect(recordAutoRevision(SAMPLE_PLAN, 1000 + AUTO_REVISION_MS - 1, st)).toBe(false);
    expect(recordAutoRevision(SAMPLE_PLAN, 1000 + AUTO_REVISION_MS, st)).toBe(true);
    expect(loadRevisions(st)).toHaveLength(2);
    expect(shouldAutoSnapshot([], 0)).toBe(true);
  });

  it('시각을 YYYY-MM-DD HH:MM로', () => {
    expect(formatRevisionTime(new Date(2026, 9, 8, 9, 5).getTime())).toBe('2026-10-08 09:05');
  });

  it('복원은 실행 취소 한 번으로 되돌아간다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().addItem('p', 'v', { x: 0, y: 0 });
    const current = s.getState().plan;
    s.getState().replacePlan(addRevision([], SAMPLE_PLAN, 0)[0].plan);
    expect(activeItems(s.getState().plan)).toEqual([]);
    s.getState().undo();
    expect(s.getState().plan).toBe(current);
  });
});
```

`src/ui/uiStore.test.ts`에 추가:
```ts
  it('이력 패널 열고 닫기', () => {
    useUi.getState().setHistoryOpen(true);
    expect(useUi.getState().historyOpen).toBe(true);
    useUi.getState().setHistoryOpen(false);
    expect(useUi.getState().historyOpen).toBe(false);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/persistence/revisions.test.ts src/ui/uiStore.test.ts`
Expected: 모듈·액션 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/persistence/storage.ts`: `function defaultStorage()`를 `export function defaultStorage()`로 바꾼다.

`src/persistence/revisions.ts`:
```ts
import { newId } from '../model/ids';
import type { Plan } from '../model/schema';
import { parsePlan } from './parse';
import { defaultStorage } from './storage';

export const REVISIONS_KEY = 'homefit:revisions:v1';
export const MAX_REVISIONS = 20;
export const AUTO_REVISION_MS = 5 * 60 * 1000;

export type Revision = { id: string; at: number; label?: string; plan: Plan };

export function loadRevisions(storage: Storage | undefined = defaultStorage()): Revision[] {
  let raw: string | null | undefined;
  try {
    raw = storage?.getItem(REVISIONS_KEY);
  } catch {
    return [];
  }
  if (!raw) return [];
  let list: unknown;
  try {
    list = JSON.parse(raw);
  } catch {
    return [];
  }
  if (!Array.isArray(list)) return [];
  return list.flatMap((entry: unknown): Revision[] => {
    if (typeof entry !== 'object' || entry === null) return [];
    const { id, at, label, plan } = entry as Record<string, unknown>;
    if (typeof id !== 'string' || typeof at !== 'number') return [];
    const parsed = parsePlan(plan);
    if (!parsed.ok) return [];
    return [{ id, at, ...(typeof label === 'string' ? { label } : {}), plan: parsed.plan }];
  });
}

export function saveRevisions(list: Revision[], storage: Storage | undefined = defaultStorage()): boolean {
  try {
    if (!storage) return false;
    storage.setItem(REVISIONS_KEY, JSON.stringify(list));
    return true;
  } catch {
    return false;
  }
}

export function addRevision(list: Revision[], plan: Plan, now: number, label?: string): Revision[] {
  const trimmed = label?.trim();
  const revision: Revision = { id: newId('rev'), at: now, ...(trimmed ? { label: trimmed } : {}), plan };
  return [...list, revision].slice(-MAX_REVISIONS);
}

export function shouldAutoSnapshot(list: Revision[], now: number, interval = AUTO_REVISION_MS): boolean {
  const last = list[list.length - 1];
  return !last || now - last.at >= interval;
}

export function recordAutoRevision(plan: Plan, now: number, storage: Storage | undefined = defaultStorage()): boolean {
  const list = loadRevisions(storage);
  if (!shouldAutoSnapshot(list, now)) return false;
  return saveRevisions(addRevision(list, plan, now), storage);
}

const two = (n: number) => String(n).padStart(2, '0');

export function formatRevisionTime(at: number): string {
  const d = new Date(at);
  return `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())} ${two(d.getHours())}:${two(d.getMinutes())}`;
}
```

`src/ui/uiStore.ts`: 상태에 `historyOpen: boolean`(기본 false)과 액션 `setHistoryOpen(open: boolean): void` → `set({ historyOpen: open })`를 추가한다.

`src/main.tsx`: `import { recordAutoRevision } from './persistence/revisions';`를 추가하고 `onResult`의 `if (ok) { saveFailedShown = false; return; }`를 다음으로 바꾼다.
```ts
    if (ok) {
      saveFailedShown = false;
      recordAutoRevision(store.getState().plan, Date.now());
      return;
    }
```

`src/ui/HistoryPanel.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { usePlanStore } from '../model/StoreContext';
import { addRevision, formatRevisionTime, loadRevisions, MAX_REVISIONS, saveRevisions, type Revision } from '../persistence/revisions';
import { useUi } from './uiStore';

export function HistoryPanel() {
  const store = usePlanStore();
  const open = useUi((s) => s.historyOpen);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [label, setLabel] = useState('');

  useEffect(() => {
    if (open) setRevisions(loadRevisions());
  }, [open]);

  if (!open) return null;
  const ui = useUi.getState();

  const saveNow = () => {
    const next = addRevision(loadRevisions(), store.getState().plan, Date.now(), label);
    if (!saveRevisions(next)) {
      ui.showBanner({ kind: 'error', text: '이력을 저장하지 못했습니다. 브라우저 저장 공간을 확인하세요.' });
      return;
    }
    setRevisions(next);
    setLabel('');
    ui.showBanner({ kind: 'info', text: '현재 상태를 이력에 저장했습니다.' });
  };

  const restore = (r: Revision) => {
    store.getState().replacePlan(r.plan);
    ui.resetView();
    ui.setHistoryOpen(false);
    ui.showBanner({ kind: 'info', text: `${formatRevisionTime(r.at)} 버전으로 복원했습니다. 실행 취소로 되돌릴 수 있습니다.` });
  };

  return (
    <div className="history" role="dialog" aria-label="복구 이력" data-testid="history-panel">
      <div className="history-head">
        <h3>복구 이력</h3>
        <button type="button" aria-label="닫기" onClick={() => ui.setHistoryOpen(false)}>×</button>
      </div>
      <p className="muted">자동 저장 중 5분마다 한 번, 최근 {MAX_REVISIONS}개까지 이 브라우저에 보관합니다.</p>
      <div className="row">
        <input aria-label="버전 이름" placeholder="버전 이름(선택)" value={label} onChange={(e) => setLabel(e.target.value)} />
        <button type="button" onClick={saveNow}>지금 버전 저장</button>
      </div>
      {revisions.length === 0 ? (
        <p className="muted">저장된 이력이 없습니다.</p>
      ) : (
        <ul className="history-list">
          {[...revisions].reverse().map((r) => (
            <li key={r.id}>
              <div>
                <strong>{formatRevisionTime(r.at)}</strong>
                {r.label ? ` · ${r.label}` : ''}
              </div>
              <div className="muted">
                배치안 {r.plan.layouts.length}개 · 벽 {r.plan.walls.length}개
              </div>
              <button type="button" onClick={() => restore(r)}>복원</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/ui/Toolbar.tsx`: `실행 취소` 버튼 앞 구분선(`<span className="sep" />`) 다음에 `<button type="button" aria-pressed={historyOpen} onClick={() => ui.setHistoryOpen(!historyOpen)}>이력</button>`를 넣고, 컴포넌트 위에 `const historyOpen = useUi((s) => s.historyOpen);`를 추가한다.

`src/App.tsx`: `<main className="center">` 안의 `<CandidatePicker />` 다음에 `<HistoryPanel />`을 넣고 import한다.

`src/styles.css` 끝에 추가:
```css
.history { position: absolute; top: 12px; right: 12px; z-index: 15; width: 320px; max-height: calc(100% - 24px); overflow-y: auto; background: #fff; border: 1px solid #d6d0c4; border-radius: 8px; padding: 12px; box-shadow: 0 6px 18px rgba(0, 0, 0, 0.14); }
.history-head { display: flex; justify-content: space-between; align-items: center; }
.history-head h3 { margin: 0; font-size: 14px; }
.history input { flex: 1; min-width: 0; padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; }
.history-list { list-style: none; margin: 8px 0 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.history-list li { border: 1px solid #e5e1d8; border-radius: 6px; padding: 8px; font-size: 13px; display: flex; flex-direction: column; gap: 4px; }
```

- [ ] **Step 4: 통과와 브라우저 확인**

Run: `npx vitest run src/persistence src/ui && npm run typecheck && npm test && npm run e2e`
Expected: PASS

브라우저 확인(일회용 Playwright, scratchpad): `이력` → `버전 이름` `처음` → `지금 버전 저장` → 닫기 → 소파 추가 → `이력` → 목록 1개(`처음`) → `복원` → 소파 없음 → `Ctrl+Z` → 소파 다시 있음. pageerror 없음.

- [ ] **Step 5: Commit**

```bash
git add src/persistence/revisions.ts src/persistence/revisions.test.ts src/persistence/storage.ts src/main.tsx src/ui/uiStore.ts src/ui/uiStore.test.ts src/ui/HistoryPanel.tsx src/ui/Toolbar.tsx src/App.tsx src/styles.css
git commit -m "feat: local revision history with auto snapshots and undoable restore"
```

---

### Task 5: PNG 내보내기(2D 배치도, 3D 화면)

**Files:**
- Create: `src/export/planSvg.ts`, `src/export/planSvg.test.ts`, `src/export/png.ts`, `src/scene3d/CaptureBridge.tsx`, `src/ui/ExportButtons.tsx`
- Modify: `src/persistence/file.ts`, `src/scene3d/Viewport.tsx`, `src/ui/Toolbar.tsx`

**Interfaces:**
- Consumes: `planBounds`, `wallObb`, `wallDir`, `wallLength`, `openingObb`, `doorSwing`, `itemObb`, `corners`, `pointsAttr`, `sectorPath`, `itemColor`, `MISSING_COLOR`, `findProduct`, `activeItems`, `activeLayout`
- Produces:
  - `EXPORT_PX_PER_CM = 2`, `escapeXml(s): string`, `unverifiedCount(plan): number`(벽·개구부·활성 배치안 아이템 중 실측 미확인 수), `exportFileName(title, layoutName, kind: '2d' | '3d'): string`(`homefit-<제목>-<배치안>-<kind>.png`, 파일명에 못 쓰는 문자와 공백은 `-`)
  - `planSvg(plan): { svg: string; width: number; height: number }` — 화면 CSS 없이 presentation 속성만 쓰는 독립 SVG. 머리글(제목 · 배치안 이름, `단위: cm · ≈ 표시는 실측 미확인 치수 (N개)`), 방 이름, 가구(이름과 `W×D`, 미확인이면 앞에 `≈`), 벽(길이, 미확인 `≈`), 개구부(폭, 미확인 `≈`, 문 열림 부채꼴). 배경 이미지는 넣지 않는다
  - `svgToPngBlob(svg, width, height): Promise<Blob>`, `canvasWithHeader(source: HTMLCanvasElement, lines: string[]): Promise<Blob>` (브라우저 전용)
  - `downloadBlob(blob: Blob, filename: string): void` (`downloadText`는 이것을 쓴다)
  - `capture3d: { current: (() => HTMLCanvasElement) | null }`
  - 배치 모드 툴바 `2D PNG`, `3D PNG`(2D 보기에서는 비활성)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/export/planSvg.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import { escapeXml, exportFileName, planSvg, unverifiedCount } from './planSvg';

const sofa = { id: 's', productId: 'sofa-3seat', variantId: 'gray', x: 175, y: 200, rotation: 0 };

describe('planSvg', () => {
  it('머리글에 제목·배치안 이름·단위·미확인 수를 넣는다', () => {
    const { svg, width, height } = planSvg(SAMPLE_PLAN);
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg).toContain('샘플 평면 · A안');
    expect(svg).toContain('단위: cm · ≈ 표시는 실측 미확인 치수 (7개)');
    expect(width).toBe(1520);
    expect(height).toBe(1260);
  });

  it('미확인 벽 길이는 ≈, 확인된 길이는 숫자만', () => {
    expect(planSvg(SAMPLE_PLAN).svg).toContain('>≈600<');
    const verified = { ...SAMPLE_PLAN, walls: SAMPLE_PLAN.walls.map((w) => ({ ...w, verified: true })) };
    expect(planSvg(verified).svg).toContain('>600<');
    expect(planSvg(verified).svg).not.toContain('>≈600<');
  });

  it('가구 이름과 치수, 미확인이면 ≈', () => {
    const { svg } = planSvg(withActiveItems(SAMPLE_PLAN, [sofa]));
    expect(svg).toContain('>3인 소파<');
    expect(svg).toContain('>≈210×90<');
    expect(planSvg(withActiveItems(SAMPLE_PLAN, [{ ...sofa, verified: true }])).svg).toContain('>210×90<');
  });

  it('이름의 특수문자를 XML로 이스케이프한다', () => {
    const plan = { ...SAMPLE_PLAN, info: { title: 'A<B & "C"' } };
    const { svg } = planSvg(plan);
    expect(svg).toContain('A&lt;B &amp; &quot;C&quot;');
    expect(svg).not.toContain('A<B');
    expect(escapeXml(`'`)).toBe('&apos;');
  });

  it('배경 이미지는 넣지 않는다', () => {
    const plan = { ...SAMPLE_PLAN, background: { imageRef: 'i', widthPx: 10, heightPx: 10, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 } };
    expect(planSvg(plan).svg).not.toContain('<image');
  });
});

describe('unverifiedCount / exportFileName', () => {
  it('벽·개구부·활성 배치안 아이템의 미확인 수', () => {
    expect(unverifiedCount(SAMPLE_PLAN)).toBe(7);
    expect(unverifiedCount(withActiveItems(SAMPLE_PLAN, [sofa]))).toBe(8);
  });

  it('파일명에 못 쓰는 문자와 공백은 -', () => {
    expect(exportFileName('샘플 평면', 'A안', '2d')).toBe('homefit-샘플-평면-A안-2d.png');
    expect(exportFileName('a/b:c', 'B "안"', '3d')).toBe('homefit-a-b-c-B-안--3d.png');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/export`
Expected: 모듈 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/export/planSvg.ts`:
```ts
import { findProduct } from '../catalog/products';
import { itemColor, MISSING_COLOR } from '../editor2d/itemColor';
import { pointsAttr, sectorPath } from '../editor2d/svg';
import { planBounds } from '../geometry/bounds';
import { doorSwing } from '../geometry/clearance';
import { corners, itemObb } from '../geometry/obb';
import { openingObb, wallDir, wallLength, wallObb } from '../geometry/walls';
import { activeItems, activeLayout } from '../model/layout';
import type { Plan } from '../model/schema';

export const EXPORT_PX_PER_CM = 2;

const MARGIN = 80;
const HEADER = 70;

export function escapeXml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

export function unverifiedCount(plan: Plan): number {
  return (
    plan.walls.filter((w) => !w.verified).length +
    plan.openings.filter((o) => !o.verified).length +
    activeItems(plan).filter((i) => !i.verified).length
  );
}

export function exportFileName(title: string, layoutName: string, kind: '2d' | '3d'): string {
  const safe = (s: string) => s.replace(/[\\/:*?"<>|\s]+/g, '-');
  return `homefit-${safe(title)}-${safe(layoutName)}-${kind}.png`;
}

const mark = (n: number, verified: boolean | undefined) => (verified ? `${n}` : `≈${n}`);

function text(x: number, y: number, size: number, value: string, attrs: string): string {
  return `<text x="${x}" y="${y}" font-size="${size}" font-family="sans-serif" ${attrs}>${escapeXml(value)}</text>`;
}

export function planSvg(plan: Plan): { svg: string; width: number; height: number } {
  const b = planBounds(plan);
  const x0 = b.minX - MARGIN;
  const y0 = b.minY - MARGIN - HEADER;
  const w = b.maxX - b.minX + MARGIN * 2;
  const h = b.maxY - b.minY + MARGIN * 2 + HEADER;
  const center = 'text-anchor="middle" dominant-baseline="middle"';
  const parts: string[] = [`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`];

  for (const r of plan.rooms) parts.push(text(r.label.x, r.label.y, 18, r.name, `fill="#6b5e4b" ${center}`));

  for (const item of activeItems(plan)) {
    const product = findProduct(plan, item.productId);
    const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
    const fill = product ? itemColor(product, item.variantId) : MISSING_COLOR;
    parts.push(
      `<polygon points="${pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}" fill="${fill}" fill-opacity="0.85" stroke="#6b5e4b" stroke-width="1.5"/>`,
    );
    parts.push(text(item.x, item.y - 7, 12, product?.name ?? '알 수 없는 제품', `fill="#1f2328" ${center}`));
    const size = `${dims.w}×${dims.d}`;
    parts.push(text(item.x, item.y + 9, 11, item.verified ? size : `≈${size}`, `fill="#1f2328" ${center}`));
  }

  for (const wall of plan.walls) {
    parts.push(`<polygon points="${pointsAttr(corners(wallObb(wall)))}" fill="#3f3a33"/>`);
    const len = Math.round(wallLength(wall));
    if (len === 0) continue;
    const u = wallDir(wall);
    const off = wall.thickness / 2 + 14;
    parts.push(
      text((wall.a.x + wall.b.x) / 2 - u.y * off, (wall.a.y + wall.b.y) / 2 + u.x * off, 12, mark(len, wall.verified), `fill="#3f3a33" ${center}`),
    );
  }

  const wallById = new Map(plan.walls.map((x) => [x.id, x]));
  for (const o of plan.openings) {
    const wall = wallById.get(o.wallId);
    if (!wall) continue;
    parts.push(`<polygon points="${pointsAttr(corners(openingObb(wall, o)))}" fill="#ffffff" stroke="#3f3a33" stroke-width="1"/>`);
    if (o.kind === 'door') {
      const s = doorSwing(wall, o);
      if (s.kind === 'sector') parts.push(`<path d="${sectorPath(s.center, s.radius, s.start, s.end)}" fill="none" stroke="#8b8b8b" stroke-width="1"/>`);
    }
    const u = wallDir(wall);
    const mid = o.offset + o.width / 2;
    const off = -(wall.thickness / 2 + 14);
    parts.push(
      text(wall.a.x + u.x * mid - u.y * off, wall.a.y + u.y * mid + u.x * off, 11, mark(o.width, o.verified), `fill="#4f6b8a" ${center}`),
    );
  }

  parts.push(text(x0 + 20, y0 + 30, 22, `${plan.info.title} · ${activeLayout(plan).name}`, 'fill="#1f2328" font-weight="bold"'));
  parts.push(text(x0 + 20, y0 + 56, 14, `단위: cm · ≈ 표시는 실측 미확인 치수 (${unverifiedCount(plan)}개)`, 'fill="#6b7280"'));

  const width = Math.round(w * EXPORT_PX_PER_CM);
  const height = Math.round(h * EXPORT_PX_PER_CM);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${w} ${h}">${parts.join('')}</svg>`,
    width,
    height,
  };
}
```
(크기: 샘플 평면 범위 600×400 → viewBox 760×630 → 1520×1260px.)

`src/export/png.ts`:
```ts
function toPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG를 만들지 못했습니다'))), 'image/png'),
  );
}

export async function svgToPngBlob(svg: string, width: number, height: number): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('SVG를 이미지로 만들지 못했습니다'));
      img.src = url;
    });
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');
    ctx.drawImage(img, 0, 0, width, height);
    return await toPngBlob(canvas);
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function canvasWithHeader(source: HTMLCanvasElement, lines: string[]): Promise<Blob> {
  const header = 16 + lines.length * 28;
  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height + header;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  lines.forEach((line, i) => {
    ctx.fillStyle = i === 0 ? '#1f2328' : '#6b7280';
    ctx.font = i === 0 ? 'bold 20px sans-serif' : '15px sans-serif';
    ctx.fillText(line, 16, 30 + i * 28);
  });
  ctx.drawImage(source, 0, header);
  return toPngBlob(canvas);
}
```

`src/persistence/file.ts`: `downloadText`를 다음 두 함수로 교체:
```ts
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadText(text: string, filename: string): void {
  downloadBlob(new Blob([text], { type: 'application/json' }), filename);
}
```

`src/scene3d/CaptureBridge.tsx`:
```tsx
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';

export const capture3d: { current: (() => HTMLCanvasElement) | null } = { current: null };

export function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    capture3d.current = () => {
      gl.render(scene, camera);
      return gl.domElement;
    };
    return () => {
      capture3d.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}
```
`src/scene3d/Viewport.tsx`: `<DropBridge />` 다음에 `<CaptureBridge />`를 넣고 import한다.

`src/ui/ExportButtons.tsx`:
```tsx
import { planSvg, exportFileName, unverifiedCount } from '../export/planSvg';
import { canvasWithHeader, svgToPngBlob } from '../export/png';
import { activeLayout } from '../model/layout';
import { usePlanStore } from '../model/StoreContext';
import { downloadBlob } from '../persistence/file';
import { capture3d } from '../scene3d/CaptureBridge';
import { useUi } from './uiStore';

export function ExportButtons() {
  const store = usePlanStore();
  const view = useUi((s) => s.view);

  const export2d = async () => {
    const plan = store.getState().plan;
    try {
      const { svg, width, height } = planSvg(plan);
      downloadBlob(await svgToPngBlob(svg, width, height), exportFileName(plan.info.title, activeLayout(plan).name, '2d'));
    } catch {
      useUi.getState().showBanner({ kind: 'error', text: '2D 이미지를 만들지 못했습니다.' });
    }
  };

  const export3d = async () => {
    const plan = store.getState().plan;
    const canvas = capture3d.current?.();
    if (!canvas) {
      useUi.getState().showBanner({ kind: 'error', text: '3D 보기에서 내보낼 수 있습니다.' });
      return;
    }
    try {
      const lines = [`${plan.info.title} · ${activeLayout(plan).name}`, `단위: cm · 실측 미확인 치수 ${unverifiedCount(plan)}개`];
      downloadBlob(await canvasWithHeader(canvas, lines), exportFileName(plan.info.title, activeLayout(plan).name, '3d'));
    } catch {
      useUi.getState().showBanner({ kind: 'error', text: '3D 이미지를 만들지 못했습니다.' });
    }
  };

  return (
    <>
      <button type="button" onClick={export2d}>2D PNG</button>
      <button type="button" disabled={view === '2d'} onClick={export3d}>3D PNG</button>
    </>
  );
}
```
`src/ui/Toolbar.tsx`: `JSON 저장` 버튼 다음에 `{mode === 'place' && <ExportButtons />}`를 넣고 import한다.

- [ ] **Step 4: 통과와 브라우저 확인**

Run: `npx vitest run src/export && npm run typecheck && npm test && npm run e2e`
Expected: PASS

브라우저 확인(일회용 Playwright, scratchpad): 소파·냉장고를 놓고 `2D PNG` → download 이벤트, 파일명 `homefit-샘플-평면-A안-2d.png`, 파일 앞 8바이트가 PNG 시그니처(`89 50 4E 47 0D 0A 1A 0A`), 열어 보면(Read) 머리글·벽 치수 `≈`·가구 이름이 보인다. `3D` 보기 → `3D PNG` → `-3d.png`, 머리글 두 줄과 3D 장면이 보인다. pageerror 없음.

- [ ] **Step 5: Commit**

```bash
git add src/export src/persistence/file.ts src/scene3d/CaptureBridge.tsx src/scene3d/Viewport.tsx src/ui/ExportButtons.tsx src/ui/Toolbar.tsx
git commit -m "feat: export 2D plan and 3D view as PNG with layout name, units and unverified marks"
```

---

### Task 6: 배치안 바와 비교 겹쳐 보기

**Files:**
- Create: `src/ui/LayoutBar.tsx`
- Modify: `src/ui/uiStore.ts`, `src/ui/uiStore.test.ts`, `src/ui/fields.tsx` (`TextField` `allowEmpty`), `src/ui/CatalogPanel.tsx`, `src/editor2d/Overlays2D.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: 스토어 배치안 액션(Task 2), `activeLayout`, `compareItems`, `TextField`
- Produces:
  - `useUi`: `compareLayoutId: string | null`(기본 null), `setCompareLayout(id: string | null)`
  - `TextField`에 `allowEmpty?: boolean`(true면 빈 값도 커밋)
  - `<LayoutBar />`(`data-testid="layout-bar"`, 배치 모드 왼쪽 패널 맨 위): 배치안 탭(이름, `aria-pressed`), `복제`, `삭제`(1개면 비활성), `이름`, `메모`(빈 값 허용), `겹쳐 볼 배치안` 선택(`없음` + 다른 배치안), `비교 대상과 전환`(겹쳐 볼 배치안으로 전환하고, 직전 배치안을 겹쳐 볼 대상으로)
  - 2D에서 겹쳐 볼 배치안의 가구를 점선 윤곽으로 표시(`data-testid="compare-ghosts"`). 배치안을 바꿔도 2D viewBox와 3D 카메라는 그대로(같은 시점 비교)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/uiStore.test.ts`에 추가:
```ts
  it('비교 대상 배치안 설정과 해제', () => {
    useUi.getState().setCompareLayout('layout-b');
    expect(useUi.getState().compareLayoutId).toBe('layout-b');
    useUi.getState().setCompareLayout(null);
    expect(useUi.getState().compareLayoutId).toBeNull();
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/uiStore.test.ts`
Expected: FAIL

- [ ] **Step 3: 구현**

`src/ui/uiStore.ts`: 상태 `compareLayoutId: string | null`(기본 null), 액션 `setCompareLayout(id: string | null): void` → `set({ compareLayoutId: id })`.

`src/ui/fields.tsx`의 `TextField`를 다음으로 교체:
```tsx
export function TextField({
  label,
  value,
  onCommit,
  allowEmpty = false,
}: {
  label: string;
  value: string;
  onCommit: (v: string) => void;
  allowEmpty?: boolean;
}) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if ((v || allowEmpty) && v !== value) onCommit(v);
    setText(value);
  };
  return (
    <label className="field">
      {label}
      <input
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
```

`src/ui/LayoutBar.tsx`:
```tsx
import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { TextField } from './fields';
import { useUi } from './uiStore';

export function LayoutBar() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const compareId = useUi((s) => s.compareLayoutId);
  const ui = useUi.getState();
  const s = store.getState();
  const active = activeLayout(plan);
  const others = plan.layouts.filter((l) => l.id !== active.id);
  const compare = others.find((l) => l.id === compareId) ?? null;

  const swap = () => {
    if (!compare) return;
    const previous = active.id;
    s.switchLayout(compare.id);
    ui.setCompareLayout(previous);
  };

  return (
    <section className="layout-bar" data-testid="layout-bar">
      <h3>배치안</h3>
      <div className="segmented layout-tabs" role="group" aria-label="배치안">
        {plan.layouts.map((l) => (
          <button key={l.id} type="button" aria-pressed={l.id === active.id} onClick={() => s.switchLayout(l.id)}>
            {l.name}
          </button>
        ))}
      </div>
      <div className="row">
        <button type="button" onClick={() => s.addLayout()}>복제</button>
        <button type="button" className="danger" disabled={plan.layouts.length <= 1} onClick={() => s.removeLayout(active.id)}>삭제</button>
      </div>
      <TextField key={`${active.id}-name`} label="이름" value={active.name} onCommit={(v) => s.renameLayout(active.id, v)} />
      <TextField key={`${active.id}-memo`} label="메모" value={active.memo ?? ''} allowEmpty onCommit={(v) => s.setLayoutMemo(active.id, v)} />
      <label className="field">
        겹쳐 볼 배치안
        <select value={compare?.id ?? ''} onChange={(e) => ui.setCompareLayout(e.target.value || null)}>
          <option value="">없음</option>
          {others.map((l) => (
            <option key={l.id} value={l.id}>{l.name}</option>
          ))}
        </select>
      </label>
      <button type="button" disabled={!compare} onClick={swap}>비교 대상과 전환</button>
    </section>
  );
}
```

`src/ui/CatalogPanel.tsx`: 반환하는 `<div className="catalog">` 바로 안 맨 위에 `<LayoutBar />`를 넣고 import한다.

`src/editor2d/Overlays2D.tsx`: import에 `compareItems`(`../model/layout`), `corners`(`../geometry/obb`), `pointsAttr`(`./svg`), `useUi`(`../ui/uiStore`)를 추가하고, 컴포넌트 안에서
```tsx
  const compareId = useUi((s) => s.compareLayoutId);
  const ghosts = compareItems(plan, compareId);
```
를 두고, 반환하는 `<g>`의 맨 앞에 다음을 넣는다.
```tsx
      {ghosts.length > 0 && (
        <g className="compare-ghosts" data-testid="compare-ghosts">
          {ghosts.map((item) => {
            const dims = findProduct(plan, item.productId)?.dims ?? { w: 50, d: 50 };
            return (
              <polygon
                key={item.id}
                points={pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}
                className="compare-ghost"
              />
            );
          })}
        </g>
      )}
```

`src/styles.css` 끝에 추가:
```css
.layout-bar { border-bottom: 1px solid #e5e1d8; padding-bottom: 8px; margin-bottom: 8px; }
.layout-tabs { flex-wrap: wrap; margin-bottom: 6px; }
.layout-bar select { padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; font-size: 13px; }
.compare-ghost { fill: none; stroke: #7c3aed; stroke-dasharray: 6 4; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
```

- [ ] **Step 4: 통과와 브라우저 확인**

Run: `npx vitest run src/ui && npm run typecheck && npm test && npm run e2e`
Expected: PASS

브라우저 확인(일회용 Playwright, scratchpad): 2D에서 소파를 놓고 `복제` → `B안` 활성 → 소파를 끌어 옮김 → `겹쳐 볼 배치안`=`A안` → 점선 윤곽(`compare-ghosts`)이 원래 자리에 보임 → `비교 대상과 전환` → A안 활성, 소파 원위치, 점선은 B안 위치 → 2D viewBox 값이 전환 전후 같음. `이름`·`메모` 수정, `삭제`. pageerror 없음.

- [ ] **Step 5: Commit**

```bash
git add src/ui/LayoutBar.tsx src/ui/uiStore.ts src/ui/uiStore.test.ts src/ui/fields.tsx src/ui/CatalogPanel.tsx src/editor2d/Overlays2D.tsx src/styles.css
git commit -m "feat: layout bar with tabs, duplicate, rename, memo, delete and 2D compare overlay"
```

---

### Task 7: E2E(배치안·비교·내보내기·이력·간섭 설명)

**Files:**
- Create: `e2e/layouts.spec.ts`

**Interfaces:**
- Consumes: Task 2–6의 버튼·라벨·테스트 id(`layout-bar`, `compare-ghosts`, `history-panel`, `conflict-details`, `status-collides`, `item2d-<id>`, `catalog-card-<id>`), `window.__homefit`

- [ ] **Step 1: 테스트 작성**

`e2e/layouts.spec.ts`:
```ts
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const itemsOf = (plan: Awaited<ReturnType<typeof getPlan>>) => plan.layouts.find((l) => l.id === plan.activeLayoutId)!.items;
const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

async function centerOf(page: Page, testId: string): Promise<P> {
  const b = (await page.getByTestId(testId).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

async function dragBy(page: Page, from: P, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y, { steps: 6 });
  await page.mouse.up();
}

const addSofa = (page: Page) => page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('B안에서 옮겨도 A안은 그대로이고, 같은 시점에서 겹쳐 보며 전환한다', async ({ page }) => {
  await page.getByRole('button', { name: '2D' }).click();
  await addSofa(page);
  const original = itemsOf(await getPlan(page))[0];
  const bar = page.getByTestId('layout-bar');
  await bar.getByRole('button', { name: '복제' }).click();
  await expect(bar.getByRole('button', { name: 'B안' })).toHaveAttribute('aria-pressed', 'true');

  const b = itemsOf(await getPlan(page))[0];
  await dragBy(page, await centerOf(page, `item2d-${b.id}`), 80);
  await expect.poll(async () => itemsOf(await getPlan(page))[0].x).toBeGreaterThan(original.x);

  await bar.getByLabel('겹쳐 볼 배치안').selectOption({ label: 'A안' });
  await expect(page.getByTestId('compare-ghosts')).toBeVisible();
  const viewBox = await page.getByTestId('editor2d').getAttribute('viewBox');
  await bar.getByRole('button', { name: '비교 대상과 전환' }).click();
  await expect(bar.getByRole('button', { name: 'A안' })).toHaveAttribute('aria-pressed', 'true');
  expect(itemsOf(await getPlan(page))[0].x).toBe(original.x);
  await expect(page.getByTestId('compare-ghosts')).toBeVisible();
  expect(await page.getByTestId('editor2d').getAttribute('viewBox')).toBe(viewBox);
});

test('2D·3D PNG를 내보낸다', async ({ page }) => {
  await addSofa(page);
  const [d2] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '2D PNG' }).click()]);
  expect(d2.suggestedFilename()).toBe('homefit-샘플-평면-A안-2d.png');
  const png2 = readFileSync((await d2.path())!);
  expect([...png2.subarray(0, 8)]).toEqual(PNG_SIGNATURE);
  expect(png2.length).toBeGreaterThan(5000);

  const [d3] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: '3D PNG' }).click()]);
  expect(d3.suggestedFilename()).toBe('homefit-샘플-평면-A안-3d.png');
  expect([...readFileSync((await d3.path())!).subarray(0, 8)]).toEqual(PNG_SIGNATURE);
});

test('이력: 지금 저장한 버전으로 복원하고 실행 취소로 되돌린다', async ({ page }) => {
  await page.getByRole('button', { name: '이력' }).click();
  const panel = page.getByTestId('history-panel');
  await panel.getByLabel('버전 이름').fill('처음');
  await panel.getByRole('button', { name: '지금 버전 저장' }).click();
  await panel.getByRole('button', { name: '닫기' }).click();

  await addSofa(page);
  await expect.poll(async () => itemsOf(await getPlan(page)).length).toBe(1);

  await page.getByRole('button', { name: '이력' }).click();
  await expect(panel.getByText('처음')).toBeVisible();
  await panel.getByRole('button', { name: '복원' }).first().click();
  await expect.poll(async () => itemsOf(await getPlan(page)).length).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => itemsOf(await getPlan(page)).length).toBe(1);
});

test('충돌 배지를 누르면 무엇과 겹치는지 보여준다', async ({ page }) => {
  await addSofa(page);
  await addSofa(page);
  await page.getByTestId('status-collides').click();
  const details = page.getByTestId('conflict-details');
  await expect(details).toContainText('충돌:');
  await expect(details).toContainText('3인 소파');
  await expect(details).toContainText('벽');
});
```

- [ ] **Step 2: 실행**

Run: `npm run e2e`
Expected: 기존 9 + 새 4 = 13 passed. 실패하면 앱의 실제 원인(다운로드 이벤트, 숨은 레이어, 포커스 등)을 진단해 보고한다. 기대값을 느슨하게 하거나 실제 조작을 store 호출로 바꾸지 않는다.

- [ ] **Step 3: Commit**

```bash
git add e2e/layouts.spec.ts
git commit -m "test: e2e for layouts, compare overlay, PNG export, revision restore and conflict details"
```

---

## 완료 기준

- `npm run typecheck && npm test && npm run e2e` 모두 통과
- 각 Task의 브라우저 확인을 실제로 실행해 결과(스크린샷·내보낸 PNG 경로 포함)를 기록
- `git ls-files | grep -E 'private|naver|our-home'`에 `src/persistence/privatePlan.test.ts` 외에 결과 없음
- 탐색 QA: 우리 집 프리셋(v1 파일)을 열어 A안으로 마이그레이션되는지, 가구를 놓고 B안을 만들어 비교·내보내기·이력 복원까지 한 번에 동작하는지 확인
