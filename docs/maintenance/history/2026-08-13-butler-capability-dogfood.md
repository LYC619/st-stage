# 2026-08-13 Capability Layer 5b Dogfood Findings

## Consumer

Butler 2.0 is the first completed feature batch used to review the phase 5b capability-layer assumptions from `docs/superpowers/specs/2026-07-28-ctx-capability-layer-design.md`.

## Validated Capabilities

- `ctx.getAppData` and `ctx.setAppData` are sufficient for versioned per-App data, bounded history, restore transactions, and pending experiments without triggering unrelated sprite refresh work.
- `ctx.openModal` supports the long report, extension governance, gameplay advisor, and history surfaces while keeping the phone screen compact. Desktop and two mobile viewport projects covered modal scrolling and layout.
- Context-managed timeout/interval cleanup and App lifecycle disposal are adequate for UI timers. Dynamic sampling itself uses explicit `AbortController` ownership because observers, animation frames, and cross-refresh transactions have domain-specific cancellation rules.
- Existing toast, settings update, and phone navigation capabilities remained sufficient; no new generic write authority was required.

## Escape Hatches That Remain Host-Specific

- SillyTavern `power_user` settings and official extension enable/disable modules.
- Browser PerformanceObserver, Resource Timing, storage estimates, DOM summaries, and scroll-container inspection.
- SillyTavern generation state and settings-save exports used around cross-refresh actions.

These do not belong in the generic phone App context because their types and lifecycle are specific to SillyTavern or the browser host. Butler keeps them behind guarded bridge interfaces.

## Chat Read-Side Decision

Butler needs only privacy-preserving page evidence: a chat key, total message count, rendered message count, and layout dimensions. It does not need message bodies. Therefore phase 5b does not justify exposing full chat history or the most recent N message texts through `ctx`.

A future capability-layer v1.5 candidate may expose a host-provided chat summary with stable identity and counts if a second independent App needs the same contract. Until then, the Butler bridge remains the sole consumer and the generic API stays unchanged.

## Outcome

- Phase 5b dogfood is complete and removed from `DEFERRED.md`.
- No capability API version bump is required for this batch.
- `openModal` mobile behavior and managed timers are validated by a real consumer.
- Full chat-read access remains intentionally absent; this avoids granting more data access than the observed need supports.
