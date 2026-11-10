# 第二轮 · 批次 1：「纪要」App（长剧情记忆）

参考：玉子手机纪要表 `reference/st-yuzi-phone-main/tables/sources/纪要/01-纪要表.md`（下文简称「玉子纪要」）。社区项目，**规则和提示词可直接照搬**，文件头注明来源即可。

## 为什么做

微信、小剧场只读主聊天最近 12 条，主模型本身也会在长聊天里忘事。纪要把已经发生的剧情压成一条条记录，既注入主聊天提示词，也给微信和小剧场读。

## 用户看到的效果

- 主屏新 App「纪要」📜。顶部两个标签：**纪要 / 日历**（日历在批次 2 做，本批先放一个「即将推出」占位，或者本批只做单页、批次 2 再加标签，二选一，选简单的）。
- 纪要列表，新的在上。每条卡片：编码（AM0001）、时间跨度、**与今天的关系**（如「昨天」「三周前」）、概览（一句话）；点开展开 300–500 字纪要和重要对话。
- 右上角「整理」按钮：立刻把还没整理的消息写成一条纪要。生成中可取消。
- 设置折叠区：
  - 自动整理（默认开）：每 N 条 AI 回复自动整理一次，N 默认 4，可调 2–20。
  - 注入主聊天（默认开）。
  - 删除最后一条纪要（只允许删最后一条，带确认）。不做编辑。
- 没连 AI 时提示「请先在微信设置里连接 AI」。

## 数据

存在当前聊天的 chat metadata，键 `st_stage_chronicle`，随聊天文件走：

```ts
interface ChronicleEntry { code: string; timeSpan: string; summary: string; text: string; keyDialogue: string[]; createdAt: number }
interface ChronicleData { v: 1; entries: ChronicleEntry[]; lastMessageIndex: number }
```

- `lastMessageIndex`：已整理到的主聊天消息下标。下次整理取 `(lastMessageIndex, chat.length)` 之间的消息。
- 用户删了消息导致 `chat.length <= lastMessageIndex` 时，把 `lastMessageIndex` 改成 `chat.length - 1`，已有纪要不动。
- 编码按已有最大号递增，不跳号。

**共享 chat metadata 读写**：把 `st-extension/src/apps/story-state/store.ts` 里的 `metadataContext` 和 `writeLocalState` 的写入部分抽到 `st-extension/src/apps/shared/chat-metadata.ts`，导出 `readChatMetadata(key)`、`writeChatMetadata(host, expectedStoryKey, key, value)`。剧情状态改为调用它，行为不变。

## 生成

- 请求走 `shared/story-ai.ts` 的 `requestChat`（JSON 模式）。
- 系统提示词：照搬玉子纪要的 `sourceData.note` 里「强制约束」第 2–5 条（时间跨度格式、概览 ≤50 字、纪要 300–500 字的写法、重要对话 3–5 句），改成要求输出 JSON：`{"timeSpan":"","summary":"","text":"","keyDialogue":["说话人：原话"]}`。
- 用户消息：待整理的消息（`名字：内容`，用 `wechat/memory.ts` 的 `storyText` 清洗）+ 最近 3 条纪要的概览（保持连贯）+ 当前剧情日期（见下）。
- 剧情没有明确日期时，提示词要求 `timeSpan` 写空字符串，不要编造日期。
- 解析：`summary` 和 `text` 必须是非空字符串，否则报「格式不对，请重试」；`keyDialogue` 不是字符串数组就当空数组。

**触发**：照 `theater/controller.ts` 的结构写 `chronicle/controller.ts`：`setup(host)` 里订阅 `onMessageReceived`，数待整理的 AI 回复条数达到 N 才跑；同时只跑一个；60 秒超时；切聊天取消；写之前确认还是同一个聊天。

## 剧情日期与「与今天的关系」

新建 `st-extension/src/apps/shared/story-date.ts`：

- `storyToday(host)`：先看剧情状态（`story-state/store.ts` 的 `readStoryState`）的 `时间.年/月/日`，都有就用；否则用最新一条纪要 `timeSpan` 的结束日期；都没有返回 `null`。
- `relationToToday(target: Date, today: Date): string`：照搬玉子的分档规则 `reference/st-yuzi-phone-main/modules/phone-core/derived-fields/chronicle-today-relation-sql.js:208-232`（今天 / 昨天 / 前天 / N 天前 / 一周前 / 半个月前 / 三周前 / N 个月前 / 一个半月前 / 半年前 / N 年前，未来用「后」）。那里是 SQL，改写成 TS 函数。
- `parseSpanEnd(timeSpan)`：取 `~` 右边的前 10 位 `YYYY-MM-DD`，没有 `~` 就取左边；解析失败返回 `null`。
- 关系在**显示和注入时**现算，不存。没有今天或解析不了日期时不显示关系。
- 写一个单测覆盖各个分档的边界（0、1、2、3、7、15、21、30、45、180、360、540 天，以及未来方向）。

## 注入主聊天

- 用 `host.injectPrompt(text, 999)`（深度 999 = 放在很靠前的位置，照玉子的放法）。
- 内容：
  ```
  <已发生的事件概览>
  AM0001 | 三周前 | 概览
  ...
  </已发生的事件概览>
  <记忆回溯>
  （最近 3 条的完整纪要和重要对话）
  </记忆回溯>
  ```
- 概览部分超过 6000 字时去掉最旧的行。
- 在 setup 时、每次纪要变化时、切换聊天时重新注入；关闭注入时传空串。

## 给微信和小剧场用

- `wechat/memory.ts` 的 `ConversationScope` 加可选字段 `chronicleText`，`readStoryMemory` 里填上概览部分（不含完整纪要），`formatStoryMemory` 在主线背景之前加 `【过去的剧情纪要】`。
- 小剧场因为调用了 `readStoryMemory` / `formatStoryMemory`，会自动带上。

## 文件

- `shared/chat-metadata.ts`、`shared/story-date.ts`（+ 测试）
- `chronicle/types.ts`、`chronicle/generate.ts`、`chronicle/controller.ts`、`chronicle/inject.ts`、`chronicle/chronicle-app.ts`（+ 测试：解析、编码递增、消息被删后的下标修正、注入文本截断、控制器 N 条触发与切聊天取消、App 渲染）
- 样式前缀 `ch-`，追加到 `st-extension/style.css`。
- `apps/index.ts` 加一行，order 28。`docs/APP-SPEC.md` 加一行；`docs/WECHAT.md` 补一句微信会读纪要概览。

## 不做

- 不编辑纪要内容，不删中间的纪要。
- 不做关键词触发的世界书式注入（玉子的 splitByRow 关键词条目）。
- 不把纪要写进世界书文件。

## 验证

`pnpm vitest run st-extension/src/apps/chronicle st-extension/src/apps/shared st-extension/src/apps/story-state st-extension/src/apps/wechat st-extension/src/apps/theater`、`pnpm typecheck`、`pnpm lint`、`pnpm build:ext`。
