---
record_date: 2026-08-31
code_head_at_record: 1d8d901
build_version: 0.9.0+202608310738
distribution_commit: 3953ec7
recorded_by: claude-code
---

# Pre-Release Review

A whole-repository review run immediately before release: all four gates, the artifact trees,
the six-file distribution boundary, the manifest fields, user-visible Chinese copy, dead code,
the README, and every maintenance document. Five source defects and one false README claim were
found, all small, and all fixed here. Two of the maintenance documents were materially out of date.

## Gates

| Gate | Result |
| --- | --- |
| Vitest `4.1.10` | 80 files, 970/970 |
| `tsc --noEmit` | pass |
| ESLint | pass, zero violations |
| Next.js `16.2.6` production build | compiled successfully |
| `git diff --check` | pass |

The test count went from 969 to 970: one test was added, for the phone status bar.

## ESLint Needs The Raised Heap Too, And Its Failure Looks Like A Build Failure

`CURRENT.md` recorded that the full Vitest run needs `NODE_OPTIONS=--max-old-space-size=6144`
on this machine. ESLint does too, and that was not recorded anywhere.

At the default heap `pnpm lint` does not report violations — it dies with
`Fatal process out of memory: Zone` and a bare native stack trace, exit code `2147483651`.
Run in the same shell afterwards, `pnpm build` then failed too, resolving `lightningcss`'s
native binding, which sent this review down a false path: the binding is present, the pnpm
junction into `lightningcss@1.31.1/node_modules` is intact, and requiring it directly works.
The build failure was collateral from the OOM'd process, not a defect. With the heap raised,
both pass cleanly and repeatably.

Worth recording because the failure mode is actively misleading. A lint OOM presents as a
crash with no rule names, and the build failure it induces points at a dependency rather than
at memory. Anyone who hits either and starts debugging `lightningcss` is chasing the wrong thing.

## The Self-Protection Notice Named The Wrong Directory

This is the one finding that would have failed a real acceptance check rather than merely
reading oddly.

`butler/modals.ts` opened the third-party extension guide's self-protection card with the
literal `这是 st-stage 自己。…`. The install directory is `st-stage-ext`. Re-check 29 exists
specifically to confirm that the extension names `st-stage-ext` and not `st-stage` in that
guide, so on a real install the card would have contradicted both the acceptance criterion and
the disable refusal rendered beside it, which already interpolated the runtime name. Two
strings on one screen, disagreeing about what the extension is called.

`butler/experiments.ts` held a second literal in `prepareExtensionExperiment`'s rejection
error. Both now interpolate `SELF_DIRECTORY_NAME`, which is what `bridge.ts` and the rest of
`experiments.ts` already did.

The `DEFERRED.md` entry for this defect claimed the fix had swept up "two additional literals"
beyond the three original sites. That count was short, and the reason is instructive: those
sweeps searched for the *disable* wording, `管家不能禁用`. Neither of these two sites phrases
it that way — one is a descriptive notice, the other an experiment rejection. Searching instead
for the literal `st-stage` inside string literals finds all of them regardless of phrasing.

The invariant that search establishes is narrower than "no `st-stage` anywhere", and stating it
loosely would mislead the next auditor, because the search still returns about twenty hits in
non-test source. All of them are correct:

- **Console prefixes** — `[st-stage]` in `console.warn`/`error` across `api-app.ts`, `mvu-app.ts`,
  `butler/bridge.ts`, `newvar/designer.ts`, `newvar/runtime.ts`, and `build.mjs`, plus the
  deliberate load banner in `index.ts`. Developer-facing; the repository name is the useful thing
  to grep for in a console.
- **Machine identifiers** — the renderer's CSS classes (`st-stage-renderer` and siblings), the
  `data-st-stage-style` attribute, and the selector in `story-image-capture.ts`.
- **Two live state keys that must not be renamed** — the ST prompt slot key
  `st-stage::<channel>` in `st-adapter.ts`, and `st-stage:butler:extension-recovery:v1` in
  `experiments.ts`. Changing either would orphan existing user state: a stale injected prompt
  under the old slot key, and an unreachable stranded-run recovery record.
