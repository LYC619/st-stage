---
record_date: 2026-08-30
code_head_at_record: a164acb
build_version: 0.9.0+202608300440
author: claude-code
scope: runtime-self-identification
---

# Runtime Self-Identification

Removes the hardcoded `st-stage` install-directory name, which was the one code
prerequisite blocking the distribution split. The extension now recognizes itself
under any directory name.

## Why It Mattered

SillyTavern's extension install directory name equals the repository name. Butler
compared that name against the literal `st-stage` to decide "this is me", and that
decision backs a safety guarantee: Butler must not offer to disable itself. Under
any other directory name the comparison silently failed, so a user could disable
Butler through Butler and then need to re-enable it without the tool that
disabled it.

This was already reachable before the split — renaming an extension directory by
hand is permitted — but the split would have made it the default.

## Approach

`st-extension/src/apps/butler/self-identity.ts` derives the directory name at
runtime from the bundle's own `import.meta.url`. `bundle.js` is a single ESM file,
so at load time that URL is
`…/scripts/extensions/third-party/<directory>/bundle.js?v=<stamp>`; the
second-to-last path segment is the install directory.

Chosen over having the loader stub publish its resolved base path to a global.
The stub already resolves its own base URL from `Error().stack`, so that value was
available, but reusing it would couple identity to the stub's byte-stable
contract and to a global. `import.meta.url` needs no coordination and cannot
drift from where the code actually loaded from.

## Findings

**Anchoring to the ST layout was necessary, not defensive.** Reading only "the
second-to-last segment" made the tests fail: under vitest `import.meta.url` is the
test file's own path, so the derivation returned `butler`. That is worse than
failing — it is a plausible wrong value that would silently attach the protection
to a non-existent extension. Derivation now requires the parent segment to be
`third-party` or `extensions` and otherwise falls back. The failure mode is
closed: an unrecognised layout yields the old literal rather than a guess.

**Two more literals existed than the deferred entry recorded.** It listed three
sites. The user-facing message `管家不能禁用 st-stage 自身` was hardcoded in both
`bridge.ts` and `experiments.ts`, so a renamed install would have refused
correctly but named the wrong directory in the refusal. Both now interpolate the
runtime name.

**One regression test was vacuous on first write.** The test asserting that a
renamed install no longer protects the old literal passed against deliberately
broken code. Its fake's `findExtension` did not know `third-party/st-stage`, so
the call returned `not-found` and never reached the self-check. Fixed by giving
the fake that name and additionally asserting the disable call goes through.
Confirmed by mutation: restoring the old literal now fails both rename tests.

**The artifact was verified, not just the source.** esbuild could have rewritten
or inlined `import.meta.url`. It preserves it verbatim — confirmed at
`bundle.js:10696` — and the shipped derivation was exercised against renamed
directories, non-default ports, and mixed-case names.

**`st-distribution/` was stale from the previous round.** The round-one commit
refreshed the root artifacts but never re-ran the distribution build, leaving
`st-distribution/style.css` 159 lines behind — missing the entire cloud-export
stylesheet. Both trees are now regenerated at one stamp and verified pairwise
hash-identical. A distribution release copied from that directory would have
shipped without the round-one UI fixes. The pairwise hash comparison is now
written into the release steps.

## Verification

- Vitest `4.1.10`: 80 files, 964/964 passed. 16 new tests across
  `self-identity.test.ts` and `self-identity-rename.test.ts`.
- TypeScript typecheck, full ESLint, Next.js `16.2.6` production build,
  `git diff --check`: all passed.
- Root and `st-distribution/` rebuilt twice at the fixed stamp
  `2026-08-30 04:40`, byte-identical across runs and pairwise between trees:
  - `index.js`: `27DB248504A6EE1FEC948C3C6135F93732C0B075A0803317B82C972BCFCF457D`
  - `bundle.js`: `53D8F17E31139E96D067F4F9FD4CCEEA41F7772B05B7D0383CE5B71EDB518AA1`
  - `style.css`: `AF026AFAB5DB7AA36290BB622E9E61E7F178240CEFFC72063866B697A3DEE4A1`
  - `version.json`: `AFA694C29B3BB490787A635A5C9B220A50CF90010F629C6DB34B96EE16547B11`
- `index.js` changed this round after several rounds of byte stability. The diff
  is three comment lines in the stub's fallback branch, inspected directly in the
  artifact diff; no executable change. Stability resumes from here.

## Not Done Here

- No GitHub repository was created and nothing was pushed to any new remote. The
  creation steps are written into `CURRENT.md` under "Distribution Repository
  Creation" for the maintainer to execute.
- `manifest.json` still has `homePage` pointing at the development repository.
  Changing it is step 2 of the creation sequence and was left to the maintainer
  because it is product-facing and belongs with the repository decision.
- The semantic version was not touched, by instruction. `manifest.json` remains
  `0.9.0`.
- The stub's last-resort fallback in `build.mjs` still contains the literal
  `st-stage`. It is only reached when stack parsing fails and identity no longer
  depends on it; removing it would leave no fallback at all.
- No automated test covers the real install path. Re-check 29 exists for that and
  requires a real SillyTavern install from the distribution repository.
