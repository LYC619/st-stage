# Gallery, Variable, and Renderer Maintenance Record

## Final State

- Integration commit: `637e397a28cd8464be66d557acd0c8254ae3c3fb`.
- Branch state at handoff: `main == origin/main`.
- Build version: `0.9.0+202608060025`.
- Outcome: implementation, two review rounds, follow-up fixes, merge, and push completed.
- Remaining phase: real SillyTavern acceptance.

## Original Update Scope

### Gallery

- Keep image preview inside the mobile visual viewport.
- Provide text-labeled editing actions in the large-image view.
- Make remote-image localization a manual action.
- Add labels, search, role/outfit folding, pack notes, outfit notes, and configurable note placement.
- Compact numbered action tags such as `挥手1` through `挥手7` while requiring the model to emit a real complete image name.
- Save eligible externally generated chat images into story-specific editable packs.

### New Variables

- Validate the new-variable update format and prompt injection behavior.
- Repair JSON Patch validation, legacy update parsing, and manual edits.
- Correct existing templates and add survival exploration, mystery investigation, and quest progression templates.

### Renderer V1

- Add native structured rendering rather than copying the reference renderer's global state and direct HTML model.
- Support Galgame dialogue, SLG-style card choices, and deterministic local battles.
- Integrate prompt injection, settings, reversible message processing, composer insertion, and lifecycle cleanup through existing STS boundaries.

## Delivery Timeline

1. Review-fix batches established variable-path safety, atomic API-key restoration, upload finalization, lifecycle disposal, bounded gallery rendering, and deterministic CI artifact verification.
2. The Gallery, Variable, and Renderer plans were implemented through `a58c14f`, followed by a unified internal review.
3. The first independent CC review confirmed a cross-page gallery section-order regression and found that prompt-note metadata lacked an editing UI.
4. Commit `58b65fa` restored ordered section insertion, added pack/outfit note editing, updated plans/specs, and added unit and mobile E2E coverage.
5. The second CC review confirmed both fixes and found that the UI defaulted missing note placement to `before-list` while prompt generation used `after-list`.
6. Commit `637e397` introduced a shared `DEFAULT_PROMPT_NOTE_PLACEMENT`, normalized new outfit-note keys, added note input limits, added a localization timeout, removed dead Renderer channel code, and refreshed the release build stamp.
7. CC fast-forwarded and pushed `main`, then reran verification on the delivered tree.

## Final Verification Record

- Vitest: 580/580.
- Typecheck, project lint, and E2E lint: passed.
- Mobile E2E: 20/20 on Pixel 7 and Galaxy S8 profiles using the rebuilt bundle.
- Fixed-time reproducibility: two builds produced identical artifact hashes.
- Invalid build time: rejected before modifying the four release artifacts.
- CI-equivalent rebuild and committed-artifact diff: passed.
- Whitespace check: passed.
- Worktree after merge and push: clean.

## Review Outcomes

Resolved findings include:

- gallery section order across incremental pages;
- missing pack-note and outfit-note editing UI;
- note-placement default mismatch;
- invalid new outfit-note keys;
- silent note-length truncation at save time;
- indefinite remote-image localization waits;
- stale build stamp that could preserve an old cached bundle;
- an unused Renderer prompt-channel constant.

Items intentionally postponed are maintained in `docs/maintenance/DEFERRED.md`.

## Manual Acceptance Boundary

Automated verification does not replace real SillyTavern checks for browser chrome and visual viewport behavior, external image-generator DOM variants, model prompt compliance, streaming/swipe rerenders, composer integration, and extension cache invalidation. The current checklist is maintained in `docs/maintenance/CURRENT.md`.

## Planning References

- `docs/superpowers/specs/2026-08-03-sts-gallery-variable-renderer-design.md`
- `docs/superpowers/plans/2026-08-03-sts-gallery-update.md`
- `docs/superpowers/plans/2026-08-03-sts-variable-update.md`
- `docs/superpowers/plans/2026-08-03-sts-renderer-v1.md`
- `docs/superpowers/plans/2026-07-31-review-fixes.md`
