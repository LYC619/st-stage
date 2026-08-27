# 2026-08-27 Cloud Export And Butler Review Fixes

## Boundary

- Product version remains `0.9.0`. Build stamp moves from `0.9.0+202608271324` to `0.9.0+202608272259`.
- Reviewed code head: `116103a`. Delivered as three commits: `75991ce` (source fixes), `d9852e9` (line-ending pin, rebuild, stray-directory removal), and the maintenance commit containing this record.
- The review covered `st-extension/src/apps/cloud-export/` in full and `st-extension/src/apps/butler/` in full. Butler source was reviewed but not modified.
- The untracked `pre-release-cargo-target/` directory (STE Rust build cache, 6.88 GB) was added to `.gitignore` and deleted. It was never tracked and no script here referenced it.
- Real SillyTavern and STE integration remain unclaimed manual acceptance items.

## Review Baseline

The verification claims recorded for `116103a` were independently re-run and reproduced before any change: Vitest 78 files / 928 tests passed, TypeScript and ESLint clean. The recorded numbers were accurate.

## Delivered

### settings.json no longer writes empty values

`buildMinimalSettings` returns `string | null` and emits only the sections the user actually selected. Previously any selection wrote `settings.json` carrying `extension_settings.regex: []` and an empty `world_info_settings.world_info.globalSelect`.

An empty array is not "not selected" — an importer reads it as "the selected value is empty". Because the archive is named `default-user-YYYYMMDD-HHmmss.zip` and uses `default-user` root paths, a user unpacking it directly into `data/default-user/` would have cleared their real global regex and world selection. STE's own import path was never affected, since it extracts to a temporary authorized root and reuses the normal scan/selection flow.

Four tests lock the behaviour, including the case where the regex box is checked but SillyTavern exposed no rules.

### Download blob URL released on a delay

The anchor is attached to the document before `click()` and removed after; `URL.revokeObjectURL` is deferred by 60 s instead of running synchronously in `finally`. The previous synchronous release could abort a large archive download before the browser took over the blob.

The delay is injectable through a `schedulers` parameter so the regression test does not fake global timers — faking them deadlocks JSZip's async chunking. The new test was confirmed to fail against the old synchronous implementation before the fix was restored.

### Deselecting a character clears its chats

Both the character checkbox and the invert action now clear that character's selected chats. Previously only the character ID was removed, so the archive could contain `chats/<name>/*.jsonl` with no matching `characters/<avatar>.png` while the counter read "0 characters, N chats". Selecting a chat still auto-adds its character, so the two directions are symmetric.

The helper resolves the character's chats from the loaded chat list rather than parsing the `<character id>:<path>` ID format, so it does not depend on that construction. A chat cannot be selected before its list has loaded, so an unloaded character has nothing to clear.

Confirmed against the old implementation: the counter read `已选 0 个角色、1 段聊天` before the fix.

### Generated artifacts normalized to LF

`build.mjs` gained `normalizeArtifactNewlines()`, applied to `bundle.js` and the concatenated `style.css`.

Root cause of the long-standing permanent ` M style.css`: source CSS is checked out as CRLF under `core.autocrlf=true`, while the concatenation used `\n`, producing a file with 3647 CRLF plus one bare LF. Git normalized it to LF on commit and restored CRLF on checkout, leaving a permanent one-byte difference at the bare-LF position. This also made the recorded SHA-256 unreproducible: re-hashing the worktree copy never matched the recorded value, which undermined the build-determinism evidence and made the protocol's clean-worktree requirement structurally unmeetable.

After the fix `style.css` is 74865 bytes, LF only, byte-identical to the committed blob, and hashes to `D80B3E4E6FF1F34B014746A7E5311B7E3AAF3B36DE1A1C58EA06073CA7E76971` — the value already recorded in the previous history entry. The record was correct all along; the worktree copy was not.

### .gitattributes pins release artifacts

Added with `eol=lf` for the root artifacts and `st-distribution/`. It intentionally scopes to generated files rather than declaring `* text=auto`, which would renormalize every existing file in the repository.

## Verification

- Cloud Export focused Vitest: 5 files / 24 tests passed.
- Full Vitest: 78 files / 937 tests passed.
- TypeScript typecheck: passed. Two errors in the newly written tests were found and fixed first (`build.test.ts` env missing `NODE_ENV`; `manifest.test.ts` passing `string | null` into `JSON.parse`).
- Full ESLint: passed.
- Next.js `16.2.6` production build: compiled successfully.
- `git diff --check`: passed.
- Root and `st-distribution/` rebuilt twice at the fixed stamp and byte-identical. Shared SHA-256:
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `bundle.js`: `BC8EB12700350EFA692525622C2EFE4F7B6BB9E0A24791E455FB612B2B61A363`
  - `style.css`: `D80B3E4E6FF1F34B014746A7E5311B7E3AAF3B36DE1A1C58EA06073CA7E76971`
  - `version.json`: `7D0BF16FC852F72C9C9E0662B6E4F212C8BCEC92DC7B2972D4287FFD6733C457`
- `st-distribution/` still contains exactly its six install files.
- `style.css` no longer appears in `git status` in either location.

### Known flake observed

`st-extension/build.test.ts > makes the artifact diff fail after a source change and rebuild` failed once while the full suite ran concurrently with the Next production build (`environment 883.44s` in that run versus `136.52s` on a clean run). It passed in isolation (18/18) and on a clean full re-run. The test spawns `git` subprocesses and is sensitive to machine load. This is pre-existing sensitivity, not introduced here, and is not treated as a fix target for this batch.

## Deferred From This Review

Five findings were recorded in `DEFERRED.md` rather than fixed. The maintainer chose to fix the character-deselection finding in this batch and hold the rest until after real-ST acceptance.

- Cloud Export: character identity collides when avatar filenames repeat; a failed export leaves in-flight reads running without an `AbortSignal`; the `world_info_settings.world_info.globalSelect` shape is unverified against vendored SillyTavern source.
- Butler: a malformed `activeTransaction` is silently discarded, removing the restore safety net without notice; binary isolation can narrow candidates to empty and run further no-op rounds.

## Real Integration Next

A real-device acceptance checklist was produced for this batch and covers: confirming the settings panel reports `v0.9.0（构建 2026-08-27 22:59）` and that no hard refresh is needed; both directions of the `settings.json` fix; a settings.json overwrite-risk regression requiring a prior backup; a genuinely large export to exercise the download fix, since a small export cannot prove it; the character-deselection fix in both the checkbox and invert paths; worktree cleanliness and hash reproduction; the existing Cloud Export items; observation of the remaining documented unfixed behaviour; and a light Butler apply/restore pass.

Note that the settings panel renders the dashed build time (`2026-08-27 22:59`), not the compact stamp. The compact `202608272259` appears only in `version.json` and the `bundle.js?v=` cache-busting parameter.
