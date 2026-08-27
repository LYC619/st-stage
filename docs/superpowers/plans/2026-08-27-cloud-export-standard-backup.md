# Cloud Export Standard Backup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Cloud Export open quickly, support practical batch selection, and download one SillyTavern-compatible `default-user-YYYYMMDD-HHmmss.zip` containing only selected assets.

**Architecture:** Replace the eager snapshot with resource-granular bridge methods and UI-side lazy caches. Add a DOM-free export loader that reads selected assets with bounded concurrency and returns a complete standard-path manifest only after all reads succeed.

**Tech Stack:** TypeScript, Vitest/jsdom, SillyTavern HTTP APIs, JSZip, existing Phone App widgets.

---

### Task 1: Lazy bridge methods

**Files:**
- Modify: `st-extension/src/apps/cloud-export/types.ts`
- Modify: `st-extension/src/apps/cloud-export/bridge.ts`
- Modify: `st-extension/src/apps/cloud-export/bridge.test.ts`

- [ ] Write tests proving `listCharacters()` only calls `/api/characters/all`, while chats, worldbook bodies, and settings are deferred to separate methods.
- [ ] Run `pnpm vitest run st-extension/src/apps/cloud-export/bridge.test.ts` and confirm the new tests fail because the granular API does not exist.
- [ ] Replace `loadSnapshot()` with `listCharacters`, `listChats`, `listWorldbooks`, `loadSettingsAssets`, and `readWorldbook`; preserve `ch_name` and `extension_settings.regex` compatibility.
- [ ] Rerun the bridge test and confirm it passes.

### Task 2: Bounded export loader

**Files:**
- Create: `st-extension/src/apps/cloud-export/export-loader.ts`
- Create: `st-extension/src/apps/cloud-export/export-loader.test.ts`
- Modify: `st-extension/src/apps/cloud-export/manifest.ts`
- Modify: `st-extension/src/apps/cloud-export/manifest.test.ts`

- [ ] Write tests that selected assets alone are read, simultaneous reads never exceed four, progress is reported, and one failed read rejects without returning a partial manifest.
- [ ] Run `pnpm vitest run st-extension/src/apps/cloud-export/export-loader.test.ts st-extension/src/apps/cloud-export/manifest.test.ts` and confirm RED.
- [ ] Implement a task queue with four workers and asset-labelled errors.
- [ ] Keep exact paths: `settings.json`, `characters/`, `chats/`, `worlds/`, and `OpenAI Settings/`; do not emit empty directories.
- [ ] Rerun loader and manifest tests and confirm GREEN.

### Task 3: Lazy UI and batch selection

**Files:**
- Modify: `st-extension/src/apps/cloud-export/export-app.ts`
- Create: `st-extension/src/apps/cloud-export/export-app.test.ts`

- [ ] Write jsdom tests proving mount only lists characters, expanding a role loads chats once, category switches load once, role-plus-chat batch selection works, and empty selection never downloads.
- [ ] Run `pnpm vitest run st-extension/src/apps/cloud-export/export-app.test.ts` and confirm RED.
- [ ] Add per-category `idle/loading/ready/error` state and a chat-list cache keyed by character ID.
- [ ] Add `全选当前结果`, `反选当前结果`, `清空当前分类`, `全选角色及聊天`, and per-role `选择角色及全部聊天` actions.
- [ ] Wire `loadSelectedExportFiles()` progress and generate one local-time `default-user-YYYYMMDD-HHmmss.zip` download.
- [ ] Rerun the App test and confirm GREEN.

### Task 4: Documentation and verification

**Files:**
- Modify: `st-extension/src/apps/cloud-export/README.md`
- Modify: `docs/maintenance/CURRENT.md`
- Create: `docs/maintenance/history/2026-08-27-cloud-export-standard-backup.md`
- Regenerate: root extension artifacts and `st-distribution/`

- [ ] Document lazy loading, batch actions, the one-ZIP contract, supported scope, and sensitive-data exclusions.
- [ ] Run `pnpm vitest run st-extension/src/apps/cloud-export`.
- [ ] Run `pnpm typecheck` and `pnpm lint`.
- [ ] Run `pnpm build:ext`, then relevant build fixture tests and the full Vitest suite when focused gates are green.
- [ ] Run `git diff --check` and inspect the final diff. Preserve unrelated existing `style.css` and `pre-release-cargo-target/` changes.
