# homefit 계획 4: 전기 계획 + 체크리스트 + 업체용 PDF Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 전기 모드(콘센트·스위치·조명 마커, 전용회로 경고), 체크리스트 모드(공정별 기본 항목 + plan 기반 자동 항목), 내보내기 모드(기본 정보 입력 + A4 가로 업체용 PDF)를 추가한다.

**Architecture:** 전기 설비는 이미 스키마에 있는 `plan.fixtures`(모든 배치안 공유)에 저장하고, 2D 편집기 위에 마커로 그린다. 체크리스트는 `checklist/`의 순수 함수가 기본 항목과 자동 항목을 만들고 체크 상태만 `plan.checklist`에 저장한다. PDF는 `export/pages.ts`(순수: plan → 페이지 데이터, 줄바꿈·쪽 나눔 포함)와 `export/pdf.ts`(jsPDF + svg2pdf.js 렌더러, 지연 로드)로 나누고, 도면은 `planSvg`에 옵션을 더해 재사용한다. PDF는 항상 **활성 배치안** 기준이며 머리글·표지에 배치안 이름을 넣는다.

**Tech Stack:** Vite 8, TypeScript ~5.9, React 19, R3F 9, zustand 5, zod 4, Vitest 5, Playwright 1.63. 새 의존성: `jspdf@^4.2.1`, `svg2pdf.js@^2.8.1`, `pretendard@^1.3.9`(글꼴 파일).

**Spec:** `docs/superpowers/specs/2026-10-08-homefit-design.md` (§6 전기·체크리스트·내보내기 모드, §8 체크리스트, §9 PDF, §10 에러 처리, §11 테스트, §14.3 범위 밖, §14.5-4). 사용자 설계서 사본: `docs/references/2026-10-08-planner5d-research-design.md`.

## Global Constraints

- 저장 단위는 정수 cm, 3D는 1 unit = 1 m. cm↔m 변환은 `src/model/units.ts`(`cmToM`/`mToCm`)로만 한다.
- 아이템은 `activeItems` / `withActiveItems` / `activeLayout`으로만 읽고 쓴다(스펙 §14.4). 구조·전기 설비·체크리스트 상태는 모든 배치안이 공유한다.
- 새 의존성은 `jspdf`, `svg2pdf.js`, `pretendard` 세 개뿐이다(스펙 §2 "jsPDF + svg2pdf.js", §9 "Pretendard"). 그 밖의 런타임·개발 의존성을 추가하지 않는다.
- 한글 글꼴(Pretendard)은 PDF를 만들 때만 지연 로드한다(스펙 §9). `jspdf`·`svg2pdf.js`도 동적 `import()`로만 불러온다.
- 페이지 구성(`export/pages.ts`)은 plan을 받아 페이지 데이터 배열을 반환하는 순수 함수이고 렌더러와 분리한다(스펙 §9).
- PDF 페이지 선택 기능은 만들지 않는다(스펙 §14.3이 §6보다 우선). 항상 전체 페이지를 넣는다.
- 체크리스트 기본 문구는 새로 쓴 문구만 쓴다. 참고 가이드(@gorane_home)의 문구를 옮기지 않는다(스펙 §8). 이 계획 Task 3의 문구를 그대로 쓴다.
- 도면 SVG를 PDF에 넣을 때 `font-family`는 `Pretendard`(jsPDF에 normal/bold로 등록한 이름)여야 한다. `sans-serif`는 svg2pdf에서 Helvetica로 바뀌어 한글이 깨진다(스파이크 확인).
- svg2pdf는 `paint-order`를 지원하지 않는다(스파이크 확인). 글자 흰 테두리는 같은 글자를 흰 stroke로 한 번, 본 글자로 한 번 그리는 두 겹 `<text>`로 만든다.
- 내보내는 PNG·PDF에 배경 평면도 이미지를 넣지 않는다. repo·번들에 주소·단지명·네이버 URL·평면도 이미지·우리 집 프리셋을 넣지 않는다(`private/`만).
- 2D 에디터·3D 뷰 항상 마운트 구조(`.layer`/`.layer-hidden`, `<Viewport active>`)를 유지한다. 체크리스트·내보내기 모드에서도 둘 다 마운트된 채 숨긴다.
- `git add -A` / `git add .` 금지. 각 Task의 Commit 단계에 적힌 경로만 add 한다. `private/`, `handoff/`, `archive/`, `.superpowers/`, `playwright-report/`, `test-results/`, 루트의 `Planner 5D …md`는 add 하지 않는다.
- 테스트 기대값을 바꿔 통과시키거나 store 직접 호출로 실제 사용자 동작 검증을 대체하지 않는다. 이 계획이 명시한 기존 테스트 수정(Task 4의 halo 단언)만 허용한다.
- 화면 문구는 한국어, 숫자 입력 옆에 단위(cm, m², 년)를 표시한다.

## Review Focus

1. **PDF 도면의 한글**: svg2pdf에 넘기는 모든 도면 SVG가 `font-family="Pretendard"`이고 `sans-serif`가 없어야 한다. 그렇지 않으면 업체가 받는 도면의 방 이름·제품 이름이 깨진다 → Task 5 `pages.test.ts` "도면 SVG는 Pretendard만 쓴다".
2. **글꼴 다운로드 실패**: 네트워크 문제로 글꼴을 못 받으면 오류 안내와 "다시 시도"가 보이고, 새로고침 없이 다시 시도하면 PDF가 만들어져야 한다(실패한 로드를 캐시하지 않음) → Task 6 `pdfFont.test.ts` + Task 7 e2e "글꼴을 못 받으면 안내하고, 다시 시도하면 만든다".
3. **긴 목록과 긴 메모**: 체크리스트 항목·제품이 많거나 메모가 아주 길어도 표가 쪽 밖으로 넘치지 않고 다음 쪽으로 이어지며 행이 빠지거나 중복되지 않아야 한다 → Task 5 `pages.test.ts` "제품이 많으면 여러 쪽으로 나누고 행을 잃지 않는다", "아주 긴 메모는 칸 높이 안에서 자르고 …으로 끝낸다".
4. **설비가 붙은 벽 삭제·가전 이동**: 벽을 지우면 그 벽에 붙은 설비는 남되 `wallId`가 지워지고, 가전·설비를 옮기면 전용회로 경고가 즉시 다시 계산돼야 한다 → Task 1 `store.test.ts` "벽을 지우면 붙어 있던 설비의 wallId를 지운다", `fixtures.test.ts` 전용회로 거리 테스트.
5. **어떤 배치안을 설명하는 PDF인가**: 배치안이 여러 개일 때 PDF의 배치도·제품 목록은 활성 배치안의 가구만 담고, 머리글·제목에 그 배치안 이름이 있어야 한다 → Task 5 `pages.test.ts` "활성 배치안만 담고 이름을 밝힌다".

## 스파이크 결과(2026-10-08, 계획 작성 중 확인)

`jspdf@4.2.1` + `svg2pdf.js@2.8.1` + `pretendard@1.3.9`(`dist/public/static/alternative/Pretendard-{Regular,Bold}.ttf`, 각 약 2.7MB)를 Chromium에서 시험했다.
- `addFileToVFS` + `addFont(file, 'Pretendard', 'normal' | 'bold')` 후 `doc.text`와 svg2pdf `<text font-family="Pretendard">` 모두 한글·`≈`·`×`·`·`가 정상 출력된다. 굵게(`font-weight="bold"`)도 된다. 결과 PDF는 글꼴 부분 포함으로 약 0.6MB.
- `font-family="sans-serif"`는 한글이 깨진다.
- `paint-order="stroke"`는 무시돼 흰 stroke가 글자를 덮는다. 두 겹 `<text>`로 해결된다.
- `dominant-baseline="middle"`은 대체로 맞게 나온다.
- svg2pdf에 넘길 SVG 요소는 문서에 붙어 있어야 안전하다(스파이크는 `document.body`에 붙였다가 뗐다).
- jsPDF 기본 출력은 압축하지 않아 PDF 본문에서 `/Type /Page`, `/Subtype /Image`를 셀 수 있다(e2e에서 사용).

## File Structure

| File | 책임 |
|---|---|
| `src/electrical/fixtures.ts` (new) | 설비 종류·이름·기본 높이·마커 모양, 벽 스냅, 전용회로 경고, 설비 요약 문구(순수) |
| `src/model/schema.ts` | `ChecklistState`, `PlanInfo` 타입 export 추가 |
| `src/model/store.ts` | 설비 추가/수정/드래그/삭제, 벽 삭제 시 설비 `wallId` 정리, 체크리스트 상태, 기본 정보 수정 |
| `src/model/entities.ts` | 선택 대상에 `fixture` 추가 |
| `src/ui/modes.ts` (new) | 모드 목록·모드별 선택 가능 대상·2D 표시 여부·페이지 모드 판단 |
| `src/ui/uiStore.ts` | `Mode`에 `electric`·`checklist`·`export`, `Tool`에 `fixture`, `fixtureKind` |
| `src/editor2d/Fixtures2D.tsx` (new) | 2D 설비 마커 그리기·선택·드래그 |
| `src/ui/ElectricPanel.tsx` (new) | 전기 모드 좌측 패널(도구, 요약, 전용회로 가전 목록) |
| `src/ui/properties/FixtureProperties.tsx` (new) | 설비 속성(종류, X/Y, 설치 높이, 메모, 삭제) |
| `src/checklist/defaults.ts` (new) | 공정 목록과 기본 항목(새 문구) |
| `src/checklist/items.ts` (new) | 자동 항목 생성, 전체 목록, 상태 조회(순수) |
| `src/geometry/wallReference.ts` (new) | "벽 기준 위치" 문구(왼쪽/오른쪽/뒤 벽까지 거리) |
| `src/ui/ChecklistView.tsx` (new) | 체크리스트 모드 화면 |
| `src/export/planSvg.ts` | 옵션(`fontFamily`, `header`, `items`, `dimensions`, `fixtures`, `highlightIds`), 두 겹 글자 테두리, 설비 마커·범례, `itemNumbers`, `pdfFileName` |
| `src/export/pages.ts` (new) | PDF 페이지 데이터(순수): 표지, 도면 3장, 빌트인 상세, 제품 목록, 3D 보기, 체크리스트 + 줄바꿈·쪽 나눔 |
| `src/export/pdfFont.ts` (new) | Pretendard TTF 지연 로드(base64), 실패 시 캐시 해제 |
| `src/export/pdf.ts` (new) | jsPDF + svg2pdf 렌더러(동적 import 대상) |
| `src/export/exportPdf.ts` (new) | 3D 캡처 → 페이지 구성 → 렌더 오케스트레이션 |
| `src/scene3d/cameraFit.ts` | PDF용 3D 시점 3개(`pdfViewPoses`) |
| `src/scene3d/CaptureBridge.tsx` | 고정 크기·지정 시점 캡처(`captureViews`) |
| `src/ui/ExportView.tsx` (new) | 내보내기 모드 화면(기본 정보, 기준 배치안, PDF 내려받기, 진행률, 다시 시도) |
| `src/ui/fields.tsx` | `OptionalNumberField`, `TextAreaField` |
| `src/App.tsx`, `src/ui/Toolbar.tsx`, `src/ui/PropertiesPanel.tsx`, `src/ui/shortcuts.ts`, `src/editor2d/Editor2D.tsx`, `src/editor2d/Items2D.tsx`, `src/editor2d/tools.ts`, `src/ui/properties/ItemProperties.tsx`, `src/styles.css` | 모드 연결, 설비 단축키, 전용회로 배지 |
| `e2e/electrical.spec.ts`, `e2e/checklist.spec.ts`, `e2e/pdf.spec.ts` (new) | E2E |

## 이 계획에서 정한 것(Rulings)

- 전기 설비 마커는 2D에만 그린다(스펙 §4 "editor2d: … 전기 마커"). 3D에는 그리지 않는다.
- 전용회로 경고 거리는 아이템 **중심**에서 전용회로 콘센트 중심까지의 직선거리 ≤ 150cm로 판단한다.
- 설비 벽 스냅: 벽 중심선까지 30cm 이내면 클릭한 쪽 벽면(중심선에서 두께/2)에 붙이고 `wallId`를 기록한다. 조명은 스냅하지 않는다. 툴바의 스냅을 끄면 클릭한 자리에 둔다.
- 체크리스트 자동 항목은 활성 배치안의 가구로 만든다. 문 열림 간섭 자동 항목은 `clearanceBlocked` 또는 `blocksDoor`인 가구에 만든다.
- 체크리스트 상태는 체크도 메모도 없으면 `plan.checklist`에서 지운다(파일을 작게 유지).
- PDF 쪽 구성: 표지 → 치수 평면도 → 가구·가전 배치도 → 전기 계획도 → 빌트인 상세 → 제품 목록 → 3D 보기 → 공사 체크리스트. 표는 넘치면 "(계속)" 쪽으로 이어진다. 3D 보기는 3장(위에서 본 전체, 오른쪽 앞, 왼쪽 뒤).
- 3D를 캡처할 수 없으면(WebGL 없음) 3D 보기 쪽에 안내 문구만 넣고 PDF는 계속 만든다.
- 체크리스트·내보내기 모드에서는 좌·우 패널 없이 가운데 화면을 넓게 쓰고, 선택을 해제한다.
- 치수 평면도는 계획 3 PNG와 같은 방식(벽 길이 라벨, 개구부 폭 라벨, 축척대로 그린 문·창 위치, 방 이름)으로 표현한다. 별도 치수선(화살표 보조선)과 개구부 위치 숫자는 넣지 않는다 — 도면이 축척대로라 위치는 그림으로 전달되고, 숫자를 더하면 좁은 평면에서 글자가 겹친다. 실제 PDF를 보고 부족하면 계획 5에서 보강한다.
- Pretendard 글꼴 라이선스(OFL-1.1) 고지 파일은 배포를 다루는 계획 5에서 추가한다(이 계획은 배포하지 않음).

---
### Task 1: 전기 설비 모델(순수 함수 + 스토어)

**Files:**
- Create: `src/electrical/fixtures.ts`, `src/electrical/fixtures.test.ts`
- Modify: `src/model/schema.ts`, `src/model/store.ts`, `src/model/entities.ts`, `src/ui/shortcuts.ts`
- Test: `src/model/store.test.ts`, `src/model/entities.test.ts`, `src/ui/shortcuts.test.ts`

**Interfaces:**
- Consumes: `nearestWall(walls, p, maxDist)` (`src/geometry/structure.ts`), `wallDir`, `wallLength` (`src/geometry/walls.ts`), `activeItems` (`src/model/layout.ts`), `Fixture` 스키마(이미 있음).
- Produces:
  - `type FixtureKind = Fixture['kind']`
  - `FIXTURE_KINDS: FixtureKind[]`, `FIXTURE_LABEL: Record<FixtureKind, string>`, `FIXTURE_DEFAULT_HEIGHT: Record<FixtureKind, number>`
  - `type FixtureGlyph = { shape: 'circle' | 'square'; fill: string; stroke: string; letter: string; letterFill: string }`, `FIXTURE_GLYPH: Record<FixtureKind, FixtureGlyph>`
  - `FIXTURE_R_CM = 9`, `FIXTURE_SNAP_CM = 30`, `DEDICATED_RADIUS_CM = 150`
  - `snapFixture(walls: Wall[], p: Vec2, kind: FixtureKind, snap: boolean): { pos: Vec2; wallId?: string }`
  - `missingDedicatedCircuit(plan: Plan, resolve: (productId: string) => Product | undefined): string[]` — 활성 배치안 아이템 id
  - `fixtureSummary(fixtures: Fixture[]): string` — 예: `"콘센트 2개, 전용회로 콘센트 1개"`
  - store: `addFixture(f: Omit<Fixture, 'id'>): string`, `updateFixture(id, patch: Partial<Omit<Fixture, 'id'>>): void`, `dragFixture(id, pos: Vec2, wallId?: string): void`, `removeFixture(id): void`
  - `Entity`에 `{ kind: 'fixture'; fixture: Fixture }`
  - schema: `export type ChecklistState`, `export type PlanInfo`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/electrical/fixtures.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Fixture, Plan } from '../model/schema';
import { DEDICATED_RADIUS_CM, fixtureSummary, missingDedicatedCircuit, snapFixture } from './fixtures';

const walls = SAMPLE_PLAN.walls;
const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
const fixture = (kind: Fixture['kind'], x: number, y: number): Fixture => ({ id: `f-${kind}-${x}`, kind, pos: { x, y }, height: 30 });
const withFixtures = (plan: Plan, fixtures: Fixture[]): Plan => ({ ...plan, fixtures });
const resolve = (plan: Plan) => (id: string) => findProduct(plan, id);

describe('snapFixture', () => {
  it('벽 중심선 30cm 이내면 클릭한 쪽 벽면에 붙이고 wallId를 남긴다', () => {
    expect(snapFixture(walls, { x: 100, y: 25 }, 'outlet', true)).toEqual({ pos: { x: 100, y: 10 }, wallId: 'w1' });
    expect(snapFixture(walls, { x: 100, y: -25 }, 'outlet', true)).toEqual({ pos: { x: 100, y: -10 }, wallId: 'w1' });
    expect(snapFixture(walls, { x: 25, y: 200 }, 'switch', true)).toEqual({ pos: { x: 10, y: 200 }, wallId: 'w4' });
    expect(snapFixture(walls, { x: 360, y: 200 }, 'outlet-dedicated', true)).toEqual({ pos: { x: 356, y: 200 }, wallId: 'w5' });
  });

  it('벽 끝을 넘는 클릭은 벽 끝에 붙인다', () => {
    expect(snapFixture(walls, { x: 615, y: -20 }, 'outlet', true)).toEqual({ pos: { x: 600, y: -10 }, wallId: 'w1' });
  });

  it('스냅을 끄거나, 조명이거나, 벽이 멀면 클릭한 자리(정수 cm)에 둔다', () => {
    expect(snapFixture(walls, { x: 100.4, y: 25.6 }, 'outlet', false)).toEqual({ pos: { x: 100, y: 26 } });
    expect(snapFixture(walls, { x: 100, y: 25 }, 'light', true)).toEqual({ pos: { x: 100, y: 25 } });
    expect(snapFixture(walls, { x: 300, y: 200 }, 'outlet', true)).toEqual({ pos: { x: 300, y: 200 } });
  });
});

describe('missingDedicatedCircuit', () => {
  const base = withActiveItems(SAMPLE_PLAN, [washer]);

  it('전용회로 가전 중심 150cm 이내에 전용회로 콘센트가 없으면 경고', () => {
    expect(DEDICATED_RADIUS_CM).toBe(150);
    expect(missingDedicatedCircuit(base, resolve(base))).toEqual(['wa']);
  });

  it('150cm 이내 전용회로 콘센트가 있으면 경고하지 않는다', () => {
    const plan = withFixtures(base, [fixture('outlet-dedicated', 356, 200)]);
    expect(missingDedicatedCircuit(plan, resolve(plan))).toEqual([]);
    const edge = withFixtures(base, [fixture('outlet-dedicated', 450, 200)]);
    expect(missingDedicatedCircuit(edge, resolve(edge))).toEqual([]);
  });

  it('150cm를 넘거나 일반 콘센트뿐이면 경고', () => {
    const far = withFixtures(base, [fixture('outlet-dedicated', 451, 200)]);
    expect(missingDedicatedCircuit(far, resolve(far))).toEqual(['wa']);
    const normal = withFixtures(base, [fixture('outlet', 310, 200)]);
    expect(missingDedicatedCircuit(normal, resolve(normal))).toEqual(['wa']);
  });

  it('전용회로가 필요 없는 가구와 다른 배치안의 가전은 보지 않는다', () => {
    const sofa = { id: 'so', productId: 'sofa-3seat', variantId: 'gray', x: 100, y: 100, rotation: 0 };
    const plan: Plan = {
      ...SAMPLE_PLAN,
      layouts: [
        { id: 'layout-a', name: 'A안', items: [sofa] },
        { id: 'layout-b', name: 'B안', items: [washer] },
      ],
      activeLayoutId: 'layout-a',
    };
    expect(missingDedicatedCircuit(plan, resolve(plan))).toEqual([]);
  });
});

