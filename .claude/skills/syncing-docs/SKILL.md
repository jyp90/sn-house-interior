---
name: syncing-docs
description: Use when finishing any development request in sn-house-interior, before reporting completion or committing, or when a module, feature, spec decision, or branch status changed.
---

# Syncing docs

"Docs are part of done" (`CLAUDE.md`). Pointers only: one line each, no prose, no code.

| Changed | Update |
|---|---|
| Any round | `HANDOFF.md` 「지금 상태」 (branch, last commit hash, `npm test` pass/skip counts, last e2e count) and 「다음 할 일」 |
| Work started/finished | `CLAUDE.md` 「Work in progress」 row added/removed; finished → `docs/README.md` 「Feature map」 (feature → code → spec §) |
| New spec/plan file | `docs/README.md` 「Specs and plans」 |
| New kind of task | `docs/README.md` 「Task → read this」 |
| New/changed module | `src/MODULE-MAP.md`, 1–2 lines under its folder heading (subagents do this one) |
| New product decision | Spec: append dated `## N. N차 반영: … (yyyy-MM-dd)`; never rewrite earlier sections |

## Getting the numbers
```bash
git log -1 --format='%h %s'
npm test 2>&1 | tail -5        # copy pass/skip exactly
```
Never write counts from memory. Didn't run e2e this round → keep the old e2e line with its commit hash.

## Check
- Grep the touched docs for the new feature name: each table above that applies has one line.
- Run checking-privacy before committing docs.
