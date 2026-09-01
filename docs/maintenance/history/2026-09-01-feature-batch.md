---
record_date: 2026-09-01
code_head_at_record: 9e038dc
build_version: 0.9.0+202609012048
distribution_commit: 7c364a1
recorded_by: claude-code
---

# The Last Three Findings, And What Testing One Of Them Revealed

Findings 1, 2, and 7 closed, which empties the test-round list. Two of the three ship default off.
The interesting part of this batch is not any of the three features — it is that building finding 2
turned up an existing behavior that changes what finding 2 is for.

## Finding 2 Already Half-Worked, By Accident

The request: for a thousand-image pack, describe the set loosely and let approximate matching resolve
【丽丽穿着连衣裙和XX逛街】 to the 连衣裙 plus 逛街 sprite.

Building it, I wrote a test asserting that address resolved to nothing before the feature. **It
already resolved.** `matchUniqueTagInPool` has a fuzzy tier that does bidirectional substring
matching on single-segment addresses and takes the **first** hit in pack order. So the exact example
in the finding was never broken — it was silently picking whichever 逛街 sprite happened to come
first, which is not the same as picking the best one, and is invisible to the user either way.

This matters for two reasons. Approximate matching runs **only where strict resolution returned
null**, so it cannot improve that example at all; strict wins first. And if a future test round
reports "approximate matching picked the wrong sprite" for a description like that one, the culprit
is the pre-existing fuzzy tier, not the new feature. `core/approx-match.test.ts` pins both facts in
adjacent tests so the attribution cannot get lost.

What the feature actually adds is the case the single-segment strict path never inspects: a
description naming a **role or outfit** rather than a tag.

## Two Refusals That Make "Enabled" Safe

Scoring is deliberately dull — which address terms appear in the text, terms ≥2 characters weighted
double, threshold 2. So one multi-character hit, or two single-character hits, never a lone single
character. A one-character CJK term matching by coincidence is the failure mode worth designing
against, since Chinese has no word boundaries to lean on.

**Ties return nothing.** Equal top scores refuse rather than pick the first, which is the opposite of
what the fuzzy tier does. The reasoning: a wrong sprite reads as a bug in the user's own address and
sends them hunting through their pack, while a missing sprite reads as a missing image. The cheaper
failure is the honest one.

Tokenization, edit distance, and synonym lists were all left out. Each needs a dictionary or a
heuristic, and every one of them raises recall by widening the set of things that can be wrong.

Both resolution sites — the overlay in `index.ts`, in-floor rendering in `message-postprocess.ts` —
go through one shared `resolveWithApprox`. Two call sites resolving the same tag differently would be
a bug no test would think to look for.

## Finding 1 Was Decided Against The Recommendation, Correctly

The design question recorded last round: when a pack with custom inventory text shares a scene with
another pack, does the text replace the whole scene line, replace only its own sprites, or get
refused? I recommended (c), refuse — the only option that cannot emit a contradictory prompt.

The maintainer chose (b), stack. The reasoning holds up better than my recommendation did: the
feature exists for large-pack authors who write their own inventory text, and such a pack is rarely
enabled next to another. (c) protects against a configuration the target user does not create, at the
cost of refusing input in the case they do.

Threading it took more care than the field suggests. The custom text had to reach **all three** list
formats — `buildGroupedFull`, `buildShared`, `buildRoleCompact` — plus the `{清单}` placeholder,
because the builder picks a format by comparing output lengths. Wire it into two of three and the
setting silently stops working whenever a pack is large enough that the third format wins, which
would present as "my inventory prompt works on small packs only."

`buildPromptSceneInventories` keys text to the same effective addresses `buildPromptSceneNotes`
already uses, so a pack contributing nothing to the final address table injects nothing.

**Known limitation, now worse than it would have been under (c):** `fitToBudget` enforces
`promptBudget` by trimming tags per scene, and literal user text cannot be trimmed that way. Custom
text is effectively exempt. Under (c) it would have replaced list content; under (b) it adds to it,
so long prose across many scenes can push injection past a configured budget. Not addressed — it
needs a measurement against a real large pack first.

## The HUD Sits On A Layer That Already Existed

Finding 7 wanted a floating variable viewer for both variable apps. The right mount point was already
there: `setup(host)` runs for resident modules with an `AppHost` that has no `updateSettings`, which
is exactly the shape a persistent HUD needs — it runs while the phone is closed and cannot rewrite
core settings out from under an unattended user.

Split so the logic is testable without a DOM: `core/variable-hud.ts` flattens a nested tree into rows
(depth cap 3, deeper subtrees collapsed to one-line JSON, values clipped at 80 characters, MVU's
`[值,"描述"]` tuples recognised with the description surfaced as a tooltip), 15 unit tests.
`st-extension/src/variable-hud.ts` owns drag, clamping, and rendering.

Three details worth keeping:

- Drag reuses the overlay's existing convention — under 4px is a tap, and `pointercancel` is handled,
  so a system gesture arriving mid-drag does not land as a tap on whatever is underneath.
- Position is clamped into the viewport on every move **and on resize**. A HUD dragged off-screen has
  no recovery path short of clearing settings, and rotating a phone is enough to strand one.
- Async reads carry a token and late results are discarded. Collapsing the panel while a read is in
  flight would otherwise paint into a closed container.

Persistence goes through `saveSettingsOnly`, not the normal settings path, so moving the window does
not trigger a sprite re-render.

**MVU's app needed restructuring first.** It handed its entire container to `createVariableTreeView`,
which does `container.textContent = ''` on every render — any sibling toggle would have been wiped on
the next variable update. Now a wrapper holds the toggle and the tree in separate boxes. The newvar
app needed no such change, which is why the toggle went in easily there and not here.

## Finding 3's One Blocking Line Is Gone

`core/presets.test.ts` asserted every preset URL ends in `.webp`. It now accepts
`webp|gif|png|jpg|jpeg` while keeping the invariant that actually matters: remote HTTPS `i.ibb.co`
direct links, so the build ships no image bytes. No runtime change — the data structure was already
format-neutral, which is what last round's investigation established.

## Byte Figures Went The Other Way

The six-file set grew 900,088 → 922,014 bytes, 21,926 more: `style.css` gained 2,781 for the HUD's
rules and `bundle.js` the rest. Last round shrank because the checkerboard removal outweighed what
the rename added; this round added three features and removed nothing, so growth is the expected
direction. `manifest.json`, `index.js`, and `README.md` are byte-identical to the previous stamp.

Four byte figures in the previous round's records were stale and were corrected in `658ce7c` before
this batch went in. The hashes were all correct; only the sizes had drifted, which is the failure
mode of recording a number by hand next to one that a tool produced.

## Gates

Vitest 81 files / 1013 tests (up 43 over 970, two new files), tsc 0, ESLint 0, Next build 0,
`git diff --check` 0. Both raised-heap requirements still apply. `pnpm test:mobile` was not re-run for
this batch — it touches no existing mobile surface, and running it would flip `next-env.d.ts` back to
its dev variant, which is the trap recorded last round.

## Not Done

- **`promptBudget` versus custom inventory text.** Described above; needs a real large pack to size.
- **Approximate matching is untuned.** Default off, threshold deliberately strict, low recall on
  purpose. Do not loosen it without a concrete miss to point at.
- The HUD's touch behavior, like finding 6's modal fix, is not something this harness can confirm.
