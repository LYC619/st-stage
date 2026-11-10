# 批次 1：「小剧场」App（广场 / 论坛 / 直播）

参考：玉子手机的小剧场设计（`reference/st-yuzi-phone-main/tables/sources/小剧场2.1/`、`modules/phone-theater/scenes/`）。**玉子手机没有许可证，只借设计，不复制代码和提示词原文**，提示词用自己的话写。

## 用户看到的效果

主屏多一个「小剧场」App（图标 🎭）。顶部三个标签：**广场 / 论坛 / 直播**。右上角一个「刷新」按钮。

- **广场**：故事里重要配角的社交动态。卡片：首字圆形头像、作者名、身份标签、时间文本、正文、#话题；下方是评论区（`名字：内容` 一行一条）和一行互动数据（如「赞 1.2k · 评论 86」）。最新的在上。
- **论坛**：匿名网友讨论剧情里公开发生的事。卡片：版面名、标题、正文、标签胶囊、网名、热度；下面是楼层评论（短句）。卡片顶部一条色块，颜色按标题哈希固定。
- **直播**：把当前剧情包装成一场「直播」。只有一张大卡：直播间名、标题、主演、看点概述、观看数据；下面是弹幕墙，弹幕按粉丝团分颜色，有「暂停弹幕滚动」开关。
- 生成中：刷新按钮变成「生成中…」并可取消；失败时卡片上方一行错误和「重试」。
- 没连接 AI：显示一句「请先在微信设置里连接 AI」和跳转说明。
- 每个主聊天有自己的一份小剧场内容，切聊天就切内容。

## 内容规则（写进提示词，用自己的话）

借玉子的设计要点：

- 广场：发帖人只能是故事里有名字的重要配角，不能是主角本人，不能是路人；路人只能评论。每次新增 1–2 条，每人一条。评论 4–8 条，评论者只知道自己可能知道的事（当事人、听说的、围观的），不要全知视角。
- 论坛：网友只能讨论在故事里已经公开传播的事，禁止「我今天在某处看到主角」这种线下偷窥。语气随意、口语化。评论 4–8 条，每条一句。
- 直播：围绕当前这一幕。弹幕 12–20 条，分 2–4 个粉丝团，每条带粉丝团名。
- 所有内容不推进主线、不替主角做决定、不复述人设。
- 每个 feed 只保留最近 **5** 条，超过删最旧的。直播只保留 **1** 场，每次覆盖。

## 生成方式

不是表格插件，由本 App 自己请求 AI，一次请求同时产出三个 feed：

```json
{
  "square": [{ "author": "", "tag": "", "time": "", "text": "", "topics": [""], "comments": [{ "name": "", "text": "" }], "stats": "" }],
  "forum":  [{ "board": "", "title": "", "text": "", "tags": [""], "user": "", "heat": "", "comments": [""] }],
  "live":   { "room": "", "title": "", "cast": "", "summary": "", "stats": "", "danmaku": [{ "fan": "", "text": "" }] }
}
```

- 上下文：复用微信的主线记忆。`captureStory(host)` 取主聊天，`readStoryMemory(...)` 读世界书，`formatStoryMemory(scope)` 拼成文本（都在 `st-extension/src/apps/wechat/memory.ts`）。`readStoryMemory` 需要一个 `ConversationScope` 和 `WeChatProfile`：scope 用 `{ scopeKey: 'theater', characterName: 当前角色名, card: 当前角色卡, externalState: { source: 'none' } }`；profile 用 `resolveProfile(微信 config, 当前角色 id)`，只用到其中的 `contextMessageCount`、`includeWorldbook`、`playerName`。参考 `wechat/moments-controller.ts` 的 `generateMoment` 怎么调用。
- 已有的最近帖子标题/正文前 30 字也放进请求，提示模型不要重复。
- 解析：`JSON.parse`，失败就报错让用户重试。每个字段只做「是字符串就用，不是就丢掉这一条」的清洗，不做更多修复。

**触发**：

- 手动：刷新按钮。
- 自动（设置里开关，默认开）：在 App 的 `setup(host)` 里订阅 `host.onMessageReceived`，照 `wechat/moments-controller.ts` 的做法——剧情指纹去重（主聊天最后 20 条没变就不生成）、冷却时间（默认每 3 条 AI 回复最多一次，或 5 分钟，取实现更简单的一种）、同时只跑一个、60 秒超时、主聊天切换就丢弃结果。可以直接抽取/复用 moments-controller 里的 `fingerprint` 函数。
- 后台生成时 App 没打开也照常保存，下次打开就看到。

## 共享 AI 请求（本批新建）

`st-extension/src/apps/shared/story-ai.ts`：

- `getStoryAiConfig(host)`：读 `host.getSettings().apps['wechat-sister']?.config`，返回 `{ apiKey, apiUrl, model }`；没有 apiKey 返回 `null`。
- `requestChat(config, messages, signal)`：从 `wechat/pipeline.ts` 的 `requestJson`（约 209–226 行）抽出来，原样保留 JSON 模式和错误文案。`WeChatPipeline.requestJson` 改为调用它，微信行为不变。

## 文件

- `st-extension/src/apps/shared/story-ai.ts`
- `st-extension/src/apps/theater/types.ts`：数据类型。App 私有数据 `{ autoGenerate: boolean, stories: Record<storyKey, { square, forum, live, updatedAt, fingerprint }> }`，`stories` 最多保留 20 个聊天，按 `updatedAt` 淘汰最旧的。
- `st-extension/src/apps/theater/generate.ts`：拼提示词、请求、解析、合并进滚动窗口。
- `st-extension/src/apps/theater/controller.ts`：自动触发、冷却、取消、状态订阅。
- `st-extension/src/apps/theater/theater-app.ts`：App 本体与三个标签页。标签页键盘交互照 `st-extension/src/sprite-manager/detail.ts` 的双 Tab。
- 测试：`generate.test.ts`（解析与窗口裁剪：超过 5 条删最旧、直播覆盖、坏 JSON 报错、缺字段的条目被丢弃）、`controller.test.ts`（指纹相同不重复生成、切聊天丢弃结果、取消）、`theater-app.test.ts`（jsdom：三个标签渲染、空状态、未连接 AI 提示）。
- 样式：类名前缀 `th-`，追加到 `st-extension/style.css` 末尾。参照微信 `wechat/view.ts` 开头的重置规则处理宿主主题干扰。用户可控文本一律 `textContent`。
- `apps/index.ts` 加一行，`order` 放在微信后面。
- `docs/APP-SPEC.md` 内置 App 一览加一行；`docs/WECHAT.md` 末尾加一句「小剧场复用微信的 AI 连接和主线记忆」。

## 不做

- 不做发帖、评论、点赞、删除单条等交互（玉子手机也没有）。
- 不做小日历、小日记、纪要（后续批次）。
- 不往主聊天提示词里注入小剧场内容。
- 不生成图片，不做「图片/视频描述」字段。
- 不做独立的 AI 连接设置。

## 验证

- `pnpm vitest run st-extension/src/apps/theater st-extension/src/apps/wechat st-extension/src/apps/shared`
- `pnpm typecheck`、`pnpm lint`、`pnpm build:ext`
- 不跑四尺寸浏览器验收。
