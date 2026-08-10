---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 10e562822087a6868fa90ae4909a27b3b1324492
remote_code_head_at_update: 55e0b981bcf27ab6503c8237b2eac40a9a28bed8
build_version: 0.9.0+202608101952
phase: acceptance-round2-review-fixed-awaiting-real-sillytavern
updated_at: 2026-08-10T20:23:25+08:00
updated_by: codex
verification_source: codex-acceptance-round2-2026-08-10
history: docs/maintenance/history/2026-08-10-acceptance-review-followup.md
---

# Current Project Status

## Snapshot

- 第二轮验收修复与两轮 CC 审查修复均在 `codex/acceptance-round2`；最新代码提交为 `10e5628`，尚未合并或推送，`origin/main` 仍为 `55e0b98`。
- 产品版本仍为 `0.9.0`，构建戳为 `0.9.0+202608101952`。真实 SillyTavern 验收通过后再决定并执行 `1.0.0` 升版。
- 自动化验证已完成；真实 SillyTavern 的模型输出、文件 API、缓存更新和供应商连接仍必须由维护者实测，不能由模拟器结果代替。

## Delivered Scope

- 运行时：新聊天/角色切换双阶段自愈，完整标签增量流式消费，最终消息权威收敛；新变量更新块 DOM 隐藏可逆。
- 显示与上传：不透明度仅作用悬浮窗，楼层立绘保持清晰；上传按钮横排；Renderer/插图协议说明补齐。
- 图库：同角色多层卡片堆叠与横向展开；预设包可批量选择并保存为持久化本地副本；批量上传、保存本地、复制分享串；安全删除元数据与未被引用的 `/user/images/` 文件。
- 资源：五套塞拉菲娜云端预设共 102 张，旧内置图片已从安装产物移除；`st-distribution/` 只保留 6 个安装文件。
- Prompt：默认服装和服装相对地址；角色级基础图名池、服装增量、`_变` 后缀与缩水集合；场景备注参与压缩；相对地址格式在比全量短时优先；解析器保留有意的更宽松兼容；内置底稿未修改时仍自动精简；预览和注入共用同一构建入口。
- API：明文 Key 策略如实展示；新建 Chat 档案只列 OpenAI、Claude、OpenRouter、Google AI Studio、自定义 OpenAI 兼容；历史冷门渠道仍可编辑；常用原生模型 selector 已按当前 SillyTavern release 源码修正。
- “带场景备注时的 Prompt 压缩性能优化”已完成，不再属于延期事项。
- CC 审查提出的预设选择、删除二次解码/失败重试、精确服装匹配、EOF 门禁和过度承诺文案问题已处理；`getPresetPacks` 的死参数已移除。
- CC 复审提出的两个异步旧快照问题已处理：本地化逐张基于最新 settings 核验并提交，删除文件成功后基于最新 settings 移除目标包。预设与本地副本的同地址重复启用会被现有冲突检测阻止，并有专门回归测试，不作为延期风险记录。

## Recorded Verification

Fresh automated evidence represented by code head `10e5628`:

- Vitest：54 files, 634/634 tests passed.
- TypeScript typecheck and ESLint: passed.
- Next.js production build: passed with webpack. Turbopack cannot traverse this isolated worktree's external `node_modules` symlink, so it was not used as the final build runner.
- Mobile Playwright E2E: 22/22 across Pixel 7 and Galaxy S8.
- Extension build tests: 15/15 passed.
- Fixed-stamp root/distribution builds completed at `0.9.0+202608101952`; shared artifact SHA-256 hashes match.
- `st-distribution/`: 6 files, no image, `public/`, `reference/`, or preset-source assets.
- `git diff --check`: passed on the working tree and `origin/main..HEAD` commit range, including the three previously reported EOF errors.

These are automated and source-review results only. No item below is marked complete by this record.

## 1.0 Real SillyTavern Acceptance

### Install And Runtime

1. Update an already installed extension and confirm the settings page shows `0.9.0+202608101952`, proving the loader cache key changed.
2. Create and switch chats/characters; confirm sprite and Renderer prompts appear immediately and remain present after the delayed self-heal.
3. During a real streaming response, confirm only newly completed `[立绘:...]` tags advance the overlay and the final message becomes authoritative without duplicate jumps.
4. Enable new variables, generate a real `<UpdateVariable>` block, confirm the UI hides it while raw chat data remains intact, then disable the feature and confirm text restoration.

### Renderer And Display

5. Generate real Galgame, card-choice, and battle protocol blocks; verify streaming, swipes, composer insertion, settings changes, and fallback to source text.
6. Confirm Renderer onboarding/status/help is readable, protocol injection reports a nonzero length, and the typewriter hint is understood as a local text animation rather than model streaming.
7. Compare overlay and inline sprites at reduced opacity: only the overlay should dim; transparent inline sprites should have no frame, shadow, or checkerboard supplied by the extension.

### Gallery And Resources

8. In the real ST viewport, confirm a collapsed same-role stack uses the first pack cover, shows layered cards, and expands horizontally with only one role open at a time.
9. Recheck upload preview: auto-split is off by default, controls stay above the preview list, and action buttons remain horizontal on desktop.
10. Exercise batch reorder/delete. For local deletion, confirm only eligible `/user/images/` files are removed and files referenced by an unselected pack remain; a 500 keeps metadata for retry, while an already-missing file is treated as deleted.
11. Exercise batch cloud upload, local save, and multi-share copying with both success and retryable failure cases, including a hosted preset selection.
12. Load all five hosted Seraphina presets, then save one locally and confirm a persistent “（本地）” copy replaces the active binding, uses the ST user-image copy, and still retains the remote source for sharing.
13. Recheck pack-info save, enable-pack checklist, fold-state/scroll preservation, large-pack pagination, story-image archiving, and mobile lightbox layout in the real ST DOM.

### Prompt

14. Inspect the injected Seraphina prompt: one role header, one base image-name pool, outfit increments, `_变` suffix list, battle-only reduced set, and notes indented under their outfit.
15. Generate and resolve `[立绘:图名]`, `[立绘:服装/图名]`, and full `[立绘:角色/服装/图名]`; confirm exact outfit names take precedence over fuzzy role matches, and ambiguous or wrong-role addresses do not render another pack's image.
16. Click “填入内置底稿” without editing it; confirm automatic compression remains active and the displayed preview character count matches the actual injected prompt.

### API

17. For OpenAI, Claude, OpenRouter, and Google AI Studio, import or create a profile and verify Key, source, model, secret-id behavior, model-list loading, final connection, and actual model identity. `NONE` must never be reported as success or require a manual second connect.
18. Test one custom OpenAI-compatible service with URL, plaintext Key, exact model ID, model discovery, and additional body/header parameters.
19. Open an existing niche-provider profile and confirm it remains readable/editable although it is absent from the new-profile source list.
20. Test one retained non-Chat completion backend used by the maintainer, and verify old single-secret-slot fallback only if an older SillyTavern instance is available.

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Cleanup/catalog expansion for the 143-file reference source set and selection of owned long-term hosting.
- Extraction/publishing automation for the generated standalone ST distribution repository.
- Product semantic version decision: remain `0.9.0` until the real-ST list passes, then release `1.0.0`.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- Merge or otherwise install the branch build only when ready to run the real SillyTavern checklist above; record each result without converting automated evidence into manual evidence.
- Fix only failures exposed by that acceptance round.
- If all blocking items pass, update `manifest.json` and build artifacts to `1.0.0`, run the release gates again, refresh this document, then merge and push.
