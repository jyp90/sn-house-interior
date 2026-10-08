# GitHub Pages 배포 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `https://jyp90.github.io/sn-house-interior/`에서 앱이 열리게 한다. base 경로 빌드, 번들 검사, 글꼴 라이선스 고지, Actions 배포를 만들고, 히스토리를 정리한 뒤 공개한다.

**Architecture:** Vite `base`는 build·preview일 때만 `/sn-house-interior/`로 둔다. 빌드 후 Node 스크립트 `scripts/check-dist.ts`가 dist를 검사해서 이미지, 프리셋 흔적, base 밖 경로가 있으면 실패시킨다. GitHub Actions는 typecheck → unit → build → check:dist가 모두 통과해야 `deploy-pages`를 실행한다. 히스토리 정리, repo 재생성, 공개 전환은 Task 4에서 메인 세션이 사용자 확인을 받으며 한다.

**Tech Stack:** Vite 8, TypeScript(Node 22 type stripping으로 `.ts` 스크립트 직접 실행), Vitest 5, Playwright 1.63, GitHub Actions(`actions/upload-pages-artifact@v3`, `actions/deploy-pages@v4`).

**Spec:** `docs/superpowers/specs/2026-10-08-pages-deploy-design.md` (요약 `docs/superpowers/specs/2026-10-08-homefit-design.md` §17)

## Global Constraints

- base 경로: `/sn-house-interior/`. dev 서버·Vitest·기존 e2e(포트 5180)는 `/` 그대로.
- 새 npm 의존성 없음. 새 도구 설치 없음(`git filter-repo` 쓰지 않음).
- 번들 금지 문자열: `our-home.local`, `make-our-home`, `home-floorplan.jpg`, `private/`. 금지 확장자: `.jpg`, `.jpeg`, `.png`, `.webp`, `.heic`, `.gif`, `.avif`, `.bmp`.
- 프리셋 차단은 기존 `virtual:home-preset` 규칙(build → `null`)을 바꾸지 않는다.
- UI 문구는 한국어. 링크 이름 `글꼴 라이선스`, 새 탭(`target="_blank" rel="noreferrer"`).
- `git add`는 경로를 명시. `private/`, `handoff/`, `archive/`, `.superpowers/`, `dist/`, 루트 `Planner 5D …md`는 stage 금지.
- push, repo 삭제·생성, 공개 전환, Pages 설정은 Task 4에서 단계마다 사용자 확인을 받은 뒤에만 한다.
- 커밋: Conventional Commits, 끝에 `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`.
- 작업 위치: worktree `/Users/jypark/Projects/homefit-pages-deploy`, 브랜치 `feat/pages-deploy`. `node_modules`는 `../homefit/node_modules` symlink(git 제외). 메인 체크아웃에서 5180 dev 서버가 떠 있으면 e2e가 그 서버를 재사용하니, e2e 전에 그 서버를 끈다.

## Review Focus

1. 로컬에 `private/`가 있는 상태에서 build하면 프리셋 JSON이나 평면도 jpg가 dist에 섞인다 → `check:dist`가 실패해야 한다(Task 1 단위 테스트, Task 4 Step 1에서 메인 체크아웃 실제 빌드).
2. base 경로에서 PDF를 내보낼 때 Pretendard TTF를 `/assets/…`(base 없음)로 요청해 404가 나서 PDF가 실패한다 → preview e2e에서 TTF 응답 200과 PDF 다운로드를 확인(Task 2).
3. 라이선스 링크가 base를 빠뜨려 `/licenses/…`로 가면 Pages에서 404 → preview e2e에서 링크 href를 요청해 200과 OFL 본문을 확인(Task 2).
4. index.html이 base 밖 절대 경로(`/src/…`, `/assets/…`)를 참조 → `findDistProblems`가 잡아야 한다(Task 1 테스트).
5. unit이나 typecheck가 실패했는데도 배포됨 → workflow에서 `deploy`가 `needs: build`이고 build job에 검사 단계가 모두 있는지 Task 3에서 구조를 확인.

---

### Task 1: 번들 검사 스크립트

**Files:**
- Create: `scripts/check-dist.ts`
- Test: `scripts/check-dist.test.ts`
- Modify: `vite.config.ts` (test.include), `tsconfig.json` (include), `package.json` (scripts), `src/MODULE-MAP.md`

