# Renderer UX, ST Distribution, and Resource Review

## Final State

- Code commit: `7c7109e5a62774e8e1c6298a9ccf8c2173347128`.
- Branch state at handoff: `main` is two commits ahead of `origin/main` (one code commit and one maintenance handoff commit); no push was performed.
- Build version: `0.9.0+202608070900`.
- Outcome: Renderer onboarding and generated ST distribution boundary are delivered; real SillyTavern acceptance remains open.

## Delivered Scope

### Renderer onboarding

- Added a first-use quick-start panel with three concrete steps.
- Added truthful disabled, enabled, and enabled-with-no-mode status states.
- Added concise guides for Galgame, card choices, and battle modes.
- Added a recommendation action that only enables the Renderer total switch and preserves all mode and behavior preferences.
- Added troubleshooting text that explains the required `STStageRender` block and fallback to ordinary prose.

### ST distribution boundary

- Kept `st-extension/` as the source integration directory.
- Kept root `index.js`, `bundle.js`, `style.css`, and `version.json` as the existing compatibility output.
- Added `pnpm build:st` to generate `st-distribution/` with only the manifest, loader, bundle, stylesheet, version stamp, and generated README.
- Explicitly excluded `public/`, `reference/`, and simulator-only resources from the generated distribution.

### Resource review

- Inspected the 143 PNG files under `reference/新内置图片` (181,125,118 bytes).
- Sampled files contain baked checkerboard pixels and opaque alpha, with inconsistent filename conventions.
- The image set was not copied into the extension or distribution. Remote hosting, cleanup, catalog IDs, and local/server download remain a separate deferred task.

## Verification Record

- Renderer focused tests: 6/6 passed.
- Build focused tests: 15/15 passed.
- Full Vitest: 584/584 passed after assigning the known large-gallery test an explicit 15-second timeout.
- TypeScript typecheck and ESLint: passed.
- Mobile E2E: 20/20 across Pixel 7 and Galaxy S8 profiles.
- Fixed-time root/distribution builds produced matching hashes for shared artifacts.
- `git diff --check`: passed.

These are automated checks. They do not replace the manual SillyTavern acceptance items recorded in `CURRENT.md`.

## Manual Acceptance Boundary

- Open Renderer in a real ST installation and confirm the new guide is readable on the target viewport.
- Click the recommendation action and verify the persisted settings preserve the selected modes.
- Confirm the installed extension build stamp updates and bypasses stale browser cache.
- Verify prompt injection and actual model-generated `STStageRender` blocks.
- Exercise Galgame, card choices, and battle through streaming, swipes, settings changes, and composer insertion.

## Follow-up

- Decide whether to push this batch and whether the product semantic version should move from `0.9.0` to `0.10.0`.
- Clean and quality-review the reference PNGs, normalize stable catalog records, select an HTTPS host/CDN, and connect the existing manual localization path before considering remote sprites delivered.
