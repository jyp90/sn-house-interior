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
- 마지막 라운드 기록: `archive/20261008-electrical-pdf/HANDOFF.md`.

## 다음 할 일
1. 계획 5a Task 4(설계 §11): 히스토리 정리 → repo 재생성 → 공개·Pages. 단계마다 사용자 확인.
1a. `feat/self-update` PR #2 검토 후 `main` 병합(사용자 확인).
2. 계획 5(스펙 §14.5-5): 삼성 모델 목록(사용자 제공) → 카탈로그·나머지 builder(`stand-ac`, `built-in-appliance`, `cabinet-run`, `chair`, `wardrobe`), 탐색 QA.
3. (1번에 통합) 히스토리 정리 대상: `f3726c0` 프리셋 좌표, plan 1 문서 비공개 이미지 파일명(term#6, tip은 수정됨). 규칙 `private/plan1-redact.sed`.
4. 보류된 minor(계획 5에서 재검토): 자동 체크리스트 id 재사용으로 "완료" 잔존, 폭 7m 미만 평면 전기 범례 잘림, `missingDedicatedCircuit` 중복 계산, R3F 첫 로드 크기 깜빡임, pdf e2e 쪽수 하한, FixtureProperties/ExportView 컴포넌트 테스트 없음, dev 콘솔 React "synchronously unmount a root" 오류(main에도 있음), PDF 메모의 이모지 누락(Pretendard 미포함), 샘플 평면 PDF 상단 "≈600" 치수 라벨 겹침.