**Interfaces:**
- Produces: `export const BASE = '/sn-house-interior/'`, `export const FORBIDDEN_TEXT: string[]`, `export type DistFile = { path: string; text: string | null }`, `export function findDistProblems(files: DistFile[]): string[]`, `export function readDist(dir: string): DistFile[]`. CLI: `node scripts/check-dist.ts [dir]`(기본 `dist`). 문제가 있으면 한 줄씩 출력하고 exit 1, 없으면 `dist 검사 통과 (N개 파일)` 출력 후 exit 0. npm script `check:dist`.

- [ ] **Step 1: 테스트 포함 경로 넓히기**

`vite.config.ts`의 `test.include`:
```ts
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
```
`tsconfig.json`의 `include`:
```json
  "include": ["src", "e2e", "scripts", "vite.config.ts", "playwright.config.ts"]
```

- [ ] **Step 2: 실패하는 테스트 작성** — `scripts/check-dist.test.ts`

```ts
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BASE, findDistProblems, readDist, type DistFile } from './check-dist';

const INDEX_OK = `<!doctype html><html><head><script type="module" src="${BASE}assets/index-abc.js"></script><link rel="stylesheet" href="${BASE}assets/index-abc.css"></head><body></body></html>`;
const ok = (): DistFile[] => [
  { path: 'index.html', text: INDEX_OK },
  { path: 'assets/index-abc.js', text: 'console.log(1)' },
  { path: 'assets/Pretendard-Regular-x.ttf', text: null },
  { path: 'licenses/Pretendard-OFL.txt', text: 'SIL OPEN FONT LICENSE' },
];

describe('findDistProblems', () => {
  it('정상 번들은 문제가 없다', () => {
    expect(findDistProblems(ok())).toEqual([]);
  });

  it.each(['photo.jpg', 'assets/plan.JPEG', 'a.png', 'b.webp'])('이미지 파일 %s를 잡는다', (path) => {
    expect(findDistProblems([...ok(), { path, text: null }])).toEqual([`이미지 파일: ${path}`]);
  });

  it.each(['our-home.local', 'make-our-home', 'home-floorplan.jpg', 'private/'])('금지 문자열 %s를 잡는다', (word) => {
    const files = [...ok(), { path: 'assets/x.js', text: `const a = "${word}";` }];
    expect(findDistProblems(files)).toEqual([`금지 문자열 "${word}": assets/x.js`]);
  });

  it('index.html이 없으면 잡는다', () => {
    expect(findDistProblems(ok().filter((f) => f.path !== 'index.html'))).toEqual(['index.html 없음']);
  });

  it('base 밖 절대 경로와 base 누락을 잡는다', () => {
    const index = '<html><script type="module" src="/src/main.tsx"></script></html>';
    const files = [{ path: 'index.html', text: index }];
    expect(findDistProblems(files)).toEqual([`index.html에 ${BASE}assets/ 경로가 없음`, 'base 밖 경로: /src/main.tsx']);
  });

  it('외부 URL과 data URL은 base 검사에서 뺀다', () => {
    const index = INDEX_OK.replace('</head>', '<link rel="icon" href="data:,"><link href="https://example.com/a.css"></head>');
    expect(findDistProblems([{ path: 'index.html', text: index }])).toEqual([]);
  });
});

describe('readDist', () => {
  it('하위 폴더까지 읽고 텍스트 파일만 내용을 담는다', () => {
    const dir = mkdtempSync(join(tmpdir(), 'dist-'));
    mkdirSync(join(dir, 'assets'));
    writeFileSync(join(dir, 'index.html'), INDEX_OK);
    writeFileSync(join(dir, 'assets', 'a.js'), 'x');
    writeFileSync(join(dir, 'assets', 'f.ttf'), Buffer.from([0, 1, 2]));
    const files = readDist(dir).sort((a, b) => a.path.localeCompare(b.path));
    expect(files).toEqual([
      { path: 'assets/a.js', text: 'x' },
      { path: 'assets/f.ttf', text: null },
      { path: 'index.html', text: INDEX_OK },
    ]);
  });
});
```

- [ ] **Step 3: 실패 확인**

Run: `npx vitest run scripts/check-dist.test.ts`
Expected: FAIL, `Failed to resolve import "./check-dist"`

- [ ] **Step 4: 구현** — `scripts/check-dist.ts`

