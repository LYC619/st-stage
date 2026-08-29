# 2026-08-29 Pre-Release Review, Push, And Distribution Split Decision

## Boundary

- No product code changed. This batch corrects `CURRENT.md`, records a distribution decision in `DEFERRED.md`, and pushes the six local commits accumulated since `af1fa37`.
- `verified_code_head` stays `d9852e9`; the recorded verification evidence from `2026-08-27-cloud-export-review-fixes.md` still applies unchanged.
- Pushed local `main` to `origin/main`, advancing the remote from `af1fa37` to this maintenance commit. The six commits were `51d11b4`, `116103a`, `bca369c`, `75991ce`, `d9852e9`, and `80999dd`.
- Product version remains `0.9.0`; build stamp remains `0.9.0+202608272259`.
- The 20 real SillyTavern checks remain manual and unclaimed.

## Pre-Push Review Findings

A pre-release review of the repository state produced three documentation defects and one latent code defect. Staleness checks passed before any edit: `d9852e9` was an ancestor of `HEAD`, and no product file differed between it and `HEAD`.

### Build stamp stale in three places

`CURRENT.md` recorded `0.9.0+202608271324` at the Snapshot line and in acceptance checks 1 and 17, while `version.json` held `0.9.0+202608272259`. The two mentions in `history/` are correct dated records of earlier batches and were left alone.

Check 1 was the damaging one: it directed the tester to confirm a build stamp that no build produces, which would have read as a broken hot update. It was also wrong about the format. The settings panel renders `v0.9.0（构建 2026-08-27 22:59）` from `__EXT_VERSION__` and `__BUILD_TIME__`; the compact twelve-digit stamp appears only in `version.json` and the `bundle.js?v=` cache-busting parameter. The check now names the panel string and says where to find the compact form.

This is the failure mode already recorded under the build-stamp gate: CI cannot catch it. The workflow reconstructs `ST_STAGE_BUILD_TIME` from `version.json` and then verifies the rebuilt artifacts match the committed ones, so it is self-consistent by construction and never compares the stamp against prose in the maintenance document.

### Acceptance count stale

The Snapshot claimed 16 manual SillyTavern checks while the list runs 1–20; the Cloud Export items were appended without updating the count. Corrected to 20.

### Next Actions pointed at the wrong commit

Next Actions said to push `116103a`, which was two commits behind the artifact rebuild in `d9852e9`. Rewritten to describe installing `d9852e9` from `origin/main`, and extended with the split sequencing below.

## Distribution Split Decision

The maintainer chose to publish the distribution as a separate repository under a new name, keeping this development repository at `st-stage`. Rationale and measurements are recorded in `DEFERRED.md`.

The decision rests on the redirect boundary. Reusing `st-stage` for the distribution repository requires renaming this repository, and creating a new repository at the freed name overrides GitHub's rename redirect: existing installs would resolve to a repository with unrelated history, so `auto_update` would fail and every current user would have to reinstall. Publishing under a new name leaves installed instances working against this repository's root artifacts.

The measured case for splitting is install and update weight, not browser runtime. SillyTavern reads `manifest.json` and injects only the declared `index.js` and `style.css`, so the remaining tracked files and the ignored local directories are never read by the front end. A clone is 66 MB across 284 files to deliver five runtime files totalling roughly 895 KB, and `auto_update: true` runs a git update against that history on every SillyTavern start.

## Latent Defect Found, Not Fixed

The install directory name is hardcoded in three places, and Butler's self-protection compares against the literal `st-stage`. Under any other directory name Butler stops recognizing itself, so the documented guarantee that st-stage cannot be selected for extension-isolation experiments fails silently and a user can disable Butler through Butler.

This is reachable today by renaming the directory manually; the split would make it the default. It was recorded in `DEFERRED.md` rather than fixed here, because fixing it changes `bundle.js` and would require a new build stamp and a fresh verification round, invalidating the evidence this push is carrying into acceptance.

## Verification

- Staleness checks passed before and after the edits: `git merge-base --is-ancestor d9852e9 HEAD` and the product-file diff excluding maintenance documents both exited zero.
- No product file was touched, so the recorded artifact hashes and test results from `2026-08-27-cloud-export-review-fixes.md` carry forward unchanged and were not re-run.
- Worktree clean at handoff.

## Next Boundary

Install `d9852e9` from `origin/main` in real SillyTavern and execute checks 1–20 in `CURRENT.md`, recording only observed results. After acceptance passes, execute the split in order: runtime self-identification first, then the distribution repository, then the semantic version decision. The directory-name fix must land before publishing under a new name, since that rename is what activates the defect.
