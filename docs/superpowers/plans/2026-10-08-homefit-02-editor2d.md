# homefit 계획 2: 2D 편집기 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 평면도 이미지를 배경으로 깔고 축척을 보정해 벽·방·문·창을 2D로 편집하고, 같은 2D 화면에서 가구를 배치하며, 스냅 토글·시점 초기화·겹친 물체 선택·잠금·실측 표시·저장 상태 표시를 갖춘다.

**Architecture:** 2D 화면은 SVG이고 SVG 좌표 = 평면 cm 좌표다(y 아래 방향, 2D와 같은 좌표계). 구조 편집 규칙(방 만들기, 개구부 맞춤, 끝점 이동, 벽 길이)은 React 없는 순수 함수(`geometry/structure.ts`)이고 스토어 액션이 이를 호출해 한 번의 실행 취소 단위로 커밋한다. 화면 상태(모드·보기·도구·스냅·후보 목록·저장 상태·초안 값)는 `ui/uiStore.ts`, 배경 이미지 원본은 IndexedDB(`persistence/images.ts`)에 둔다.

**Tech Stack:** 계획 1과 동일(Vite 8, TypeScript 5.9, React 19.3, R3F 9, drei 10, three 0.186, zustand 5, zod 4, Vitest 5, Playwright 1.63). 새 의존성 없음.

**Spec:** `docs/superpowers/specs/2026-10-08-homefit-design.md` — §6 구조 모드, §10, §14.1(계획 2 해당 항목), §14.4, §14.5-2

**이 계획의 범위(스펙 §14.5-2):** 배경 이미지·축척 보정(검증 길이 포함), 방 만들기 도구, 벽·문·창·방 이름 편집, 2D 배치, 스냅 토글, 시점 초기화, 선택 후보 목록, 잠금, 실측 표시, 단위 표시, 저장 상태 표시, §14.4 준비 작업.
**범위 밖(계획 3 이후):** 배치안 A/B, 비교 화면, 이미지 내보내기, 복구 이력, 간섭 경고 설명, 전기·체크리스트·PDF.

## Global Constraints

- 저장 단위는 정수 cm, 3D 렌더 단위는 1 unit = 1 m. cm↔m 변환은 `src/model/units.ts`의 `cmToM`/`mToCm`만 쓴다(Task 1 이후 cm↔m 변환에 `/ 100`, `* 100`, `/ 200` 리터럴 금지).
- 2D SVG 좌표 = 평면 cm 좌표(x 오른쪽, y 아래). 2D 회전 θ(deg)는 SVG에서도 같은 방향이다.
- 아이템 목록 접근은 `activeItems(plan)` / `withActiveItems(plan, items)`로만 한다(Task 1 이후 `plan.items` 직접 접근은 `src/model/layout.ts`에만).
- 새 런타임/개발 의존성 추가 금지. IndexedDB는 브라우저 기본 API로 쓴다.
- UI 문구는 한국어. 숫자 입력 옆에는 항상 단위(cm, °)를 표시한다(스펙 §14.1).
- repo는 공개 예정: 주소·단지명·평면도 이미지·우리 집 프리셋을 커밋하지 않는다. E2E용 이미지는 테스트 안에서 캔버스로 만든다.
- zustand v5: selector가 매번 새 객체/배열을 만들면 무한 렌더가 난다. 스토어 참조를 그대로 반환하거나 `useMemo`로 파생한다.
- 커밋 트레일러(빈 줄 뒤 정확히): `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`

## Review Focus

1. **개구부가 들어가지 않게 벽을 줄이는 입력**: 문 폭보다 짧게 만드는 벽 길이 입력·끝점 드래그는 거부하고 마지막 유효 상태를 유지해야 한다(F04) → Task 5 테스트 `개구부가 들어갈 수 없게 줄이면 거부하고 그대로 둔다`, `끝점 드래그로 개구부가 벗어나면 마지막 유효 위치를 유지한다`.
2. **연결된 벽**: 한 벽의 길이나 끝점을 바꾸면 그 끝점을 공유하는 벽도 같이 움직여 외곽이 열리지 않아야 한다(F03) → Task 5 테스트 `벽 길이를 바꾸면 연결된 벽 끝점도 따라온다`.
3. **더블클릭으로 벽 그리기를 끝낼 때 생기는 길이 0 구간**: 더블클릭은 클릭 두 번을 먼저 발생시키므로 같은 점이 두 번 들어온다. 길이 0 벽이 생기면 안 된다 → Task 4 테스트 `같은 점이 연속되면 그 구간은 버린다`.
4. **잠긴 가구**: 드래그·방향키·R·속성창 숫자 입력 어느 경로로도 움직이면 안 되고, 잠금 해제는 돼야 한다 → Task 5 테스트 `잠긴 아이템은 이동·회전·드래그되지 않지만 잠금 해제는 된다`, Task 11 테스트 `잠긴 아이템은 방향키와 R을 무시한다`.
5. **다른 브라우저에서 연 JSON의 배경 이미지**: JSON에는 이미지 참조만 있고 원본은 IndexedDB에 있다. 이미지가 없으면 앱이 멈추지 않고 안내 문구를 보여야 한다 → Task 6 테스트 `없는 키는 undefined`, Task 8 `BackgroundImage`의 `missing` 처리.

추가: 같은 점 두 개로 축척 보정을 시도하면 보정하지 않는다 → Task 4 테스트 `두 점이 같으면 null`.

---

## File Structure

```
src/
  model/
    units.ts            (신규) CM_PER_M, cmToM, mToCm
    layout.ts           (신규) activeItems, withActiveItems
    ids.ts              (신규) newId
    entities.ts         (신규) findEntity: id → item | wall | opening | room
    schema.ts           (수정) verified/locked 선택 필드, Background 이미지 크기·calibration
    store.ts            (수정) 구조 편집 액션, 잠금 처리, 끝점 드래그
  geometry/
    structure.ts        (신규) roomRectWalls, fitOpening, openingAtPoint, nearestWall, distanceToWall, refitOpenings, moveEndpoint, setWallLength
    pick.ts             (신규) pointInObb, itemsAtPoint
    walls.ts            (수정) openingObb
    clearance.ts        (수정) doorSwing(단일 문)
  editor2d/
    snapping.ts         (신규) snapAngle, snapToEndpoint, wallToolPoint, wallSegments
    calibration.ts      (신규) cmPerPxFrom, scaleMismatch, checkMismatch, planToImagePx, imagePxToPlan, calibrationResult, scaleText
    viewBox.ts          (신규) fitViewBox, zoomAt, panBy
    svg.ts              (신규) pointsAttr, sectorPath, shapePath
    itemColor.ts        (신규) itemColor
    svgPoint.ts         (신규) clientToPlan
    svgContext.ts       (신규) SvgContext
    useBackgroundUrl.ts (신규) IndexedDB 이미지 → object URL
    Editor2D.tsx  BackgroundImage.tsx  Walls2D.tsx  Openings2D.tsx  Rooms2D.tsx  ToolPreview.tsx  Items2D.tsx  Overlays2D.tsx  (신규)
    tools.ts            (신규) applyToolClick, finishWall, OPENING_DEFAULTS
  persistence/
    parse.ts            (수정) 마이그레이션 단계 진행 확인
    storage.ts          (수정) onPending
    images.ts           (신규) ImageStore, IndexedDB/메모리 구현, fitWithin, prepareImage, saveBackgroundImage
  scene3d/
    units.ts            (수정) model/units 사용
    cameraFit.ts        (신규) fitTop, fitPerspective, fitTopZoom
    pick3d.ts           (신규) itemIdsFromIntersections
    CameraRig.tsx       (신규) 시점 맞춤·초기화
    Viewport.tsx  Items3D.tsx  Overlays.tsx  Walls3D.tsx  Floor.tsx  DropBridge.tsx  (수정)
  ui/
    uiStore.ts          (수정) mode, view '2d', tool, snap, viewResetKey, candidates, saveStatus, calibration, wallDraft, roomDraft
    saveLabel.ts        (신규)
    fields.tsx          (신규) NumberField(단위), CheckboxField, TextField
    StructurePanel.tsx  (신규) 도구·초안·배경·축척 보정
    CandidatePicker.tsx (신규)
    properties/ItemProperties.tsx  WallProperties.tsx  OpeningProperties.tsx  RoomProperties.tsx  (신규)
    PropertiesPanel.tsx (수정) 선택 종류별 분기
    Toolbar.tsx  shortcuts.ts  (수정)
  App.tsx  main.tsx  styles.css  (수정)
  catalog/builders/parts.ts  validation/validate.ts  (수정: units, activeItems)
e2e/
  placement.spec.ts  (수정: 탑뷰 버튼 이름)
  editor2d.spec.ts   (신규)
```

---

### Task 1: 준비 작업(단위 상수, 아이템 접근자, 마이그레이션 가드, 실행 취소 단축키)

**Files:**
- Create: `src/model/units.ts`, `src/model/layout.ts`, `src/model/units.test.ts`, `src/model/layout.test.ts`
- Modify: `src/scene3d/units.ts`, `src/scene3d/Overlays.tsx`, `src/scene3d/Viewport.tsx`, `src/scene3d/Walls3D.tsx`, `src/scene3d/Floor.tsx`, `src/scene3d/DropBridge.tsx`, `src/scene3d/Items3D.tsx`, `src/catalog/builders/parts.ts`, `src/validation/validate.ts`, `src/ui/PropertiesPanel.tsx`, `src/ui/shortcuts.ts`, `src/model/store.ts`, `src/persistence/parse.ts`
- Test: `src/persistence/parse.test.ts`, `src/ui/shortcuts.test.ts`

**Interfaces:**
- Produces: `CM_PER_M = 100`, `cmToM(cm: number): number`, `mToCm(m: number): number` (`src/model/units.ts`); `activeItems(plan: Plan): Item[]`, `withActiveItems(plan: Plan, items: Item[]): Plan` (`src/model/layout.ts`)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/units.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { cmToM, CM_PER_M, mToCm } from './units';

describe('units', () => {
  it('cm와 m를 서로 바꾼다', () => {
    expect(CM_PER_M).toBe(100);
    expect(cmToM(150)).toBe(1.5);
    expect(mToCm(2.5)).toBe(250);
  });
});
```

`src/model/layout.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { activeItems, withActiveItems } from './layout';
import { SAMPLE_PLAN } from './samplePlan';

describe('layout', () => {
  it('withActiveItems는 원본을 바꾸지 않고 새 평면을 돌려준다', () => {
    const items = [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }];
    const next = withActiveItems(SAMPLE_PLAN, items);
    expect(activeItems(next)).toBe(items);
    expect(activeItems(SAMPLE_PLAN)).toEqual([]);
    expect(next).not.toBe(SAMPLE_PLAN);
  });
});
```

`src/persistence/parse.test.ts`의 `describe('migrate', ...)` 안에 추가:
```ts
  it('버전을 올리지 않는 변환은 반복하지 않고 null', () => {
    let calls = 0;
    // 1000번째 호출부터 버전을 올리게 해서, 가드가 없는 구현도 테스트가 끝나게(RED가 멈추지 않게) 한다
    const steps = { 0: (r: Record<string, unknown>) => (++calls > 1000 ? { ...r, version: 1 } : { ...r }) };
    expect(migrate({ version: 0 }, steps, 1)).toBeNull();
    expect(calls).toBe(1);
  });
