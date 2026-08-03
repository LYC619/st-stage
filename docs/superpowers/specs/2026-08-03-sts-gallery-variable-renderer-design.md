# STS Gallery, Variable, and Renderer Update Design

**Date:** 2026-08-03
**Branch:** `codex/sts-update`
**Base:** `1680db8`

## 1. Goal

Deliver the next STS update as independently testable batches:

1. make gallery preview usable on mobile and efficient for routine editing;
2. add metadata, prompt notes, story image capture, manual localization, and outfit folding without changing existing sprite addresses;
3. repair the new-variable parser and built-in templates, then add practical templates;
4. add a native STS renderer v1 for Galgame dialogue, SLG choices, and simple local battles driven by AI-produced structured data.

The user's built-in action, portrait, and character pack content remains outside this implementation.

## 2. Product Decisions

The user delegated conventional UI decisions and asked not to use an interactive visual-design loop. The implementation therefore follows the existing native DOM and STS visual conventions.

### 2.1 Considered approaches

#### A. Copy `reference/st-renderer` into the extension

This is initially fast, but it brings a second global state system, direct `innerHTML` rendering, localStorage settings, demo-only battle resolution, and lifecycle ownership outside the STS App context. It is rejected.

#### B. Native STS modules using a small structured protocol

This reuses the reference project's useful concepts while implementing parsing, rendering, settings, and cleanup through existing STS boundaries. It costs more up front but preserves lifecycle, storage, testing, and security invariants. This is the selected approach.

#### C. Regex-only cosmetic replacement

This is sufficient for static decoration but cannot reliably represent choices, battle data, replay state, validation, or graceful fallback. It is rejected as the renderer foundation, though the structured block is still found with a narrow regular expression before JSON parsing.

## 3. Gallery Design

### 3.1 Data model and migration

Increment `SETTINGS_VERSION` once for this update. Existing settings migrate without changing current addresses or bindings.

Add optional fields:

```ts
interface Sprite {
  labels?: string[]
}

type PromptNotePlacement = 'before-list' | 'after-list'

interface SpritePack {
  promptNote?: string
  promptNotePlacement?: PromptNotePlacement
  outfitNotes?: Record<string, string>
  sourceStoryKey?: string
}

interface PluginSettings {
  galleryFoldByRole: boolean
}
```

Rules:

- `labels` are classification/search metadata. They never replace the identity `tag` and never participate in sprite addressing.
- Labels are trimmed, normalized, deduplicated, limited to 24 entries per sprite, and limited to 32 characters each.
- `promptNote` explains the whole pack. `outfitNotes` explains a named outfit when a pack contains sprite-level outfits.
- Notes are plain text, limited to 500 characters, and never interpreted as HTML.
- `sourceStoryKey` identifies an automatically selected story archive pack. It is not exported as an address dimension.
- `galleryFoldByRole` defaults to `false`, preserving the current list on migration.

The pack export/import format advances to `sprite-pack@3` for the new metadata while retaining import support for `@1` and `@2`. Compact share strings remain image-focused and omit notes and labels unless their current versioned payload can carry them without breaking compatibility; JSON export is the lossless format.

### 3.2 Mobile-safe lightbox

The lightbox is mounted as a viewport-level layer, not positioned relative to the manager's scroll body. It tracks `window.visualViewport` when available and falls back to `innerWidth`/`innerHeight`.

Desktop layout:

- image occupies the flexible left area;
- a fixed-width right action rail contains icon-and-text buttons;
- previous, next, caption, and close remain available;
- the destructive delete action is visually separated at the bottom.

Mobile layout:

- the layer uses the visual viewport's offset, width, and height;
- safe-area insets are applied;
- the image is bounded by the remaining height and never starts above the visible viewport;
- actions become a horizontally scrollable bottom toolbar with text labels;
- navigation and close controls retain stable hit targets of at least 44 px.

Opening, orientation changes, browser chrome changes, and soft-keyboard changes must not place the preview outside the visible viewport.

### 3.3 Lightbox editing

