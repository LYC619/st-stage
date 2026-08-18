# Fourth Real-ST Acceptance Fixes Design

**Date:** 2026-08-18

**Target:** Keep product version at `0.9.0`; produce a new cache-busting build for another real SillyTavern acceptance round.

## Evidence And Root Causes

- SillyTavern 1.18.0 runs Regex scripts before Markdown conversion and DOMPurify. Unknown protocol tags can disappear while their inner text remains visible.
- The variable postprocessor currently requires the complete raw message, after removing only two tag names, to equal the visible DOM text. Real replies also contain `thinking`, `summary`, `history`, Renderer tags, comments, and Regex-transformed content, so that equality guard rejects valid update blocks.
- The real failing Renderer message contains two valid wrapped blocks, one `cards` and one `battle`. DOMPurify removes both wrappers. The bare parser intentionally rejects more than one valid object, so neither panel mounts.
- The sampled reference PNG is `Format24bppRgb`; edge pixels have alpha 255. Its checkerboard is baked into the image and cannot be removed with CSS.
- The folded gallery container is a vertical flex list. It also stacks role groups containing only one pack.
- The real Butler state contains an `applied` active transaction with zero actions. That state suppresses the normal apply button and leaves only unclear follow-up controls.

## Message Postprocessing

### Variable Blocks

Raw messages remain the source of protocol boundaries, but full-message equality is removed. For one complete `<UpdateVariable>` block, the postprocessor derives conservative visible payload variants:

1. inner content with wrapper tags removed;
2. content with the entire optional `<Analysis>...</Analysis>` section removed;
3. the same payload with one surrounding Markdown code fence removed.

The postprocessor removes a payload only when one non-empty normalized variant occurs exactly once in the visible message. Duplicate or missing matches preserve the DOM. Snapshots remain the reversible source when the user disables hiding.

### Multiple Renderer Blocks

The parser exposes a plural result in message order. A message may contain up to three valid Renderer blocks; wrapped blocks are preferred when wrappers survive, and validated bare objects are the fallback after DOMPurify strips them. Invalid candidates remain visible and do not prevent valid neighbors from rendering.

The runtime owns a list of mounts per message. It hides and mounts all accepted sources transactionally: a failed factory leaves only that block visible while successful siblings remain mounted. Edit, swipe, setting change, chat navigation, and disposal restore the original snapshot without duplicating panels.

Gal beats with no explicit portrait ask the host for a speaker portrait. The host resolves the first enabled pack whose role matches the speaker and returns its cover image. Explicit `portrait` remains authoritative.

Cards keep the safe existing behavior: selecting a card fills its action into the ST composer but does not send automatically. The control and success text state that the user should review and send it. Generating complete unused branches is outside this acceptance fix because it increases token cost and introduces branch-pruning state.

## Gallery

- A role with one pack renders as a normal card in the shared responsive grid.
- A role with two or more packs renders as a stack with a prominent `N 个图包` badge; expanding it produces a horizontal strip.
- Role groups and standalone packs preserve the materialized settings order.
- `SpritePack` gains `kind: 'sprite' | 'illustration'` and `customTags: string[]`.
- The role filter label is derived from `roleName`; an empty role is shown as `其他` and is not stored redundantly.
- Batch management can set one type for selected packs, add one normalized custom tag, or remove a selected custom tag. Derived role labels are read-only.
- Export, import, migrations, preset overrides, and share strings preserve the new pack metadata.

The legacy `塞拉菲娜·常服（本地）` card in the maintainer's current settings is cloud-only and unbound. It can be deleted manually without deleting hosted files. Automatic cleanup remains strict and will not delete lookalike custom packs.

## Image Transparency

Runtime chroma-key removal is rejected: remote images can taint canvas, and a brightness key can erase white hair, skin highlights, and clothing. This batch adds a clear warning when imported images have no alpha channel or resemble a baked checkerboard. Replacing existing hosted assets requires an offline cleanup and hosting migration, which stays in the dedicated deferred resource task.

## Butler Workflow

The main screen presents a nontechnical sequence:

1. run a six-second check;
2. read the findings;
3. apply the displayed recommendations;
4. test again and restore if the result is worse.

The primary action reads `立即应用 N 项建议` and appears directly after the result summary. Empty or malformed active transactions are discarded during normalization so they cannot hide the action. When no changes are needed, the UI says so and points to extension isolation as the next diagnostic step.

User-facing terms change as follows:

- `6 秒静置` -> `不操作时检查（6 秒）`
- `6 秒受控滚动` -> `滚动长聊天检查（6 秒）`
- `用相同探针复测` -> `再测一次，比较优化前后`
- `完整报告` -> `查看详细结果`
- `扩展排障` -> `临时关闭扩展找卡顿`
- `玩法与服务端顾问` -> `记忆与服务器设置建议`

Extension isolation is promoted into the visible workflow. Its first screen explains: select suspicious third-party extensions, temporarily disable them, refresh ST, repeat the same operation, then keep or restore the result. The advisor explains that it is read-only and separates memory, retrieval, summarization, automation, and server advice into Chinese task-oriented sections.

## Verification

- Test-first regression cases use the exact real message shapes: extra unknown tags plus a sanitized update payload, and one message containing Cards plus Battle.
- Unit tests cover plural parser/runtime lifecycle, speaker portrait fallback, gallery grouping/order/tag migration, batch tag operations, and Butler empty-transaction recovery/copy.
- Existing full Vitest, typecheck, ESLint, Next build, extension build tests, and Playwright suites run before handoff.
- Root and `st-distribution` artifacts are rebuilt twice with one fixed new build stamp and compared byte-for-byte.
- Real SillyTavern behavior remains unverified until the maintainer installs the new build and reruns the acceptance items.
