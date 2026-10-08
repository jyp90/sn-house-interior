# GitHub Pages 배포 설계 (2026-10-08)

스펙 §16의 상세 문서. 결정 요약은 `2026-10-08-homefit-design.md` §16, 이 문서는 절차와 검증을 다룬다.

## 1. 목표

- `jyp90/sn-house-interior`를 공개 repo로 바꾸고 GitHub Pages로 배포한다. 주소: `https://jyp90.github.io/sn-house-interior/`
- 가족이 설치 없이 브라우저에서 앱을 연다. 데이터는 지금처럼 각자 브라우저(localStorage + IndexedDB)와 JSON 파일에만 있다. 서버는 두지 않는다.
- 공개 번들·repo·히스토리에 우리 집 프리셋 좌표, 단지명, 주소, 매물 URL, 평면도 이미지가 없어야 한다(CLAUDE.md 개인정보 규칙, 스펙 §3·§15.1).

성공 기준:
1. 위 주소에서 앱이 열리고 3D 배치, 2D 편집, PNG·PDF 내보내기, JSON 저장·불러오기가 동작한다.
2. 공개된 히스토리 어디에도 프리셋 좌표 코드 블록이 없다.
3. `main`에 push하면 자동으로 다시 배포되고, typecheck나 unit 테스트가 실패하면 배포하지 않는다.

## 2. 현재 상태(2026-10-08 확인)

| 항목 | 상태 |
|---|---|
| origin | `git@github.com:jyp90/sn-house-interior.git`, **private**. `main`(`d3043fa`)과 `feat/quote-docs-home-preset`이 이미 push되어 있음 |
| Pages | 꺼져 있음(API 404) |
| 민감 정보 | 단지명·URL·이미지는 히스토리에 없음. 프리셋 좌표 코드 블록이 `f3726c0`(plan 1 문서)에 있고 `7db3d06`에서 지웠음. 원격 히스토리에도 남아 있음 |
| 라우팅 | 라우터 없는 단일 페이지. 404 fallback 불필요 |
| 정적 자산 | Pretendard TTF는 `?url` import(`src/export/pdfFont.ts`)라 Vite `base`를 따른다. `public/` 없음 |
| 저장 키 | `homefit:` 접두어(`persistence/storage.ts`, `revisions.ts`). `jyp90.github.io` origin을 다른 프로젝트 Pages와 공유해도 키는 겹치지 않는다 |

## 3. 공개 범위(사용자 결정)

- 히스토리에서 지우는 것: plan 1 문서의 `private/make-our-home.mjs` 코드 블록(프리셋 좌표)만.
- 그대로 공개하는 것: 스펙 §3의 평면도 치수, 공급·전용 면적, 평면 형태 설명. 단지명·주소·URL·이미지는 원래부터 tracked 파일에 없다.
- 커밋 작성자 이메일도 그대로 공개된다(이번 범위에서 바꾸지 않음).

## 4. 히스토리 정리

plan 1 문서(`docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md`)를 바꾼 커밋은 `f3726c0`(추가)와 `7db3d06`(코드 블록을 한 줄 안내로 교체) 두 개뿐이다. 그래서 `f3726c0`부터 `7db3d06` 직전까지 모든 커밋에서 이 파일 blob을 `7db3d06` 버전으로 바꾸면 된다. 이렇게 하면 `7db3d06`은 빈 커밋이 되어 빠지고, 이후 커밋의 tree는 전혀 바뀌지 않는다.

도구: 새 도구를 설치하지 않도록 내장 `git filter-branch --index-filter`를 쓴다(`git filter-repo` 미설치).

```bash
FILE=docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md
BLOB=$(git rev-parse 7db3d06:$FILE)
git filter-branch --prune-empty --index-filter "
  if git ls-files --error-unmatch $FILE >/dev/null 2>&1 && \
     git cat-file -p :$FILE | grep -q 'const EXT = 20'; then
    git update-index --cacheinfo 100644,$BLOB,$FILE
  fi" -- main feat/quote-docs-home-preset
```

진행 순서와 검증:
1. 시작 전: 공유 체크아웃을 쓰는 다른 세션에 커밋하지 않은 변경이 없는지 확인한다. 정리 후에는 모든 SHA가 바뀌므로 다른 세션·worktree는 새 브랜치에서 다시 시작해야 한다. 백업으로 `git bundle create ../homefit-before-rewrite.bundle --all`(repo 밖, 공개하지 않음)을 만든다.
2. 정리 전에 `git rev-parse main^{tree} feat/quote-docs-home-preset^{tree}`를 기록한다.
3. filter-branch를 실행한다.
4. 검증:
   - 두 브랜치의 tree 해시가 정리 전과 같다(최종 코드는 그대로).
   - `git log --all -S'const EXT = 20'`과 `git log --all -S"wall('e-top'"` 결과가 비어 있다. 단, `refs/original/`과 reflog는 지운 다음에 확인한다.
   - 커밋 수가 1 줄었다(`7db3d06`만 빠짐).
5. 정리: `rm -rf .git/refs/original && git reflog expire --expire=now --all && git gc --prune=now`. HEAD와 모든 worktree가 정리된 브랜치를 가리키고 있어야 하고, stash가 비어 있어야 한다. 옛 커밋을 가리키는 HEAD가 하나라도 남아 있으면 gc가 옛 커밋을 지우지 못한다. 그 시점에 남아 있는 다른 브랜치(예: `feat/pages-deploy`)는 filter-branch 대상에 함께 넣는다.

2026-10-08 임시 clone에서 미리 실행해 봄: 두 브랜치 tree 동일, 커밋 77→76, `-S` 검색 결과 0건, `f3726c0` 객체 사라짐.

## 5. 원격 교체