Node 22 type stripping으로 직접 실행하므로 enum, namespace, parameter property는 쓰지 않는다.
```ts
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, sep } from 'node:path';
import { pathToFileURL } from 'node:url';

// 공개 Pages 번들 검사(배포 설계 §7). 우리 집 프리셋·평면도 이미지가 dist에 섞이거나 base 경로가 빠지면 실패한다.
export const BASE = '/sn-house-interior/';
export const FORBIDDEN_TEXT = ['our-home.local', 'make-our-home', 'home-floorplan.jpg', 'private/'];
const IMAGE_EXT = /\.(jpe?g|png|webp)$/i;
const TEXT_EXT = /\.(html|js|css|json|txt|svg|map)$/i;

export type DistFile = { path: string; text: string | null };

export function findDistProblems(files: DistFile[]): string[] {
  const problems: string[] = [];
  for (const f of files) {
    if (IMAGE_EXT.test(f.path)) problems.push(`이미지 파일: ${f.path}`);
    if (f.text === null) continue;
    for (const word of FORBIDDEN_TEXT) {
      if (f.text.includes(word)) problems.push(`금지 문자열 "${word}": ${f.path}`);
    }
  }
  const index = files.find((f) => f.path === 'index.html');
  if (!index || index.text === null) {
    problems.push('index.html 없음');
    return problems;
  }
  const refs = [...index.text.matchAll(/(?:src|href)="([^"]+)"/g)].map((m) => m[1]);
  const local = refs.filter((r) => !/^(https?:|data:|#)/.test(r));
  if (!local.some((r) => r.startsWith(`${BASE}assets/`))) problems.push(`index.html에 ${BASE}assets/ 경로가 없음`);
  for (const r of local) if (!r.startsWith(BASE)) problems.push(`base 밖 경로: ${r}`);
  return problems;
}

export function readDist(dir: string): DistFile[] {
  return readdirSync(dir, { recursive: true, encoding: 'utf8' })
    .filter((rel) => statSync(join(dir, rel)).isFile())
    .map((rel) => ({
      path: rel.split(sep).join('/'),
      text: TEXT_EXT.test(rel) ? readFileSync(join(dir, rel), 'utf8') : null,
    }));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const files = readDist(process.argv[2] ?? 'dist');
  const problems = findDistProblems(files);
  if (problems.length > 0) {
    for (const p of problems) console.error(p);
    process.exit(1);
  }
  console.log(`dist 검사 통과 (${files.length}개 파일)`);
}
```

- [ ] **Step 5: 통과 확인**

Run: `npx vitest run scripts/check-dist.test.ts && npm run typecheck`
Expected: PASS(13 tests), typecheck 오류 없음

- [ ] **Step 6: npm script와 실행 확인**

`package.json` `scripts`에 `"check:dist": "node scripts/check-dist.ts"`를 넣는다(`"e2e"` 다음).
Run: `npx vite build --base /sn-house-interior/ && npm run check:dist`
Expected: `dist 검사 통과 (12개 파일)`(파일 수는 빌드에 따라 다를 수 있음). Node가 type stripping 경고를 출력해도 괜찮다.
Run: `npx vite build && npm run check:dist; echo rc=$?`
Expected: `base 밖 경로: /assets/…` 줄들과 `rc=1`(base 없이 빌드하면 실패하는지 확인)

- [ ] **Step 7: MODULE-MAP**

`src/MODULE-MAP.md` 끝에 추가:
```markdown
## scripts/ (Node, outside the app bundle)
- `check-dist.ts` — post-build Pages bundle guard: no images, no home-preset markers, all index.html refs under `/sn-house-interior/` (deploy design §7). `npm run check:dist`.
```

- [ ] **Step 8: Commit**

