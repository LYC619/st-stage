# 2026-08-09 API 连接档案重构

## 范围

- 将 API App 从固定 OpenAI-compatible 站点模型迁移为版本化、多来源连接档案。
- 以 SillyTavern release 的 Connection Manager、OpenAI 设置和 secrets 端点为行为基准。
- 新版优先使用 `/api/secrets/find` 与 secret-id，多密钥写入失败时回退旧单槽位。
- 管理器按来源动态展示 URL、Key、模型和自定义附加参数；手机页支持异步读取当前连接和分阶段切换状态。

## 兼容性

- 旧档案自动迁移到 `mainApi=openai`、`source=custom`，保留 URL、Key、模型和三项附加参数。
- URL 只对真实需要 URL 的来源强制校验；不支持自动模型枚举的来源允许手填。
- 无法回读密钥时导入流程保留已有表单 Key，并明确显示能力限制。

## 自动化证据

- `pnpm install --frozen-lockfile`: passed.
- `pnpm lint`: passed.
- `pnpm typecheck`: passed.
- `pnpm test`: 584/584 passed across 51 files.
- `pnpm build:ext`: passed; root artifacts rebuilt at `0.9.0+202608091030`.
- `pnpm build:st`: passed; `st-distribution/` rebuilt.
- `pnpm build`: Next.js production build passed.

## 未完成的真实环境证据

本轮无法在当前 VM 内启动用户实际 SillyTavern 实例，因此尚未宣称全部供应商已经真实验收。最新 release 中自定义 OpenAI-compatible、一个其他 Chat Completion、一个 Text Completion，以及旧版 secrets 回退仍须按 `CURRENT.md` 清单人工验证；在此之前 `verified_code_head` 保留原值。
