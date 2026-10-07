# homefit 설계 문서

- 작성일: 2026-10-08
- 상태: 사용자 리뷰 대기

## 1. 목적

인테리어 공사 전에 우리 집 구조를 3D로 재현하고, 실제 치수의 가구·가전(삼성전자 위주)을 드래그로 배치해 본다. 결과를 **업체에 전달할 PDF 자료**(치수 도면, 배치도, 전기 계획, 빌트인 상세, 제품 목록, 체크리스트)로 내보낸다.

성공 기준:
- 실측 치수 기준으로 "이 자리에 이 제품이 들어가는가, 문이 열리는가, 동선이 나오는가"를 판단할 수 있다.
- 인테리어를 처음 하는 사람이 철거·목공·전기·타일·도배·바닥 업체 미팅에 그대로 들고 갈 수 있는 PDF가 나온다.

사용자: 우리 가족(개인용). 판매·다중 사용자 서비스 아님.

## 2. 확정된 결정

| 항목 | 결정 |
|---|---|
| 구조 입력 | 평면도 이미지 트레이싱 + 축척 보정. 우리 집은 평면도 치수로 만든 프리셋으로 시작 |
| 제품 형상 | 실치수 기반 절차적 모델링(코드로 생성). 외부 GLB 사용 안 함 |
| 제품 추가 | 사용자가 모델명을 알려주면 개발 시 카탈로그 데이터로 추가. 앱 안에서는 "사용자 정의 박스"만 추가 가능 |
| 저장 | localStorage 자동 저장 + JSON 내보내기/불러오기. 백엔드 없음 |
| 검증 | 충돌(OBB) + 벽까지 거리 + 문 열림 반경 |
| 스택 | Vite + TypeScript + React + react-three-fiber + drei + zustand |
| 내보내기 | PDF(A4 가로) 직접 다운로드: jsPDF + svg2pdf.js |
| 배포 | GitHub `jyp90/homefit`(public) → GitHub Pages |

## 3. 우리 집 프리셋

출처: 네이버 부동산 평면도(평면도 기본형, 공급 93.64㎡ / 전용 59.97㎡, 복도식). 단지명·URL과 이미지는 `private/`(git 제외)에만 둔다.

평면도 표기 치수(벽 중심선, mm):
- 가로 총 11,600 = 상단 `1,500(발코니) | 3,600(침실1) | 1,700(욕실) | 3,300(침실2) | 1,500(복도)`, 하단 `1,500(발코니) | 3,600(거실) | 3,600(주방·식당) | 1,400(다용도/현관 측) | 1,500(복도)`
- 세로 총 6,900 = 좌측 `3,900 | 3,000`, 우측 `3,000 | 3,900`
- 세대 내부 폭은 복도 1,500을 제외한 10,100

프리셋 생성 규칙:
- 위 치수를 cm로 바꿔 벽 중심선 좌표를 정의한다. 외벽 두께는 20cm, 내벽 두께는 12cm를 기본값으로 하고, 앱에서 수정할 수 있다.
- 문·창 위치는 평면도 이미지에서 읽어 배치한다(치수가 표기되지 않은 값이므로 근사치). 실측 후 앱에서 보정한다.
- 평면도는 **기본형(비확장)** 기준이다. 실제 집이 발코니를 확장했다면 앱의 구조 모드에서 벽을 수정한다.
- 이미지는 앱에 배경으로 업로드해 프리셋과 겹쳐 보며 검증하는 용도로만 쓴다.

**개인정보 처리**: repo와 Pages는 공개되므로, 앱 번들과 repo에는 주소·단지명·평면도 이미지를 넣지 않는다. 우리 집 프리셋은 `private/our-home.local.json`(git 제외)으로 생성하고, 앱에서 "불러오기"로 연다. 앱에 기본 포함되는 것은 익명 샘플 평면 1개뿐이다.

## 4. 아키텍처

단위: 저장은 정수 cm, 3D 렌더링은 1 unit = 1 m. 2D (x, y)는 3D에서 (x, 0, y)에 대응한다.

```
src/
  model/        타입, zustand 스토어(plan + 선택/모드 상태), undo/redo 히스토리
  geometry/     순수 함수: 벽 폴리곤, 2D OBB SAT 충돌, 점-선분 거리, 문 열림 부채꼴, 벽 스냅
  catalog/      products.ts(제품 데이터), builders/(형상 생성 함수)
  editor2d/     SVG 편집기: 배경 이미지, 축척 보정, 벽·문·창·방이름, 전기 마커
  scene3d/      R3F: 벽 돌출, 아이템 렌더, 바닥 드래그, 검증 오버레이, 원근/탑뷰 전환
  checklist/    공정별 기본 항목 + plan 기반 자동 생성 항목
  export/       PDF 페이지 구성(data) + 렌더(jsPDF/svg2pdf), JSON 내보내기
  persistence/  localStorage/IndexedDB 저장, zod 스키마, 버전 마이그레이션
  ui/           모드 탭, 좌측 패널(도구/카탈로그), 우측 속성창, 툴바
```

