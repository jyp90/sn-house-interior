# sn-house-interior HANDOFF

프로젝트 개요·규칙은 `CLAUDE.md`, 문서 지도는 `docs/README.md`. 이 파일은 현재 상태와 다음 할 일만 둔다. 이슈별 상세 핸드오프는 `handoff/`(진행 중)·`archive/`(완료), 둘 다 git 제외.

## 지금 상태
- 2026-10-09 기준 `main` = PR #31 `feat/doclinks-store`(§43 참고 문서 링크 브라우저 저장) 병합(그 전 #29 `feat/pin-gate` §42, #30 §41, #28 §40). 열린 브랜치·워크트리·PR 없음. 스키마 `CURRENT_VERSION = 8`, 스펙 최신 라운드 §43.
- 테스트(`main`): typecheck 통과, `npm test` 600 통과·3 skip(워크트리 기준; `private/`가 있는 메인 체크아웃은 +3), e2e 44 통과(19 spec), e2e:preview 2 통과, check:dist·privacy scan 통과.
- **공개 배포 중**: https://jyp90.github.io/sn-house-interior/ — `main` push마다 `pages.yml`(typecheck→test→build→check:dist→deploy), PR·main push마다 `privacy.yml`(secret `PRIVACY_TERMS`). 우리 집 프리셋은 `home/plan.json`·`home/floorplan.jpg`로 추적·배포(§24). 옛 repo `jyp90/sn-house-interior-old`(비공개) 보존.
- 미확인: 실제 휴대폰 Safari에서 Pages 주소(§33 보기 전용 포함).

### 병합된 라운드 (최신 먼저, PR 번호는 현재 repo 기준)
| § | PR | 내용 | 테스트(unit/e2e) |
|---|---|---|---|
| §43 | #31 | 참고 문서 링크 브라우저 저장(`docs/links.ts` 저장 helpers + `docLinksStore`, 체크리스트 탭 「링크 설정」 JSON 폼, `e2e/docLinks.spec.ts`) — Pages에서도 붙여 넣어 쓸 수 있음 | 600 / 44 |
| §42 | #29 | 진입 PIN 잠금(`persistence/gate.ts`, `ui/Gate.tsx`, 5회 실패 → 1시간 잠금, 탭 단위 해제, dev `?gate=1`로 e2e) | 595 / 43 |
| §41 | #30 | 탭 순서(`feat/tabs-doclinks`) | — / — |
| §40 | #28 | 3D 전기 설비 디테일(콘센트 홈·핀, 스위치 로커, 조명 돔, `scene3d/fixtureParts.ts`) | — / — |
| §34 | — | 체크리스트 탭에 1차·2차 문서 링크 추가(`private/doc-links.local.json` 데이터만, 코드 변경 없음) | 560 / 37 (변경 없음) |
| §39 | #26 | 우리 집 프리셋 v2(Planner 5D 실내 치수·벽 18cm·창고·확장 거실 샷시·중문 틀·현관 단), 프리셋 갱신 안내 배너(`homePreset.ts` `presetFingerprint`/`markPresetSeen`) | 585 / 40 |
| §38 | #25 | 집 영역 밖 배치 금지(`geometry/houseArea.ts`, 방 이름·영역·설비 클릭 거부, 설비 드래그 clamp) | 582 / 40 |
| §37 | #23 | 2D 도면 자리 흰 종이(`BackgroundImage` `background-paper`, 프리셋 배경 `opacity` 0), 방 라벨 20px + `(면적㎡)` 줄(`Rooms2D`) | 575 / 39 |
| §36 | #22 | 페이지 타이틀 「우리집 인테리어 by 송뇽」, 탭 ↔ URL hash(`src/ui/modeHash.ts`, `e2e/modeHash.spec.ts`) | 575 / 39 |
| §35 | #21 | 배경 도면 흑백화(`BackgroundImage` grayscale), 닫힌 벽 영역 자동 인식(`geometry/enclosure.ts`, `autoRoomPolygon(s)`, 방 속성·구조 패널 버튼), `home/plan.json` 방 8개 polygon | 572 / 38 |
| §33 | #18 | 820px 이하 보기 전용(`uiStore.viewOnly`, `MobileInfoBar`, `e2e/mobile.spec.ts`) | 560 / 37 |
| §32 | #17 | 인터랙션 다듬기(눌림 피드백, reduced-motion, `scaleX` 막대, theme-color) | 556 / 36 |
| §31 | #16 | 벽 밖 개구부 2D/PDF 클램프(`openingObb` `OBB \| null`), 자동 체크리스트 고아 정리 | 556 / 36 |
| §30 | #15 | 평면당 1회 검증 캐시(`useValidation`), 문 열림 벽 끝 클램프, PDF 이모지 제거(`pdfSafe`), 3D 첫 프레임 깜빡임 | 549 / 36 |
| §29 | #12 | `corner-cabinet` builder, 코너 하부장·상부장·레인지후드, 스키마 v8(builder id) | 543 / 35 |
| §28 | #11 | 배치 모드 「배치된 가구 (N)」 패널(`model/itemList.ts`, `ItemListPanel`) | 535 / 35 |
| §27 | #10 | 스위치 그룹(`Fixture.group`, 스키마 v7), 3D 전기 설비(`fixtureParts.ts`, `Fixtures3D`) | 526 / 34 |
| §25 | #9 | PDF 방 마감표·창호 일람, 치수도 창호 번호·면적 라벨 | 508 / 33 |
| §26 | #8 | 사용자 정의 박스 이름·치수 편집(`updateCustomProduct`), 아이템 메모(`Item.note`, 스키마 v6) | 497 / 33 |
| §23 | #7 | 3D 문짝·창 유리(`openingParts.ts`, `Openings3D`) | 483 / 32 |
| §22 | #6 | 보류 minor 1: 3D 라벨 자체 투영(`labelBridge`, `LabelOverlay`), T자 스냅, 자기 교차 거부, 체크리스트 id 해시 | 471 / 32 |
| §21 | #5 | 거리 측정 도구(`uiStore.measure`, `e2e/measure.spec.ts`) | 448 / 31 |
| §20 | #4 | 카탈로그 확충(builder 9종·일반 제품 23개), 설치 높이(`Item.elevation`, 스키마 v5) | 442 / 30 |
| §24 | #2 | 우리 집 프리셋 `home/` 추적·배포, `check:dist` 평면도 허용 | 387 / 29 |
| — | #13·#14 | CI privacy scan, 한국어 README, 병합·정리 필수화 | — |
| — | — | 같은 크기 배경 재업로드 시 축척 유지(`calibration.ts` `backgroundForNewImage`) | 387 / 29 |
| §19 | 옛 #8 | 방 영역·바닥/벽 마감·우드톤 UI, 스키마 v4 | 384 / 29 |
| §17·§18 | 옛 #4·#5·#7·#2 | Pages 배포(`pages.yml`, `check:dist`, OFL 고지), dev 서버 「업데이트」 버튼 | — |
| §15·§16 | 옛 #1 | 견적 요청 PDF, 현장 체크리스트 재설계, 중문 도구, 탭별 참고 링크 | 313 / 19 |