describe('fixtureSummary', () => {
  it('종류별 개수를 정해진 순서로, 없는 종류는 빼고', () => {
    expect(fixtureSummary([fixture('light', 1, 1), fixture('outlet', 2, 2), fixture('outlet', 3, 3)])).toBe('콘센트 2개, 조명 1개');
    expect(fixtureSummary([])).toBe('');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/electrical/fixtures.test.ts`
Expected: FAIL — `Cannot find module './fixtures'`

- [ ] **Step 3: 구현** — `src/electrical/fixtures.ts`

```ts
import { nearestWall } from '../geometry/structure';
import { wallDir, wallLength } from '../geometry/walls';
import { activeItems } from '../model/layout';
import type { Fixture, Plan, Product, Vec2, Wall } from '../model/schema';

export type FixtureKind = Fixture['kind'];

export const FIXTURE_KINDS: FixtureKind[] = ['outlet', 'outlet-dedicated', 'outlet-waterproof', 'switch', 'light'];

export const FIXTURE_LABEL: Record<FixtureKind, string> = {
  outlet: '콘센트',
  'outlet-dedicated': '전용회로 콘센트',
  'outlet-waterproof': '방수 콘센트',
  switch: '스위치',
  light: '조명',
};

// 설치 높이 기본값(cm, 바닥 기준). 조명은 천장(기본 벽 높이)
export const FIXTURE_DEFAULT_HEIGHT: Record<FixtureKind, number> = {
  outlet: 30,
  'outlet-dedicated': 30,
  'outlet-waterproof': 120,
  switch: 120,
  light: 230,
};

export type FixtureGlyph = { shape: 'circle' | 'square'; fill: string; stroke: string; letter: string; letterFill: string };

export const FIXTURE_GLYPH: Record<FixtureKind, FixtureGlyph> = {
  outlet: { shape: 'circle', fill: '#ffffff', stroke: '#c2410c', letter: 'C', letterFill: '#c2410c' },
  'outlet-dedicated': { shape: 'circle', fill: '#c2410c', stroke: '#c2410c', letter: '전', letterFill: '#ffffff' },
  'outlet-waterproof': { shape: 'circle', fill: '#ffffff', stroke: '#0e7490', letter: '방', letterFill: '#0e7490' },
  switch: { shape: 'square', fill: '#ffffff', stroke: '#4338ca', letter: 'S', letterFill: '#4338ca' },
  light: { shape: 'circle', fill: '#fef3c7', stroke: '#a16207', letter: 'L', letterFill: '#a16207' },
};

export const FIXTURE_R_CM = 9;
export const FIXTURE_SNAP_CM = 30;
export const DEDICATED_RADIUS_CM = 150;

const r0 = (n: number) => Math.round(n) + 0; // -0 방지

export function snapFixture(walls: Wall[], p: Vec2, kind: FixtureKind, snap: boolean): { pos: Vec2; wallId?: string } {
  const free = { pos: { x: r0(p.x), y: r0(p.y) } };
  if (!snap || kind === 'light') return free;
  const wall = nearestWall(walls, p, FIXTURE_SNAP_CM);
  if (!wall) return free;
  const u = wallDir(wall);
  const t = Math.max(0, Math.min(wallLength(wall), (p.x - wall.a.x) * u.x + (p.y - wall.a.y) * u.y));
  const foot = { x: wall.a.x + u.x * t, y: wall.a.y + u.y * t };
  const n = { x: -u.y, y: u.x };
  const side = (p.x - foot.x) * n.x + (p.y - foot.y) * n.y < 0 ? -1 : 1;
  const off = (wall.thickness / 2) * side;
  return { pos: { x: r0(foot.x + n.x * off), y: r0(foot.y + n.y * off) }, wallId: wall.id };
}

export function missingDedicatedCircuit(plan: Plan, resolve: (productId: string) => Product | undefined): string[] {
  const outlets = plan.fixtures.filter((f) => f.kind === 'outlet-dedicated');
  return activeItems(plan)
    .filter((item) => resolve(item.productId)?.power?.dedicatedCircuit)
    .filter((item) => !outlets.some((f) => Math.hypot(f.pos.x - item.x, f.pos.y - item.y) <= DEDICATED_RADIUS_CM))
    .map((item) => item.id);
}

export function fixtureSummary(fixtures: Fixture[]): string {
  return FIXTURE_KINDS.map((k) => [k, fixtures.filter((f) => f.kind === k).length] as const)
    .filter(([, n]) => n > 0)
    .map(([k, n]) => `${FIXTURE_LABEL[k]} ${n}개`)
    .join(', ');
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/electrical/fixtures.test.ts`
Expected: PASS

- [ ] **Step 5: 스토어·엔티티·단축키 테스트 추가**

`src/model/store.test.ts` 끝에 추가:

```ts
describe('전기 설비', () => {
  const outlet = { kind: 'outlet' as const, pos: { x: 100.4, y: 9.6 }, wallId: 'w1', height: 30 };

  it('addFixture는 정수 좌표로 추가하고 선택하며 실행 취소된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addFixture(outlet);
    expect(s.getState().plan.fixtures).toEqual([{ id, kind: 'outlet', pos: { x: 100, y: 10 }, wallId: 'w1', height: 30 }]);
    expect(s.getState().selectedId).toBe(id);
    s.getState().undo();
    expect(s.getState().plan.fixtures).toEqual([]);
  });

  it('updateFixture는 메모를 다듬고 빈 메모는 지우며, 높이는 0 이상 정수', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addFixture(outlet);
    s.getState().updateFixture(id, { memo: '  세탁기용 ', height: 110.6 });
    expect(s.getState().plan.fixtures[0]).toMatchObject({ memo: '세탁기용', height: 111 });
    s.getState().updateFixture(id, { memo: '   ', height: -5 });
    expect(s.getState().plan.fixtures[0]).not.toHaveProperty('memo');
    expect(s.getState().plan.fixtures[0].height).toBe(0);
  });

  it('dragFixture는 드래그 중에만 움직이고 끝나면 실행 취소 한 번으로 돌아간다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addFixture(outlet);
    s.getState().dragFixture(id, { x: 300, y: 300 });
    expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 100, y: 10 });
    s.getState().beginDrag();
    s.getState().dragFixture(id, { x: 150, y: 10 }, 'w1');
    s.getState().dragFixture(id, { x: 200.4, y: 120 });
    s.getState().endDrag();
    expect(s.getState().plan.fixtures[0]).toEqual({ id, kind: 'outlet', pos: { x: 200, y: 120 }, height: 30 });
    s.getState().undo();
    expect(s.getState().plan.fixtures[0].pos).toEqual({ x: 100, y: 10 });
  });

  it('removeFixture는 지우고 선택을 푼다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addFixture(outlet);
    s.getState().removeFixture(id);
    expect(s.getState().plan.fixtures).toEqual([]);
    expect(s.getState().selectedId).toBeNull();
  });

  it('벽을 지우면 붙어 있던 설비의 wallId를 지운다(설비는 남는다)', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    const id = s.getState().addFixture(outlet);
    s.getState().removeWall('w1');
    expect(s.getState().plan.fixtures).toEqual([{ id, kind: 'outlet', pos: { x: 100, y: 10 }, height: 30 }]);
  });
});
```

`src/model/entities.test.ts`의 첫 번째 `it` 안 마지막 줄 뒤에 추가:

```ts
    const withFixture = { ...plan, fixtures: [{ id: 'fx-1', kind: 'switch' as const, pos: { x: 0, y: 0 }, height: 120 }] };
    expect(findEntity(withFixture, 'fx-1')).toEqual({ kind: 'fixture', fixture: withFixture.fixtures[0] });
```

`src/ui/shortcuts.test.ts`의 `describe('구조 단축키', …)` 안에 추가:

```ts
  it('선택한 전기 설비는 Delete로 지운다', () => {
    const store = createPlanStore(SAMPLE_PLAN);
    const id = store.getState().addFixture({ kind: 'light', pos: { x: 100, y: 100 }, height: 230 });
    expect(applyShortcut(store.getState(), { key: 'Delete', shiftKey: false, mod: false })).toBe(true);
    expect(store.getState().plan.fixtures.some((f) => f.id === id)).toBe(false);
    expect(applyShortcut(store.getState(), { key: 'r', shiftKey: false, mod: false })).toBe(false);
  });
```

- [ ] **Step 6: 실패 확인**

Run: `npx vitest run src/model src/ui/shortcuts.test.ts`
Expected: FAIL — `addFixture is not a function` 등

- [ ] **Step 7: 구현**

`src/model/schema.ts` 맨 끝 타입 export 목록에 추가:

```ts
export type ChecklistState = z.infer<typeof ChecklistStateSchema>;
export type PlanInfo = z.infer<typeof PlanInfoSchema>;
```

`src/model/entities.ts`:

```ts
import { activeItems } from './layout';
import type { Fixture, Item, Opening, Plan, Room, Wall } from './schema';

export type Entity =
  | { kind: 'item'; item: Item }
  | { kind: 'wall'; wall: Wall }
  | { kind: 'opening'; opening: Opening }
  | { kind: 'room'; room: Room }
  | { kind: 'fixture'; fixture: Fixture };

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
  const fixture = plan.fixtures.find((f) => f.id === id);
  if (fixture) return { kind: 'fixture', fixture };
  return null;
}
```

`src/model/store.ts`:
- import에 `Fixture` 추가: `import type { Background, Fixture, Item, Layout, Opening, Plan, Product, Room, Vec2, Wall } from './schema';`
- `PlanState` 타입의 `removeRoom` 줄 뒤에 추가:

```ts
  addFixture(fixture: Omit<Fixture, 'id'>): string;
  updateFixture(id: string, patch: Partial<Omit<Fixture, 'id'>>): void;
  dragFixture(id: string, pos: Vec2, wallId?: string): void;
  removeFixture(id: string): void;
```

- `normalizeItem` 함수 아래에 추가:

```ts
function normalizeFixture(f: Fixture): Fixture {
  const next: Fixture = { ...f, pos: roundVec(f.pos), height: Math.max(0, Math.round(f.height)) };
  if (next.wallId === undefined) delete next.wallId;
  const memo = next.memo?.trim();
  if (memo) next.memo = memo;
  else delete next.memo;
  return next;
}
```

- `removeWall` 구현을 다음으로 바꾼다(설비 `wallId` 정리 추가):

```ts
      removeWall: (id) => {
        const plan = get().plan;
        if (!plan.walls.some((w) => w.id === id)) return;
        const gone = new Set([id, ...plan.openings.filter((o) => o.wallId === id).map((o) => o.id)]);
        commit(
          {
            ...plan,
            walls: plan.walls.filter((w) => w.id !== id),
            openings: plan.openings.filter((o) => o.wallId !== id),
            fixtures: plan.fixtures.map((f) => (f.wallId === id ? normalizeFixture({ ...f, wallId: undefined }) : f)),
          },
          { selectedId: deselectIf(gone) },
        );
      },
```

- `removeRoom` 구현 뒤에 추가:

```ts
      addFixture: (fixture) => {
        const created = normalizeFixture({ ...fixture, id: newId('fixture') });
        commit({ ...get().plan, fixtures: [...get().plan.fixtures, created] }, { selectedId: created.id });
        return created.id;
      },

      updateFixture: (id, patch) => {
        const plan = get().plan;
        if (!plan.fixtures.some((f) => f.id === id)) return;
        commit({ ...plan, fixtures: plan.fixtures.map((f) => (f.id === id ? normalizeFixture({ ...f, ...patch }) : f)) });
      },

      dragFixture: (id, pos, wallId) => {
        if (!get().dragOrigin) return;
        const plan = get().plan;
        if (!plan.fixtures.some((f) => f.id === id)) return;
        set({ plan: { ...plan, fixtures: plan.fixtures.map((f) => (f.id === id ? normalizeFixture({ ...f, pos, wallId }) : f)) } });
      },

      removeFixture: (id) => {
        const plan = get().plan;
        if (!plan.fixtures.some((f) => f.id === id)) return;
        commit({ ...plan, fixtures: plan.fixtures.filter((f) => f.id !== id) }, { selectedId: deselectIf(new Set([id])) });
      },
```

`src/ui/shortcuts.ts`의 `if (entity.kind === 'room') { … }` 블록 바로 뒤에 추가:

```ts
  if (entity.kind === 'fixture') {
    if (isDelete) s.removeFixture(entity.fixture.id);
    return isDelete;
  }
```

- [ ] **Step 8: 통과 확인**

Run: `npm run typecheck && npx vitest run`
Expected: typecheck 통과, 전체 PASS

- [ ] **Step 9: Commit**

```bash
git add src/electrical/fixtures.ts src/electrical/fixtures.test.ts src/model/schema.ts src/model/store.ts src/model/store.test.ts src/model/entities.ts src/model/entities.test.ts src/ui/shortcuts.ts src/ui/shortcuts.test.ts
git commit -m "feat: electrical fixture model with wall snap and dedicated-circuit check"
```

---

### Task 2: 전기 모드 화면(2D 마커·도구·속성·경고 배지)

**Files:**
- Create: `src/ui/modes.ts`, `src/ui/modes.test.ts`, `src/editor2d/Fixtures2D.tsx`, `src/ui/ElectricPanel.tsx`, `src/ui/properties/FixtureProperties.tsx`, `e2e/electrical.spec.ts`
- Modify: `src/ui/uiStore.ts`, `src/ui/uiStore.test.ts`, `src/ui/Toolbar.tsx`, `src/App.tsx`, `src/editor2d/Editor2D.tsx`, `src/editor2d/tools.ts`, `src/editor2d/Items2D.tsx`, `src/ui/PropertiesPanel.tsx`, `src/ui/properties/ItemProperties.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 1의 `FIXTURE_*`, `snapFixture`, `missingDedicatedCircuit`, `fixtureSummary`, `DEDICATED_RADIUS_CM`, store `addFixture`/`updateFixture`/`dragFixture`/`removeFixture`, `Entity` `fixture`.
- Produces:
  - `Mode = 'structure' | 'place' | 'electric'` (Task 3이 `'checklist'`, Task 7이 `'export'`를 더한다)
  - `Tool`에 `'fixture'`, uiStore `fixtureKind: FixtureKind`, `setFixtureTool(kind: FixtureKind): void`
  - `src/ui/modes.ts`: `MODES: [Mode, string][]`, `canSelectInMode(mode: Mode, kind: Entity['kind']): boolean`, `shows2d(mode: Mode, view: View): boolean`, `isPageMode(mode: Mode): boolean`
  - 2D 마커 `data-testid="fixture-<id>"`, 전기 패널 목록 `data-testid="circuit-list"`, 아이템 배지 `data-testid="status-circuit"`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/ui/modes.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { canSelectInMode, isPageMode, MODES, shows2d } from './modes';

describe('modes', () => {
  it('모드 탭 순서와 이름', () => {
    expect(MODES).toEqual([
      ['structure', '구조'],
      ['place', '배치'],
      ['electric', '전기'],
    ]);
  });

  it('모드마다 선택할 수 있는 대상이 정해져 있다', () => {
    expect(canSelectInMode('structure', 'wall')).toBe(true);
    expect(canSelectInMode('structure', 'item')).toBe(false);
    expect(canSelectInMode('place', 'item')).toBe(true);
    expect(canSelectInMode('place', 'fixture')).toBe(false);
    expect(canSelectInMode('electric', 'fixture')).toBe(true);
    expect(canSelectInMode('electric', 'item')).toBe(false);
  });

  it('구조·전기는 항상 2D, 배치는 보기 설정을 따른다', () => {
    expect(shows2d('structure', 'persp')).toBe(true);
    expect(shows2d('electric', 'top')).toBe(true);
    expect(shows2d('place', '2d')).toBe(true);
    expect(shows2d('place', 'persp')).toBe(false);
    expect(isPageMode('electric')).toBe(false);
  });
});
```

`src/ui/uiStore.test.ts`의 `describe('useUi', …)` 안에 추가:

```ts
  it('설비 도구를 고르면 도구가 fixture가 되고 종류를 기억한다', () => {
    useUi.getState().setFixtureTool('switch');
    expect(useUi.getState()).toMatchObject({ tool: 'fixture', fixtureKind: 'switch' });
    useUi.getState().setMode('electric');
    expect(useUi.getState()).toMatchObject({ mode: 'electric', tool: 'select', fixtureKind: 'switch' });
  });
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/ui`
Expected: FAIL — `Cannot find module './modes'`, `setFixtureTool is not a function`

- [ ] **Step 3: uiStore와 modes 구현**

`src/ui/uiStore.ts` 변경:
- import 추가: `import type { FixtureKind } from '../electrical/fixtures';`
- `export type Mode = 'structure' | 'place' | 'electric';`
- `export type Tool = 'select' | 'wall' | 'room' | 'door' | 'window' | 'opening' | 'label' | 'calibrate' | 'fixture';`
- `UiState`에 `fixtureKind: FixtureKind;`와 `setFixtureTool(kind: FixtureKind): void;` 추가
- 초기값 `fixtureKind: 'outlet',`
- 구현 `setFixtureTool: (kind) => set({ tool: 'fixture', fixtureKind: kind, candidates: null, calibration: null }),`

`src/ui/modes.ts`:

```ts
import type { Entity } from '../model/entities';
import type { Mode, View } from './uiStore';

export const MODES: [Mode, string][] = [
  ['structure', '구조'],
  ['place', '배치'],
  ['electric', '전기'],
];

const SELECTABLE: Record<Mode, Entity['kind'][]> = {
  structure: ['wall', 'opening', 'room'],
  place: ['item'],
  electric: ['fixture'],
};

export function canSelectInMode(mode: Mode, kind: Entity['kind']): boolean {
  return SELECTABLE[mode].includes(kind);
}

// 가운데에 2D·3D 대신 별도 화면을 띄우는 모드
export function isPageMode(mode: Mode): boolean {
  return SELECTABLE[mode].length === 0;
}

export function shows2d(mode: Mode, view: View): boolean {
  return mode === 'structure' || mode === 'electric' || (mode === 'place' && view === '2d');
}
```

- [ ] **Step 4: 통과 확인**

Run: `npx vitest run src/ui`
Expected: PASS

- [ ] **Step 5: 툴바·App·2D 연결**

`src/ui/Toolbar.tsx`:
- import 추가: `import { canSelectInMode, MODES } from './modes';`
- `changeMode`를 다음으로 바꾼다:

```ts
  const changeMode = (m: Mode) => {
    ui.setMode(m);
    const s = store.getState();
    const entity = findEntity(s.plan, s.selectedId);
    if (entity && !canSelectInMode(m, entity.kind)) s.select(null);
  };