- **`FALLBACK_DIRECTORY_NAME` and the `build.mjs` stub fallback**, both already recorded as
  deliberate.

So the invariant is: no `st-stage` in **user-visible copy**. That is what this round established,
and the check to repeat is the literal search filtered to strings that reach the UI.

## The Product Name Versus The Repository Name

The same search found three more places where the repository name reached a user, none of them
load-bearing but all of them inconsistent with every other surface:

- `core/phone-shell.ts` set the Home-screen status bar to the literal `st-stage` at two sites.
  It is now one `HOME_TITLE` constant holding `掌柜的`. When an App is open the bar shows the
  App's name, so this string is what the user sees on the Home screen itself.
- The settings panel's 显示手机 tooltip called the phone `st-stage 各功能的统一入口`, directly
  below a drawer header reading 掌柜的.
- Two `newvar-app.ts` strings — the restore toast and the hide-setting tooltip — used
  `st-stage` where they were distinguishing this extension from SillyTavern Regex.

The `newvar` toast was restructured rather than substituted. `掌柜的` ends in `的`, so the
direct replacement produced `掌柜的隐藏的变量更新记录`, stacking the particle twice. The toast
now reads `变量更新记录已恢复（此前由掌柜的隐藏）`, and the tooltip uses `本扩展`, which sidesteps
the possessive entirely. This is a general hazard with this product name and will recur.

The status-bar fix carries a test asserting the title on Home, the App name when one is open,
and that the status bar contains no `st-stage` anywhere. It was mutation-checked: restoring the
old literal fails it.

## The README Contradicted The Build Script

Checking the install section turned up a claim that had gone false rather than merely stale: the
two-repository callout told users that the install directory name must equal the repository name
and that `改名会导致资源加载失败` — renaming breaks resource loading.

Nothing about that is true after the runtime self-identification change. `index.js` recovers its
base URL from `Error().stack`, and `bundle.js` derives its own identity from `import.meta.url`,
so a renamed directory both loads and protects itself. The hardcoded literal that survives in
`build.mjs` is a last-resort fallback, and the comment sitting beside it says outright that it
`不影响改名后的加载`. The README was therefore contradicting the build script it describes.

Rewritten to say what is actually load-bearing: `st-stage-ext` is the default because ST names
the directory after the repository, and renaming is pointless rather than fatal. Worth noting as
a class of defect — the runtime-derivation change made a documented constraint obsolete, and
prose describing an old invariant does not fail any gate.

## Three Dead Symbols

Found by scanning every exported symbol against every import clause in the repository, then
filtering to value exports that also appear only once inside their own declaring file:

- `getAvailableTags` (`core/sprite-store.ts`)
- `extractLastTag` (`core/tag-parser.ts`)
- `readHealth` and its `PerfHealth` interface (`butler/bridge.ts`)

None had a caller anywhere, tests included. `readHealth` described itself as a "compatibility
wrapper for the pre-Task-8 UI"; the live service of the same name resolves to `readHealthState`,
which is why the name still appears in five places after the removal. `PerfHealth` existed only
to type the wrapper.

Removing `extractLastTag` left the `tag-parser.ts` module comment advertising
`多个标签取最后一个`, which had described only that function. Corrected to state that all tags
are kept in order, which is what the surviving `extractTags` does.

Everything else the scan surfaced was a false positive worth naming so the next audit does not
re-litigate it: `Deps` and result-type interfaces exported for structural typing, and
`metadata`/`viewport` in `app/layout.tsx`, which Next.js consumes by convention rather than by
import.

## Copy Audit

2,046 Chinese-bearing string literals across 100 non-test source files were scanned for
mechanical defects — duplicated characters and punctuation, half-width punctuation between
Chinese characters, unclosed CJK brackets, mixed bracket pairs, irregular whitespace, and NUL
residue. Every hit outside the name issues above was a false positive:

- 37 were dot-notation variable paths (`时间.日期`, `角色.<名>.好感度`), which is the documented
  path syntax for the variable apps, not prose.
- 5 were the scan reading the `)` of a call inside a `${…}` interpolation as a half-width
  closing bracket.
- 1 was a deliberate ideographic space used as a full-width separator in the gallery list.
- 1 was `！！` in the web simulator's sample dialogue, which is intentional.

