# Renderer Onboarding Density Maintenance Record

## Final State

- Code commit: `42f19f952cfe5323f56b66dbb8fb62fd54638b81`.
- Working branch: `codex/renderer-onboarding-density`.
- Remote baseline: `origin/main` remains `b97e894`; no push was performed.
- Build version: `0.9.0+202608070223`.
- Outcome: the Renderer guide is complete for first use and compact for returning users; real SillyTavern acceptance remains open.

## Change

- Disabled Renderer settings show the status, three quick-start steps, and the `启用渲染` action.
- Enabled Renderer settings retain the status and collapsed mode guide but omit the first-use steps and activation action.
- The activation callback still changes only `enabled: true`, preserving mode and behavior preferences.
- README instructions now use the accurate action name and explain manual fallback setup.
- Real-extension mobile E2E starts with Renderer disabled, activates it, checks the compact state, verifies no horizontal overflow, and confirms all three render blocks return after reprocessing.

## Verification

- Renderer App focused tests: 7/7.
- Build integration tests: 15/15.
- TypeScript typecheck: passed.
- ESLint for project source and E2E: passed.
- Targeted mobile E2E: 2/2 across Pixel 7 and Galaxy S8.
- The disabled-state screenshots from both mobile profiles were visually inspected; copy, button, fold section, and phone bounds were readable without overlap.
- Repeated fixed-time builds produced identical hashes; root and `st-distribution/` shared artifacts also matched by SHA-256.
- `git diff --check`: passed.

These checks are automated or local visual checks. They do not replace manual testing in an installed SillyTavern instance.

## Manual Acceptance Boundary

- Confirm the compact enabled state in the real ST phone viewport.
- Verify the build stamp `0.9.0+202608070223` after extension refresh.
- Verify prompt injection and model-generated `STStageRender` blocks through real streaming, swipes, and all three modes.
- Record any observed failures in a follow-up dated history entry before changing the acceptance status.