```

- 모드 버튼 두 개를 다음으로 바꾼다:

```tsx
      <div className="segmented" role="group" aria-label="모드">
        {MODES.map(([m, label]) => (
          <button key={m} type="button" aria-pressed={mode === m} onClick={() => changeMode(m)}>{label}</button>
        ))}
      </div>
```

`src/App.tsx` 전체:

```tsx
import { Editor2D } from './editor2d/Editor2D';
import { usePlanStore } from './model/StoreContext';
import { Viewport } from './scene3d/Viewport';
import { Banner } from './ui/Banner';
import { CandidatePicker } from './ui/CandidatePicker';
import { CatalogPanel } from './ui/CatalogPanel';
import { ElectricPanel } from './ui/ElectricPanel';
import { HistoryPanel } from './ui/HistoryPanel';
import { isPageMode, shows2d } from './ui/modes';
import { PropertiesPanel } from './ui/PropertiesPanel';
import { useShortcuts } from './ui/shortcuts';
import { StructurePanel } from './ui/StructurePanel';
import { Toolbar } from './ui/Toolbar';
import { useUi } from './ui/uiStore';

export function App() {
  useShortcuts(usePlanStore());
  const mode = useUi((s) => s.mode);
  const view = useUi((s) => s.view);
  const page = isPageMode(mode);
  const show2d = !page && shows2d(mode, view);
  const show3d = !page && !shows2d(mode, view);
  return (
    <div className={page ? 'app app-wide' : 'app'}>
      <Toolbar />
      <Banner />
      {!page && (
        <aside className="left">
          {mode === 'structure' ? <StructurePanel /> : mode === 'electric' ? <ElectricPanel /> : <CatalogPanel />}
        </aside>
      )}
      <main className="center">
        <div className={show2d ? 'layer' : 'layer layer-hidden'}>
          <Editor2D />
        </div>
        <div className={show3d ? 'layer' : 'layer layer-hidden'}>
          <Viewport active={show3d} />
        </div>
        <CandidatePicker />
        <HistoryPanel />
      </main>
      {!page && (
        <aside className="right">
          <PropertiesPanel />
        </aside>
      )}
    </div>
  );
}
```

`src/editor2d/tools.ts`:
- import 추가: `import { FIXTURE_DEFAULT_HEIGHT, snapFixture } from '../electrical/fixtures';`
- `switch`의 `case 'calibrate'` 앞에 추가:

```ts
    case 'fixture': {
      const kind = ui.fixtureKind;
      const snapped = snapFixture(s.plan.walls, raw, kind, ui.snap);
      s.addFixture({ kind, pos: snapped.pos, ...(snapped.wallId ? { wallId: snapped.wallId } : {}), height: FIXTURE_DEFAULT_HEIGHT[kind] });
      return;
    }
```

`src/editor2d/Editor2D.tsx`:
- import 추가: `import { Fixtures2D } from './Fixtures2D';`
- keydown 핸들러의 `if (e.key === 'Escape') { … }` 블록을 다음으로 바꾼다:

```ts
      if (e.key === 'Escape') {
        const ui = useUi.getState();
        ui.clearCandidates();
        if (ui.calibration) ui.cancelCalibration();
        if (ui.tool === 'fixture') ui.setTool('select');
      }
```

- JSX에서 `<Openings2D />` 바로 뒤에 `<Fixtures2D />`를 넣는다.

`src/editor2d/Fixtures2D.tsx`:

```tsx
import { useContext, useEffect, useRef, type PointerEvent } from 'react';
import { FIXTURE_GLYPH, FIXTURE_R_CM, snapFixture } from '../electrical/fixtures';
import type { Fixture } from '../model/schema';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { useUi } from '../ui/uiStore';
import { clientToPlan } from './svgPoint';
import { SvgContext } from './svgContext';

const CLICK_SLOP_PX = 3;

type Drag = { id: string; dx: number; dy: number; startX: number; startY: number; moved: boolean };

export function Fixtures2D() {
  const store = usePlanStore();
  const fixtures = usePlan((s) => s.plan.fixtures);
  const selectedId = usePlan((s) => s.selectedId);
  const mode = useUi((s) => s.mode);
  const tool = useUi((s) => s.tool);
  const setDragging = useUi((s) => s.setDragging);
  const svgRef = useContext(SvgContext);
  const drag = useRef<Drag | null>(null);
  const interactive = mode === 'electric' && tool === 'select';
  const toPlan = (e: { clientX: number; clientY: number }) => clientToPlan(svgRef.current!, e.clientX, e.clientY);

  const onDown = (e: PointerEvent<SVGGElement>, f: Fixture) => {
    e.stopPropagation();
    const s = store.getState();
    s.select(f.id);
    const p = toPlan(e);
    drag.current = { id: f.id, dx: f.pos.x - p.x, dy: f.pos.y - p.y, startX: e.clientX, startY: e.clientY, moved: false };
    e.currentTarget.setPointerCapture(e.pointerId);
    s.beginDrag();
    setDragging(true);
  };

  const onMove = (e: PointerEvent<SVGGElement>) => {
    const d = drag.current;
    if (!d) return;
    if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) > CLICK_SLOP_PX) d.moved = true;
    if (!d.moved) return;
    const s = store.getState();
    const f = s.plan.fixtures.find((x) => x.id === d.id);
    if (!f) return;
    const p = toPlan(e);
    const snapped = snapFixture(s.plan.walls, { x: p.x + d.dx, y: p.y + d.dy }, f.kind, useUi.getState().snap);
    s.dragFixture(d.id, snapped.pos, snapped.wallId);
  };

  const finish = () => {
    if (!drag.current) return;
    drag.current = null;
    store.getState().endDrag();
    setDragging(false);
  };

  // 드래그 중인 설비가 사라지거나(삭제·실행 취소·파일 열기) 조작 불가 상태가 되면 드래그를 닫는다
  useEffect(() => {
    const d = drag.current;
    if (d && (!interactive || !fixtures.some((f) => f.id === d.id))) finish();
  });

  return (
    <g className={interactive ? 'fixtures2d fixtures2d-interactive' : 'fixtures2d'}>
      {fixtures.map((f) => {
        const g = FIXTURE_GLYPH[f.kind];
        const r = FIXTURE_R_CM;
        return (
          <g
            key={f.id}
            className={f.id === selectedId ? 'fixture2d fixture2d-selected' : 'fixture2d'}
            data-testid={`fixture-${f.id}`}
            onPointerDown={interactive ? (e) => onDown(e, f) : undefined}
            onPointerMove={interactive ? onMove : undefined}
            onPointerUp={interactive ? finish : undefined}
            onPointerCancel={interactive ? finish : undefined}
          >
            {g.shape === 'circle' ? (
              <circle cx={f.pos.x} cy={f.pos.y} r={r} fill={g.fill} stroke={g.stroke} className="fixture2d-shape" />
            ) : (
              <rect x={f.pos.x - r} y={f.pos.y - r} width={r * 2} height={r * 2} fill={g.fill} stroke={g.stroke} className="fixture2d-shape" />
            )}
            <text x={f.pos.x} y={f.pos.y} fontSize={r * 1.1} textAnchor="middle" dominantBaseline="central" fill={g.letterFill} className="fixture2d-letter">
              {g.letter}
            </text>
          </g>
        );
      })}
    </g>
  );
}
```

`src/editor2d/Items2D.tsx`:
- import 추가: `import { missingDedicatedCircuit } from '../electrical/fixtures';`와 `useMemo`(react import에 추가)
- `const interactive = …` 다음 줄에 추가:

```ts
  const missingCircuit = useMemo(
    () => (mode === 'electric' ? new Set(missingDedicatedCircuit(plan, (id) => findProduct(plan, id))) : new Set<string>()),
    [mode, plan],
  );
```

- 클래스 배열의 `st?.collides || st?.blocksDoor ? 'item2d-danger' : '',` 다음 줄에 `missingCircuit.has(item.id) ? 'item2d-circuit' : '',` 추가

`src/ui/ElectricPanel.tsx`:

```tsx
import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { DEDICATED_RADIUS_CM, FIXTURE_KINDS, FIXTURE_LABEL, fixtureSummary, missingDedicatedCircuit } from '../electrical/fixtures';
import { activeItems, activeLayout } from '../model/layout';
import { usePlan } from '../model/StoreContext';
import { useUi } from './uiStore';

export function ElectricPanel() {
  const plan = usePlan((s) => s.plan);
  const tool = useUi((s) => s.tool);
  const fixtureKind = useUi((s) => s.fixtureKind);
  const ui = useUi.getState();
  const missing = useMemo(() => new Set(missingDedicatedCircuit(plan, (id) => findProduct(plan, id))), [plan]);
  const needs = activeItems(plan).flatMap((item) => {
    const product = findProduct(plan, item.productId);
    return product?.power?.dedicatedCircuit ? [{ item, product }] : [];
  });

  return (
    <div className="electric">
      <h3>도구</h3>
      <div className="tool-grid">
        <button type="button" aria-pressed={tool === 'select'} onClick={() => ui.setTool('select')}>선택</button>
        {FIXTURE_KINDS.map((k) => (
          <button key={k} type="button" aria-pressed={tool === 'fixture' && fixtureKind === k} onClick={() => ui.setFixtureTool(k)}>
            {FIXTURE_LABEL[k]}
          </button>
        ))}
      </div>
      <p className="muted">벽 가까이(30cm 이내)를 클릭하면 벽면에 붙습니다. 조명은 벽에 붙지 않습니다. 스냅을 끄면 클릭한 자리에 놓입니다. Esc로 선택 도구로 돌아갑니다.</p>
      <h3>배치된 전기 설비</h3>
      <p className="muted">{plan.fixtures.length > 0 ? fixtureSummary(plan.fixtures) : '아직 없습니다.'}</p>
      <h3>전용회로가 필요한 가전 ({activeLayout(plan).name})</h3>
      {needs.length === 0 ? (
        <p className="muted">없습니다.</p>
      ) : (
        <ul className="circuit-list" data-testid="circuit-list">
          {needs.map(({ item, product }) => (
            <li key={item.id} className={missing.has(item.id) ? 'error' : undefined}>
              {product.name} — {missing.has(item.id) ? `${DEDICATED_RADIUS_CM}cm 이내 전용회로 콘센트 없음` : '전용회로 콘센트 있음'}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
```

`src/ui/properties/FixtureProperties.tsx`:

```tsx
import { FIXTURE_KINDS, FIXTURE_LABEL, type FixtureKind } from '../../electrical/fixtures';
import type { Fixture } from '../../model/schema';
import { usePlanStore } from '../../model/StoreContext';
import { NumberField, TextField } from '../fields';

export function FixtureProperties({ fixture }: { fixture: Fixture }) {
  const s = usePlanStore().getState();
  return (
    <>
      <h3>{FIXTURE_LABEL[fixture.kind]}</h3>
      <p className="muted">{fixture.wallId ? '벽에 붙어 있음' : '벽에 붙지 않음'}</p>
      <label className="field">
        종류
        <select value={fixture.kind} onChange={(e) => s.updateFixture(fixture.id, { kind: e.target.value as FixtureKind })}>
          {FIXTURE_KINDS.map((k) => (
            <option key={k} value={k}>{FIXTURE_LABEL[k]}</option>
          ))}
        </select>
      </label>
      <NumberField key={`${fixture.id}-x`} label="X" unit="cm" value={fixture.pos.x} onCommit={(v) => s.updateFixture(fixture.id, { pos: { ...fixture.pos, x: v } })} />
      <NumberField key={`${fixture.id}-y`} label="Y" unit="cm" value={fixture.pos.y} onCommit={(v) => s.updateFixture(fixture.id, { pos: { ...fixture.pos, y: v } })} />
      <NumberField key={`${fixture.id}-h`} label="설치 높이" unit="cm" value={fixture.height} onCommit={(v) => s.updateFixture(fixture.id, { height: v })} />
      <TextField key={`${fixture.id}-memo`} label="메모" value={fixture.memo ?? ''} allowEmpty onCommit={(v) => s.updateFixture(fixture.id, { memo: v })} />
      <div className="row">
        <button type="button" className="danger" onClick={() => s.removeFixture(fixture.id)}>삭제</button>
      </div>
    </>
  );
}
```

`src/ui/PropertiesPanel.tsx`: import `FixtureProperties`를 추가하고 room 줄 뒤에 추가:

```tsx
      {entity?.kind === 'fixture' && <FixtureProperties key={entity.fixture.id} fixture={entity.fixture} />}
```

`src/ui/properties/ItemProperties.tsx`:
- import 추가: `useMemo`(react), `import { DEDICATED_RADIUS_CM, missingDedicatedCircuit } from '../../electrical/fixtures';`
- `const locked = !!item.locked;` 다음 줄에 추가:

```ts
  const missingCircuit = useMemo(
    () => missingDedicatedCircuit(plan, (id) => findProduct(plan, id)).includes(item.id),
    [plan, item.id],
  );
```

- 제품 치수 `<p className="muted">…</p>` 블록 바로 뒤에 추가:

```tsx
      {product?.power && (
        <p className="muted">
          소비전력 {product.power.watts}W{product.power.dedicatedCircuit ? ' · 전용회로 필요' : ''}
        </p>
      )}
      {missingCircuit && (
        <p className="badge warn" data-testid="status-circuit">
          전용회로 콘센트 없음 ({DEDICATED_RADIUS_CM}cm 이내)
        </p>
      )}
```

`src/styles.css` 끝에 추가하고, 기존 두 규칙을 아래처럼 넓힌다:
- `.editor2d.mode-structure .items2d { … }` → `.editor2d.mode-structure .items2d, .editor2d.mode-electric .items2d { opacity: 0.45; pointer-events: none; }`
- `.editor2d.mode-place .walls2d, .editor2d.mode-place .openings2d, .editor2d.mode-place .rooms2d { pointer-events: none; }` → 같은 선택자 뒤에 `, .editor2d.mode-electric .walls2d, .editor2d.mode-electric .openings2d, .editor2d.mode-electric .rooms2d` 추가
- `.editor2d-svg.tool-calibrate { cursor: crosshair; }`가 들어 있는 선택자 목록에 `.editor2d-svg.tool-fixture` 추가

```css
.fixtures2d { pointer-events: none; }
.fixtures2d-interactive { pointer-events: auto; }
.fixtures2d-interactive .fixture2d { cursor: grab; }
.fixture2d-shape { stroke-width: 2; vector-effect: non-scaling-stroke; }
.fixture2d-selected .fixture2d-shape { stroke: var(--accent); stroke-width: 3; }
.fixture2d-letter { font-weight: 700; pointer-events: none; user-select: none; }
.item2d-circuit { stroke: var(--danger); stroke-width: 3; stroke-dasharray: 6 4; }
.electric h3 { font-size: 13px; margin: 12px 0 6px; color: #6b5e4b; }
.circuit-list { margin: 0; padding-left: 18px; font-size: 12px; }
p.badge { display: inline-block; margin: 0 0 8px; }
```

- [ ] **Step 6: 타입·단위 테스트 확인**

Run: `npm run typecheck && npx vitest run`
Expected: 통과

- [ ] **Step 7: 실패하는 E2E 작성** — `e2e/electrical.spec.ts`

```ts
import { expect, test, type Page } from '@playwright/test';

type P = { x: number; y: number };

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

async function planToClient(page: Page, p: P): Promise<P> {
  return page.getByTestId('editor2d').evaluate((svg, q) => {
    const m = (svg as SVGSVGElement).getScreenCTM()!;
    const r = new DOMPoint(q.x, q.y).matrixTransform(m);
    return { x: r.x, y: r.y };
  }, p);
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

test('전용회로 가전 근처에 전용회로 콘센트를 놓으면 경고가 사라진다', async ({ page }) => {
  await page.getByRole('button', { name: '2D', exact: true }).click();
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await expect(page.getByTestId('status-circuit')).toBeVisible();

  await page.getByRole('button', { name: '전기', exact: true }).click();
  await expect(page.getByTestId('circuit-list')).toContainText('150cm 이내 전용회로 콘센트 없음');
  await page.getByRole('button', { name: '전용회로 콘센트', exact: true }).click();
  const at = await planToClient(page, { x: 362, y: 200 });
  await page.mouse.click(at.x, at.y);

  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
  const f = (await getPlan(page)).fixtures[0];
  expect(f).toMatchObject({ kind: 'outlet-dedicated', wallId: 'w5', height: 30 });
  expect(f.pos.x).toBe(356);
  expect(Math.abs(f.pos.y - 200)).toBeLessThanOrEqual(2);
  await expect(page.getByTestId('circuit-list')).toContainText('전용회로 콘센트 있음');

  await page.getByRole('button', { name: '배치', exact: true }).click();
  const washer = (await getPlan(page)).layouts[0].items[0];
  const c = await centerOf(page, `item2d-${washer.id}`);
  await page.mouse.click(c.x, c.y);
  await expect(page.getByRole('heading', { name: '그랑데 드럼세탁기' })).toBeVisible();
  await expect(page.getByTestId('status-circuit')).toHaveCount(0);
});

test('설비를 끌면 벽을 따라 붙고, 삭제 후 실행 취소로 되살린다', async ({ page }) => {
  await page.getByRole('button', { name: '전기', exact: true }).click();
  await page.getByRole('button', { name: '콘센트', exact: true }).click();
  const at = await planToClient(page, { x: 100, y: 25 });
  await page.mouse.click(at.x, at.y);
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
  const f = (await getPlan(page)).fixtures[0];
  expect(f).toMatchObject({ kind: 'outlet', wallId: 'w1', pos: { y: 10 } });

  await page.getByRole('button', { name: '선택', exact: true }).click();
  const from = await centerOf(page, `fixture-${f.id}`);
  const to = await planToClient(page, { x: f.pos.x + 150, y: 22 });
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
  await expect.poll(async () => (await getPlan(page)).fixtures[0].pos.x).toBeGreaterThan(f.pos.x + 100);
  expect((await getPlan(page)).fixtures[0]).toMatchObject({ wallId: 'w1', pos: { y: 10 } });

  await expect(page.getByTestId('properties-panel').getByRole('heading', { name: '콘센트' })).toBeVisible();
  await page.getByTestId('properties-panel').getByRole('button', { name: '삭제' }).click();
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(0);
  await page.keyboard.press('Control+z');
  await expect.poll(async () => (await getPlan(page)).fixtures.length).toBe(1);
});
```

- [ ] **Step 8: E2E 실행**

Run: `npx playwright test e2e/electrical.spec.ts`
Expected: PASS (2 tests). 실패하면 화면 동작을 고치고, 단언을 약하게 바꾸지 않는다.

- [ ] **Step 9: 전체 검증**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: 모두 통과(e2e 15개)

- [ ] **Step 10: Commit**

```bash
git add src/ui/modes.ts src/ui/modes.test.ts src/ui/uiStore.ts src/ui/uiStore.test.ts src/ui/Toolbar.tsx src/App.tsx src/editor2d/Editor2D.tsx src/editor2d/tools.ts src/editor2d/Items2D.tsx src/editor2d/Fixtures2D.tsx src/ui/ElectricPanel.tsx src/ui/properties/FixtureProperties.tsx src/ui/PropertiesPanel.tsx src/ui/properties/ItemProperties.tsx src/styles.css e2e/electrical.spec.ts
git commit -m "feat: electrical mode with fixture markers, tools and dedicated-circuit warnings"
```

---

### Task 3: 체크리스트(기본 항목 + 자동 항목 + 화면)

**Files:**
- Create: `src/checklist/defaults.ts`, `src/checklist/items.ts`, `src/checklist/items.test.ts`, `src/geometry/wallReference.ts`, `src/geometry/wallReference.test.ts`, `src/ui/ChecklistView.tsx`, `e2e/checklist.spec.ts`
- Modify: `src/model/store.ts`, `src/model/store.test.ts`, `src/ui/uiStore.ts`, `src/ui/modes.ts`, `src/ui/modes.test.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 1 `missingDedicatedCircuit`, `fixtureSummary`, `DEDICATED_RADIUS_CM`; `validatePlan`, `ItemStatus` (`src/validation/validate.ts`); `conflictLines` (`src/validation/describe.ts`); `wallDistances` (`src/geometry/distance.ts`); `itemObb` (`src/geometry/obb.ts`); `planWallObbs` (`src/geometry/walls.ts`); Task 2 `modes.ts`.
- Produces:
  - `type Phase = 'demolition' | 'carpentry' | 'tile' | 'wallpaper' | 'floor' | 'kitchen'`, `PHASES: { id: Phase; label: string }[]`
  - `type ChecklistItem = { id: string; phase: Phase; text: string; auto: boolean }`, `DEFAULT_CHECKLIST: ChecklistItem[]`
  - `autoChecklist(plan, resolve, status: Record<string, ItemStatus>): ChecklistItem[]`
  - `checklistItems(plan, resolve): ChecklistItem[]` — 공정 순서, 공정 안에서는 기본 항목 다음 자동 항목
  - `checklistEntry(plan, itemId): ChecklistState | undefined`
  - `wallReferenceText(plan, item, product): string` — 예: `"왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm"`
  - store `setChecklistEntry(itemId: string, patch: { checked?: boolean; memo?: string }): void`
  - `Mode`에 `'checklist'`; 화면 `data-testid="checklist"`, 행 `data-testid="checklist-<itemId>"`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/geometry/wallReference.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Product } from '../model/schema';
import { wallReferenceText } from './wallReference';

const box: Product = {
  id: 'bi', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
  dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
  builder: 'box', clearances: [], builtIn: true, mount: 'floor',
};

describe('wallReferenceText', () => {
  it('제품의 왼쪽·오른쪽·뒤 면에서 가장 가까운 벽면까지 거리', () => {
    const item = { id: 'i', productId: 'bi', variantId: 'v', x: 100, y: 60, rotation: 0 };
    expect(wallReferenceText(SAMPLE_PLAN, item, box)).toBe('왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm');
  });

  it('벽이 하나도 없으면 안내 문구', () => {
    const item = { id: 'i', productId: 'bi', variantId: 'v', x: 100, y: 60, rotation: 0 };
    expect(wallReferenceText({ ...SAMPLE_PLAN, walls: [] }, item, box)).toBe('가까운 벽 없음');
  });
});
```

`src/checklist/items.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { findProduct } from '../catalog/products';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Plan, Product } from '../model/schema';
import type { ItemStatus } from '../validation/validate';
import { DEFAULT_CHECKLIST, PHASES } from './defaults';
import { autoChecklist, checklistEntry, checklistItems } from './items';

const resolve = (plan: Plan) => (id: string) => findProduct(plan, id);
const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
const sofa = { id: 'so', productId: 'sofa-3seat', variantId: 'gray', x: 175, y: 200, rotation: 0 };
const clean: Record<string, ItemStatus> = {};

describe('기본 항목', () => {
  it('공정 6개, 공정마다 4개 이상, id는 겹치지 않는다', () => {
    expect(PHASES.map((p) => p.label)).toEqual(['철거', '목공·전기', '타일', '도배', '바닥', '주방']);
    for (const p of PHASES) expect(DEFAULT_CHECKLIST.filter((i) => i.phase === p.id).length).toBeGreaterThanOrEqual(4);
    expect(new Set(DEFAULT_CHECKLIST.map((i) => i.id)).size).toBe(DEFAULT_CHECKLIST.length);
    expect(DEFAULT_CHECKLIST.every((i) => !i.auto && !i.id.startsWith('auto-'))).toBe(true);
  });
});

describe('autoChecklist', () => {
  it('전용회로 가전 목록과 콘센트 없음 경고', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [washer, sofa]);
    expect(autoChecklist(plan, resolve(plan), clean)).toEqual([
      { id: 'auto-circuit', phase: 'carpentry', auto: true, text: '전용회로 확인: 그랑데 드럼세탁기 (150cm 이내 전용회로 콘센트 없음: 그랑데 드럼세탁기)' },
    ]);
  });

  it('설비가 있으면 콘센트 위치 공유 항목을 만들고, 가까운 전용회로 콘센트가 있으면 경고를 뺀다', () => {
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [washer]),
      fixtures: [{ id: 'f', kind: 'outlet-dedicated', pos: { x: 356, y: 200 }, wallId: 'w5', height: 30 }],
    };
    const items = autoChecklist(plan, resolve(plan), clean);
    expect(items.map((i) => i.text)).toEqual([
      '전용회로 확인: 그랑데 드럼세탁기',
      '콘센트 위치 공유: 전용회로 콘센트 1개 — 전기 계획도 참고',
    ]);
    expect(items.map((i) => i.id)).toEqual(['auto-circuit', 'auto-outlets']);
  });

  it('빌트인 제품마다 치수와 벽 기준 위치', () => {
    const builtIn: Product = {
      id: 'custom-dw', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
      dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'box', clearances: [], builtIn: true, mount: 'floor',
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [{ id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0 }]),
      customProducts: [builtIn],
    };
    expect(autoChecklist(plan, resolve(plan), clean)).toEqual([
      {
        id: 'auto-builtin-dw',
        phase: 'kitchen',
        auto: true,
        text: '빌트인 치수 전달: 식기세척기 60×60×85cm, 왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm',
      },
    ]);
  });

  it('문 열림 간섭이 남은 가구(충돌 줄은 빼고)', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [sofa]);
    const status: Record<string, ItemStatus> = {
      so: {
        collides: true,
        clearanceBlocked: false,
        blocksDoor: true,
        conflicts: [
          { type: 'collides', target: { kind: 'wall', id: 'w1' } },
          { type: 'blocksDoor', target: { kind: 'door', id: 'o1' } },
        ],
      },
    };
    expect(autoChecklist(plan, resolve(plan), status)).toEqual([
      { id: 'auto-door-so', phase: 'carpentry', auto: true, text: '문 열림 간섭 해결: 3인 소파 — 방문 열림 간섭: 문' },
    ]);
  });
});

