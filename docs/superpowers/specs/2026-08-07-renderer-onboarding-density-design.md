# Renderer Onboarding Density Design

## Intent

Keep the Renderer understandable on first use without making returning users scroll through the same three-step guide on every visit.

## Behavior

- When Renderer is disabled, show the configuration status, all three quick-start steps, and one `启用渲染` action.
- The action continues to change only `enabled: true`; it must preserve every mode and behavior preference.
- When Renderer is enabled, keep the truthful status but omit the three steps and activation action.
- Keep the existing collapsed mode guide available in both states.
- Keep the enabled-with-no-mode warning and empty prompt behavior unchanged.

The old `启用推荐设置` label is removed because the action does not apply a recommendation set. The new label describes the exact operation.

## Boundaries

- No persisted settings or schema changes.
- No changes to Renderer prompt generation, parsers, render modes, or runtime lifecycle.
- No automatic mode selection.
- No new dismiss-state setting.

## Verification

- Unit tests assert the disabled state has three steps and `启用渲染`.
- Unit tests assert enabled states retain status while hiding steps and activation action.
- Existing preference-preservation and no-mode tests remain active.
- A real-extension mobile E2E opens the Renderer App while disabled, checks layout and copy, activates it, and confirms the page becomes compact without horizontal overflow.

