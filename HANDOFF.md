# sn-house-interior HANDOFF

프로젝트 개요·규칙은 `CLAUDE.md`, 문서 지도는 `docs/README.md`. 이 파일은 현재 상태와 다음 할 일만 둔다. 이슈별 상세 핸드오프는 `handoff/`(진행 중)·`archive/`(완료), 둘 다 git 제외.

## 지금 상태
- 2026-10-09 기준 `main` `79ef7a5`(PR #18 병합). 열린 브랜치·워크트리·PR 없음. 스키마 `CURRENT_VERSION = 8`, 스펙 최신 라운드 §33.
- 테스트(`main`): typecheck 통과, `npm test` 560 통과·3 skip(워크트리 기준; `private/`가 있는 메인 체크아웃은 563 통과·0 skip), e2e 37 통과(16 spec), e2e:preview 2 통과, check:dist·privacy scan 통과.
- **공개 배포 중**: https://jyp90.github.io/sn-house-interior/ — `main` push마다 `pages.yml`(typecheck→test→build→check:dist→deploy), PR·main push마다 `privacy.yml`(secret `PRIVACY_TERMS`). 우리 집 프리셋은 `home/plan.json`·`home/floorplan.jpg`로 추적·배포(§24). 옛 repo `jyp90/sn-house-interior-old`(비공개) 보존.
- 미확인: 실제 휴대폰 Safari에서 Pages 주소(§33 보기 전용 포함).

### 병합된 라운드 (최신 먼저, PR 번호는 현재 repo 기준)
| § | PR | 내용 | 테스트(unit/e2e) |
|---|---|---|---|
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
1. 배포 후속: 휴대폰 Safari에서 실제 주소 확인(§33 보기 전용 포함); 옛 repo `sn-house-interior-old` 삭제 여부(`gh auth refresh -s delete_repo` 후 `gh repo delete`); PWA(manifest·오프라인)는 범위 밖(설계 §12), 원하면 별도 라운드.
2. 계획 5 잔여(스펙 §14.5-5, §20.6): 삼성 모델 목록(사용자 제공) → `-sample` 제품 13개의 공식 치수·`sourceUrl` 교체(`adding-catalog-product`). `private/make-our-home.mjs`는 아직 `version: 3`(로드 시 v8로 마이그레이션되므로 급하지 않음; 손볼 때 현재 `CURRENT_VERSION`으로).
3. 보류 minor(§20–§33 누적): `Product.brand`가 UI 어디에도 표시되지 않음; 2D에서 천장형 아이템이 바닥 아이템 위에 그려져 클릭을 먼저 받음(후보 목록으로 선택); 상판 위 가전 자동 높이·적층 스냅 없음; 3D 원근 띄운 아이템 드래그 자동 테스트 없음(QA만); 예전 평면의 연속 중복 꼭짓점 다각형은 꼭짓점 끌기가 조용히 거부됨; 대각선 벽의 개구부 라벨 간격 미검증; e2e flake 2건은 §30에서 12회 반복으로 재현 안 됨; pdf e2e 쪽수 하한이 §25 이후(17쪽)에도 유효한지 미확인; FixtureProperties/ExportView 컴포넌트 테스트 없음; 캔버스 픽셀 검증 e2e 없음.