The right/bottom action rail exposes existing operations with text labels:

- Rename
- Manage labels
- Change group
- Replace image
- Save locally
- View/copy remote address
- Set as cover
- Delete

The operation implementation is shared with grid-card actions. A successful edit updates the live lightbox model, caption, action state, and underlying manager without closing the preview unless the current sprite was deleted. Deleting selects the next sprite, the previous sprite at the end, or closes the lightbox when the pack becomes empty.

### 3.4 Manual local save

Remote sprites are never downloaded to ST storage in the background. "Save locally" is an explicit action.

On success:

1. fetch the remote image;
2. compress it through the existing image pipeline;
3. save it through `STAdapter.saveImage`;
4. replace `sprite.url` with the local path;
5. preserve the original HTTP URL in `remoteUrl` for sharing.

Data URIs and already local paths show a disabled "Already local" state. A CORS or network failure leaves settings unchanged and displays a useful error. Normal local-file upload continues to save the selected file because that is the user's explicit action.

### 3.5 Labels and search

Pack detail receives one compact search field and a label filter menu. Search matches:

- sprite identity tag;
- metadata labels;
- effective role and outfit;
- pack name.

Multiple selected labels use AND semantics. Filtering applies before the 60-item render window. Changing the filter resets the visible count to 60. Label management uses a text input plus removable label chips in the lightbox; labels are not represented by free-form comma parsing alone.

### 3.6 Role/outfit folding

When `galleryFoldByRole` is enabled, the pack list groups packs with the same non-empty normalized `roleName`. A collapsed role row displays:

- role name;
- number of packs;
- total sprite count;
- representative cover images;
- expanded/collapsed state.

Expanding shows the existing pack cards, including each outfit and pack name. Packs without `roleName` remain individual cards. Folding is presentation-only: packs, IDs, bindings, order, collision rules, imports, and exports are not merged or rewritten.

### 3.7 Prompt notes and numbered action ranges

Prompt notes are included only for active packs. They are inserted either before or after that pack's scene list according to `promptNotePlacement`. Outfit notes are attached to the matching `role/outfit` scene. Empty notes are omitted.

Numbered sprite tags are compacted for prompt display when all conditions hold:

- tags share the same non-empty text prefix;
- numeric suffixes form a contiguous run;
- the run contains at least three values;
- every value maps to a real sprite in the same role/outfit scene.

For `挥手1` through `挥手7`, the prompt renders:

```text
挥手1-7（输出时从挥手1至挥手7中随机选择一个完整图名）
```

The AI must still output an existing complete address such as `[立绘:角色/服装/挥手4]`; `[立绘:挥手1-7]` is explicitly forbidden. Gaps are never invented: `挥手1`, `挥手2`, `挥手4` remain separate or only the real contiguous subset is compacted.

This compaction runs before prompt-budget fitting so action packs consume less budget while still preserving real address validation.

### 3.8 Story image capture

Message postprocessing decorates eligible images in AI message bodies with a text action "Save to gallery". It excludes avatars, STS inline sprites, renderer-owned images, emoji, and small UI assets.

The action is manual; no image is downloaded or stored merely because a message was rendered.

On click:

1. derive a stable story key from the current chat identifier or chat filename plus character/group identifier;
2. find or create one pack named `Story - <chat title>` with the matching `sourceStoryKey`;
3. derive a safe sprite name from image alt/title, falling back to `Generated image N`;
4. attempt local storage through fetch, compression, and `saveImage`;
5. if CORS prevents local storage, offer to retain the remote URL instead of claiming a local save;
6. persist the sprite and refresh the manager.

Repeated clicks on the same image URL in the same story are idempotent. Story packs are ordinary editable packs after creation.

## 4. New-Variable Design

### 4.1 Correctness repairs

The update repairs issues found during template inspection:

