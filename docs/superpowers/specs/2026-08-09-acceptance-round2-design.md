# Acceptance Round 2 Design

## Purpose

This change set resolves the second real-SillyTavern acceptance round before the product version can move to 1.0. The work is split into independently verifiable runtime, gallery/resource, and prompt/release batches.

## Runtime Correctness

Chat navigation must be self-healing. The extension refreshes immediately on `CHAT_CHANGED`, refreshes again after the new chat has settled, and listens to `CHAT_CREATED` as a second signal. Each refresh re-evaluates character bindings, reinjects the sprite prompt, resets stream state, refreshes the manager if open, and reprocesses the visible history window.

Overlay streaming listens to cumulative `STREAM_TOKEN_RECEIVED` text. A sprite changes only when a complete new sprite tag appears. Duplicate cumulative tags do not restart the overlay sequence. Final `MESSAGE_RECEIVED` handling remains authoritative and reconciles the finished response.

The display App distinguishes sprite location from story image markup. `spriteDisplayMode` controls only sprites. `renderInlineImages` is relabeled as parsing `<img>code</img>` story-image tags and receives explanatory help. Sprite opacity applies only to the overlay; inline sprites always render at full opacity.

New-variable output hiding is a presentation option, enabled by default. The raw message remains unchanged so parsing, swipes, editing, exports, and snapshots retain the update block. DOM post-processing hides complete `<UpdateVariable>...</UpdateVariable>` blocks and restores them when disabled.

## Gallery and Resource Operations

Role folding becomes a visual stack. A collapsed role shows the first pack's cover and two offset backing layers with role/count metadata. Expanding replaces the stack with a horizontal, snap-friendly pack row. Only one role is expanded at a time; touch scrolling, mouse-wheel horizontal navigation, and keyboard activation are supported.

Pack deletion offers three outcomes: cancel, remove metadata only, or remove metadata and eligible local files. Only same-origin `/user/images/` paths are eligible. A path referenced by any unselected pack is retained. Remote URLs are never deleted.

Batch mode operates on selected editable packs and adds three commands: upload missing remote copies to imgbb, localize remote-only images into ST storage, and copy one share string per selected pack. Every command reports completed, skipped, and failed counts and leaves failed items retryable. Single-image replace/reupload actions remain visible from both the card workflow and lightbox.

Built-in presets become a remote manifest. The old demo files leave the current tree. Valid supplied i.ibb.co URLs are stored as preset sprites, casual numeric prefixes are removed, and malformed/missing URLs are omitted rather than guessed. Users can localize a remote preset by cloning it into an editable local pack; immutable preset definitions themselves remain reproducible.

## Prompt Compression and Addressing

An unchanged built-in template is treated as built-in behavior, not as a custom-template override. Prompt preview receives the same scene notes and inputs as runtime injection.

For one role with several outfits, the compact renderer emits one role header, one shared image-name pool, and outfit-specific remainders. Suffix variants such as `_变` are represented as an exact suffix-capable base-name list. Outlier outfits keep an explicit list. The full mode remains available.

Relative addressing is scoped to the active pack set. A bare tag resolves against the first enabled pack as the default outfit when cross-pack duplicates exist. A two-part address first preserves the legacy `role/tag` interpretation; if no role matches, it tries `outfit/tag` and requires a unique result. Full `role/outfit/tag` addresses remain canonical and backward compatible.

## Release Boundary and API Scope

`st-distribution/` remains the only generated installation package. No second duplicate directory is introduced. With remote presets, it contains code, CSS, manifest, README, and version probe only and is suitable for extraction into a standalone repository.

API profiles may store their key in plaintext settings. Applying a profile writes that value to the active ST secret slot and then verifies URL, source, model, and connection state. The 1.0 compatibility promise covers common native providers and a generic OpenAI-compatible custom route; niche providers that merely implement the OpenAI schema do not receive duplicated bespoke forms.

## Verification

Each behavior starts with a failing regression test. Every batch runs focused tests, typecheck, and lint. Final verification adds the full Vitest suite, Next production build, deterministic root/distribution builds and hash comparison, mobile Playwright E2E, `git diff --check`, and a clean status review. Real SillyTavern checks remain explicitly open until performed by the maintainer.

