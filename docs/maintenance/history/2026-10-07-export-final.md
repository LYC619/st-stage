# Core five-App i18n and keyboard completion

Code/build: `cec4e8dc74eb1a99e971d0e33dfd92d65001ffab`. Build: `0.9.0+202610070357`. Branch: `codex/i18n-acceptance`. This finishes the authorized autonomous functional/keyboard scope following `d55fd4c`, `76a262a` and `21fa402`.

## Delivered and reviewed

- Cloud Export translates categories, search, selection, bundle warnings, progress and bridge/loader/archive diagnostics. Stable focus identities, native tabs, labelled checkboxes/chat summaries, busy guards and a persistent live status preserve usability through asynchronous rebuilds. Restoring open details no longer retriggers failed chat requests.
- Actual ST rewrites `.menu_button` elements to `role=button`, invalidating the initial tab implementation despite unit success. Native tab buttons avoid this hook while preserving one Enter/Space activation; a two-column layout prevents translated labels squeezing. The real-host harness reproduced the failure, then passed after repair. A separate actual-host-script native fixture passes both languages at 240/290/355 px.
- Common cleanup translates sprite rename/group conflicts, deletion safeguards, image-save/remote-reference fallback and failed-image retry. Failed inline images gain keyboard retry and focus styling. Final review reproduced Save nested inside the retry control intercepting Enter/Space; Save now sits beside the image wrapper and retry accepts only its own keyboard target. Unit red-to-green and real native keyboard regression confirm both operations remain independent.
- Stored names, preset/template data, prompts, protocol strings, fallback identities, archive paths and selection semantics remain unchanged. No broad fix was folded in for the existing export identity, worldbook case-match or cancellation edges.
- CI now also reports bundle size and warns above 1 MB. Root/generated README and i18n/accessibility guides reflect five-App coverage and limitations. Locale completeness is **759 keys / 836 references**; bundle is **951080 bytes**.
- Independent scoped spec/quality reviews passed for Export and common changes. A final cross-module review identified the Save/Retry issue above and confirmed its repair. Export tab repair passed spec and quality re-review.

## Final verification

- **99 Vitest files / 1321 tests passed**, TypeScript, ESLint, Next/Turbopack production build and staged whitespace checks passed. Both extension destinations and seven-file runtime/locale parity pass. A README-only rebuild reused the same build timestamp and did not change accepted runtime bytes.
- An initial uncapped full suite running alongside builds/browser jobs timed out two unchanged large-gallery tests. Capped runs passed without increasing timeouts or weakening assertions; the final four-worker full suite took 71 seconds. The first Export attempt also remained in host initialization during that contention; later unloaded runs reached and verified the actual App.
- Real ST 1.18.0 / Edge 143.0.3650.80, final emitted build: **10/10 i18n and 4/4 Export scenarios**, zero page JavaScript errors. English/Chinese desktop/mobile scenarios cover actual host roles and keyboard, character bundles/chat toggles, associated worldbook, preset/regex selection, category retry after one injected HTTP fault, download focus and return to Home.
- Each actual downloaded ZIP is inspected with JSZip: exact file list, PNG signature, both saved JSONL chats, original worldbook/preset JSON and minimal regex/world-selection settings. The fixture uses only synthetic test records and real ST endpoints. This does not exercise ZIP import.
- Native production-module regression **12/12**; separate actual ST a11y/keyboard script fixture **6/6**. Earlier gallery **4/4** and variables **4/4** retain their batch-specific evidence in prior histories. Third-party MVU is represented by a controlled native fixture (**5/5**) and its absent-state UI in real ST, not an installed plugin.
- Existing maintenance browser regression passed (five HUD viewports, growth/drag/rotation/disposal, caret/paste/composition, four synthetic storage layouts with backup/apply). Relevant final screenshots were inspected, including Export mobile labels and focus.

## Handoff and boundaries

Worktree is retained at `C:\Users\yicha\.codex\worktrees\i18n-acceptance\st-stage`. Original main remains `25d62bd` with its pre-existing `tore style.css`; independent release stays clean at `d6e8a89`. Both states were checked October 7. No merge, push, release copy/publication or daily ST data changes. Development remote authentication remains unavailable.

The isolated server at 127.0.0.1:18769 was stopped after testing; runtime/data/screenshots/downloads remain in ignored `test-results/`. Browser external image requests were blocked and copied-runtime thumbnail dependency warnings persist. Cloud-image availability/conversion is not accepted.

This completes the requested core UI/five-App translation and practical keyboard/focus work. It does not claim full WCAG AA, WAVE, actual reader/device/OS-keyboard or installed third-party MVU acceptance. Historical migration/restore/fault/ZIP-import and export edge gates remain in DEFERRED.md. The historical plan's `role=application` suggestion was intentionally replaced by named nonmodal regions; documentation lives in `docs/i18n-usage.md`. License choice and associated badges remain a maintainer/publication decision rather than an inferred license grant.