`geometry/`, `checklist/`, `persistence/`, `export/`의 페이지 구성 로직은 React에 의존하지 않으며 단위 테스트 대상이다.

## 5. 데이터 모델

```ts
type Vec2 = { x: number; y: number }           // cm

Plan {
  version: 1
  info: { title, address?, supplyArea?, exclusiveArea?, builtYear?, moveInDate?, scope?, notes? }
  background?: { imageRef, cmPerPx, offsetX, offsetY, rotation, opacity }  // imageRef: IndexedDB key
  walls:    { id, a: Vec2, b: Vec2, thickness, height }[]                  // 기본 높이 230
  openings: { id, wallId, kind: 'door' | 'window', offset, width, height, sill,
              hinge: 'start' | 'end', swingIn: boolean }[]                 // offset: 벽 a점 기준
  rooms:    { id, name, label: Vec2 }[]
  items:    { id, productId, variantId, x, y, rotation, label? }[]        // rotation: deg
  fixtures: { id, kind: 'outlet' | 'outlet-dedicated' | 'outlet-waterproof' | 'switch' | 'light',
              wallId?, pos: Vec2, height, memo? }[]
  checklist: { itemId, checked: boolean, memo? }[]
  customProducts: Product[]                                                // 사용자 정의 박스
}

Product {
  id, brand, model, name, category
  dims: { w, d, h }                       // cm, 공식 사양
  variants: { id, label, colors: Record<string, string> }[]
  builder: BuilderId
  builderParams?: Record<string, unknown>
  clearances: ({ kind: 'swing', side: 'front' | 'left' | 'right', hinge: 'left' | 'right', radius }
             | { kind: 'front', depth })[]
  power?: { watts: number; dedicatedCircuit: boolean }
  builtIn: boolean
  sourceUrl?: string
}
```

## 6. 화면과 편집 흐름

상단 모드 탭: `구조 | 배치 | 전기 | 체크리스트 | 내보내기`. 좌측 패널(도구/카탈로그), 중앙 뷰, 우측 속성창.

**구조 모드(2D SVG)**
- 평면도 이미지 업로드(PNG/JPG), 투명도 조절
- 축척 보정: 두 점 클릭 → 실제 길이(cm) 입력 → `cmPerPx`. 다시 보정 가능
- 벽 그리기: 클릭으로 꼭짓점 추가, 더블클릭/Esc로 종료. 0°/45°/90° 스냅, 기존 끝점 스냅
- 벽 선택 → 길이·두께 숫자 입력으로 수정
- 문·창: 벽 위로 드래그 → 폭, 경첩 방향, 안/밖 열림 지정
- 방 이름표 배치

**배치 모드(3D, 원근/탑뷰 전환)**
- 카탈로그(주방가전, 생활가전, TV, 냉난방, 가구, 사용자 정의)에서 뷰로 드래그 → 바닥에 생성
- 드래그 이동: 레이캐스트와 바닥 평면 교차점 사용. 벽면 2cm 이내 접근 시 밀착 스냅
- 회전: `R` 키 90°, 속성창에서 각도 입력
- 정밀 이동: 방향키 1cm, Shift+방향키 10cm
- 검증(항상 표시): 충돌 시 빨간 외곽선, 선택 아이템에서 4방향 최근접 벽까지 거리선(cm), 문 열림 부채꼴(반투명)
- 복제 `Ctrl+D`, 삭제 `Delete`, 실행 취소/다시 실행 `Ctrl+Z` / `Ctrl+Shift+Z`

**충돌 규칙**: 2D OBB SAT. 대상은 아이템↔아이템, 아이템↔벽, clearance↔아이템·벽. clearance끼리는 겹쳐도 경고하지 않는다. 벽걸이 TV처럼 바닥 점유가 없는 제품은 벽 충돌만 검사한다.

**전기 모드(2D, 구조 위 오버레이)**
- 콘센트(일반/전용회로/방수), 스위치, 조명 마커 배치. 벽 스냅, 설치 높이(cm)와 메모
- `power.dedicatedCircuit`인 아이템의 반경 150cm 이내에 전용회로 콘센트가 없으면 경고 배지

**체크리스트 모드**: 공정별 기본 항목 + 자동 생성 항목, 체크 상태와 메모 저장

**내보내기 모드**: 기본 정보 입력 폼, PDF 포함 페이지 선택, PDF 다운로드, JSON 내보내기/불러오기

