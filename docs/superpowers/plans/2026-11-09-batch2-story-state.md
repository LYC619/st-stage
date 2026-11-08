# 批次 2：「剧情状态」App（任务 / 背包 / 能力 / 时空）

参考：未梦 WeiMeng（MIT，可直接移植代码，需在文件头注明来源和许可）。
本地副本：`test-results/wechat-social-upgrade/reference-weimeng/`，下文简称 `R`。

## 用户看到的效果

手机主屏多一个「剧情状态」App（图标 🎒）。打开后顶部四个标签：**时空 / 任务 / 背包 / 能力**。

- **时空**：大字显示剧情时间，下面一行地点；再下面是区域、地点、细节三张小卡。
- **任务**：卡片列表，新的在上。每张卡显示状态（进行中 / 完成 / 失败）、标题、描述，有奖励时显示「🎁 奖励」。不同状态用不同颜色的左边条。
- **背包**：两列网格。每格显示名称、×数量、描述，按稀有度显示边框颜色；有「使用」按钮。
- **能力**：卡片显示名称、Lv.N、类型、熟练度进度条、描述；有「发动」按钮。
- 点「使用」或「发动」，会把一句话填进酒馆输入框，**不自动发送**，用户确认后自己发。按钮短暂显示「已填入」。
- 页面底部一行小字显示数据来源：「来自 MVU 变量」或「本聊天的状态」。
- 没有数据时显示空状态说明：有 MVU 的卡怎么让 AI 写这些字段；没有 MVU 的卡可以在设置里打开「后台自动整理」。

## 数据来源

两种后端，按未梦 `R/src/store.js:74-81` 的规则自动选：

1. **有 MVU 且当前聊天有 MVU 数据** → 读 MVU 的 `stat_data`。用 `st-extension/src/apps/mvu/bridge.ts` 现成的 `readVariables` / `getLastMessageId` / `subscribeVarEvents`，读法照 `mvu-app.ts` 的 `load()`。**MVU 后端只读**，不往用户的 MVU 数据里写任何东西。
2. **否则** → 本聊天自己的状态，存在 chat metadata 的 `st_stage_story_state` 键：`{ stat_data, v: 1 }`。写入照 `R/src/store.js:185-195`：优先 `context.updateChatMetadata(...)`，然后 `saveMetadata()`。写之前检查 chatId 没变。

字段结构照未梦（`R/src/state.js:5-36`、`R/templates/mvu-ai-prompt.md:47-65`）：

| 键 | 结构 |
| --- | --- |
| `时间` | `{ 显示, 年, 月, 日, 时, 分, 星期 }`，优先用 `显示` |
| `位置` | `{ 区域, 地点, 细节, 座标 }` |
| `任务` | 数组 `{ id, 标题, 描述, 状态, 时间, 奖励 }` |
| `背包` | 数组 `{ id, 名称, 数量, 描述, 稀有度 }`；如果是对象，取 `Object.values` |
| `技能` | 数组 `{ id, 名称, 等级, 熟练度, 类型, 描述 }`，界面上叫「能力」 |

注意未梦自己的不一致：任务的标题有时写成 `名称`。读的时候 `标题 ?? 名称`。

## 后台自动整理（只用于本聊天状态，默认关闭）

照未梦的「幕后 LLM 同步」（`R/src/variable-updater.js`）：

- 在 App 的 `setup(host)` 里订阅 `host.onMessageReceived`。开关打开、当前是本地后端、配置了 AI 连接时，在 AI 回复后发一次后台请求。
- 请求内容：系统提示词照 `R/src/variable-updater.js:9-31`；用户消息 = 当前 `stat_data` 的 JSON + 最近 N 条主聊天（N 默认 12，用微信的 `captureStory(host)` 取，复用 `wechat/memory.ts`）。
- 模型返回 `_.set(...)` / `_.insert(...)` 等指令。用移植的指令解析器解析并应用到 stat_data，然后写回。
- 并发：照未梦的「合并」做法——正在跑时再来一条消息，只标记「还要再跑一次」，跑完补一轮。不加定时器防抖。
- 聊天切换时丢弃结果（写之前比 chatId）。
- 失败时在 App 内状态行显示错误，不弹 toast。

