# 2026-08-19 Fifth Real-ST Acceptance Fixes

## Boundary

- Work branch: `codex/acceptance-round5`.
- Base remote head before integration: `de86d1e3888b2daf3fe392df95963a35bef479ae`.
- Code, tests, and generated artifacts commit: `69066357f025b56ebac482384b592802ddd156e8`.
- The code commit is fast-forwarded to `main` and pushed to `origin/main` with the maintenance handoff.
- Product version remains `0.9.0`; fixed build stamp is `0.9.0+202608191545`.
- This record does not claim real SillyTavern acceptance. The 16-item manual list in `CURRENT.md` is the next verification boundary.

## Root Causes And Repairs

### Phone And Variable Interaction

- Phone controls were allowed to bubble pointer, touch, and click events into the SillyTavern page behind the phone. The phone shell now stops those events at its boundary while preserving native control behavior.
- The variable-visibility switch already had a reprocessing path but gave too little feedback when the visible DOM had also been changed by an external SillyTavern Regex rule. The app now reports its own hide/restore result and explicitly describes that external deletion cannot be reconstructed by st-stage.

### Gallery Layout, Filters, And Tags

- Single-pack roles were rendered through the stack layout, making the gallery needlessly tall and hiding the distinction between one pack and a role with several packs. Single packs now use the normal grid; multi-pack roles show a counted layered card and expand horizontally only when opened.
- Gallery search and filters now cover pack name, role, outfit, type, and custom tags. Filters intersect across dimensions, multi-select within a dimension, and bulk select is limited to visible results.
- Custom tags can be added, renamed globally, and deleted. Role and type are derived metadata rather than editable free text. Bulk checkboxes are placed above status badges so selection remains usable on long or active cards.

### Opt-In Image Cleanup And Preset Localization

- The old path could identify a baked checkerboard in user-provided material but had no safe, user-visible action to repair it. A conservative detector now requires two supported light-grey colors and edge connectivity before removing pixels. It refuses ambiguous or ordinary images rather than guessing at chroma-key removal.
- Cleanup is explicit from image details, asks for confirmation only after detection, writes a transparent PNG to the SillyTavern user-image directory, and leaves settings untouched on cancellation or failure.
- Presets localize through a same-ID override, retaining their remote fallback and pack metadata instead of creating another `(local)` pack. The standalone 143-file source set is still deferred for quality review and owned hosting.

### Butler Measurement And Extension Advice

- The detailed report previously exposed implementation-oriented data without giving a user a useful before/after explanation. It now presents eight fixed Chinese metrics with before, after, change, and interpretation, while moving raw JSON under an advanced disclosure.
- Memory is explicitly qualified as affected by garbage collection and caches; a single increase or decrease is not treated as proof of an optimization.
- A read-only advisor explains the purpose and disable tradeoff of nine common system extensions. Unknown system extensions are not assigned speculative performance conclusions.
- Third-party troubleshooting retains SillyTavern's official disable-list and refresh flow, with reversible staged testing. The advisor is guidance, not an automatic system-extension blocker.

## Verification

- Frozen install: pnpm `10.32.1`; lockfile unchanged.
- Vitest `4.1.10`: 72 files / 908 tests passed.
- TypeScript typecheck and full ESLint passed.
- Next.js `16.2.6` production build passed.
- Playwright `1.62.0`: 25/25 across desktop Chromium, Pixel 7, and Galaxy S8. The sandbox launch hit `spawn EPERM`; the same project-scoped suite passed outside the sandbox.
- `git diff --check` passed.
- Root and `st-distribution/` artifacts were rebuilt twice with the same stamp and were byte-stable. Shared SHA-256 hashes:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `E6DBB7839E0B98CEDDC8A60F4A5FCC915571E9E765AB23B1F737740C016755BB`
  - `style.css`: `5194DE8924006792A52B0D800A233CBDEF889094CBA9B399659C6547BA5F1ADA`
  - `version.json`: `C52328130CF5A53267E8C20CE81B2F6577505ED548510C3948842227336E3113`
- `st-distribution/` contains exactly six install files and no image, `public/`, `reference/`, or preset source.

## Deferred Boundary

- Renderer snapshot image-listener restoration and conservative HTML detection remain deferred.
- Cards pre-generated branch generation and post-selection pruning remain deferred; this round keeps the predictable "fill the composer, review, then send" flow.
- Batch cleanup of the 143 reference PNGs and selection of owned long-term image hosting remain deferred.
- Extraction and publishing automation for the standalone ST distribution repository remain deferred.
- The semantic product-version decision remains deferred until real-ST acceptance and release coordination.

## Next Boundary

Install the pushed extension in real SillyTavern and execute the 16 checks in `docs/maintenance/CURRENT.md`. Record observed behavior separately from these automated results; promote only reproducible real-ST failures into the next scoped fix batch.
