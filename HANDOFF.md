# sn-house-interior HANDOFF

프로젝트 개요·규칙은 `CLAUDE.md`, 문서 지도는 `docs/README.md`. 이 파일은 현재 상태와 다음 할 일만 둔다. 이슈별 상세 핸드오프는 `handoff/`(진행 중)·`archive/`(완료), 둘 다 git 제외.

## 지금 상태
- 2026-10-08 기준. `main` = `d3043fa`(계획 1–4 완료: 3D 배치, 2D 편집기, 배치안 A/B·PNG·복구 이력, 전기·체크리스트·업체용 PDF).
- `feat/quote-docs-home-preset`(main 미병합): 스펙 §15 3차 반영 — 현장 검수 체크리스트 교체 `e12f103`, PDF 견적 요청 4쪽 `9b5f3de`, 로컬 전용 우리 집 프리셋 `54cb00b`, 체크리스트 재설계 `a4614c6`, 탭별 참고 문서 링크 `1c74385`, 스펙 §16 중문 도구 `f8c4d82`.
- 테스트(`ff40b36`): typecheck 통과, `npm test` 313 통과·0 skip, e2e 19 통과. 탐색 QA(샘플 평면, 5181) 통과: 중문 배치·실행 취소/다시 실행, 2D↔3D, 체크리스트 필터·공정 이동·메모·새로고침 유지, 기본 정보 경계값, PDF 15쪽(Pretendard·견적 4쪽·중문 표시), 1200px 폭.
- PR 열림(main 병합은 사용자 확인 대기).
- 원격 `origin` = `jyp90/sn-house-interior`(비공개). 요청마다 워크트리·새 브랜치 → 로컬 검증 → PR → `main` 병합이 기본(`CLAUDE.md` Workflow). 공개 전환·Pages 배포 전(Pages 작업은 워크트리 `../homefit-pages-deploy` `feat/pages-deploy`).
- 프로젝트 스킬 6개 `.claude/skills/`, 사용 가이드는 `CLAUDE.md` 「Project skills」. 개인정보 검색어는 `private/privacy-terms.txt`.
- 마지막 라운드 기록: `archive/20261008-electrical-pdf/HANDOFF.md`.

## 다음 할 일
1. `feat/quote-docs-home-preset` PR 검토 후 `main` 병합(사용자 확인).
2. 계획 5(스펙 §14.5-5): 삼성 모델 목록(사용자 제공) → 카탈로그·나머지 builder(`stand-ac`, `built-in-appliance`, `cabinet-run`, `chair`, `wardrobe`), 탐색 QA.
3. 배포 준비: 저장소 공개 전 히스토리 정리(`f3726c0`에 프리셋 좌표, `scan.sh --log --all` 적중분, 계획 1 문서 3437행 평면도 파일명), Pretendard OFL 고지, Pages base 경로에서 글꼴 URL 확인.
4. 보류된 minor(계획 5에서 재검토): 자동 체크리스트 id 재사용으로 "완료" 잔존, 폭 7m 미만 평면 전기 범례 잘림, `missingDedicatedCircuit` 중복 계산, R3F 첫 로드 크기 깜빡임, pdf e2e 쪽수 하한, FixtureProperties/ExportView 컴포넌트 테스트 없음, dev 콘솔 React "synchronously unmount a root" 오류(main에도 있음), PDF 메모의 이모지 누락(Pretendard 미포함), 샘플 평면 PDF 상단 "≈600" 치수 라벨 겹침.
