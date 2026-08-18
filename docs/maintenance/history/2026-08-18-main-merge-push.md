# 2026-08-18 Main Merge And Push

## Boundary

- Verified the worktree was clean and the maintenance staleness checks passed before integration.
- Refreshed `origin`, then fast-forwarded local `main` from `bf44be7` to `52db323e35a68963b1f94570a7c241408b834db0`.
- Pushed `main` successfully to `origin/main`; no conflict, force-push, or unrelated branch rewrite occurred.
- The source branch `codex/butler-performance-2-design` was the source of the fast-forward. Product version remains `0.9.0`.

## Post-Merge Verification

- Vitest: 69 files, 868/868 tests passed.
- TypeScript and ESLint: passed.
- `git diff --check`: passed.
- The post-merge tree is the same verified code/build tree recorded in `2026-08-13-acceptance-round3-butler-performance.md`; the merge changed branch ancestry only.
- Fixed build stamp remains `0.9.0+202608132024`.

## Next Boundary

Install from `main` or `origin/main` in real SillyTavern and execute the 25-item acceptance list in `docs/maintenance/CURRENT.md`. The semantic version remains `0.9.0` until real-ST acceptance passes. Only failures observed in that acceptance should drive the next code batch.
