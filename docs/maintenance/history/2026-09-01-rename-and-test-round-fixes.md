---
record_date: 2026-09-01
code_head_at_record: bea201c
build_version: 0.9.0+202609011401
distribution_commit: f852965
recorded_by: claude-code
---

# Product Rename And The First Batch Of Test-Round Fixes

The product became 百工, and six of the eight findings from a maintainer test pass were closed.
Two remain open on purpose: one needs a design decision, one is a larger feature. Two of the
fixes are unverified by any automated test, for reasons that are themselves worth recording.

## The Rename Was Cheap Because Of An Earlier Fix

掌柜的 → 百工 touched `manifest.json`'s `display_name`, one `HOME_TITLE` constant, the settings
drawer and hint, the newvar restore toast, the console load banner, and three READMEs. Nothing
machine-facing moved: the ST prompt slot key `st-stage::<channel>`, the butler
extension-recovery localStorage key, the renderer CSS classes, and `data-st-stage-style` all keep
the repository name, because renaming any of them orphans existing user state.

The phone status bar was a one-line change only because the 2026-08-31 review had already
collapsed two hardcoded literals into a single `HOME_TITLE` constant. That is the concrete payoff
from that round.

The tagline was adapted rather than substituted — 酒馆里的事，百工都做, not 都管, because 百工
does not take 管. This also retires a hazard recorded last round: 掌柜的 ends in 的, so possessive
forms stacked the particle twice and the newvar toast had to be restructured around it. 百工 does
not, so the constraint is gone. The restructured toast was left as it stands since it still reads
well.

## A Release Was Reset Before It Shipped

`3953ec7` (`0.9.0+202608310738`) was committed in the distribution clone on 2026-08-31 but never
pushed, and the rename replaced it a day later. Rather than publish a version that would have
shown the old name for one day, it was reset.

`git ls-remote` confirmed it was not an ancestor of `origin/main` first. That check is the whole
justification: the distribution repository must stay linear because `auto_update` performs a git
update against it, so a reset is only safe on commits that were never public. The published
history therefore goes `5842b24` → `b3650c6` → `f852965`, and stamp `202608310738` exists only in
the development repository.

## The Modal Fix Is Not Proven, And I Could Not Make It Fail

Finding 6 — tapping 查看详细结果 on mobile left only the modal's lower half visible in the upper
screen region, with the ✕ unreachable and no recovery but reloading SillyTavern.

The mechanism is a viewport-unit mismatch. `position: fixed` resolves against the **layout**
viewport, which equals the toolbar-collapsed large viewport; `100vh` is that same large value. The
actually-visible area is the **visual** viewport, smaller whenever the address bar shows. So both
`inset: 0` and `height: 100vh` made the backdrop taller than what the user can see, and
`align-items: center` split the overflow across top and bottom, pushing the head — the only close
affordance — above the visible edge. The backdrop is `fixed`, so there is nothing to scroll.

Note the first fix attempted here was wrong: switching the modal to `height: 100%` of the
backdrop. That changes nothing, because the backdrop is itself sized to the layout viewport. The
unit that tracks the visible area is `dvh`, and the backdrop is now `height: 100dvh` with `100vh`
as the fallback.

**The mutation check failed to fail.** Restoring `height: 100vh` leaves the Playwright suite
green, because headless Chromium has no browser chrome, so `dvh`, `vh`, and `innerHeight` are all
equal under device emulation. This defect cannot be reproduced there. It needs confirming on a
real device.

Two adjacent robustness fixes went in, both real but neither the reported symptom:
`.so-app-modal-head` gets `flex: 0 0 auto` so the sole close affordance can never be compressed
away, and `.so-app-modal-body` gets `min-height: 0`. That second one deserves a note: flex items
default to `min-height: auto` and will not shrink below content, so `overflow-y: auto` never
engaged. Because the box height is fixed, the effect was not an over-tall box but content clipped
by `overflow: hidden` with no way to scroll to it — a different bug wearing the same clothes.

## Why The Suite Let A User-Stranding Bug Through

`e2e/butler.spec.ts` already opened that exact modal at both mobile viewports. It passed for two
independent reasons, and both are now fixed:

- `expectNoOverflowOrOverlap` only checks **horizontal** fit (`scrollWidth` vs `clientWidth`) and
  control overlap. Vertical escape from the viewport was never asserted.
- Playwright's `click()` scrolls its target into view first. A close button parked above the
  viewport top was therefore clicked successfully by the test and unreachable for the user.

New `expectWithinViewport` asserts the modal box and the ✕ are fully visible without scrolling.

While there, the spec turned out to have been **failing since acceptance round one**, which
renamed 临时关闭扩展找卡顿 to the read-only 扩展指南 without updating it. Nothing caught that
because `pnpm test:mobile` is not one of the four release gates. The vitest suite had the correct
label all along.

There is a deeper limitation worth stating: `e2e/` builds a minimal ST DOM and loads only
`st-extension/style.css` and `core/phone-shell.css`. **SillyTavern's own stylesheet is never
loaded**, yet the extension reuses ST's `menu_button` class. Any layout defect caused by ST's own
padding or font-size is structurally invisible to the suite.

## The Gallery Layout Symptom Did Not Reproduce Either

