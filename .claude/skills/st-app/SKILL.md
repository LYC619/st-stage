---
name: st-app
description: 给 st-stage 写一个新的内置手机 App（三步接入：新建模块 → 装配 → 构建提交）。收到「加一个 XX App」类需求时使用；包含必读文件、硬规则、验证命令与排错路径。
---

# 给 st-stage 写内置手机 App

st-stage 的定位是「一个插件、内部装配多个 App」。加新功能 = 加一个内部 App 模块，
不写独立 ST 扩展、不走外部注册。

## 必读（最小阅读集，先读完再动手）

1. `docs/APP-SPEC.md` — App 契约、ctx 能力、生命周期、样式类、安全红线
2. `st-extension/src/apps/index.ts` — 装配清单（你要加一行的地方）
3. `st-extension/src/apps/widgets.ts` — 现成 UI 部件（`appButton`/`toggleRow`/`selectRow`/`numberRow`/`textRow`/`textareaRow`/`foldSection`/`hintField`），优先复用，别手搓
4. 参考实现按需挑一个精读：
   - `butler-app.ts` — 要访问 SillyTavern 运行时（`getContext()`），无依赖注入
   - `gallery-app.ts` — 需要框架能力时经 `BuiltinAppDeps` 依赖注入（如打开弹窗）
   - `newvar-app.ts` + `newvar/` — 带常驻 runtime 的复杂 App（runtime 由入口创建并 start，App 页只是它的控制台）

## 三步接入

1. 新建 `st-extension/src/apps/<name>-app.ts`，导出返回 `PhoneApp` 的工厂函数：
   `{ id, name(≤4 汉字), icon(单 emoji), order, mount(container, ctx), unmount?() }`
2. 在 `apps/index.ts` 的 `createBuiltinApps` 返回数组里加一行；
   需要框架能力就扩展 `BuiltinAppDeps`，照 `galleryApp` 的样子传入
3. `pnpm build:ext`——构建自动 bump `version.json`；有变化的根目录产物
   （`bundle.js` / `index.js` / `version.json` / `style.css`）随源码一起提交，
   已装用户 git pull 后热更新自动生效，无需清缓存

## 硬规则（APP-SPEC 红线摘要）

- App 私有状态一律 `ctx.getAppData` / `ctx.setAppData`（仅持久化，不触发立绘刷新）；
  只有确实要改核心设置才用 `ctx.updateSettings`
- 所有用户可控文本一律 `textContent`，禁止拼 `innerHTML`
- `mount` 必须同步返回；异步数据自己 fetch 后再填充 DOM
- 挂到 `document`/`window` 的全局监听必须成对移除——不只在 `unmount` 里，
  宿主弹窗被整体移除的路径也要清理（参考 `sprite-manager.ts` 的 `closeLightbox` 模式）
- 自定义样式加自己的前缀（如 `dice-`），不覆写 `so-phone-*` / `so-app-*`
- 要注入提示词走命名通道 `adapter.injectChannel('<你的channel>', prompt, depth)`，
  每通道独立槽位，不碰立绘和其他 App 的注入
- 读 ST / 外部框架对象一律 `?? 默认值` 兜底（新版本字段可能缺失），
  只依赖有 export 的官方 API，别 import 内部函数
- 不要存 base64 图片进 settings（体积敏感），图片走图床 URL

## 验证（完成前必须全过）

```bash
pnpm vitest run        # 纯逻辑请抽成独立模块并带单测
pnpm eslint <改动文件>
pnpm build:ext         # 构建成功
pnpm test:mobile       # 改了手机壳/共享样式/触摸交互时加跑（Playwright 移动端 E2E）
```

不要用 `pnpm typecheck` 做门禁：它在 main 上就失败（st-adapter 全局声明冲突的历史遗留，
不是你引入的），修不修不归你管。

## 调试与排错

- **ST 内**：`mount` 抛错会显示错误占位页并打印控制台，不影响其他 App；
  看浏览器控制台 `[st-stage]` 前缀日志
- **Web 模拟器**（`pnpm dev`，http://localhost:3000）：与 ST 同一套手机壳，
  但目前只装配 sprites/gallery 的简化版（见 `components/phone-mount.tsx` 的 `createWebApps`）——
  想在 Web 里调你的新 App 需自行在那里注册，或直接进 ST 实测
- **已知平台缺口**：`ctx` 不暴露聊天记录 / 输入框 / 消息级事件；
  需要时经 `BuiltinAppDeps` 注入或扩展 `PhoneAppContext`（`core/phone-registry.ts`）
- 完成后在 `docs/APP-SPEC.md` 的「内置 App 一览」表补一行，README 视功能大小决定是否收录
