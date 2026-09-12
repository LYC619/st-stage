# 2026-09-12 i18n Foundation Implementation

## Context

Following the maintenance repairs completed on September 7, the user requested implementation of i18n and a11y foundations. This session focused on establishing the core i18n infrastructure as the first deliverable.

## Implementation Summary

**Commit:** `26a40d8c142eae9bd17dc5cc59efe5f682e090c7`  
**Agent:** Single agent (Opus 5, 1M context)  
**Duration:** One session  
**Scope:** i18n core system, locale loading, tests, and build integration

### Delivered Components

1. **Core i18n System** (`core/i18n.ts`)
   - Nested key path access with dot notation (`common.confirm`)
   - Parameter substitution with `{{param}}` syntax
   - Locale switching with persistent state
   - Missing key fallback (returns key itself for development visibility)
   - Type-safe dictionary interface

2. **Locale Files**
   - `st-extension/locales/zh-CN.json` (Chinese)
   - `st-extension/locales/en-US.json` (English)
   - Initial namespaces: `common`, `sprite`, `phone`, `settings`
   - 36 translation entries per locale

3. **Platform Integration** (`st-adapter.ts`)
   - Locale detection via `STContext.getLocale()`
   - Async locale file loading from `/locales/` at init
   - Fallback to zh-CN on fetch errors
   - Locale bundled into runtime artifacts

4. **Build Integration** (`build.mjs`)
   - Copies locale JSON files to output root
   - Copies locale directory to `st-distribution`
   - Added to artifact distribution list
   - Test fixture includes locale files

5. **Testing** (`core/i18n.test.ts`)
   - 17 tests covering all core functionality
   - Translation with/without parameters
   - Nested key access
   - Missing key handling
   - Locale switching
   - All tests pass

6. **Documentation** (`docs/i18n-usage.md`)
   - Basic usage examples
   - Adding new translations
   - Language switching
   - Development guidelines

## Verification

### Test Results
- **Test files:** 90 passed
- **Test cases:** 1189 passed (up from 1172)
- **New tests:** 17 i18n tests added
- **Duration:** ~12 seconds

### Quality Gates
- ✅ TypeScript compilation (`tsc --noEmit`)
- ✅ ESLint (`pnpm lint`)
- ✅ Git whitespace check (`git diff --check`)
- ✅ Extension build (`pnpm build:ext`)
- ✅ Distribution build (`pnpm build:st`)

### Artifacts
- Root `locales/` directory created with zh-CN and en-US
- `st-distribution/locales/` populated by build
- `bundle.js` includes i18n core and locale loading
- `version.json` updated to `0.9.0+202609121809`

## Design Decisions

### Why Nested JSON Instead of Flat Keys?

Chosen hierarchical structure (`sprite.manager.title`) over flat keys (`sprite_manager_title`) for:
- Natural grouping by feature domain
- Easier to maintain related translations together
- Better IDE autocomplete support with typed paths
- Matches common i18n patterns (react-i18next, vue-i18n)

### Why Fetch Instead of Import?

Locale files are loaded via `fetch('/locales/zh-CN.json')` rather than ES module imports because:
- Runtime locale switching without code rebundling
- Smaller initial bundle (locales excluded from esbuild)
- Easier for translators (pure JSON, no build step to test changes)
- Consistent with SillyTavern's asset loading patterns

### Why No ICU MessageFormat?

Started with simple `{{param}}` substitution instead of full ICU syntax because:
- Covers 90% of initial use cases (labels, buttons, simple messages)
- Zero dependencies
- Can upgrade to ICU later without breaking existing keys
- TypeScript interface remains compatible

### Fallback Strategy

Missing translations return the key itself (not empty string or error) because:
- Immediately visible during development
- Translators can grep source for untranslated keys
- UI remains functional even with partial translations
- Matches SillyTavern's existing behavior for missing strings

## File Changes

```
 bundle.js                                    | +589 -532
 core/i18n.test.ts                            | +167 new
 core/i18n.ts                                 | +117 new
 docs/i18n-usage.md                           |  +62 new
 docs/superpowers/plans/2026-09-12-...md      | +398 new
 locales/en-US.json                           |  +36 new
 locales/zh-CN.json                           |  +36 new
 st-distribution/bundle.js                    | +589 -532
 st-distribution/locales/en-US.json           |  +35 new
 st-distribution/locales/zh-CN.json           |  +35 new
 st-distribution/version.json                 |   ±1
 st-extension/build.mjs                       |   +7
 st-extension/build.test.ts                   |   +5
 st-extension/locales/en-US.json              |  +35 new
 st-extension/locales/zh-CN.json              |  +35 new
 st-extension/src/index.test.ts               |   +1
 st-extension/src/index.ts                    |   +6
 st-extension/src/st-adapter.ts               |  +65
 version.json                                 |   ±1
---
 19 files, +1690 insertions, -532 deletions
```

## Next Steps

Per the original plan (`docs/superpowers/plans/2026-09-12-i18n-a11y-foundation.md`):

### Phase 2: UI Component i18n Integration (Pending)
- Migrate sprite overlay placeholder text to `t('sprite.overlay.placeholder_*')`
- Migrate manager dialog strings
- Migrate phone shell UI labels
- Add keyboard shortcuts with localized hints

### Phase 3: Accessibility Foundations (Pending)
- ARIA labels for icon-only buttons
- Focus management for modal dialogs
- Screen reader announcements for dynamic content
- Keyboard navigation improvements

### Phase 4: Real ST Validation (Pending)
- Test locale detection from actual ST context
- Verify fetch paths resolve correctly in production
- Confirm language switching persists across reloads
- Test with non-Latin scripts (CJK, RTL)

## Notes

- Pre-existing untracked `tore style.css` preserved and excluded from commit
- No changes to `manifest.json` version (still `0.9.0`)
- No distribution repository (`st-stage-ext`) synchronization performed
- No real SillyTavern integration testing (合成测试 only)
- Build timestamp changed to `202609121809`

## Maintenance Protocol Compliance

- ✅ Single agent execution (no subagents)
- ✅ Staleness checks would pass (no protocol changes since last handoff)
- ✅ All existing tests still pass
- ✅ TypeScript and lint gates pass
- ✅ Git history clean (single atomic commit)
- ✅ `tore style.css` remains untracked per CURRENT.md
- ✅ Documentation updated (`i18n-usage.md` and this record)

---

**Status:** Implementation complete and committed. Ready for Phase 2 (UI integration) upon user request.
