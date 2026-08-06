---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 637e397a28cd8464be66d557acd0c8254ae3c3fb
remote_code_head_at_update: 637e397a28cd8464be66d557acd0c8254ae3c3fb
build_version: 0.9.0+202608060025
phase: real-sillytavern-acceptance
updated_at: 2026-08-06
updated_by: codex
verification_source: claude-code-maintenance-log
history: docs/maintenance/history/2026-08-06-sts-gallery-variable-renderer.md
---

# Current Project Status

## Snapshot

- Gallery, new-variable, and Renderer V1 updates are implemented.
- Two CC review rounds and their follow-up fixes are complete.
- `main`, `origin/main`, and the former update branch were confirmed at `637e397` with a clean worktree.
- The release build stamp is `0.9.0+202608060025`; `manifest.json` remains at product version `0.9.0`.
- The current phase is real SillyTavern acceptance, not additional feature implementation.

## Delivered Scope

- Gallery: mobile-safe preview, text editing actions, manual localization, labels/search, role folding, prompt and outfit notes, numbered action ranges, and story image archiving.
- Variables: strict JSON Patch validation, safe legacy parsing, validated manual edits, corrected built-in templates, and three practical templates.
- Renderer V1: validated protocol, prompt injection, reversible runtime, settings App, Galgame mode, card choices, deterministic battles, and post-battle continuation.
- Release engineering: deterministic build timestamps and CI verification of committed extension artifacts.

## Recorded Verification

The final merged tree was recorded as passing:

- Vitest: 580/580.
- TypeScript typecheck and project lint.
- E2E lint.
- Mobile E2E: 20/20 across Pixel 7 and Galaxy S8 profiles.
- Two fixed-time builds with identical artifact hashes.
- Invalid build-time rejection without modifying sentinel artifacts.
- CI-equivalent extraction of the timestamp from `version.json`, rebuild, and artifact diff.
- `git diff --check` and a clean worktree.

These are automated results from the final CC maintenance log. Real SillyTavern checks below remain open until a human records them as completed.

## Real SillyTavern Acceptance

1. Upgrade an installed extension and confirm the settings UI reports `0.9.0+202608060025`, proving the new bundle bypassed browser cache.
2. Import a `sprite-pack@3` containing `promptNote` without `promptNotePlacement`; confirm the UI shows "after list" and renaming the pack does not change injection placement.
3. Check a large multi-group pack across pagination and confirm named group sections remain before the ungrouped section.
4. Exercise mobile preview positioning, manual remote-image localization, and story-based external image archiving in the real ST DOM.
5. Verify new-variable prompt injection and model-produced updates with an actual model response.
6. Exercise Galgame, card-choice, and battle renderers during real message streaming, swipes, settings changes, and composer insertion.

## Next Actions

- Record the real ST results in a new dated history entry.
- Resolve only failures discovered by acceptance testing; keep unrelated deferred items scoped separately.
- Decide separately whether the product version should move from `0.9.0` to `0.10.0`.