describe('checklistItems / checklistEntry', () => {
  it('공정 순서대로, 공정 안에서는 기본 항목 다음 자동 항목', () => {
    const plan = withActiveItems(SAMPLE_PLAN, [washer]);
    const items = checklistItems(plan, resolve(plan));
    expect(items[0].phase).toBe('demolition');
    const phases = items.map((i) => PHASES.findIndex((p) => p.id === i.phase));
    expect(phases).toEqual([...phases].sort((a, b) => a - b));
    const carpentry = items.filter((i) => i.phase === 'carpentry');
    expect(carpentry.at(-1)?.id).toBe('auto-circuit');
    expect(items).toHaveLength(DEFAULT_CHECKLIST.length + 1);
  });

  it('저장된 상태를 id로 찾는다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, checklist: [{ itemId: 'demo-1', checked: true }] };
    expect(checklistEntry(plan, 'demo-1')).toEqual({ itemId: 'demo-1', checked: true });
    expect(checklistEntry(plan, 'demo-2')).toBeUndefined();
  });
});
```

`src/model/store.test.ts` 끝에 추가:

```ts
describe('체크리스트 상태', () => {
  it('체크와 메모를 저장하고, 둘 다 없어지면 항목을 지운다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setChecklistEntry('demo-1', { checked: true });
    expect(s.getState().plan.checklist).toEqual([{ itemId: 'demo-1', checked: true }]);
    s.getState().setChecklistEntry('demo-1', { memo: '  붙박이장 포함 ' });
    expect(s.getState().plan.checklist).toEqual([{ itemId: 'demo-1', checked: true, memo: '붙박이장 포함' }]);
    s.getState().setChecklistEntry('demo-1', { checked: false });
    expect(s.getState().plan.checklist).toEqual([{ itemId: 'demo-1', checked: false, memo: '붙박이장 포함' }]);
    s.getState().setChecklistEntry('demo-1', { memo: '' });
    expect(s.getState().plan.checklist).toEqual([]);
  });

  it('바뀌는 것이 없으면 이력에 남기지 않고, 변경은 실행 취소된다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().setChecklistEntry('demo-1', { checked: false });
    expect(s.getState().past).toHaveLength(0);
    s.getState().setChecklistEntry('demo-1', { checked: true });
    s.getState().undo();
    expect(s.getState().plan.checklist).toEqual([]);
  });
});
```

`src/ui/modes.test.ts`의 첫 번째 `it`의 기대값 배열 끝에 `['checklist', '체크리스트'],`를 추가하고, 세 번째 `it` 끝에 추가:

```ts
    expect(isPageMode('checklist')).toBe(true);
    expect(canSelectInMode('checklist', 'item')).toBe(false);
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/checklist src/geometry/wallReference.test.ts src/model src/ui/modes.test.ts`
Expected: FAIL — 모듈 없음, `setChecklistEntry is not a function`

- [ ] **Step 3: 구현**

`src/geometry/wallReference.ts`:

```ts
import type { Item, Plan, Product } from '../model/schema';
import { wallDistances } from './distance';
import { itemObb } from './obb';
import { planWallObbs } from './walls';

const SIDES = [
  ['left', '왼쪽'],
  ['right', '오른쪽'],
  ['back', '뒤'],
] as const;

// 업체에 "벽 기준 위치"로 전달하는 문구: 제품 면에서 가장 가까운 벽면까지
export function wallReferenceText(plan: Plan, item: Item, product: Product): string {
  const rays = wallDistances(itemObb(item.x, item.y, item.rotation, product.dims.w, product.dims.d), planWallObbs(plan));
  const parts = SIDES.flatMap(([dir, label]) => {
    const r = rays.find((x) => x.dir === dir);
    return r ? [`${label} 벽까지 ${r.distance}cm`] : [];
  });
  return parts.length > 0 ? parts.join(', ') : '가까운 벽 없음';
}
```

`src/checklist/defaults.ts` (문구는 이 계획에서 새로 쓴 것이다. 바꾸지 않는다):

```ts
export type Phase = 'demolition' | 'carpentry' | 'tile' | 'wallpaper' | 'floor' | 'kitchen';

export type ChecklistItem = { id: string; phase: Phase; text: string; auto: boolean };

export const PHASES: { id: Phase; label: string }[] = [
  { id: 'demolition', label: '철거' },
  { id: 'carpentry', label: '목공·전기' },
  { id: 'tile', label: '타일' },
  { id: 'wallpaper', label: '도배' },
  { id: 'floor', label: '바닥' },
  { id: 'kitchen', label: '주방' },
];

const item = (id: string, phase: Phase, text: string): ChecklistItem => ({ id, phase, text, auto: false });

export const DEFAULT_CHECKLIST: ChecklistItem[] = [
  item('demo-1', 'demolition', '철거 범위(벽·바닥재·천장·붙박이장)를 도면에 표시해 업체와 같은 기준으로 확인한다'),
  item('demo-2', 'demolition', '관리사무소 공사 신고와 이웃 동의서 제출 일정을 확인한다'),
  item('demo-3', 'demolition', '엘리베이터 보양과 폐기물 반출 방법, 비용 부담 주체를 정한다'),
  item('demo-4', 'demolition', '철거 후 드러난 배관·누수·결로 흔적을 사진으로 남긴다'),
  item('carp-1', 'carpentry', '문틀·문짝 교체 여부와 문 열림 방향을 도면 기준으로 확정한다'),
  item('carp-2', 'carpentry', '콘센트·스위치 위치와 높이를 전기 계획도대로 표시해 전달한다'),
  item('carp-3', 'carpentry', '고전력 가전의 전용회로 개수와 분전반의 여유 회로를 확인한다'),
  item('carp-4', 'carpentry', '조명 위치와 매입등 여부, 스위치마다 켜질 조명 묶음을 정한다'),
  item('carp-5', 'carpentry', '커튼박스·몰딩·걸레받이를 둘지와 치수를 정한다'),
  item('tile-1', 'tile', '욕실·현관·주방 벽 타일 규격과 줄눈 색을 정한다'),
  item('tile-2', 'tile', '욕실 바닥의 배수 방향 기울기와 방수 범위를 확인한다'),
  item('tile-3', 'tile', '수전·샤워기·욕실장 높이를 타일 시공 전에 정한다'),
  item('tile-4', 'tile', '보수용 여분 타일을 남겨 달라고 요청한다'),
  item('wall-1', 'wallpaper', '벽지 종류(합지·실크)와 색상, 천장 포함 여부를 정한다'),
  item('wall-2', 'wallpaper', '도배 전 벽면 퍼티·평탄화 범위를 확인한다'),
  item('wall-3', 'wallpaper', '콘센트·스위치 커버를 도배 후 다시 다는 순서를 확인한다'),
  item('wall-4', 'wallpaper', '곰팡이·결로가 있던 벽은 단열·방습 처리를 할지 정한다'),
  item('floor-1', 'floor', '바닥재 종류(강마루·강화마루·장판·타일)와 색상을 정한다'),
  item('floor-2', 'floor', '바닥재 시공 범위(발코니·현관 포함 여부)와 문턱 제거 여부를 정한다'),
  item('floor-3', 'floor', '바닥 수평 상태와 난방 배관 위치를 시공 전에 확인한다'),
  item('floor-4', 'floor', '가구·가전 반입 일정을 바닥 시공과 양생이 끝난 뒤로 잡는다'),
  item('kit-1', 'kitchen', '싱크대 상판 재질과 하부장·상부장 치수를 도면 기준으로 확정한다'),
  item('kit-2', 'kitchen', '빌트인 가전(식기세척기·인덕션 등) 모델과 매립 치수를 미리 전달한다'),
  item('kit-3', 'kitchen', '냉장고 자리의 폭·깊이·높이와 문 열림 여유를 실측으로 확인한다'),
  item('kit-4', 'kitchen', '수전·배수 위치와 정수기·음식물처리기 설치 여부를 정한다'),
  item('kit-5', 'kitchen', '후드 위치와 배기 덕트 경로를 확인한다'),
];
```

`src/checklist/items.ts`:

```ts
import { DEDICATED_RADIUS_CM, fixtureSummary, missingDedicatedCircuit } from '../electrical/fixtures';
import { wallReferenceText } from '../geometry/wallReference';
import { activeItems } from '../model/layout';
import type { ChecklistState, Plan, Product } from '../model/schema';
import { conflictLines } from '../validation/describe';
import { validatePlan, type ItemStatus } from '../validation/validate';
import { DEFAULT_CHECKLIST, PHASES, type ChecklistItem } from './defaults';

type Resolve = (productId: string) => Product | undefined;

export function autoChecklist(plan: Plan, resolve: Resolve, status: Record<string, ItemStatus>): ChecklistItem[] {
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    return product ? [{ item, product }] : [];
  });
  const out: ChecklistItem[] = [];

  const dedicated = placed.filter((p) => p.product.power?.dedicatedCircuit);
  if (dedicated.length > 0) {
    const missing = new Set(missingDedicatedCircuit(plan, resolve));
    const missingNames = dedicated.filter((p) => missing.has(p.item.id)).map((p) => p.product.name);
    const warn = missingNames.length > 0 ? ` (${DEDICATED_RADIUS_CM}cm 이내 전용회로 콘센트 없음: ${missingNames.join(', ')})` : '';
    out.push({ id: 'auto-circuit', phase: 'carpentry', auto: true, text: `전용회로 확인: ${dedicated.map((p) => p.product.name).join(', ')}${warn}` });
  }

  if (plan.fixtures.length > 0) {
    out.push({ id: 'auto-outlets', phase: 'carpentry', auto: true, text: `콘센트 위치 공유: ${fixtureSummary(plan.fixtures)} — 전기 계획도 참고` });
  }

  for (const { item, product } of placed) {
    if (!product.builtIn) continue;
    const { w, d, h } = product.dims;
    out.push({
      id: `auto-builtin-${item.id}`,
      phase: product.category === 'kitchen' ? 'kitchen' : 'carpentry',
      auto: true,
      text: `빌트인 치수 전달: ${product.name} ${w}×${d}×${h}cm, ${wallReferenceText(plan, item, product)}`,
    });
  }

  for (const { item, product } of placed) {
    const st = status[item.id];
    if (!st || !(st.clearanceBlocked || st.blocksDoor)) continue;
    const lines = conflictLines(st, plan).filter((line) => !line.startsWith('충돌'));
    out.push({ id: `auto-door-${item.id}`, phase: 'carpentry', auto: true, text: `문 열림 간섭 해결: ${product.name} — ${lines.join(' / ')}` });
  }

  return out;
}

export function checklistItems(plan: Plan, resolve: Resolve): ChecklistItem[] {
  const all = [...DEFAULT_CHECKLIST, ...autoChecklist(plan, resolve, validatePlan(plan, resolve))];
  return PHASES.flatMap((p) => all.filter((i) => i.phase === p.id));
}

export function checklistEntry(plan: Plan, itemId: string): ChecklistState | undefined {
  return plan.checklist.find((c) => c.itemId === itemId);
}
```

`src/model/store.ts`:
- import에 `ChecklistState` 추가
- `PlanState`에 `setChecklistEntry(itemId: string, patch: { checked?: boolean; memo?: string }): void;` 추가
- `removeFixture` 구현 뒤에 추가:

```ts
      setChecklistEntry: (itemId, patch) => {
        const plan = get().plan;
        const current = plan.checklist.find((c) => c.itemId === itemId);
        const merged = { checked: current?.checked ?? false, memo: current?.memo, ...patch };
        const memo = merged.memo?.trim();
        const next: ChecklistState = { itemId, checked: merged.checked, ...(memo ? { memo } : {}) };
        const keep = next.checked || !!next.memo;
        if (current ? current.checked === next.checked && current.memo === next.memo : !keep) return;
        const checklist = current
          ? keep
            ? plan.checklist.map((c) => (c.itemId === itemId ? next : c))
            : plan.checklist.filter((c) => c.itemId !== itemId)
          : [...plan.checklist, next];
        commit({ ...plan, checklist });
      },
```

`src/ui/uiStore.ts`: `export type Mode = 'structure' | 'place' | 'electric' | 'checklist';`

`src/ui/modes.ts`: `MODES` 끝에 `['checklist', '체크리스트'],`, `SELECTABLE`에 `checklist: [],` 추가.

`src/ui/ChecklistView.tsx`:

```tsx
import { useMemo } from 'react';
import { findProduct } from '../catalog/products';
import { PHASES } from '../checklist/defaults';
import { checklistEntry, checklistItems } from '../checklist/items';
import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { TextField } from './fields';

