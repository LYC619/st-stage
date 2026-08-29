---
record_date: 2026-08-30
code_head_at_record: 62d0135
acceptance_round_run_against: d9852e9
build_version: 0.9.0+202608300122
author: claude-code
scope: acceptance-round-one-fixes
---

# Acceptance Round One Fixes

The first real SillyTavern acceptance round executed all 20 checks recorded in
`CURRENT.md` and passed with no blocking defects. It raised five optimisations to
complete before the distribution split, and two further defects were reported
during the same round. All seven items are fixed at build stamp
`0.9.0+202608300122`.

## What The Round Reported

1. Manager panel layout broken — tag-management buttons squeezed into vertical
   single-character columns. A screenshot was referenced but did not reach the
   agent's context; the fix was made from the text description and the visual
   result still needs confirmation on a real screen.
2. Checkerboard cleanup appeared not to work. The reporter suspected the test
   image was already a transparent PNG rather than a baked checkerboard, and
   asked for the logic to be confirmed before assuming a defect.
3. Third-party extension troubleshooting to be replaced by a guide.
4. Cloud export UI: horizontal category row, clearer character/chat hierarchy,
   and no jump to top on selection.
5. Settings panel to show the product version only.
6. A character card must export as a unit with its chats and worldbook.
7. The exported worldbook must be SillyTavern's live copy, because the user may
   edit worldbooks while playing.

## Findings Worth Recording

**The layout defect was not a width problem.** The manager's modals are appended
to `.so-manager-backdrop`, which makes them *siblings* of `.so-manager` rather
than descendants. Every one of the 129 `.so-manager `-prefixed rules therefore
missed them, so the panel had no layout at all — the visible symptom was only the
most obvious consequence. A `white-space: nowrap` rule for these buttons already
existed and had never applied. Rescoping to `.so-manager-backdrop` fixed the
whole panel at once. The vertical text itself comes from CJK `min-content` being
one character wide, because Chinese permits a break between any two characters;
grid `auto` tracks therefore collapse to a single column unless `nowrap` and
`min-width: max-content` prevent it.

**Checkerboard cleanup had no defect.** `core/checkerboard-cleanup.ts` rejects
any image with alpha below 250 at any pixel, so a genuinely transparent PNG can
never pass — the reporter's suspicion was correct. The real problem was that a
single rejection message covered every cause, so a correct refusal read as a
malfunction. The messages are now split by cause, the action button carries the
conditions as a tooltip, and `docs/SPRITE.md` enumerates all four rejection
cases. No detector logic changed.

**The bundle-export defect was in the bridge, not the export path.**
`listCharacters` discarded the card's `data` object, so `data.extensions.world`
never reached the UI. Nothing downstream could have bundled the linked worldbook
because the name was gone before selection began.

**Live worldbook versus snapshot is a data-loss distinction.** A v2 card carries
an embedded `character_book` — a creation-time snapshot — while
`data.extensions.world` holds only the *name* of a linked book that lives at
`worlds/<name>.json`. Exporting the embedded copy would silently discard every
edit made while playing. Export therefore reads the live file through
`/api/worldinfo/get`. Embedded lorebooks and character-scoped regex remain inside
the PNG and are not collected separately.

**A test caught a real wording defect.** The row note initially claimed a linked
worldbook was "not found in the worldbook list" before that list had loaded. The
list is lazily loaded, so "not read yet" is not "not found"; conflating them
accused an existing book of being missing on mount. The note now distinguishes
three states.

**Two stale references surfaced when sweeping for the removed flow.** The
`extension-resource-evidence` diagnosis finding still described the deleted
troubleshooting run and still promised to preserve and restore the user's
disabled list. Its wording now points at SillyTavern's own extension manager and
states that st-stage does not modify that list.

**One assertion had been vacuous.** A guide test asserted the modal did not
contain `开始选定扩展 A/B`. That string was a test-local alias key and never
rendered in the DOM, so the assertion would have passed with the button still
present. It now checks `开始对比所选扩展`, the label that actually rendered. The
paired diagnosis test was rewritten around the invariant that matters — the
finding must claim correlation and never causation — rather than pinning the
deleted flow's vocabulary. Two dead alias entries were removed.

**Scroll restoration had to target an ancestor.** The scrolling element is the
shell's `.so-phone-screen`, which is outside the app container, so recording the
container's own `scrollTop` would always read zero. The position is captured from
the nearest ancestor that both declares `overflow-y: auto|scroll` and actually
overflows, taken immediately before `replaceChildren()` and restored after
refill. `replaceChildren()` collapses content height to zero, which makes the
browser clamp the ancestor's `scrollTop` and never restore it.

## Verification

- Vitest `4.1.10`: 78 files, 948/948 passed.
- TypeScript typecheck: passed.
- ESLint: passed after removing six errors it caught — four dead `experiments.ts`
  imports in `butler-app.ts` and an unused `selected` set in `modals.ts`, all
  left behind by deleting the troubleshooting flow. They were removed, not
  suppressed.
- Next.js `16.2.6` production build: compiled successfully.
- `git diff --check`: passed.
- The nine new `cloud-export` CSS rules were parsed through a real CSSOM to
  confirm none were dropped for invalid syntax; the throwaway checker was then
  deleted. Balanced braces do not prove a selector is valid.
- The scroll-preservation test was mutation-checked: inverting the restore to
  `scrollTop = 0` makes it fail with `expected +0 to be 640`. Without that check
  the test would have passed trivially, because jsdom has no layout and the
  scroll-parent probe finds nothing unless the harness fakes the metrics.
- Root artifacts were rebuilt twice at the fixed stamp `2026-08-30 01:22` and
  remained byte-identical:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `E1D3B0042A6E19FBCAE6E20747D04ACF9CCAC391831292381B8FE985FC11ADAA`
  - `style.css`: `AF026AFAB5DB7AA36290BB622E9E61E7F178240CEFFC72063866B697A3DEE4A1`
  - `version.json`: `8F023298CE821E9B0862EFB96B8ADD404BD7F0187C72DD382564EF8167CF36D9`
- `index.js` is byte-identical to the previous round by design: the stub is
  version-agnostic and only the `bundle.js?v=` parameter it reads changes.

## Not Done Here

- The manager panel's visual result is unconfirmed. No screenshot reached the
  agent, so the fix rests on the reported description plus the traced scope
  escape. Re-check 26 covers it.
- The hardcoded `st-stage` install-directory name is still unfixed in three
  sites and remains in `DEFERRED.md`. It blocks the distribution split, not this
  round.
- `st-extension/src/apps/butler/experiments.ts` stays in place. The guide no
  longer drives most of it, but it still provides the stranded-run recovery path
  and `isSelf`, which is one of the three hardcoded-name sites.
- Dated design and plan documents under `docs/superpowers/` still describe the
  removed troubleshooting flow and the removed "select character and all chats"
  button. They are point-in-time records and were deliberately left unedited.
