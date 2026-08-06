# Cross-Agent Maintenance Protocol

This directory is the shared handoff surface for humans, Codex, Claude Code, and other coding agents. It records project state without depending on any product's private memory.

## Source Priority

When sources disagree, use this order:

1. Current Git state and committed code.
2. `CURRENT.md` when its `verified_code_head` passes the staleness check below.
3. Dated records in `history/`.
4. Design and implementation documents under `docs/superpowers/`.
5. Agent-private memory, attachments, and old chat summaries.

Passing tests do not override an observed Git mismatch. A status document is stale when its verified code commit is not an ancestor of HEAD or product files changed after that commit.

The maintenance document cannot contain the hash of the commit that contains itself. Instead, `verified_code_head` identifies the last code/build commit represented by the status. Pure maintenance-document commits after it are allowed. Validate it with:

```powershell
git merge-base --is-ancestor <verified_code_head> HEAD
git diff --quiet <verified_code_head>..HEAD -- . ':(exclude)docs/maintenance/**' ':(exclude)AGENTS.md' ':(exclude)CLAUDE.md'
```

Both commands must exit zero. Otherwise reconcile `CURRENT.md` before relying on it.

## Start-of-Task Checklist

Run and inspect:

```powershell
git status --short --branch
git rev-parse HEAD
git log --oneline --decorate -5
Get-Content -Raw -Encoding UTF8 docs/maintenance/CURRENT.md
```

Then:

- Confirm the branch, worktree state, and current phase.
- Validate `verified_code_head` and compare the recorded remote code head with the actual tracking branch.
- Read only the history, plans, and deferred items relevant to the task.
- Do not silently continue from an agent-private memory when Git says otherwise.

## Handoff Checklist

At a completed batch, review boundary, merge, or push:

1. Commit all intended source, test, documentation, and generated artifact changes.
2. Record fresh verification evidence; distinguish automated evidence from real SillyTavern manual checks.
3. Update `CURRENT.md` to the committed HEAD, current build version, phase, completed work, and next actions.
4. Add or update a dated history record when the change materially alters delivered behavior or closes a review cycle.
5. Add intentionally postponed findings to `DEFERRED.md`; remove entries only when a commit resolves them.
6. Keep the worktree clean and report whether merge and push occurred.

## CURRENT.md Contract

`CURRENT.md` begins with YAML front matter containing:

- `status_version`: maintenance schema version.
- `project`: repository identifier.
- `base_branch`: integration branch.
- `verified_code_head`: exact code/build commit represented by the document.
- `remote_code_head_at_update`: remote integration commit confirmed when the document was updated.
- `build_version`: value from `version.json`.
- `phase`: short machine-readable lifecycle state.
- `updated_at`: ISO date or timestamp with timezone when known.
- `updated_by`: human or agent that produced the update.
- `verification_source`: origin of the recorded verification evidence.
- `history`: matching dated maintenance record.

The body stays concise and describes only current state. Detailed chronology belongs in `history/`.

## Private-Memory Boundary

- Claude Code may keep project memory under its own `.claude` directory.
- Codex may keep selected memories and task state under `.codex`.
- Neither private store is authoritative for this repository.
- Do not copy secrets, credentials, private prompts, or full transcripts into repository maintenance files.
- Record decisions, commit references, verification evidence, known risks, and next actions instead.
