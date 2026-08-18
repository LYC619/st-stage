# 2026-08-18 Fourth Real-ST Acceptance Fixes

## Boundary

- Work branch: `codex/acceptance-round4`.
- Base and recorded remote head: `6858170fbc0a77c51c23378b342a31271e3877ef`.
- Design/plan commit: `36c2eba`.
- Sanitized variable-payload commit: `46be1bc`.
- Remaining code, tests, and generated artifacts commit: `d4d26a48bba66e930c561071a9fbcdc4f5c3687d`.
- `main` was fast-forwarded and pushed to `origin/main` at `d4d26a4` on 2026-08-19.
- Product version remains `0.9.0`; fixed build stamp is `0.9.0+202608182307`.
- This record does not claim real SillyTavern acceptance.

## Root Causes And Repairs

### Sanitized Variable Payloads

- SillyTavern Regex, Markdown conversion, and DOMPurify can remove unknown protocol wrappers while leaving their JSON payload visible.
- The old full-message equality guard rejected valid variables whenever the same reply also contained thinking, summary, Renderer, Analysis, comments, or other transformed content.
- The new guard derives conservative payload variants from raw `<UpdateVariable>` evidence and hides only one unique visible match. It supports optional Analysis removal and one Markdown JSON fence while preserving ambiguous content.

### Multiple Renderer Blocks

- The real failing reply contained valid Cards and Battle blocks in one message. The singular bare-JSON parser rejected multiple valid objects after DOMPurify stripped wrappers.
- Parsing now returns up to three valid blocks in message order. Invalid candidates remain visible and no longer suppress valid neighbors.
- Runtime state now tracks independent mounts, source ranges, snapshots, restoration, and disposal per block.
- Gal can resolve a missing portrait from the first enabled pack whose role exactly matches the speaker. Cards remains review-before-send.

### Gallery Structure And Metadata

- The former vertical role container treated one-pack roles as stacks, producing one item per row and making the stack affordance unclear.
- Single packs now join the responsive grid; only multi-pack roles use layered cards, an explicit count, and horizontal expansion.
- Schema 7 adds pack type and custom tags across migration, import/export, share codes, archive, merge/split, preset metadata, and batch operations.
- Import analysis reports missing alpha or likely baked checkerboard pixels without destructive runtime chroma-key processing.

### Butler Action Workflow

- Legacy data could normalize an `applied` transaction with zero actions, hiding the primary apply button even though nothing had changed.
- Empty transactions are now rejected. The main screen exposes a four-step workflow and a prominent `立即应用 N 项建议` action.
- Implementation terms were replaced with task-oriented Chinese across the main screen, findings, comparison reasons, extension isolation, detailed results, and the read-only advisor.

## Verification

- Formal locked environment after implementation: pnpm 10.32.1 frozen install reused 533 packages with no downloads; Vitest 4.1.10 passed 69 files / 887 tests; TypeScript, full ESLint, and Next.js 16.2.6 production build passed.
- Extension build integration: 15/15 within the formal full suite.
- Final supplemental behavior rerun after the environment reinstall issue: Vitest 3.2.4 passed the same 69 files / 887 tests.
- Playwright 1.62.0: 25/25 across desktop Chromium, Pixel 7, and Galaxy S8 after correcting one stale E2E copy assertion. Chromium required the approved project-scoped launch outside the sandbox.
- The E2E rerun used a local same-version Next 16.2.6 Webpack server and temporarily omitted unavailable `shadcn/tailwind.css`; it proves covered behavior and overflow assertions, not production-tree pixel identity.
- `git diff --check`: passed.
- Root and `st-distribution/` were rebuilt twice with `ST_STAGE_BUILD_TIME=2026-08-18 23:07` and remained stable.
- Shared SHA-256 hashes:
  - `bundle.js`: `C64679D52C3DBD1C1464B71BE9ACF32656E95FE3011C336F3BA4882F266BC638`
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `style.css`: `3BEC794D0E52C439A636A0BAB8926270405B7E1284B41F2B53AB31712AB5632D`
  - `version.json`: `DD5B494839A9979F2BBF49FB69C31F3F9FADAFE7A83A350F735434A253F8EBF4`
- `st-distribution/` contains exactly `bundle.js`, `index.js`, `manifest.json`, `README.md`, `style.css`, and `version.json`, with no image or preset source.

## Environment Exception

- A later attempt to repeat frozen install entered a non-interactive `node_modules` rebuild and ran abnormally long. It was stopped; offline recovery then proved the local pnpm store lacked tarballs, and sandbox network access was denied/rate-limited.
- The lockfile, source, and committed artifacts were unchanged. The local `node_modules` tree now needs a normal network-enabled `pnpm install --frozen-lockfile` before another exact production build.
- Temporary dependency junctions, Webpack config/CSS changes, test output, local server, and repository temp directories were removed before commit.

## Next Boundary

Install `origin/main` in real SillyTavern and execute the 16-item list in `docs/maintenance/CURRENT.md`. Keep `manifest.json` at `0.9.0` until observed blockers are resolved; only then decide and verify the `1.0.0` release.
