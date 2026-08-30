---
record_version: 1
project: st-stage
date: 2026-08-30
code_head_at_record: 0e6352c
build_version: 0.9.0+202608301732
recorded_by: claude-code
---

# Distribution Repository Published

## What Happened

The standalone ST distribution repository went live at `https://github.com/LYC619/st-stage-ext`,
first release commit `25809d9`, carrying build stamp `0.9.0+202608301732`. The maintainer created
and pushed it; this session verified it, retargeted the development side at it, and fixed the two
places that still sent users to the wrong repository.

Three commits make up the round:

| Commit | Contents |
| --- | --- |
| `838c2af` | `homePage` retarget plus a rebuild at the fixed stamp `2026-08-30 17:32` |
| `0e6352c` | Root README install URL, distribution README rewrite, README newline normalization in the build |
| (this record) | Maintenance documents |

## The homePage Retarget

`manifest.json` carried `"homePage": "https://github.com/LYC619/st-stage"`. With
`auto_update: true`, SillyTavern runs a git update against the origin the user cloned from on every
start, so this field has to name the repository people actually installed from. Left stale it would
have pointed the extension list's own link at a 66 MB source tree.

The whole-worktree diff for this stamp was six files and eight lines. The only non-stamp change was
that one `homePage` line in the root and distribution `manifest.json`. `bundle.js` differed in
exactly two lines, both stamp interpolations. `index.js` and `style.css` were byte-identical to the
previous round — no CSS changed, and the loader stub's cross-version byte stability resumed after
its one-round comment change.

## Two Places Still Pointed At The Wrong Repository

The published repository surfaced a defect the split was supposed to eliminate. The root README's
install step still said to paste the development repository URL into ST's install box:

```
https://github.com/LYC619/st-stage
```

Following it clones the 66 MB source tree and installs under the directory name `st-stage` — the
precise outcome the split exists to avoid, and one that also lands users on a directory name that
the runtime self-identification would then report. New users now get `st-stage-ext`, with a note on
which repository is which so the source repository still reads as the place to file issues. The
header's parenthetical was changed from "仓库名 st-stage" to "安装目录 `st-stage-ext`", which is the
fact that actually matters to a reader who has just installed it.

The distribution README was written as a note about a generated output directory — "This directory
is generated ST installation output", "Regenerate it with `pnpm build:st`", and a reference to "the
development repository" without naming it. Accurate for a subdirectory of this repository, wrong for
the front page of a repository people install from. It now states what the extension is, how to
install it, that `auto_update` follows that repository, and where the source lives.

## The README Was Generated, And Was Not Reproducible

`st-distribution/README.md` is not hand-written: `st-extension/build.mjs` writes it from
`st-extension/distribution-readme.md`, so editing the output would have been silently overwritten by
the next build. That was worth confirming before planning the rewrite rather than after.

That copy was a verbatim `copyFileSync`, which made `README.md` the only distribution artifact whose
bytes depended on checkout mode — the exact hazard `normalizeArtifactNewlines` was written for. The
`.gitattributes` pinning does not cover it either, since that lists only `*.js`, `*.css`, and
`*.json`. On a machine with `autocrlf=true` the copied README would have carried CRLF, so its hash
would not have reproduced and a copy into the distribution clone would have shown as modified for
line-ending reasons alone. The copy now normalizes like every other generated file; a rebuild
verified zero CRLF pairs in the output.

## Verification

- Vitest `4.1.10`: 80 files, 964/964 passed. TypeScript typecheck, full ESLint, Next.js `16.2.6`
  production build, and `git diff --check` all passed — run once for `838c2af` and again for
  `0e6352c`.
- Root artifacts rebuilt twice at the fixed stamp and byte-identical across all five files.
- Three-way hash identity across the development root, `st-distribution/`, and the published
  `st-stage-ext` working tree. SHA-256:
  - `manifest.json`: `FF64862A61B75564D86990E6C710E8394E3FAB4694F29209A222D23119B87BE3`
  - `index.js`: `27DB248504A6EE1FEC948C3C6135F93732C0B075A0803317B82C972BCFCF457D`
  - `bundle.js`: `CA2A209C2C0F6100F3FC3469CC7D991BCC877709A4E0EC764B859AC86A017487`
  - `style.css`: `AF026AFAB5DB7AA36290BB622E9E61E7F178240CEFFC72063866B697A3DEE4A1`
  - `version.json`: `DD6C2B6CE97F0C187B7EA21093F7620C6B6A80A3C778820E89E4BD563AEF4B7E`
- The published repository was inspected directly rather than assumed: one commit, fresh history
  with no development ancestry, clean worktree, in sync with its `origin/main`, `.gitattributes`
  present pinning `*.js`/`*.css`/`*.json` to `eol=lf`, and exactly the six files plus that
  `.gitattributes` at the root.
- `st-distribution/README.md` is the one file the published repository is behind on
  (`F32B5F76084D…` here against `D8FA59C2058E…` there). Not urgent: the five functional artifacts
  already match, so nothing installed behaves wrongly. It travels with the next release.

## Decisions Held

- The development repository keeps the `st-stage` name. Renaming would leave a redirect that a later
  repository at the freed name could override, at which point existing installs would `auto_update`
  against unrelated history. Holding the name means the hazard never arises.
- Product version stays `0.9.0`. The semantic-version decision is the maintainer's and stays open
  until real-ST acceptance closes; the version travels to every installed copy through `auto_update`
  and is awkward to walk back.
- Publishing automation stays deferred. The copy-and-push release loop is documented in
  `CURRENT.md` and still run by hand.

## Still Manual

Re-check 29 is the first thing to run: the extension is now published under a directory name it has
never actually executed under, and self-protection is derived at runtime from `import.meta.url`.
Everything else this round is byte-verified; that is the only claim resting on untested behavior.
Re-checks 21–28 follow.

Pushing `838c2af`, `0e6352c`, and this record to `origin/main` is a maintainer action — pushes from
the agent session fail on Git Credential Manager, not on network.
