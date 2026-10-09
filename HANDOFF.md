# sn-house-interior HANDOFF

프로젝트 개요·규칙은 `CLAUDE.md`, 문서 지도는 `docs/README.md`. 이 파일은 현재 상태와 다음 할 일만 둔다. 이슈별 상세 핸드오프는 `handoff/`(진행 중)·`archive/`(완료), 둘 다 git 제외.

## 지금 상태
- `feat/catalog-elevation`(`ab6ab94`): 스펙 §20 카탈로그 확충(builder 9종·일반 치수 제품 23개, 욕실 분류, 카탈로그 이름 필터)·설치 높이(`Item.elevation`, 스키마 v5, 세로 구간 충돌 검사, 2D 점선·3D 높이·속성 패널·PDF 제품 목록 열). 계획 `docs/superpowers/plans/2026-10-09-catalog-elevation.md`. 테스트: typecheck 통과, `npm test` 442 통과·3 skip, e2e 30 통과(`e2e/elevation.spec.ts` 포함). 탐색 QA(샘플, 5181): 새 제품 15종 2D/3D/탑뷰 표시, 세탁기 위 건조기(110) 충돌 없음, 천장형 에어컨 탑뷰 드래그·실행 취소, 벽걸이 에어컨 원근 3D 드래그, PDF 16쪽, 페이지 오류 없음.
- `fix/background-keep-calibration`: 「이미지 불러오기」가 기존 배경과 픽셀 크기가 같으면 축척·위치·보정을 유지(`editor2d/calibration.ts` `backgroundForNewImage`). 목적: 공개 Pages에서 우리 집 평면은 프리셋을 푸시하지 않고 「JSON 열기」(`private/our-home.local.json`) → 구조 탭 「이미지 불러오기」(`private/home-floorplan.jpg`)로 본다(사용자 결정 2026-10-09, 프리셋 비공개 유지). 테스트: typecheck 통과, `npm test` 387 통과·3 skip, e2e 29 통과. 탐색 QA(샘플, 5181): 같은 크기 재업로드 축척 유지·배너, 실행 취소/다시 실행 1단계, 다른 크기 초기화, 새로고침 유지, 2D↔3D, 1100px 폭, 콘솔 오류 없음.
- 2026-10-09 기준. **공개 배포 중**: https://jyp90.github.io/sn-house-interior/ (GitHub Pages, `main` push마다 `pages.yml`로 자동 배포). repo `jyp90/sn-house-interior`는 공개, 히스토리 재작성 완료(130 커밋, `main` `760b22f`). 옛 repo는 `jyp90/sn-house-interior-old`(비공개)로 보존.
- `main`: 계획 1–4, 스펙 §15·§16(PR #1), §17 Pages 배포(PR #4·#5·#7), §18 자동 업데이트(PR #2), §19 방 영역·마감(PR #8) 병합. 위 PR 번호는 옛 repo 기준.
- `docs/preset-outlets`: 우리 집 프리셋(private)에 일반 콘센트 15개 가안 추가(총 21개), 스펙 §15 프리셋 반영 사항 한 줄 보강. 코드 변경 없음.
- `feat/self-update`(main 미병합): 스펙 §18 「업데이트」 버튼 — dev 서버가 원격 fast-forward → 필요 시 `npm install` → 재시작 → 화면 새로고침.
- 테스트(`feat/self-update`): typecheck 통과, `npm test` 329 통과·0 skip, e2e 23 통과. 탐색 QA: 가짜 원격(bare repo)으로 실제 pull·서버 재시작·새로고침·평면 유지, 재클릭 시 「이미 최신」, 미커밋 변경 거부, 다른 출처 거부.
- `feat/quote-docs-home-preset`(PR #1로 main 병합): 스펙 §15 3차 반영 — 현장 검수 체크리스트 교체 `e12f103`, PDF 견적 요청 4쪽 `9b5f3de`, 로컬 전용 우리 집 프리셋 `54cb00b`, 체크리스트 재설계 `a4614c6`, 탭별 참고 문서 링크 `1c74385`, 스펙 §16 중문 도구 `f8c4d82`.
- 테스트(`ff40b36`): typecheck 통과, `npm test` 313 통과·0 skip, e2e 19 통과. 탐색 QA(샘플 평면, 5181) 통과: 중문 배치·실행 취소/다시 실행, 2D↔3D, 체크리스트 필터·공정 이동·메모·새로고침 유지, 기본 정보 경계값, PDF 15쪽(Pretendard·견적 4쪽·중문 표시), 1200px 폭.
- 원격 `origin` = `jyp90/sn-house-interior`(공개). 요청마다 워크트리·새 브랜치 → 로컬 검증 → PR → `main` 병합이 기본(`CLAUDE.md` Workflow). 공개 전환·Pages 배포 전.
- 프로젝트 스킬 6개 `.claude/skills/`, 사용 가이드는 `CLAUDE.md` 「Project skills」. 개인정보 검색어는 `private/privacy-terms.txt`.
- Pages 배포(스펙 §17): 설계 `docs/superpowers/specs/2026-10-08-pages-deploy-design.md`, 계획 5a 전부 완료. 배포 후 QA(실제 주소, Chromium): 로드·2D/3D·PNG·PDF 15쪽(Pretendard)·새로고침 복원·라이선스 링크 OK. 휴대폰 Safari 확인은 미실시.
- `feat/room-finish`(main 미병합, `origin/main` `f8bf241` 위로 rebase): 스펙 §19 방 영역(영역 도구·꼭짓점 드래그)·바닥재/벽 마감(2D 패턴, 3D 텍스처, 벽 면별 마감)·우드톤 UI, 스키마 v4. 계획 `docs/superpowers/plans/2026-10-08-room-finish.md`.
- 테스트(`feat/room-finish` `4478b91`): typecheck 통과, `npm test` 374 통과·3 skip, e2e 25 통과(`e2e/roomFinish.spec.ts` 포함). 탐색 QA(샘플, 5181) 통과: L자 영역·꼭짓점 드래그·실행 취소/다시 실행·새로고침 유지·v3 JSON 열기·w5 양쪽 다른 벽 마감(3D 원근/탑뷰)·PDF 15쪽·전 탭 테마·2D 선택 파란색.
- 최종 리뷰 수정(`feat/room-finish`): 방 안 드래그로 화면 이동, 색 선택기 되돌리기 1단계, 여러 방에 걸친 벽은 방별 구간 마감(스펙 §19.3 수정), 벽 위 꼭짓점 손잡이, 「영역 다시 그리기」 초안 초기화, 이름표 재배치, 색 토큰. typecheck 통과, `npm test` 384 통과·3 skip, e2e 29 통과.
- 마지막 라운드 기록: `archive/20261008-electrical-pdf/HANDOFF.md`.

## 다음 할 일
0b. 다른 세션 PR #2(`feat/tracked-home-preset`, 스펙 「§20 프리셋 추적」 — §20은 카탈로그·설치 높이가 차지했으므로 병합 전 §21로 번호를 바꿔야 함)는 repo가 공개라 보류 중 — 사용자는 2026-10-09 「브라우저에서 열기」(프리셋 미푸시)를 선택. 병합하려면 공개 전제로 사용자 재확인 필요.
0. `feat/room-finish` PR 검토 후 `main` 병합(사용자 확인). 병합 후 `private/make-our-home.mjs`가 `version: 4`를 내보내도록 고쳐 다시 실행(영역·마감은 앱에서 그린다). 보류: 3D에서 샘플 「거실」 방 이름 라벨이 안 보임(main도 동일), T자 벽 접합부에서 영역 점이 벽 중심 끝점에 스냅됨.
0a. `feat/room-finish` 보류(최종 리뷰): T자 접합부 안쪽 모서리 스냅, e2e의 3D 반영 검증 강화(현재 캔버스 존재만 확인), 영역 자기 교차 검사(지금은 면적 0만 거부).
1. 배포 후속: 휴대폰 Safari에서 실제 주소 확인; 옛 repo `sn-house-interior-old` 삭제 여부(`gh auth refresh -s delete_repo` 후 `gh repo delete`); PWA(manifest·오프라인)는 범위 밖(설계 §12), 원하면 별도 라운드.
2. 계획 5 잔여(스펙 §14.5-5, §20.6): 삼성 모델 목록(사용자 제공) → `-sample` 제품의 공식 치수·`sourceUrl` 교체(`adding-catalog-product`). builder·탐색 QA는 §20 라운드에서 완료. 병합 후 `private/make-our-home.mjs`는 `version: 5`로.
2a. §20 보류 minor: 3D 원근에서 띄운 아이템 드래그는 아이템 높이 평면 사용(자동 테스트 없음, QA만), 2D에서 천장형 아이템이 바닥 아이템 위에 그려져 클릭을 먼저 받음(후보 목록으로 선택 가능), 카탈로그 필터는 분류명 미검색, 상판 위 가전 자동 높이·적층 스냅 없음, `duplicateItem`이 `normalizeItem`을 거치지 않음, `e2e/roomFinish.spec.ts:140` 병렬 실행 시 간헐 실패.
3. (완료) 히스토리 정리·공개 전환 — 기록은 `archive/20261008-pages-publish/HANDOFF.md`.
4. 보류된 minor(계획 5에서 재검토): 자동 체크리스트 id 재사용으로 "완료" 잔존, 폭 7m 미만 평면 전기 범례 잘림, `missingDedicatedCircuit` 중복 계산, R3F 첫 로드 크기 깜빡임, pdf e2e 쪽수 하한, FixtureProperties/ExportView 컴포넌트 테스트 없음, dev 콘솔 React "synchronously unmount a root" 오류(main에도 있음), PDF 메모의 이모지 누락(Pretendard 미포함), 샘플 평면 PDF 상단 "≈600" 치수 라벨 겹침.
