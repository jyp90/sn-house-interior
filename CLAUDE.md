# sn-house-interior (구 homefit)

Personal (family-only) interior planner: rebuild our home in 3D from a floor plan, place real-size furniture and appliances (Samsung-first) by drag, check collisions / wall gaps / door swings, and export a contractor PDF. Single-package Vite + TypeScript + React 19 + react-three-fiber + zustand + zod SPA. No backend: localStorage + IndexedDB + JSON files.

Read first: `HANDOFF.md` 「지금 상태」 and 「다음 할 일」 only. Binding design: `docs/superpowers/specs/2026-10-08-homefit-design.md` (§14 overrides §1–13, §15 is the latest round). Plans in `docs/superpowers/plans/` are history — the code wins. Doc index with a task → doc table: `docs/README.md`. Per-module notes: `src/MODULE-MAP.md` (grep, never read whole).

## Commands
```bash
npm install
npm run typecheck && npm test        # run both before every commit
npm run e2e                          # Playwright, own dev server on 5180 with HOMEFIT_SAMPLE=1
npm run dev                          # local dev; loads private/ home preset if present
npm run build                        # tsc --noEmit && vite build (never includes the home preset)
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
- Privacy: the repo and Pages build will be public. Address, complex name, listing URL, floor-plan images and our home preset live only in `private/` (gitignored). Never put them in tracked files, the bundle, exported PNG/PDF backgrounds, commit messages or docs. `virtual:home-preset` (`vite.config.ts`) is `null` for build, tests and `HOMEFIT_SAMPLE=1`.
- Never `git add -A` / `git add .`; add explicit paths. Never stage `private/`, `handoff/`, `archive/`, `.superpowers/`, `dist/`, `test-results/`, `playwright-report/`, or the root `Planner 5D …md` (user's file — do not touch).
- No push, GitHub repo creation, PR or Pages deploy until the user says so (first push needs a history rewrite: `f3726c0` carries preset coordinates).
- No new dependency without the user's OK.
- Checklist and PDF copy is written fresh; never copy wording from reference PDFs or the user's private consultation notes. Budget amounts and contractor-judging criteria never go into the PDF or app data (spec §15.3).
- Never edit expected values, skip tests or replace a real user action in e2e with a direct store call to get green.
- UI copy is Korean; icon buttons need `aria-label`.

## Workflow
- Main session: brainstorming, spec and plan with the user. After approval, implementation is delegated to subagents (`superpowers:subagent-driven-development`); every subagent reads the spec section and plan task first and reviews treat spec drift as a defect.
- Several sessions share this checkout. Never commit another session's uncommitted changes; for parallel work use a worktree (`git worktree add ../homefit-<topic> -b <branch>`) and `merge --ff-only`.
- Commits: Conventional Commits, one feature branch per plan/round, merged to `main` with `--ff-only` after the user agrees.
- Before calling a feature done: typecheck + unit + e2e green, then exploratory QA in a real browser (spec §11: reviews alone missed runtime bugs before).
- Handoffs: `handoff/{yyyyMMdd}-{issue}/HANDOFF.md` + `MESSAGE.md` while open, moved to `archive/` when done (both gitignored). Format: `~/Projects/claude-command-center/.claude/skills/handoff/SKILL.md`.

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
- Round 3 (spec §15: local-only home preset, on-site checklist, PDF quote pages): branch `feat/quote-docs-home-preset`, not merged to `main`.
- Plan 5 (spec §14.5-5: Samsung catalog, remaining builders, Pages deploy with Pretendard OFL notice, exploratory QA): not started, waits for the user's model list.
