---
name: exploratory-qa
description: Use when a feature in sn-house-interior is about to be called done, after typecheck/unit/e2e are green, or when the user asks to check something in a real browser; also when reviews pass but runtime behavior (3D, drag, PDF) is unverified.
---

# Exploratory QA

Spec §11: reviews alone have missed runtime bugs. Tests green ≠ done until it's been used in a browser.

## Setup
```bash
HOMEFIT_SAMPLE=1 npm run dev -- --port 5181 --strictPort   # run_in_background; sample plan, no home preset
```
Port 5180 belongs to Playwright; if 5181 is taken by another worktree, pick the next free port (`lsof -i :<port>`). Use the sample plan for anything that may be screenshotted or exported (checking-privacy). Drive it with the available browser tool (Claude in Chrome / built-in browser skill, or a scratch Playwright script under the scratchpad).

## Pass (adapt to the change, report each)
1. Console: no errors/warnings on load and during the flow.
2. The changed feature via real UI actions (clicks, drags, keyboard), including undo/redo (`Cmd/Ctrl+Z` = one step per user action).
3. 2D ↔ 3D switch: state matches in both; no size flicker or blank canvas.
4. Reload: plan restored from localStorage; layout A/B intact.
5. Edge inputs: 0, very large, negative, Korean text, empty layout.
6. Export touched? Download PNG/PDF, open it, check Pretendard text, labels, page count.
7. Narrow window (≤1280px) for panels and legends.

## Report
Table: step → expected → observed → OK/BUG. Bugs: **REQUIRED SUB-SKILL:** superpowers:systematic-debugging before fixing; add a test that reproduces it. Kill the dev server when done.
