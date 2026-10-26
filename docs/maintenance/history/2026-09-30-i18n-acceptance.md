---
record_date: 2026-09-30
code_head_at_record: e11cd3d378736cd7540f56d225c3870482a9bf85
build_version: 0.9.0+202609300018
branch: codex/i18n-acceptance
recorded_by: codex
---

# Recovery, i18n Acceptance and First UI Batch

The maintainer approved a small acceptance/build cleanup followed by UI translation. Starting main was `25d62bd`; recorded code head `26a40d8` passed ancestry and product-staleness checks. Work used the attached `i18n-acceptance` worktree. Original main and its existing untracked stylesheet were preserved.

## Reconciliation

- September 12 root artifacts were actually `0.9.0+202609121808`, while distribution was `0.9.0+202609121809`; bundle/version parity did not hold despite the record's claim.
- The loader's stack regex reduced an extension URL to its origin. It read browser language only, with no `STContext.getLocale()` integration.
- Core parameter substitution was absent; the old usage example incorrectly passed an object into the fallback-string argument.
- Git showed two main commits beyond local tracking `1989c2f`, not one. Actual development remote lookup now requires authentication, so CURRENT deliberately records its remote-head field as null.

Official release `public/scripts/i18n.js` and the user's local ST 1.18.0 source confirmed the host contract: `localStorage.language`, then browser language; selecting a language saves the value and reloads. The extension now follows this contract without writing another preference.

## Delivered Behavior

Locale assets resolve against the running module URL, preserving install directory and proxy prefixes. A three-second deadline covers fetch and JSON body parsing, aborts and permits startup with Chinese/fallback text. Invalid dictionaries are rejected. Translation lookup uses own properties, and optional third-argument interpolation preserves missing placeholders.

The first translated surface includes phone navigation, overlay controls/placeholders, extension settings and gallery header/new/import controls. Names, IDs, prompt protocols and user content remain unchanged. The two dictionaries have 51 matching leaf keys and matching parameter names. Deeper gallery/App text is not represented as translated.

Actual-host testing exposed two more defects. Mobile toolbar overrides preceded later base rules, and individual actions did not wrap; controls extended left of the viewport in both languages. Overrides now follow the base rules, keep title/close in row one and wrap actions below. ST's document keyboard handler ignored `defaultPrevented` and clicked a menu button again after its own Enter handler; handled manager button events now stop propagation. The added regression first reproduced the closing menu and then passed.

`build:all` shares one timestamp across root/distribution. Parity includes seven runtime files, exact-case nested locales and escaping-link checks; explicit release mode still checks the independent README. Locale files are normalized/pinned to LF. Review caught that `git diff` misses regenerated untracked files; CI now checks all 15 required root/distribution assets with `git ls-files --error-unmatch` before building. The reviewer independently verified all 15 single-file omission cases fail.

## Verification

| Check | Result |
| --- | --- |
| Initial core/adapter/build baseline | 3 files / 54 tests passed |
| Final full Vitest | 92 files / 1231 tests passed, 192.57 seconds, one worker |
| TypeScript / ESLint / whitespace | Passed |
| Next.js 16.2.6 default Turbopack production build | Passed |
| Paired extension build | Both `0.9.0+202609300018` |
| Root/distribution seven-file runtime parity | Passed |
| Existing maintenance browser suite | Five HUD and four storage layouts, interaction and synthetic backup/apply passed |
| Real ST i18n browser suite | 10/10 passed, zero page JavaScript errors |
| Independent spec and quality reviews | Passed, including CI, keyboard and CSS follow-ups |

The first Next builds hit a cross-drive dependency-junction restriction in Turbopack and webpack. Only the worktree junction was replaced with an offline install from existing `D:\.pnpm-store`: 544 reused packages, zero downloads, unchanged lockfile, install scripts disabled. Default Next/Turbopack then passed without a product-code workaround.

### Real ST Evidence and Limits

User supplied `D:\6.YULE\ST\SillyTavern-1.18.0`. A disposable runtime copy under `test-results/real-st/runtime` used separate config and `test-results/real-st/data` at `127.0.0.1:18769`. Only dependencies were shared. Existing third-party extensions and daily data were excluded. Test automatic updates/plugins/downloads were disabled. Generated assets were installed as `baigong-acceptance`; only that test manifest set `auto_update` false.

```powershell
node scripts/verify-i18n-browser.mjs --url http://127.0.0.1:18769 --isolated-data
```

The committed harness uses fresh Edge 143.0.3650.80 contexts, the actual ST page and emitted bundle. It completes onboarding with a synthetic persona, waits for host readiness and waits for server settings-save acknowledgement when restoring test UI state.

All ten scenarios passed: desktop English/Chinese, 375x667 English/Chinese, browser fallback, unsupported host locale to Chinese, English 404, malformed English JSON, English timeout and both-locale timeout. Both locale files returned HTTP 200 from the renamed extension path in clean runs, with no locale warnings. Actual host selection changed English to Chinese and back; each survived another reload. Timeouts resumed around 3.61 seconds after the request, about 6.2 seconds total ST startup.

Phone/overlay/gallery controls and new/import popovers remained in the viewport without overlap. Keyboard activation/closure passed. Final mobile gallery/import and desktop phone screenshots were inspected. Phone checks are browser emulation, not a physical-device test. External image hosts were deliberately blocked; remote thumbnail placeholders are expected. The copied ST runtime also logged thumbnail conversion failures involving its shared Jimp/WASM dependency paths outside the copied server root. Image availability/conversion was not an acceptance target and must not be inferred from this i18n pass. A host horde-model request cancelled during language reload was unrelated to locale loading and caused no page error.

Ignored evidence: `test-results/i18n-browser/results.json`, screenshots and `before-fixes.json`; `full-tests-final.log`; `next-build.log`; `runtime-parity.log`; `release-parity.log`; and `maintenance-browser/`. The isolated test server was stopped at handoff.

## Handoff

Code/build commit `e11cd3d` remains on `codex/i18n-acceptance`; no merge/push. Original main stays `25d62bd`, local tracking main `1989c2f`; actual development remote lookup requires Git authentication. Independent release main was confirmed at `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`, and its checkout is clean.

Three-way parity correctly exits 1: release bundle/CSS/version/README are older and both locale files are missing. Release now requires the original six files plus both locale JSON files. No release copy/push occurred.

Remaining: full App translations, focus/screen-reader work, physical-phone/OS-keyboard checks, September 7 real-ST image migration/save/reload/restore/fault cases and standard ZIP import. This batch does not close those checks or authorize live-user migration.