**저장**: 변경 후 500ms 디바운스로 자동 저장. 배경 이미지는 IndexedDB에 저장한다.

## 7. 카탈로그

builder 목록(params로 제품 차이를 표현):

| builder | 표현 |
|---|---|
| `fridge` | 도어 분할(1–4도어, 비율), 손잡이 홈, 패널 색 |
| `front-loader` | 원형 도어, 상단 조작부, 직렬 설치 옵션 |
| `tv` | 벽걸이/스탠드, 베젤 |
| `stand-ac` | 원기둥/사각 기둥형 |
| `built-in-appliance` | 하부장 매립, 전면 패널만 노출 |
| `cabinet-run` | 주방 하부장/상부장, 길이 가변, 상판 |
| `sofa` `bed` `table` `chair` `wardrobe` | 일반 가구 |
| `box` | 사용자 정의 W×D×H, 색상 |

- 삼성 제품은 사용자가 모델 목록을 주면 공식 사양 페이지에서 치수·소비전력을 확인해 추가하고 `sourceUrl`을 기록한다.
- 목록을 받기 전에는 샘플 제품 2–3개로 개발과 테스트를 진행한다.

## 8. 체크리스트

- 공정: 철거, 목공·전기, 타일, 도배, 바닥, 주방
- 기본 항목 문구는 새로 작성한다. 참고한 외부 가이드(@gorane_home)는 무단 복제 금지 표기가 있으므로 구성만 참고하고 문구는 옮기지 않는다.
- plan 기반 자동 생성 항목 예시:
  - 전용회로 확인: `power.dedicatedCircuit` 제품 목록(예: 인덕션, 식기세척기, 건조기)
  - 빌트인 치수 전달: `builtIn` 제품별 W×D×H와 설치 벽 기준 위치
  - 문 열림 간섭: clearance 충돌이 남아 있는 아이템
  - 콘센트 위치 공유: 전기 마커 수와 위치

## 9. PDF 내보내기

A4 가로, 도면은 SVG 벡터로 삽입한다.

| 페이지 | 내용 |
|---|---|
| 표지·기본 정보 | 제목, 주소, 면적, 준공연도, 공사 범위, 입주일 |
| 치수 평면도 | 벽 치수선, 문·창 위치와 폭, 방 이름 |
| 가구·가전 배치도 | 번호 라벨, 문 열림 반경 |
| 전기 계획도 | 콘센트·스위치·조명 마커, 고전력 가전 위치, 전용회로 표시, 범례 |
| 빌트인 상세 | 빌트인 항목별 W×D×H, 벽 기준 위치 |
| 제품 목록 | 번호, 모델명, 치수, 소비전력, 전용회로 필요 여부 |
| 3D 뷰 | 주요 시점 캡처 2–4장(캔버스 PNG) |
| 체크리스트 | 공정별 항목, 체크 상태, 메모 |

- 한글 폰트(Pretendard)는 PDF를 내보낼 때만 지연 로드한다.
- 페이지 구성(`export/pages.ts`)은 plan을 받아 페이지 데이터 배열을 반환하는 순수 함수로 만들고, 렌더러와 분리한다.

## 10. 에러 처리

- JSON 불러오기: zod 검증에 실패하면 오류 경로를 표시하고 현재 작업을 덮어쓰지 않는다. `version`으로 마이그레이션한다.
- 배경 이미지: 긴 변이 4096px를 넘으면 축소한다.
- 저장 실패(용량 초과): 배너로 JSON 백업을 안내한다.
- WebGL 미지원: 3D 뷰 대신 안내를 표시하고, 2D 모드는 계속 사용할 수 있다.
- PDF 폰트 로드 실패: 재시도 버튼을 표시한다. 생성 중에는 진행률을 표시한다.

## 11. 테스트

- Vitest: `geometry/`(OBB 충돌, 거리, 부채꼴, 스냅), `persistence/`(왕복 직렬화, 마이그레이션, 잘못된 입력), `checklist/` 자동 생성, `export/pages.ts`
- Playwright E2E: 샘플 평면 로드 → 이미지 업로드·보정 → 벽 그리기 → 가전 드래그 → 충돌 표시 확인 → PDF 다운로드(파일 생성, 페이지 수)
- 완료 전에 실제 브라우저로 탐색 QA를 진행한다(리뷰만으로는 런타임 버그를 놓친 전례가 있음).

## 12. 범위 제외(1차)

실시간 공동 편집, 벽지·바닥재 텍스처 시뮬레이션, 다층 구조, 모바일 편집(모바일은 보기 전용), 앱 내 제품 검색.

## 13. 열린 항목

- 삼성 제품 모델 목록(사용자 제공 예정)
- 실제 집의 발코니 확장 여부와 실측값(앱에서 보정)
