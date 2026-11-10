# 第二轮 · 批次 2：日历与日记

参考（直接照搬规则和提示词，文件头注明来源）：

- 小日历：`reference/st-yuzi-phone-main/tables/sources/小剧场2.1/05-小日历表.md`
- 小日记：`reference/st-yuzi-phone-main/tables/sources/小剧场2.1/06-小日记表.md`
- 界面参考：`reference/st-yuzi-phone-main/modules/phone-theater/scenes/calendar.js`、`diary.js`

依赖批次 1 的 `shared/story-date.ts`（`storyToday`）和 `shared/chat-metadata.ts`。批次 1 没完成时，本批先建这两个文件（按批次 1 计划的对应小节）。

## 日历：放进「纪要」App 的第二个标签

**效果**

- 7 天窗口：3 天前 … 今天 … 3 天后，横向 7 格或竖向列表（窄屏用竖向）。今天高亮。
- 每天显示：日期、星期（代码算）、节日、天气、上班/上学或放假、一个有名字的公共大事件；点开看约 200 字的内容。
- 「今天」来自 `storyToday(host)`。为 `null` 时显示「剧情里还没有日期。在剧情状态里打开后台整理，或让 AI 在回复中写明日期」，不生成。
- 右上角「刷新日历」按钮。

**生成**

- 照搬玉子小日历 `sourceData.note` 的字段规则、内容方向（公共事件、不写主角和 NPC 私人行程、7 天不重复），输出改成 JSON：`{"days":[{"date":"YYYY-MM-DD","festival":"","event":"","status":"上班/上学|放假","weather":"","content":""}]}`。
- 只让 AI 生成**缺的日子**：今天推进了 1 天，就只请求新进入窗口的那 1 天，其余保留（照玉子「更新规则」第 2 条）。跳得太远（和旧窗口没有重叠）就整窗重生成。
- 自动：今天的日期变了就生成（在纪要 controller 整理完后检查一次即可，不单独订阅事件）。
- 校验：`date` 要落在窗口里；`status`、`weather` 不在枚举里就留空；`event` 为空的那天丢掉，下次再补。
- 存 chat metadata 键 `st_stage_calendar`：`{ v: 1, days: CalendarDay[] }`。星期和「与今天的关系」不存，显示时算。

## 日记：放进「小剧场」App 的第四个标签

**效果**

- 便签式卡片：日期、角色名、第一人称约 200 字。`~~被划掉的话~~` 渲染成删除线、淡色；`PS:` / `PPS:` 单独一段放卡片底部（照 `diary.js` 的样式思路）。
- 最多 5 篇，同一天每个角色一篇。

**生成**

- 照搬玉子小日记 `sourceData.note` 的字段规则和内容方向（不全知、贴人设、`~~` 和 PS/PPS 的用法），输出 JSON：`{"diary":[{"role":"","content":""}]}`。
- 跟广场/论坛/直播放在**同一次请求**里，在小剧场的 JSON 结构里加 `diary` 字段，不另发请求。
- 日期用 `storyToday(host)`；没有日期时用空串，规则按「同一聊天只保留最近一批」处理。
- 合并规则：日期变了 → 整批替换；日期没变 → 同角色覆盖，新角色追加，超过 5 篇删最早的。
- 渲染 `~~` 时用 `textContent` 分段拼 DOM，不用 `innerHTML`。

**小剧场改动**：`theater/types.ts` 加 `DiaryEntry` 和 `diary` 字段；`generate.ts` 的提示词、`normalizeFeeds`（`role` 和 `content` 非空才保留）、`mergeFeeds` 按上面规则合并；`theater-app.ts` 加第四个标签（方向键循环改成 4）。旧数据没有 `diary` 字段时当空数组。

## 不做

- 不做月历视图、切换年月（玉子有，先不做）。
- 不往主聊天注入日历或日记。
- 不手动编辑日历和日记。

## 验证

- 单测：日历窗口推进 1 天只请求 1 天、跳远整窗重建、枚举校验；日记合并三种情况、`~~` 和 PS 的渲染（jsdom）。
- `pnpm vitest run st-extension/src/apps/chronicle st-extension/src/apps/theater st-extension/src/apps/shared`、`pnpm typecheck`、`pnpm lint`、`pnpm build:ext`。