```bash
git add scripts/check-dist.ts scripts/check-dist.test.ts vite.config.ts tsconfig.json package.json src/MODULE-MAP.md
git commit -m "build: add Pages bundle guard script

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: base 경로, 글꼴 라이선스 고지, preview e2e

**Files:**
- Modify: `vite.config.ts` (config 함수형 + `base`), `src/ui/Toolbar.tsx`, `src/styles.css`(툴바 링크 스타일), `package.json`, `tsconfig.json`, `src/MODULE-MAP.md`
- Create: `public/licenses/Pretendard-OFL.txt`, `playwright.preview.config.ts`, `e2e-preview/base-path.spec.ts`
- Test: `e2e/license.spec.ts`, `e2e-preview/base-path.spec.ts`

**Interfaces:**
- Consumes: Task 1 `npm run check:dist`, `BASE`.
- Produces: npm script `e2e:preview`(`playwright test -c playwright.preview.config.ts`). 툴바 링크 이름 `글꼴 라이선스`, href `${import.meta.env.BASE_URL}licenses/Pretendard-OFL.txt`.

- [ ] **Step 1: dev 기준 e2e 작성** — `e2e/license.spec.ts`

```ts
import { expect, test } from '@playwright/test';

test('툴바의 글꼴 라이선스 링크가 OFL 전문을 새 탭으로 연다', async ({ page, request }) => {
  await page.goto('/');
  const link = page.getByRole('link', { name: '글꼴 라이선스' });
  await expect(link).toHaveAttribute('href', '/licenses/Pretendard-OFL.txt');
  await expect(link).toHaveAttribute('target', '_blank');
  const res = await request.get('/licenses/Pretendard-OFL.txt');
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('SIL Open Font License, Version 1.1');
});
```

- [ ] **Step 2: 실패 확인**

Run: `npx playwright test e2e/license.spec.ts`
Expected: FAIL, link `글꼴 라이선스`를 찾지 못함

- [ ] **Step 3: 라이선스 파일과 링크**

```bash
mkdir -p public/licenses && cp node_modules/pretendard/dist/LICENSE.txt public/licenses/Pretendard-OFL.txt
```
`src/ui/Toolbar.tsx`에서 `<span className={`save-status …`} … />` 바로 다음에:
```tsx
      <a className="toolbar-link" href={`${import.meta.env.BASE_URL}licenses/Pretendard-OFL.txt`} target="_blank" rel="noreferrer">글꼴 라이선스</a>
