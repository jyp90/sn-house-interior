# sn-house-interior (구 homefit)

Personal (family-only) interior planner: rebuild our home in 3D from a floor plan, place real-size furniture and appliances (Samsung-first) by drag, check collisions / wall gaps / door swings, and export a contractor PDF. Single-package Vite + TypeScript + React 19 + react-three-fiber + zustand + zod SPA. No backend: localStorage + IndexedDB + JSON files.

Read first: `HANDOFF.md` 「지금 상태」 and 「다음 할 일」 only. Binding design: `docs/superpowers/specs/2026-10-08-homefit-design.md` (§14 overrides §1–13; §15–§19 are later rounds, latest last). Plans in `docs/superpowers/plans/` are history — the code wins. Doc index with a task → doc table: `docs/README.md`. Per-module notes: `src/MODULE-MAP.md` (grep, never read whole).

## Commands
```bash
npm install
npm run typecheck && npm test        # run both before every commit
npm run e2e                          # Playwright, own dev server on 5180 with HOMEFIT_SAMPLE=1
npm run dev                          # local dev; loads home/ preset (same as build); HOMEFIT_SAMPLE=1 for the sample plan
npm run build                        # tsc --noEmit && vite build (never includes the home preset)
npm run check:dist                   # after build: Pages bundle guard (no images, no preset markers, base path)
npm run e2e:preview                  # base-path build on 5181: PDF fonts + license link
```
Single test file: `npx vitest run src/geometry/obb.test.ts`. Single e2e: `npx playwright test e2e/pdf.spec.ts`.

## Architecture boundaries
- One `Plan` object (zod schema `src/model/schema.ts`, types derived from it), integer **cm**. 3D is 1 unit = 1 m; cm↔m only via `src/model/units.ts` (`cmToM`/`mToCm`) and `src/scene3d/units.ts`.
- Plan schema is versioned (`persistence/parse.ts` `CURRENT_VERSION`, `migrate`). A schema change bumps the version and adds a migration step with a test; v1→v2 moved `items` into `layouts`.
- Items belong to the active layout: read/write only through `activeItems` / `withActiveItems` (`model/layout.ts`), never `plan.items`. Structure (walls, openings, rooms, fixtures) is shared by all layouts.
- `geometry/`, `validation/`, `checklist/`, `persistence/`, `export/pages.ts`, `quote/` stay React-free pure functions with colocated `*.test.ts`.
- Store edits go through `model/store.ts` actions so each user action is one undo step. Screen-only state (mode, tool, drafts, save status) lives in `ui/uiStore.ts`, not in the plan.
- 2D editor and 3D view stay always mounted (`.layer` / `.layer-hidden`, `<Viewport active>`); do not switch to conditional mounting.
- PDF: `export/pages.ts` (pure page data, wrapping, pagination) → `export/pdf.ts` (jsPDF + svg2pdf.js, lazy-loaded). Always the active layout. svg2pdf needs `font-family="Pretendard"` and has no `paint-order` (labels use two `<text>` layers).

