---
name: checking-privacy
description: Use when about to commit, write docs or commit messages, export PNG/PDF, build, push, or deploy in sn-house-interior, or when touching private/, the home preset, floor-plan images, addresses, complex names or listing URLs.
---

# Checking privacy

The repo and the Pages URL are public. Our address, complex name, listing URL, the original listing image and `make-our-home.mjs` live only in `private/` (spec §3, §15.1). The home preset is tracked on purpose as `home/plan.json` + `home/floorplan.jpg` (spec §24) — its `info.title` must stay 「우리 집」, never the complex name. A grep is the only reliable check; memory of "I didn't type it" is not.

## Scan

```bash
bash .claude/skills/checking-privacy/scan.sh            # staged files + forbidden paths + new images (before every commit)
bash .claude/skills/checking-privacy/scan.sh --tracked  # every tracked file
bash .claude/skills/checking-privacy/scan.sh --log main..HEAD   # commit messages + diffs (before push; --all for history rewrite)
bash .claude/skills/checking-privacy/scan.sh --dist     # after npm run build, before deploy
```

- Terms come from `private/privacy-terms.txt` (gitignored, one per line). Output shows `term#N` only. Never echo the term into chat, docs or commit messages.
- New private fact (new link, image name, address part)? Append it to that file first.
- Exit 1 = stop. Unstage/rewrite, then rescan. Exit 2 = terms file missing: ask the user, don't skip.

## What else counts as leaking

- `virtual:home-preset` reads `home/` for dev and build; it must stay `null` for tests and `HOMEFIT_SAMPLE=1`. `virtual:doc-links` (private URLs) must stay serve-only (`vite.config.ts`).
- Regenerating the preset: `node private/make-our-home.mjs` writes `home/plan.json`; rescan `home/` before committing (the script's source has the complex name, the output must not).
- Screenshots of our home are fine in scratchpad; put them in the repo or artifacts only when the user asks.
- Claude artifact URLs with `sk=` keys are private links.

## Known findings
- Going public: re-check the §17 history list (`--log --all`); preset coordinates no longer count (spec §24).