export function ChecklistView() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const items = useMemo(() => checklistItems(plan, (id) => findProduct(plan, id)), [plan]);
  const s = store.getState();
  const isDone = (id: string) => !!checklistEntry(plan, id)?.checked;
  const done = items.filter((i) => isDone(i.id)).length;

  return (
    <div className="checklist" data-testid="checklist">
      <h2>공사 체크리스트</h2>
      <p className="muted">
        전체 {done}/{items.length} 완료 · 자동 항목은 현재 배치안({activeLayout(plan).name})과 전기 계획에서 만들어집니다.
      </p>
      {PHASES.map((phase) => {
        const list = items.filter((i) => i.phase === phase.id);
        return (
          <section key={phase.id}>
            <h3>
              {phase.label} <span className="muted">{list.filter((i) => isDone(i.id)).length}/{list.length}</span>
            </h3>
            <ul className="checklist-items">
              {list.map((i) => {
                const entry = checklistEntry(plan, i.id);
                return (
                  <li key={i.id} data-testid={`checklist-${i.id}`}>
                    <label className="check">
                      <input type="checkbox" checked={!!entry?.checked} onChange={(e) => s.setChecklistEntry(i.id, { checked: e.target.checked })} />
                      {i.auto && <span className="badge auto">자동</span>}
                      <span>{i.text}</span>
                    </label>
                    <TextField key={`${i.id}-memo`} label="메모" value={entry?.memo ?? ''} allowEmpty onCommit={(v) => s.setChecklistEntry(i.id, { memo: v })} />
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}
    </div>
  );
}
```

`src/App.tsx`: import `ChecklistView`를 추가하고 `<HistoryPanel />` 바로 앞에 추가:

```tsx
        {mode === 'checklist' && (
          <div className="page-panel">
            <ChecklistView />
          </div>
        )}
```

`src/styles.css` 끝에 추가:

```css
.app-wide .center { grid-column: 1 / -1; }
.page-panel { position: absolute; inset: 0; overflow-y: auto; padding: 24px 32px; background: #f6f5f2; }
.page-panel h2 { margin: 0 0 4px; font-size: 18px; }
.page-panel section { background: #fff; border: 1px solid #e5e1d8; border-radius: 8px; padding: 12px 16px; margin-top: 12px; max-width: 960px; }
.page-panel h3 { font-size: 14px; margin: 0 0 8px; color: #6b5e4b; }
.checklist-items { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 10px; }
.checklist-items li { display: grid; grid-template-columns: 1fr 260px; gap: 12px; align-items: start; border-top: 1px solid #f0ede6; padding-top: 8px; }
.checklist-items .check { font-size: 13px; align-items: flex-start; margin: 0; }
.checklist-items .field { margin: 0; }
.badge.auto { background: #e8f1fd; color: #1b4a8a; flex: none; }
```

- [ ] **Step 4: 통과 확인**

Run: `npm run typecheck && npx vitest run`
Expected: 통과

- [ ] **Step 5: 실패하는 E2E 작성** — `e2e/checklist.spec.ts`

```ts
import { expect, test, type Page } from '@playwright/test';

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('자동 항목이 배치에서 만들어지고, 체크와 메모가 새로고침 후에도 남는다', async ({ page }) => {
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  const list = page.getByTestId('checklist');
  await expect(list.getByTestId('checklist-auto-circuit')).toContainText('전용회로 확인: 그랑데 드럼세탁기');
  await expect(page.getByTestId('properties-panel')).toHaveCount(0);

  const row = list.getByTestId('checklist-demo-1');
  await row.getByRole('checkbox').check();
  await row.getByLabel('메모').fill('거실 붙박이장 포함');
  await row.getByLabel('메모').press('Enter');
  await expect.poll(async () => (await getPlan(page)).checklist).toEqual([{ itemId: 'demo-1', checked: true, memo: '거실 붙박이장 포함' }]);
  await expect(page.getByTestId('save-status')).toContainText('저장됨');

  await page.reload();
  await page.getByRole('button', { name: '체크리스트', exact: true }).click();
  await expect(page.getByTestId('checklist-demo-1').getByRole('checkbox')).toBeChecked();
  await expect(page.getByTestId('checklist-demo-1').getByLabel('메모')).toHaveValue('거실 붙박이장 포함');
});
```

- [ ] **Step 6: E2E 실행**

Run: `npx playwright test e2e/checklist.spec.ts`
Expected: PASS

- [ ] **Step 7: 전체 검증**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: 모두 통과(e2e 16개)

- [ ] **Step 8: Commit**

```bash
git add src/checklist/defaults.ts src/checklist/items.ts src/checklist/items.test.ts src/geometry/wallReference.ts src/geometry/wallReference.test.ts src/model/store.ts src/model/store.test.ts src/ui/uiStore.ts src/ui/modes.ts src/ui/modes.test.ts src/ui/ChecklistView.tsx src/App.tsx src/styles.css e2e/checklist.spec.ts
git commit -m "feat: checklist mode with default items and plan-based auto items"
```

---
### Task 4: 도면 SVG 옵션(PDF 재사용 준비)

**Files:**
- Modify: `src/export/planSvg.ts`, `src/export/planSvg.test.ts`

**Interfaces:**
- Consumes: Task 1 `FIXTURE_GLYPH`, `FIXTURE_KINDS`, `FIXTURE_LABEL`, `FIXTURE_R_CM`.
- Produces:
  - `type PlanSvgOptions = { fontFamily?: string; header?: boolean; items?: 'name' | 'number' | 'faint' | 'none'; dimensions?: boolean; fixtures?: boolean; highlightIds?: string[] }`
  - `planSvg(plan: Plan, options?: PlanSvgOptions): { svg: string; width: number; height: number }` — 옵션 없이 부르면 계획 3의 PNG와 같은 그림(글자 테두리만 두 겹 `<text>`로 바뀜)
  - `itemNumbers(plan: Plan): Map<string, number>` — 활성 배치안 순서대로 1부터
  - `pdfFileName(title: string, layoutName: string): string` — `homefit-<제목>-<배치안>.pdf`

- [ ] **Step 1: 테스트 수정·추가** — `src/export/planSvg.test.ts`

import 줄을 `import { escapeXml, exportFileName, itemNumbers, pdfFileName, planSvg, unverifiedCount } from './planSvg';`로 바꾼다.

`'글자는 모든 도형 위에 흰 테두리로 그린다'` 테스트의 마지막 단언 `expect(svg).toMatch(/<text[^>]*paint-order="stroke"[^>]*>3인 소파</);`를 다음 두 줄로 바꾼다(svg2pdf가 `paint-order`를 지원하지 않아 두 겹 글자로 바꾸는 이 계획의 결정 — Global Constraints 참고):

```ts
    expect(svg).not.toContain('paint-order');
    expect(svg).toMatch(/<text[^>]*stroke="#ffffff"[^>]*>3인 소파<\/text><text[^>]*fill="#1f2328"[^>]*>3인 소파<\/text>/);
```

파일 끝에 추가:

```ts
describe('planSvg 옵션', () => {
  const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
  const plan = withActiveItems(SAMPLE_PLAN, [sofa, washer]);

  it('글꼴 이름을 바꿀 수 있고 기본은 sans-serif', () => {
    expect(planSvg(plan).svg).toContain('font-family="sans-serif"');
    const pdf = planSvg(plan, { fontFamily: 'Pretendard' }).svg;
    expect(pdf).toContain('font-family="Pretendard"');
    expect(pdf).not.toContain('sans-serif');
  });

  it('header:false면 머리글을 빼고 높이가 줄어든다', () => {
    const r = planSvg(plan, { header: false });
    expect(r.svg).not.toContain('단위: cm');
    expect(r.width).toBe(1520);
    expect(r.height).toBe(1260 - 140);
  });

  it('items:number는 이름 대신 배치 순서 번호', () => {
    const { svg } = planSvg(plan, { items: 'number' });
    expect(svg).toContain('>1<');
    expect(svg).toContain('>2<');
    expect(svg).not.toContain('>3인 소파<');
    expect(itemNumbers(plan)).toEqual(new Map([['s', 1], ['wa', 2]]));
  });

  it('items:none은 가구를 그리지 않는다', () => {
    const { svg } = planSvg(plan, { items: 'none' });
    expect(svg).not.toContain('fill-opacity');
    expect(svg).not.toContain('>3인 소파<');
    expect(svg).toContain('>거실<');
  });

  it('items:faint는 흐리게 그리고 강조한 가구만 주황 테두리와 이름', () => {
    const { svg } = planSvg(plan, { items: 'faint', highlightIds: ['wa'] });
    expect(svg).toContain('fill-opacity="0.3"');
    expect(svg).not.toContain('fill-opacity="0.85"');
    expect(svg).toContain('stroke="#c2410c" stroke-width="3"');
    expect(svg).toContain('>그랑데 드럼세탁기<');
    expect(svg).not.toContain('>3인 소파<');
  });

  it('dimensions:false는 벽·개구부 치수를 뺀다', () => {
    const { svg } = planSvg(plan, { dimensions: false });
    expect(svg).not.toContain('>≈600<');
    expect(svg).not.toContain('>≈90<');
    expect(svg).toContain('>거실<');
  });

  it('fixtures:true는 설비 마커와 있는 종류만 범례로 그리고 높이를 늘린다', () => {
    const withFx = {
      ...plan,
      fixtures: [
        { id: 'f1', kind: 'outlet-dedicated' as const, pos: { x: 356, y: 200 }, wallId: 'w5', height: 30 },
        { id: 'f2', kind: 'switch' as const, pos: { x: 10, y: 100 }, height: 120 },
      ],
    };
    const off = planSvg(withFx);
    expect(off.svg).not.toContain('>전<');
    expect(off.svg).not.toContain('<circle');
    const on = planSvg(withFx, { fixtures: true });
    expect(on.svg).toContain('<circle cx="356" cy="200" r="9"');
    expect(on.svg).toContain('<rect x="1" y="91" width="18" height="18"');
    expect(on.svg).toContain('>전<');
    expect(on.svg).toContain('>전용회로 콘센트<');
    expect(on.svg).toContain('>스위치<');
    expect(on.svg).not.toContain('>방수 콘센트<');
    expect(on.height).toBe(off.height + 100);
  });

  it('pdfFileName', () => {
    expect(pdfFileName('샘플 평면', 'A안')).toBe('homefit-샘플-평면-A안.pdf');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/export/planSvg.test.ts`
Expected: FAIL — `itemNumbers`/`pdfFileName` 없음, `paint-order` 단언 실패

- [ ] **Step 3: 구현** — `src/export/planSvg.ts` 전체를 다음으로 바꾼다

```ts
import { findProduct } from '../catalog/products';
import { itemColor, MISSING_COLOR } from '../editor2d/itemColor';
import { pointsAttr, sectorPath } from '../editor2d/svg';
import { FIXTURE_GLYPH, FIXTURE_KINDS, FIXTURE_LABEL, FIXTURE_R_CM, type FixtureKind } from '../electrical/fixtures';
import { planBounds } from '../geometry/bounds';
import { doorSwing } from '../geometry/clearance';
import { corners, itemObb } from '../geometry/obb';
import { openingObb, wallDir, wallLength, wallObb } from '../geometry/walls';
import { activeItems, activeLayout } from '../model/layout';
import type { Plan } from '../model/schema';

export const EXPORT_PX_PER_CM = 2;

const MARGIN = 80;
const HEADER = 70;
const LEGEND = 50;
const LEGEND_STEP = 150;
const HIGHLIGHT = '#c2410c';

const CONTROL_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

export function escapeXml(s: string): string {
  return s
    .replace(CONTROL_CHARS, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function unverifiedCount(plan: Plan): number {
  return (
    plan.walls.filter((w) => !w.verified).length +
    plan.openings.filter((o) => !o.verified).length +
    activeItems(plan).filter((i) => !i.verified).length
  );
}

const safeFilePart = (s: string) => s.replace(/[\\/:*?"<>|\s\u0000-\u001F]+/g, '-');

export function exportFileName(title: string, layoutName: string, kind: '2d' | '3d'): string {
  return `homefit-${safeFilePart(title)}-${safeFilePart(layoutName)}-${kind}.png`;
}

export function pdfFileName(title: string, layoutName: string): string {
  return `homefit-${safeFilePart(title)}-${safeFilePart(layoutName)}.pdf`;
}

export type PlanSvgOptions = {
  fontFamily?: string; // PDF는 jsPDF에 등록한 'Pretendard'
  header?: boolean; // 제목·단위 머리글
  items?: 'name' | 'number' | 'faint' | 'none'; // 가구 표시 방식
  dimensions?: boolean; // 벽 길이·개구부 폭
  fixtures?: boolean; // 전기 설비 마커와 범례
  highlightIds?: string[]; // 주황 테두리로 강조할 가구
};

// 배치도 번호 = 제품 목록 번호
export function itemNumbers(plan: Plan): Map<string, number> {
  return new Map(activeItems(plan).map((item, i) => [item.id, i + 1]));
}

const mark = (n: number, verified: boolean | undefined) => (verified ? `${n}` : `≈${n}`);

function glyphShape(kind: FixtureKind, cx: number, cy: number): string {
  const g = FIXTURE_GLYPH[kind];
  const r = FIXTURE_R_CM;
  return g.shape === 'circle'
    ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="2"/>`
    : `<rect x="${cx - r}" y="${cy - r}" width="${r * 2}" height="${r * 2}" fill="${g.fill}" stroke="${g.stroke}" stroke-width="2"/>`;
}

export function planSvg(plan: Plan, options: PlanSvgOptions = {}): { svg: string; width: number; height: number } {
  const { fontFamily = 'sans-serif', header = true, items: itemMode = 'name', dimensions = true, fixtures = false, highlightIds = [] } = options;
  const font = escapeXml(fontFamily);
  const text = (x: number, y: number, size: number, value: string, attrs: string) =>
    `<text x="${x}" y="${y}" font-size="${size}" font-family="${font}" ${attrs}>${escapeXml(value)}</text>`;
  // svg2pdf는 paint-order를 무시하므로 흰 테두리 글자를 먼저, 본 글자를 그 위에 그린다
  const label = (x: number, y: number, size: number, value: string, fill: string, extra: string) =>
    text(x, y, size, value, `fill="#ffffff" stroke="#ffffff" stroke-width="3" stroke-linejoin="round" ${extra}`) +
    text(x, y, size, value, `fill="${fill}" ${extra}`);

  const b = planBounds(plan);
  const legendKinds = fixtures ? FIXTURE_KINDS.filter((k) => plan.fixtures.some((f) => f.kind === k)) : [];
  const headerH = header ? HEADER : 0;
  const legendH = legendKinds.length > 0 ? LEGEND : 0;
  const x0 = b.minX - MARGIN;
  const y0 = b.minY - MARGIN - headerH;
  const w = b.maxX - b.minX + MARGIN * 2;
  const h = b.maxY - b.minY + MARGIN * 2 + headerH + legendH;
  const center = 'text-anchor="middle" dominant-baseline="middle"';
  const parts: string[] = [`<rect x="${x0}" y="${y0}" width="${w}" height="${h}" fill="#ffffff"/>`];

  for (const wall of plan.walls) {
    parts.push(`<polygon points="${pointsAttr(corners(wallObb(wall)))}" fill="#3f3a33"/>`);
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
  }

  const highlight = new Set(highlightIds);
  const numbers = itemNumbers(plan);
  const placed = activeItems(plan).map((item) => ({ item, product: findProduct(plan, item.productId) }));
  if (itemMode !== 'none') {
    for (const { item, product } of placed) {
      const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
      const fill = product ? itemColor(product, item.variantId) : MISSING_COLOR;
      const opacity = itemMode === 'faint' ? 0.3 : 0.85;
      const stroke = highlight.has(item.id) ? `stroke="${HIGHLIGHT}" stroke-width="3"` : 'stroke="#6b5e4b" stroke-width="1.5"';
      parts.push(
        `<polygon points="${pointsAttr(corners(itemObb(item.x, item.y, item.rotation, dims.w, dims.d)))}" fill="${fill}" fill-opacity="${opacity}" ${stroke}/>`,
      );
    }
  }

  if (fixtures) for (const f of plan.fixtures) parts.push(glyphShape(f.kind, f.pos.x, f.pos.y));

  if (dimensions) {
    for (const wall of plan.walls) {
      const len = Math.round(wallLength(wall));
      if (len === 0) continue;
      const u = wallDir(wall);
      const off = wall.thickness / 2 + 14;
      parts.push(label((wall.a.x + wall.b.x) / 2 - u.y * off, (wall.a.y + wall.b.y) / 2 + u.x * off, 12, mark(len, wall.verified), '#3f3a33', center));
    }
    for (const o of plan.openings) {
      const wall = wallById.get(o.wallId);
      if (!wall) continue;
      const u = wallDir(wall);
      const mid = o.offset + o.width / 2;
      const off = -(wall.thickness / 2 + 14);
      parts.push(label(wall.a.x + u.x * mid - u.y * off, wall.a.y + u.y * mid + u.x * off, 11, mark(o.width, o.verified), '#4f6b8a', center));
    }
  }

  for (const r of plan.rooms) parts.push(label(r.label.x, r.label.y, 18, r.name, '#6b5e4b', center));

  for (const { item, product } of placed) {
    if (itemMode === 'name') {
      const dims = product?.dims ?? { w: 50, d: 50, h: 50 };
      parts.push(label(item.x, item.y - 7, 12, product?.name ?? '알 수 없는 제품', '#1f2328', center));
      const size = `${dims.w}×${dims.d}`;
      parts.push(label(item.x, item.y + 9, 11, item.verified ? size : `≈${size}`, '#1f2328', center));
    } else if (itemMode === 'number') {
      parts.push(label(item.x, item.y, 16, String(numbers.get(item.id)), '#1f2328', `font-weight="bold" ${center}`));
    } else if (itemMode === 'faint' && highlight.has(item.id)) {
      parts.push(label(item.x, item.y, 12, product?.name ?? '알 수 없는 제품', HIGHLIGHT, center));
    }
  }

  if (fixtures) {
    for (const f of plan.fixtures) {
      const g = FIXTURE_GLYPH[f.kind];
      parts.push(text(f.pos.x, f.pos.y, 10, g.letter, `fill="${g.letterFill}" font-weight="bold" ${center}`));
    }
    const ly = b.maxY + MARGIN + LEGEND / 2;
    legendKinds.forEach((k, i) => {
      const cx = b.minX + i * LEGEND_STEP + FIXTURE_R_CM;
      const g = FIXTURE_GLYPH[k];
      parts.push(glyphShape(k, cx, ly));
      parts.push(text(cx, ly, 10, g.letter, `fill="${g.letterFill}" font-weight="bold" ${center}`));
      parts.push(text(cx + FIXTURE_R_CM + 8, ly, 14, FIXTURE_LABEL[k], 'fill="#1f2328" dominant-baseline="middle"'));
    });
  }

  if (header) {
    parts.push(text(x0 + 20, y0 + 30, 22, `${plan.info.title} · ${activeLayout(plan).name}`, 'fill="#1f2328" font-weight="bold"'));
    parts.push(text(x0 + 20, y0 + 56, 14, `단위: cm · ≈ 표시는 실측 미확인 치수 (${unverifiedCount(plan)}개)`, 'fill="#6b7280"'));
  }

  const width = Math.round(w * EXPORT_PX_PER_CM);
  const height = Math.round(h * EXPORT_PX_PER_CM);
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${x0} ${y0} ${w} ${h}">${parts.join('')}</svg>`,
    width,
    height,
  };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm run typecheck && npx vitest run && npx playwright test e2e/layouts.spec.ts`
Expected: 모두 통과(2D PNG 내보내기 e2e 포함)

- [ ] **Step 5: Commit**

```bash
git add src/export/planSvg.ts src/export/planSvg.test.ts
git commit -m "feat: planSvg options for PDF drawings and two-layer label halo"
```

---

### Task 5: PDF 페이지 구성(순수 함수)

**Files:**
- Create: `src/export/pages.ts`, `src/export/pages.test.ts`

**Interfaces:**
- Consumes: Task 3 `PHASES`, `checklistItems`, `checklistEntry`; Task 1 `DEDICATED_RADIUS_CM`, `FIXTURE_LABEL`, `fixtureSummary`, `missingDedicatedCircuit`; Task 3 `wallReferenceText`; Task 4 `planSvg`, `itemNumbers`, `pdfFileName`, `unverifiedCount`.
- Produces (Task 6·7이 사용):
  - 상수 `PDF_FONT_FAMILY = 'Pretendard'`, `PAGE = { width: 297, height: 210, margin: 15, top: 28, bottom: 14 }`, `CONTENT_WIDTH`, `TABLE_FONT_PT`, `NOTE_FONT_PT`, `LINE_MM`, `ROW_PAD_MM`, `HEADER_ROW_MM`, `TABLE_BODY_MM`, `MAX_CELL_LINES`, `MAX_NOTES`, `COVER_LABEL_MM`, `COVER_LINE_MM`, `NOTE_LINE_MM`
  - `rowHeightMm(lines: number): number`, `textUnits(s: string): number`, `unitsForWidth(widthMm: number, fontPt?: number): number`, `wrapText(text: string, maxUnits: number): string[]`, `clampLines(lines: string[], max: number): string[]`
  - 타입 `TableColumn`, `CoverPage`, `DrawingPage`, `TablePage`, `ViewsPage`, `PdfPage`, `PdfView = { label: string; dataUrl: string }`, `PdfInput = { views: PdfView[]; now: Date }`, `PdfDocument = { header: string; fileName: string; pages: PdfPage[] }`
  - `tablePages(title: string, columns: TableColumn[], cells: string[][], emptyText: string): TablePage[]`
  - `buildPdf(plan: Plan, input: PdfInput): PdfDocument`

- [ ] **Step 1: 실패하는 테스트 작성** — `src/export/pages.test.ts`

```ts
import { describe, expect, it } from 'vitest';
import { withActiveItems } from '../model/layout';
import { SAMPLE_PLAN } from '../model/samplePlan';
import type { Plan, Product } from '../model/schema';
import { buildPdf, clampLines, MAX_CELL_LINES, rowHeightMm, TABLE_BODY_MM, textUnits, wrapText, type TablePage } from './pages';

const NOW = new Date(2026, 9, 8);
const input = { views: [], now: NOW };
const sofa = (id: string) => ({ id, productId: 'sofa-3seat', variantId: 'gray', x: 175, y: 200, rotation: 0 });
const washer = { id: 'wa', productId: 'samsung-grande-washer-sample', variantId: 'white', x: 300, y: 200, rotation: 0 };
const usedMm = (p: TablePage) => p.rows.reduce((sum, r) => sum + rowHeightMm(Math.max(...r.map((c) => c.length))), 0);

describe('wrapText / clampLines', () => {
  it('한글은 1, 그 밖은 0.6 너비로 세어 단어 단위로 줄을 바꾼다', () => {
    expect(textUnits('가a')).toBeCloseTo(1.6);
    expect(wrapText('가나다 라마', 3)).toEqual(['가나다', '라마']);
    expect(wrapText('abc def', 2)).toEqual(['abc', 'def']);
    expect(wrapText('가나다라마바', 4)).toEqual(['가나다라', '마바']);
    expect(wrapText('', 4)).toEqual(['']);
    expect(wrapText('가\n나', 4)).toEqual(['가', '나']);
  });

  it('줄 수를 넘으면 자르고 …으로 끝낸다', () => {
    const lines = wrapText('가'.repeat(100), 10);
    expect(lines).toHaveLength(10);
    expect(clampLines(lines, 3)).toEqual(['가'.repeat(10), '가'.repeat(10), `${'가'.repeat(9)}…`]);
    expect(clampLines(['a'], 3)).toEqual(['a']);
  });
});

describe('buildPdf', () => {
  it('쪽 순서와 제목, 머리글, 파일명', () => {
    const doc = buildPdf(withActiveItems(SAMPLE_PLAN, [washer]), input);
    expect(doc.header).toBe('샘플 평면 · A안');
    expect(doc.fileName).toBe('homefit-샘플-평면-A안.pdf');
    expect(doc.pages.slice(0, 7).map((p) => [p.kind, p.title])).toEqual([
      ['cover', '샘플 평면'],
      ['drawing', '치수 평면도'],
      ['drawing', '가구·가전 배치도 (A안)'],
      ['drawing', '전기 계획도'],
      ['table', '빌트인 상세'],
      ['table', '제품 목록 (A안)'],
      ['views', '3D 보기'],
    ]);
    const rest = doc.pages.slice(7);
    expect(rest.length).toBeGreaterThanOrEqual(1);
    expect(rest.every((p) => p.kind === 'table' && p.title.startsWith('공사 체크리스트'))).toBe(true);
  });

  it('도면 SVG는 Pretendard만 쓰고 머리글·배경 이미지를 넣지 않는다', () => {
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [washer]),
      background: { imageRef: 'i', widthPx: 10, heightPx: 10, cmPerPx: 1, offsetX: 0, offsetY: 0, rotation: 0, opacity: 1 },
    };
    const drawings = buildPdf(plan, input).pages.filter((p) => p.kind === 'drawing');
    expect(drawings).toHaveLength(3);
    for (const d of drawings) {
      expect(d.svg).toContain('font-family="Pretendard"');
      expect(d.svg).not.toContain('sans-serif');
      expect(d.svg).not.toContain('<image');
      expect(d.svg).not.toContain('단위: cm ·');
    }
  });

  it('활성 배치안만 담고 이름을 밝힌다', () => {
    const plan: Plan = {
      ...SAMPLE_PLAN,
      layouts: [
        { id: 'layout-a', name: 'A안', items: [washer] },
        { id: 'layout-b', name: '창가안', items: [sofa('s1')] },
      ],
      activeLayoutId: 'layout-b',
    };
    const doc = buildPdf(plan, input);
    expect(doc.header).toBe('샘플 평면 · 창가안');
    const products = doc.pages.find((p) => p.title.startsWith('제품 목록')) as TablePage;
    expect(products.title).toBe('제품 목록 (창가안)');
    expect(products.rows.map((r) => r[2].join(''))).toEqual(['3인 소파']);
    const cover = doc.pages[0];
    expect(cover.kind === 'cover' && cover.rows.find((r) => r.label === '배치안')?.lines).toEqual(['창가안']);
  });

  it('표지는 비어 있는 정보를 빼고 작성일을 넣는다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, info: { title: '우리 집', address: '어딘가 1', supplyArea: 93.6, exclusiveArea: 59.9, builtYear: 1999 } };
    const cover = buildPdf(plan, input).pages[0];
    if (cover.kind !== 'cover') throw new Error('cover 아님');
    expect(cover.title).toBe('우리 집');
    expect(cover.rows.map((r) => [r.label, r.lines.join(' ')])).toEqual([
      ['주소', '어딘가 1'],
      ['면적', '공급 93.6m² / 전용 59.9m²'],
      ['준공연도', '1999년'],
      ['배치안', 'A안'],
      ['작성일', '2026-10-08'],
    ]);
  });

  it('제품 목록: 번호·모델·이름·치수(미확인 ≈)·소비전력·전용회로', () => {
    const products = buildPdf(withActiveItems(SAMPLE_PLAN, [sofa('s1'), washer]), input).pages[5] as TablePage;
    expect(products.columns.map((c) => c.label)).toEqual(['번호', '모델명', '이름', 'W×D×H (cm)', '소비전력', '전용회로']);
    expect(products.rows.map((r) => r.map((c) => c.join(' ')))).toEqual([
      ['1', '-', '3인 소파', '≈210×90×80', '-', '-'],
      ['2', '그랑데 세탁기 (샘플 치수)', '그랑데 드럼세탁기', '≈70×85×110', '2000W', '필요 (콘센트 없음)'],
    ]);
  });

  it('빌트인 상세: 번호·제품·치수·벽 기준 위치', () => {
    const builtIn: Product = {
      id: 'custom-dw', brand: 'custom', model: '', name: '식기세척기', category: 'kitchen',
      dims: { w: 60, d: 60, h: 85 }, variants: [{ id: 'v', label: '기본', colors: {} }],
      builder: 'box', clearances: [], builtIn: true, mount: 'floor',
    };
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [sofa('s1'), { id: 'dw', productId: 'custom-dw', variantId: 'v', x: 100, y: 60, rotation: 0 }]),
      customProducts: [builtIn],
    };
    const table = buildPdf(plan, input).pages[4] as TablePage;
    expect(table.rows.map((r) => r.map((c) => c.join(' ')))).toEqual([
      ['2', '식기세척기', '60×60×85', '왼쪽 벽까지 60cm, 오른쪽 벽까지 214cm, 뒤 벽까지 20cm'],
    ]);
  });

  it('제품이 많으면 여러 쪽으로 나누고 행을 잃지 않는다', () => {
    const many = Array.from({ length: 60 }, (_, i) => sofa(`s${i}`));
    const pages = buildPdf(withActiveItems(SAMPLE_PLAN, many), input).pages.filter((p) => p.title.startsWith('제품 목록')) as TablePage[];
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[1].title).toBe('제품 목록 (A안) (계속)');
    expect(pages.flatMap((p) => p.rows.map((r) => r[0][0]))).toEqual(many.map((_, i) => String(i + 1)));
    for (const p of pages) expect(usedMm(p)).toBeLessThanOrEqual(TABLE_BODY_MM);
  });

  it('아주 긴 메모는 칸 높이 안에서 자르고 …으로 끝낸다', () => {
    const plan: Plan = { ...SAMPLE_PLAN, checklist: [{ itemId: 'demo-1', checked: true, memo: '메모'.repeat(2000) }] };
    const pages = buildPdf(plan, input).pages.filter((p) => p.title.startsWith('공사 체크리스트')) as TablePage[];
    const row = pages.flatMap((p) => p.rows).find((r) => r[2].join('').includes('철거 범위'))!;
    expect(row[0]).toEqual(['완료']);
    expect(row[1]).toEqual(['철거']);
    expect(row[3]).toHaveLength(MAX_CELL_LINES);
    expect(row[3].at(-1)!.endsWith('…')).toBe(true);
    for (const p of pages) expect(usedMm(p)).toBeLessThanOrEqual(TABLE_BODY_MM);
  });

  it('체크리스트 자동 항목은 [자동]으로 표시한다', () => {
    const pages = buildPdf(withActiveItems(SAMPLE_PLAN, [washer]), input).pages.filter((p) => p.title.startsWith('공사 체크리스트')) as TablePage[];
    const texts = pages.flatMap((p) => p.rows.map((r) => r[2].join('')));
    expect(texts.some((t) => t.startsWith('[자동] 전용회로 확인: 그랑데 드럼세탁기'))).toBe(true);
    expect(pages[0].columns.map((c) => c.label)).toEqual(['완료', '공정', '항목', '메모']);
  });

  it('빌트인이 없으면 안내 문구, 3D 캡처가 없으면 안내 문구', () => {
    const doc = buildPdf(SAMPLE_PLAN, input);
    const builtin = doc.pages[4] as TablePage;
    expect(builtin.rows).toEqual([]);
    expect(builtin.emptyText).toBe('빌트인 항목이 없습니다');
    const views = doc.pages[6];
    expect(views.kind === 'views' && views.views).toEqual([]);
    const withViews = buildPdf(SAMPLE_PLAN, { views: [{ label: '위에서 본 전체', dataUrl: 'data:image/jpeg;base64,AA' }], now: NOW }).pages[6];
    expect(withViews.kind === 'views' && withViews.views.map((v) => v.label)).toEqual(['위에서 본 전체']);
  });

  it('전기 계획도 주석: 설비 요약, 전용회로 가전, 콘센트 없음 경고, 설비 메모', () => {
    const plan: Plan = {
      ...withActiveItems(SAMPLE_PLAN, [washer]),
      fixtures: [{ id: 'f', kind: 'outlet', pos: { x: 10, y: 100 }, wallId: 'w4', height: 30, memo: 'TV 뒤' }],
    };
    const electric = buildPdf(plan, input).pages[3];
    expect(electric.kind === 'drawing' && electric.notes).toEqual([
      '설비: 콘센트 1개',
      '전용회로 필요 가전(주황 테두리): 그랑데 드럼세탁기',
      '주의: 그랑데 드럼세탁기 주변 150cm 이내에 전용회로 콘센트가 없습니다',
      '콘센트 (높이 30cm): TV 뒤',
    ]);
  });

  it('주석이 많으면 8줄로 줄이고 나머지 줄 수를 알린다', () => {
    const fixtures = Array.from({ length: 12 }, (_, i) => ({ id: `f${i}`, kind: 'light' as const, pos: { x: 100 + i, y: 100 }, height: 230, memo: `메모 ${i}` }));
    const electric = buildPdf({ ...SAMPLE_PLAN, fixtures }, input).pages[3];
    if (electric.kind !== 'drawing') throw new Error('drawing 아님');
    expect(electric.notes).toHaveLength(8);
    expect(electric.notes.at(-1)).toBe('외 7줄은 앱에서 확인하세요');
  });
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/export/pages.test.ts`
Expected: FAIL — `Cannot find module './pages'`

- [ ] **Step 3: 구현** — `src/export/pages.ts`

```ts
import { findProduct } from '../catalog/products';
import { PHASES } from '../checklist/defaults';
import { checklistEntry, checklistItems } from '../checklist/items';
import { DEDICATED_RADIUS_CM, FIXTURE_LABEL, fixtureSummary, missingDedicatedCircuit } from '../electrical/fixtures';
import { wallReferenceText } from '../geometry/wallReference';
import { activeItems, activeLayout } from '../model/layout';
import type { Plan } from '../model/schema';
import { itemNumbers, pdfFileName, planSvg, unverifiedCount } from './planSvg';

export const PDF_FONT_FAMILY = 'Pretendard';

// A4 가로, mm
export const PAGE = { width: 297, height: 210, margin: 15, top: 28, bottom: 14 } as const;
export const CONTENT_WIDTH = PAGE.width - PAGE.margin * 2;
export const TABLE_FONT_PT = 10;
export const NOTE_FONT_PT = 9;
export const LINE_MM = 5.2;
export const ROW_PAD_MM = 2.4;
export const HEADER_ROW_MM = 8;
export const TABLE_BODY_MM = PAGE.height - PAGE.top - PAGE.bottom - HEADER_ROW_MM;
export const MAX_CELL_LINES = Math.floor((TABLE_BODY_MM - ROW_PAD_MM) / LINE_MM);
export const MAX_NOTES = 8;
export const NOTE_LINE_MM = 5;
export const COVER_LABEL_MM = 35;
export const COVER_LINE_MM = 6.5;
const COVER_FONT_PT = 12;
const PT_MM = 0.3528;

export const rowHeightMm = (lines: number) => lines * LINE_MM + ROW_PAD_MM;

// 글자 너비 근사: 한글·한자 등은 1em, 그 밖은 0.6em(보수적으로 넉넉하게)
const unitOf = (ch: string) => (ch.charCodeAt(0) >= 0x1100 ? 1 : 0.6);

export function textUnits(s: string): number {
  let n = 0;
  for (const ch of s) n += unitOf(ch);
  return n;
}

export function unitsForWidth(widthMm: number, fontPt = TABLE_FONT_PT): number {
  return Math.max(1, Math.floor((widthMm - 3) / (fontPt * PT_MM)));
}

export function wrapText(text: string, maxUnits: number): string[] {
  const lines: string[] = [];
  for (const para of text.split('\n')) {
    let line = '';
    for (const word of para.split(' ')) {
      const candidate = line ? `${line} ${word}` : word;
      if (textUnits(candidate) <= maxUnits) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      let chunk = '';
      for (const ch of word) {
        if (chunk && textUnits(chunk + ch) > maxUnits) {
          lines.push(chunk);
          chunk = '';
        }
        chunk += ch;
      }
      line = chunk;
    }
    lines.push(line);
  }
  return lines;
}

export function clampLines(lines: string[], max: number): string[] {
  if (lines.length <= max) return lines;
  const kept = lines.slice(0, max);
  kept[max - 1] = `${[...kept[max - 1]].slice(0, -1).join('')}…`;
  return kept;
}

export type TableColumn = { label: string; width: number }; // width: mm
export type CoverPage = { kind: 'cover'; title: string; rows: { label: string; lines: string[] }[] };
export type DrawingPage = { kind: 'drawing'; title: string; svg: string; width: number; height: number; notes: string[] };
export type TablePage = { kind: 'table'; title: string; columns: TableColumn[]; rows: string[][][]; emptyText: string };
export type PdfView = { label: string; dataUrl: string };
export type ViewsPage = { kind: 'views'; title: string; views: PdfView[]; emptyText: string };
export type PdfPage = CoverPage | DrawingPage | TablePage | ViewsPage;
export type PdfInput = { views: PdfView[]; now: Date };
export type PdfDocument = { header: string; fileName: string; pages: PdfPage[] };

export function tablePages(title: string, columns: TableColumn[], cells: string[][], emptyText: string): TablePage[] {
  const rows = cells.map((r) => r.map((c, i) => clampLines(wrapText(c, unitsForWidth(columns[i].width)), MAX_CELL_LINES)));
  const chunks: string[][][][] = [];
  let current: string[][][] = [];
  let used = 0;
  for (const row of rows) {
    const h = rowHeightMm(Math.max(...row.map((c) => c.length)));
    if (current.length > 0 && used + h > TABLE_BODY_MM) {
      chunks.push(current);
      current = [];
      used = 0;
    }
    current.push(row);
    used += h;
  }
  chunks.push(current);
  return chunks.map((chunk, i) => ({ kind: 'table', title: i === 0 ? title : `${title} (계속)`, columns, rows: chunk, emptyText }));
}

function noteLines(notes: string[]): string[] {
  const lines = notes.flatMap((n) => wrapText(n, unitsForWidth(CONTENT_WIDTH, NOTE_FONT_PT)));
  return lines.length <= MAX_NOTES ? lines : [...lines.slice(0, MAX_NOTES - 1), `외 ${lines.length - MAX_NOTES + 1}줄은 앱에서 확인하세요`];
}

const pad = (n: number) => String(n).padStart(2, '0');
const formatDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function coverRows(plan: Plan, now: Date): CoverPage['rows'] {
  const i = plan.info;
  const layout = activeLayout(plan);
  const area = [i.supplyArea !== undefined ? `공급 ${i.supplyArea}m²` : '', i.exclusiveArea !== undefined ? `전용 ${i.exclusiveArea}m²` : '']
    .filter(Boolean)
    .join(' / ');
  const rows: [string, string | undefined, number][] = [
    ['주소', i.address, 2],
    ['면적', area, 1],
    ['준공연도', i.builtYear !== undefined ? `${i.builtYear}년` : undefined, 1],
    ['입주 예정일', i.moveInDate, 1],
    ['공사 범위', i.scope, 2],
    ['배치안', layout.memo ? `${layout.name} — ${layout.memo}` : layout.name, 2],
    ['메모', i.notes, 5],
    ['작성일', formatDate(now), 1],
  ];
  const units = unitsForWidth(CONTENT_WIDTH - COVER_LABEL_MM, COVER_FONT_PT);
  return rows
    .filter((r): r is [string, string, number] => !!r[1]?.trim())
    .map(([label, value, max]) => ({ label, lines: clampLines(wrapText(value.trim(), units), max) }));
}

export function buildPdf(plan: Plan, input: PdfInput): PdfDocument {
  const resolve = (id: string) => findProduct(plan, id);
  const layout = activeLayout(plan);
  const base = { fontFamily: PDF_FONT_FAMILY, header: false } as const;
  const numbers = itemNumbers(plan);
  const placed = activeItems(plan).flatMap((item) => {
    const product = resolve(item.productId);
    return product ? [{ item, product }] : [];
  });
  const missing = new Set(missingDedicatedCircuit(plan, resolve));
  const dedicated = placed.filter((p) => p.product.power?.dedicatedCircuit);

  const drawing = (title: string, svg: ReturnType<typeof planSvg>, notes: string[]): DrawingPage => ({
    kind: 'drawing',
    title,
    svg: svg.svg,
    width: svg.width,
    height: svg.height,
    notes: noteLines(notes),
  });

  const pages: PdfPage[] = [
    { kind: 'cover', title: plan.info.title, rows: coverRows(plan, input.now) },
    drawing('치수 평면도', planSvg(plan, { ...base, items: 'none' }), [
      '단위: cm · 벽 길이는 벽 중심선 기준',
      `≈ 표시는 실측 미확인 치수 (${unverifiedCount(plan)}개)`,
    ]),
    drawing(`가구·가전 배치도 (${layout.name})`, planSvg(plan, { ...base, items: 'number' }), [
      '번호는 제품 목록의 번호와 같습니다',
      '회색 부채꼴은 방문 열림 반경입니다',
    ]),
    drawing('전기 계획도', planSvg(plan, { ...base, items: 'faint', fixtures: true, highlightIds: dedicated.map((p) => p.item.id) }), [
      plan.fixtures.length > 0 ? `설비: ${fixtureSummary(plan.fixtures)}` : '배치된 전기 설비가 없습니다',
      dedicated.length > 0 ? `전용회로 필요 가전(주황 테두리): ${dedicated.map((p) => p.product.name).join(', ')}` : '전용회로가 필요한 가전이 없습니다',
      ...dedicated
        .filter((p) => missing.has(p.item.id))
        .map((p) => `주의: ${p.product.name} 주변 ${DEDICATED_RADIUS_CM}cm 이내에 전용회로 콘센트가 없습니다`),
      ...plan.fixtures.filter((f) => f.memo).map((f) => `${FIXTURE_LABEL[f.kind]} (높이 ${f.height}cm): ${f.memo}`),
    ]),
    ...tablePages(
      '빌트인 상세',
      [
        { label: '번호', width: 15 },
        { label: '제품', width: 70 },
        { label: 'W×D×H (cm)', width: 40 },
        { label: '벽 기준 위치', width: 142 },
      ],
      placed
        .filter((p) => p.product.builtIn)
        .map(({ item, product }) => [
          String(numbers.get(item.id)),
          product.model ? `${product.name}\n${product.model}` : product.name,
          `${product.dims.w}×${product.dims.d}×${product.dims.h}`,
          wallReferenceText(plan, item, product),
        ]),
      '빌트인 항목이 없습니다',
    ),
    ...tablePages(
      `제품 목록 (${layout.name})`,
      [
        { label: '번호', width: 15 },
        { label: '모델명', width: 75 },
        { label: '이름', width: 60 },
        { label: 'W×D×H (cm)', width: 42 },
        { label: '소비전력', width: 35 },
        { label: '전용회로', width: 40 },
      ],
      placed.map(({ item, product }) => {
        const dims = `${product.dims.w}×${product.dims.d}×${product.dims.h}`;
        const circuit = product.power?.dedicatedCircuit ? (missing.has(item.id) ? '필요 (콘센트 없음)' : '필요') : '-';
        return [
          String(numbers.get(item.id)),
          product.model || '-',
          product.name,
          item.verified ? dims : `≈${dims}`,
          product.power ? `${product.power.watts}W` : '-',
          circuit,
        ];
      }),
      '배치된 제품이 없습니다',
    ),
    { kind: 'views', title: '3D 보기', views: input.views, emptyText: '3D 화면을 캡처하지 못했습니다(WebGL 미지원). 앱의 3D 보기에서 확인하세요.' },
    ...tablePages(
      '공사 체크리스트',
      [
        { label: '완료', width: 15 },
        { label: '공정', width: 28 },
        { label: '항목', width: 150 },
        { label: '메모', width: 74 },
      ],
      checklistItems(plan, resolve).map((i) => {
        const entry = checklistEntry(plan, i.id);
        return [
          entry?.checked ? '완료' : '',
          PHASES.find((p) => p.id === i.phase)?.label ?? '',
          `${i.auto ? '[자동] ' : ''}${i.text}`,
          entry?.memo ?? '',
        ];
      }),
      '항목이 없습니다',
    ),
  ];

  return { header: `${plan.info.title} · ${layout.name}`, fileName: pdfFileName(plan.info.title, layout.name), pages };
}
```

- [ ] **Step 4: 통과 확인**

Run: `npm run typecheck && npx vitest run`
Expected: 통과

- [ ] **Step 5: Commit**

```bash
git add src/export/pages.ts src/export/pages.test.ts
git commit -m "feat: pure PDF page builder with wrapping and table pagination"
```

---

### Task 6: PDF 렌더러, 글꼴 지연 로드, 3D 시점 캡처

**Files:**
- Create: `src/export/pdfFont.ts`, `src/export/pdfFont.test.ts`, `src/export/pdf.ts`, `src/export/exportPdf.ts`
- Modify: `package.json`, `package-lock.json`, `src/scene3d/cameraFit.ts`, `src/scene3d/cameraFit.test.ts`, `src/scene3d/CaptureBridge.tsx`

**Interfaces:**
- Consumes: Task 5 전부(`PdfDocument`, 레이아웃 상수, `PDF_FONT_FAMILY`, `buildPdf`), `planBounds`, `cmToM`.
- Produces:
  - `pdfFont.ts`: `type PdfFonts = { regular: string; bold: string }`, `class PdfFontError extends Error`, `bytesToBase64(bytes: Uint8Array): string`, `loadPdfFonts(): Promise<PdfFonts>`, `resetPdfFontCache(): void`
  - `pdf.ts`: `type PdfResult = { blob: Blob; pageCount: number }`, `renderPdf(doc: PdfDocument, onProgress?: (done: number, total: number) => void): Promise<PdfResult>`
  - `cameraFit.ts`: `pdfViewPoses(b: Bounds): { label: string; fit: CameraFit }[]`
  - `CaptureBridge.tsx`: `captureViews: { current: ((fits: CameraFit[], width: number, height: number) => string[]) | null }` — JPEG data URL 배열
  - `exportPdf.ts`: `VIEW_SIZE = { width: 1200, height: 800 }`, `capturePdfViews(plan: Plan): PdfView[]`, `exportPdf(plan: Plan, onProgress?): Promise<{ blob: Blob; pageCount: number; fileName: string }>`

- [ ] **Step 1: 의존성 설치**

Run: `npm install jspdf@^4.2.1 svg2pdf.js@^2.8.1 pretendard@^1.3.9`
Expected: `package.json` `dependencies`에 세 개가 추가된다. 이 셋 말고 다른 패키지를 추가하지 않는다.

- [ ] **Step 2: 실패하는 테스트 작성**

`src/export/pdfFont.test.ts`:

```ts
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bytesToBase64, loadPdfFonts, PdfFontError, resetPdfFontCache } from './pdfFont';

afterEach(() => {
  vi.unstubAllGlobals();
  resetPdfFontCache();
});

describe('pdfFont', () => {
  it('bytesToBase64는 큰 배열도 Buffer와 같은 결과', () => {
    expect(bytesToBase64(new Uint8Array([104, 105]))).toBe('aGk=');
    const big = new Uint8Array(100_000).map((_, i) => i % 251);
    expect(bytesToBase64(big)).toBe(Buffer.from(big).toString('base64'));
  });

  it('두 글꼴을 base64로 받아 한 번만 내려받는다', async () => {
    const fetchMock = vi.fn(async (_url: string) => new Response(new Uint8Array([1, 2, 3])));
    vi.stubGlobal('fetch', fetchMock);
    const a = await loadPdfFonts();
    const b = await loadPdfFonts();
    expect(a).toEqual({ regular: 'AQID', bold: 'AQID' });
    expect(b).toBe(a);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toMatch(/Pretendard-Regular\.ttf/);
  });

  it('네트워크 실패는 PdfFontError이고, 다음 호출은 다시 내려받는다', async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError('network'))
      .mockImplementation(async () => new Response(new Uint8Array([1])));
    vi.stubGlobal('fetch', fetchMock);
    await expect(loadPdfFonts()).rejects.toBeInstanceOf(PdfFontError);
    await expect(loadPdfFonts()).resolves.toEqual({ regular: 'AQ==', bold: 'AQ==' });
  });

  it('HTTP 오류도 PdfFontError', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('missing', { status: 404 })));
    await expect(loadPdfFonts()).rejects.toBeInstanceOf(PdfFontError);
  });
});
```

`src/scene3d/cameraFit.test.ts`: import를 `import { fitPerspective, fitTop, fitTopZoom, pdfViewPoses } from './cameraFit';`로 바꾸고 `describe` 안에 추가:

```ts
  it('PDF용 시점 3개: 위에서, 오른쪽 앞, 왼쪽 뒤(중심 대칭)', () => {
    const poses = pdfViewPoses({ minX: 0, minY: 0, maxX: 600, maxY: 400 });
    expect(poses.map((p) => p.label)).toEqual(['위에서 본 전체', '오른쪽 앞에서', '왼쪽 뒤에서']);
    for (const p of poses) expect(p.fit.target).toEqual([3, 0, 2]);
    const [top, a, c] = poses.map((p) => p.fit.position);
    expect(top[0]).toBe(3);
    expect(top[2]).toBeCloseTo(2.01);
    expect(top[1]).toBeGreaterThan(6);
    expect(a[0] - 3).toBeCloseTo(-(c[0] - 3));
    expect(a[2] - 2).toBeCloseTo(-(c[2] - 2));
    expect(a[1]).toBeCloseTo(c[1]);
    expect(a[0]).toBeGreaterThan(3);
  });
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run src/export/pdfFont.test.ts src/scene3d/cameraFit.test.ts`
Expected: FAIL — `./pdfFont` 없음, `pdfViewPoses` 없음

- [ ] **Step 4: 구현**

`src/export/pdfFont.ts`:

```ts
import boldUrl from 'pretendard/dist/public/static/alternative/Pretendard-Bold.ttf?url';
import regularUrl from 'pretendard/dist/public/static/alternative/Pretendard-Regular.ttf?url';

export type PdfFonts = { regular: string; bold: string };

export class PdfFontError extends Error {
  constructor(message = '글꼴을 불러오지 못했습니다') {
    super(message);
    this.name = 'PdfFontError';
  }
}

export function bytesToBase64(bytes: Uint8Array): string {
  let s = '';
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) s += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  return btoa(s);
}

async function fetchBase64(url: string): Promise<string> {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new PdfFontError();
    return bytesToBase64(new Uint8Array(await res.arrayBuffer()));
  } catch (e) {
    throw e instanceof PdfFontError ? e : new PdfFontError();
  }
}

let cache: Promise<PdfFonts> | null = null;

// PDF를 만들 때만 내려받는다(약 5MB). 실패한 시도는 캐시하지 않아 "다시 시도"가 새로 내려받는다
export function loadPdfFonts(): Promise<PdfFonts> {
  if (!cache) {
    const p = Promise.all([fetchBase64(regularUrl), fetchBase64(boldUrl)]).then(([regular, bold]) => ({ regular, bold }));
    cache = p;
    p.catch(() => {
      if (cache === p) cache = null;
    });
  }
  return cache;
}

export function resetPdfFontCache(): void {
  cache = null;
}
```

`src/scene3d/cameraFit.ts` 끝에 추가:

```ts
const PDF_FOV_HALF = (25 * Math.PI) / 180; // CaptureBridge 카메라 fov 50

export function pdfViewPoses(b: Bounds): { label: string; fit: CameraFit }[] {
  const t = center(b);
  const span = cmToM(Math.max(b.maxX - b.minX, b.maxY - b.minY));
  const topH = (span * 0.6) / Math.tan(PDF_FOV_HALF) + 2;
  const d = span * 1.1 + 2;
  return [
    { label: '위에서 본 전체', fit: { position: [t[0], topH, t[2] + 0.01], target: t } },
    { label: '오른쪽 앞에서', fit: { position: [t[0] + d * 0.7, d * 0.75, t[2] + d * 0.7], target: t } },
    { label: '왼쪽 뒤에서', fit: { position: [t[0] - d * 0.7, d * 0.75, t[2] - d * 0.7], target: t } },
  ];
}
```

`src/scene3d/CaptureBridge.tsx` 전체:

```tsx
import { useThree } from '@react-three/fiber';
import { useEffect } from 'react';
import * as THREE from 'three';
import type { CameraFit } from './cameraFit';

export const capture3d: { current: (() => HTMLCanvasElement) | null } = { current: null };
export const captureViews: { current: ((fits: CameraFit[], width: number, height: number) => string[]) | null } = { current: null };

export function CaptureBridge() {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera);
  useEffect(() => {
    capture3d.current = () => {
      gl.render(scene, camera);
      return gl.domElement;
    };
    // 화면 카메라·크기와 무관하게 지정 시점·고정 크기로 그린다(3D 보기가 숨겨져 있어도 동작). 끝나면 원래 크기로 되돌린다
    captureViews.current = (fits, width, height) => {
      const size = gl.getSize(new THREE.Vector2());
      const ratio = gl.getPixelRatio();
      const cam = new THREE.PerspectiveCamera(50, width / height, 0.1, 500);
      const out = document.createElement('canvas');
      out.width = width;
      out.height = height;
      const ctx = out.getContext('2d');
      if (!ctx) return [];
      try {
        gl.setPixelRatio(1);
        gl.setSize(width, height, false);
        return fits.map((fit) => {
          cam.position.set(...fit.position);
          cam.lookAt(...fit.target);
          cam.updateProjectionMatrix();
          gl.render(scene, cam);
          // 투명 배경이 JPEG에서 검게 나오지 않게 흰 바탕 위에 옮긴다
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(gl.domElement, 0, 0, width, height);
          return out.toDataURL('image/jpeg', 0.9);
        });
      } finally {
        gl.setPixelRatio(ratio);
        gl.setSize(size.x, size.y, false);
      }
    };
    return () => {
      capture3d.current = null;
      captureViews.current = null;
    };
  }, [gl, scene, camera]);
  return null;
}
```

`src/export/pdf.ts`:

```ts
import { jsPDF } from 'jspdf';
import { svg2pdf } from 'svg2pdf.js';
import {
  CONTENT_WIDTH,
  COVER_LABEL_MM,
  COVER_LINE_MM,
  HEADER_ROW_MM,
  LINE_MM,
  NOTE_FONT_PT,
  NOTE_LINE_MM,
  PAGE,
  PDF_FONT_FAMILY,
  rowHeightMm,
  TABLE_FONT_PT,
  type CoverPage,
  type DrawingPage,
  type PdfDocument,
  type TablePage,
  type ViewsPage,
} from './pages';
import { loadPdfFonts } from './pdfFont';

const INK = '#1f2328';
const MUTED = '#6b7280';
const RULE = '#e5e1d8';

export type PdfResult = { blob: Blob; pageCount: number };

function setFont(doc: jsPDF, style: 'normal' | 'bold', size: number, color: string): void {
  doc.setFont(PDF_FONT_FAMILY, style);
  doc.setFontSize(size);
  doc.setTextColor(color);
}

function drawTitle(doc: jsPDF, title: string): void {
  setFont(doc, 'bold', 15, INK);
  doc.text(title, PAGE.margin, 18);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.4);
  doc.line(PAGE.margin, 22, PAGE.width - PAGE.margin, 22);
}

function drawCover(doc: jsPDF, page: CoverPage): void {
  setFont(doc, 'bold', 26, INK);
  doc.text(page.title, PAGE.margin, 45);
  setFont(doc, 'normal', 12, MUTED);
  doc.text('인테리어 업체 전달 자료', PAGE.margin, 55);
  let y = 75;
  for (const row of page.rows) {
    setFont(doc, 'bold', 12, INK);
    doc.text(row.label, PAGE.margin, y);
    setFont(doc, 'normal', 12, INK);
    row.lines.forEach((line, k) => doc.text(line, PAGE.margin + COVER_LABEL_MM, y + k * COVER_LINE_MM));
    y += Math.max(1, row.lines.length) * COVER_LINE_MM + 3;
  }
}

async function drawDrawing(doc: jsPDF, page: DrawingPage): Promise<void> {
  const availH = PAGE.height - PAGE.bottom - PAGE.top - page.notes.length * NOTE_LINE_MM - 4;
  const scale = Math.min(CONTENT_WIDTH / page.width, availH / page.height);
  const w = page.width * scale;
  const h = page.height * scale;
  const x = PAGE.margin + (CONTENT_WIDTH - w) / 2;
  const el = new DOMParser().parseFromString(page.svg, 'image/svg+xml').documentElement;
  const holder = document.createElement('div');
  holder.style.cssText = 'position:fixed;left:-100000px;top:0;';
  holder.appendChild(document.importNode(el, true));
  document.body.appendChild(holder);
  try {
    await svg2pdf(holder.firstElementChild!, doc, { x, y: PAGE.top, width: w, height: h });
  } finally {
    holder.remove();
  }
  setFont(doc, 'normal', NOTE_FONT_PT, MUTED);
  page.notes.forEach((note, k) => doc.text(note, PAGE.margin, PAGE.top + h + 6 + k * NOTE_LINE_MM));
}

function drawTable(doc: jsPDF, page: TablePage): void {
  const xs: number[] = [];
  page.columns.reduce<number>((x, c) => {
    xs.push(x);
    return x + c.width;
  }, PAGE.margin);
  let y = PAGE.top;
  doc.setFillColor('#f3f1ec');
  doc.rect(PAGE.margin, y, CONTENT_WIDTH, HEADER_ROW_MM, 'F');
  setFont(doc, 'bold', TABLE_FONT_PT, INK);
  page.columns.forEach((c, i) => doc.text(c.label, xs[i] + 1.5, y + 5.5));
  y += HEADER_ROW_MM;
  if (page.rows.length === 0) {
    setFont(doc, 'normal', TABLE_FONT_PT, MUTED);
    doc.text(page.emptyText, PAGE.margin + 1.5, y + 7);
    return;
  }
  setFont(doc, 'normal', TABLE_FONT_PT, INK);
  doc.setDrawColor(RULE);
  doc.setLineWidth(0.2);
  for (const row of page.rows) {
    row.forEach((cell, i) => cell.forEach((line, k) => doc.text(line, xs[i] + 1.5, y + 4.6 + k * LINE_MM)));
    y += rowHeightMm(Math.max(...row.map((c) => c.length)));
    doc.line(PAGE.margin, y, PAGE.width - PAGE.margin, y);
  }
}

function drawViews(doc: jsPDF, page: ViewsPage): void {
  if (page.views.length === 0) {
    setFont(doc, 'normal', 11, MUTED);
    doc.text(page.emptyText, PAGE.margin, PAGE.top + 8);
    return;
  }
  const gap = 7;
  const availH = PAGE.height - PAGE.top - PAGE.bottom;
  const h = Math.min((CONTENT_WIDTH - gap) / 2 / 1.5, (availH - gap - 12) / 2);
  const w = h * 1.5;
  page.views.forEach((v, i) => {
    const x = PAGE.margin + (i % 2) * (w + gap);
    const y = PAGE.top + Math.floor(i / 2) * (h + gap + 6);
    doc.addImage(v.dataUrl, 'JPEG', x, y, w, h);
    setFont(doc, 'normal', NOTE_FONT_PT, MUTED);
    doc.text(v.label, x, y + h + 4.5);
  });
}

export async function renderPdf(data: PdfDocument, onProgress?: (done: number, total: number) => void): Promise<PdfResult> {
  const fonts = await loadPdfFonts();
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  doc.addFileToVFS('Pretendard-Regular.ttf', fonts.regular);
  doc.addFont('Pretendard-Regular.ttf', PDF_FONT_FAMILY, 'normal');
  doc.addFileToVFS('Pretendard-Bold.ttf', fonts.bold);
  doc.addFont('Pretendard-Bold.ttf', PDF_FONT_FAMILY, 'bold');

  const total = data.pages.length;
  for (const [i, page] of data.pages.entries()) {
    if (i > 0) doc.addPage();
    if (page.kind === 'cover') {
      drawCover(doc, page);
    } else {
      drawTitle(doc, page.title);
      if (page.kind === 'drawing') await drawDrawing(doc, page);
      else if (page.kind === 'table') drawTable(doc, page);
      else drawViews(doc, page);
    }
    onProgress?.(i + 1, total);
    await new Promise((resolve) => setTimeout(resolve, 0)); // 진행률 표시가 갱신되게 양보
  }

  const pageCount = doc.getNumberOfPages();
  for (let p = 1; p <= pageCount; p++) {
    doc.setPage(p);
    setFont(doc, 'normal', 8, MUTED);
    doc.text(`${data.header} · ${p}/${pageCount}`, PAGE.width - PAGE.margin, PAGE.height - 7, { align: 'right' });
  }
  return { blob: doc.output('blob'), pageCount };
}
```

`src/export/exportPdf.ts`:

```ts
import { planBounds } from '../geometry/bounds';
import type { Plan } from '../model/schema';
import { pdfViewPoses } from '../scene3d/cameraFit';
import { captureViews } from '../scene3d/CaptureBridge';
import { buildPdf, type PdfView } from './pages';

export const VIEW_SIZE = { width: 1200, height: 800 };

export function capturePdfViews(plan: Plan): PdfView[] {
  const capture = captureViews.current;
  if (!capture) return [];
  const poses = pdfViewPoses(planBounds(plan));
  try {
    const urls = capture(poses.map((p) => p.fit), VIEW_SIZE.width, VIEW_SIZE.height);
    return urls.map((dataUrl, i) => ({ label: poses[i].label, dataUrl }));
  } catch {
    return [];
  }
}

export async function exportPdf(
  plan: Plan,
  onProgress?: (done: number, total: number) => void,
): Promise<{ blob: Blob; pageCount: number; fileName: string }> {
  const doc = buildPdf(plan, { views: capturePdfViews(plan), now: new Date() });
  const { renderPdf } = await import('./pdf'); // jsPDF·svg2pdf·글꼴은 PDF를 만들 때만 불러온다
  const result = await renderPdf(doc, onProgress);
  return { ...result, fileName: doc.fileName };
}
```

- [ ] **Step 5: 통과 확인**

Run: `npm run typecheck && npx vitest run`
Expected: 통과. `?url` import 타입 오류가 나면 `tsconfig.json`의 `"types": ["vite/client", "node"]`가 그대로인지 확인한다(이미 들어 있다).

- [ ] **Step 6: Commit**

```bash
git add package.json package-lock.json src/export/pdfFont.ts src/export/pdfFont.test.ts src/export/pdf.ts src/export/exportPdf.ts src/scene3d/cameraFit.ts src/scene3d/cameraFit.test.ts src/scene3d/CaptureBridge.tsx
git commit -m "feat: PDF renderer with lazy Pretendard font and fixed-pose 3D captures"
```

---

### Task 7: 내보내기 모드(기본 정보 + PDF 내려받기)

**Files:**
- Create: `src/ui/ExportView.tsx`, `e2e/pdf.spec.ts`
- Modify: `src/model/store.ts`, `src/model/store.test.ts`, `src/ui/fields.tsx`, `src/ui/uiStore.ts`, `src/ui/modes.ts`, `src/ui/modes.test.ts`, `src/App.tsx`, `src/styles.css`

**Interfaces:**
- Consumes: Task 6 `exportPdf`, `PdfFontError`; `downloadBlob` (`src/persistence/file.ts`); Task 3 `page-panel` 레이아웃.
- Produces:
  - store `updateInfo(patch: Partial<PlanInfo>): void` — 문자열은 다듬고, 빈 문자열·`undefined`는 지운다. 빈 제목은 무시한다.
  - `fields.tsx`: `OptionalNumberField({ label, unit, value?: number, integer?: boolean, onCommit: (v: number | undefined) => void })`, `TextAreaField({ label, value, onCommit })`
  - `Mode`에 `'export'`; 화면 `data-testid="export-view"`, 상태 `data-testid="pdf-status"`

- [ ] **Step 1: 실패하는 테스트 작성**

`src/model/store.test.ts` 끝에 추가:

```ts
describe('기본 정보', () => {
  it('문자열은 다듬고, 빈 값과 undefined는 지우며, 빈 제목은 무시한다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().updateInfo({ address: '  어딘가 1 ', supplyArea: 93.6, builtYear: 1999 });
    expect(s.getState().plan.info).toEqual({ title: '샘플 평면', address: '어딘가 1', supplyArea: 93.6, builtYear: 1999 });
    s.getState().updateInfo({ address: '', supplyArea: undefined, title: '  ' });
    expect(s.getState().plan.info).toEqual({ title: '샘플 평면', builtYear: 1999 });
    s.getState().updateInfo({ title: ' 우리 집 ' });
    expect(s.getState().plan.info.title).toBe('우리 집');
    s.getState().undo();
    expect(s.getState().plan.info.title).toBe('샘플 평면');
  });

  it('바뀌는 것이 없으면 이력에 남기지 않는다', () => {
    const s = createPlanStore(SAMPLE_PLAN);
    s.getState().updateInfo({ title: '샘플 평면', address: '' });
    expect(s.getState().past).toHaveLength(0);
  });
});
```

`src/ui/modes.test.ts`: 첫 번째 `it`의 기대값 배열 끝에 `['export', '내보내기'],`를 추가하고, 세 번째 `it` 끝에 `expect(isPageMode('export')).toBe(true);`를 추가한다.

- [ ] **Step 2: 실패 확인**

Run: `npx vitest run src/model/store.test.ts src/ui/modes.test.ts`
Expected: FAIL — `updateInfo is not a function`, MODES 불일치

- [ ] **Step 3: 구현**

`src/model/store.ts`:
- import에 `PlanInfo` 추가
- `PlanState`에 `updateInfo(patch: Partial<PlanInfo>): void;` 추가
- `setChecklistEntry` 구현 뒤에 추가:

```ts
      updateInfo: (patch) => {
        const plan = get().plan;
        const info: Record<string, unknown> = { ...plan.info };
        for (const [key, value] of Object.entries(patch)) {
          const v = typeof value === 'string' ? value.trim() : value;
          if (key === 'title') {
            if (typeof v === 'string' && v) info.title = v;
            continue;
          }
          if (v === undefined || v === '') delete info[key];
          else info[key] = v;
        }
        const next = info as PlanInfo;
        if (JSON.stringify(next) === JSON.stringify(plan.info)) return;
        commit({ ...plan, info: next });
      },
```

`src/ui/uiStore.ts`: `export type Mode = 'structure' | 'place' | 'electric' | 'checklist' | 'export';`

`src/ui/modes.ts`: `MODES` 끝에 `['export', '내보내기'],`, `SELECTABLE`에 `export: [],` 추가.

`src/ui/fields.tsx` 끝에 추가:

```tsx
export function OptionalNumberField({
  label,
  unit,
  value,
  integer = false,
  onCommit,
}: {
  label: string;
  unit: string;
  value: number | undefined;
  integer?: boolean;
  onCommit: (v: number | undefined) => void;
}) {
  const shown = value === undefined ? '' : String(value);
  const [text, setText] = useState(shown);
  useEffect(() => setText(shown), [shown]);
  const commit = () => {
    const t = text.trim();
    if (t === '') {
      if (value !== undefined) onCommit(undefined);
    } else {
      const v = Number(t);
      if (Number.isFinite(v) && v >= 0 && (!integer || Number.isInteger(v)) && v !== value) onCommit(v);
    }
    // 거부된 입력은 원래 값으로 되돌린다(성공하면 바뀐 value가 effect로 들어온다)
    setText(shown);
  };
  return (
    <label className="field">
      {label}
      <span className="field-input">
        <input
          inputMode="decimal"
          value={text}
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

export function TextAreaField({ label, value, onCommit }: { label: string; value: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  const commit = () => {
    const v = text.trim();
    if (v !== value) onCommit(v);
    setText(value);
  };
  return (
    <label className="field">
      {label}
      <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} onBlur={commit} />
    </label>
  );
}
```

`src/ui/ExportView.tsx`:

```tsx
import { useState } from 'react';
import { exportPdf } from '../export/exportPdf';
import { PdfFontError } from '../export/pdfFont';
import { activeLayout } from '../model/layout';
import { usePlan, usePlanStore } from '../model/StoreContext';
import { downloadBlob } from '../persistence/file';
import { OptionalNumberField, TextAreaField, TextField } from './fields';

type Status =
  | { state: 'idle' }
  | { state: 'working'; done: number; total: number }
  | { state: 'done'; pages: number }
  | { state: 'error'; message: string };

const PAGE_LIST = '표지, 치수 평면도, 가구·가전 배치도, 전기 계획도, 빌트인 상세, 제품 목록, 3D 보기, 공사 체크리스트';

function statusText(s: Status): string {
  switch (s.state) {
    case 'idle':
      return '';
    case 'working':
      return s.total === 0 ? 'PDF 준비 중… 글꼴을 불러오고 있습니다.' : `PDF 만드는 중… ${s.done}/${s.total}쪽`;
    case 'done':
      return `PDF를 저장했습니다 (${s.pages}쪽)`;
    case 'error':
      return s.message;
  }
}

export function ExportView() {
  const store = usePlanStore();
  const plan = usePlan((s) => s.plan);
  const [status, setStatus] = useState<Status>({ state: 'idle' });
  const s = store.getState();
  const info = plan.info;
  const layout = activeLayout(plan);

  const run = async () => {
    setStatus({ state: 'working', done: 0, total: 0 });
    try {
      const r = await exportPdf(store.getState().plan, (done, total) => setStatus({ state: 'working', done, total }));
      downloadBlob(r.blob, r.fileName);
      setStatus({ state: 'done', pages: r.pageCount });
    } catch (e) {
      setStatus({
        state: 'error',
        message:
          e instanceof PdfFontError
            ? '글꼴을 불러오지 못했습니다. 네트워크 연결을 확인하고 다시 시도하세요.'
            : 'PDF를 만들지 못했습니다. 다시 시도하세요.',
      });
    }
  };

  return (
    <div className="export-view" data-testid="export-view">
      <h2>업체 전달 자료 (PDF)</h2>
      <section>
        <h3>기본 정보</h3>
        <div className="info-grid">
          <TextField label="제목" value={info.title} onCommit={(v) => s.updateInfo({ title: v })} />
          <TextField label="주소" value={info.address ?? ''} allowEmpty onCommit={(v) => s.updateInfo({ address: v })} />
          <OptionalNumberField label="공급면적" unit="m²" value={info.supplyArea} onCommit={(v) => s.updateInfo({ supplyArea: v })} />
          <OptionalNumberField label="전용면적" unit="m²" value={info.exclusiveArea} onCommit={(v) => s.updateInfo({ exclusiveArea: v })} />
          <OptionalNumberField label="준공연도" unit="년" integer value={info.builtYear} onCommit={(v) => s.updateInfo({ builtYear: v })} />
          <TextField label="입주 예정일" value={info.moveInDate ?? ''} allowEmpty onCommit={(v) => s.updateInfo({ moveInDate: v })} />
          <TextField label="공사 범위" value={info.scope ?? ''} allowEmpty onCommit={(v) => s.updateInfo({ scope: v })} />
        </div>
        <TextAreaField label="메모" value={info.notes ?? ''} onCommit={(v) => s.updateInfo({ notes: v })} />
        <p className="muted">주소 등 기본 정보는 이 브라우저 저장소, JSON 파일, 내려받은 PDF에만 들어갑니다.</p>
      </section>
      <section>
        <h3>PDF</h3>
        <label className="field">
          기준 배치안
          <select value={layout.id} onChange={(e) => s.switchLayout(e.target.value)}>
            {plan.layouts.map((l) => (
              <option key={l.id} value={l.id}>{l.name}</option>
            ))}
          </select>
        </label>
        <p className="muted">포함 쪽: {PAGE_LIST}. 배치도·제품 목록·자동 체크리스트는 기준 배치안으로 만듭니다.</p>
        <div className="row">
          <button type="button" disabled={status.state === 'working'} onClick={run}>PDF 내려받기</button>
          {status.state === 'error' && <button type="button" onClick={run}>다시 시도</button>}
        </div>
        <p className={status.state === 'error' ? 'pdf-status error' : 'pdf-status'} data-testid="pdf-status" role="status">
          {statusText(status)}
        </p>
      </section>
    </div>
  );
}
```

`src/App.tsx`: import `ExportView`를 추가하고 체크리스트 블록 바로 뒤에 추가:

```tsx
        {mode === 'export' && (
          <div className="page-panel">
            <ExportView />
          </div>
        )}
```

`src/styles.css` 끝에 추가:

```css
.info-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 0 16px; }
.export-view textarea { padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; font: inherit; font-size: 13px; resize: vertical; }
.export-view select { padding: 4px 6px; border: 1px solid #d6d0c4; border-radius: 4px; font-size: 13px; }
.pdf-status { font-size: 13px; min-height: 18px; margin: 8px 0 0; }
```

- [ ] **Step 4: 단위 테스트 통과 확인**

Run: `npm run typecheck && npx vitest run`
Expected: 통과

- [ ] **Step 5: 실패하는 E2E 작성** — `e2e/pdf.spec.ts`

```ts
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const getPlan = (page: Page) => page.evaluate(() => window.__homefit!.store.getState().plan);
const canvasWidth = (page: Page) => page.locator('.viewport canvas').evaluate((c) => (c as HTMLCanvasElement).width);

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('기본 정보를 넣고 PDF를 내려받으면 쪽수가 맞는 PDF가 저장된다', async ({ page }) => {
  const widthBefore = await canvasWidth(page);
  await page.getByTestId('catalog-card-samsung-grande-washer-sample').getByRole('button', { name: '추가' }).click();
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const view = page.getByTestId('export-view');
  await view.getByLabel('주소').fill('테스트시 테스트로 1');
  await view.getByLabel('주소').press('Enter');
  await expect.poll(async () => (await getPlan(page)).info.address).toBe('테스트시 테스트로 1');

  const downloading = page.waitForEvent('download');
  await view.getByRole('button', { name: 'PDF 내려받기' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toBe('homefit-샘플-평면-A안.pdf');
  await expect(view.getByTestId('pdf-status')).toContainText('PDF를 저장했습니다');
  const pages = Number((await view.getByTestId('pdf-status').textContent())!.match(/\((\d+)쪽\)/)![1]);
  expect(pages).toBeGreaterThanOrEqual(8);

  const body = readFileSync((await download.path())!);
  expect(body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  const text = body.toString('latin1');
  expect(text.match(/\/Type \/Page\b/g)?.length).toBe(pages);
  expect(text.match(/\/Subtype \/Image/g)?.length ?? 0).toBeGreaterThanOrEqual(3);

  await page.getByRole('button', { name: '배치', exact: true }).click();
  await expect(page.locator('.viewport canvas')).toBeVisible();
  expect(await canvasWidth(page)).toBe(widthBefore);
});

test('글꼴을 못 받으면 안내하고, 다시 시도하면 만든다', async ({ page }) => {
  await page.route('**/*.ttf*', (route) => route.abort());
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const view = page.getByTestId('export-view');
  await view.getByRole('button', { name: 'PDF 내려받기' }).click();
  await expect(view.getByTestId('pdf-status')).toContainText('글꼴을 불러오지 못했습니다');

  await page.unroute('**/*.ttf*');
  const downloading = page.waitForEvent('download');
  await view.getByRole('button', { name: '다시 시도' }).click();
  await downloading;
  await expect(view.getByTestId('pdf-status')).toContainText('PDF를 저장했습니다');
});
```

- [ ] **Step 6: E2E 실행**

Run: `npx playwright test e2e/pdf.spec.ts`
Expected: PASS (2 tests). 실패하면 렌더러·화면을 고치고, 단언을 약하게 바꾸지 않는다.

- [ ] **Step 7: 지연 로드 확인(빌드)**

Run: `npm run build && ls dist/assets | grep -E "Pretendard-(Regular|Bold).*\.ttf" && for f in dist/assets/index-*.js; do grep -q "addFileToVFS" "$f" && echo "FAIL: jsPDF in $f"; done; echo checked`
Expected: Pretendard TTF 두 개가 별도 asset으로 나오고, `FAIL:` 줄 없이 `checked`만 출력(jsPDF가 첫 번들에 없음). `dist/`는 git에 추가하지 않는다(.gitignore).

- [ ] **Step 8: 전체 검증**

Run: `npm run typecheck && npm test && npm run e2e`
Expected: 모두 통과(e2e 18개)

- [ ] **Step 9: Commit**

```bash
git add src/model/store.ts src/model/store.test.ts src/ui/fields.tsx src/ui/uiStore.ts src/ui/modes.ts src/ui/modes.test.ts src/ui/ExportView.tsx src/App.tsx src/styles.css e2e/pdf.spec.ts
git commit -m "feat: export mode with plan info form and contractor PDF download"
```

---

## 완료 후(컨트롤러)

- 계획 단위 탐색 QA: `private/our-home.local.json`을 "JSON 열기"로 불러와 전기 설비 몇 개(전용회로 포함) 배치 → 체크리스트 체크·메모 → 기본 정보 입력 → PDF 내려받기. PDF를 쪽마다 이미지로 열어 한글·도면·표·3D·쪽 번호를 눈으로 확인한다. PDF·캡처는 스크래치패드에만 두고 repo에 넣지 않는다.
- 계획 5로 넘길 것: Pretendard OFL-1.1 고지 파일(배포 시), 삼성 실제 모델·빌트인 제품 추가(빌트인 상세 쪽이 실제로 채워짐), PDF 표 머리글 반복·행 높이 실측 보정이 필요한지 실제 PDF로 판단.
