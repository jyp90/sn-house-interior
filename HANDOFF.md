# homefit HANDOFF

프로젝트 개요·규칙은 `CLAUDE.md`, 문서 지도는 `docs/README.md`. 이 파일은 현재 상태와 다음 할 일만 둔다. 이슈별 상세 핸드오프는 `handoff/`(진행 중)·`archive/`(완료), 둘 다 git 제외.

## 지금 상태
- 2026-10-08 기준. `main` = `d3043fa`(계획 1–4 완료: 3D 배치, 2D 편집기, 배치안 A/B·PNG·복구 이력, 전기·체크리스트·업체용 PDF).
- `feat/quote-docs-home-preset`(main 미병합): 스펙 §15 3차 반영 — 현장 검수 체크리스트 교체 `e12f103`, PDF 견적 요청 4쪽 `9b5f3de`, 로컬 전용 우리 집 프리셋 `54cb00b`.
- 테스트(`54cb00b`): typecheck 통과, `npm test` 300 통과·3 skip. e2e는 `d3043fa`에서 18 통과가 마지막 기록.
- 원격(GitHub) 없음. push·Pages 배포 전.
- 마지막 라운드 기록: `archive/20261008-electrical-pdf/HANDOFF.md`.

## 다음 할 일
1. `feat/quote-docs-home-preset` 마무리: e2e 재확인, 탐색 QA, `main` 병합(사용자 확인).
2. 계획 5(스펙 §14.5-5): 삼성 모델 목록(사용자 제공) → 카탈로그·나머지 builder(`stand-ac`, `built-in-appliance`, `cabinet-run`, `chair`, `wardrobe`), 탐색 QA.
3. 배포 준비: 첫 push 전 히스토리 정리(`f3726c0`에 프리셋 좌표), Pretendard OFL 고지, Pages base 경로에서 글꼴 URL 확인.
4. 보류된 minor(계획 5에서 재검토): 자동 체크리스트 id 재사용으로 "완료" 잔존, 폭 7m 미만 평면 전기 범례 잘림, `missingDedicatedCircuit` 중복 계산, R3F 첫 로드 크기 깜빡임, pdf e2e 쪽수 하한, FixtureProperties/ExportView 컴포넌트 테스트 없음.
