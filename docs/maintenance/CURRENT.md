---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 2c6195388239f80ac3ce2c46fb0ac48e279e7d22
remote_code_head_at_update: 4b51166c26fdbb70983fcf7b3257ab45b43b2a4b
build_version: 0.9.0+202608091151
phase: api-model-switch-real-sillytavern-retest
updated_at: 2026-08-09
updated_by: v0
verification_source: v0-api-model-switch-fix-2026-08-09
history: docs/maintenance/history/2026-08-09-api-model-switch-fix.md
---

# Current Project Status

## Snapshot

- API 管理已从单一 OpenAI-compatible 站点切换器重构为版本化连接档案：覆盖 SillyTavern Chat Completion 来源、Text Completion、NovelAI、KoboldAI 与 Horde；旧档案会迁移为 `openai/custom`。
- 根据真实 SillyTavern 反馈，模型切换流程现会先连接加载动态模型列表，等待目标模型出现后再选择并执行最终连接回验；明确的 `NONE` 不再被当作成功。
- API App 已加入快速开始、补全方式、全部当前 Chat Completion 渠道、字段安全和常见排障的可折叠中文说明。
- 桥接层继续优先使用 `/api/secrets/find` 和带 `secret-id` 的多密钥写入，失败时回退旧单槽位；URL、模型及来源设置写回后会先回验再连接。
- 自动化验证已完成，但多供应商真实 SillyTavern 验收尚未完成，因此 `verified_code_head` 暂时保留在上一个已验证提交，待本分支提交并完成真实 ST 检查后更新。
- Gallery, new-variable, and Renderer V1 updates are implemented and on `origin/main`.
- The first real-ST test round produced eight findings; all are fixed in `2c61953` (details in the history entry): upload auto-split default-off and layout, pack-list batch delete/reorder, prominent non-collapsing pack-info save, enable-pack checkbox popover, fold-state and scroll preservation across app remounts, prompt rework (图名 wording, indented notes, scene-cluster compression, repeat as migrated default, settings v5), transparent inline sprites plus a spriteOpacity setting, and renderer re-injection with an injection status line.
- The release build stamp is `0.9.0+202608091621`; `manifest.json` remains at product version `0.9.0`.
- The current phase is real SillyTavern acceptance, not additional feature implementation.

## Delivered Scope

- Gallery: mobile-safe preview, text editing actions, manual localization, labels/search, role folding, prompt and outfit notes, numbered action ranges, story image archiving, batch pack delete/reorder, and the enable-pack checklist.
- Variables: strict JSON Patch validation, safe legacy parsing, validated manual edits, corrected built-in templates, and three practical templates.
- Renderer V1: validated protocol, prompt injection with chat-change re-injection and status feedback, reversible runtime, settings App, Galgame mode, card choices, deterministic battles, and post-battle continuation.
- Renderer onboarding: quick-start steps, configuration status, mode guide, troubleshooting, and a preference-preserving activation action with a compact enabled state.
- Sprite prompt: image-name wording, scene-cluster compression that coexists with scene notes, auto-compact default (settings v5 migration), narrowed format instruction, and indented note rendering.
- Sprite display: transparent inline sprites without border/shadow, configurable sprite opacity (20-100%), and pure numeric tags that never render as malformed ranges.
- Release engineering: deterministic build timestamps and CI verification of committed extension artifacts.
- Distribution boundary: `pnpm build:st` generates `st-distribution/` without simulator or reference assets; root artifacts remain the compatibility path.

## Recorded Verification

Fresh automated results for `2c61953` from the 2026-08-09 round-1 fix run:

- ESLint and TypeScript typecheck: passed.
- Vitest: 600/600 across 51 files (includes new regression tests for every round-1 fix).
- Next.js production build: passed.
- Mobile E2E: 22/22 across Pixel 7 and Galaxy S8 profiles.
- Build stamp refreshed to `202608091621`; root and `st-distribution/` rebuilt; a same-stamp rebuild is diff-clean (deterministic).

These are automated results. Real SillyTavern checks below remain open until a human records them as completed.

## Real SillyTavern Acceptance

Original list (item 1 updated to the new stamp):

1. Upgrade an installed extension and confirm the settings UI reports `0.9.0+202608091621`, proving the new bundle bypassed browser cache.
2. Import a `sprite-pack@3` containing `promptNote` without `promptNotePlacement`; confirm the UI shows "after list" and renaming the pack does not change injection placement.
3. Check a large multi-group pack across pagination and confirm named group sections remain before the ungrouped section.
4. Exercise mobile preview positioning, manual remote-image localization, and story-based external image archiving in the real ST DOM.
5. Verify new-variable prompt injection and model-produced updates with an actual model response.
6. Exercise Galgame, card-choice, and battle renderers during real message streaming, swipes, settings changes, and composer insertion.
7. Open the Renderer App as a new user and confirm the quick-start panel, recommendation action, status states, and mode guide are readable in the real ST viewport.
8. Reopen the Renderer after enabling it and confirm the page keeps the status/mode guide but no longer repeats the three first-use steps.

Round-1 fix re-verification (from the 2026-08-09 feedback):

9. Upload preview: auto-split unchecked by default, whole filename kept as image name; checking it splits by prefix; controls above the file list on PC.
10. Pack list 批量管理: multi-select delete works, drag and ◀/▶ reorder persist, preset packs cannot be deleted.
11. Pack info: 保存包信息 button is visible without hunting, and the panel stays open after saving.
12. 启用包 popover: checking/unchecking several packs in a row works without reopening the menu.
13. 填入内置提示词底稿: the Prompt section stays open and the page keeps its scroll position.
14. Injected sprite prompt: says 图名, notes indent under scenes, shared image names are listed once with 另有 increments, and overall length is visibly shorter than the 0809 sample.
15. Inline sprites: no border/shadow box around transparent cutouts; 立绘不透明度 dims both overlay and in-floor sprites.
16. Renderer: status line shows 正在注入协议说明 N 字符 after enabling, the protocol block appears in the sent prompt, and the 打字机 ⓘ hint reads correctly.

## API Profile Acceptance

1. 在最新 SillyTavern release 中切换两个模型不同的档案，确认“可用模型”不会停留在 `NONE`、无需手动第二次点击连接，且成功提示显示实际生效模型。
2. 导入并切换一个自定义 OpenAI-compatible 档案，确认 Key、URL、模型和附加参数均可读回并成功连接。
2. 导入并切换至少一个非 custom Chat Completion 来源，确认来源、模型和对应密钥槽位正确。
3. 导入并切换一个 Text Completion 来源，确认动态面板渲染后 URL 写入与连接按钮正确。
4. 在不支持 `/api/secrets/find` 或 secret-id 的旧版/模拟环境验证单槽位回退，确认失败事务不会污染当前 Key。
5. 核对上游当前 release 中其余供应商 selector/字段；发现差异时记录并补充 descriptor，而不是宣称已真实覆盖。

## Next Actions

- Execute the API Profile Acceptance list in a real SillyTavern environment and record results before updating `verified_code_head`.
- Execute the acceptance list above against `origin/main` and record the results in a follow-up dated history entry.
- Resolve only failures discovered by acceptance testing; keep unrelated deferred items scoped separately.
- Decide separately whether the product version should move from `0.9.0` to `0.10.0` (or `1.0` if acceptance passes, per the maintainer's stated intent).
