# sn-house-interior — 우리 집 인테리어 플래너

우리 부부가 직접 쓰려고 만든 인테리어 계획 앱입니다. 평면도를 바탕으로 집을 3D로 다시 세우고, 실제 크기의 가구·가전(삼성 제품 우선)을 끌어다 놓아 보고, 부딪히거나 문이 안 열리는 곳을 미리 확인한 뒤, 시공업체에 건넬 PDF까지 뽑습니다.

서버 없이 브라우저 안에서만 돌아갑니다. 저장은 이 컴퓨터(브라우저)에만 남고, 필요하면 JSON 파일로 내보내 둘 수 있습니다.

바로 쓰기: **https://jyp90.github.io/sn-house-interior/** (GitHub Pages, `main`이 바뀔 때마다 자동 배포)

## 뭘 할 수 있나

| 화면(모드) | 하는 일 |
|---|---|
| **구조** | 평면도 이미지를 깔고 축척을 맞춘 뒤 벽·문·창·방을 그립니다. 방마다 이름·면적·바닥재·벽지를 정할 수 있습니다. |
| **배치** | 카탈로그에서 가구·가전을 골라 2D/3D에서 끌어다 놓습니다. 배치안 A/B를 따로 만들어 비교할 수 있습니다. |
| **전기** | 콘센트·스위치·조명 위치를 찍고, 전용 회로가 필요한 가전(에어컨·인덕션 등) 옆에 콘센트가 있는지 확인합니다. |
| **체크리스트** | 시공 단계별 현장 확인 항목. 배치 내용에서 자동으로 생기는 항목도 있고, 메모를 달 수 있습니다. |
| **내보내기** | 평면 PNG, 업체 전달용 PDF(평면·치수·가구 목록·전기·견적 요청서). |

앱이 자동으로 잡아 주는 것:
- 가구끼리 겹침, 벽에 너무 붙음·떨어짐, 문·서랍이 열릴 공간 부족
- 방 면적 계산, 바닥재·벽지 적용 모습(3D)
- 「복구 이력」: 자동 저장 중 5분마다 한 번, 최근 20개 버전을 보관해 되돌릴 수 있음

## 실행하기

Node.js 22.18 이상이 필요합니다.

```bash
npm install
npm run dev        # 브라우저에서 http://localhost:5173 열기
```

우리 집 평면 프리셋(`home/plan.json` + `home/floorplan.jpg`)은 켤 때 자동으로 불러옵니다. 샘플 평면으로 띄우려면 `HOMEFIT_SAMPLE=1 npm run dev`.

상단 「업데이트」 버튼을 누르면 새 코드를 받아 앱을 다시 시작합니다(저장된 평면은 그대로 유지).

## 단축키

| 키 | 동작 |
|---|---|
| `Ctrl/⌘ + Z` / `Shift + Ctrl/⌘ + Z` | 되돌리기 / 다시 실행 |
| `Delete` / `Backspace` | 선택한 것 삭제 |
| `Ctrl/⌘ + D` | 선택한 가구 복제 |
| `R` | 선택한 가구 90° 회전 |
| 방향키 | 선택한 것을 1cm씩 이동(Shift: 10cm) |

## 저장과 백업

- 바꿀 때마다 브라우저에 자동 저장됩니다(상단에 저장 상태 표시).
- 상단 「JSON 저장」으로 파일을 내려받아 두면 다른 컴퓨터나 브라우저에서도 「JSON 열기」로 이어서 할 수 있습니다.
- 브라우저 데이터를 지우면 자동 저장분도 사라지니, 큰 수정 뒤엔 JSON으로 한 번 저장해 두세요.

## 개인정보

