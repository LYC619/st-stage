# Real-ST Acceptance Round 1 — Feedback Fixes (2026-08-09)

## Scope

The maintainer ran the first real SillyTavern test round and reported eight findings.
All eight are addressed in code commit `2c61953` on `main`.

## Fixes

1. **Upload auto-split defaults off.** The batch upload preview now keeps the whole
   filename as the image name in the current pack; checking 自动拆分 re-parses the
   prefix split live. Controls and buttons sit above the file list, and the panel is
   wider on PC (`min(760px, 96vw)`).
2. **Pack list batch management.** A 批量管理 mode adds card multi-select, batch
   delete (preset packs excluded), HTML drag-and-drop reorder, and ◀/▶ move buttons
   for touch. New pure helpers `movePack` / `movePackBefore` / `removePacks` in
   `core/sprite-store.ts`.
3. **Pack info save.** The save button is now a prominent full-row primary button
   (保存包信息) with a success toast, and the 包信息 collapsible keeps its open state
   across the commit-triggered re-render (keyed open-state map).
4. **Enable-pack checklist.** The single-shot `<select>` is replaced by a persistent
   checkbox popover (勾=启用, 取消勾=停用). The popover is rebuilt in place after each
   commit re-render and closes only on outside click/Esc.
5. **Fill-builtin no longer collapses sections.** `foldSection` gained keyed
   open-state memory (sprite app 显示/轮播/Prompt, renderer 模式说明), and the phone
   shell preserves scroll position when the same app remounts after a settings change.
6. **Prompt rework** (`core/prompt-builder.ts`):
   - All generated wording now says 图名 instead of 表情 (builtin template in sync).
   - Notes render indented under their scene line (`  备注：…`), multi-line notes
     keep indentation; before-list notes stay as labelled intro lines.
   - The format instruction narrows to `[立绘:角色/服装/图名]` when every scene has
     role+outfit (drops the two/three-segment explanation noise).
   - Compression rewritten: pair-intersection scene clustering replaces the
     all-scenes intersection, so numbered-prefix outfits and shrunken tag sets no
     longer disable compression, and scene notes coexist with compression (the old
     notes bail-out — a DEFERRED item — is resolved). `chooseShorterPrompt` still
     guarantees repeat ≤ full.
   - `multiRolePromptMode` defaults to `repeat`; settings v4→v5 migration converts
     stored `full` (the old silent default) to `repeat`, while `full` stored by v5+
     is respected as a user choice. `SETTINGS_VERSION = 5`.
7. **Transparent sprites + opacity.** `#chat .so-inline-sprite img` drops the
   illustration border/radius/shadow so transparent cutouts render clean. New
   `spriteOpacity` setting (20–100 %, default 100) applies to inline sprites and the
   overlay (fade-in target), adjustable in the 立绘 App 显示 section.
8. **Renderer injection resilience.** The sent-prompt sample
   (`reference/发送的提示词_0809.txt`) contains no renderer protocol block, confirming
   the injection was absent. The renderer now re-injects on chat/character change
   (parity with new-variable), the status line shows 正在注入协议说明 N 字符 for
   self-diagnosis, and the 打字机 toggle has an ⓘ hint clarifying it is the Galgame
   dialog letter-by-letter animation, not model streaming.

## Verification (fresh, this batch)

- ESLint and TypeScript typecheck: passed.
- Vitest: 600/600 (51 files), including new regression tests for upload default,
  batch management, save-keeps-panel-open, enable checklist, cluster compression,
  note indentation, and the v5 migration.
- Next.js production build: passed.
- Mobile E2E: 22/22 across Pixel 7 and Galaxy S8 profiles (includes updated
  save-keeps-panel-open assertion).
- Build stamp refreshed `202608070237 → 202608091621`; root and `st-distribution/`
  rebuilt; same-stamp rebuild is diff-clean (deterministic).

## Known limits

- The Next.js simulator (`components/config-panel.tsx`) only received copy-level
  parity (prompt-mode labels); its parallel gallery UI keeps the old interactions.
- The 0808 test screenshots referenced in the feedback were not found in the repo;
  fixes were implemented from the written descriptions and the prompt sample.

Real SillyTavern re-verification of these eight items plus the original acceptance
list is tracked in `CURRENT.md`.