Finding 5's first half — gallery buttons squeezed until unreadable. Every control in
`.so-manager` was measured at 390px and 360px: all carry `white-space: nowrap` with
`width: max-content` and `flex-shrink: 0` from the earlier tag-manager fix, and none clipped or
wrapped.

The automated sweep's two hits were false positives, and the reason is worth keeping: the
`.so-role-pack-stack` layered-card look uses `transform: translate(14px, 14px)` with a matching
`margin-right`, so its `scrollWidth` legitimately exceeds `clientWidth` by exactly 14px. The
detector was rewritten to measure only elements holding their own text, so composite cards no
longer trip it.

What *was* found is a real instance of the same hazard in Butler rather than the gallery:
`.so-butler-actions` was `repeat(2, minmax(0, 1fr))` — tracks collapsible to zero — with buttons
given both `min-width: 0` **and** `white-space: normal`. That is exactly the pair that lets a CJK
label fold to one character per line, since Chinese breaks between any two characters. Now
`repeat(auto-fit, minmax(9em, 1fr))`, so it drops to a single column instead of crushing two.
Whether that is what the maintainer saw is unknown; a screenshot naming the buttons would settle
it in one step.

## Removing The Checkerboard Detector Nearly Deleted A Different Feature

The detector is gone: `core/checkerboard-cleanup.ts`, `cleanCheckerboardImage`,
`cleanAndLocalizeSprite`, the action, and its context method. `analyzeImagePixels` stays and still
reports `opaque-checkerboard`, so the batch-upload warning survives as a diagnostic. Detection
without removal is the right split — the removal path decoded and re-encoded a single-frame PNG,
which would have flattened any animated GIF, and its preconditions were narrow enough that most
images were refused anyway.

The trap: **localizing a preset sprite went through the checkerboard handler.** A preset pack is
read-only, so localization records a same-ID override via `setPresetLocalSprite` — and that call
existed only inside `cleanCheckerboard`. The plain `localize` action commits through
`commitActionPack`, which cannot write a read-only pack. The checkerboard action was also the only
one marked `allowedInReadonly`, so a naive deletion would have left preset image details with no
actions at all and silently dropped a capability the reference-sprite plan depends on. `localize`
now branches on `isPresetPack` and is marked `allowedInReadonly`.

This is the second time in two rounds that removing something safe-looking would have taken a
neighbour with it. Both times the giveaway was a single call site sitting in a handler that had no
obvious relationship to it.

## Two Copy And Parsing Changes

The image-host settings previously labelled the channels 自动直传 and 手动编码通道, which
describes how they work but not that **one uploads your images and the other only resolves someone
else's codes** — most users need exactly one. It now leads with which channel the reader needs, and
gives the reason there are two at all: catbox returns no CORS headers, so a browser cannot upload
to it, which is why it is prefix-only.

按编码添加 now accepts 图名+编号. Worldbook authors commonly name images that way so the model can
identify them; pasting it here used to fail outright, because the input split on whitespace and
required every token to be a valid code. `parseImageCodeEntries` recognises three forms in a fixed
order so nothing is ambiguous: all-tokens-valid means several bare codes (this ordering is what
preserves the documented "spaces separate multiple" behavior, and disabling it fails a
backward-compatibility test); otherwise a valid trailing token is the code and the rest is the
name; otherwise a filename-shaped suffix is split off, handling the run-together
`微笑ab12cd.png`. Unrecognised input is reported verbatim rather than guessed at — a wrong guess
silently creates a sprite pointing at the wrong address.

Side benefit: a supplied name is now the tag. Every code-added sprite used to be named after the
code, and the hint itself told users to rename each one by hand.

## GIF Support Was Already There

Finding 3, answered rather than built. A user-supplied GIF works end to end today: no format
allowlist exists, `compressImage` returns GIFs untouched (`core/image-compress.ts:188`) with the
same guard on the export path, the ST save path derives the extension from the data-URI MIME, and
every display site is a plain `<img src>` with no thumbnail pipeline.

**Built-in preset GIFs are blocked by exactly one line:** `core/presets.test.ts:25` asserts every
preset URL matches `/^https:\/\/i\.ibb\.co\/.+\.webp$/`. The data structure is format-neutral and
the build ships no image bytes, so a `.gif` preset URL would work at runtime.

Caveat now moot: the checkerboard detector was the one path that would have flattened a GIF, and
it is gone.

## next-env.d.ts Has A Third Way To Flip

Already recorded as flipping between `next dev` and `next build`. New: **`pnpm test:mobile` flips
it too**, because Playwright's `webServer` runs `next dev` on port 3101. This actually happened —
`c07f1c1` committed the dev variant because the Playwright run came after the build. Corrected in
`bea201c`. If the E2E suite runs at all, re-run `pnpm build` before committing.

## Not Done

- **Finding 1, per-pack custom 清单提示词.** One design decision blocks it. The 清单 is grouped by
  scene, not by pack, and two packs can contribute to the same scene — so per-pack replacement text
  can describe one scene twice in two voices, giving the model contradictory instructions. Details
  and a recommendation are in `CURRENT.md`.
- **Finding 2, approximate matching**, and **finding 7, floating variable viewer.** Both are
  features needing design work, and finding 2 is explicitly framed by the maintainer as needing
  several test rounds.
- Groundwork for more image-host channels was deliberately not built; the host still has to be
  chosen, and channel ② already accepts any `https://` prefix.
