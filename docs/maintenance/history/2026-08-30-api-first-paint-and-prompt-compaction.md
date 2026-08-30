---
record_date: 2026-08-30
code_head_at_record: ffdb5ca
build_version: 0.9.0+202608302113
distribution_commit: 01112ac
recorded_by: claude-code
---

# API First Paint, Prompt Compaction, README Corrections

The first real-ST session after the distribution repository went live raised four items. Two were defects and are fixed; two were questions answered without code changes. A README sweep and the release copy to the distribution repository followed.

## What Happened

| Commit | Change |
| --- | --- |
| `8a5bb3e` | The API app no longer waits on a secret lookup to paint its first frame |
| `cfa7f48` | The sprite prompt states the range rule once instead of per entry; artifacts rebuilt at `202608302113` |
| `ffdb5ca` | README install section leads with the address; two shipped Apps added to the inventory |

The artifacts were then copied to the distribution repository and committed there as `01112ac` and `5842b24`; see "The Release Copy Is Not A Maintainer-Only Step" below. Both pushes are still outstanding.

## The API App Was Waiting On A Key It Never Used

The report was that every app opened instantly except API configuration. That framing was accurate and the cause was structural rather than a matter of degree.

`mount` began with `await readConnection()`, and `readConnection` unconditionally issued `POST /api/secrets/find`. The profile list is built entirely from local settings, so nothing on that first frame needed the network — but the whole render sat behind the round trip anyway. Worse, the key that request returns was never read by the app; only `fetchModelsTransaction` needs it, and only so it can restore the original value afterwards.

Two fixes, one structural and one arithmetic:

- `readConnection` takes `withSecret`. The three call sites that only display connection state pass `false`: first paint, the manager's active-row highlight, and the `waitForConnection` re-verification poll. `fetchModelsTransaction` keeps reading it.
- The app paints synchronously and fills connection state in afterwards, which is what `butler-app` and `mvu-app` already did. `render` became synchronous and gained a "正在读取当前连接…" state for the gap.

The poll was the compounding waste: `waitForConnection` re-reads every 120 ms for up to 8 s, so a single profile switch was firing up to 66 secret requests that nothing consumed. The regression test asserts zero `find` calls against exactly one `write` across a full apply — it fails if the skip regresses, which a test asserting only the happy path would not.

## The Prompt Repeated Itself Once Per Range

Two constructs in the injected prompt both grew linearly with pack size while conveying the same rule. Every numbered range carried a parenthetical "输出时从X至Y中随机选择一个完整图名", and then the complete set of range labels was listed a second time as a prohibition. On a 271-image pack that was most of the 2327 characters.

The rule is now stated once, followed by a correct/incorrect pair drawn from the pack's own tags — constant cost, and clearer than an abstract instruction. Two supporting changes:

- Range labels went from `prefix1-3` to `prefix(1-3)`. The parentheses separate "put a number here" from the image name, so replacing them with an integer mechanically yields a real name. The prefix keeps its own separator (`horse_(1-2)`), because the prefix is defined as whatever precedes the digits and is not guaranteed to be `_`. This diverges from the format the reporter sketched, deliberately: dropping the separator would make substitution unsafe for any pack that does not use underscores.
- The compaction threshold dropped from 3 to 2. Two-number runs save few characters, but a mixed list forces the model to switch between "copy this name verbatim" and "fill in a number"; one format throughout is the point.

Measured on the real pack: 2327 → 856 characters, with all 35 groups compressed.

## Two Answers Without Code

**Pack ordering is data.** The reporter asked for the cover image first and lighter categories earlier, framed as a build-time concern. But `buildScenes` preserves first-appearance order and there is no sort anywhere in the path, so both the prompt list and the gallery wall follow the share string's segment order. Reordering the share string is the whole fix; no code change exists to make.

The reorder itself was done as a data operation on the reporter's own git-ignored `reference/` copy, then verified through the real decoder rather than by inspection: `decodeShareString` returns 271 sprites, the segment multiset is identical to the original, every group prefix resolved against the intensity table with none unranked, and the cover sorts first.

**`coverTag` does not survive a share string.** Found while answering the above. The field exists in `core/types.ts` and `getPackCover` gives it priority over array order, but `encodeShareStringV2` emits only `@author`, `@kind`, `@tags`, and `@host`. Every imported pack therefore falls back to its first sprite for a cover, which is why ordering currently has to double as cover selection. Adding `@cover=` is small and neutral; it was left for a later round because it was outside the request.

**A numbered-tag glossary was declined.** The reporter offered a 35-entry mapping and asked whether it should go into a pack's notes, noting they had already confirmed numbers alone generate correctly. Notes flow into every injection, so this would have been a per-pack constant cost that undoes the compaction above, in exchange for something already verified unnecessary.

