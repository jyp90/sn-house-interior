---
name: checking-privacy
description: Use when about to commit, write docs or commit messages, export PNG/PDF, build, push, or deploy in sn-house-interior, or when touching private/, the home preset, floor-plan images, addresses, complex names or listing URLs.
---

# Checking privacy

Repo and Pages build go public. Our address, complex name, listing URL, floor-plan images and home preset live only in `private/` (spec §3, §15.1). A grep is the only reliable check; memory of "I didn't type it" is not.

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

- `virtual:home-preset` must stay `null` for `build`, tests and `HOMEFIT_SAMPLE=1` (`vite.config.ts`). Don't widen the `enabled` condition.
- PNG/PDF export of a plan whose background is the real floor plan. Exports for QA/e2e use the sample plan.
- Screenshots from `npm run dev` without `HOMEFIT_SAMPLE=1` show our home: keep them in scratchpad, never in repo or artifacts.
- Claude artifact URLs with `sk=` keys are private links.

## Known findings
- History before push needs a rewrite (`f3726c0` preset coordinates; `--log --all` lists the rest).