```
`src/styles.css`의 `.save-status` 줄(이미 `margin-left: auto`) 다음에:
```css
.toolbar .toolbar-link { margin-left: 8px; font-size: 12px; color: #6b7280; }
```

- [ ] **Step 4: 통과 확인**

Run: `npx playwright test e2e/license.spec.ts`
Expected: PASS

- [ ] **Step 5: preview e2e 작성**

`playwright.preview.config.ts`:
```ts
import { defineConfig, devices } from '@playwright/test';

// 배포와 같은 base 경로(/sn-house-interior/)로 빌드한 번들을 vite preview로 띄워 확인한다(배포 설계 §10).
export default defineConfig({
  testDir: 'e2e-preview',
  timeout: 60_000,
  use: {
    baseURL: 'http://localhost:5181/sn-house-interior/',
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 5181 --strictPort',
    url: 'http://localhost:5181/sn-house-interior/',
    reuseExistingServer: false,
    timeout: 180_000,
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
```
`e2e-preview/base-path.spec.ts`:
```ts
import { expect, test } from '@playwright/test';

test.beforeEach(async ({ page }) => {
  await page.goto('./');
  await page.evaluate(() => localStorage.clear());
  await page.reload();
  await expect(page.locator('.viewport canvas')).toBeVisible();
});

test('base 경로 빌드에서 PDF를 내려받고 글꼴을 base 아래에서 가져온다', async ({ page }) => {
  const fontStatuses: [string, number][] = [];
  page.on('response', (r) => {
    if (r.url().endsWith('.ttf')) fontStatuses.push([new URL(r.url()).pathname, r.status()]);
  });
  await page.getByRole('button', { name: '내보내기', exact: true }).click();
  const downloading = page.waitForEvent('download');
  await page.getByTestId('export-view').getByRole('button', { name: 'PDF 내려받기' }).click();
  const download = await downloading;
  expect(download.suggestedFilename()).toMatch(/\.pdf$/);
  expect(fontStatuses.length).toBeGreaterThanOrEqual(2);
  for (const [path, status] of fontStatuses) {
    expect(path).toMatch(/^\/sn-house-interior\/assets\//);
    expect(status).toBe(200);
  }
});

test('base 경로 빌드에서 글꼴 라이선스 링크가 열린다', async ({ page, request }) => {
  const href = await page.getByRole('link', { name: '글꼴 라이선스' }).getAttribute('href');
  expect(href).toBe('/sn-house-interior/licenses/Pretendard-OFL.txt');
  const res = await request.get(`http://localhost:5181${href}`);
  expect(res.status()).toBe(200);
  expect(await res.text()).toContain('SIL Open Font License, Version 1.1');
});
```
`package.json` scripts: `"e2e:preview": "playwright test -c playwright.preview.config.ts"`. `tsconfig.json` include에 `"e2e-preview"`, `"playwright.preview.config.ts"` 추가.

- [ ] **Step 6: 실패 확인**

Run: `npm run e2e:preview`
Expected: FAIL. 아직 config에 base가 없어서 `http://localhost:5181/sn-house-interior/`가 404이고 webServer 대기가 타임아웃되거나 테스트가 실패한다.

- [ ] **Step 7: vite base 설정** — `vite.config.ts`

`export default defineConfig({ … })`를 함수형으로 바꾼다:
```ts
// Pages 주소가 https://jyp90.github.io/sn-house-interior/ 라서 build·preview만 base를 붙인다. dev·Vitest·e2e(5180)는 '/'(배포 설계 §6)
export default defineConfig(({ command, isPreview }) => ({
  base: command === 'build' || isPreview ? '/sn-house-interior/' : '/',
  plugins: [react(), homePreset()],
  test: {
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx', 'scripts/**/*.test.ts'],
    environment: 'node',
  },
}));
```

- [ ] **Step 8: 통과 확인**

Run: `npm run build && npm run check:dist && npm run e2e:preview`
Expected: `dist 검사 통과`, preview e2e 2 passed
Run: `npm run typecheck && npm test && npm run e2e`
Expected: 모두 통과(기존 e2e 18 + license 1)

- [ ] **Step 9: MODULE-MAP**

`src/MODULE-MAP.md` `## ui/` 아래 Toolbar 줄 다음에:
```markdown
- `Toolbar` ends with the `글꼴 라이선스` link → `public/licenses/Pretendard-OFL.txt` via `import.meta.env.BASE_URL` (deploy design §9).
```
`## scripts/` 아래에:
```markdown
- Base path `/sn-house-interior/` applies to build and preview only (`vite.config.ts`); `npm run e2e:preview` (`playwright.preview.config.ts`, `e2e-preview/`) checks fonts and the license link under that base on port 5181.
```

- [ ] **Step 10: Commit**

```bash
git add vite.config.ts src/ui/Toolbar.tsx src/styles.css public/licenses/Pretendard-OFL.txt playwright.preview.config.ts e2e-preview/base-path.spec.ts e2e/license.spec.ts package.json tsconfig.json src/MODULE-MAP.md
git commit -m "build: serve under /sn-house-interior/ base and add Pretendard OFL notice

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Pages 배포 워크플로

**Files:**
- Create: `.github/workflows/pages.yml`
- Modify: `src/MODULE-MAP.md`

**Interfaces:**
- Consumes: npm scripts `typecheck`, `test`, `build`, `check:dist`.

- [ ] **Step 1: 워크플로 작성** — `.github/workflows/pages.yml`

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: [main]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: pages
  cancel-in-progress: false

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: npm
      - run: npm ci
      - run: npm run typecheck
      - run: npm test
      - run: npm run build
      - run: npm run check:dist
      - uses: actions/upload-pages-artifact@v3
        with:
          path: dist

  deploy:
    needs: build
    runs-on: ubuntu-latest
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    steps:
      - id: deployment
        uses: actions/deploy-pages@v4
```

- [ ] **Step 2: 로컬에서 같은 순서로 실행**

Run: `npm run typecheck && npm test && npm run build && npm run check:dist`
Expected: 모두 통과. `npm ci`는 공유 `node_modules`(symlink)를 지우므로 worktree에서는 실행하지 않는다. 대신 `git diff --exit-code package-lock.json`으로 lock 파일이 바뀌지 않았는지 확인한다.

- [ ] **Step 3: 구조 확인(Review Focus 5)**

Run: `grep -nE 'needs: build|npm run (typecheck|test|build|check:dist)|upload-pages-artifact|deploy-pages' .github/workflows/pages.yml`
Expected: 7줄. `needs: build` 1줄, npm run 4줄, actions 2줄. `node -e "require('node:fs').readFileSync('.github/workflows/pages.yml','utf8').includes('\t') && process.exit(1)"`로 탭 문자가 없는지도 확인한다.

- [ ] **Step 4: MODULE-MAP와 Commit**

`src/MODULE-MAP.md` `## scripts/` 아래에:
```markdown
- `.github/workflows/pages.yml` — on `main` push: typecheck → unit → build → `check:dist` → `deploy-pages`. No e2e in CI.
```
```bash
git add .github/workflows/pages.yml src/MODULE-MAP.md
git commit -m "ci: deploy to GitHub Pages on main push

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: 병합, 히스토리 정리, 공개 (메인 세션 전용, 단계마다 사용자 확인)

subagent에게 맡기지 않는다. 각 Step의 **확인** 표시가 있는 곳에서 멈추고 사용자 승인을 받는다. 상세 근거는 설계 §4, §5, §11.

- [ ] **Step 1: 브랜치 마무리와 실제 체크아웃 빌드 검사(Review Focus 1)**

1. 브랜치는 PR로 들어간다(`CLAUDE.md` Workflow). `feat/quote-docs-home-preset`: e2e 재확인, 탐색 QA 후 `gh pr create --base main` → 사용자가 병합한다.
2. `feat/pages-deploy`는 `feat/quote-docs-home-preset` 위에 쌓여 있다. PR base를 그 브랜치로 열거나, 그 브랜치가 `main`에 병합된 뒤 `main` 위로 rebase해서 `gh pr create --base main`. 전체 리뷰 후 사용자가 병합한다. Step 3의 히스토리 정리는 두 브랜치가 모두 `main`에 병합된 뒤, repo를 공개하기 전에 한다.
3. `private/`가 있는 메인 체크아웃(`/Users/jypark/Projects/homefit`)에서:
   ```bash
   npm run build && npm run check:dist
   bash .claude/skills/checking-privacy/scan.sh --dist
   ```
   Expected: `dist 검사 통과`, `OK: privacy scan clean (--dist)`.
   음성 대조: repo가 아닌 임시 복사본(예: `cp -R` 후 `node_modules`·`private` symlink)에서 `vite.config.ts`의 프리셋·문서 링크 플러그인을 build에서도 켜지게(`enabled = true`) 바꿔 build한 뒤 `npm run check:dist` 또는 `scan.sh --dist`가 0이 아닌 코드로 끝나는지 확인한다. 끝나면 임시 복사본을 지운다.

- [ ] **Step 2: 히스토리 정리 사전 점검** — 다른 세션의 미커밋 변경과 worktree를 확인한다.

```bash
git -C /Users/jypark/Projects/homefit status --short
git -C /Users/jypark/Projects/homefit worktree list
git -C /Users/jypark/Projects/homefit stash list
git -C /Users/jypark/Projects/homefit branch --list
```
Expected: `Planner 5D …md` 외에 미커밋 변경 없음, stash 없음. 남은 worktree(`homefit-pages-deploy` 등)는 `git worktree remove`하고, 병합이 끝난 브랜치는 지운다. 남는 브랜치는 `main`과(필요하면) `feat/quote-docs-home-preset`뿐이어야 한다.

- [ ] **Step 3: 백업과 정리 (확인)**

```bash
cd /Users/jypark/Projects/homefit
git bundle create ../homefit-before-rewrite.bundle --all
git rev-parse 'main^{tree}' > ../homefit-tree-before.txt
n0=$(git rev-list --count main)
FILE=docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md
BLOB=$(git rev-parse 7db3d06:$FILE)
FILTER_BRANCH_SQUELCH_WARNING=1 git filter-branch --prune-empty --index-filter "
  if git ls-files --error-unmatch $FILE >/dev/null 2>&1 && \
     git cat-file -p :$FILE | grep -q 'const EXT = 20'; then
    git update-index --cacheinfo 100644,$BLOB,$FILE
  fi" -- $(git for-each-ref --format='%(refname:short)' refs/heads)
git checkout main
rm -rf .git/refs/original
git remote remove origin
git reflog expire --expire=now --all && git gc --prune=now
```
검증:
```bash
[ "$(git rev-parse 'main^{tree}')" = "$(cat ../homefit-tree-before.txt)" ] && echo tree-same
echo "$n0 -> $(git rev-list --count main)"
git log --all --oneline -S'const EXT = 20' -- docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md | wc -l
git log --all --oneline -S"wall('e-top'" -- docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md | wc -l
bash .claude/skills/checking-privacy/scan.sh --log --all
git cat-file -e f3726c0 2>/dev/null && echo STILL-PRESENT || echo gone
```
Expected: `tree-same`, 커밋 수 1 감소, `0`, `0`, `OK: privacy scan clean (--log)`, `gone`. `-S` 검색은 plan 1 파일로 한정한다(설계·계획 5a 문서 자체에 같은 문자열이 있다). 미해결(2026-10-08): plan 1 문서에는 `7db3d06` 이후에도 `scan.sh` 검색어 하나(평면도 파일명, `HANDOFF.md` 다음 할 일 3)가 남아 있어 위 filter만으로는 `scan.sh --log --all`이 깨끗해지지 않는다. 실행 전에 그 줄을 지우는 방법(BLOB 교체 범위, tree 동일 검사 기준)을 사용자와 정한다. 하나라도 다르면 멈추고 `git clone ../homefit-before-rewrite.bundle`로 복구 방법을 사용자와 정한다.

- [ ] **Step 4: repo 재생성 (확인 — 되돌릴 수 없음)**

```bash
gh issue list -R jyp90/sn-house-interior --state all --limit 5
gh pr list -R jyp90/sn-house-interior --state all --limit 5
gh repo delete jyp90/sn-house-interior --yes
gh repo create jyp90/sn-house-interior --private --source . --remote origin
git push -u origin main
```
`gh repo delete`는 `delete_repo` scope가 필요하다. 없으면 `gh auth refresh -h github.com -s delete_repo`를 사용자에게 안내한다.
검증: 임시 clone으로 Step 3의 `-S` 검색과 `cat-file` 검사를 반복한다.
```bash
C=$(mktemp -d) && git clone -q git@github.com:jyp90/sn-house-interior.git $C && git -C $C log --all --oneline -S'const EXT = 20' -- docs/superpowers/plans/2026-10-08-homefit-01-foundation-placement.md | wc -l
```
Expected: `0`

- [ ] **Step 5: 공개 전환과 Pages 켜기 (확인)**

```bash
gh repo edit jyp90/sn-house-interior --visibility public --accept-visibility-change-consequences
gh api -X POST repos/jyp90/sn-house-interior/pages -f build_type=workflow
gh workflow run pages.yml -R jyp90/sn-house-interior --ref main
gh run watch -R jyp90/sn-house-interior $(gh run list -R jyp90/sn-house-interior -w pages.yml -L 1 --json databaseId -q '.[0].databaseId')
```
Expected: run 성공, `curl -sI https://jyp90.github.io/sn-house-interior/ | head -1` → `HTTP/2 200`.

- [ ] **Step 6: 탐색 QA(설계 §10)**

실제 주소에서 확인: 첫 로드, 3D 회전·배치, 2D 편집, 배경 이미지 업로드(IndexedDB), PDF·PNG 내보내기, JSON 저장·불러오기, 새로고침 후 자동 저장 복원. 데스크톱 Chrome과 휴대폰 Safari에서 각각 본다. 로그아웃 브라우저에서 plan 1 문서의 History를 열어 좌표 블록이 없는지 확인한다. localhost에 있던 데이터는 origin이 달라 옮겨지지 않으므로, 옮기려면 JSON 저장 → 열기를 쓴다는 점을 사용자에게 알린다.

- [ ] **Step 7: 문서 마무리**

- `HANDOFF.md` 「지금 상태」: 배포 주소, 마지막 커밋(정리 후 새 SHA), 테스트 수. 「다음 할 일」에서 배포 항목을 빼고 계획 5를 남긴다.
- `CLAUDE.md`: 「Work in progress」의 Pages 줄 삭제. Non-negotiable의 push 규칙을 "`main` push = 배포, 사용자 확인 후"로 바꾸고 history rewrite 문구는 삭제. Commands에 `npm run check:dist`, `npm run e2e:preview` 추가.
- `docs/README.md`: Feature map에 `Pages deploy | vite.config.ts base, scripts/check-dist.ts, .github/workflows/pages.yml, public/licenses/ | §17` 추가. spec·plan 표에서 상태를 done으로.
- Commit(`docs: record Pages deploy`) 후 **확인** → `git push origin main`(자동 재배포).