No typos were found in the copy itself.

## Two Documents Were Out Of Date

`CURRENT.md` still described two pushes as outstanding and named `bf58bd8` as the remote head.
Both pushes had landed: `st-stage` was pushed to `edb5643` at 01:08 on 2026-08-31, and
`st-stage-ext`'s `origin/main` is at `5842b24`, both confirmed against the actual refs rather
than inferred. Reading `git ls-remote` for `st-stage` fails on credentials, so the reflog was
used for that side; the distribution repository is public and answered directly.

Two claims inside the retained evidence had gone stale as a consequence — that the three-way
hash identity "becomes true of the published repository when `01112ac` is pushed", and that the
published repository holds one commit. Both corrected in place rather than deleted, since the
evidence they support is still what was verified at that stamp.

`DEFERRED.md` needed no removals. All six entries with specific code locations were checked
against source and all six still describe real state: `avatar || name` character identity, the
absent `AbortSignal` in `export-loader.ts`, `findLinkedWorldbook`'s case-insensitive
first-match, `activeTransaction` normalization, `advanceBinaryIsolation` reachable only from
tests, and `coverTag` still absent from `encodeShareStringV2`.

Two clauses inside otherwise-valid entries had gone stale, both from the same cause — the
runtime self-identification change outdating prose written before it. The resolved
install-directory entry undercounted the literals its own fix swept up. And the binary-isolation
entry justified keeping `experiments.ts` by calling `isSelf` "one of the three hardcoded
install-directory-name sites", which `a164acb` had already made false: `isSelf` delegates to
`isSelfExtensionName` and hardcodes nothing. Both corrected in place; neither entry's underlying
defect changed.

## next-env.d.ts Flips Between Dev And Production

`next-env.d.ts` is generated and tracked, and Next.js 16 rewrites its import depending on which
command ran last — `./.next/dev/types/routes.d.ts` after `next dev`,
`./.next/types/routes.d.ts` after `next build`. It has already flipped once in history:
`e113f95` committed the production form, `2c61953` committed the dev form.

Since `pnpm build` is one of the release gates, the dev form guarantees a dirty worktree at
exactly the point `PROTOCOL.md` requires a clean one. Committed here at the production form,
which is the state the gates themselves produce. This is the same class of problem as the
`style.css` mixed-line-ending issue fixed earlier: a tracked generated file whose bytes depend
on how it was last produced.

## Artifacts

Rebuilt at stamp `0.9.0+202608310738`, committed as `1d8d901`, and copied to the distribution
clone as `3953ec7`.

Reproducibility was verified before the source edits, against the stamp already published:
both trees were rebuilt at the fixed stamp `202608302113` and all six files came back
byte-identical to the published copies. That is the check worth having — it proves a later
auditor can reproduce a recorded hash from a clean checkout.

Only `bundle.js` and `version.json` moved against the published `202608302113` copies.
`manifest.json`, `index.js`, and `style.css` are byte-identical, which is the expected shape for
a round that changed TypeScript and touched no CSS and no manifest field.

The five functional files hash identically across the development root, `st-distribution/`, and
the `st-stage-ext` clone; the distribution-only `README.md` matches between `st-distribution/`
and the clone. The root `README.md` is the development repository's own and is deliberately not
part of that comparison — a scan that includes it reports a spurious mismatch. Zero CRLF pairs
in all six copied files. `st-distribution/` holds exactly six files at 903,549 bytes. Hashes are
recorded in `CURRENT.md`.

`manifest.json` was checked field by field rather than as a whole: `display_name` `掌柜的`,
`version` `0.9.0`, `homePage` `https://github.com/LYC619/st-stage-ext`, `auto_update: true`, and
`js`/`css` naming the two files SillyTavern loads. Identical across all three trees.

## Not Changed

- Product version stays `0.9.0`. The decision is still the maintainer's and still deferred until
  acceptance closes.
- 25 symbols are exported but only used inside their own file. That is a style matter, esbuild
  drops them from the bundle regardless, and churning them immediately before a release trades
  no benefit for diff noise.
- The `st-distribution/` directory and the clone were not cleared before copying. The clone's
  `.gitattributes` is its own and has no upstream copy to restore it from.