```

`src/ui/shortcuts.test.ts`의 `describe('applyShortcut', ...)` 안에 추가:
```ts
  it('버튼에 포커스가 있어도 Ctrl+Z / Ctrl+Shift+Z는 동작한다', () => {
    const { store, press } = setup();
    expect(press('z', { mod: true, targetTag: 'BUTTON' })).toBe(true);
    expect(store.getState().plan.items).toHaveLength(0);
    expect(press('z', { mod: true, shiftKey: true, targetTag: 'BUTTON' })).toBe(true);
    expect(store.getState().plan.items).toHaveLength(1);
  });

  it('입력 필드에서는 Ctrl+Z를 가로채지 않는다', () => {
    const { store, press } = setup();
    expect(press('z', { mod: true, targetTag: 'INPUT' })).toBe(false);
    expect(store.getState().plan.items).toHaveLength(1);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model/units.test.ts src/model/layout.test.ts src/persistence/parse.test.ts src/ui/shortcuts.test.ts`
Expected: units/layout는 모듈 없음으로 FAIL, migrate 새 테스트는 null 대신 객체를 돌려받아 FAIL, shortcuts 새 테스트 2개 FAIL

- [ ] **Step 3: 구현**

`src/model/units.ts`:
```ts
export const CM_PER_M = 100;

export const cmToM = (cm: number) => cm / CM_PER_M;
export const mToCm = (m: number) => m * CM_PER_M;
```

`src/model/layout.ts`:
```ts
import type { Item, Plan } from './schema';

// 배치안(A/B)을 도입하기 전까지 아이템 목록은 이 두 함수로만 읽고 쓴다(스펙 §14.4)
export function activeItems(plan: Plan): Item[] {
  return plan.items;
}

export function withActiveItems(plan: Plan, items: Item[]): Plan {
  return { ...plan, items };
}
```

`src/persistence/parse.ts`의 `migrate` 반복문을 다음으로 교체:
```ts
  while (typeof cur.version === 'number' && cur.version < current) {
    const step = steps[cur.version];
    if (!step) return null;
    const next = step(cur);
    if (typeof next.version !== 'number' || next.version <= cur.version) return null;
    cur = next;
  }
```

`src/ui/shortcuts.ts`의 `EDITABLE` 상수와 `applyShortcut` 앞부분을 다음으로 교체(나머지는 그대로, `plan.items` 접근은 `activeItems`로):
```ts
const TEXT_INPUT = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
```
```ts
export function applyShortcut(s: PlanState, k: KeyInput): boolean {
  if (k.targetTag && TEXT_INPUT.has(k.targetTag)) return false;
  const key = k.key.toLowerCase();
  if (k.mod && key === 'z') {
    if (k.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  // 패널 버튼을 누른 직후 포커스가 남아 있어도 Backspace로 지워지지 않게 한다
  if (k.targetTag === 'BUTTON') return false;
  const item = activeItems(s.plan).find((i) => i.id === s.selectedId);
```
(`import { activeItems } from '../model/layout';` 추가)

단위 리터럴 교체(각 파일에 `import { cmToM, mToCm } from '<상대경로>/model/units';` 중 필요한 것만 추가):

| 파일 | 바꾸기 전 | 바꾼 후 |
|---|---|---|
| `src/scene3d/units.ts` | `return [p.x / 100, yCm / 100, p.y / 100];` | `return [cmToM(p.x), cmToM(yCm), cmToM(p.y)];` |
| `src/scene3d/Overlays.tsx` | `[p.x / 100, OUTLINE_Y, p.y / 100]` | `[cmToM(p.x), OUTLINE_Y, cmToM(p.y)]` |
| 〃 | `position={[o.cx / 100, Y, o.cy / 100]}` | `position={[cmToM(o.cx), Y, cmToM(o.cy)]}` |
| 〃 | `args={[(o.hw * 2) / 100, (o.hd * 2) / 100]}` | `args={[cmToM(o.hw * 2), cmToM(o.hd * 2)]}` |
| 〃 | `position={[shape.center.x / 100, Y, shape.center.y / 100]}` | `position={[cmToM(shape.center.x), Y, cmToM(shape.center.y)]}` |
| 〃 | `args={[shape.radius / 100, 24, thetaStart, thetaLength]}` | `args={[cmToM(shape.radius), 24, thetaStart, thetaLength]}` |
| `src/scene3d/Viewport.tsx` | `const cx = c.x / 100;` / `const cz = c.y / 100;` | `const cx = cmToM(c.x);` / `const cz = cmToM(c.y);` |
| `src/scene3d/Walls3D.tsx` | `position={[p.obb.cx / 100, (p.y0 + p.y1) / 200, p.obb.cy / 100]}` | `position={[cmToM(p.obb.cx), cmToM((p.y0 + p.y1) / 2), cmToM(p.obb.cy)]}` |
| 〃 | `args={[(p.obb.hw * 2) / 100, (p.y1 - p.y0) / 100, (p.obb.hd * 2) / 100]}` | `args={[cmToM(p.obb.hw * 2), cmToM(p.y1 - p.y0), cmToM(p.obb.hd * 2)]}` |
| `src/scene3d/Floor.tsx` | `const w = (b.maxX - b.minX + margin * 2) / 100;` | `const w = cmToM(b.maxX - b.minX + margin * 2);` |
| 〃 | `const d = (b.maxY - b.minY + margin * 2) / 100;` | `const d = cmToM(b.maxY - b.minY + margin * 2);` |
| 〃 | `const cx = (b.minX + b.maxX) / 200;` | `const cx = cmToM((b.minX + b.maxX) / 2);` |
| 〃 | `const cz = (b.minY + b.maxY) / 200;` | `const cz = cmToM((b.minY + b.maxY) / 2);` |
| `src/scene3d/DropBridge.tsx` | `return { x: Math.round(hit.x * 100), y: Math.round(hit.z * 100) };` | `return { x: Math.round(mToCm(hit.x)), y: Math.round(mToCm(hit.z)) };` |
| `src/scene3d/Items3D.tsx` | `{ x: p.x * 100, y: p.z * 100 }` | `{ x: mToCm(p.x), y: mToCm(p.z) }` |
| 〃 | `const y = product ? mountHeightCm(product) / 100 : 0;` | `const y = product ? cmToM(mountHeightCm(product)) : 0;` |
| 〃 | `position={[item.x / 100, y, item.y / 100]}` | `position={[cmToM(item.x), y, cmToM(item.y)]}` |
| `src/catalog/builders/parts.ts` | `return { W: dims.w / 100, D: dims.d / 100, H: dims.h / 100 };` | `return { W: cmToM(dims.w), D: cmToM(dims.d), H: cmToM(dims.h) };` |

아이템 접근 교체(`import { activeItems, withActiveItems } from '<상대경로>/model/layout';`):

| 파일 | 바꾸기 전 | 바꾼 후 |
|---|---|---|
| `src/validation/validate.ts` | `const placed = plan.items.flatMap(` | `const placed = activeItems(plan).flatMap(` |
| 〃 | `for (const item of plan.items) result[item.id] = OK;` | `for (const item of activeItems(plan)) result[item.id] = OK;` |
| `src/scene3d/Overlays.tsx` | `const placed = plan.items.flatMap(` | `const placed = activeItems(plan).flatMap(` |
| `src/scene3d/Items3D.tsx` | `{plan.items.map((item) => (` | `{activeItems(plan).map((item) => (` |
| `src/ui/PropertiesPanel.tsx` | `const item = plan.items.find(` | `const item = activeItems(plan).find(` |
| `src/model/store.ts` | `const withItems = (fn: (items: Item[]) => Item[]): Plan => ({ ...get().plan, items: fn(get().plan.items) });` | `const withItems = (fn: (items: Item[]) => Item[]): Plan => withActiveItems(get().plan, fn(activeItems(get().plan)));` |
| 〃 | `get().plan.items.some(` (2곳), `get().plan.items.find(` (2곳) | `activeItems(get().plan).some(` / `activeItems(get().plan).find(` |

- [ ] **Step 4: 통과와 리터럴 제거 확인**

Run:
```bash
npx vitest run src/model src/persistence src/ui
npm run typecheck
grep -rnE '(/|\*) ?(100|200)\b' src/scene3d src/catalog src/ui src/validation src/model --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v 'src/model/units.ts'
grep -rn 'plan\.items\|\.plan\.items' src --include='*.ts' --include='*.tsx' | grep -v '\.test\.' | grep -v 'src/model/layout.ts'
```
Expected: 테스트 PASS, typecheck 오류 없음, 두 grep 모두 결과 없음

- [ ] **Step 5: 전체 테스트 후 Commit**

Run: `npm test`
```bash
git add src/model/units.ts src/model/units.test.ts src/model/layout.ts src/model/layout.test.ts src/model/store.ts src/scene3d src/catalog/builders/parts.ts src/validation/validate.ts src/ui/PropertiesPanel.tsx src/ui/shortcuts.ts src/ui/shortcuts.test.ts src/persistence/parse.ts src/persistence/parse.test.ts
git commit -m "refactor: unit helpers, item accessors, migration guard and undo through buttons"
```

---

### Task 2: 스키마 선택 필드와 엔티티 조회

**Files:**
- Create: `src/model/ids.ts`, `src/model/entities.ts`, `src/model/entities.test.ts`
- Modify: `src/model/schema.ts`, `src/model/store.ts` (newId 이동), `src/model/schema.test.ts`

**Interfaces:**
- Consumes: `activeItems` (Task 1)
- Produces:
  - 스키마: `Wall.verified?: boolean`, `Opening.verified?: boolean`, `Item.locked?: boolean`, `Item.verified?: boolean`, `Background = { imageRef, widthPx, heightPx, cmPerPx, offsetX, offsetY, rotation, opacity, calibration? }`, `Calibration = { a: Vec2px, b: Vec2px, lengthCm: number, check?: { a, b, lengthCm } }`(이미지 픽셀 좌표, 실수 허용), 타입 `Background`, `Calibration`
  - `newId(prefix: string): string` (`src/model/ids.ts`)
  - `type Entity = { kind: 'item'; item: Item } | { kind: 'wall'; wall: Wall } | { kind: 'opening'; opening: Opening } | { kind: 'room'; room: Room }`, `findEntity(plan: Plan, id: string | null): Entity | null`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/schema.test.ts`의 `describe('PlanSchema', ...)` 안에 추가:
```ts
  it('verified·locked는 선택 필드다', () => {
    const plan = {
      ...SAMPLE_PLAN,
      walls: [{ ...SAMPLE_PLAN.walls[0], verified: true }, ...SAMPLE_PLAN.walls.slice(1)],
      items: [{ id: 'i', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0, locked: true, verified: false }],
    };
    expect(PlanSchema.safeParse(plan).success).toBe(true);
  });

  it('배경은 이미지 크기와 축척 보정 정보를 가진다', () => {
    const background = {
      imageRef: 'image-1', widthPx: 400, heightPx: 300, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5,
      calibration: { a: { x: 0.5, y: 0 }, b: { x: 400, y: 0 }, lengthCm: 400, check: { a: { x: 0, y: 0 }, b: { x: 0, y: 300 }, lengthCm: 300 } },
    };
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, background }).success).toBe(true);
    expect(PlanSchema.safeParse({ ...SAMPLE_PLAN, background: { ...background, widthPx: 0 } }).success).toBe(false);
  });
```

`src/model/entities.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { findEntity } from './entities';
import { SAMPLE_PLAN } from './samplePlan';

const plan = { ...SAMPLE_PLAN, items: [{ id: 'item-1', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 }] };

describe('findEntity', () => {
  it('id로 아이템·벽·개구부·방을 찾는다', () => {
    expect(findEntity(plan, 'item-1')?.kind).toBe('item');
    expect(findEntity(plan, 'w1')).toEqual({ kind: 'wall', wall: plan.walls[0] });
    expect(findEntity(plan, 'o1')?.kind).toBe('opening');
    expect(findEntity(plan, 'r1')?.kind).toBe('room');
  });

  it('없는 id나 null은 null', () => {
    expect(findEntity(plan, 'nope')).toBeNull();
    expect(findEntity(plan, null)).toBeNull();
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model`
Expected: entities 모듈 없음, 배경 테스트 FAIL

- [ ] **Step 3: 구현**

`src/model/schema.ts` 변경:
- `WallSchema`에 `verified: z.boolean().optional(),` 추가
- `OpeningSchema`에 `verified: z.boolean().optional(),` 추가
- `ItemSchema`에 `locked: z.boolean().optional(),` 와 `verified: z.boolean().optional(),` 추가
- `BackgroundSchema`를 다음으로 교체하고 위에 `PxSchema`, `CalibrationSchema`를 둔다:
```ts
// 배경 이미지 안의 픽셀 좌표(실수)
const PxSchema = z.object({ x: z.number(), y: z.number() });

const CalibrationLineSchema = z.object({ a: PxSchema, b: PxSchema, lengthCm: positiveCm });

export const CalibrationSchema = CalibrationLineSchema.extend({ check: CalibrationLineSchema.optional() });

export const BackgroundSchema = z.object({
  imageRef: z.string(),
  widthPx: z.number().int().positive(),
  heightPx: z.number().int().positive(),
  cmPerPx: z.number().positive(),
  offsetX: z.number(),
  offsetY: z.number(),
  rotation: z.number(),
  opacity: z.number().min(0).max(1),
  calibration: CalibrationSchema.optional(),
});
```
- 타입 끝에 추가: `export type Background = z.infer<typeof BackgroundSchema>;` `export type Calibration = z.infer<typeof CalibrationSchema>;`

`src/model/ids.ts`:
```ts
export const newId = (prefix: string) => `${prefix}-${crypto.randomUUID().slice(0, 8)}`;
```
`src/model/store.ts`: 파일 안의 `const newId = ...` 정의를 지우고 `import { newId } from './ids';`로 바꾼다.

`src/model/entities.ts`:
```ts
import { activeItems } from './layout';
import type { Item, Opening, Plan, Room, Wall } from './schema';

export type Entity =
  | { kind: 'item'; item: Item }
  | { kind: 'wall'; wall: Wall }
  | { kind: 'opening'; opening: Opening }
  | { kind: 'room'; room: Room };

export function findEntity(plan: Plan, id: string | null): Entity | null {
  if (!id) return null;
  const item = activeItems(plan).find((i) => i.id === id);
  if (item) return { kind: 'item', item };
  const wall = plan.walls.find((w) => w.id === id);
  if (wall) return { kind: 'wall', wall };
  const opening = plan.openings.find((o) => o.id === id);
  if (opening) return { kind: 'opening', opening };
  const room = plan.rooms.find((r) => r.id === id);
  if (room) return { kind: 'room', room };
  return null;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/model && npm run typecheck && npm test`
Expected: 전체 PASS(비공개 프리셋 테스트 포함 — 새 필드는 선택이라 기존 JSON도 통과)

- [ ] **Step 5: Commit**

```bash
git add src/model/schema.ts src/model/schema.test.ts src/model/ids.ts src/model/entities.ts src/model/entities.test.ts src/model/store.ts
git commit -m "feat: optional verified/locked flags, background calibration schema and entity lookup"
```

---

### Task 3: 구조 편집 기하와 선택 판정

**Files:**
- Create: `src/geometry/structure.ts`, `src/geometry/structure.test.ts`, `src/geometry/pick.ts`, `src/geometry/pick.test.ts`
- Modify: `src/geometry/walls.ts` (openingObb), `src/geometry/walls.test.ts`, `src/geometry/clearance.ts` (doorSwing)

**Interfaces:**
- Consumes: `Wall`, `Opening`, `Plan`, `Product`, `Vec2` (Task 2), `wallDir`, `wallLength`, `OBB`, `axes`, `itemObb` (계획 1), `activeItems` (Task 1)
- Produces:
  - `roomRectWalls(origin: Vec2, w: number, d: number, thickness: number, height: number): Omit<Wall, 'id'>[]` — origin은 내측 왼쪽 위 모서리, 반환 순서 위·오른쪽·아래·왼쪽, 중심선 사각형 크기 = (w + thickness) × (d + thickness)
  - `fitOpening(wall: Wall, offset: number, width: number): number | null` — 폭이 벽보다 크면 null, 아니면 [0, floor(L − width)]로 맞춘 정수 offset
  - `openingAtPoint(wall: Wall, p: Vec2, width: number): number | null` — p를 개구부 중심으로
  - `distanceToWall(w: Wall, p: Vec2): number`, `nearestWall(walls: Wall[], p: Vec2, maxDist: number): Wall | null`
  - `refitOpenings(walls: Wall[], openings: Opening[]): { ok: true; openings: Opening[] } | { ok: false; openingId: string }` — 벽이 없는 개구부는 버린다
  - `moveEndpoint(walls: Wall[], from: Vec2, to: Vec2): Wall[]` — from과 같은 모든 끝점을 to로
  - `setWallLength(wall: Wall, length: number): Wall` — a 고정, 방향 유지, b 정수 반올림
  - `openingObb(w: Wall, o: Opening): OBB` (walls.ts)
  - `doorSwing(w: Wall, o: Opening): ClearanceShape` (clearance.ts; `doorSwings`는 이것을 쓴다)
  - `pointInObb(o: OBB, p: Vec2): boolean`, `itemsAtPoint(plan: Plan, p: Vec2, resolve: (productId: string) => Product | undefined): string[]` — 위에 그려진 것(배열 뒤쪽) 먼저, 제품이 없으면 50×50

- [ ] **Step 1: 실패하는 테스트 작성**

`src/geometry/structure.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Opening, Wall } from '../model/schema';
import {
  distanceToWall, fitOpening, moveEndpoint, nearestWall, openingAtPoint, refitOpenings, roomRectWalls, setWallLength,
} from './structure';

const wall = (id: string, ax: number, ay: number, bx: number, by: number): Wall => ({
  id, a: { x: ax, y: ay }, b: { x: bx, y: by }, thickness: 10, height: 230,
});
const door = (over: Partial<Opening> = {}): Opening => ({
  id: 'o', wallId: 'w', kind: 'door', offset: 250, width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true, ...over,
});

describe('roomRectWalls', () => {
  it('벽 두께를 넣어도 내측 치수가 유지된다 (F02: 4000×3000mm, 두께 150mm)', () => {
    const walls = roomRectWalls({ x: 100, y: 100 }, 400, 300, 15, 230);
    expect(walls).toHaveLength(4);
    const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
    const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
    expect(Math.max(...xs) - Math.min(...xs) - 15).toBe(400);
    expect(Math.max(...ys) - Math.min(...ys) - 15).toBe(300);
    expect(walls.every((w) => w.thickness === 15 && w.height === 230)).toBe(true);
  });

  it('외곽이 닫혀 있다(각 벽의 끝점이 다음 벽의 시작점)', () => {
    const walls = roomRectWalls({ x: 0, y: 0 }, 400, 300, 12, 230);
    walls.forEach((w, i) => expect(walls[(i + 1) % 4].a).toEqual(w.b));
  });
});

describe('fitOpening', () => {
  it('벽 안으로 당겨 맞춘다', () => {
    expect(fitOpening(wall('w', 0, 0, 300, 0), 250, 90)).toBe(210);
    expect(fitOpening(wall('w', 0, 0, 300, 0), -20, 90)).toBe(0);
  });

  it('벽보다 넓으면 null', () => {
    expect(fitOpening(wall('w', 0, 0, 80, 0), 0, 90)).toBeNull();
  });
});

describe('openingAtPoint', () => {
  it('클릭한 점을 개구부 중심으로 놓는다', () => {
    expect(openingAtPoint(wall('w', 0, 0, 400, 0), { x: 200, y: 7 }, 90)).toBe(155);
  });
});

describe('nearestWall', () => {
  const walls = [wall('a', 0, 0, 400, 0), wall('b', 400, 0, 400, 300)];

  it('가장 가까운 벽을 고른다', () => {
    expect(nearestWall(walls, { x: 390, y: 150 }, 30)?.id).toBe('b');
    expect(distanceToWall(walls[0], { x: 500, y: 0 })).toBe(100);
  });

  it('maxDist보다 멀면 null', () => {
    expect(nearestWall(walls, { x: 200, y: 200 }, 30)).toBeNull();
  });
});

describe('refitOpenings', () => {
  it('벽이 짧아지면 개구부를 당겨 맞춘다', () => {
    const r = refitOpenings([wall('w', 0, 0, 300, 0)], [door()]);
    expect(r).toEqual({ ok: true, openings: [door({ offset: 210 })] });
  });

  it('들어갈 수 없으면 그 개구부 id로 실패한다', () => {
    expect(refitOpenings([wall('w', 0, 0, 80, 0)], [door()])).toEqual({ ok: false, openingId: 'o' });
  });

  it('벽이 사라진 개구부는 버린다', () => {
    expect(refitOpenings([], [door()])).toEqual({ ok: true, openings: [] });
  });
});

describe('moveEndpoint / setWallLength', () => {
  it('같은 끝점을 공유하는 벽을 함께 옮긴다', () => {
    const walls = moveEndpoint([wall('a', 0, 0, 400, 0), wall('b', 400, 0, 400, 300)], { x: 400, y: 0 }, { x: 500, y: 0 });
    expect(walls[0].b).toEqual({ x: 500, y: 0 });
    expect(walls[1].a).toEqual({ x: 500, y: 0 });
  });

  it('a를 고정하고 방향을 유지해 길이를 바꾼다', () => {
    expect(setWallLength(wall('w', 0, 0, 300, 400), 1000).b).toEqual({ x: 600, y: 800 });
  });
});
```

`src/geometry/pick.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Product } from '../model/schema';
import { emptyPlanFields } from '../model/samplePlan';
import { deg2rad } from './obb';
import { itemsAtPoint, pointInObb } from './pick';

const product: Product = {
  id: 'p', brand: 't', model: '', name: 'n', category: 'furniture', dims: { w: 100, d: 50, h: 50 },
  variants: [{ id: 'v', label: 'v', colors: {} }], builder: 'box', clearances: [], builtIn: false, mount: 'floor',
};

describe('pointInObb', () => {
  it('회전한 사각형 안팎을 판정한다', () => {
    const o = { cx: 0, cy: 0, hw: 50, hd: 10, angle: deg2rad(90) };
    expect(pointInObb(o, { x: 0, y: 40 })).toBe(true);
    expect(pointInObb(o, { x: 40, y: 0 })).toBe(false);
  });
});

describe('itemsAtPoint', () => {
  it('겹친 아이템을 위에 그려진 것부터 돌려준다', () => {
    const plan = {
      version: 1 as const, info: { title: 't' }, walls: [], openings: [], rooms: [], ...emptyPlanFields(),
      items: [
        { id: 'a', productId: 'p', variantId: 'v', x: 0, y: 0, rotation: 0 },
        { id: 'b', productId: 'p', variantId: 'v', x: 30, y: 0, rotation: 0 },
        { id: 'c', productId: 'p', variantId: 'v', x: 500, y: 0, rotation: 0 },
      ],
    };
    expect(itemsAtPoint(plan, { x: 10, y: 0 }, () => product)).toEqual(['b', 'a']);
    expect(itemsAtPoint(plan, { x: 1000, y: 0 }, () => product)).toEqual([]);
  });
});
```

`src/geometry/walls.test.ts`에 추가(파일 상단 import에 `openingObb` 추가):
```ts
describe('openingObb', () => {
  it('개구부 구간을 벽 두께의 사각형으로', () => {
    expect(openingObb(wall, opening({}))).toMatchObject({ cx: 140, cy: 0, hw: 40, hd: 5 });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/geometry`
Expected: structure/pick 모듈 없음, openingObb 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/geometry/structure.ts`:
```ts
import type { Opening, Vec2, Wall } from '../model/schema';
import { wallDir, wallLength } from './walls';

export function roomRectWalls(origin: Vec2, w: number, d: number, thickness: number, height: number): Omit<Wall, 'id'>[] {
  // 중심선은 내측보다 두께 절반씩 바깥. 두께가 홀수여도 중심선 크기가 w + thickness가 되도록 한쪽만 반올림한다
  const x0 = Math.round(origin.x - thickness / 2);
  const y0 = Math.round(origin.y - thickness / 2);
  const x1 = x0 + w + thickness;
  const y1 = y0 + d + thickness;
  const tl = { x: x0, y: y0 };
  const tr = { x: x1, y: y0 };
  const br = { x: x1, y: y1 };
  const bl = { x: x0, y: y1 };
  return [
    [tl, tr],
    [tr, br],
    [br, bl],
    [bl, tl],
  ].map(([a, b]) => ({ a, b, thickness, height }));
}

export function fitOpening(wall: Wall, offset: number, width: number): number | null {
  const len = wallLength(wall);
  if (width > len) return null;
  return Math.min(Math.max(0, Math.round(offset)), Math.floor(len - width));
}

export function openingAtPoint(wall: Wall, p: Vec2, width: number): number | null {
  const u = wallDir(wall);
  const t = (p.x - wall.a.x) * u.x + (p.y - wall.a.y) * u.y;
  return fitOpening(wall, t - width / 2, width);
}

export function distanceToWall(w: Wall, p: Vec2): number {
  const len = wallLength(w);
  const u = wallDir(w);
  const t = Math.max(0, Math.min(len, (p.x - w.a.x) * u.x + (p.y - w.a.y) * u.y));
  return Math.hypot(p.x - (w.a.x + u.x * t), p.y - (w.a.y + u.y * t));
}

export function nearestWall(walls: Wall[], p: Vec2, maxDist: number): Wall | null {
  let best: Wall | null = null;
  let bestDist = Infinity;
  for (const w of walls) {
    const d = distanceToWall(w, p);
    if (d <= maxDist && d < bestDist) {
      best = w;
      bestDist = d;
    }
  }
  return best;
}

export function refitOpenings(
  walls: Wall[],
  openings: Opening[],
): { ok: true; openings: Opening[] } | { ok: false; openingId: string } {
  const byId = new Map(walls.map((w) => [w.id, w]));
  const result: Opening[] = [];
  for (const o of openings) {
    const wall = byId.get(o.wallId);
    if (!wall) continue;
    const offset = fitOpening(wall, o.offset, o.width);
    if (offset === null) return { ok: false, openingId: o.id };
    result.push(offset === o.offset ? o : { ...o, offset });
  }
  return { ok: true, openings: result };
}

const same = (p: Vec2, q: Vec2) => p.x === q.x && p.y === q.y;

export function moveEndpoint(walls: Wall[], from: Vec2, to: Vec2): Wall[] {
  return walls.map((w) => {
    if (!same(w.a, from) && !same(w.b, from)) return w;
    return { ...w, a: same(w.a, from) ? { ...to } : w.a, b: same(w.b, from) ? { ...to } : w.b };
  });
}

export function setWallLength(wall: Wall, length: number): Wall {
  const u = wallDir(wall);
  return { ...wall, b: { x: Math.round(wall.a.x + u.x * length), y: Math.round(wall.a.y + u.y * length) } };
}
```

`src/geometry/pick.ts`:
```ts
import { activeItems } from '../model/layout';
import type { Plan, Product, Vec2 } from '../model/schema';
import { axes, itemObb, type OBB } from './obb';

export function pointInObb(o: OBB, p: Vec2): boolean {
  const [u, v] = axes(o);
  const dx = p.x - o.cx;
  const dy = p.y - o.cy;
  return Math.abs(dx * u.x + dy * u.y) <= o.hw && Math.abs(dx * v.x + dy * v.y) <= o.hd;
}

export function itemsAtPoint(plan: Plan, p: Vec2, resolve: (productId: string) => Product | undefined): string[] {
  return activeItems(plan)
    .filter((item) => {
      const dims = resolve(item.productId)?.dims ?? { w: 50, d: 50 };
      return pointInObb(itemObb(item.x, item.y, item.rotation, dims.w, dims.d), p);
    })
    .map((item) => item.id)
    .reverse();
}
```

`src/geometry/walls.ts` 끝에 추가:
```ts
export function openingObb(w: Wall, o: Opening): OBB {
  return segmentObb(w, o.offset, o.offset + o.width);
}
```

`src/geometry/clearance.ts`: import에 `Opening`, `Wall`을 추가하고 `doorSwings`를 다음 두 함수로 교체:
```ts
export function doorSwing(w: Wall, o: Opening): ClearanceShape {
  const u = wallDir(w);
  const n = o.swingIn ? { x: -u.y, y: u.x } : { x: u.y, y: -u.x };
  const along = o.hinge === 'start' ? o.offset : o.offset + o.width;
  const hinge = {
    x: w.a.x + u.x * along + n.x * (w.thickness / 2),
    y: w.a.y + u.y * along + n.y * (w.thickness / 2),
  };
  const closed = o.hinge === 'start' ? u : { x: -u.x, y: -u.y };
  return sector(hinge, closed, n, o.width);
}

export function doorSwings(plan: Plan): ClearanceShape[] {
  const walls = new Map(plan.walls.map((w) => [w.id, w]));
  return plan.openings.flatMap((o) => {
    const w = walls.get(o.wallId);
    return w && o.kind === 'door' ? [doorSwing(w, o)] : [];
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/geometry && npm run typecheck`
Expected: 새 테스트와 기존 clearance 테스트 모두 PASS

- [ ] **Step 5: Commit**

```bash
git add src/geometry
git commit -m "feat: structure editing geometry and point picking"
```

---

### Task 4: 2D 편집 순수 로직(스냅, 축척, 뷰박스, SVG 경로, 3D 카메라 맞춤)

**Files:**
- Create: `src/editor2d/snapping.ts`, `src/editor2d/calibration.ts`, `src/editor2d/viewBox.ts`, `src/editor2d/svg.ts`, `src/editor2d/itemColor.ts`, `src/scene3d/cameraFit.ts`, `src/scene3d/pick3d.ts` 와 각 `*.test.ts`

**Interfaces:**
- Consumes: `Background`, `Product`, `Vec2` (Task 2), `ClearanceShape`, `corners` (계획 1), `cmToM` (Task 1)
- Produces:
  - `ENDPOINT_SNAP_CM = 15`, `snapAngle(prev: Vec2, p: Vec2): Vec2`, `snapToEndpoint(p: Vec2, endpoints: Vec2[], maxDist?: number): Vec2 | null`, `wallToolPoint(raw: Vec2, prev: Vec2 | null, endpoints: Vec2[], snap: boolean): Vec2`, `wallSegments(points: Vec2[]): [Vec2, Vec2][]`
  - `SCALE_TOLERANCE = 0.02`, `cmPerPxFrom(a, b, lengthCm): number | null`, `scaleMismatch(primary, check): number`, `checkMismatch(bg: Background): number | null`, `planToImagePx(bg, p): Vec2`, `imagePxToPlan(bg, p): Vec2`, `type CalibrationDraft = { target: 'primary' | 'check'; points: Vec2[] }`, `calibrationResult(bg, draft, lengthCm): { background: Background; mismatch: number | null } | null`, `scaleText(bg): string`
  - `type ViewBox = { x; y; w; h }`, `MIN_VIEW_CM = 50`, `MAX_VIEW_CM = 50000`, `fitViewBox(b: Bounds, aspect: number, margin?: number): ViewBox`, `zoomAt(v, p, factor): ViewBox`, `panBy(v, dx, dy): ViewBox`
  - `pointsAttr(pts: Vec2[]): string`, `sectorPath(c: Vec2, r: number, start: number, end: number): string`, `shapePath(shape: ClearanceShape): string`
  - `MISSING_COLOR = '#9aa0a6'`, `itemColor(product: Product, variantId: string): string`
  - `type Bounds = { minX; minY; maxX; maxY }`, `type CameraFit = { position: [n, n, n]; target: [n, n, n] }`, `fitTop(b): CameraFit`, `fitPerspective(b): CameraFit`, `fitTopZoom(b, width, height, margin?): number`
  - `itemIdsFromIntersections(hits: { object: THREE.Object3D }[]): string[]` — `userData.itemId`를 부모로 올라가며 찾고, 가까운 순서·중복 제거

- [ ] **Step 1: 실패하는 테스트 작성**

`src/editor2d/snapping.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { snapAngle, snapToEndpoint, wallSegments, wallToolPoint } from './snapping';

describe('snapAngle', () => {
  it('0°/45°/90° 방향으로 맞춘다', () => {
    expect(snapAngle({ x: 0, y: 0 }, { x: 100, y: 7 })).toEqual({ x: 100, y: 0 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 100, y: 95 })).toEqual({ x: 98, y: 98 });
    expect(snapAngle({ x: 0, y: 0 }, { x: 7, y: 100 })).toEqual({ x: 0, y: 100 });
  });
});

describe('snapToEndpoint / wallToolPoint', () => {
  it('15cm 이내 끝점에 붙는다', () => {
    expect(snapToEndpoint({ x: 203, y: 2 }, [{ x: 200, y: 0 }])).toEqual({ x: 200, y: 0 });
    expect(snapToEndpoint({ x: 230, y: 0 }, [{ x: 200, y: 0 }])).toBeNull();
  });

  it('끝점 스냅이 각도 스냅보다 먼저다', () => {
    expect(wallToolPoint({ x: 203, y: 12 }, { x: 0, y: 0 }, [{ x: 200, y: 10 }], true)).toEqual({ x: 200, y: 10 });
  });

  it('스냅을 끄면 반올림만 한다', () => {
    expect(wallToolPoint({ x: 203.4, y: 2.6 }, { x: 0, y: 0 }, [{ x: 200, y: 0 }], false)).toEqual({ x: 203, y: 3 });
  });
});

describe('wallSegments', () => {
  it('같은 점이 연속되면 그 구간은 버린다', () => {
    const pts = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 50 }];
    expect(wallSegments(pts)).toEqual([
      [{ x: 0, y: 0 }, { x: 100, y: 0 }],
      [{ x: 100, y: 0 }, { x: 100, y: 50 }],
    ]);
  });
});
```

`src/editor2d/calibration.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import type { Background } from '../model/schema';
import { calibrationResult, cmPerPxFrom, imagePxToPlan, planToImagePx, scaleText } from './calibration';

const bg: Background = { imageRef: 'i', widthPx: 800, heightPx: 600, cmPerPx: 1, offsetX: 10, offsetY: 20, rotation: 0, opacity: 0.5 };

describe('cmPerPxFrom', () => {
  it('400px 구간에 4,000mm를 넣으면 10mm/px (F01)', () => {
    expect(cmPerPxFrom({ x: 0, y: 0 }, { x: 400, y: 0 }, 400)).toBe(1);
  });

  it('두 점이 같으면 null', () => {
    expect(cmPerPxFrom({ x: 5, y: 5 }, { x: 5, y: 5 }, 100)).toBeNull();
  });
});

describe('좌표 변환', () => {
  it('평면 cm와 이미지 px를 왕복한다', () => {
    const scaled = { ...bg, cmPerPx: 2 };
    const px = planToImagePx(scaled, { x: 110, y: 220 });
    expect(px).toEqual({ x: 50, y: 100 });
    expect(imagePxToPlan(scaled, px)).toEqual({ x: 110, y: 220 });
  });
});

describe('calibrationResult', () => {
  it('기준 보정은 축척과 기준선을 저장한다', () => {
    const r = calibrationResult(bg, { target: 'primary', points: [{ x: 0, y: 0 }, { x: 200, y: 0 }] }, 400);
    expect(r?.background.cmPerPx).toBe(2);
    expect(r?.background.calibration).toEqual({ a: { x: 0, y: 0 }, b: { x: 200, y: 0 }, lengthCm: 400 });
    expect(r?.mismatch).toBeNull();
  });

  it('검증 길이가 2% 넘게 다르면 근사로 표시한다', () => {
    const primary = calibrationResult(bg, { target: 'primary', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }] }, 400)!.background;
    const r = calibrationResult(primary, { target: 'check', points: [{ x: 0, y: 0 }, { x: 0, y: 300 }] }, 309);
    expect(r?.mismatch).toBeCloseTo(0.03);
    expect(r?.background.cmPerPx).toBe(1);
    expect(scaleText(r!.background)).toContain('근사: 검증 길이와 3.0% 차이');
  });

  it('기준 보정 없이 검증 길이만 넣으면 null', () => {
    expect(calibrationResult(bg, { target: 'check', points: [{ x: 0, y: 0 }, { x: 0, y: 300 }] }, 300)).toBeNull();
  });
});

describe('scaleText', () => {
  it('보정 전과 일치 상태를 문장으로', () => {
    expect(scaleText(bg)).toBe('축척 미보정: 도면 위 두 점과 실제 길이로 보정하세요.');
    const primary = calibrationResult(bg, { target: 'primary', points: [{ x: 0, y: 0 }, { x: 400, y: 0 }] }, 400)!.background;
    const ok = calibrationResult(primary, { target: 'check', points: [{ x: 0, y: 0 }, { x: 0, y: 300 }] }, 301)!.background;
    expect(scaleText(ok)).toBe('축척 1px = 1.00cm (기준 400cm) · 검증 길이와 일치');
  });
});
```

`src/editor2d/viewBox.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fitViewBox, panBy, zoomAt } from './viewBox';

describe('viewBox', () => {
  it('여백을 두고 화면 비율에 맞춰 평면 전체를 담는다', () => {
    expect(fitViewBox({ minX: 0, minY: 0, maxX: 600, maxY: 400 }, 2)).toEqual({ x: -300, y: -100, w: 1200, h: 600 });
  });

  it('확대해도 커서 아래 점은 그대로다', () => {
    expect(zoomAt({ x: 0, y: 0, w: 100, h: 100 }, { x: 50, y: 50 }, 2)).toEqual({ x: 25, y: 25, w: 50, h: 50 });
  });

  it('너무 확대하면 50cm에서 멈춘다', () => {
    expect(zoomAt({ x: 0, y: 0, w: 100, h: 100 }, { x: 0, y: 0 }, 100).w).toBe(50);
  });

  it('panBy는 원점을 옮긴다', () => {
    expect(panBy({ x: 0, y: 0, w: 10, h: 10 }, 5, -3)).toEqual({ x: 5, y: -3, w: 10, h: 10 });
  });
});
```

`src/editor2d/svg.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { pointsAttr, sectorPath, shapePath } from './svg';

describe('svg', () => {
  it('pointsAttr는 소수 둘째 자리까지', () => {
    expect(pointsAttr([{ x: 0, y: 0 }, { x: 1.2345, y: 2 }])).toBe('0,0 1.23,2');
  });

  it('sectorPath는 시계 방향(y 아래) 호를 그린다', () => {
    expect(sectorPath({ x: 0, y: 0 }, 10, 0, Math.PI / 2)).toBe('M 0 0 L 10 0 A 10 10 0 0 1 0 10 Z');
  });

  it('shapePath는 사각형 영역을 닫힌 경로로', () => {
    expect(shapePath({ kind: 'rect', obb: { cx: 0, cy: 0, hw: 10, hd: 5, angle: 0 } })).toBe('M -10 -5 L 10 -5 L 10 5 L -10 5 Z');
  });
});
```

`src/editor2d/itemColor.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { CATALOG } from '../catalog/products';
import { itemColor } from './itemColor';

describe('itemColor', () => {
  it('패널 → 몸체 → 천 → 프레임 → 나무 순으로 대표색을 고른다', () => {
    const fridge = CATALOG.find((p) => p.id === 'samsung-bespoke-4door-sample')!;
    expect(itemColor(fridge, 'glam-navy')).toBe('#2b3446');
    expect(itemColor(CATALOG.find((p) => p.id === 'sofa-3seat')!, 'gray')).toBe('#8a8f98');
    expect(itemColor(fridge, 'missing')).toBe('#e9e6df');
  });
});
```

`src/scene3d/cameraFit.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fitPerspective, fitTop, fitTopZoom } from './cameraFit';

const b = { minX: 0, minY: 0, maxX: 1000, maxY: 690 };

describe('cameraFit', () => {
  it('탑뷰는 평면 중심 위에서 내려다본다', () => {
    const f = fitTop(b);
    expect(f.target).toEqual([5, 0, 3.45]);
    expect(f.position[0]).toBe(5);
    expect(f.position[1]).toBe(30);
    expect(f.position[2]).toBeCloseTo(3.46);
  });

  it('탑뷰 줌은 평면 전체(여백 15%)가 화면에 들어오게', () => {
    expect(fitTopZoom(b, 1100, 690)).toBeCloseTo(86.96, 1);
  });

  it('원근 시점은 평면 크기에 비례해 물러선다', () => {
    const f = fitPerspective(b);
    expect(f.target).toEqual([5, 0, 3.45]);
    expect(f.position[1]).toBeCloseTo((10 * 1.3 + 2) * 0.8);
  });
});
```

`src/scene3d/pick3d.test.ts`:
```ts
import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { itemIdsFromIntersections } from './pick3d';

describe('itemIdsFromIntersections', () => {
  it('부모 group의 itemId를 가까운 순서로 중복 없이', () => {
    const a = new THREE.Group();
    a.userData.itemId = 'a';
    const meshA1 = new THREE.Mesh();
    const meshA2 = new THREE.Mesh();
    a.add(meshA1, meshA2);
    const b = new THREE.Group();
    b.userData.itemId = 'b';
    const meshB = new THREE.Mesh();
    b.add(meshB);
    const floor = new THREE.Mesh();
    expect(itemIdsFromIntersections([{ object: meshA1 }, { object: floor }, { object: meshB }, { object: meshA2 }])).toEqual(['a', 'b']);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/editor2d src/scene3d/cameraFit.test.ts src/scene3d/pick3d.test.ts`
Expected: 모듈 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/editor2d/snapping.ts`:
```ts
import type { Vec2 } from '../model/schema';

export const ENDPOINT_SNAP_CM = 15;

const STEP = Math.PI / 4;
const round = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

export function snapAngle(prev: Vec2, p: Vec2): Vec2 {
  const len = Math.hypot(p.x - prev.x, p.y - prev.y);
  if (len === 0) return { ...prev };
  const a = Math.round(Math.atan2(p.y - prev.y, p.x - prev.x) / STEP) * STEP;
  return round({ x: prev.x + Math.cos(a) * len, y: prev.y + Math.sin(a) * len });
}

export function snapToEndpoint(p: Vec2, endpoints: Vec2[], maxDist = ENDPOINT_SNAP_CM): Vec2 | null {
  let best: Vec2 | null = null;
  let bestDist = Infinity;
  for (const e of endpoints) {
    const d = Math.hypot(p.x - e.x, p.y - e.y);
    if (d <= maxDist && d < bestDist) {
      best = e;
      bestDist = d;
    }
  }
  return best ? { ...best } : null;
}

export function wallToolPoint(raw: Vec2, prev: Vec2 | null, endpoints: Vec2[], snap: boolean): Vec2 {
  if (!snap) return round(raw);
  const endpoint = snapToEndpoint(raw, endpoints);
  if (endpoint) return endpoint;
  return prev ? snapAngle(prev, raw) : round(raw);
}

export function wallSegments(points: Vec2[]): [Vec2, Vec2][] {
  const segments: [Vec2, Vec2][] = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    if (a.x !== b.x || a.y !== b.y) segments.push([a, b]);
  }
  return segments;
}
```

`src/editor2d/calibration.ts`:
```ts
import type { Background, Vec2 } from '../model/schema';

export const SCALE_TOLERANCE = 0.02;

export type CalibrationDraft = { target: 'primary' | 'check'; points: Vec2[] };

export function cmPerPxFrom(a: Vec2, b: Vec2, lengthCm: number): number | null {
  const d = Math.hypot(b.x - a.x, b.y - a.y);
  if (d === 0 || !(lengthCm > 0)) return null;
  return lengthCm / d;
}

export function scaleMismatch(primary: number, check: number): number {
  return Math.abs(primary - check) / primary;
}

export function checkMismatch(bg: Background): number | null {
  const check = bg.calibration?.check;
  if (!check) return null;
  const s = cmPerPxFrom(check.a, check.b, check.lengthCm);
  return s === null ? null : scaleMismatch(bg.cmPerPx, s);
}

export function planToImagePx(bg: Background, p: Vec2): Vec2 {
  return { x: (p.x - bg.offsetX) / bg.cmPerPx, y: (p.y - bg.offsetY) / bg.cmPerPx };
}

export function imagePxToPlan(bg: Background, p: Vec2): Vec2 {
  return { x: bg.offsetX + p.x * bg.cmPerPx, y: bg.offsetY + p.y * bg.cmPerPx };
}

export function calibrationResult(
  bg: Background,
  draft: CalibrationDraft,
  lengthCm: number,
): { background: Background; mismatch: number | null } | null {
  if (draft.points.length !== 2) return null;
  const [a, b] = draft.points;
  const s = cmPerPxFrom(a, b, lengthCm);
  if (s === null) return null;
  const line = { a, b, lengthCm: Math.round(lengthCm) };
  if (draft.target === 'primary') {
    const check = bg.calibration?.check;
    const background: Background = { ...bg, cmPerPx: s, calibration: check ? { ...line, check } : line };
    return { background, mismatch: checkMismatch(background) };
  }
  if (!bg.calibration) return null;
  const background: Background = { ...bg, calibration: { ...bg.calibration, check: line } };
  return { background, mismatch: checkMismatch(background) };
}

export function scaleText(bg: Background): string {
  if (!bg.calibration) return '축척 미보정: 도면 위 두 점과 실제 길이로 보정하세요.';
  const base = `축척 1px = ${bg.cmPerPx.toFixed(2)}cm (기준 ${bg.calibration.lengthCm}cm)`;
  const m = checkMismatch(bg);
  if (m === null) return base;
  return m > SCALE_TOLERANCE ? `${base} · 근사: 검증 길이와 ${(m * 100).toFixed(1)}% 차이` : `${base} · 검증 길이와 일치`;
}
```

`src/editor2d/viewBox.ts`:
```ts
import type { Vec2 } from '../model/schema';

export type ViewBox = { x: number; y: number; w: number; h: number };
type Bounds = { minX: number; minY: number; maxX: number; maxY: number };

export const MIN_VIEW_CM = 50;
export const MAX_VIEW_CM = 50000;

export function fitViewBox(b: Bounds, aspect: number, margin = 100): ViewBox {
  const a = aspect > 0 && Number.isFinite(aspect) ? aspect : 1;
  let w = b.maxX - b.minX + margin * 2;
  let h = b.maxY - b.minY + margin * 2;
  if (w / h > a) h = w / a;
  else w = h * a;
  const cx = (b.minX + b.maxX) / 2;
  const cy = (b.minY + b.maxY) / 2;
  return { x: cx - w / 2, y: cy - h / 2, w, h };
}

export function zoomAt(v: ViewBox, p: Vec2, factor: number): ViewBox {
  const w = Math.min(MAX_VIEW_CM, Math.max(MIN_VIEW_CM, v.w / factor));
  const k = w / v.w;
  return { x: p.x - (p.x - v.x) * k, y: p.y - (p.y - v.y) * k, w, h: v.h * k };
}

export function panBy(v: ViewBox, dx: number, dy: number): ViewBox {
  return { ...v, x: v.x + dx, y: v.y + dy };
}
```

`src/editor2d/svg.ts`:
```ts
import type { ClearanceShape } from '../geometry/clearance';
import { corners } from '../geometry/obb';
import type { Vec2 } from '../model/schema';

const r2 = (n: number) => Math.round(n * 100) / 100 + 0;

export function pointsAttr(pts: Vec2[]): string {
  return pts.map((p) => `${r2(p.x)},${r2(p.y)}`).join(' ');
}

export function sectorPath(c: Vec2, r: number, start: number, end: number): string {
  const p1 = { x: c.x + r * Math.cos(start), y: c.y + r * Math.sin(start) };
  const p2 = { x: c.x + r * Math.cos(end), y: c.y + r * Math.sin(end) };
  return `M ${r2(c.x)} ${r2(c.y)} L ${r2(p1.x)} ${r2(p1.y)} A ${r2(r)} ${r2(r)} 0 0 1 ${r2(p2.x)} ${r2(p2.y)} Z`;
}

export function shapePath(shape: ClearanceShape): string {
  if (shape.kind === 'sector') return sectorPath(shape.center, shape.radius, shape.start, shape.end);
  const [first, ...rest] = corners(shape.obb);
  return `M ${r2(first.x)} ${r2(first.y)} ${rest.map((p) => `L ${r2(p.x)} ${r2(p.y)}`).join(' ')} Z`;
}
```
(`+ 0`은 `-0`을 `0`으로 바꿔 문자열에 `-0`이 나오지 않게 한다.)

`src/editor2d/itemColor.ts`:
```ts
import type { Product } from '../model/schema';

export const MISSING_COLOR = '#9aa0a6';

const KEYS = ['panel', 'body', 'fabric', 'frame', 'wood'] as const;

export function itemColor(product: Product, variantId: string): string {
  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  for (const key of KEYS) {
    const c = variant.colors[key];
    if (c) return c;
  }
  return '#c8b8a0';
}
```

`src/scene3d/cameraFit.ts`:
```ts
import { cmToM } from '../model/units';

export type Bounds = { minX: number; minY: number; maxX: number; maxY: number };
type Vec3 = [number, number, number];
export type CameraFit = { position: Vec3; target: Vec3 };

const center = (b: Bounds): Vec3 => [cmToM((b.minX + b.maxX) / 2), 0, cmToM((b.minY + b.maxY) / 2)];

export function fitTop(b: Bounds): CameraFit {
  const t = center(b);
  return { position: [t[0], 30, t[2] + 0.01], target: t };
}

export function fitPerspective(b: Bounds): CameraFit {
  const t = center(b);
  const dist = cmToM(Math.max(b.maxX - b.minX, b.maxY - b.minY)) * 1.3 + 2;
  return { position: [t[0] + dist * 0.35, dist * 0.8, t[2] + dist * 0.75], target: t };
}

export function fitTopZoom(b: Bounds, width: number, height: number, margin = 1.15): number {
  const bw = Math.max(cmToM(b.maxX - b.minX) * margin, 0.01);
  const bh = Math.max(cmToM(b.maxY - b.minY) * margin, 0.01);
  return Math.min(width / bw, height / bh);
}
```

`src/scene3d/pick3d.ts`:
```ts
import type * as THREE from 'three';

export function itemIdsFromIntersections(hits: { object: THREE.Object3D }[]): string[] {
  const ids: string[] = [];
  for (const hit of hits) {
    let o: THREE.Object3D | null = hit.object;
    while (o && typeof o.userData.itemId !== 'string') o = o.parent;
    const id: unknown = o?.userData.itemId;
    if (typeof id === 'string' && !ids.includes(id)) ids.push(id);
  }
  return ids;
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/editor2d src/scene3d && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/editor2d src/scene3d/cameraFit.ts src/scene3d/cameraFit.test.ts src/scene3d/pick3d.ts src/scene3d/pick3d.test.ts
git commit -m "feat: pure helpers for wall snapping, scale calibration, view box, svg paths and camera fit"
```

---
### Task 5: 스토어 구조 편집 액션과 잠금

**Files:**
- Modify: `src/model/store.ts` (전체 교체)
- Test: `src/model/store.test.ts` (추가)

**Interfaces:**
- Consumes: `roomRectWalls`, `fitOpening`, `refitOpenings`, `moveEndpoint`, `setWallLength` (Task 3), `wallLength` (계획 1), `newId` (Task 2), `activeItems`, `withActiveItems` (Task 1), `Background` (Task 2)
- Produces (`PlanState`에 추가):
  - `addWalls(walls: Omit<Wall, 'id'>[]): string[]`
  - `updateWall(id: string, patch: Partial<Pick<Wall, 'thickness' | 'height' | 'verified'>>): void`
  - `resizeWall(id: string, length: number): string | null` — 오류 문구 또는 null(성공). 연결된 벽 끝점도 함께 이동, 개구부는 당겨 맞추고 불가능하면 거부
  - `removeWall(id: string): void` — 그 벽의 개구부도 삭제
  - `dragEndpoint(from: Vec2, to: Vec2): void` — `beginDrag`~`endDrag` 사이에서 쓰며 매번 `dragOrigin`의 벽에서 다시 계산한다. 개구부가 들어가지 않는 위치면 무시(마지막 유효 위치 유지)
  - `addRoomRect(input: { origin: Vec2; w: number; d: number; thickness: number; height: number; name: string }): void`
  - `addOpening(opening: Omit<Opening, 'id'>): string | null` — 벽 안으로 당겨 맞춤, 벽보다 넓으면 null
  - `updateOpening(id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>): string | null` — 범위를 벗어나면 허용 범위를 담은 오류 문구
  - `removeOpening(id)`, `addRoom(name: string, label: Vec2): string`, `updateRoom(id, patch: Partial<Omit<Room, 'id'>>)`, `removeRoom(id)`
  - `setBackground(background: Background | undefined): void`, `updateBackground(patch: Partial<Background>): void`
  - 잠금: `item.locked`이면 `updateItem`의 x/y/rotation, `rotateItem`, `dragItem`을 무시한다(`{ locked: false }`가 들어간 patch는 허용)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/store.test.ts` 끝에 추가:
```ts
describe('구조 편집', () => {
  const twoWalls = () =>
    createPlanStore({
      ...SAMPLE_PLAN,
      walls: [
        { id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 },
        { id: 'v', a: { x: 400, y: 0 }, b: { x: 400, y: 300 }, thickness: 10, height: 230 },
      ],
      openings: [{ id: 'o', wallId: 'w', kind: 'door', offset: 250, width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true }],
      rooms: [],
    });

  it('벽 길이를 바꾸면 연결된 벽 끝점도 따라온다', () => {
    const s = twoWalls();
    expect(s.getState().resizeWall('w', 500)).toBeNull();
    expect(s.getState().plan.walls[0].b).toEqual({ x: 500, y: 0 });
    expect(s.getState().plan.walls[1].a).toEqual({ x: 500, y: 0 });
  });

  it('벽을 줄이면 개구부를 벽 안으로 당긴다', () => {
    const s = twoWalls();
    expect(s.getState().resizeWall('w', 300)).toBeNull();
    expect(s.getState().plan.openings[0].offset).toBe(210);
  });

  it('개구부가 들어갈 수 없게 줄이면 거부하고 그대로 둔다', () => {
    const s = twoWalls();
    const pastLen = s.getState().past.length;
    expect(s.getState().resizeWall('w', 80)).toBe('문이(가) 벽 길이를 벗어나 변경하지 않았습니다.');
    expect(s.getState().plan.walls[0].b).toEqual({ x: 400, y: 0 });
    expect(s.getState().past.length).toBe(pastLen);
    expect(s.getState().resizeWall('w', 0)).toBe('길이는 1cm 이상이어야 합니다.');
  });

  it('끝점 드래그는 실행 취소 한 번으로 되돌아간다', () => {
    const s = twoWalls();
    s.getState().beginDrag();
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 450, y: 20.4 });
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 500, y: 0 });
    s.getState().endDrag();
    expect(s.getState().plan.walls[1].a).toEqual({ x: 500, y: 0 });
    s.getState().undo();
    expect(s.getState().plan.walls[0].b).toEqual({ x: 400, y: 0 });
    expect(s.getState().plan.walls[1].a).toEqual({ x: 400, y: 0 });
  });

  it('끝점 드래그로 개구부가 벗어나면 마지막 유효 위치를 유지한다', () => {
    const s = twoWalls();
    s.getState().beginDrag();
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 350, y: 0 });
    s.getState().dragEndpoint({ x: 400, y: 0 }, { x: 50, y: 0 });
    s.getState().endDrag();
    expect(s.getState().plan.walls[0].b).toEqual({ x: 350, y: 0 });
  });

  it('removeWall은 그 벽의 개구부도 지우고 선택을 푼다', () => {
    const s = twoWalls();
    s.getState().select('o');
    s.getState().removeWall('w');
    expect(s.getState().plan.walls.map((w) => w.id)).toEqual(['v']);
    expect(s.getState().plan.openings).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('addRoomRect는 내측 치수를 유지하는 벽 4개와 방 이름을 한 번에 만든다', () => {
    const s = twoWalls();
    const pastLen = s.getState().past.length;
    s.getState().addRoomRect({ origin: { x: 100, y: 100 }, w: 400, d: 300, thickness: 15, height: 230, name: '거실' });
    const walls = s.getState().plan.walls.slice(-4);
    const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
    const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
    expect(Math.max(...xs) - Math.min(...xs) - 15).toBe(400);
    expect(Math.max(...ys) - Math.min(...ys) - 15).toBe(300);
    expect(s.getState().plan.rooms).toEqual([expect.objectContaining({ name: '거실', label: { x: 300, y: 250 } })]);
    expect(s.getState().past.length).toBe(pastLen + 1);
  });

  it('addOpening은 벽 안으로 맞추고 벽보다 넓으면 null', () => {
    const s = twoWalls();
    const id = s.getState().addOpening({ wallId: 'v', kind: 'window', offset: 280, width: 120, height: 120, sill: 90, hinge: 'start', swingIn: false });
    expect(s.getState().plan.openings.find((o) => o.id === id)?.offset).toBe(180);
    expect(s.getState().addOpening({ wallId: 'v', kind: 'door', offset: 0, width: 400, height: 210, sill: 0, hinge: 'start', swingIn: true })).toBeNull();
  });

  it('updateOpening은 벽을 벗어나는 값을 허용 범위와 함께 거부한다', () => {
    const s = twoWalls();
    expect(s.getState().updateOpening('o', { offset: 350 })).toBe('벽 시작점에서 거리는 0–310cm 사이여야 합니다.');
    expect(s.getState().updateOpening('o', { width: 500 })).toBe('폭은 1–400cm 사이여야 합니다.');
    expect(s.getState().plan.openings[0].offset).toBe(250);
    expect(s.getState().updateOpening('o', { width: 100, verified: true })).toBeNull();
    expect(s.getState().plan.openings[0]).toMatchObject({ width: 100, verified: true });
  });

  it('방 이름 추가·수정·삭제', () => {
    const s = twoWalls();
    const id = s.getState().addRoom('방', { x: 10.6, y: 20 });
    s.getState().updateRoom(id, { name: '서재' });
    expect(s.getState().plan.rooms[0]).toEqual({ id, name: '서재', label: { x: 11, y: 20 } });
    s.getState().select(id);
    s.getState().removeRoom(id);
    expect(s.getState().plan.rooms).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('배경 설정·수정·제거', () => {
    const s = twoWalls();
    s.getState().setBackground({ imageRef: 'img', widthPx: 400, heightPx: 300, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5 });
    s.getState().updateBackground({ opacity: 0.8 });
    expect(s.getState().plan.background?.opacity).toBe(0.8);
    s.getState().setBackground(undefined);
    expect(s.getState().plan.background).toBeUndefined();
  });
});

describe('잠금', () => {
  it('잠긴 아이템은 이동·회전·드래그되지 않지만 잠금 해제는 된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addItem(P, V, { x: 0, y: 0 });
    s.getState().updateItem(id, { locked: true });
    s.getState().updateItem(id, { x: 50 });
    s.getState().rotateItem(id, 90);
    s.getState().beginDrag();
    s.getState().dragItem(id, 80, 80);
    s.getState().endDrag();
    expect(s.getState().plan.items[0]).toMatchObject({ x: 0, y: 0, rotation: 0, locked: true });
    s.getState().updateItem(id, { verified: true });
    expect(s.getState().plan.items[0].verified).toBe(true);
    s.getState().updateItem(id, { locked: false, x: 10 });
    expect(s.getState().plan.items[0]).toMatchObject({ x: 10, locked: false });
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model/store.test.ts`
Expected: 새 액션이 없어 FAIL(TypeError: ... is not a function), 잠금 테스트 FAIL

- [ ] **Step 3: 구현 — `src/model/store.ts` 전체 교체**

```ts
import { createStore, type StoreApi } from 'zustand/vanilla';
import { fitOpening, moveEndpoint, refitOpenings, roomRectWalls, setWallLength } from '../geometry/structure';
import { wallLength } from '../geometry/walls';
import { newId } from './ids';
import { activeItems, withActiveItems } from './layout';
import type { Background, Item, Opening, Plan, Product, Room, Vec2, Wall } from './schema';

export const HISTORY_LIMIT = 100;

const OPENING_LABEL: Record<Opening['kind'], string> = { door: '문', window: '창', opening: '개구부' };

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
  dragEndpoint(from: Vec2, to: Vec2): void;
  endDrag(): void;
  replacePlan(plan: Plan): void;
  addCustomProduct(input: { name: string; w: number; d: number; h: number }): string;
  addWalls(walls: Omit<Wall, 'id'>[]): string[];
  updateWall(id: string, patch: Partial<Pick<Wall, 'thickness' | 'height' | 'verified'>>): void;
  resizeWall(id: string, length: number): string | null;
  removeWall(id: string): void;
  addRoomRect(input: { origin: Vec2; w: number; d: number; thickness: number; height: number; name: string }): void;
  addOpening(opening: Omit<Opening, 'id'>): string | null;
  updateOpening(id: string, patch: Partial<Omit<Opening, 'id' | 'wallId'>>): string | null;
  removeOpening(id: string): void;
  addRoom(name: string, label: Vec2): string;
  updateRoom(id: string, patch: Partial<Omit<Room, 'id'>>): void;
  removeRoom(id: string): void;
  setBackground(background: Background | undefined): void;
  updateBackground(patch: Partial<Background>): void;
  undo(): void;
  redo(): void;
};

const normalizeDeg = (d: number) => ((Math.round(d) % 360) + 360) % 360;
const roundVec = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

function normalizeItem(item: Item): Item {
  return { ...item, x: Math.round(item.x), y: Math.round(item.y), rotation: normalizeDeg(item.rotation) };
}

function openingError(plan: Plan, openingId: string): string {
  const kind = plan.openings.find((o) => o.id === openingId)?.kind ?? 'opening';
  return `${OPENING_LABEL[kind]}이(가) 벽 길이를 벗어나 변경하지 않았습니다.`;
}

export function createPlanStore(initial: Plan): StoreApi<PlanState> {
  return createStore<PlanState>()((set, get) => {
    const commit = (plan: Plan, extra: Partial<PlanState> = {}) =>
      set((s) =>
        s.dragOrigin
          ? { plan, ...extra }
          : { plan, past: [...s.past, s.plan].slice(-HISTORY_LIMIT), future: [], ...extra },
      );
    const withItems = (fn: (items: Item[]) => Item[]): Plan => withActiveItems(get().plan, fn(activeItems(get().plan)));
    const findItem = (id: string) => activeItems(get().plan).find((i) => i.id === id);
    const deselectIf = (ids: Set<string>) => {
      const sel = get().selectedId;
      return sel !== null && ids.has(sel) ? null : sel;
    };

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

      updateItem: (id, patch) => {
        const item = findItem(id);
        if (!item) return;
        const next: Partial<Omit<Item, 'id'>> = { ...patch };
        if (item.locked && patch.locked !== false) {
          delete next.x;
          delete next.y;
          delete next.rotation;
          if (Object.keys(next).length === 0) return;
        }
        commit(withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, ...next }) : i))));
      },

      removeItem: (id) => {
        if (!findItem(id)) return;
        commit(withItems((items) => items.filter((i) => i.id !== id)), { selectedId: deselectIf(new Set([id])) });
      },

      duplicateItem: (id) => {
        const src = findItem(id);
        if (!src) return null;
        const copy = { ...src, id: newId('item'), x: src.x + 20, y: src.y + 20 };
        commit(withItems((items) => [...items, copy]), { selectedId: copy.id });
        return copy.id;
      },

      rotateItem: (id, deltaDeg) => {
        const src = findItem(id);
        if (src) get().updateItem(id, { rotation: src.rotation + deltaDeg });
      },

      beginDrag: () => set({ dragOrigin: get().plan }),

      dragItem: (id, x, y) => {
        if (!get().dragOrigin) return;
        const item = findItem(id);
        if (!item || item.locked) return;
        set({ plan: withItems((items) => items.map((i) => (i.id === id ? normalizeItem({ ...i, x, y }) : i))) });
      },

      dragEndpoint: (from, to) => {
        const origin = get().dragOrigin;
        if (!origin) return;
        const walls = moveEndpoint(origin.walls, from, roundVec(to));
        const fit = refitOpenings(walls, origin.openings);
        if (!fit.ok) return;
        set({ plan: { ...get().plan, walls, openings: fit.openings } });
      },

      endDrag: () => {
        const { dragOrigin, plan, past } = get();
        if (dragOrigin && dragOrigin !== plan) {
          set({ past: [...past, dragOrigin].slice(-HISTORY_LIMIT), future: [], dragOrigin: null });
        } else {
          set({ dragOrigin: null });
        }
      },

      replacePlan: (plan) => commit(plan, { selectedId: null, dragOrigin: null }),

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

      addWalls: (walls) => {
        const created = walls.map((w) => ({ ...w, a: roundVec(w.a), b: roundVec(w.b), id: newId('wall') }));
        if (created.length === 0) return [];
        commit({ ...get().plan, walls: [...get().plan.walls, ...created] });
        return created.map((w) => w.id);
      },

      updateWall: (id, patch) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        commit({ ...plan, walls: plan.walls.map((w) => (w.id === id ? { ...w, ...patch } : w)) });
      },

      resizeWall: (id, length) => {
        const plan = get().plan;
        const wall = plan.walls.find((w) => w.id === id);
        if (!wall) return null;
        if (!(length >= 1)) return '길이는 1cm 이상이어야 합니다.';
        const walls = moveEndpoint(plan.walls, wall.b, setWallLength(wall, length).b);
        const fit = refitOpenings(walls, plan.openings);
        if (!fit.ok) return openingError(plan, fit.openingId);
        commit({ ...plan, walls, openings: fit.openings });
        return null;
      },

      removeWall: (id) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        const gone = new Set([id, ...plan.openings.filter((o) => o.wallId === id).map((o) => o.id)]);
        commit(
          { ...plan, walls: plan.walls.filter((w) => w.id !== id), openings: plan.openings.filter((o) => o.wallId !== id) },
          { selectedId: deselectIf(gone) },
        );
      },

      addRoomRect: ({ origin, w, d, thickness, height, name }) => {
        if ([w, d, thickness, height].some((v) => !(v >= 1))) return;
        const plan = get().plan;
        const o = roundVec(origin);
        const walls = roomRectWalls(o, Math.round(w), Math.round(d), Math.round(thickness), Math.round(height)).map((x) => ({
          ...x,
          id: newId('wall'),
        }));
        const room = { id: newId('room'), name, label: roundVec({ x: o.x + w / 2, y: o.y + d / 2 }) };
        commit({ ...plan, walls: [...plan.walls, ...walls], rooms: [...plan.rooms, room] });
      },

      addOpening: (opening) => {
        const plan = get().plan;
        const wall = plan.walls.find((w) => w.id === opening.wallId);
        if (!wall) return null;
        const offset = fitOpening(wall, opening.offset, opening.width);
        if (offset === null) return null;
        const created = { ...opening, offset, id: newId('opening') };
        commit({ ...plan, openings: [...plan.openings, created] });
        return created.id;
      },

      updateOpening: (id, patch) => {
        const plan = get().plan;
        const current = plan.openings.find((o) => o.id === id);
        if (!current) return null;
        const wall = plan.walls.find((w) => w.id === current.wallId);
        if (!wall) return null;
        const next = { ...current, ...patch };
        const len = Math.floor(wallLength(wall));
        if (next.width < 1 || next.width > len) return `폭은 1–${len}cm 사이여야 합니다.`;
        if (next.offset < 0 || next.offset + next.width > len) return `벽 시작점에서 거리는 0–${len - next.width}cm 사이여야 합니다.`;
        if (next.height < 1 || next.sill < 0) return '높이는 1cm 이상, 창턱은 0cm 이상이어야 합니다.';
        commit({ ...plan, openings: plan.openings.map((o) => (o.id === id ? next : o)) });
        return null;
      },

      removeOpening: (id) => {
        const plan = get().plan;
        if (!plan.openings.some((o) => o.id === id)) return;
        commit({ ...plan, openings: plan.openings.filter((o) => o.id !== id) }, { selectedId: deselectIf(new Set([id])) });
      },

      addRoom: (name, label) => {
        const room = { id: newId('room'), name, label: roundVec(label) };
        commit({ ...get().plan, rooms: [...get().plan.rooms, room] });
        return room.id;
      },

      updateRoom: (id, patch) => {
        const plan = get().plan;
        if (!plan.rooms.some((r) => r.id === id)) return;
        const label = patch.label ? roundVec(patch.label) : undefined;
        commit({ ...plan, rooms: plan.rooms.map((r) => (r.id === id ? { ...r, ...patch, ...(label ? { label } : {}) } : r)) });
      },

      removeRoom: (id) => {
        const plan = get().plan;
        if (!plan.rooms.some((r) => r.id === id)) return;
        commit({ ...plan, rooms: plan.rooms.filter((r) => r.id !== id) }, { selectedId: deselectIf(new Set([id])) });
      },

      setBackground: (background) => commit({ ...get().plan, background }),

      updateBackground: (patch) => {
        const plan = get().plan;
        if (!plan.background) return;
        commit({ ...plan, background: { ...plan.background, ...patch } });
      },

      undo: () => {
        const { dragOrigin } = get();
        if (dragOrigin) {
          set({ plan: dragOrigin, dragOrigin: null });
          return;
        }
        const { past, plan, future } = get();
        if (past.length === 0) return;
        set({ plan: past[past.length - 1], past: past.slice(0, -1), future: [plan, ...future] });
      },

      redo: () => {
        if (get().dragOrigin) return;
        const { past, plan, future } = get();
        if (future.length === 0) return;
        set({ plan: future[0], past: [...past, plan], future: future.slice(1) });
      },
    };
  });
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/model && npm run typecheck && npm test`
Expected: 새 테스트 포함 전체 PASS(기존 store 테스트 회귀 없음)

- [ ] **Step 5: Commit**

```bash
git add src/model/store.ts src/model/store.test.ts
git commit -m "feat: store actions for walls, openings, rooms, background and item locking"
```

---

### Task 6: 배경 이미지 저장(IndexedDB)

**Files:**
- Create: `src/persistence/images.ts`, `src/persistence/images.test.ts`

**Interfaces:**
- Consumes: `newId` (Task 2)
- Produces:
  - `type ImageStore = { put(key: string, blob: Blob): Promise<void>; get(key: string): Promise<Blob | undefined> }`
  - `MAX_IMAGE_PX = 4096`, `fitWithin(w: number, h: number, max?: number): { w: number; h: number }`
  - `memoryImageStore(): ImageStore`, `indexedDbImageStore(dbName?: string, storeName?: string): ImageStore`, `getDefaultImageStore(): ImageStore`
  - `type PreparedImage = { blob: Blob; widthPx: number; heightPx: number }`, `prepareImage(file: Blob, max?: number): Promise<PreparedImage>` (브라우저 전용: `createImageBitmap` + canvas)
  - `saveBackgroundImage(store: ImageStore, file: Blob, prepare?: (f: Blob) => Promise<PreparedImage>): Promise<{ imageRef: string; widthPx: number; heightPx: number }>`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/persistence/images.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { fitWithin, memoryImageStore, saveBackgroundImage } from './images';

describe('fitWithin', () => {
  it('긴 변이 4096px를 넘으면 비율을 유지해 줄인다', () => {
    expect(fitWithin(8000, 4000)).toEqual({ w: 4096, h: 2048 });
    expect(fitWithin(1000, 500)).toEqual({ w: 1000, h: 500 });
  });
});

describe('memoryImageStore', () => {
  it('넣은 이미지를 꺼내고, 없는 키는 undefined', async () => {
    const store = memoryImageStore();
    const blob = new Blob(['x']);
    await store.put('k', blob);
    expect(await store.get('k')).toBe(blob);
    expect(await store.get('none')).toBeUndefined();
  });
});

describe('saveBackgroundImage', () => {
  it('준비한 이미지를 새 키로 저장하고 크기를 돌려준다', async () => {
    const store = memoryImageStore();
    const prepared = new Blob(['png']);
    const r = await saveBackgroundImage(store, new Blob(['raw']), async () => ({ blob: prepared, widthPx: 400, heightPx: 300 }));
    expect(r.imageRef).toMatch(/^image-/);
    expect(r).toMatchObject({ widthPx: 400, heightPx: 300 });
    expect(await store.get(r.imageRef)).toBe(prepared);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/persistence/images.test.ts`
Expected: 모듈 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/persistence/images.ts`:
```ts
import { newId } from '../model/ids';

export type ImageStore = {
  put(key: string, blob: Blob): Promise<void>;
  get(key: string): Promise<Blob | undefined>;
};

export const MAX_IMAGE_PX = 4096;

export function fitWithin(w: number, h: number, max = MAX_IMAGE_PX): { w: number; h: number } {
  const k = Math.min(1, max / Math.max(w, h));
  return { w: Math.round(w * k), h: Math.round(h * k) };
}

export function memoryImageStore(): ImageStore {
  const images = new Map<string, Blob>();
  return {
    put: async (key, blob) => {
      images.set(key, blob);
    },
    get: async (key) => images.get(key),
  };
}

export function indexedDbImageStore(dbName = 'homefit', storeName = 'images'): ImageStore {
  let db: Promise<IDBDatabase> | null = null;
  const open = () =>
    (db ??= new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open(dbName, 1);
      req.onupgradeneeded = () => {
        req.result.createObjectStore(storeName);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    }));
  const run = <T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>) =>
    open().then(
      (d) =>
        new Promise<T>((resolve, reject) => {
          const req = fn(d.transaction(storeName, mode).objectStore(storeName));
          req.onsuccess = () => resolve(req.result);
          req.onerror = () => reject(req.error);
        }),
    );
  return {
    put: async (key, blob) => {
      await run('readwrite', (s) => s.put(blob, key));
    },
    get: (key) => run<Blob | undefined>('readonly', (s) => s.get(key)),
  };
}

let defaultStore: ImageStore | null = null;

export function getDefaultImageStore(): ImageStore {
  return (defaultStore ??= indexedDbImageStore());
}

export type PreparedImage = { blob: Blob; widthPx: number; heightPx: number };

export async function prepareImage(file: Blob, max = MAX_IMAGE_PX): Promise<PreparedImage> {
  const bitmap = await createImageBitmap(file);
  try {
    const size = fitWithin(bitmap.width, bitmap.height, max);
    if (size.w === bitmap.width && size.h === bitmap.height) return { blob: file, widthPx: size.w, heightPx: size.h };
    const canvas = document.createElement('canvas');
    canvas.width = size.w;
    canvas.height = size.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d 컨텍스트를 만들 수 없습니다');
    ctx.drawImage(bitmap, 0, 0, size.w, size.h);
    const blob = await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('이미지 변환에 실패했습니다'))), 'image/png'),
    );
    return { blob, widthPx: size.w, heightPx: size.h };
  } finally {
    bitmap.close();
  }
}

export async function saveBackgroundImage(
  store: ImageStore,
  file: Blob,
  prepare: (f: Blob) => Promise<PreparedImage> = prepareImage,
): Promise<{ imageRef: string; widthPx: number; heightPx: number }> {
  const img = await prepare(file);
  const imageRef = newId('image');
  await store.put(imageRef, img.blob);
  return { imageRef, widthPx: img.widthPx, heightPx: img.heightPx };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/persistence && npm run typecheck`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/persistence/images.ts src/persistence/images.test.ts
git commit -m "feat: background image store on IndexedDB with downscaling"
```

---

### Task 7: 화면 상태, 툴바(모드·보기·스냅·시점 초기화·저장 상태)

**Files:**
- Modify: `src/ui/uiStore.ts` (전체 교체), `src/persistence/storage.ts` (onPending), `src/main.tsx`, `src/ui/Toolbar.tsx` (전체 교체), `src/styles.css`, `e2e/placement.spec.ts`
- Create: `src/ui/uiStore.test.ts`, `src/ui/saveLabel.ts`, `src/ui/saveLabel.test.ts`
- Test: `src/persistence/storage.test.ts` (추가)

**Interfaces:**
- Consumes: `CalibrationDraft` (Task 4), `Vec2`
- Produces (`useUi`):
  - 타입: `Mode = 'structure' | 'place'`, `View = '2d' | 'persp' | 'top'`, `Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'opening' | 'label' | 'calibrate'`, `SaveStatus = { state: 'clean' | 'pending' | 'saved' | 'error'; at?: number }`, `Candidates = { ids: string[]; clientX: number; clientY: number }`, `WallDraft = { thickness: number; height: number }`, `RoomDraft = { w: number; d: number; thickness: number; height: number; name: string }`
  - 상태: `mode`(기본 'place'), `view`(기본 'persp'), `tool`('select'), `snap`(true), `dragging`, `banner`, `viewResetKey`(0), `candidates`(null), `saveStatus`({ state: 'clean' }), `calibration: CalibrationDraft | null`, `wallDraft`({ thickness: 12, height: 230 }), `roomDraft`({ w: 400, d: 300, thickness: 12, height: 230, name: '방' })
  - 액션: `setMode`, `setView`, `setTool`, `toggleSnap`, `setDragging`, `showBanner`, `clearBanner`, `resetView`, `showCandidates`, `clearCandidates`, `setSaveStatus`, `startCalibration(target)`, `addCalibrationPoint(p: Vec2)`, `cancelCalibration`, `setWallDraft(patch)`, `setRoomDraft(patch)`
  - `saveLabel(s: SaveStatus): string`
  - `startAutosave` 옵션 `onPending?: () => void` (저장을 예약할 때마다 호출)
  - 툴바 버튼 이름: `구조`, `배치`(aria-pressed), 보기 `2D`·`3D`·`3D 탑뷰`(배치 모드에서만), `스냅 켜짐`/`스냅 꺼짐`(aria-pressed), `시점 초기화`; 저장 상태 `data-testid="save-status"`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/uiStore.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { useUi } from './uiStore';

beforeEach(() => useUi.setState(useUi.getInitialState(), true));

describe('useUi', () => {
  it('모드를 바꾸면 도구가 선택으로 돌아간다', () => {
    useUi.getState().setTool('wall');
    useUi.getState().setMode('structure');
    expect(useUi.getState()).toMatchObject({ mode: 'structure', tool: 'select' });
  });

  it('축척 보정 점은 두 개까지만 받는다', () => {
    useUi.getState().startCalibration('primary');
    for (const x of [0, 10, 20]) useUi.getState().addCalibrationPoint({ x, y: 0 });
    expect(useUi.getState().calibration?.points).toHaveLength(2);
    expect(useUi.getState().tool).toBe('calibrate');
    useUi.getState().cancelCalibration();
    expect(useUi.getState()).toMatchObject({ calibration: null, tool: 'select' });
  });

  it('스냅 토글과 시점 초기화 키', () => {
    useUi.getState().toggleSnap();
    useUi.getState().resetView();
    expect(useUi.getState()).toMatchObject({ snap: false, viewResetKey: 1 });
  });

  it('초안 값은 부분 수정된다', () => {
    useUi.getState().setRoomDraft({ w: 500 });
    expect(useUi.getState().roomDraft).toMatchObject({ w: 500, d: 300, name: '방' });
  });
});
```

`src/ui/saveLabel.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { saveLabel } from './saveLabel';

describe('saveLabel', () => {
  it('저장 상태를 문구로', () => {
    expect(saveLabel({ state: 'clean' })).toBe('변경 없음');
    expect(saveLabel({ state: 'pending' })).toBe('저장 중…');
    expect(saveLabel({ state: 'error' })).toBe('저장 실패');
    expect(saveLabel({ state: 'saved', at: new Date(2026, 9, 8, 9, 5).getTime() })).toBe('저장됨 09:05');
  });
});
```

`src/persistence/storage.test.ts`의 `describe('storage', ...)` 안에 추가:
```ts
  it('autosave는 저장을 예약할 때마다 onPending을 부른다', () => {
    vi.useFakeTimers();
    const store = createPlanStore(SAMPLE_PLAN);
    const events: string[] = [];
    startAutosave(store, {
      storage: memoryStorage(),
      onPending: () => events.push('pending'),
      onResult: (ok) => events.push(ok ? 'saved' : 'error'),
    });
    store.getState().addItem('p', 'v', { x: 0, y: 0 });
    store.getState().addItem('p', 'v', { x: 10, y: 0 });
    vi.advanceTimersByTime(500);
    expect(events).toEqual(['pending', 'pending', 'saved']);
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui src/persistence/storage.test.ts`
Expected: uiStore 새 액션 없음, saveLabel 모듈 없음, onPending 미호출로 FAIL

- [ ] **Step 3: 구현**

`src/ui/uiStore.ts` 전체 교체:
```ts
import { create } from 'zustand';
import type { CalibrationDraft } from '../editor2d/calibration';
import type { Vec2 } from '../model/schema';

export type Banner = { kind: 'error' | 'info'; text: string };
export type Mode = 'structure' | 'place';
export type View = '2d' | 'persp' | 'top';
export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'opening' | 'label' | 'calibrate';
export type SaveStatus = { state: 'clean' | 'pending' | 'saved' | 'error'; at?: number };
export type Candidates = { ids: string[]; clientX: number; clientY: number };
export type WallDraft = { thickness: number; height: number };
export type RoomDraft = { w: number; d: number; thickness: number; height: number; name: string };

type UiState = {
  mode: Mode;
  view: View;
  tool: Tool;
  snap: boolean;
  dragging: boolean;
  banner: Banner | null;
  viewResetKey: number;
  candidates: Candidates | null;
  saveStatus: SaveStatus;
  calibration: CalibrationDraft | null;
  wallDraft: WallDraft;
  roomDraft: RoomDraft;
  setMode(mode: Mode): void;
  setView(view: View): void;
  setTool(tool: Tool): void;
  toggleSnap(): void;
  setDragging(dragging: boolean): void;
  showBanner(banner: Banner): void;
  clearBanner(): void;
  resetView(): void;
  showCandidates(candidates: Candidates): void;
  clearCandidates(): void;
  setSaveStatus(status: SaveStatus): void;
  startCalibration(target: CalibrationDraft['target']): void;
  addCalibrationPoint(p: Vec2): void;
  cancelCalibration(): void;
  setWallDraft(patch: Partial<WallDraft>): void;
  setRoomDraft(patch: Partial<RoomDraft>): void;
};

export const useUi = create<UiState>()((set, get) => ({
  mode: 'place',
  view: 'persp',
  tool: 'select',
  snap: true,
  dragging: false,
  banner: null,
  viewResetKey: 0,
  candidates: null,
  saveStatus: { state: 'clean' },
  calibration: null,
  wallDraft: { thickness: 12, height: 230 },
  roomDraft: { w: 400, d: 300, thickness: 12, height: 230, name: '방' },
  setMode: (mode) => set({ mode, tool: 'select', candidates: null, calibration: null }),
  setView: (view) => set({ view, candidates: null }),
  setTool: (tool) => set({ tool, candidates: null, calibration: null }),
  toggleSnap: () => set({ snap: !get().snap }),
  setDragging: (dragging) => set({ dragging }),
  showBanner: (banner) => set({ banner }),
  clearBanner: () => set({ banner: null }),
  resetView: () => set({ viewResetKey: get().viewResetKey + 1 }),
  showCandidates: (candidates) => set({ candidates }),
  clearCandidates: () => set({ candidates: null }),
  setSaveStatus: (saveStatus) => set({ saveStatus }),
  startCalibration: (target) => set({ tool: 'calibrate', calibration: { target, points: [] }, candidates: null }),
  addCalibrationPoint: (p) => {
    const c = get().calibration;
    if (!c || c.points.length >= 2) return;
    set({ calibration: { ...c, points: [...c.points, p] } });
  },
  cancelCalibration: () => set({ calibration: null, tool: 'select' }),
  setWallDraft: (patch) => set({ wallDraft: { ...get().wallDraft, ...patch } }),
  setRoomDraft: (patch) => set({ roomDraft: { ...get().roomDraft, ...patch } }),
}));
```

`src/ui/saveLabel.ts`:
```ts
import type { SaveStatus } from './uiStore';

const two = (n: number) => String(n).padStart(2, '0');

export function saveLabel(s: SaveStatus): string {
  switch (s.state) {
    case 'clean':
      return '변경 없음';
    case 'pending':
      return '저장 중…';
    case 'error':
      return '저장 실패';
    case 'saved': {
      const d = new Date(s.at ?? Date.now());
      return `저장됨 ${two(d.getHours())}:${two(d.getMinutes())}`;
    }
  }
}
```

`src/persistence/storage.ts`의 `startAutosave`: 옵션 타입에 `onPending?: () => void;`를 추가하고 subscribe 콜백의 `timer = setTimeout(save, opts.delayMs ?? 500);` 바로 다음 줄에 `opts.onPending?.();`를 넣는다.

`src/main.tsx`의 `startAutosave(store, { ... })` 호출을 다음으로 교체:
```ts
startAutosave(store, {
  onPending: () => useUi.getState().setSaveStatus({ state: 'pending' }),
  onResult: (ok) => {
    useUi.getState().setSaveStatus(ok ? { state: 'saved', at: Date.now() } : { state: 'error' });
    if (ok) {
      saveFailedShown = false;
      return;
    }
    if (saveFailedShown) return;
    saveFailedShown = true;
    useUi.getState().showBanner({ kind: 'error', text: '브라우저 저장에 실패했습니다. 상단의 "JSON 저장"으로 백업하세요.' });
  },
});
```

`src/ui/Toolbar.tsx` 전체 교체:
```tsx
import { useRef, type ChangeEvent } from 'react';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { downloadText, planToJson, readPlanFile } from '../persistence/file';
import { saveLabel } from './saveLabel';
import { useUi, type View } from './uiStore';

const VIEWS: [View, string][] = [
  ['2d', '2D'],
  ['persp', '3D'],
  ['top', '3D 탑뷰'],
];

export function Toolbar() {
  const store = usePlanStore();
  const canUndo = usePlan((s) => s.past.length > 0);
  const canRedo = usePlan((s) => s.future.length > 0);
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const snap = useUi((s) => s.snap);
  const saveStatus = useUi((s) => s.saveStatus);
  const ui = useUi.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  const onOpen = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const r = await readPlanFile(file);
    if (r.ok) {
      store.getState().replacePlan(r.plan);
      ui.showBanner({ kind: 'info', text: `"${r.plan.info.title}"을(를) 불러왔습니다.` });
    } else {
      ui.showBanner({ kind: 'error', text: `불러오기 실패\n${r.error}` });
    }
  };

  return (
    <header className="toolbar">
      <strong className="brand">homefit</strong>
      <div className="segmented" role="group" aria-label="모드">
        <button type="button" aria-pressed={mode === 'structure'} onClick={() => ui.setMode('structure')}>구조</button>
        <button type="button" aria-pressed={mode === 'place'} onClick={() => ui.setMode('place')}>배치</button>
      </div>
      {mode === 'place' && (
        <div className="segmented" role="group" aria-label="보기">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" aria-pressed={view === v} onClick={() => ui.setView(v)}>{label}</button>
          ))}
        </div>
      )}
      <button type="button" aria-pressed={snap} onClick={() => ui.toggleSnap()}>{snap ? '스냅 켜짐' : '스냅 꺼짐'}</button>
      <button type="button" onClick={() => ui.resetView()}>시점 초기화</button>
      <span className="sep" />
      <button type="button" onClick={() => fileRef.current?.click()}>JSON 열기</button>
      <input ref={fileRef} type="file" accept="application/json,.json" hidden data-testid="open-json" onChange={onOpen} />
      <button type="button" onClick={() => downloadText(planToJson(store.getState().plan), 'homefit-plan.json')}>JSON 저장</button>
      <span className="sep" />
      <button type="button" disabled={!canUndo} onClick={() => store.getState().undo()}>실행 취소</button>
      <button type="button" disabled={!canRedo} onClick={() => store.getState().redo()}>다시 실행</button>
      <span className={`save-status save-${saveStatus.state}`} data-testid="save-status">{saveLabel(saveStatus)}</span>
    </header>
  );
}
```

`src/styles.css` 맨 위(`* {` 앞)에 추가:
```css
:root { --danger: #e5484d; --warn: #f5a524; --accent: #3b82f6; }
```
끝에 추가:
```css
.segmented { display: inline-flex; border: 1px solid #d6d0c4; border-radius: 6px; overflow: hidden; }
.segmented button { border: 0; border-radius: 0; }
.segmented button + button { border-left: 1px solid #d6d0c4; }
button[aria-pressed='true'] { background: #1f2328; color: #fff; }
.save-status { margin-left: auto; font-size: 12px; color: #6b7280; }
.save-error { color: #b42318; }
```

`e2e/placement.spec.ts`의 세 번째 테스트에서 `'탑뷰로 보기'`, `'원근으로 보기'`를 쓰는 두 줄을 다음으로 교체:
```ts
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await expect(page.getByRole('button', { name: '3D 탑뷰' })).toHaveAttribute('aria-pressed', 'true');
```

`src/scene3d/Viewport.tsx`는 그대로 둔다(`view === 'top'` 비교는 새 타입에서도 유효). 이 Task에서는 2D 보기를 눌러도 3D가 보인다(Task 8에서 연결).

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui src/persistence && npm run typecheck && npm test && npm run e2e`
Expected: 단위 테스트 PASS, E2E 3 passed

- [ ] **Step 5: Commit**

```bash
git add src/ui/uiStore.ts src/ui/uiStore.test.ts src/ui/saveLabel.ts src/ui/saveLabel.test.ts src/ui/Toolbar.tsx src/persistence/storage.ts src/persistence/storage.test.ts src/main.tsx src/styles.css e2e/placement.spec.ts
git commit -m "feat: ui modes, view switch, snap toggle, view reset and save status in toolbar"
```

---

### Task 8: 2D 에디터 기본(보기·이동·확대, 벽·문·창·방 이름 표시와 선택, 끝점 드래그, 배경 이미지)

**Files:**
- Create: `src/editor2d/svgPoint.ts`, `src/editor2d/svgContext.ts`, `src/editor2d/useBackgroundUrl.ts`, `src/editor2d/BackgroundImage.tsx`, `src/editor2d/Walls2D.tsx`, `src/editor2d/Openings2D.tsx`, `src/editor2d/Rooms2D.tsx`, `src/editor2d/Editor2D.tsx`
- Modify: `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `fitViewBox`, `zoomAt`, `panBy`, `ViewBox`, `pointsAttr`, `sectorPath`, `snapToEndpoint` (Task 4), `openingAtPoint` (Task 3), 스토어 `updateOpening` (Task 5), `openingObb`, `doorSwing`, `wallObb`, `wallDir`, `wallLength`, `corners`, `planBounds` (Task 3 / 계획 1), `getDefaultImageStore` (Task 6), `useUi` (Task 7), 스토어 `select`, `beginDrag`, `dragEndpoint`, `endDrag` (Task 5)
- Produces:
  - `clientToPlan(svg: SVGSVGElement, clientX: number, clientY: number): Vec2` (실수)
  - `SvgContext: React.Context<RefObject<SVGSVGElement | null>>`
  - `useBackgroundUrl(ref: string | undefined): { url: string | null; missing: boolean }`
  - `<Editor2D />` — `data-testid="editor2d"`인 `<svg>`; 벽 `wall-<id>`, 개구부 `opening-<id>`, 방 이름 `room-<id>`, 배경 `background-image`
  - 선택 도구에서 빈 곳을 끌면 화면 이동, 휠로 커서 기준 확대/축소, 시점 초기화 키가 바뀌거나 크기가 바뀌면 평면 전체로 맞춤
  - 구조 모드 + 선택 도구에서만 벽·개구부·방 이름을 클릭해 선택하고, 선택한 벽 양 끝 핸들을 끌어 끝점을 옮긴다(스냅 켜짐이면 다른 끝점 15cm 이내에 붙음). 개구부는 끌면 벽을 따라 이동한다(실행 취소 한 번)
  - 벽 치수 표시: 실측 확인 전에는 `≈415`, 확인 후 `415`

- [ ] **Step 1: 구현**

`src/editor2d/svgPoint.ts`:
```ts
import type { Vec2 } from '../model/schema';

export function clientToPlan(svg: SVGSVGElement, clientX: number, clientY: number): Vec2 {
  const ctm = svg.getScreenCTM();
  if (!ctm) return { x: 0, y: 0 };
  const p = new DOMPoint(clientX, clientY).matrixTransform(ctm.inverse());
  return { x: p.x, y: p.y };
}
```

`src/editor2d/svgContext.ts`:
```ts
import { createContext, type RefObject } from 'react';

export const SvgContext = createContext<RefObject<SVGSVGElement | null>>({ current: null });
```

`src/editor2d/useBackgroundUrl.ts`:
```ts
import { useEffect, useState } from 'react';
import { getDefaultImageStore } from '../persistence/images';

type State = { url: string | null; missing: boolean };

export function useBackgroundUrl(ref: string | undefined): State {
  const [state, setState] = useState<State>({ url: null, missing: false });
  useEffect(() => {
    if (!ref) {
      setState({ url: null, missing: false });
      return;
    }
    let cancelled = false;
    let url: string | null = null;
    getDefaultImageStore()
      .get(ref)
      .then((blob) => {
        if (cancelled) return;
        if (!blob) {
          setState({ url: null, missing: true });
          return;
        }
        url = URL.createObjectURL(blob);
        setState({ url, missing: false });
      })
      .catch(() => {
        if (!cancelled) setState({ url: null, missing: true });
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [ref]);
  return state;
}
```

`src/editor2d/BackgroundImage.tsx`:
```tsx
import { usePlan } from '../model/StoreContext';
import { useBackgroundUrl } from './useBackgroundUrl';

export function BackgroundImage({ px }: { px: number }) {
  const bg = usePlan((s) => s.plan.background);
  const { url, missing } = useBackgroundUrl(bg?.imageRef);
  if (!bg) return null;
  if (missing) {
    return (
      <text x={bg.offsetX} y={bg.offsetY} fontSize={12 * px} className="muted-svg">
        배경 이미지를 이 브라우저에서 찾을 수 없습니다. 구조 모드에서 다시 불러오세요.
      </text>
    );
  }
  if (!url) return null;
  return (
    <image
      href={url}
      x={bg.offsetX}
      y={bg.offsetY}
      width={bg.widthPx * bg.cmPerPx}
      height={bg.heightPx * bg.cmPerPx}
      opacity={bg.opacity}
      preserveAspectRatio="none"
      pointerEvents="none"
      data-testid="background-image"
    />
  );
}
```

`src/editor2d/Walls2D.tsx`:
```tsx
import { useContext, useRef, type PointerEvent } from 'react';
import { corners } from '../geometry/obb';
import { wallDir, wallLength, wallObb } from '../geometry/walls';
import type { Vec2 } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { snapToEndpoint } from './snapping';
import { pointsAttr } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

function EndpointHandle({ point, px }: { point: Vec2; px: number }) {
  const store = usePlanStore();
  const svgRef = useContext(SvgContext);
  const setDragging = useUi((s) => s.setDragging);
  const from = useRef<Vec2 | null>(null);

  const onDown = (e: PointerEvent<SVGCircleElement>) => {
    e.stopPropagation();
    from.current = point;
    e.currentTarget.setPointerCapture(e.pointerId);
    store.getState().beginDrag();
    setDragging(true);
  };
  const onMove = (e: PointerEvent<SVGCircleElement>) => {
    const start = from.current;
    if (!start || !svgRef.current) return;
    const raw = clientToPlan(svgRef.current, e.clientX, e.clientY);
    const s = store.getState();
    const others = (s.dragOrigin ?? s.plan).walls.flatMap((w) => [w.a, w.b]).filter((p) => p.x !== start.x || p.y !== start.y);
    const to = useUi.getState().snap ? (snapToEndpoint(raw, others) ?? raw) : raw;
    s.dragEndpoint(start, to);
  };
  const onUp = () => {
    if (!from.current) return;
    from.current = null;
    store.getState().endDrag();
    setDragging(false);
  };

  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={6 * px}
      className="endpoint-handle"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    />
  );
}

export function Walls2D({ px }: { px: number }) {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const interactive = mode === 'structure' && tool === 'select';
  const selected = walls.find((w) => w.id === selectedId);

  return (
    <g className="walls2d">
      {walls.map((w) => {
        const len = Math.round(wallLength(w));
        const u = wallDir(w);
        const off = w.thickness / 2 + 12 * px;
        const label = { x: (w.a.x + w.b.x) / 2 - u.y * off, y: (w.a.y + w.b.y) / 2 + u.x * off };
        return (
          <g key={w.id}>
            <polygon
              points={pointsAttr(corners(wallObb(w)))}
              className={w.id === selectedId ? 'wall wall-selected' : 'wall'}
              data-testid={`wall-${w.id}`}
              onPointerDown={
                interactive
                  ? (e) => {
                      e.stopPropagation();
                      store.getState().select(w.id);
                    }
                  : undefined
              }
            />
            {len > 0 && (
              <text x={label.x} y={label.y} fontSize={11 * px} className={w.verified ? 'dim' : 'dim dim-unverified'} textAnchor="middle" dominantBaseline="middle">
                {w.verified ? `${len}` : `≈${len}`}
              </text>
            )}
          </g>
        );
      })}
      {interactive && selected && (
        <>
          <EndpointHandle key="a" point={selected.a} px={px} />
          <EndpointHandle key="b" point={selected.b} px={px} />
        </>
      )}
    </g>
  );
}
```

`src/editor2d/Openings2D.tsx`(구조 모드 선택 도구에서 클릭하면 선택, 끌면 벽을 따라 이동 — 스펙 §6 "문·창: 벽 위로 드래그"):
```tsx
import { useContext, useRef, type PointerEvent } from 'react';
import { doorSwing } from '../geometry/clearance';
import { corners } from '../geometry/obb';
import { openingAtPoint } from '../geometry/structure';
import { openingObb, wallDir } from '../geometry/walls';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { pointsAttr, sectorPath } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

export function Openings2D() {
  const store = usePlanStore();
  const svgRef = useContext(SvgContext);
  const walls = usePlan((s) => s.plan.walls);
  const openings = usePlan((s) => s.plan.openings);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const dragging = useRef<string | null>(null);
  const interactive = mode === 'structure' && tool === 'select';
  const byId = new Map(walls.map((w) => [w.id, w]));

  const onDown = (e: PointerEvent<SVGGElement>, id: string) => {
    e.stopPropagation();
    store.getState().select(id);
    dragging.current = id;
    e.currentTarget.setPointerCapture(e.pointerId);
    store.getState().beginDrag();
    setDragging(true);
  };
  const onMove = (e: PointerEvent<SVGGElement>) => {
    const id = dragging.current;
    if (!id || !svgRef.current) return;
    const s = store.getState();
    const current = s.plan.openings.find((o) => o.id === id);
    const wall = current && s.plan.walls.find((w) => w.id === current.wallId);
    if (!current || !wall) return;
    const offset = openingAtPoint(wall, clientToPlan(svgRef.current, e.clientX, e.clientY), current.width);
    // 드래그 중 커밋은 드래그 트랜잭션에 흡수돼 실행 취소 한 번으로 돌아간다
    if (offset !== null && offset !== current.offset) s.updateOpening(id, { offset });
  };
  const onUp = () => {
    if (!dragging.current) return;
    dragging.current = null;
    store.getState().endDrag();
    setDragging(false);
  };

  return (
    <g className="openings2d">
      {openings.map((o) => {
        const w = byId.get(o.wallId);
        if (!w) return null;
        const u = wallDir(w);
        const a = { x: w.a.x + u.x * o.offset, y: w.a.y + u.y * o.offset };
        const b = { x: a.x + u.x * o.width, y: a.y + u.y * o.width };
        const swing = o.kind === 'door' ? doorSwing(w, o) : null;
        return (
          <g
            key={o.id}
            data-testid={`opening-${o.id}`}
            className={o.id === selectedId ? 'opening opening-selected' : 'opening'}
            onPointerDown={interactive ? (e) => onDown(e, o.id) : undefined}
            onPointerMove={interactive ? onMove : undefined}
            onPointerUp={interactive ? onUp : undefined}
            onPointerCancel={interactive ? onUp : undefined}
          >
            <polygon points={pointsAttr(corners(openingObb(w, o)))} className="opening-gap" />
            {o.kind === 'window' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="opening-window" />}
            {o.kind === 'opening' && <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="opening-open" />}
            {swing?.kind === 'sector' && <path d={sectorPath(swing.center, swing.radius, swing.start, swing.end)} className="opening-swing" />}
          </g>
        );
      })}
    </g>
  );
}
```

`src/editor2d/Rooms2D.tsx`:
```tsx
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';

export function Rooms2D({ px }: { px: number }) {
  const store = usePlanStore();
  const rooms = usePlan((s) => s.plan.rooms);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const interactive = mode === 'structure' && tool === 'select';
  return (
    <g className="rooms2d">
      {rooms.map((r) => (
        <text
          key={r.id}
          x={r.label.x}
          y={r.label.y}
          fontSize={14 * px}
          textAnchor="middle"
          dominantBaseline="middle"
          className={r.id === selectedId ? 'room-name room-selected' : 'room-name'}
          data-testid={`room-${r.id}`}
          onPointerDown={
            interactive
              ? (e) => {
                  e.stopPropagation();
                  store.getState().select(r.id);
                }
              : undefined
          }
        >
          {r.name}
        </text>
      ))}
    </g>
  );
}
```

`src/editor2d/Editor2D.tsx`:
```tsx
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { planBounds } from '../geometry/bounds';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { BackgroundImage } from './BackgroundImage';
import { Openings2D } from './Openings2D';
import { Rooms2D } from './Rooms2D';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';
import { fitViewBox, panBy, zoomAt, type ViewBox } from './viewBox';
import { Walls2D } from './Walls2D';

const ZOOM_STEP = 1.15;

export function Editor2D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const resetKey = useUi((s) => s.viewResetKey);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<ViewBox>(() => fitViewBox(planBounds({ walls }), 4 / 3));
  const pan = useRef<{ x: number; y: number; vb: ViewBox } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 처음 열 때, 화면 크기가 바뀔 때, "시점 초기화"를 누를 때 평면 전체가 보이게 맞춘다
  useEffect(() => {
    setVb(fitViewBox(planBounds({ walls: store.getState().plan.walls }), size.w / size.h));
  }, [store, size.w, size.h, resetKey]);

  const px = vb.w / size.w;

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0 || tool !== 'select') return;
    store.getState().select(null);
    useUi.getState().clearCandidates();
    pan.current = { x: e.clientX, y: e.clientY, vb };
    e.currentTarget.setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (!p) return;
    const k = p.vb.w / size.w;
    setVb(panBy(p.vb, -(e.clientX - p.x) * k, -(e.clientY - p.y) * k));
  };
  const endPan = () => {
    pan.current = null;
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const p = clientToPlan(e.currentTarget, e.clientX, e.clientY);
    setVb((v) => zoomAt(v, p, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  };

  return (
    <div className={`editor2d mode-${mode}`}>
      <SvgContext.Provider value={svgRef}>
        <svg
          ref={svgRef}
          className={`editor2d-svg tool-${tool}`}
          data-testid="editor2d"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onWheel={onWheel}
        >
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="editor2d-bg" />
          <BackgroundImage px={px} />
          <Rooms2D px={px} />
          <Walls2D px={px} />
          <Openings2D />
        </svg>
      </SvgContext.Provider>
    </div>
  );
}
```

`src/App.tsx` 전체 교체:
```tsx
import { Editor2D } from './editor2d/Editor2D';
import { usePlanStore } from './model/StoreContext';
import { Viewport } from './scene3d/Viewport';
import { Banner } from './ui/Banner';
import { CatalogPanel } from './ui/CatalogPanel';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { Toolbar } from './ui/Toolbar';
import { useUi } from './ui/uiStore';

export function App() {
  useShortcuts(usePlanStore());
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const show2d = mode === 'structure' || view === '2d';
  return (
    <div className="app">
      <Toolbar />
      <Banner />
      <aside className="left">
        <CatalogPanel />
      </aside>
      <main className="center">{show2d ? <Editor2D /> : <Viewport />}</main>
      <aside className="right">
        <PropertiesPanel />
      </aside>
    </div>
  );
}
```

`src/styles.css` 끝에 추가:
```css
.editor2d { position: absolute; inset: 0; }
.editor2d-svg { width: 100%; height: 100%; display: block; touch-action: none; user-select: none; }
.editor2d-bg { fill: #faf8f4; }
.wall { fill: #3f3a33; stroke: #3f3a33; stroke-width: 1; vector-effect: non-scaling-stroke; }
.wall-selected { fill: var(--accent); stroke: var(--accent); }
.dim { fill: #3f3a33; pointer-events: none; }
.dim-unverified { fill: #9a8f7f; font-style: italic; }
.endpoint-handle { fill: #fff; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; cursor: move; }
.opening-gap { fill: #faf8f4; stroke: #3f3a33; stroke-width: 1; vector-effect: non-scaling-stroke; }
.opening-window { stroke: #4f9dde; stroke-width: 2; vector-effect: non-scaling-stroke; }
.opening-open { stroke: #9a8f7f; stroke-dasharray: 4 3; stroke-width: 1; vector-effect: non-scaling-stroke; }
.opening-swing { fill: rgba(139, 139, 139, 0.15); stroke: #8b8b8b; stroke-width: 1; vector-effect: non-scaling-stroke; }
.opening-selected .opening-gap { stroke: var(--accent); stroke-width: 2; }
.room-name { fill: #6b5e4b; }
.room-selected { fill: var(--accent); font-weight: 600; }
.muted-svg { fill: #6b7280; }
```

- [ ] **Step 2: 검증**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: 오류 없음, 단위 테스트 PASS, 기존 E2E 3 passed(기본 보기는 3D)

브라우저 확인(일회용 Playwright 스크립트를 scratchpad에 두고 실행, repo에 넣지 않음; chromium args `['--use-angle=swiftshader','--enable-unsafe-swiftshader']`, `npm run dev -- --port 5180 --strictPort`):
1. `구조` 클릭 → `data-testid="editor2d"`가 보이고 샘플 평면 벽 5개가 그려지며 치수가 `≈600`, `≈400`처럼 보인다(스크린샷을 Read로 확인)
2. 빈 곳을 끌면 화면이 이동하고, 휠을 굴리면 확대/축소된다(viewBox 속성 값 변화로 확인)
3. 벽 `wall-w1` 클릭 → 파란색, 양 끝 핸들 표시. 끝점 핸들을 끌면 연결된 벽도 함께 움직이고, `window.__homefit.store.getState().undo()` 한 번에 원래대로
4. 문 `opening-o1`을 벽을 따라 끌면 위치가 바뀌고 `undo()` 한 번에 원래대로
5. `시점 초기화` → 평면 전체로 다시 맞춰진다
6. 콘솔 `pageerror` 없음

- [ ] **Step 3: Commit**

```bash
git add src/editor2d/svgPoint.ts src/editor2d/svgContext.ts src/editor2d/useBackgroundUrl.ts src/editor2d/BackgroundImage.tsx src/editor2d/Walls2D.tsx src/editor2d/Openings2D.tsx src/editor2d/Rooms2D.tsx src/editor2d/Editor2D.tsx src/App.tsx src/styles.css
git commit -m "feat: 2D editor with pan, zoom, wall/opening/room rendering, selection and endpoint drag"
```

---

### Task 9: 구조 도구(벽 그리기, 방 만들기, 문·창·개구부, 방 이름, 배경 불러오기, 축척 보정)

**Files:**
- Create: `src/editor2d/tools.ts`, `src/editor2d/tools.test.ts`, `src/editor2d/ToolPreview.tsx`, `src/ui/StructurePanel.tsx`
- Modify: `src/editor2d/Editor2D.tsx` (전체 교체), `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `wallToolPoint`, `wallSegments`, `planToImagePx`, `imagePxToPlan`, `calibrationResult`, `scaleText`, `SCALE_TOLERANCE` (Task 4), `nearestWall`, `openingAtPoint` (Task 3), 스토어 `addWalls`, `addRoomRect`, `addOpening`, `addRoom`, `select`, `setBackground`, `updateBackground` (Task 5), `saveBackgroundImage`, `getDefaultImageStore` (Task 6), `useUi` (Task 7)
- Produces:
  - `OPENING_PICK_CM = 30`, `OPENING_DEFAULTS: Record<'door' | 'window' | 'opening', Omit<Opening, 'id' | 'wallId' | 'kind' | 'offset'>>` (문 90×210 창턱 0 안쪽 열림 / 창 120×120 창턱 90 / 개구부 90×210)
  - `applyToolClick(tool: Tool, raw: Vec2, ctx: { store: StoreApi<PlanState>; wallPoints: Vec2[]; setWallPoints(points: Vec2[]): void }): void`
  - `finishWall(store: StoreApi<PlanState>, points: Vec2[]): void` — `useUi`의 `wallDraft` 두께·높이로 한 번에 커밋
  - `<StructurePanel />` — 도구 버튼(`선택`, `벽 그리기`, `방 만들기`, `문`, `창`, `개구부`, `방 이름`), 초안 입력(`벽 두께`, `높이`, `이름`, `내측 가로 W`, `내측 세로 D`), 배경 `이미지 불러오기`(`data-testid="open-background"`), `투명도`, `축척 보정`, `검증 길이`, `배경 제거`, 축척 문구 `data-testid="scale-info"`, 길이 입력(aria-label `실제 길이`) + `적용`·`취소`
  - 벽 그리기: 클릭으로 점 추가, 더블클릭·Enter·Esc로 끝내고 한 번에 커밋. 도구를 바꾸면 그리던 점은 버린다
  - 방 만들기: 클릭한 점이 방의 내측 왼쪽 위 모서리
  - 문·창·개구부: 벽에서 30cm 이내를 클릭하면 클릭점을 중심으로 놓고 선택. 벽이 짧거나 멀면 배너 안내

- [ ] **Step 1: 실패하는 테스트 작성**

`src/editor2d/tools.test.ts`:
```ts
import { beforeEach, describe, expect, it } from 'vitest';
import { emptyPlanFields } from '../model/samplePlan';
import { createPlanStore } from '../model/store';
import { useUi } from '../ui/uiStore';
import { applyToolClick, finishWall } from './tools';

const plan = () => ({
  version: 1 as const, info: { title: 't' }, rooms: [], openings: [], ...emptyPlanFields(),
  walls: [{ id: 'w', a: { x: 0, y: 0 }, b: { x: 400, y: 0 }, thickness: 10, height: 230 }],
});

beforeEach(() => useUi.setState(useUi.getInitialState(), true));

describe('applyToolClick', () => {
  it('벽 도구는 스냅된 점을 쌓는다', () => {
    const store = createPlanStore(plan());
    let points = [{ x: 0, y: 100 }];
    applyToolClick('wall', { x: 200, y: 106 }, { store, wallPoints: points, setWallPoints: (p) => (points = p) });
    expect(points).toEqual([{ x: 0, y: 100 }, { x: 200, y: 100 }]);
  });

  it('문 도구는 가까운 벽에 문을 놓고 선택한다', () => {
    const store = createPlanStore(plan());
    applyToolClick('door', { x: 200, y: 12 }, { store, wallPoints: [], setWallPoints: () => {} });
    const [door] = store.getState().plan.openings;
    expect(door).toMatchObject({ wallId: 'w', kind: 'door', offset: 155, width: 90, height: 210, sill: 0 });
    expect(store.getState().selectedId).toBe(door.id);
  });

  it('벽에서 멀면 아무것도 만들지 않고 안내한다', () => {
    const store = createPlanStore(plan());
    applyToolClick('window', { x: 200, y: 200 }, { store, wallPoints: [], setWallPoints: () => {} });
    expect(store.getState().plan.openings).toEqual([]);
    expect(useUi.getState().banner?.text).toBe('벽 가까이(30cm 이내)를 클릭하세요.');
  });

  it('방 만들기는 초안 크기로 방을 만들고 선택 도구로 돌아간다', () => {
    const store = createPlanStore(plan());
    useUi.getState().setTool('room');
    applyToolClick('room', { x: 50.4, y: 60 }, { store, wallPoints: [], setWallPoints: () => {} });
    expect(store.getState().plan.walls).toHaveLength(5);
    expect(store.getState().plan.rooms[0].name).toBe('방');
    expect(useUi.getState().tool).toBe('select');
  });

  it('축척 보정 도구는 이미지 px 좌표로 점을 모은다', () => {
    const store = createPlanStore({
      ...plan(),
      background: { imageRef: 'i', widthPx: 400, heightPx: 300, cmPerPx: 2, offsetX: 10, offsetY: 0, rotation: 0, opacity: 0.5 },
    });
    useUi.getState().startCalibration('primary');
    applyToolClick('calibrate', { x: 110, y: 40 }, { store, wallPoints: [], setWallPoints: () => {} });
    expect(useUi.getState().calibration?.points).toEqual([{ x: 50, y: 20 }]);
  });
});

describe('finishWall', () => {
  it('길이 0 구간을 빼고 초안 두께로 한 번에 커밋한다', () => {
    const store = createPlanStore(plan());
    useUi.getState().setWallDraft({ thickness: 20 });
    const pastLen = store.getState().past.length;
    finishWall(store, [{ x: 0, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 100 }, { x: 300, y: 300 }]);
    const added = store.getState().plan.walls.slice(1);
    expect(added).toHaveLength(2);
    expect(added.every((w) => w.thickness === 20 && w.height === 230)).toBe(true);
    expect(store.getState().past.length).toBe(pastLen + 1);
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/editor2d/tools.test.ts`
Expected: 모듈 없음으로 FAIL

- [ ] **Step 3: 구현**

`src/editor2d/tools.ts`:
```ts
import type { StoreApi } from 'zustand/vanilla';
import { nearestWall, openingAtPoint } from '../geometry/structure';
import type { Opening, Vec2 } from '../model/schema';
import type { PlanState } from '../model/store';
import { useUi, type Tool } from '../ui/uiStore';
import { planToImagePx } from './calibration';
import { wallSegments, wallToolPoint } from './snapping';

export const OPENING_PICK_CM = 30;

export const OPENING_DEFAULTS: Record<'door' | 'window' | 'opening', Omit<Opening, 'id' | 'wallId' | 'kind' | 'offset'>> = {
  door: { width: 90, height: 210, sill: 0, hinge: 'start', swingIn: true },
  window: { width: 120, height: 120, sill: 90, hinge: 'start', swingIn: false },
  opening: { width: 90, height: 210, sill: 0, hinge: 'start', swingIn: false },
};

const round = (p: Vec2): Vec2 => ({ x: Math.round(p.x), y: Math.round(p.y) });

type ToolContext = { store: StoreApi<PlanState>; wallPoints: Vec2[]; setWallPoints(points: Vec2[]): void };

export function applyToolClick(tool: Tool, raw: Vec2, ctx: ToolContext): void {
  const ui = useUi.getState();
  const s = ctx.store.getState();
  switch (tool) {
    case 'wall': {
      const endpoints = [...s.plan.walls.flatMap((w) => [w.a, w.b]), ...ctx.wallPoints];
      const prev = ctx.wallPoints.at(-1) ?? null;
      ctx.setWallPoints([...ctx.wallPoints, wallToolPoint(raw, prev, endpoints, ui.snap)]);
      return;
    }
    case 'room': {
      const d = ui.roomDraft;
      s.addRoomRect({ origin: round(raw), w: d.w, d: d.d, thickness: d.thickness, height: d.height, name: d.name });
      ui.setTool('select');
      return;
    }
    case 'door':
    case 'window':
    case 'opening': {
      const wall = nearestWall(s.plan.walls, raw, OPENING_PICK_CM);
      if (!wall) {
        ui.showBanner({ kind: 'error', text: '벽 가까이(30cm 이내)를 클릭하세요.' });
        return;
      }
      const defaults = OPENING_DEFAULTS[tool];
      const offset = openingAtPoint(wall, raw, defaults.width);
      const id = offset === null ? null : s.addOpening({ wallId: wall.id, kind: tool, offset, ...defaults });
      if (!id) {
        ui.showBanner({ kind: 'error', text: '벽이 개구부 폭보다 짧습니다.' });
        return;
      }
      s.select(id);
      return;
    }
    case 'label': {
      s.select(s.addRoom('방', round(raw)));
      ui.setTool('select');
      return;
    }
    case 'calibrate': {
      const bg = s.plan.background;
      if (bg) ui.addCalibrationPoint(planToImagePx(bg, raw));
      return;
    }
    case 'select':
      return;
  }
}

export function finishWall(store: StoreApi<PlanState>, points: Vec2[]): void {
  const { thickness, height } = useUi.getState().wallDraft;
  store.getState().addWalls(wallSegments(points).map(([a, b]) => ({ a, b, thickness, height })));
}
```

`src/editor2d/ToolPreview.tsx`:
```tsx
import type { Vec2 } from '../model/schema';
import { usePlan } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { imagePxToPlan } from './calibration';
import { wallToolPoint } from './snapping';
import { pointsAttr } from './svg';

export function ToolPreview({ px, wallPoints, cursor }: { px: number; wallPoints: Vec2[]; cursor: Vec2 | null }) {
  const tool = useUi((s) => s.tool);
  const snap = useUi((s) => s.snap);
  const room = useUi((s) => s.roomDraft);
  const calibration = useUi((s) => s.calibration);
  const walls = usePlan((s) => s.plan.walls);
  const bg = usePlan((s) => s.plan.background);

  if (tool === 'wall' && wallPoints.length > 0) {
    const endpoints = [...walls.flatMap((w) => [w.a, w.b]), ...wallPoints];
    const last = wallPoints[wallPoints.length - 1];
    const next = cursor ? wallToolPoint(cursor, last, endpoints, snap) : null;
    const pts = next ? [...wallPoints, next] : wallPoints;
    return (
      <g className="tool-preview">
        <polyline points={pointsAttr(pts)} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={4 * px} />
        ))}
        {next && (
          <text x={next.x + 8 * px} y={next.y - 8 * px} fontSize={11 * px}>
            {Math.round(Math.hypot(next.x - last.x, next.y - last.y))}cm
          </text>
        )}
      </g>
    );
  }
  if (tool === 'room' && cursor) {
    return (
      <g className="tool-preview">
        <rect x={cursor.x} y={cursor.y} width={room.w} height={room.d} className="tool-preview-room" />
        <text x={cursor.x + room.w / 2} y={cursor.y + room.d / 2} fontSize={12 * px} textAnchor="middle">
          {room.w}×{room.d}cm
        </text>
      </g>
    );
  }
  if (tool === 'calibrate' && calibration && bg) {
    const pts = calibration.points.map((p) => imagePxToPlan(bg, p));
    return (
      <g className="tool-preview">
        {pts.length === 2 && <line x1={pts[0].x} y1={pts[0].y} x2={pts[1].x} y2={pts[1].y} className="calib-line" />}
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={5 * px} className="calib-point" />
        ))}
      </g>
    );
  }
  return null;
}
```

`src/editor2d/Editor2D.tsx` 전체 교체(Task 8 버전에 도구 클릭·미리보기·키보드·커서 추적을 더함):
```tsx
import { useEffect, useRef, useState, type PointerEvent, type WheelEvent } from 'react';
import { planBounds } from '../geometry/bounds';
import type { Vec2 } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { BackgroundImage } from './BackgroundImage';
import { Openings2D } from './Openings2D';
import { Rooms2D } from './Rooms2D';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';
import { ToolPreview } from './ToolPreview';
import { applyToolClick, finishWall } from './tools';
import { fitViewBox, panBy, zoomAt, type ViewBox } from './viewBox';
import { Walls2D } from './Walls2D';

const ZOOM_STEP = 1.15;

export function Editor2D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const resetKey = useUi((s) => s.viewResetKey);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<ViewBox>(() => fitViewBox(planBounds({ walls }), 4 / 3));
  const [wallPoints, setWallPoints] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const pan = useRef<{ x: number; y: number; vb: ViewBox } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 처음 열 때, 화면 크기가 바뀔 때, "시점 초기화"를 누를 때 평면 전체가 보이게 맞춘다
  useEffect(() => {
    setVb(fitViewBox(planBounds({ walls: store.getState().plan.walls }), size.w / size.h));
  }, [store, size.w, size.h, resetKey]);

  // 도구를 바꾸면 그리던 벽은 버린다
  useEffect(() => {
    setWallPoints([]);
    setCursor(null);
  }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if ((e.key === 'Enter' || e.key === 'Escape') && wallPoints.length > 0) {
        e.preventDefault();
        finishWall(store, wallPoints);
        setWallPoints([]);
        return;
      }
      if (e.key === 'Escape') {
        const ui = useUi.getState();
        ui.clearCandidates();
        if (ui.calibration) ui.cancelCalibration();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, wallPoints]);

  const px = vb.w / size.w;
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (tool === 'select') {
      store.getState().select(null);
      useUi.getState().clearCandidates();
      pan.current = { x: e.clientX, y: e.clientY, vb };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    applyToolClick(tool, toPlan(e), { store, wallPoints, setWallPoints });
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (p) {
      const k = p.vb.w / size.w;
      setVb(panBy(p.vb, -(e.clientX - p.x) * k, -(e.clientY - p.y) * k));
      return;
    }
    if (tool !== 'select') setCursor(toPlan(e));
  };
  const endPan = () => {
    pan.current = null;
  };
  const onDoubleClick = () => {
    if (tool !== 'wall' || wallPoints.length === 0) return;
    finishWall(store, wallPoints);
    setWallPoints([]);
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const p = toPlan(e);
    setVb((v) => zoomAt(v, p, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  };

  return (
    <div className={`editor2d mode-${mode}`}>
      <SvgContext.Provider value={svgRef}>
        <svg
          ref={svgRef}
          className={`editor2d-svg tool-${tool}`}
          data-testid="editor2d"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        >
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="editor2d-bg" />
          <BackgroundImage px={px} />
          <Rooms2D px={px} />
          <Walls2D px={px} />
          <Openings2D />
          <ToolPreview px={px} wallPoints={wallPoints} cursor={cursor} />
        </svg>
      </SvgContext.Provider>
    </div>
  );
}
```

`src/ui/StructurePanel.tsx`:
```tsx
import { useRef, useState, type ChangeEvent } from 'react';
import { calibrationResult, SCALE_TOLERANCE, scaleText } from '../editor2d/calibration';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { getDefaultImageStore, saveBackgroundImage } from '../persistence/images';
import { useUi, type Tool } from './uiStore';

const TOOLS: [Tool, string][] = [
  ['select', '선택'],
  ['wall', '벽 그리기'],
  ['room', '방 만들기'],
  ['door', '문'],
  ['window', '창'],
  ['opening', '개구부'],
  ['label', '방 이름'],
];

function DraftNumber({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(String(value));
  return (
    <label className="field">
      {label}
      <span className="field-input">
        <input
          inputMode="numeric"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            const v = Number(e.target.value);
            if (Number.isInteger(v) && v >= 1 && v <= 5000) onChange(v);
          }}
        />
        <span className="unit">cm</span>
      </span>
    </label>
  );
}

function CalibrationForm() {
  const store = usePlanStore();
  const calibration = useUi((s) => s.calibration);
  const [len, setLen] = useState('');
  if (!calibration) return null;
  const ui = useUi.getState();
  const label = calibration.target === 'primary' ? '축척 보정' : '검증 길이';
  if (calibration.points.length < 2) {
    return (
      <div className="calib">
        <p className="muted">{label}: 도면에서 길이를 아는 두 점을 클릭하세요 ({calibration.points.length}/2)</p>
        <button type="button" onClick={() => ui.cancelCalibration()}>취소</button>
      </div>
    );
  }
  const apply = () => {
    const bg = store.getState().plan.background;
    const v = Number(len);
    if (!bg || !(v > 0)) {
      ui.showBanner({ kind: 'error', text: '실제 길이를 cm 단위 양수로 입력하세요.' });
      return;
    }
    const r = calibrationResult(bg, calibration, v);
    if (!r) {
      ui.showBanner({ kind: 'error', text: '두 점이 같거나 기준 축척이 없어 보정할 수 없습니다.' });
      return;
    }
    store.getState().updateBackground(r.background);
    if (r.mismatch !== null && r.mismatch > SCALE_TOLERANCE) {
      ui.showBanner({
        kind: 'error',
        text: `검증 길이와 축척이 ${(r.mismatch * 100).toFixed(1)}% 다릅니다. 도면이 왜곡됐을 수 있어 배경 정렬은 근사치입니다.`,
      });
    }
    ui.cancelCalibration();
  };
  return (
    <div className="calib">
      <label className="field">
        {label}: 두 점 사이 실제 길이
        <span className="field-input">
          <input inputMode="numeric" aria-label="실제 길이" value={len} onChange={(e) => setLen(e.target.value)} />
          <span className="unit">cm</span>
        </span>
      </label>
      <div className="row">
        <button type="button" onClick={apply}>적용</button>
        <button type="button" onClick={() => ui.cancelCalibration()}>취소</button>
      </div>
    </div>
  );
}

export function StructurePanel() {
  const store = usePlanStore();
  const bg = usePlan((s) => s.plan.background);
  const tool = useUi((s) => s.tool);
  const calibration = useUi((s) => s.calibration);
  const wallDraft = useUi((s) => s.wallDraft);
  const roomDraft = useUi((s) => s.roomDraft);
  const ui = useUi.getState();
  const fileRef = useRef<HTMLInputElement>(null);

  const onImage = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.type !== 'image/png' && file.type !== 'image/jpeg') {
      ui.showBanner({ kind: 'error', text: 'PNG 또는 JPG 이미지만 불러올 수 있습니다.' });
      return;
    }
    try {
      const img = await saveBackgroundImage(getDefaultImageStore(), file);
      store.getState().setBackground({ ...img, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 0.5 });
      ui.showBanner({ kind: 'info', text: '배경 이미지를 불러왔습니다. "축척 보정"으로 실제 길이를 맞추세요.' });
    } catch {
      ui.showBanner({ kind: 'error', text: '이미지를 불러오지 못했습니다.' });
    }
  };

  return (
    <div className="structure">
      <h3>도구</h3>
      <div className="tool-grid">
        {TOOLS.map(([t, label]) => (
          <button key={t} type="button" aria-pressed={tool === t} onClick={() => ui.setTool(t)}>{label}</button>
        ))}
      </div>
      {tool === 'wall' && (
        <fieldset>
          <DraftNumber label="벽 두께" value={wallDraft.thickness} onChange={(v) => ui.setWallDraft({ thickness: v })} />
          <DraftNumber label="높이" value={wallDraft.height} onChange={(v) => ui.setWallDraft({ height: v })} />
          <p className="muted">클릭으로 점을 찍고 더블클릭·Enter·Esc로 끝냅니다.</p>
        </fieldset>
      )}
      {tool === 'room' && (
        <fieldset>
          <label className="field">
            이름
            <input
              defaultValue={roomDraft.name}
              onChange={(e) => {
                if (e.target.value.trim()) ui.setRoomDraft({ name: e.target.value.trim() });
              }}
            />
          </label>
          <DraftNumber label="내측 가로 W" value={roomDraft.w} onChange={(v) => ui.setRoomDraft({ w: v })} />
          <DraftNumber label="내측 세로 D" value={roomDraft.d} onChange={(v) => ui.setRoomDraft({ d: v })} />
          <DraftNumber label="벽 두께" value={roomDraft.thickness} onChange={(v) => ui.setRoomDraft({ thickness: v })} />
          <DraftNumber label="높이" value={roomDraft.height} onChange={(v) => ui.setRoomDraft({ height: v })} />
          <p className="muted">방의 왼쪽 위 안쪽 모서리를 클릭하세요.</p>
        </fieldset>
      )}
      {(tool === 'door' || tool === 'window' || tool === 'opening') && (
        <p className="muted">벽 위를 클릭하면 놓입니다. 크기와 위치는 오른쪽 속성창에서 바꿉니다.</p>
      )}
      {tool === 'label' && <p className="muted">방 이름을 놓을 곳을 클릭하세요.</p>}

      <h3>배경 도면</h3>
      <button type="button" onClick={() => fileRef.current?.click()}>이미지 불러오기</button>
      <input ref={fileRef} type="file" accept="image/png,image/jpeg" hidden data-testid="open-background" onChange={onImage} />
      {bg && (
        <>
          <label className="field">
            투명도
            <input type="range" min={0} max={1} step={0.05} value={bg.opacity} onChange={(e) => store.getState().updateBackground({ opacity: Number(e.target.value) })} />
          </label>
          <p className="muted" data-testid="scale-info">{scaleText(bg)}</p>
          <div className="row">
            <button type="button" aria-pressed={calibration?.target === 'primary'} onClick={() => ui.startCalibration('primary')}>축척 보정</button>
            <button type="button" disabled={!bg.calibration} aria-pressed={calibration?.target === 'check'} onClick={() => ui.startCalibration('check')}>검증 길이</button>
            <button type="button" className="danger" onClick={() => store.getState().setBackground(undefined)}>배경 제거</button>
          </div>
          <CalibrationForm />
        </>
      )}
    </div>
  );
}
```

`src/App.tsx`: `<aside className="left">` 안을 `{mode === 'structure' ? <StructurePanel /> : <CatalogPanel />}`로 바꾸고 `import { StructurePanel } from './ui/StructurePanel';`를 추가한다.

`src/styles.css` 끝에 추가:
```css
.structure h3 { font-size: 13px; margin: 12px 0 6px; color: #6b5e4b; }
.tool-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
.structure fieldset { border: 1px solid #e5e1d8; border-radius: 6px; margin: 8px 0; padding: 8px; }
.field { display: flex; flex-direction: column; gap: 2px; font-size: 12px; margin-bottom: 8px; }
.field input { padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; font-size: 13px; min-width: 0; }
.field-input { display: flex; align-items: center; gap: 4px; }
.field-input input { flex: 1; }
.unit { font-size: 12px; color: #6b7280; }
.calib { margin-top: 8px; }
.editor2d-svg.tool-wall, .editor2d-svg.tool-room, .editor2d-svg.tool-door, .editor2d-svg.tool-window,
.editor2d-svg.tool-opening, .editor2d-svg.tool-label, .editor2d-svg.tool-calibrate { cursor: crosshair; }
.tool-preview polyline { fill: none; stroke: var(--accent); stroke-width: 2; vector-effect: non-scaling-stroke; }
.tool-preview circle { fill: var(--accent); }
.tool-preview text { fill: var(--accent); }
.tool-preview-room { fill: rgba(59, 130, 246, 0.08); stroke: var(--accent); stroke-dasharray: 6 4; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.tool-preview .calib-point { fill: var(--danger); }
.calib-line { stroke: var(--danger); stroke-width: 2; vector-effect: non-scaling-stroke; }
```

- [ ] **Step 4: 통과와 브라우저 확인**

Run: `npx vitest run src/editor2d && npm run typecheck && npm test && npm run e2e`
Expected: PASS, 기존 E2E 3 passed

브라우저 확인(일회용 Playwright 스크립트, scratchpad):
1. `구조` → `방 만들기` → 이름 `거실`, W 400, D 300, 두께 15 → 2D에서 클릭 → 벽 4개와 `거실` 이름 표시, `window.__homefit`로 읽은 새 벽의 중심선 폭 − 두께 = 400
2. `문` → 새 방 윗벽 가운데 클릭 → 문과 열림 부채꼴 표시, 오른쪽 속성 패널에 선택됨
3. `벽 그리기` → 세 점 클릭 후 더블클릭 → 벽 2개 추가(길이 0 벽 없음), 한 번의 `undo()`로 둘 다 사라짐
4. 캔버스로 만든 400×300 PNG를 `open-background`에 넣음 → `background-image` 표시 → `축척 보정` → 두 점 클릭 → `실제 길이` 입력 → `적용` → `scale-info`에 `축척 1px =` 표시
5. `pageerror` 없음

- [ ] **Step 5: Commit**

```bash
git add src/editor2d/tools.ts src/editor2d/tools.test.ts src/editor2d/ToolPreview.tsx src/editor2d/Editor2D.tsx src/ui/StructurePanel.tsx src/App.tsx src/styles.css
git commit -m "feat: structure tools for walls, rooms, openings, labels, background image and scale calibration"
```

---
### Task 10: 2D 배치(가구 표시·드래그·카탈로그 드롭), 검증 표시, 겹친 물체 후보 목록

**Files:**
- Create: `src/editor2d/Items2D.tsx`, `src/editor2d/Overlays2D.tsx`, `src/ui/CandidatePicker.tsx`
- Modify: `src/editor2d/Editor2D.tsx` (전체 교체), `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: `itemsAtPoint` (Task 3), `pointsAttr`, `shapePath`, `itemColor`, `MISSING_COLOR` (Task 4), `useValidation`, `findProduct`, `itemObb`, `corners`, `snapToWalls`, `planWallObbs`, `itemClearances`, `wallDistances` (계획 1), `activeItems` (Task 1), `useUi` `snap`·`candidates`·`showCandidates`·`clearCandidates`·`setDragging` (Task 7), `SvgContext`, `clientToPlan` (Task 8), `DND_MIME` (계획 1)
- Produces:
  - 2D 가구 `data-testid="item2d-<id>"`(다각형). 배치 모드 + 선택 도구에서 클릭하면 선택, 3px 넘게 끌면 이동(스냅 켜짐이면 벽 밀착), 잠긴 가구는 움직이지 않음
  - 움직이지 않고 클릭한 자리에 가구가 2개 이상 겹치면 후보 목록을 띄운다
  - 카탈로그 카드를 2D 화면에 끌어 놓으면 그 자리에 생성(배치 모드에서만)
  - 2D 검증 표시: 충돌·방문 간섭은 빨간 테두리, 제품 문 열림 공간 부족은 주황, 선택은 파랑. 제품 문 열림 영역, 선택 가구의 4방향 벽 거리(cm)
  - `<CandidatePicker />` — `data-testid="candidates"`, 항목은 `role="menuitem"` 버튼(제품 이름, 잠긴 것은 ` (잠금)`)
  - 구조 모드에서는 가구를 반투명하게 보여주고 클릭을 받지 않는다

- [ ] **Step 1: 구현**

`src/editor2d/Overlays2D.tsx`:
```tsx
import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { itemClearances } from '../geometry/clearance';
import { wallDistances } from '../geometry/distance';
import { itemObb } from '../geometry/obb';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import { usePlan } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { shapePath } from './svg';

export function Overlays2D({ px }: { px: number }) {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const wallObbs = useMemo(() => planWallObbs(plan), [plan]);
  const placed = activeItems(plan).flatMap((item) => {
    const product = findProduct(plan, item.productId);
    return product ? [{ item, product }] : [];
  });
  const selected = placed.find((p) => p.item.id === selectedId);
  const rays = selected
    ? wallDistances(itemObb(selected.item.x, selected.item.y, selected.item.rotation, selected.product.dims.w, selected.product.dims.d), wallObbs)
    : [];

  return (
    <g className="overlays2d" pointerEvents="none">
      {placed.flatMap(({ item, product }) =>
        itemClearances(item, product).map((shape, i) => (
          <path key={`${item.id}-${i}`} d={shapePath(shape)} className={status[item.id]?.clearanceBlocked ? 'clearance clearance-blocked' : 'clearance'} />
        )),
      )}
      {rays.map((r) => (
        <g key={r.dir}>
          <line x1={r.from.x} y1={r.from.y} x2={r.to.x} y2={r.to.y} className="dist-line" />
          <text x={(r.from.x + r.to.x) / 2} y={(r.from.y + r.to.y) / 2} fontSize={10 * px} className="dist-text" textAnchor="middle" dominantBaseline="middle">
            {r.distance}cm
          </text>
        </g>
      ))}
    </g>
  );
}
```

`src/editor2d/Items2D.tsx`:
```tsx
import { useContext, useRef, type PointerEvent } from 'react';
import { findProduct } from '../catalog/products';
import { corners, itemObb } from '../geometry/obb';
import { itemsAtPoint } from '../geometry/pick';
import { snapToWalls } from '../geometry/snap';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Item } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useValidation } from '../model/useValidation';
import { useUi } from '../ui/uiStore';
import { itemColor, MISSING_COLOR } from './itemColor';
import { pointsAttr } from './svg';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

const CLICK_SLOP_PX = 3;

type Drag = { id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean; locked: boolean };

export function Items2D({ px }: { px: number }) {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const status = useValidation();
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const svgRef = useContext(SvgContext);
  const drag = useRef<Drag | null>(null);
  const interactive = mode === 'place' && tool === 'select';
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onDown = (e: PointerEvent<SVGPolygonElement>, item: Item) => {
    e.stopPropagation();
    const s = store.getState();
    s.select(item.id);
    useUi.getState().clearCandidates();
    const p = toPlan(e);
    drag.current = { id: item.id, dx: item.x - p.x, dy: item.y - p.y, startX: e.clientX, startY: e.clientY, moved: false, locked: !!item.locked };
    e.currentTarget.setPointerCapture(e.pointerId);
    if (!item.locked) {
      s.beginDrag();
      setDragging(true);
    }
  };

  const onMove = (e: PointerEvent<SVGPolygonElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_SLOP_PX) d.moved = true;
    if (!d.moved || d.locked) return;
    const s = store.getState();
    const item = activeItems(s.plan).find((i) => i.id === d.id);
    if (!item) return;
    const dims = findProduct(s.plan, item.productId)?.dims ?? { w: 50, d: 50 };
    const p = toPlan(e);
    const x = p.x + d.dx;
    const y = p.y + d.dy;
    const target = useUi.getState().snap ? snapToWalls(itemObb(x, y, item.rotation, dims.w, dims.d), planWallObbs(s.plan)) : { cx: x, cy: y };
    s.dragItem(d.id, target.cx, target.cy);
  };

  const finish = () => {
    const d = drag.current;
    if (!d) return null;
    drag.current = null;
    if (!d.locked) {
      store.getState().endDrag();
      setDragging(false);
    }
    return d;
  };

  const onUp = (e: PointerEvent<SVGPolygonElement>) => {
    const d = finish();
    if (!d || d.moved) return;
    const s = store.getState();
    const ids = itemsAtPoint(s.plan, toPlan(e), (id) => findProduct(s.plan, id));
    if (ids.length > 1) useUi.getState().showCandidates({ ids, clientX: e.clientX, clientY: e.clientY });
  };

  return (
    <g className="items2d">
      {activeItems(plan).map((item) => {
        const product = findProduct(plan, item.productId);
        const dims = product?.dims ?? { w: 50, d: 50 };
        const st = status[item.id];
        const cls = [
          'item2d',
          item.id === selectedId ? 'item2d-selected' : '',
          st?.clearanceBlocked ? 'item2d-warn' : '',
          st?.collides || st?.blocksDoor ? 'item2d-danger' : '',
        ]
          .filter(Boolean)
          .join(' ');
        return (
          <g key={item.id}>
            <polygon
              points={pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}
              fill={product ? itemColor(product, item.variantId) : MISSING_COLOR}
              className={cls}
              data-testid={`item2d-${item.id}`}
              onPointerDown={interactive ? (e) => onDown(e, item) : undefined}
              onPointerMove={interactive ? onMove : undefined}
              onPointerUp={interactive ? onUp : undefined}
              onPointerCancel={interactive ? finish : undefined}
            />
            <text x={item.x} y={item.y} fontSize={10 * px} textAnchor="middle" dominantBaseline="middle" className="item2d-label">
              {product?.name ?? '알 수 없는 제품'}
              {item.locked ? ' (잠금)' : ''}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

`src/ui/CandidatePicker.tsx`:
```tsx
import { findProduct } from '../catalog/products';
import { activeItems } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from './uiStore';

export function CandidatePicker() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const candidates = useUi((s) => s.candidates);
  if (!candidates) return null;
  const items = activeItems(plan);
  return (
    <div className="candidates" role="menu" aria-label="겹친 물체 선택" data-testid="candidates" style={{ left: candidates.clientX + 8, top: candidates.clientY + 8 }}>
      <p className="muted">겹친 물체 {candidates.ids.length}개</p>
      {candidates.ids.map((id) => {
        const item = items.find((i) => i.id === id);
        if (!item) return null;
        return (
          <button
            key={id}
            type="button"
            role="menuitem"
            onClick={() => {
              store.getState().select(id);
              useUi.getState().clearCandidates();
            }}
          >
            {findProduct(plan, item.productId)?.name ?? '알 수 없는 제품'}
            {item.locked ? ' (잠금)' : ''}
          </button>
        );
      })}
    </div>
  );
}
```

`src/editor2d/Editor2D.tsx` 전체 교체(Task 9 버전에 카탈로그 드롭, `Items2D`, `Overlays2D`를 더함):
```tsx
import { useEffect, useRef, useState, type DragEvent, type PointerEvent, type WheelEvent } from 'react';
import { planBounds } from '../geometry/bounds';
import type { Vec2 } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { DND_MIME } from '../ui/dnd';
import { useUi } from '../ui/uiStore';
import { BackgroundImage } from './BackgroundImage';
import { Items2D } from './Items2D';
import { Openings2D } from './Openings2D';
import { Overlays2D } from './Overlays2D';
import { Rooms2D } from './Rooms2D';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';
import { ToolPreview } from './ToolPreview';
import { applyToolClick, finishWall } from './tools';
import { fitViewBox, panBy, zoomAt, type ViewBox } from './viewBox';
import { Walls2D } from './Walls2D';

const ZOOM_STEP = 1.15;

export function Editor2D() {
  const store = usePlanStore();
  const walls = usePlan((s) => s.plan.walls);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const resetKey = useUi((s) => s.viewResetKey);
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [vb, setVb] = useState<ViewBox>(() => fitViewBox(planBounds({ walls }), 4 / 3));
  const [wallPoints, setWallPoints] = useState<Vec2[]>([]);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const pan = useRef<{ x: number; y: number; vb: ViewBox } | null>(null);

  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setSize({ w: width, h: height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // 처음 열 때, 화면 크기가 바뀔 때, "시점 초기화"를 누를 때 평면 전체가 보이게 맞춘다
  useEffect(() => {
    setVb(fitViewBox(planBounds({ walls: store.getState().plan.walls }), size.w / size.h));
  }, [store, size.w, size.h, resetKey]);

  // 도구를 바꾸면 그리던 벽은 버린다
  useEffect(() => {
    setWallPoints([]);
    setCursor(null);
  }, [tool]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.tagName === 'INPUT') return;
      if ((e.key === 'Enter' || e.key === 'Escape') && wallPoints.length > 0) {
        e.preventDefault();
        finishWall(store, wallPoints);
        setWallPoints([]);
        return;
      }
      if (e.key === 'Escape') {
        const ui = useUi.getState();
        ui.clearCandidates();
        if (ui.calibration) ui.cancelCalibration();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [store, wallPoints]);

  const px = vb.w / size.w;
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onPointerDown = (e: PointerEvent<SVGSVGElement>) => {
    if (e.button !== 0) return;
    if (tool === 'select') {
      store.getState().select(null);
      useUi.getState().clearCandidates();
      pan.current = { x: e.clientX, y: e.clientY, vb };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }
    applyToolClick(tool, toPlan(e), { store, wallPoints, setWallPoints });
  };
  const onPointerMove = (e: PointerEvent<SVGSVGElement>) => {
    const p = pan.current;
    if (p) {
      const k = p.vb.w / size.w;
      setVb(panBy(p.vb, -(e.clientX - p.x) * k, -(e.clientY - p.y) * k));
      return;
    }
    if (tool !== 'select') setCursor(toPlan(e));
  };
  const endPan = () => {
    pan.current = null;
  };
  const onDoubleClick = () => {
    if (tool !== 'wall' || wallPoints.length === 0) return;
    finishWall(store, wallPoints);
    setWallPoints([]);
  };
  const onWheel = (e: WheelEvent<SVGSVGElement>) => {
    const p = toPlan(e);
    setVb((v) => zoomAt(v, p, e.deltaY < 0 ? ZOOM_STEP : 1 / ZOOM_STEP));
  };
  const onDragOver = (e: DragEvent) => {
    if (mode === 'place' && e.dataTransfer.types.includes(DND_MIME)) e.preventDefault();
  };
  const onDrop = (e: DragEvent) => {
    const data = e.dataTransfer.getData(DND_MIME);
    if (!data || mode !== 'place') return;
    e.preventDefault();
    const [productId, variantId] = data.split('|');
    const p = toPlan(e);
    store.getState().addItem(productId, variantId, { x: Math.round(p.x), y: Math.round(p.y) });
  };

  return (
    <div className={`editor2d mode-${mode}`} onDragOver={onDragOver} onDrop={onDrop}>
      <SvgContext.Provider value={svgRef}>
        <svg
          ref={svgRef}
          className={`editor2d-svg tool-${tool}`}
          data-testid="editor2d"
          viewBox={`${vb.x} ${vb.y} ${vb.w} ${vb.h}`}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={endPan}
          onPointerCancel={endPan}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
        >
          <rect x={vb.x} y={vb.y} width={vb.w} height={vb.h} className="editor2d-bg" />
          <BackgroundImage px={px} />
          <Rooms2D px={px} />
          <Overlays2D px={px} />
          <Items2D px={px} />
          <Walls2D px={px} />
          <Openings2D />
          <ToolPreview px={px} wallPoints={wallPoints} cursor={cursor} />
        </svg>
      </SvgContext.Provider>
    </div>
  );
}
```

`src/App.tsx`: `<main className="center">` 안을 다음으로 바꾸고 `import { CandidatePicker } from './ui/CandidatePicker';`를 추가한다.
```tsx
      <main className="center">
        {show2d ? <Editor2D /> : <Viewport />}
        <CandidatePicker />
      </main>
```

`src/styles.css` 끝에 추가:
```css
.item2d { stroke: #6b5e4b; stroke-width: 1.5; vector-effect: non-scaling-stroke; fill-opacity: 0.85; cursor: grab; }
.item2d-selected { stroke: var(--accent); stroke-width: 2.5; }
.item2d-warn { stroke: var(--warn); stroke-width: 2.5; }
.item2d-danger { stroke: var(--danger); stroke-width: 2.5; }
.item2d-label { fill: #1f2328; pointer-events: none; }
.editor2d.mode-structure .items2d { opacity: 0.45; pointer-events: none; }
.clearance { fill: rgba(79, 157, 222, 0.18); }
.clearance-blocked { fill: rgba(245, 165, 36, 0.3); }
.dist-line { stroke: var(--accent); stroke-dasharray: 5 3; stroke-width: 1.5; vector-effect: non-scaling-stroke; }
.dist-text { fill: var(--accent); }
.candidates { position: fixed; z-index: 20; display: flex; flex-direction: column; gap: 4px; padding: 6px; background: #fff; border: 1px solid #d6d0c4; border-radius: 6px; box-shadow: 0 4px 12px rgba(0, 0, 0, 0.12); }
.candidates p { margin: 0 0 2px; }
```

- [ ] **Step 2: 검증**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: 오류 없음, 전체 PASS, 기존 E2E 3 passed

브라우저 확인(일회용 Playwright 스크립트, scratchpad):
1. 배치 모드 `2D` → 카탈로그 소파 카드를 2D 화면에 끌어 놓기 → `item2d-*` 생성
2. 소파를 끌면 이동하고 `Ctrl+Z` 한 번에 원위치. `스냅 꺼짐`일 때는 벽 2cm 이내로 가도 붙지 않는다
3. 같은 자리에 `추가` 두 번 → 빨간 테두리 → 움직이지 않고 클릭하면 `candidates` 목록(2개), 아래쪽 항목을 누르면 그 가구가 선택됨
4. 냉장고를 놓으면 문 열림 부채꼴과 선택 시 4방향 거리(cm)가 보인다
5. `구조` 모드로 가면 가구가 반투명하고 클릭되지 않는다
6. `pageerror` 없음

- [ ] **Step 3: Commit**

```bash
git add src/editor2d/Items2D.tsx src/editor2d/Overlays2D.tsx src/editor2d/Editor2D.tsx src/ui/CandidatePicker.tsx src/App.tsx src/styles.css
git commit -m "feat: 2D furniture placement with drag, drop, validation overlays and overlap candidates"
```

---

### Task 11: 속성창(벽·개구부·방 이름·가구 잠금/실측)과 구조 단축키

**Files:**
- Create: `src/ui/fields.tsx`, `src/ui/properties/ItemProperties.tsx`, `src/ui/properties/WallProperties.tsx`, `src/ui/properties/OpeningProperties.tsx`, `src/ui/properties/RoomProperties.tsx`
- Modify: `src/ui/PropertiesPanel.tsx` (전체 교체), `src/ui/shortcuts.ts` (전체 교체), `src/styles.css`
- Test: `src/ui/shortcuts.test.ts` (추가)

**Interfaces:**
- Consumes: `findEntity`, `Entity` (Task 2), 스토어 `updateItem`, `rotateItem`, `duplicateItem`, `removeItem`, `updateWall`, `resizeWall`, `removeWall`, `updateOpening`, `removeOpening`, `updateRoom`, `removeRoom` (Task 5), `wallLength` (계획 1), `useValidation`, `findProduct`, `useUi.showBanner`
- Produces:
  - `NumberField({ label, unit, value, onCommit, disabled? })` — 단위를 입력 옆에 항상 표시, blur/Enter에 정수로 커밋, 거부되면 원래 값으로 돌아감
  - `TextField({ label, value, onCommit })`, `CheckboxField({ label, checked, onChange })`
  - 속성창: 선택 없음 → `항목을 선택하세요.`; 가구 → 이름·치수·상태 배지·X/Y(cm)·회전(°)·색상·`잠금 (이동·회전 막기)`·`실측 확인`·`90° 회전 (R)`·`복제`·`삭제`(잠기면 X/Y/회전 입력과 회전 버튼 비활성); 벽 → `벽` 제목, `실측 확인됨`/`추정 치수`, 길이·두께·높이(cm), `실측 확인`, `벽 삭제`; 개구부 → `문`/`창`/`개구부` 제목, 종류, 벽 시작점에서 거리·폭·높이·창턱(cm), 문이면 `경첩 반대로`·`열림 방향 반대로`, `실측 확인`, 삭제; 방 이름 → 이름, X/Y(cm), `방 이름 삭제`
  - 단축키: 벽·개구부·방 이름 선택 중 Delete/Backspace는 삭제. 잠긴 가구는 방향키·R을 처리하지 않는다(false 반환)

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/shortcuts.test.ts`에 추가(파일 상단 import에 `SAMPLE_PLAN`, `createPlanStore`가 이미 있다):
```ts
describe('구조 단축키', () => {
  it('선택한 개구부·벽·방 이름은 Delete/Backspace로 지운다', () => {
    const store = createPlanStore(SAMPLE_PLAN);
    const press = (key: string) => applyShortcut(store.getState(), { key, shiftKey: false, mod: false });
    store.getState().select('o1');
    expect(press('Delete')).toBe(true);
    expect(store.getState().plan.openings.some((o) => o.id === 'o1')).toBe(false);
    store.getState().select('w1');
    expect(press('Backspace')).toBe(true);
    expect(store.getState().plan.walls.some((w) => w.id === 'w1')).toBe(false);
    store.getState().select('r1');
    expect(press('Delete')).toBe(true);
    expect(store.getState().plan.rooms.some((r) => r.id === 'r1')).toBe(false);
  });

  it('벽 선택 중 R과 방향키는 처리하지 않는다', () => {
    const store = createPlanStore(SAMPLE_PLAN);
    store.getState().select('w1');
    expect(applyShortcut(store.getState(), { key: 'r', shiftKey: false, mod: false })).toBe(false);
    expect(applyShortcut(store.getState(), { key: 'ArrowLeft', shiftKey: false, mod: false })).toBe(false);
  });
});

it('잠긴 아이템은 방향키와 R을 무시한다', () => {
  const { store, id, press } = setup();
  store.getState().updateItem(id, { locked: true });
  expect(press('ArrowRight')).toBe(false);
  expect(press('r')).toBe(false);
  expect(store.getState().plan.items[0]).toMatchObject({ x: 100, y: 100, rotation: 0 });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui/shortcuts.test.ts`
Expected: 구조 단축키 테스트와 잠금 테스트 FAIL

- [ ] **Step 3: 구현**

`src/ui/shortcuts.ts` 전체 교체:
```ts
import { useEffect } from 'react';
import type { StoreApi } from 'zustand/vanilla';
import { findEntity } from '../model/entities';
import type { PlanState } from '../model/store';

export type KeyInput = { key: string; shiftKey: boolean; mod: boolean; targetTag?: string };

const TEXT_INPUT = new Set(['INPUT', 'SELECT', 'TEXTAREA']);
const ARROWS: Record<string, [number, number]> = {
  ArrowLeft: [-1, 0],
  ArrowRight: [1, 0],
  ArrowUp: [0, -1],
  ArrowDown: [0, 1],
};

export function applyShortcut(s: PlanState, k: KeyInput): boolean {
  if (k.targetTag && TEXT_INPUT.has(k.targetTag)) return false;
  const key = k.key.toLowerCase();
  if (k.mod && key === 'z') {
    if (k.shiftKey) s.redo();
    else s.undo();
    return true;
  }
  // 패널 버튼을 누른 직후 포커스가 남아 있어도 Backspace로 지워지지 않게 한다
  if (k.targetTag === 'BUTTON') return false;
  const entity = findEntity(s.plan, s.selectedId);
  if (!entity) return false;
  const isDelete = k.key === 'Delete' || k.key === 'Backspace';
  if (entity.kind === 'wall') {
    if (isDelete) s.removeWall(entity.wall.id);
    return isDelete;
  }
  if (entity.kind === 'opening') {
    if (isDelete) s.removeOpening(entity.opening.id);
    return isDelete;
  }
  if (entity.kind === 'room') {
    if (isDelete) s.removeRoom(entity.room.id);
    return isDelete;
  }
  const item = entity.item;
  if (k.mod && key === 'd') {
    s.duplicateItem(item.id);
    return true;
  }
  if (isDelete) {
    s.removeItem(item.id);
    return true;
  }
  if (item.locked) return false;
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

`src/ui/fields.tsx`:
```tsx
import { useEffect, useState } from 'react';

type NumberFieldProps = { label: string; unit: string; value: number; onCommit: (v: number) => void; disabled?: boolean };

export function NumberField({ label, unit, value, onCommit, disabled = false }: NumberFieldProps) {
  const [text, setText] = useState(String(value));
  useEffect(() => setText(String(value)), [value]);
  const commit = () => {
    const v = Number(text);
    if (text.trim() !== '' && Number.isFinite(v) && Math.round(v) !== value) onCommit(Math.round(v));
    // 거부된 입력은 원래 값으로 되돌린다(성공하면 바뀐 value가 effect로 들어온다)
    setText(String(value));
  };
  return (
    <label className="field">
      {label}
      <span className="field-input">
        <input
          inputMode="numeric"
          value={text}
          disabled={disabled}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <span className="unit">{unit}</span>
      </span>
    </label>
  );
}

export function TextField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if (v && v !== value) onCommit(v);
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

export function CheckboxField({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="check">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
```

`src/ui/properties/ItemProperties.tsx`:
```tsx
import { findProduct } from '../../catalog/products';
import type { Item } from '../../model/schema';
import { usePlan, usePlanStore } from '../../model/StoreContext';
import { useValidation } from '../../model/useValidation';
import { CheckboxField, NumberField } from '../fields';

export function ItemProperties({ item }: { item: Item }) {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const status = useValidation();
  const product = findProduct(plan, item.productId);
  const st = status[item.id];
  const s = store.getState();
  const locked = !!item.locked;
  return (
    <>
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
      <NumberField key={`${item.id}-x`} label="X" unit="cm" value={item.x} disabled={locked} onCommit={(v) => s.updateItem(item.id, { x: v })} />
      <NumberField key={`${item.id}-y`} label="Y" unit="cm" value={item.y} disabled={locked} onCommit={(v) => s.updateItem(item.id, { y: v })} />
      <NumberField key={`${item.id}-r`} label="회전" unit="°" value={item.rotation} disabled={locked} onCommit={(v) => s.updateItem(item.id, { rotation: v })} />
      {product && product.variants.length > 1 && (
        <label className="field">
          색상
          <select value={item.variantId} onChange={(e) => s.updateItem(item.id, { variantId: e.target.value })}>
            {product.variants.map((v) => (
              <option key={v.id} value={v.id}>{v.label}</option>
            ))}
          </select>
        </label>
      )}
      <CheckboxField label="잠금 (이동·회전 막기)" checked={locked} onChange={(v) => s.updateItem(item.id, { locked: v })} />
      <CheckboxField label="실측 확인" checked={!!item.verified} onChange={(v) => s.updateItem(item.id, { verified: v })} />
      <div className="row">
        <button type="button" disabled={locked} onClick={() => s.rotateItem(item.id, 90)}>90° 회전 (R)</button>
        <button type="button" onClick={() => s.duplicateItem(item.id)}>복제</button>
        <button type="button" className="danger" onClick={() => s.removeItem(item.id)}>삭제</button>
      </div>
    </>
  );
}
```

`src/ui/properties/WallProperties.tsx`:
```tsx
import { wallLength } from '../../geometry/walls';
import type { Wall } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { CheckboxField, NumberField } from '../fields';
import { useUi } from '../uiStore';

export function WallProperties({ wall }: { wall: Wall }) {
  const s = usePlanStore().getState();
  const showBanner = useUi((u) => u.showBanner);
  return (
    <>
      <h3>벽</h3>
      <p className="muted">{wall.verified ? '실측 확인됨' : '추정 치수'}</p>
      <NumberField
        key={`${wall.id}-len`}
        label="길이"
        unit="cm"
        value={Math.round(wallLength(wall))}
        onCommit={(v) => {
          const err = s.resizeWall(wall.id, v);
          if (err) showBanner({ kind: 'error', text: err });
        }}
      />
      <NumberField key={`${wall.id}-t`} label="두께" unit="cm" value={wall.thickness} onCommit={(v) => s.updateWall(wall.id, { thickness: Math.max(1, v) })} />
      <NumberField key={`${wall.id}-h`} label="높이" unit="cm" value={wall.height} onCommit={(v) => s.updateWall(wall.id, { height: Math.max(1, v) })} />
      <CheckboxField label="실측 확인" checked={!!wall.verified} onChange={(v) => s.updateWall(wall.id, { verified: v })} />
      <button type="button" className="danger" onClick={() => s.removeWall(wall.id)}>벽 삭제</button>
    </>
  );
}
```

`src/ui/properties/OpeningProperties.tsx`:
```tsx
import type { Opening } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { CheckboxField, NumberField } from '../fields';
import { useUi } from '../uiStore';

const KINDS: [Opening['kind'], string][] = [
  ['door', '문'],
  ['window', '창'],
  ['opening', '개구부'],
];

export function OpeningProperties({ opening }: { opening: Opening }) {
  const s = usePlanStore().getState();
  const showBanner = useUi((u) => u.showBanner);
  const label = KINDS.find(([k]) => k === opening.kind)?.[1] ?? '개구부';
  const update = (patch: Partial<Omit<Opening, 'id' | 'wallId'>>) => {
    const err = s.updateOpening(opening.id, patch);
    if (err) showBanner({ kind: 'error', text: err });
  };
  return (
    <>
      <h3>{label}</h3>
      <label className="field">
        종류
        <select
          value={opening.kind}
          onChange={(e) => {
            const kind = KINDS.find(([k]) => k === e.target.value)?.[0];
            if (kind) update({ kind });
          }}
        >
          {KINDS.map(([k, name]) => (
            <option key={k} value={k}>{name}</option>
          ))}
        </select>
      </label>
      <NumberField key={`${opening.id}-off`} label="벽 시작점에서 거리" unit="cm" value={opening.offset} onCommit={(v) => update({ offset: v })} />
      <NumberField key={`${opening.id}-w`} label="폭" unit="cm" value={opening.width} onCommit={(v) => update({ width: v })} />
      <NumberField key={`${opening.id}-h`} label="높이" unit="cm" value={opening.height} onCommit={(v) => update({ height: v })} />
      <NumberField key={`${opening.id}-s`} label="창턱 높이" unit="cm" value={opening.sill} onCommit={(v) => update({ sill: v })} />
      {opening.kind === 'door' && (
        <div className="row">
          <button type="button" onClick={() => update({ hinge: opening.hinge === 'start' ? 'end' : 'start' })}>경첩 반대로</button>
          <button type="button" onClick={() => update({ swingIn: !opening.swingIn })}>열림 방향 반대로</button>
        </div>
      )}
      <CheckboxField label="실측 확인" checked={!!opening.verified} onChange={(v) => update({ verified: v })} />
      <button type="button" className="danger" onClick={() => s.removeOpening(opening.id)}>{label} 삭제</button>
    </>
  );
}
```

`src/ui/properties/RoomProperties.tsx`:
```tsx
import type { Room } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { NumberField, TextField } from '../fields';

export function RoomProperties({ room }: { room: Room }) {
  const s = usePlanStore().getState();
  return (
    <>
      <h3>방 이름</h3>
      <TextField key={`${room.id}-name`} label="이름" value={room.name} onCommit={(name) => s.updateRoom(room.id, { name })} />
      <NumberField key={`${room.id}-x`} label="X" unit="cm" value={room.label.x} onCommit={(x) => s.updateRoom(room.id, { label: { ...room.label, x } })} />
      <NumberField key={`${room.id}-y`} label="Y" unit="cm" value={room.label.y} onCommit={(y) => s.updateRoom(room.id, { label: { ...room.label, y } })} />
      <button type="button" className="danger" onClick={() => s.removeRoom(room.id)}>방 이름 삭제</button>
    </>
  );
}
```

`src/ui/PropertiesPanel.tsx` 전체 교체:
```tsx
import { findEntity } from '../model/entities';
import { usePlan } from '../model/StoreContext';
import { ItemProperties } from './properties/ItemProperties';
import { OpeningProperties } from './properties/OpeningProperties';
import { RoomProperties } from './properties/RoomProperties';
import { WallProperties } from './properties/WallProperties';

export function PropertiesPanel() {
  const plan = usePlan((s) => s.plan);
  const selectedId = usePlan((s) => s.selectedId);
  const entity = findEntity(plan, selectedId);
  return (
    <div className="props" data-testid="properties-panel">
      {!entity && <p className="muted">항목을 선택하세요.</p>}
      {entity?.kind === 'item' && <ItemProperties item={entity.item} />}
      {entity?.kind === 'wall' && <WallProperties wall={entity.wall} />}
      {entity?.kind === 'opening' && <OpeningProperties opening={entity.opening} />}
      {entity?.kind === 'room' && <RoomProperties room={entity.room} />}
    </div>
  );
}
```

`src/styles.css` 끝에 추가:
```css
.props .field select { padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; font-size: 13px; }
.check { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 8px; }
.props label.check { flex-direction: row; }
```

- [ ] **Step 4: 통과와 브라우저 확인**

Run: `npx vitest run src/ui && npm run typecheck && npm test && npm run e2e`
Expected: PASS, 기존 E2E 3 passed(첫 테스트의 `properties-panel`에 제품 이름이 들어간다)

브라우저 확인(일회용 Playwright 스크립트, scratchpad):
1. 구조 모드에서 벽 클릭 → 속성창 `벽`, 길이 입력을 바꾸면 벽과 연결된 벽이 함께 바뀌고 치수 표시가 갱신, `실측 확인` 체크 → 2D 치수가 `≈` 없이 표시
2. 문 클릭 → `벽 시작점에서 거리`에 벽 밖 값을 넣으면 오류 배너(허용 범위 포함)가 뜨고 입력칸이 원래 값으로 돌아감, `열림 방향 반대로` → 부채꼴 방향이 바뀜
3. 방 이름 클릭 → 이름을 바꾸면 2D 표시가 바뀜
4. 가구 `잠금` 체크 → X/Y/회전 입력 비활성, 드래그·방향키·R로 움직이지 않음
5. 모든 숫자 입력 옆에 단위가 보임
6. `pageerror` 없음

- [ ] **Step 5: Commit**

```bash
git add src/ui/fields.tsx src/ui/properties src/ui/PropertiesPanel.tsx src/ui/shortcuts.ts src/ui/shortcuts.test.ts src/styles.css
git commit -m "feat: properties for walls, openings, room labels and item lock/verified with unit labels"
```

---

### Task 12: 3D 보강(시점 맞춤·초기화, 잠금·스냅 토글, 겹친 물체 후보)

**Files:**
- Create: `src/scene3d/CameraRig.tsx`
- Modify: `src/scene3d/Viewport.tsx` (전체 교체), `src/scene3d/Items3D.tsx` (전체 교체)

**Interfaces:**
- Consumes: `fitTop`, `fitPerspective`, `fitTopZoom`, `itemIdsFromIntersections` (Task 4), `planBounds` (계획 1), `useUi` `view`·`viewResetKey`·`snap`·`showCandidates`·`clearCandidates` (Task 7), 스토어 잠금 처리(Task 5)
- Produces:
  - `<CameraRig />` — 3D를 열 때·보기를 바꿀 때·`시점 초기화`를 누를 때 평면 전체가 보이게 카메라와 OrbitControls target을 맞춘다(탑뷰는 정투영 줌을 화면 크기에 맞춤). 창 크기 변경으로는 다시 맞추지 않는다
  - 3D 가구: 잠긴 가구는 끌어도 움직이지 않고, 스냅 꺼짐이면 벽 밀착을 하지 않는다. 움직이지 않고 클릭했는데 광선에 가구가 2개 이상 걸리면 후보 목록
  - 3D 빈 곳 클릭 시 선택 해제와 후보 목록 닫기

- [ ] **Step 1: 구현**

`src/scene3d/CameraRig.tsx`:
```tsx
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import { planBounds } from '../geometry/bounds';
import { usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { fitPerspective, fitTop, fitTopZoom } from './cameraFit';

type OrbitLike = { target: THREE.Vector3; update(): void };

const isOrbit = (c: unknown): c is OrbitLike => typeof c === 'object' && c !== null && 'target' in c && 'update' in c;

export function CameraRig() {
  const store = usePlanStore();
  const camera = useThree((s) => s.camera);
  const controls = useThree((s) => s.controls);
  const width = useThree((s) => s.size.width);
  const height = useThree((s) => s.size.height);
  const view = useUi((s) => s.view);
  const resetKey = useUi((s) => s.viewResetKey);

  useEffect(() => {
    const b = planBounds({ walls: store.getState().plan.walls });
    const fit = view === 'top' ? fitTop(b) : fitPerspective(b);
    camera.position.set(...fit.position);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = fitTopZoom(b, width, height);
      camera.updateProjectionMatrix();
    }
    camera.lookAt(...fit.target);
    if (isOrbit(controls)) {
      controls.target.set(...fit.target);
      controls.update();
    }
    // 창 크기(width, height)는 일부러 의존성에서 뺀다: 크기가 바뀔 때마다 사용자가 옮긴 시점을 덮어쓰지 않도록
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, camera, controls, view, resetKey]);

  return null;
}
```

`src/scene3d/Viewport.tsx` 전체 교체:
```tsx
import { OrbitControls, OrthographicCamera, PerspectiveCamera } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { useState, type DragEvent } from 'react';
import { usePlanStore } from '../model/StoreContext';
import { DND_MIME } from '../ui/dnd';
import { useUi } from '../ui/uiStore';
import { CameraRig } from './CameraRig';
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
  const view = useUi((s) => s.view);
  const dragging = useUi((s) => s.dragging);
  const [webgl] = useState(hasWebGL);

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
      <Canvas
        dpr={[1, 2]}
        gl={{ preserveDrawingBuffer: true }}
        onPointerMissed={() => {
          store.getState().select(null);
          useUi.getState().clearCandidates();
        }}
      >
        {view === 'top' ? (
          <OrthographicCamera makeDefault near={0.1} far={200} />
        ) : (
          <PerspectiveCamera makeDefault fov={50} near={0.1} far={500} />
        )}
        <OrbitControls makeDefault enabled={!dragging} enableRotate={view === 'persp'} />
        <CameraRig />
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

`src/scene3d/Items3D.tsx` 전체 교체:
```tsx
import type { ThreeEvent } from '@react-three/fiber';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { buildProduct, disposeObject, mountHeightCm } from '../catalog/builders';
import { findProduct } from '../catalog/products';
import { deg2rad, itemObb } from '../geometry/obb';
import { snapToWalls } from '../geometry/snap';
import { planWallObbs } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Item, Product } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { cmToM, mToCm } from '../model/units';
import { useUi } from '../ui/uiStore';
import { itemIdsFromIntersections } from './pick3d';
import { FLOOR_PLANE } from './units';

const MISSING = '#9aa0a6';
const CLICK_SLOP_PX = 3;

type Grab = { dx: number; dy: number; startX: number; startY: number; moved: boolean; locked: boolean };

function ItemMesh({ item, product }: { item: Item; product: Product | undefined }) {
  const store = usePlanStore();
  const setDragging = useUi((s) => s.setDragging);
  const grab = useRef<Grab | null>(null);
  const object = useMemo(() => (product ? buildProduct(product, item.variantId) : null), [product, item.variantId]);
  useEffect(() => () => {
    if (object) disposeObject(object);
  }, [object]);

  const floorPoint = (e: ThreeEvent<PointerEvent>) => {
    const p = new THREE.Vector3();
    return e.ray.intersectPlane(FLOOR_PLANE, p) ? { x: mToCm(p.x), y: mToCm(p.z) } : null;
  };

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    store.getState().select(item.id);
    useUi.getState().clearCandidates();
    const p = floorPoint(e);
    if (!p) return;
    grab.current = {
      dx: item.x - p.x,
      dy: item.y - p.y,
      startX: e.nativeEvent.clientX,
      startY: e.nativeEvent.clientY,
      moved: false,
      locked: !!item.locked,
    };
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    if (!item.locked) {
      store.getState().beginDrag();
      setDragging(true);
    }
  };

  const finishDrag = () => {
    const g = grab.current;
    if (!g) return false;
    grab.current = null;
    if (!g.locked) {
      store.getState().endDrag();
      setDragging(false);
    }
    return true;
  };

  const onPointerMove = (e: ThreeEvent<PointerEvent>) => {
    const g = grab.current;
    if (!g) return;
    if (!g.locked && store.getState().dragOrigin === null) {
      finishDrag();
      return;
    }
    e.stopPropagation();
    if (!g.moved && Math.hypot(e.nativeEvent.clientX - g.startX, e.nativeEvent.clientY - g.startY) > CLICK_SLOP_PX) g.moved = true;
    if (!g.moved || g.locked) return;
    const p = floorPoint(e);
    if (!p) return;
    const dims = product?.dims ?? { w: 50, d: 50 };
    const x = p.x + g.dx;
    const y = p.y + g.dy;
    const target = useUi.getState().snap
      ? snapToWalls(itemObb(x, y, item.rotation, dims.w, dims.d), planWallObbs(store.getState().plan))
      : { cx: x, cy: y };
    store.getState().dragItem(item.id, target.cx, target.cy);
  };

  const onPointerUp = (e: ThreeEvent<PointerEvent>) => {
    const wasClick = grab.current !== null && !grab.current.moved;
    if (finishDrag()) (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    if (!wasClick) return;
    const ids = itemIdsFromIntersections(e.intersections);
    if (ids.length > 1) useUi.getState().showCandidates({ ids, clientX: e.nativeEvent.clientX, clientY: e.nativeEvent.clientY });
  };

  useEffect(() => () => {
    finishDrag();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const y = product ? cmToM(mountHeightCm(product)) : 0;
  return (
    <group
      position={[cmToM(item.x), y, cmToM(item.y)]}
      rotation={[0, -deg2rad(item.rotation), 0]}
      userData={{ itemId: item.id }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={finishDrag}
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
      {activeItems(plan).map((item) => (
        <ItemMesh key={item.id} item={item} product={findProduct(plan, item.productId)} />
      ))}
    </group>
  );
}
```

- [ ] **Step 2: 검증**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: 오류 없음, 전체 PASS, 기존 E2E 3 passed

브라우저 확인(일회용 Playwright 스크립트, scratchpad):
1. `private/our-home.local.json`을 `JSON 열기`로 열고 `3D 탑뷰` → 발코니(x 0–150)까지 평면 전체가 화면에 들어온다(스크린샷 Read). `3D`로 바꿔도 전체가 보인다
2. 탑뷰에서 화면을 옮긴 뒤 `시점 초기화` → 다시 전체로
3. 가구 `잠금` 후 3D에서 끌어도 위치 그대로
4. 같은 자리에 가구 2개 → 3D에서 움직이지 않고 클릭 → `candidates` 목록
5. `스냅 꺼짐`에서 벽 근처로 끌면 붙지 않는다
6. `pageerror` 없음

- [ ] **Step 3: Commit**

```bash
git add src/scene3d/CameraRig.tsx src/scene3d/Viewport.tsx src/scene3d/Items3D.tsx
git commit -m "feat: 3D camera fit and reset, item lock, snap toggle and overlap candidates"
```

---

### Task 13: E2E(2D 편집 흐름)

**Files:**
- Create: `e2e/editor2d.spec.ts`

**Interfaces:**
- Consumes: Task 7–12의 버튼 이름, 라벨, 테스트 id(`editor2d`, `item2d-<id>`, `wall-<id>`, `open-background`, `background-image`, `scale-info`, `candidates`, `save-status`, `properties-panel`, `catalog-card-<id>`), `window.__homefit`

- [ ] **Step 1: 테스트 작성**

`e2e/editor2d.spec.ts`:
```ts
import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const selectedId = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().selectedId);

async function planToClient(page: Page, p: P): Promise<P> {
  return page.evaluate(({ x, y }) => {
    const svg = document.querySelector<SVGSVGElement>('[data-testid="editor2d"]')!;
    const pt = new DOMPoint(x, y).matrixTransform(svg.getScreenCTM()!);
    return { x: pt.x, y: pt.y };
  }, p);
}

async function clickPlan(page: Page, p: P) {
  const c = await planToClient(page, p);
  await page.mouse.click(c.x, c.y);
}

async function dragBy(page: Page, from: P, dx: number) {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y, { steps: 6 });
  await page.mouse.up();
}

async function centerOf(page: Page, testId: string): Promise<P> {
  const b = (await page.getByTestId(testId).boundingBox())!;
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('구조 모드에서 방을 만들고 문을 달면 내측 치수가 유지된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  await expect(page.getByTestId('editor2d')).toBeVisible();
  await page.getByRole('button', { name: '방 만들기' }).click();
  await page.getByLabel('이름').fill('서재');
  await page.getByLabel('내측 가로 W').fill('400');
  await page.getByLabel('내측 세로 D').fill('300');
  await page.getByLabel('벽 두께').fill('15');
  await clickPlan(page, { x: 100, y: 100 });

  const plan = await getPlan(page);
  const walls = plan.walls.slice(-4);
  const xs = walls.flatMap((w) => [w.a.x, w.b.x]);
  const ys = walls.flatMap((w) => [w.a.y, w.b.y]);
  expect(Math.max(...xs) - Math.min(...xs) - 15).toBe(400);
  expect(Math.max(...ys) - Math.min(...ys) - 15).toBe(300);
  expect(plan.rooms.some((r) => r.name === '서재')).toBe(true);

  const topWallY = Math.min(...ys);
  await page.getByRole('button', { name: '문', exact: true }).click();
  await clickPlan(page, { x: 300, y: topWallY });
  await expect.poll(async () => (await getPlan(page)).openings.length).toBe(plan.openings.length + 1);
  await expect(page.getByTestId('properties-panel').getByRole('heading', { name: '문' })).toBeVisible();

  const door = (await getPlan(page)).openings.at(-1)!;
  await page.getByRole('button', { name: '선택', exact: true }).click();
  await dragBy(page, await centerOf(page, `opening-${door.id}`), 40);
  await expect.poll(async () => (await getPlan(page)).openings.find((o) => o.id === door.id)!.offset).toBeGreaterThan(door.offset);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).openings.find((o) => o.id === door.id)!.offset).toBe(door.offset);
});

test('벽 그리기는 더블클릭으로 끝나고, 끝점 드래그는 연결된 벽과 함께 움직이며 실행 취소 한 번에 돌아간다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  const before = (await getPlan(page)).walls.length;
  await page.getByRole('button', { name: '벽 그리기' }).click();
  await clickPlan(page, { x: 50, y: 100 });
  await clickPlan(page, { x: 250, y: 100 });
  const end = await planToClient(page, { x: 250, y: 300 });
  await page.mouse.dblclick(end.x, end.y);
  await expect.poll(async () => (await getPlan(page)).walls.length).toBe(before + 2);
  const added = (await getPlan(page)).walls.slice(-2);
  expect(added.every((w) => w.a.x !== w.b.x || w.a.y !== w.b.y)).toBe(true);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).walls.length).toBe(before);

  await page.getByRole('button', { name: '선택', exact: true }).click();
  await clickPlan(page, { x: 300, y: 0 });
  expect(await selectedId(page)).toBe('w1');
  const handle = page.locator('.endpoint-handle').nth(1);
  const hb = (await handle.boundingBox())!;
  await dragBy(page, { x: hb.x + hb.width / 2, y: hb.y + hb.height / 2 }, 40);
  const moved = await getPlan(page);
  const w1 = moved.walls.find((w) => w.id === 'w1')!;
  const w2 = moved.walls.find((w) => w.id === 'w2')!;
  expect(w1.b.x).toBeGreaterThan(600);
  expect(w2.a).toEqual(w1.b);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).walls.find((w) => w.id === 'w1')!.b).toEqual({ x: 600, y: 0 });
});

test('배경 도면을 불러와 축척을 보정하고 새로고침 후에도 유지된다', async ({ page }) => {
  await page.getByRole('button', { name: '구조' }).click();
  const png = await page.evaluate(() => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    const g = c.getContext('2d')!;
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, 400, 300);
    g.strokeStyle = '#000000';
    g.lineWidth = 4;
    g.strokeRect(20, 20, 360, 260);
    return c.toDataURL('image/png').split(',')[1];
  });
  await page.getByTestId('open-background').setInputFiles({ name: 'plan.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') });
  await expect(page.getByTestId('background-image')).toBeVisible();
  await expect(page.getByTestId('scale-info')).toContainText('축척 미보정');

  await page.getByRole('button', { name: '축척 보정' }).click();
  await clickPlan(page, { x: 50, y: 150 });
  await clickPlan(page, { x: 250, y: 150 });
  await page.getByLabel('실제 길이').fill('400');
  await page.getByRole('button', { name: '적용' }).click();
  await expect(page.getByTestId('scale-info')).toContainText('축척 1px = 2.00cm');
  await expect(page.getByTestId('save-status')).toContainText('저장됨');

  await page.reload();
  await page.getByRole('button', { name: '구조' }).click();
  await expect(page.getByTestId('background-image')).toBeVisible();
  await expect(page.getByTestId('scale-info')).toContainText('축척 1px = 2.00cm');
});

test('2D 배치에서 드래그·실행 취소·잠금이 동작한다', async ({ page }) => {
  await page.getByRole('button', { name: '2D' }).click();
  const editor = page.getByTestId('editor2d');
  await expect(editor).toBeVisible();
  const box = (await editor.boundingBox())!;
  await page.getByTestId('catalog-card-sofa-3seat').dragTo(page.locator('.editor2d'), {
    sourcePosition: { x: 12, y: 12 },
    targetPosition: { x: box.width / 2, y: box.height / 2 },
  });
  await expect.poll(async () => (await getPlan(page)).items.length).toBe(1);

  const first = (await getPlan(page)).items[0];
  const start = await centerOf(page, `item2d-${first.id}`);
  await dragBy(page, start, 60);
  await expect.poll(async () => (await getPlan(page)).items[0].x).toBeGreaterThan(first.x);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).items[0].x).toBe(first.x);

  await page.getByLabel('잠금').check();
  await dragBy(page, await centerOf(page, `item2d-${first.id}`), 60);
  expect((await getPlan(page)).items[0]).toMatchObject({ x: first.x, y: first.y, locked: true });
});

test('겹친 물체는 클릭하면 후보 목록에서 고른다', async ({ page }) => {
  await page.getByRole('button', { name: '2D' }).click();
  const add = page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' });
  await add.click();
  await add.click();
  const ids = (await getPlan(page)).items.map((i) => i.id);
  expect(ids).toHaveLength(2);
  const c = await centerOf(page, `item2d-${ids[1]}`);
  await page.mouse.click(c.x, c.y);
  const menu = page.getByTestId('candidates');
  await expect(menu.getByRole('menuitem')).toHaveCount(2);
  await menu.getByRole('menuitem').nth(1).click();
  expect(await selectedId(page)).toBe(ids[0]);
  await expect(menu).toBeHidden();
});

test('스냅 토글·저장 상태·3D 시점 초기화', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.getByRole('button', { name: '스냅 켜짐' }).click();
  await expect(page.getByRole('button', { name: '스냅 꺼짐' })).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('save-status')).toHaveText('변경 없음');
  await page.getByTestId('catalog-card-sofa-3seat').getByRole('button', { name: '추가' }).click();
  await expect(page.getByTestId('save-status')).toContainText('저장됨');
  await page.getByRole('button', { name: '3D 탑뷰' }).click();
  await page.getByRole('button', { name: '시점 초기화' }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: 실행**

Run: `npm run e2e`
Expected: 기존 3개 + 새 6개 = 9 passed. 실패하면 앱 코드의 실제 원인(좌표 변환, 포커스, 포인터 캡처 등)을 진단해 보고한다. 테스트를 store 직접 호출로 바꾸거나 기대값을 느슨하게 하지 않는다.

- [ ] **Step 3: Commit**

```bash
git add e2e/editor2d.spec.ts
git commit -m "test: e2e for 2D structure editing, background calibration, 2D placement and overlap picker"
```

---

## 완료 기준

- `npm run typecheck && npm test && npm run e2e` 모두 통과
- 각 Task의 브라우저 확인 항목을 실제로 실행해 결과(스크린샷 경로 포함)를 기록
- `git ls-files | grep -E 'private|naver|our-home'`에 `src/persistence/privatePlan.test.ts` 외에 결과 없음
- 우리 집 프리셋(`private/our-home.local.json`)을 2D 구조 모드로 열어 네이버 평면도 이미지를 배경으로 깔고 축척 보정 → 벽과 이미지가 겹쳐 보이는지 탐색 QA로 확인(문 위치 보정은 사용자 작업)
