# Variable workflows translation and keyboard acceptance

Code/build: `21fa4029175f0887186a50e32d05f969330d59fa`. Build: `0.9.0+202610070210`. Branch: `codex/i18n-acceptance`.

## Delivered

- Translated MVU, New Variables, shared variable tree, designer, parser/runtime diagnostics and HUD. Both dictionaries contain 678 keys; 734 static source references pass completeness checks. Butler/Renderer App display names were also translated.
- Template catalog labels are translated for display only. Saved/imported schema names, variable keys, values, descriptions, rules, persistent IDs and AI injection/protocol content are unchanged.
- Keyboard tree editing uses path-labelled inputs; cancel returns to the leaf. Designer uses shared modal focus; type/format changes preserve focus; native button Enter activates once under ST.
- HUD uses a named nonmodal region, keyboard/assistive open, focused close control, scoped Escape and return. Drag and lifecycle behavior remain intact.
- Independent review reproduced async MVU saves stealing focus from HUD/Refresh controls. Four red-to-green regressions now require the original editor to retain focus ownership before restoring a leaf. A separate native Edge harness with real App/bridge/PhoneShell modules and a controlled MVU fixture passed five cases.

## Verification

- Full Vitest: **98 files / 1300 tests**. TypeScript, ESLint, Next/Turbopack production build, paired extension builds, seven-file runtime/locale parity and staged whitespace checks passed.
- Real ST 1.18.0 / Edge 143.0.3650.80, current emitted build: **10/10 i18n** plus **4/4 variable layouts** (desktop/mobile, English/Chinese), zero page JavaScript errors.
- Real variable flows use a synthetic character and per-run chats: definition editing, range clamping 200 to 100, cancellation, actual `/api/chats/save` success, reload/reopen retaining value and user schema name; template Replace activates once and imports original Chinese template data; HUD keyboard and drag pass.
- Native Edge **10/10** and existing maintenance regression pass (five HUD viewports, resize/drag/disposal, input/caret/paste/composition, four synthetic storage layouts). Spec, quality and root HUD reviews passed. Final designer/template/HUD screenshots were inspected.

## Limits and continuation

Third-party MVU/Tavern Helper is not installed in isolated ST: its unavailable notice is accepted there; read/write timing is covered by tests and the synthetic native fixture. No AI generation or external image conversion acceptance. Mobile evidence is browser emulation, not physical hardware or reader certification.

Only ignored `test-results/real-st/` runtime/data changed. No daily ST data changes, merge, push or independent release. Cloud Export and three sprite-store validation messages remain for the next batch; older migration/ZIP/device and export identity/cancellation follow-ups remain in DEFERRED.md.
