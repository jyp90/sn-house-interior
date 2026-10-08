---
name: committing-safely
description: Use when about to git add, commit, push, open a PR, or merge to main in sn-house-interior, or when finishing any development request, especially when other sessions share the checkout or the working tree has changes you did not make.
---

# Committing safely

Several sessions share this checkout. A commit is "safe" only when it contains exactly your change, passes checks and leaks nothing.

## Steps (in order)

1. **Own files only.** `git status --short`, then `git diff <file>` for anything you are unsure about. Files you didn't touch this session are another session's: leave them. Mixed hunk in a shared file → ask the user.
2. **Checks.** `npm run typecheck && npm test`. UI/flow change → also `npm run e2e` (or the single spec: `npx playwright test e2e/<x>.spec.ts`). Failing → fix the code, never expected values or `skip`.
3. **Stage explicit paths.** `git add src/a.ts src/a.test.ts …`. Never `-A`, `.`, `-u`, `commit -a`.
4. **Privacy.** **REQUIRED SUB-SKILL:** checking-privacy (`scan.sh` on staged files).
5. **Docs.** Development work → **REQUIRED SUB-SKILL:** syncing-docs, staged in the same round.
6. **Message.** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`), English subject, no private terms, end with the attribution line from the system reminder.
7. **Push + PR (default, no need to ask).** Only after typecheck + unit + e2e green and exploratory-qa done.
   ```bash
   git push -u origin <branch>
   gh pr view --json url 2>/dev/null || gh pr create --base main --title "<type>: <요약>" --body-file <scratchpad>/pr.md
   ```
   Body (Korean): 변경 요약, 스펙 §, `npm test` pass/skip, e2e pass count, QA table summary, then the PR attribution line from the system reminder. Run checking-privacy on the body too. Report the PR URL.
8. **Merge** the PR into `main` only when the user says so. Never push to `main`, force-push, make the repo public or deploy Pages without the user's OK.

## Parallel work
Need a clean tree while others edit? `git worktree add ../homefit-<topic> -b <branch>`, work there, `--ff-only` back.

## Red flags
- "These other changes look related, I'll include them" → not yours.
- "Tests were green earlier" → rerun after the last edit.
- "Just a docs commit, skip scan" → docs are where addresses leak.
- "e2e is slow, open the PR and let it run later" → no CI here; red PRs stay red.