## README Was Missing Two Shipped Apps

Sweeping the README against recent commits turned up a documentation gap unrelated to this round's fixes: `rendererApp` (order 7) and `cloudExportApp` (order 15) are both registered in `st-extension/src/apps/index.ts` and both shipped, but neither appeared in the App table, and the directory tree listed neither `renderer/` nor `cloud-export/`. The Renderer even had its own usage section further down the file, so the table was the only thing out of date. The API icon was also wrong — `🔌` in the README against `📡` in source.

The install section was reordered for a different reason. The address was buried in step 3 with the two-repository explanation trailing after step 4, but installing the source repository is the most common failure mode and it fails confusingly: ST clones tens of megabytes and then finds no extension entry point. The address now leads the section and the two repositories are contrasted in a table.

## The Release Copy Is Not A Maintainer-Only Step

The release loop had bundled "copy the six files into the clone, commit, and push" into one step, and because the push needs credentials no agent session can supply, the copy kept getting deferred with it. The two have different requirements: copying between two local clones is reversible and needs no credentials at all. The loop now separates them, and the copy for this stamp was done in-session under standing authorization.

Six files went into `D:\8.Project\0_0_维护\st-stage-ext`, committed as `01112ac` — `release: 0.9.0+202608302113`, built from `cfa7f48`. Git reported exactly three modified files, `bundle.js`, `version.json`, and `README.md`, which independently confirmed the three-files-behind assessment recorded before the copy: the other three artifacts were already byte-identical to what was published.

Two guardrails matter here and are now written into the loop. The clone's root must keep exactly seven entries — the six artifacts plus its own `.gitattributes`, which is not generated and does not come from `st-distribution/` — so the copy must never clear the directory first. And `reference/` must never travel: it holds private chat logs and is git-ignored in the development repository.

Committing surfaced a second finding. Git warned that `README.md`'s LF endings would be replaced by CRLF next time it touched the file, because `.gitattributes` pinned `*.js`, `*.css`, and `*.json` but not `*.md`. The recorded hashes are only reproducible on LF, so on a fresh Windows clone the release loop's own verification step would have reported a mismatch against a file nobody had edited. `5842b24` adds the missing line; `git add --renormalize .` confirmed no artifact content actually needed rewriting and the README hash stayed `F32B5F76084D33B9`.

Both pushes remain outstanding and are a maintainer action. `st-stage` should go first: `01112ac` names `cfa7f48` as its source, and that reference dangles for anyone auditing the published bytes until the development history is public.

## Verification

- Vitest `4.1.10`: 80 files, 969/969 passed. The full run requires `NODE_OPTIONS=--max-old-space-size=6144` on this machine; the default heap aborts with a V8 OOM (exit 134) partway through. That is an environment limit, not a test failure — per-file runs are unaffected.
- TypeScript, full ESLint, Next.js `16.2.6` production build, `git diff --check`: all passed.
- Five new tests, all mutation-checked.
- Root and `st-distribution/` hash-identically across all five functional files. `manifest.json`, `index.js`, and `style.css` are byte-unchanged from the previous round; only `bundle.js` and `version.json` moved.
- After the copy, three-way identity holds across the root, `st-distribution/`, and the `st-stage-ext` working tree at `01112ac`, plus the distribution-only `README.md` at `F32B5F76084D33B9`. Every copied file was checked for CRLF pairs and returned zero. This is true of the committed clone; it becomes true of the published repository when `01112ac` is pushed.
- `next-env.d.ts` churned during `next build` again — the known flip-flop between `./.next/dev/types/routes.d.ts` and `./.next/types/routes.d.ts` — and was restored rather than committed, as in prior rounds.

## Notes For Next Time

ESLint's `no-irregular-whitespace` exempts plain strings but not template literals, so the ideographic space separating the correct/incorrect example passed review in the test file and failed in the source. It is now a named constant. Worth knowing before reaching for full-width punctuation inside a template literal.

The earlier prohibition on round-tripping CJK source through PowerShell text pipelines held again this round: `Get-Content` without an explicit encoding read UTF-8 as ANSI when inspecting generated prompt output, producing mojibake that looked like a build defect. Read such files with the file tools instead.

A recorded hash is only a verification tool if the file is reproducible, and on Windows that means every extension carrying a recorded hash needs an `eol=lf` line in `.gitattributes`. `*.md` was missing one for as long as the distribution repository has existed. Nothing had broken yet only because no Windows machine had re-checked out that README.

When a checklist step bundles two actions with different prerequisites, the one needing more access silently gates the one needing less. "Copy and push" read as a single credentialed step for several rounds, which is why the published artifacts drifted three files behind while the copy itself was always available to do.
