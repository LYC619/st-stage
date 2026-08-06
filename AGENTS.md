# Shared Agent Guidance

Before changing this repository:

1. Read `docs/maintenance/CURRENT.md` and `docs/maintenance/PROTOCOL.md`.
2. Validate `verified_code_head` from `CURRENT.md` using the staleness check in `PROTOCOL.md`.
3. If code changed after that commit, reconcile the status from Git and `docs/maintenance/history/` before implementation.
4. Read `docs/maintenance/DEFERRED.md` when the requested scope may overlap a deferred item.

Git is the primary source of truth. Agent-private memory, old chat summaries, and attachments are supporting context only. At a handoff or merge boundary, update the shared maintenance documents according to `PROTOCOL.md`.
