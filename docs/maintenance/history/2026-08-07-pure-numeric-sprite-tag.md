# Pure Numeric Sprite Tag Maintenance Record

## Final State

- Code commit: `af7e545c771dc425301b5ecde9d6e8e7cbd22590`.
- Working branch: `codex/renderer-onboarding-density`.
- Remote baseline: `origin/main` remains `b97e894`; no push was performed.
- Build version: `0.9.0+202608070237`.

## Change

- Fixed `compactNumberedTags` so tags made only of digits remain complete tag entries.
- Added a regression test for `12`, `13`, and `14`; they no longer display as the invalid range label `12-4`.
- Preserved compaction for tags with text or symbol prefixes, including large integer suffixes and padded suffixes.
- Removed the resolved Pure-Numeric Numbered Ranges entry from `DEFERRED.md`.

## Verification

- Sprite metadata and prompt builder tests: 56/56.
- TypeScript typecheck and ESLint: passed.
- Fixed-time root and `st-distribution/` builds: shared SHA-256 hashes matched.
- `git diff --check`: passed.

Real SillyTavern acceptance remains open and is tracked in `CURRENT.md`.