라운드별 상세(QA 절차·보류 사유)는 `archive/*/HANDOFF.md`(로컬 전용). 스펙 §별 코드 위치는 `docs/README.md` Feature map.

## 다음 할 일
0. 배포본 사용자 작업: 배포 후 구조 탭 「우리 집 기본 평면 불러오기」로 프리셋 v2 적용(갱신 배너가 안내). 옛 배경 이미지(`home/floorplan.jpg`)는 v2 치수와 안 맞으므로 투명도를 올리면 어긋남 — 새 도면 이미지로 교체·재보정은 별도 라운드.
1. 배포 후속: 휴대폰 Safari에서 실제 주소 확인(§33 보기 전용, §42 PIN 화면 포함); 옛 repo `sn-house-interior-old` 삭제 여부(`gh auth refresh -s delete_repo` 후 `gh repo delete`); PWA(manifest·오프라인)는 범위 밖(설계 §12), 원하면 별도 라운드.
2. 계획 5 잔여(스펙 §14.5-5, §20.6): 삼성 모델 목록(사용자 제공) → `-sample` 제품 13개의 공식 치수·`sourceUrl` 교체(`adding-catalog-product`). `private/make-our-home.mjs`는 아직 `version: 3`(로드 시 v8로 마이그레이션되므로 급하지 않음; 손볼 때 현재 `CURRENT_VERSION`으로). **다시 돌릴 때 §35로 넣은 방 8개 `polygon`을 보존해야 함**(스크립트에 polygon을 넣거나, 돌린 뒤 앱의 「영역 없는 방 자동 인식」으로 다시 채우고 JSON 저장).
3. 보류 minor(§20–§33 누적): `Product.brand`가 UI 어디에도 표시되지 않음; 2D에서 천장형 아이템이 바닥 아이템 위에 그려져 클릭을 먼저 받음(후보 목록으로 선택); 상판 위 가전 자동 높이·적층 스냅 없음; 3D 원근 띄운 아이템 드래그 자동 테스트 없음(QA만); 예전 평면의 연속 중복 꼭짓점 다각형은 꼭짓점 끌기가 조용히 거부됨; 대각선 벽의 개구부 라벨 간격 미검증; e2e flake 2건은 §30에서 12회 반복으로 재현 안 됨; pdf e2e 쪽수 하한이 §25 이후(17쪽)에도 유효한지 미확인; FixtureProperties/ExportView 컴포넌트 테스트 없음; 캔버스 픽셀 검증 e2e 없음.