## Non-negotiable rules
- Privacy: the repo and the Pages URL are public. The home preset (`home/plan.json`) and its floor-plan background (`home/floorplan.jpg`, no complex name) are tracked and shipped on purpose (spec §24). Address, complex name, listing URL, the original listing floor-plan image and `make-our-home.mjs` live only in `private/` (gitignored). Never put them in tracked files, the bundle, exported PNG/PDF backgrounds, commit messages or docs. The home preset itself is tracked on purpose as `home/plan.json` + `home/floorplan.jpg` (spec §20, title 「우리 집」, no complex name); `virtual:home-preset` (`vite.config.ts`) reads it for dev and build and is `null` for tests and `HOMEFIT_SAMPLE=1`. `virtual:doc-links` stays dev-only.
- Never `git add -A` / `git add .`; add explicit paths. Never stage `private/`, `handoff/`, `archive/`, `.superpowers/`, `dist/`, `test-results/`, `playwright-report/`, or the root `Planner 5D …md` (user's file — do not touch).
- Remote `origin` = `jyp90/sn-house-interior` (**public**, GitHub Pages at https://jyp90.github.io/sn-house-interior/ deploys on every `main` push via `.github/workflows/pages.yml`). Feature branch → PR → merge into `main` is the default (see Workflow). Pushing directly to `main` and force-pushing `main` or someone else's branch still need the user's OK. Never push a branch based on pre-rewrite history (old repo `sn-house-interior-old`, private): it would resurrect removed commits.
- No new dependency without the user's OK.
- Checklist and PDF copy is written fresh; never copy wording from reference PDFs or the user's private consultation notes. Budget amounts and contractor-judging criteria never go into the PDF or app data (spec §15.3).
- Never edit expected values, skip tests or replace a real user action in e2e with a direct store call to get green.
- UI copy is Korean; icon buttons need `aria-label`.

## Workflow
- Main session: brainstorming, spec and plan with the user. After approval, implementation is delegated to subagents (`superpowers:subagent-driven-development`); every subagent reads the spec section and plan task first and reviews treat spec drift as a defect.
- **Every development request starts in its own worktree** (no need to ask; skip only for questions/research with no file change). Several sessions share `~/Projects/homefit`; never edit or commit there.
  ```bash
  git -C ~/Projects/homefit fetch origin
  git -C ~/Projects/homefit worktree add ../homefit-<topic> -b <type>/<topic> origin/main   # type: feat|fix|docs|chore|refactor
  cd ~/Projects/homefit-<topic> && npm install
  ```
  `private/` is not in worktrees: dev/QA/e2e use the sample plan; `scan.sh` reads terms from the main checkout. Before `npm run e2e`, check `lsof -i :5180` is free — Playwright reuses an existing server, which may belong to another worktree.
- Commits: Conventional Commits, one branch + one PR per request.
- **Default finish for every development request** (no need to ask): local checks → PR → merge.
  1. `npm run typecheck && npm test && npm run e2e` all green, then exploratory QA in a real browser (spec §11: reviews alone missed runtime bugs before). Any failure → fix and rerun; never open a PR on red.
  2. Docs synced, privacy scan clean, commit on the branch (`committing-safely`).
  3. `git push -u origin <branch>` and `gh pr create --base main` (Korean title/body: 변경 요약, 테스트 결과 수치, QA 결과, 스펙 §).
  4. `main` moved meanwhile → `git rebase origin/main`, rerun step 1, `git push --force-with-lease` (own branch only). Conflict you can't resolve without guessing intent → ask.
  5. `gh pr merge <n> --merge --delete-branch`, then clean up: `git -C ~/Projects/homefit worktree remove ../homefit-<topic>`, `git -C ~/Projects/homefit branch -D <branch>`, `git -C ~/Projects/homefit fetch origin`.
  6. Report the PR URL and merge commit.
- Handoffs: `handoff/{yyyyMMdd}-{issue}/HANDOFF.md` + `MESSAGE.md` while open, moved to `archive/` when done (both gitignored). Format: `~/Projects/claude-command-center/.claude/skills/handoff/SKILL.md`.

## Project skills (`.claude/skills/`)
Invoke with the Skill tool (or `/name`) at the trigger below; they carry the exact steps so this file stays short. They complement, not replace, the `superpowers:*` workflow above.

| Trigger | Skill |
|---|---|
| Before any `git add`/commit/push/PR, finishing any development request, or when the tree has changes you didn't make | `committing-safely` (worktree check, then calls the next two) |
| Commit, docs, commit message, PNG/PDF export, build, push, deploy, anything near `private/` | `checking-privacy` — `bash .claude/skills/checking-privacy/scan.sh [--staged\|--tracked\|--log <range>\|--dist]`; terms in `private/privacy-terms.txt` |
| Finishing any development request | `syncing-docs` (the 「Docs are part of done」 table with exact sections) |
| Any change to `src/model/schema.ts` | `migrating-plan-schema` |
| New/updated product, sample dims → official specs, missing builder | `adding-catalog-product` |
| Tests green, about to call a feature done | `exploratory-qa` (sample plan on port 5181) |

New recurring workflow → add a skill (`superpowers:writing-skills`) and a row here.

## Docs are part of done
Every development request, before reporting completion, updates in the same round (pointers only, one line each, no prose or code):
1. `HANDOFF.md` 「지금 상태」 (branch, last commit, test counts) and 「다음 할 일」.
2. This file's 「Work in progress」: add/remove the row for the work; finished rows move to `docs/README.md` 「Feature map」.
3. `docs/README.md`: spec/plan index, 「Feature map」 (feature → code → spec §), 「Task → read this」 when a new kind of task appears.
4. `src/MODULE-MAP.md`: one or two lines per new or changed module.
5. Spec: a new product decision is appended as a dated `§N` round (like §14, §15), never by silently rewriting earlier sections.
Subagents implementing a plan task update `src/MODULE-MAP.md`; the main session updates the rest after the merge.

## Where to look (pointers)
- Feature → code → spec map and task → doc table: `docs/README.md`.
- Module notes: `src/MODULE-MAP.md`.
- Product research source (user-provided, F01–F12 IDs): `docs/references/2026-10-08-planner5d-research-design.md`.
- Past rounds (decisions, deferred minors): `archive/*/HANDOFF.md` (local only).

## Work in progress (2026-10-08)
- Plan 5 remainder (spec §14.5-5, §20.6): official Samsung dims + `sourceUrl` for the `-sample` products once the user's model list arrives; builders and generic products shipped in spec §20 (plan `docs/superpowers/plans/2026-10-09-catalog-elevation.md`).