force-push만으로는 부족하다. GitHub는 브랜치에서 떨어진 옛 커밋도 SHA URL로 한동안 보여줄 수 있어서, 공개로 바꾸면 옛 `f3726c0`이 노출될 수 있다. 그래서 **repo를 지우고 같은 이름으로 다시 만든다.**

1. (사용자 확인) `gh repo delete jyp90/sn-house-interior`. 이슈·PR·설정이 없는 것을 먼저 확인한다.
2. `gh repo create jyp90/sn-house-interior --private --source . --remote origin`으로 다시 만들고, 정리된 `main`과 `feat/quote-docs-home-preset`을 push한다.
3. 원격에서 §4 검증을 한 번 더 한다(clone을 새로 받아 `git log -S`).
4. (사용자 확인) 공개로 전환: `gh repo edit jyp90/sn-house-interior --visibility public --accept-visibility-change-consequences`.

## 6. 빌드 설정

- `vite.config.ts`: `command === 'build'`일 때만 `base: '/sn-house-interior/'`. dev 서버, Vitest, e2e(dev 서버 5180)는 `/` 그대로라 기존 테스트에는 영향이 없다.
- 코드 안 경로는 `import.meta.env.BASE_URL`이나 `?url` import만 쓴다. `/`로 시작하는 하드코딩 경로는 두지 않는다(현재 없음).
- 프리셋 차단은 기존 `virtual:home-preset` 규칙(build → `null`)을 그대로 쓴다.

## 7. 번들 검사

`scripts/check-dist.mjs`(React 없는 Node 스크립트, 의존성 없음)를 build 후에 실행한다. 아래 중 하나라도 걸리면 exit 1:
- `dist/`에 `.jpg`, `.jpeg`, `.png`, `.webp` 파일이 있음(현재 앱 번들에는 이미지가 없다. 나중에 정당한 이미지를 추가하면 허용 목록에 넣는다)
- `dist/` 텍스트 파일에 `our-home`, `home-floorplan`, `private/`, `make-our-home` 문자열이 있음
- `dist/index.html`이 없거나, 그 안의 asset 경로가 `/sn-house-interior/assets/`로 시작하지 않음

npm script: `"check:dist": "node scripts/check-dist.mjs"`. 로컬에서는 `npm run build && npm run check:dist`.

## 8. 배포 워크플로

`.github/workflows/pages.yml`:
- 트리거: `main` push, `workflow_dispatch`.
- 권한: `contents: read`, `pages: write`, `id-token: write`. `concurrency: pages`(진행 중인 배포는 취소하지 않음).
- job `build`: `actions/checkout@v4` → `actions/setup-node@v4`(Node 22, npm cache) → `npm ci` → `npm run typecheck` → `npm test` → `npm run build` → `npm run check:dist` → `actions/upload-pages-artifact@v3`(`dist`).
- job `deploy`: `needs: build`, environment `github-pages`, `actions/deploy-pages@v4`.
- e2e는 CI에서 돌리지 않는다(Playwright 브라우저 설치 비용). 지금처럼 merge 전에 로컬에서 `npm run e2e`.
- Pages 설정: (사용자 확인) `gh api -X POST repos/jyp90/sn-house-interior/pages -f build_type=workflow`.

## 9. 글꼴 라이선스 고지

- `node_modules/pretendard/dist/LICENSE.txt`(OFL-1.1)를 `public/licenses/Pretendard-OFL.txt`로 복사해 tracked 파일로 둔다. 빌드하면 `dist/licenses/`에 들어간다.
- 화면에 링크를 하나 둔다: 툴바 끝 "글꼴 라이선스" 링크 → `${import.meta.env.BASE_URL}licenses/Pretendard-OFL.txt`(새 탭). PDF에는 넣지 않는다.

## 10. 테스트와 QA

- unit: `check-dist.mjs`의 판정 함수를 분리해 `scripts/check-dist.test.ts`(또는 `src/` 밖이면 Vitest include에 추가)로 이미지 파일, 금지 문자열, base 경로 누락을 각각 검사한다.
- 로컬 확인: `npm run build && npx vite preview --base /sn-house-interior/`에서 PDF 내보내기(Pretendard fetch)와 PNG 내보내기를 확인한다.
- 배포 후 탐색 QA(스펙 §11): 실제 주소에서 첫 로드, 3D 회전·배치, 2D 편집, 배경 이미지 업로드(IndexedDB), PDF·PNG 내보내기, JSON 저장·불러오기, 새로고침 후 자동 저장 복원. 데스크톱 Chrome과 휴대폰 Safari에서 각각 확인한다.
- 공개 상태 확인: 로그아웃 브라우저로 repo를 열어 `docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md`의 히스토리에 좌표 블록이 없는지 본다.

## 11. 순서와 승인 지점

| # | 단계 | 되돌릴 수 있나 | 사용자 확인 |
|---|---|---|---|
| 1 | `feat/quote-docs-home-preset`을 마무리하고 `main`에 병합 | 예 | 병합 확인(기존 규칙) |
| 2 | `feat/pages-deploy`에서 §6–§10 구현, 로컬 검증 | 예 | 브랜치 병합 확인 |
| 3 | 히스토리 정리(§4) | bundle 백업이 있을 때만 | 실행 전 |
| 4 | repo 삭제·재생성·push(§5) | 아니오 | 실행 전 |
| 5 | 공개 전환, Pages 켜기 | 공개는 되돌려도 이미 본 사람·캐시에 남음 | 실행 전 |
| 6 | 첫 배포 확인과 탐색 QA | — | 결과 보고 |

## 12. 범위 밖

- 사용자 도메인, PWA·오프라인 캐시, 가족 사이 데이터 동기화(백엔드 필요), CI에서 e2e 실행, repo 라이선스 파일(필요하면 따로 결정).
