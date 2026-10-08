# sn-house-interior HANDOFF

프로젝트 개요·규칙은 `CLAUDE.md`, 문서 지도는 `docs/README.md`. 이 파일은 현재 상태와 다음 할 일만 둔다. 이슈별 상세 핸드오프는 `handoff/`(진행 중)·`archive/`(완료), 둘 다 git 제외.

## 지금 상태
- 2026-10-08 기준. `main`: 계획 1–4, 3차 반영(PR #1, 스펙 §15·§16), 워크플로 문서(PR #3), Pages 배포 준비(PR #4, 스펙 §17) 병합.
- `docs/preset-outlets`: 우리 집 프리셋(private)에 일반 콘센트 15개 가안 추가(총 21개), 스펙 §15 프리셋 반영 사항 한 줄 보강. 코드 변경 없음.
- `feat/self-update`(main 미병합): 스펙 §18 「업데이트」 버튼 — dev 서버가 원격 fast-forward → 필요 시 `npm install` → 재시작 → 화면 새로고침.
- 테스트(`feat/self-update`): typecheck 통과, `npm test` 329 통과·0 skip, e2e 23 통과. 탐색 QA: 가짜 원격(bare repo)으로 실제 pull·서버 재시작·새로고침·평면 유지, 재클릭 시 「이미 최신」, 미커밋 변경 거부, 다른 출처 거부.
- `feat/quote-docs-home-preset`(PR #1로 main 병합): 스펙 §15 3차 반영 — 현장 검수 체크리스트 교체 `e12f103`, PDF 견적 요청 4쪽 `9b5f3de`, 로컬 전용 우리 집 프리셋 `54cb00b`, 체크리스트 재설계 `a4614c6`, 탭별 참고 문서 링크 `1c74385`, 스펙 §16 중문 도구 `f8c4d82`.
- 테스트(`ff40b36`): typecheck 통과, `npm test` 313 통과·0 skip, e2e 19 통과. 탐색 QA(샘플 평면, 5181) 통과: 중문 배치·실행 취소/다시 실행, 2D↔3D, 체크리스트 필터·공정 이동·메모·새로고침 유지, 기본 정보 경계값, PDF 15쪽(Pretendard·견적 4쪽·중문 표시), 1200px 폭.
- 원격 `origin` = `jyp90/sn-house-interior`(비공개). 요청마다 워크트리·새 브랜치 → 로컬 검증 → PR → `main` 병합이 기본(`CLAUDE.md` Workflow). 공개 전환·Pages 배포 전.
- 프로젝트 스킬 6개 `.claude/skills/`, 사용 가이드는 `CLAUDE.md` 「Project skills」. 개인정보 검색어는 `private/privacy-terms.txt`.
- `feat/pages-deploy`: Pages 배포 설계 `docs/superpowers/specs/2026-10-08-pages-deploy-design.md`(스펙 §17), 계획 5a `docs/superpowers/plans/2026-10-08-homefit-05a-pages-deploy.md`. Tasks 1–3(base 경로, `check:dist`, OFL 고지, `pages.yml`) main 병합; Task 4(히스토리 정리, repo 재생성, 공개, Pages)는 사용자 확인 대기. 테스트: typecheck, unit, e2e, e2e:preview 2, check:dist.
- `feat/room-finish`(main 미병합, `origin/main` `f8bf241` 위로 rebase): 스펙 §19 방 영역(영역 도구·꼭짓점 드래그)·바닥재/벽 마감(2D 패턴, 3D 텍스처, 벽 면별 마감)·우드톤 UI, 스키마 v4. 계획 `docs/superpowers/plans/2026-10-08-room-finish.md`.
- 테스트(`feat/room-finish` `4478b91`): typecheck 통과, `npm test` 374 통과·3 skip, e2e 25 통과(`e2e/roomFinish.spec.ts` 포함). 탐색 QA(샘플, 5181) 통과: L자 영역·꼭짓점 드래그·실행 취소/다시 실행·새로고침 유지·v3 JSON 열기·w5 양쪽 다른 벽 마감(3D 원근/탑뷰)·PDF 15쪽·전 탭 테마·2D 선택 파란색.
- 최종 리뷰 수정(`feat/room-finish`): 방 안 드래그로 화면 이동, 색 선택기 되돌리기 1단계, 여러 방에 걸친 벽은 방별 구간 마감(스펙 §19.3 수정), 벽 위 꼭짓점 손잡이, 「영역 다시 그리기」 초안 초기화, 이름표 재배치, 색 토큰. typecheck 통과, `npm test` 384 통과·3 skip, e2e 29 통과.
- 마지막 라운드 기록: `archive/20261008-electrical-pdf/HANDOFF.md`.

## 다음 할 일
0. `feat/room-finish` PR 검토 후 `main` 병합(사용자 확인). 병합 후 `private/make-our-home.mjs`가 `version: 4`를 내보내도록 고쳐 다시 실행(영역·마감은 앱에서 그린다). 보류: 3D에서 샘플 「거실」 방 이름 라벨이 안 보임(main도 동일), T자 벽 접합부에서 영역 점이 벽 중심 끝점에 스냅됨.
0a. `feat/room-finish` 보류(최종 리뷰): T자 접합부 안쪽 모서리 스냅, e2e의 3D 반영 검증 강화(현재 캔버스 존재만 확인), 영역 자기 교차 검사(지금은 면적 0만 거부).
1. 계획 5a Task 4(설계 §11): 히스토리 정리 → repo 재생성 → 공개·Pages. 단계마다 사용자 확인.
1a. `feat/self-update` PR #2 검토 후 `main` 병합(사용자 확인).
2. 계획 5(스펙 §14.5-5): 삼성 모델 목록(사용자 제공) → 카탈로그·나머지 builder(`stand-ac`, `built-in-appliance`, `cabinet-run`, `chair`, `wardrobe`), 탐색 QA.
3. (1번에 통합) 히스토리 정리 대상: `f3726c0` 프리셋 좌표, plan 1 문서 비공개 이미지 파일명(term#6, tip은 수정됨). 규칙 `private/plan1-redact.sed`.
4. 보류된 minor(계획 5에서 재검토): 자동 체크리스트 id 재사용으로 "완료" 잔존, 폭 7m 미만 평면 전기 범례 잘림, `missingDedicatedCircuit` 중복 계산, R3F 첫 로드 크기 깜빡임, pdf e2e 쪽수 하한, FixtureProperties/ExportView 컴포넌트 테스트 없음, dev 콘솔 React "synchronously unmount a root" 오류(main에도 있음), PDF 메모의 이모지 누락(Pretendard 미포함), 샘플 평면 PDF 상단 "≈600" 치수 라벨 겹침.
