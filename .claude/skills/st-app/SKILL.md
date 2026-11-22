---
name: st-app
description: 给 st-stage 写一个新的内置手机 App（新建模块 → 装配与文档登记 → 同时间戳构建校验）。收到「加一个 XX App」类需求时使用；包含必读文件、硬规则、验证命令与排错路径。
---

# 给 st-stage 写内置手机 App

st-stage 的定位是「掌上 Mini-OS 底座 + 可插拔功能 App」。加新功能 = 在 `st-extension/src/apps/` 新增一个内部 App 模块（或通过 `window.stStageQueue` 开发独立扩展 App）。

## 必读（最小阅读集，先读完再动手）

1. `docs/APP-SPEC.md` — App 契约、`ctx` 能力层（v2）、生命周期、样式约定与安全红线
2. `st-extension/src/apps/index.ts` — 内置 App 装配清单
3. `st-extension/src/apps/widgets.ts` — 共享 UI 部件（`appButton`/`toggleRow`/`selectRow`/`numberRow`/`textRow`/`textareaRow`/`foldSection`/`hintField`），优先复用
4. 参考实现按需挑一个精读：
   - `gallery-app.ts` — 经 `BuiltinAppDeps` 注入框架能力（如打开全屏弹窗）
   - `chronicle/chronicle-app.ts` — 使用 `setup(host)` 常驻监听消息、读写 `chatMetadata` 并注入提示词
   - `newvar-app.ts` + `newvar/` — 带常驻 runtime 与全屏设计器的复杂 App

## 接入步骤

1. 新建 `st-extension/src/apps/<name>/<name>-app.ts`（或 `<name>-app.ts`），导出返回 `PhoneApp` 的工厂函数：
   `{ id, name(≤4 汉字), icon, order, fullbleed?, setup?(host), mount(container, ctx), unmount?(), back?() }`
2. 在 `st-extension/src/apps/index.ts` 的 `createBuiltinApps` 返回数组中注册，并在 `README.md` 的「当前内置 App：」表格和 `docs/APP-SPEC.md` 中同步登记（CI 由 `scripts/verify-docs-apps.mjs` 强制校验）。
3. 样式放入 `st-extension/styles/` 对应模块（并在 `app/globals.css` 引入以便网页模拟器同享），提交前执行 `pnpm build:all` 同时间戳更新根目录、`st-distribution/` 与 `public/`。

## 硬规则（APP-SPEC 红线摘要）

- App 私有配置存 `ctx.getAppData` / `ctx.setAppData`（走 `saveSettingsOnly`，不触发立绘重渲染）；按单条聊天隔离的剧情状态存 SillyTavern `chatMetadata`（见 `apps/shared/chat-metadata.ts`）。
- 所有用户可控与 AI 返回文本一律走 `textContent` / DOM API，禁止拼接不可信 `innerHTML`。
- `mount` 必须同步返回；经 `ctx` 建立的订阅与定时器在 `unmount` 后自动回收，自建全局监听必须在 `unmount` 成对清理。
- 提示词注入直接用 `host.injectPrompt(text, depth)` / `ctx.injectPrompt(text, depth)`，框架按 `app:<id>` 独立通道隔离。
- 局域网 HTTP 环境兼容：生成唯一 ID 用 `safeRandomId()`，写剪贴板用 `safeCopyText()`（见 `apps/shared/safe-runtime.ts`），勿裸调 `crypto.randomUUID()`。
- 若使用 `t(key, fallback)` 国际化，必须同时保持源码内联 `fallback`、`st-extension/locales/zh-CN.json`、`st-extension/locales/en-US.json` 三处一致。

## 验证（提交前必须全过）

```bash
pnpm test
pnpm typecheck
pnpm lint
node scripts/verify-i18n-completeness.mjs
node scripts/verify-docs-apps.mjs
pnpm build:all
node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution --preview public
# git commit 之后再加跑 --committed，确保新增/删除的 chunk-*.js 无遗漏入库：
node scripts/verify-runtime-parity.mjs --committed --root . --distribution st-distribution --preview public
pnpm test:mobile       # 改了手机壳、共享样式或移动端布局时加跑
```
