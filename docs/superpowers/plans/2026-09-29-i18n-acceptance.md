# i18n Acceptance and First UI Integration

> Use subagent-driven-development for the focused implementation and independent review. The user approved the recovery sequence on 2026-09-29; continue without additional design approval.

**Goal:** Verify and repair the September 12 foundation, produce matching development artifacts, and translate the phone shell, overlay controls and gallery dialog entry surface.

**Architecture:** Keep the existing lightweight `t(key, fallback)` API and Chinese defaults. Resolve locale assets relative to the running bundle, honor the host's persisted language preference, and bound startup loading. Do not introduce a separate language preference or rewrite user settings. Language changes take effect on host reload. Distribution includes the two locale JSON files in addition to the original six files.

**Scope:** This is the first UI batch, not all eight Apps or full accessibility. Real ST/device acceptance is recorded only when actually performed. Preserve the existing untracked stylesheet and release clone. No external push or publication in this batch.

## Evidence and tasks

- [x] Validate maintenance ancestry/product staleness; HEAD is 25d62bd and both checks pass.
- [x] Reconcile contradictory records: root 18:08 vs distribution 18:09; locale loader uses browser language and incorrect stack regex, not STContext.getLocale; no interpolation exists despite the history claim.
- [x] Run baseline: 54 targeted tests pass in the existing checkout.
- [x] Task 1 — Locale loading and core safety. Modify `st-extension/src/st-adapter.ts` or extract `st-extension/src/i18n.ts`; add focused loader tests. Resolve with `new URL('locales/' + locale + '.json', import.meta.url)`, preserve renamed install/proxy paths, and enforce a finite timeout. Resolve ST persisted locale using verified host behavior, then browser fallback, default Chinese for unsupported locales. Reject invalid dictionaries and gracefully retain fallback text. Extend `core/i18n.ts`/test with safe own-property traversal and optional `{{param}}` substitution; preserve all two-argument call sites. Reproduce broken behavior before repairs.
- [x] Task 2 — Artifact integrity. Extend `scripts/verify-runtime-parity.mjs` and `st-extension/src/verify-runtime-parity.test.ts` to include exact-case locale paths and reject nested escaping symlinks. Permit root/distribution-only verification while keeping the three-way release check. Add a paired build command that resolves one timestamp and builds both destinations; test timestamp parity and locale contents with temporary fixtures. Update CI and distribution instructions for locale assets.
- [x] Task 3 — First UI surfaces. Update `core/phone-shell.ts`, `st-extension/src/overlay-dom.ts`, `st-extension/src/index.ts`, `st-extension/src/settings-panel.ts`, and the top-level gallery navigation/dialog controls in `st-extension/src/sprite-manager.ts`. Use Chinese fallback literals plus matching zh-CN/en-US dictionaries. Preserve IDs, stored values, user names, prompts and imported content. Tests verify English accessible labels and unchanged Chinese defaults, including parameterized names. Remaining deeper gallery/App translations stay explicitly pending.
- [x] Task 4 — Browser acceptance. Add an isolated browser harness for actual bundle-relative locale requests under a renamed extension path, host preference versus browser language, reload retention, failed/hanging locale fetch, and Chinese/English desktop/mobile layout. Use synthetic data only. If an actual ST checkout is supplied, use a separate data directory and report that evidence separately.
- [x] Task 5 — Verification and handoff. Run full Vitest, TypeScript, ESLint, Next build, paired extension build, locale parity, existing maintenance browser regressions and new browser checks. Independently review spec compliance then code quality. Commit intended code/build changes, update CURRENT/history/DEFERRED with exact commit and evidence, commit maintenance records. Keep the original checkout and independent release unchanged; report branch and remaining real-device/release gates.

## Commands

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --reporter=dot --silent=passed-only
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js core st-extension/src lib components app
node node_modules/next/dist/bin/next build
node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution
node scripts/verify-maintenance-browser.mjs
git diff --check
```

All success claims require a zero exit status and inspected results. A three-way parity failure against the unchanged release clone is an outstanding publication gate, not a local build failure.

## Final evidence (2026-09-30)

- 92 Vitest files / 1231 tests; TypeScript, ESLint, default Next/Turbopack build, paired extension build and local parity passed.
- Real ST 1.18.0 ran as a disposable runtime/data copy on loopback, with renamed extension baigong-acceptance: all 10 browser scenarios passed.
- Actual-host acceptance exposed mobile toolbar overflow and duplicate host Enter handling; minimal CSS/event fixes passed browser and unit regressions.
- Independent spec and code-quality reviews passed. Maintenance records contain the final committed code reference and release gaps.
- Original checkout and release clone preserved. Code and maintenance are committed on codex/i18n-acceptance; no push or publication.
