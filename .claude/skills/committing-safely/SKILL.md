---
name: committing-safely
description: Use when about to git add, commit, push, open a PR, or merge to main in sn-house-interior, or when finishing any development request, especially when other sessions share the checkout or the working tree has changes you did not make.
---

# Committing safely

Several sessions share this checkout. A commit is "safe" only when it contains exactly your change, passes checks and leaks nothing.

## Steps (in order)

0. **Right place.** `git rev-parse --show-toplevel` must be your `~/Projects/homefit-<topic>` worktree on a `<type>/<topic>` branch from `origin/main`, not `~/Projects/homefit`. Not yet? Create it (CLAUDE.md 「Workflow」) and move your changes there before committing.
1. **Own files only.** `git status --short`, then `git diff <file>` for anything you are unsure about. Files you didn't touch this session are another session's: leave them. Mixed hunk in a shared file → ask the user.
2. **Checks.** `npm run typecheck && npm test && npm run e2e` (first `lsof -i :5180`: a server from another worktree would be reused and test the wrong code). Failing → fix the code, never expected values or `skip`.
3. **Stage explicit paths.** `git add src/a.ts src/a.test.ts …`. Never `-A`, `.`, `-u`, `commit -a`.
4. **Privacy.** **REQUIRED SUB-SKILL:** checking-privacy (`scan.sh` on staged files).
5. **Docs.** Development work → **REQUIRED SUB-SKILL:** syncing-docs, staged in the same round.
6. **Message.** Conventional Commits (`feat:`, `fix:`, `docs:`, `test:`, `chore:`, `refactor:`), English subject, no private terms, end with the attribution line from the system reminder.
7. **Push + PR + merge (default, no need to ask).** Only after typecheck + unit + e2e green and exploratory-qa done.
   ```bash
   git push -u origin <branch>
   gh pr view --json url 2>/dev/null || gh pr create --base main --title "<type>: <요약>" --body-file <scratchpad>/pr.md
   ```
   Body (Korean): 변경 요약, 스펙 §, `npm test` pass/skip, e2e pass count, QA table summary, then the PR attribution line from the system reminder. Run checking-privacy on the body too.
8. **Up to date.** `git fetch origin && git rebase origin/main`; if anything came in, rerun step 2 and `git push --force-with-lease`.
9. **Merge + clean up.**
   ```bash
   gh pr merge <n> --merge --delete-branch
   git -C ~/Projects/homefit worktree remove ../homefit-<topic>
   git -C ~/Projects/homefit branch -D <branch>
   git -C ~/Projects/homefit fetch origin
   ```
   Report the PR URL and merge commit. Never push directly to `main`, force-push `main` or others' branches, make the repo public or deploy Pages without the user's OK.

## Red flags
- "These other changes look related, I'll include them" → not yours.
- "Tests were green earlier" → rerun after the last edit.
- "Just a docs commit, skip scan" → docs are where addresses leak.
- "Small change, I'll just commit in ~/Projects/homefit" → that tree has other sessions' work; use a worktree.
- "e2e is slow, open the PR and let it run later" → no CI here; red PRs stay red.
