# 2026-08-10 第二轮验收修复与 1.0 发布门禁

## 范围与提交

- 基线：`origin/main` `55e0b981bcf27ab6503c8237b2eac40a9a28bed8`。
- 设计与三批实现：`9e9f75e`、`c8e629f`、`a0925e9`、`1238e00`；完成计划记录：`3441d48`。
- 分支：`codex/acceptance-round2`；本记录创建时尚未合并或推送。
- 产品版本仍为 `0.9.0`，构建戳更新为 `0.9.0+202608100134`。按维护者决定，真实 SillyTavern 复验通过后再升 `1.0.0`。

## 第一批：真实运行时稳定性

- 新建聊天、切换聊天与角色时立即重注入，并在 DOM 稳定后延迟自愈。
- 流式阶段只消费新增的完整立绘标签，生成结束后以最终消息为权威结果。
- 新变量更新块默认只在 DOM 中隐藏，原始聊天数据保持不变且关闭功能可恢复。
- 不透明度只作用于悬浮窗，楼层立绘保持 100% 清晰；上传操作按钮保持横排。
- Renderer 与插图协议说明补齐，避免把打字机动画、流式生成和 `<img>` 插图标签混为一谈。

## 第二批：图库与资源边界

- 同角色图包改为真实多层卡片堆叠：收起时使用首包封面，点击后横向展开；同一时间只展开一组。
- 增加选中图包的批量上传云端、保存本地、复制分享串；失败汇总可重试。
- 删除图包可选仅删元数据或同时删除安全范围内的 `/user/images/` 文件；仍被未选图包引用的文件不删除。
- 五套塞拉菲娜云端预设共 102 张图片，扩展和 `st-distribution/` 不再携带旧演示图片。
- `st-distribution/` 保持独立安装边界，仅包含 manifest、README、loader、bundle、style 和 version。

## 第三批：Prompt、相对地址与 API 门禁

- 同角色具名服装支持 `[立绘:图名]` 默认服装和 `[立绘:服装/图名]` 相对地址；角色、服装或图名有歧义时拒绝猜测，完整三级地址继续兼容。
- 自动精简新增角色级基础图名池、服装增量、`_变` 后缀和缩水服装列表。默认服装不属于重合簇时回退旧场景压缩，不生成不存在的组合。
- **“带场景备注时的 Prompt 压缩性能优化”已经解决，不再延期**：备注挂在服装行下方，压缩仍生效；塞拉菲娜 fixture 验证结果短于全量格式。
- 未修改的内置提示词底稿仍走自动精简；预览和实际注入共用 `buildActiveSpritePrompt`，字符数包含真实场景备注。
- API 档案保留明文 Key，并在界面如实说明。新建 Chat 档案只列 OpenAI、Claude、OpenRouter、Google AI Studio 和自定义 OpenAI 兼容；历史冷门渠道档案仍可编辑。
- 对照 SillyTavern `release/public/scripts/openai.js` 修正四个常用原生渠道的模型控件 selector，并用独立 fixture 验证设置字段、DOM selector、密钥槽位与连接顺序。

## 审查修复

两路只读审查在全量验证前发现并修复了三项真实问题：

1. Prompt 与解析器对“可用相对地址”的判断条件不一致，现统一按最终有效角色/服装地址判断。
2. 旧 `role/tag` 在角色存在但没有无服装图时可能回退到另一角色的同名服装，现明确拒绝跨角色回退。
3. V0 的四个原生模型 selector 使用了设置字段名，测试也复制了错误；现改为 SillyTavern 官方 `#model_*_select` ID。

## 自动化证据

- Vitest：54 个文件，625/625 通过。
- TypeScript `tsc --noEmit`：通过。
- ESLint：通过。
- Next.js 16.2.6 production build：webpack 模式通过。隔离 worktree 的外部 `node_modules` 链接会触发 Turbopack root 限制，属于验证环境限制，不是应用构建错误。
- Playwright mobile：Pixel 7 与 Galaxy S8 共 22/22 通过；webpack dev server 在测试结束后已关闭。
- 扩展构建测试：15/15 通过。
- 根目录与 `st-distribution/` 的 `index.js`、`bundle.js`、`style.css`、`version.json` SHA-256 全部相同。
- `st-distribution/` 共 6 个文件，图片、`public/`、`reference/`、预设源目录命中数为 0。
- `git diff --check`：通过。

以上全部是自动化或源码审查证据，不等于真实 SillyTavern 人工验收。

## 仍需真实 SillyTavern 验收

以 `CURRENT.md` 的 1.0 清单为准，重点是安装更新后的缓存击穿、新聊天与流式回复、真实模型生成的 Renderer/变量/立绘标签、图库文件 API、云端预设加载与本地化、以及常用 API 渠道的 Key/模型/连接回验。
