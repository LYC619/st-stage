---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: af7e545c771dc425301b5ecde9d6e8e7cbd22590
remote_code_head_at_update: b97e894bbbc9b691e4c0bc8c473cf9fbb00586a2
build_version: 0.9.0+202608070237
phase: real-sillytavern-acceptance
updated_at: 2026-08-07
updated_by: codex
verification_source: codex-maintenance-log-2026-08-07
history: docs/maintenance/history/2026-08-07-pure-numeric-sprite-tag.md
---

# Current Project Status

## Snapshot

- Gallery, new-variable, and Renderer V1 updates are implemented.
- Renderer first-use onboarding and the generated ST distribution boundary are implemented in `7c7109e`; the density refinement is in `42f19f9`.
- Pure numeric sprite tags are protected from malformed range labels in `af7e545`.
- The working branch is `codex/renderer-onboarding-density`, seven local commits ahead of `origin/main` (`b97e894`), including maintenance handoffs; no push was performed.
- The release build stamp is `0.9.0+202608070237`; `manifest.json` remains at product version `0.9.0`.
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

The delivered code commit was recorded as passing:

- Vitest: 584/584.
- TypeScript typecheck and project lint.
- E2E lint.
- Mobile E2E: 20/20 across Pixel 7 and Galaxy S8 profiles.
- Two fixed-time builds with identical artifact hashes.
- Root and `st-distribution/` shared artifacts have identical SHA-256 hashes; the distribution contains six files totaling 469,343 bytes.
- Latest focused Renderer tests: 7/7; latest build integration tests: 15/15.
- Latest targeted mobile E2E: 2/2 across Pixel 7 and Galaxy S8, with disabled-state screenshots visually inspected.
- Latest sprite metadata/prompt tests: 56/56.
- Invalid build-time rejection without modifying sentinel artifacts.
- CI-equivalent extraction of the timestamp from `version.json`, rebuild, and artifact diff.
- `git diff --check` and a clean worktree.

These are automated results recorded for this maintenance batch. Real SillyTavern checks below remain open until a human records them as completed.

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

- Record the real ST results in a follow-up dated history entry.
- Resolve only failures discovered by acceptance testing; keep unrelated deferred items scoped separately.
- Decide separately whether the product version should move from `0.9.0` to `0.10.0`.
- Push the feature branch only after the manual acceptance boundary is reviewed.
- Review and integrate `codex/renderer-onboarding-density` after the real ST result is recorded.