AI 连接：**复用微信的 AI 连接设置**，不新增 Key 输入框。见下文「共享 AI 请求」。没配置时开关旁显示「请先在微信设置里连接 AI」。

## 要新建/修改的文件

- `st-extension/src/apps/story-state/commands.ts`：从 `R/src/commands.js` 移植成 TS（435 行，无依赖）。导出 `extractCommands`、`isNoUpdate`、`applyCommands`。文件头注明来源与 MIT。
- `st-extension/src/apps/story-state/commands.test.ts`：移植 `R/tests/commands.test.mjs` 的 11 组用例。
- `st-extension/src/apps/story-state/store.ts`：后端选择、读取、本地写入、字段归一化（`normalize`：只做白名单合并，背包对象转数组，任务 `标题 ?? 名称`）。
- `st-extension/src/apps/story-state/store.test.ts`：移植 `R/tests/store-local.test.mjs` 的要点（本地后端读写、多轮累积、未知字段保留、切聊天拒写、不同聊天互相独立）。
- `st-extension/src/apps/story-state/sync.ts`：后台自动整理。
- `st-extension/src/apps/story-state/story-state-app.ts`：App 本体，四个标签页。标签页的键盘交互照立绘详情页的双 Tab（`st-extension/src/sprite-manager/detail.ts`，方向键 / Home / End）。
- `st-extension/src/apps/story-state/drafts.ts`：「使用」「发动」的文案，照 `R/src/st-bridge.js:197-220`。用户名用 `getContext().name1`，没有就用「我」。
- 填输入框：用 `st-extension/src/apps/renderer/composer.ts` 的 `createComposerBridge().insertDraft(text)`，它已经处理了「输入框有用户自己的草稿就不覆盖」。不要用未梦的 `/setinput` 或 `sendTextareaMessage`。
- 设置（App 私有数据 `ctx.getAppData/setAppData`）：`{ autoSync: boolean, contextMessages: number }`。设置放在 App 内一个折叠区，用 `widgets.ts` 的 `toggleRow` / `numberRow` / `foldSection`。
- 样式：类名前缀 `ss-`，追加到 `st-extension/style.css` 末尾（构建会把它和 `core/phone-shell.css` 拼成根目录 `style.css`）。宿主主题会干扰按钮和输入框，照微信 `wechat/view.ts` 开头那几条重置规则，给 `.ss-root` 下的 button/input 设好字体、颜色、边框。
- `apps/index.ts` 加一行，`order` 放在微信后面。
- `docs/APP-SPEC.md` 的内置 App 一览加一行。

## 共享 AI 请求

批次 1 已建 `st-extension/src/apps/shared/story-ai.ts`（`getStoryAiConfig(host)` + `requestChat(config, messages, signal)`），直接用。批次 1 失败没有这个文件时，按 `2026-11-09-batch1-theater.md`「共享 AI 请求」一节在本批新建。后台整理不需要 JSON 模式（返回的是指令文本），如果 `requestChat` 固定开了 JSON 模式，加一个可选参数关掉它。

## 不做

- 不往 MVU 写数据，不做 MVU 后端的后台同步。
- 不做繁体键兼容（未梦的 `legacy-keys.js`）。
- 不做手动编辑任务/物品，不做「使用」后扣数量。
- 不做 `角色`（好感度）页、通讯录页——微信已有联系人。
- 不做悬浮球、拖拽（未梦的 `float-drag.js`）。
- 不往主聊天提示词里注入任何东西。

## 验证

- `pnpm vitest run st-extension/src/apps/story-state st-extension/src/apps/wechat`
- `pnpm typecheck`、`pnpm lint`、`pnpm build:ext`
- App 渲染写一个 jsdom 单测：给定一份 stat_data，四个标签都渲染出对应条目；点「使用」调用了 insertDraft 且文本正确；空数据显示空状态。
- 不跑四尺寸浏览器验收。