주소·단지명·매물 링크·원본 평면도 이미지는 `private/` 폴더에만 두고 git에는 올리지 않습니다. 저장소와 Pages(https://jyp90.github.io/sn-house-interior/)는 공개이며, 프리셋 평면과 단지명 없는 평면도 배경만 `home/`에 들어 있습니다. 내보낸 PNG/PDF에도 평면도 원본 이미지는 들어가지 않습니다.

## 개발 참고

개발 규칙·구조·설계 문서는 `CLAUDE.md`, `docs/README.md`, `HANDOFF.md`를 보세요. 모듈 메모는 `src/MODULE-MAP.md`.

### 테스트

```bash
npm run typecheck          # tsc --noEmit
npm test                   # vitest (단위·순수 함수)
npm run e2e                # Playwright, 5180 포트에 샘플 평면(HOMEFIT_SAMPLE=1) dev 서버를 직접 띄움
npm run build && npm run check:dist   # Pages 번들 검사: 허용된 평면도 외 이미지 없음, private/ 흔적 없음, base 경로
npm run e2e:preview        # 빌드 결과를 5181에서 base 경로(/sn-house-interior/)로 검사: PDF 글꼴·라이선스 링크
```

`npm run e2e` 전에 `lsof -i :5180`이 비어 있어야 합니다(Playwright는 떠 있는 서버를 재사용합니다).

### 배포

- `.github/workflows/pages.yml`: `main` push마다 `npm ci → typecheck → test → build → check:dist → GitHub Pages`. 한 단계라도 실패하면 배포되지 않습니다. Actions 탭에서 `workflow_dispatch`로 수동 재배포 가능.
- `.github/workflows/privacy.yml`: PR과 `main` push마다 개인정보 검색(`scan.sh --tracked / --log / --dist`). 저장소 secret `PRIVACY_TERMS`(한 줄에 검색어 하나)가 필요합니다.
- 배포 확인: `gh run list --workflow pages.yml -L 1`이 success인지 보고, 위 주소에서 우리 집 평면·3D·PDF가 뜨는지 확인.

### 체크리스트

작업을 마치기 전에 아래를 순서대로 확인합니다. 근거는 `CLAUDE.md` 규칙과 `.claude/skills/`의 `committing-safely`·`checking-privacy`·`syncing-docs`·`exploratory-qa`.

**커밋 전**
- [ ] 워크트리 `~/Projects/homefit-<topic>`, 브랜치 `<type>/<topic>`(`origin/main` 기반)에서 작업했다. `~/Projects/homefit`에서 직접 커밋하지 않는다.
- [ ] `git status --short`에 내가 바꾼 파일만 있다. 모르는 변경은 다른 세션 것이므로 건드리지 않는다.
- [ ] `npm run typecheck && npm test && npm run e2e` 모두 통과. 기대값 수정·테스트 skip·e2e에서 store 직접 호출로 통과시키지 않았다.
- [ ] 스테이징은 경로를 하나씩 지정했다(`git add -A`/`git add .`/`commit -a` 금지). `private/`, `handoff/`, `archive/`, `.superpowers/`, `dist/`, `test-results/`, `playwright-report/`, 루트 `Planner 5D …md`는 올리지 않는다.
- [ ] `bash .claude/skills/checking-privacy/scan.sh --staged` HIT 0.
- [ ] `src/model/schema.ts`를 바꿨다면 `CURRENT_VERSION` +1, 마이그레이션 단계, `parse.test.ts` 케이스를 함께 추가했다.
- [ ] 문서 동기화: `HANDOFF.md` 「지금 상태」/「다음 할 일」, `CLAUDE.md` 「Work in progress」, `docs/README.md` Feature map, `src/MODULE-MAP.md`, 제품 결정은 스펙에 새 `§N` 라운드로 추가.
- [ ] 커밋 메시지는 Conventional Commits, 주소·단지명·매물 링크 없음.

**PR 전**
- [ ] 실제 브라우저 탐색 QA(`HOMEFIT_SAMPLE=1 npm run dev -- --port 5181`): 바꾼 기능 조작, 실행 취소/다시 실행, 2D↔3D, 새로고침 복원, PNG/PDF 내보내기, 콘솔 오류 0.
- [ ] `bash .claude/skills/checking-privacy/scan.sh --log origin/main..HEAD` HIT 0.
- [ ] `git push -u origin <branch>` → `gh pr create --base main`(한국어 제목/본문: 변경 요약, 테스트 수치, QA 결과, 스펙 §).
- [ ] CI 「Privacy scan」 체크가 녹색이다.
- [ ] `main`이 움직였으면 `git rebase origin/main` 후 검사를 다시 돌리고 `--force-with-lease`(내 브랜치만).
- [ ] 새 의존성 추가, `main` 직접 push, force-push는 사용자 OK가 있을 때만.

**머지·배포 후**
- [ ] `gh pr merge <n> --merge --delete-branch`로 바로 머지했다(열어 두지 않는다).
- [ ] Pages 워크플로 success, 실제 주소에서 우리 집 평면·3D·PDF 확인. 배포 번들을 손댔다면 로컬에서 `npm run build && npm run check:dist`, `scan.sh --dist`, `npm run e2e:preview`도 통과.
- [ ] 정리: `git worktree remove ../homefit-<topic>`, `git branch -D <branch>`, `git push origin --delete <branch>`, `git fetch --prune && git worktree prune`. 남은 워크트리·브랜치는 결함이다.

**개인정보(항상)**
- [ ] 주소·단지명·매물 링크·원본 평면도·`make-our-home.mjs`는 `private/`에만 둔다. 추적 파일·번들·PNG/PDF·커밋 메시지·문서·대화 출력에 넣지 않는다.
- [ ] `home/plan.json` 제목은 「우리 집」, `home/floorplan.jpg`에 단지명이 없다.
- [ ] 새 개인정보 항목은 `private/privacy-terms.txt`와 GitHub secret `PRIVACY_TERMS`에 먼저 추가한다. 스캔 출력의 `term#N`만 인용한다.
- [ ] 옛 repo(`sn-house-interior-old`) 기반 브랜치는 push하지 않는다.

## 라이선스

- 코드: 가족용 개인 프로젝트로, 별도 오픈소스 라이선스를 두지 않았습니다(저작권 보유). 참고·학습 목적의 열람은 환영합니다.
- 글꼴 Pretendard: SIL Open Font License 1.1 (`public/licenses/Pretendard-OFL.txt`, 앱 안 라이선스 링크).