- generated JSON Patch examples use valid JSON values;
- `remove` operations must target a schema-defined leaf and cannot delete a parent object;
- manual tree edits pass through the same `validateValue` rules as AI updates;
- malformed or unsupported JSON Patch entries produce rejected diagnostics instead of disappearing;
- the legacy `_.set` parser becomes quote-aware for commas, closing parentheses, escaped quotes, and `//` inside strings;
- parser output remains prototype-safe through the shared path guard.

Every repair receives a focused RED/GREEN test before implementation.

### 4.2 Built-in template corrections

- Multi-character templates repeat the "update only while present" condition on every dependent variable instead of attaching it only to `是否在场`.
- Placeholder character names are represented consistently in paths, descriptions, and rules. Applying or renaming a template cannot leave contradictory `角色A` prose behind.
- RPG mana receives explicit spend/recovery rules.
- Relationship-stage transitions define concrete threshold ranges rather than referring to unspecified levels.
- Time templates include an explicit date/time string alongside categorical fields so cumulative transitions remain observable.

### 4.3 Additional templates

Add three templates that fit the current primitive-leaf schema:

- Survival exploration: health, hunger, thirst, fatigue, temperature state, danger level, location, and time.
- Mystery investigation: current objective, clue summary, suspicion, urgency, location, and case phase.
- Quest progression: current goal, progress 0-100, phase, blocker, deadline pressure, and completion state.

Template tests verify unique IDs, schema-valid defaults, valid ranges/enums, prompt generation, and a parser round trip for both JSON Patch and legacy formats.

## 5. Renderer V1 Design

### 5.1 Ownership and integration

Renderer v1 is a built-in phone App plus a message-postprocessing plugin. Settings live in `settings.apps.renderer`, not in the gallery core schema.

The renderer owns:

- structured block parsing and validation;
- mode-specific DOM mounts;
- mode styles;
- renderer prompt injection;
- per-message cleanup and interaction state;
- a settings App for enabling modes and configuring prompt depth.

It reuses:

- the platform capability tracker for cleanup;
- the existing prompt channel API;
- gallery address resolution for optional portraits;
- message render/reprocess events;
- ST settings persistence.

It does not reuse the reference project's global `window.STR`, localStorage, direct `innerHTML` templates, or demo battle resolver.

### 5.2 Structured response protocol

The injected prompt asks the AI to include at most one block when a renderer mode is appropriate:

```text
<STStageRender>
{"version":1,"mode":"gal",...}
</STStageRender>
```

The outer tag is located narrowly, then the body is parsed with `JSON.parse` and validated against a mode-specific schema. User-facing strings are rendered through `textContent`; URLs accept only supported image schemes. Unknown fields are ignored, required fields are enforced, and size/count limits prevent oversized DOM output.

Invalid blocks remain visible as original message text and produce a console diagnostic. A valid block is hidden only after its replacement mount succeeds. Disabling the renderer restores the original message DOM.

### 5.3 Galgame mode

Schema:

```ts
interface GalRenderBlock {
  version: 1
  mode: 'gal'
  scene?: string
  background?: string
  beats: Array<{
    speaker: string
    text: string
    portrait?: string
    expression?: string
  }>
}
```

The rendered message provides a contained visual-novel stage with optional inspectable background, portrait resolved from a gallery address or safe URL, speaker name, dialogue text, previous/next beat controls, and a skip-to-end control. It does not replace the whole SillyTavern page.

### 5.4 SLG card-choice mode

Schema:

```ts
interface CardsRenderBlock {
  version: 1
  mode: 'cards'
  title: string
  description?: string
  cards: Array<{
    id: string
    title: string
    description: string
    consequenceHint?: string
    action: string
  }>
}
```

The renderer shows 2-8 scannable cards. Selecting a card marks it locally and inserts its `action` text into the SillyTavern composer; it does not silently send a message. Re-selecting replaces only the renderer-owned composer draft when it has not been edited by the user.

### 5.5 Battle mode

Schema:

```ts
interface BattleRenderBlock {
  version: 1
  mode: 'battle'
  title: string
  player: FighterConfig
  enemy: FighterConfig
  opening?: string
}
```

