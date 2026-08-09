# 2026-08-09 API 模型切换时序修复与说明补充

## 触发反馈

真实 SillyTavern 测试反馈两点：

1. 切换渠道后“可用模型”会先变成 `NONE`，需要手动再点一次连接才能真正用上所选模型（疑似异步竞态）。
2. 缺少像其他 App 那样的详细说明，尤其是补全方式与各渠道的差异。

## 根因

- 旧 `applyProfile()` 在切换来源后立即写模型并点击连接。SillyTavern 切换来源/渠道时会异步重建面板与模型下拉，目标模型选项尚未装载时写值会落成空值或 `NONE`；旧实现只等元素“存在”，且点击连接后立刻返回，手机 App 过早解除 busy 并读到中间态。

## 改动

- `st-extension/src/apps/api/bridge.ts`
  - 新增 `waitForValue`（等待下拉出现目标选项或输入框达到目标值）与 `waitForConnection`（轮询在线状态、来源与模型回验），并保留超时回退。
  - `applyProfile` 改为分阶段：切换补全方式与渠道 → 写密钥/URL/来源设置并回验 URL → 若目标模型未在下拉中则先连接一次加载模型 → 等待目标模型出现后写入 → 最终连接并回验；明确的 `NONE` 或被覆盖的模型会抛错而非误报成功。
  - `applyProfile` 现返回回验后的 `ConnectionInfo`，并接受进度回调。
- `st-extension/src/apps/api-app.ts`
  - busy 状态持续到最终模型回验完成，分阶段显示“切换补全方式与渠道 / 连接并加载模型 / 确认模型”等提示；成功提示包含实际生效模型。
  - 新增可折叠 API 说明：快速开始、补全方式差异（Chat/Text Completion、NovelAI、KoboldAI、Horde）、全部当前 Chat Completion 渠道说明、字段与安全、常见排障（NONE / 401 / 404 / 旧版回读）。

## 自动化证据

- `pnpm typecheck`: passed.
- `pnpm lint`: passed.
- `pnpm test`: 585/585 passed across 51 files（新增延迟模型加载→二次连接回归测试）。
- `pnpm install --frozen-lockfile`: passed。
- `pnpm build:ext` / `pnpm build:st` / `pnpm build`: passed；根与 `st-distribution/` 产物重建为 `0.9.0+202608091151`。

## 未完成的真实环境证据

模型切换时序依赖真实 SillyTavern 的异步渲染与在线状态事件，当前 VM 无法启动用户实际实例，因此“切换后模型不再停留 NONE、无需第二次点击连接”仍须按 `CURRENT.md` 的 API Profile Acceptance 清单人工复验；在此之前 `verified_code_head` 保留原值。
