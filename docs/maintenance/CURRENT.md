---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: af7e545c771dc425301b5ecde9d6e8e7cbd22590
remote_code_head_at_update: b97e894bbbc9b691e4c0bc8c473cf9fbb00586a2
build_version: 0.9.0+202608070237
phase: real-sillytavern-acceptance
updated_at: 2026-08-09
updated_by: claude-code
verification_source: claude-code-maintenance-run-2026-08-09
history: docs/maintenance/history/2026-08-09-merge-push.md
---

# Current Project Status

## Snapshot

- Gallery, new-variable, and Renderer V1 updates are implemented.
- Renderer first-use onboarding and the generated ST distribution boundary are implemented in `7c7109e`; the density refinement is in `42f19f9`.
- Pure numeric sprite tags are protected from malformed range labels in `af7e545`.
- `codex/renderer-onboarding-density` was verified and fast-forward merged into `main`, then pushed to `origin/main` in this handoff; the remote head before the push was `b97e894`.
- The release build stamp is `0.9.0+202608070237`; it differs from the previously published `202608060025`, so updated installs get a cache-busting bundle URL. `manifest.json` remains at product version `0.9.0`.
- The current phase is real SillyTavern acceptance, not additional feature implementation.

## Delivered Scope

- Gallery: mobile-safe preview, text editing actions, manual localization, labels/search, role folding, prompt and outfit notes, numbered action ranges, and story image archiving.
- Variables: strict JSON Patch validation, safe legacy parsing, validated manual edits, corrected built-in templates, and three practical templates.
- Renderer V1: validated protocol, prompt injection, reversible runtime, settings App, Galgame mode, card choices, deterministic battles, and post-battle continuation.
- Renderer onboarding: quick-start steps, configuration status, mode guide, troubleshooting, and a preference-preserving activation action.
- Renderer onboarding density: full first-use steps only while disabled, accurate activation copy, and compact enabled state.
- Sprite metadata: pure numeric tags remain individually addressable and are not rendered as malformed ranges.
- Release engineering: deterministic build timestamps and CI verification of committed extension artifacts.
- Distribution boundary: `pnpm build:st` generates `st-distribution/` without simulator or reference assets; root artifacts remain the compatibility path.

## Recorded Verification

Fresh automated results for `af7e545` from the 2026-08-09 pre-merge run:

- Frozen install, ESLint, and TypeScript typecheck: passed.
- Vitest: 586/586.
- Next.js production build: passed.
- Extension artifacts rebuilt at the committed stamp: root and `st-distribution/` both diff-clean against the committed files.
- `CURRENT.md` staleness gates: passed with a clean worktree.

Carried over from the 2026-08-07 records at the same code state (not rerun in this batch):

- Mobile E2E: 20/20 across Pixel 7 and Galaxy S8 profiles, with disabled-state screenshots visually inspected.
- Focused Renderer tests: 7/7; build integration tests: 15/15; sprite metadata/prompt tests: 56/56.
- Two fixed-time builds with identical artifact hashes; root and `st-distribution/` shared artifacts have identical SHA-256 hashes.
- Invalid build-time rejection without modifying sentinel artifacts.

These are automated results. Real SillyTavern checks below remain open until a human records them as completed.

## Real SillyTavern Acceptance

1. Upgrade an installed extension and confirm the settings UI reports `0.9.0+202608070237`, proving the new bundle bypassed browser cache.
2. Import a `sprite-pack@3` containing `promptNote` without `promptNotePlacement`; confirm the UI shows "after list" and renaming the pack does not change injection placement.
3. Check a large multi-group pack across pagination and confirm named group sections remain before the ungrouped section.
4. Exercise mobile preview positioning, manual remote-image localization, and story-based external image archiving in the real ST DOM.
5. Verify new-variable prompt injection and model-produced updates with an actual model response.
6. Exercise Galgame, card-choice, and battle renderers during real message streaming, swipes, settings changes, and composer insertion.

7. Open the Renderer App as a new user and confirm the quick-start panel, recommendation action, status states, and mode guide are readable in the real ST viewport.
8. Reopen the Renderer after enabling it and confirm the page keeps the status/mode guide but no longer repeats the three first-use steps.

## Next Actions

- Execute the real ST acceptance list against `origin/main` and record the results in a follow-up dated history entry.
- Resolve only failures discovered by acceptance testing; keep unrelated deferred items scoped separately.
- Decide separately whether the product version should move from `0.9.0` to `0.10.0`.
