# 2026-10-26 分支合并与双仓库发布

## 范围

- 将当前工作区的微信 App、手机壳、素材及 W1-W9 审查修复提交为 `752678d`。
- 将 `codex/i18n-acceptance` 以非快进合并方式合入 `main`，代码合并提交为 `7866559`。
- 冲突解决保留微信 App 的 full-bleed 布局，并合并翻译分支的键盘入口、焦点恢复和可访问标签。
- 构建版本刷新为 `0.9.0+202610261121`。

## 自动验证

- `pnpm test`：100 个测试文件、1352 项测试通过。
- `pnpm exec tsc --noEmit --incremental false`：通过。
- `pnpm lint`：通过。
- `node scripts/verify-i18n-completeness.mjs`：通过。
- `pnpm build:all`：通过，生成根目录及 `st-distribution` 产物。
- `node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution`：7 个运行文件的字节数和 SHA-256 全部一致。
- `pnpm build`：Next.js 生产构建通过，静态页面生成完成。
- 微信素材在 `assets/wechat`、`public/assets/wechat`、`st-distribution/assets/wechat` 三处均为 50 项。

## 验收限制

本轮没有重新执行真实 SillyTavern、真实第三方 MVU、物理设备、OS 输入法、完整屏幕阅读器/WAVE 或 WCAG AA 验收。历史真实 ST 与浏览器脚本证据仍可用于其原始提交和环境，但不扩大为本轮重新实测。

## 发布记录

开发仓库和安装仓库的最终远端提交将在同步、哈希核对和推送完成后补入本节。`origin/v0/2405142193-6702-70a2066c` 因含有 `main` 未包含的独有提交而保留；其余确认已合入的本地维护分支及两个旧远端分支可在发布后清理。
