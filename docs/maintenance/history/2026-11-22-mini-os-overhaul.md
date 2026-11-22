# 掌上 Mini-OS 全面升级与四轮打磨（2026-11-22）

## 改了什么

- **工程整洁与边界修复（`ef6a531`）**：清理 `.tmp-test/`、未用 shadcn 组件与废弃脚本；把 4345 行扩展样式拆入 `st-extension/styles/*.css` 并修复 `build.mjs` 级联顺序；拆分 `index.ts`、`sprite-manager.ts`、`variable-tree.ts` 等超长文件；补齐局域网 HTTP 随机 ID / 剪贴板兜底、`api/bridge.ts` 探测模型密钥保护、设置面板双向同步与 `AGENTS.md`。
- **RP 可玩性与跨 App 联动（`6ec82c0`）**：新增统一幕后 AI 中枢（`story-ai.ts`，支持 App 内直连、复用微信/API 档案与模拟器本地演练）；小剧场升级跨天 30 篇日记沉淀、划痕心声显影、单栏防剧透重刷、直播发弹幕、一键转微信私聊（无独立卡自动建故事内临时联系人）与非破坏性话头填入；剧情状态支持普通卡手账增删校准、可选注入主聊天、无手机悬浮窗速查与 `/baigong action=status`；纪要支持行内修订、删末条回退游标、快速设定剧情起始日与七天风物横条/私人约定；立绘新增实时试衣舞台，外观新增五套主题、压暗/柔焦与角色专属换装。
- **掌上 Mini-OS 视觉、实机调优与全量文案润色（`1b15654`、`8718a6c`）**：升级状态栏 SVG 图标、顶部灵动通知胶囊、未读角标、主屏「今日风物」卡片、13 款微渐变图标、底部磨砂 Dock、手势横条、左缘右滑返回与独立壁纸柔焦层；在真实 Chromium 网页模拟器实机截图调优；拉通润色 55 项双语键及各内置 App 文案（设置改直白人话，叙事 App 改酒馆生活感）。
- **构建同步**：根目录、`st-distribution/` 与 `public/` 同步为 **0.9.0+202611220955**（代码提交 `8718a6c`）；未改动、未推送 `../st-stage-ext`。

## 为什么

- 消除早期临时开发残留、混杂大文件与静默吞错/局域网非安全上下文隐患，夯实后续维护基线。
- 解除早期叙事 App 强绑微信密钥、跨天清空日记、无日期卡死日历、非空输入框拒写草稿等死板限制，兼顾小手机沉浸派与无手机纯聊天派玩家体验。

## 怎么验证的

- 主会话与三个专职子代理（发布安全、RP 体验、酒馆文案）交替完成两轮挑刺复审并逐项闭环。
- `pnpm typecheck`、`pnpm lint`、`verify-i18n-completeness.mjs`（874 键 / 956 引用）、`verify-docs-apps.mjs`（13 款内置 App）、`pnpm build`（Next 生产构建）全部零错误通过。
- 全量 **147 文件 / 1,629 项 Vitest 单测**、**26 项发布工具测试**（`pnpm test:release`）及 **27 项 Playwright 移动端与桌面回归测试**（`pnpm test:mobile`）全部通过。
- 三目录 **60 项已提交构建产物**经 `verify-runtime-parity.mjs --committed` 校验完全一致；`../st-stage-ext` 工作区保持干净未动。

## 遗留事项

- 当前成果保存在本地分支 `feat/mini-os-overhaul-2026-11-22`，待用户审阅确认后再合并 `main` 并按需执行 `pnpm release:full` 发布至 `../st-stage-ext`。
- 真实酒馆宿主与外部 API 实测清单仍见[外部验收](../EXTERNAL-ACCEPTANCE.md)与[暂缓事项](../DEFERRED.md)。