The AI provides initial combatants, bounded stats, skills, items, and opening narrative. A pure TypeScript battle engine handles attack, skill, defense, item, flee, status duration, seeded random resolution, and battle end. The engine has no DOM dependency and no hidden AI call.

"Free action" and post-battle continuation insert a readable action/result summary into the composer for the user to edit and send. Local battle state is scoped to the rendered message and disposed when that message is rerendered or removed.

The v1 engine intentionally supports one player and one enemy. Multi-party combat and automatic API calls are excluded.

### 5.6 Renderer settings

Renderer App settings include:

- master enable;
- enable Galgame mode;
- enable card-choice mode;
- enable battle mode;
- prompt injection depth;
- animation/typewriter toggle;
- reduced-motion behavior.

The prompt enumerates only enabled modes. When every mode is disabled, the renderer prompt channel is cleared.

## 6. File Boundaries

Large existing files are not expanded with all new responsibilities.

Gallery additions are split into focused modules:

- `core/sprite-metadata.ts`: label/note normalization and numbered-range compaction;
- `core/story-archive.ts`: story key, archive selection, and deduplication logic;
- `st-extension/src/sprite-lightbox.ts`: viewport-safe preview and action rail;
- `st-extension/src/story-image-capture.ts`: message-image decoration and save workflow.

Renderer additions live under:

- `st-extension/src/apps/renderer/types.ts`;
- `st-extension/src/apps/renderer/parser.ts`;
- `st-extension/src/apps/renderer/prompt.ts`;
- `st-extension/src/apps/renderer/runtime.ts`;
- `st-extension/src/apps/renderer/battle-engine.ts`;
- `st-extension/src/apps/renderer/modes/gal.ts`;
- `st-extension/src/apps/renderer/modes/cards.ts`;
- `st-extension/src/apps/renderer/modes/battle.ts`;
- `st-extension/src/apps/renderer-app.ts`.

Mode CSS is namespaced with `so-renderer-` and appended to the extension stylesheet without importing the reference CSS wholesale.

## 7. Error Handling and Safety

- No background network transfer is introduced.
- All remote image operations are user-triggered and transactional.
- Settings are persisted only after image storage or metadata validation succeeds.
- User/model strings use text nodes, not HTML interpolation.
- Renderer URLs reject script-capable schemes.
- Parser item counts, text lengths, stat ranges, and image dimensions are bounded.
- Cleanup is idempotent and registered with the existing lifecycle.
- A failed renderer never hides the original AI response.
- A failed gallery edit never closes the preview or mutates unrelated sprites.

## 8. Verification Strategy

Each implementation batch follows RED, GREEN, focused tests, full tests, typecheck, lint, fixed-time extension build, artifact diff review, and one commit.

Required automated coverage includes:

- visual-viewport lightbox sizing and orientation updates;
- lightbox action text, edit refresh, deletion navigation, and cleanup;
- remote localization success/failure and no automatic fetch;
- metadata migration, import/export, label filtering, and role folding;
- numbered-range compaction with contiguous, gapped, mixed, and Unicode names;
- prompt-note placement and prompt-budget interaction;
- story-key stability, image eligibility, deduplication, and CORS fallback;
- all variable defects and all built-in template round trips;
- renderer schema validation, invalid-block fallback, reversible DOM processing, lifecycle disposal, and URL safety;
- Galgame beat navigation, card composer insertion, and deterministic battle transitions;
- mobile Playwright coverage for preview framing and renderer controls.

Real SillyTavern handoff checks remain necessary for browser chrome/visual viewport behavior, external image-generator DOM variants, composer integration, prompt injection, and renderer behavior across actual message streaming and swipes.

## 9. Delivery Order

1. Gallery viewport and lightbox actions.
2. Gallery schema, labels, search, folding, notes, and numbered action prompts.
3. Manual localization and story image capture.
4. New-variable correctness and templates.
5. Renderer protocol and reversible runtime.
6. Galgame mode.
7. SLG card-choice mode.
8. Battle engine and mode.
9. Integration, generated artifacts, mobile verification, and unified CC review handoff.
