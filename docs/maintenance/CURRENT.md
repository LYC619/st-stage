---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: d4d26a48bba66e930c561071a9fbcdc4f5c3687d
remote_code_head_at_update: d4d26a48bba66e930c561071a9fbcdc4f5c3687d
build_version: 0.9.0+202608182307
phase: merged-pushed-awaiting-real-sillytavern-round4
updated_at: 2026-08-19T00:28:03+08:00
updated_by: codex
verification_source: codex-acceptance-round4-2026-08-18
history: docs/maintenance/history/2026-08-18-acceptance-round4.md
---

# Current Project Status

## Snapshot

- 第四轮真实 ST 反馈已在 `codex/acceptance-round4` 完成，快进合并并推送到 `main`；代码与固定构建产物头为 `d4d26a4`。
- 产品版本保持 `0.9.0`，新缓存破坏构建戳为 `0.9.0+202608182307`。下一步只做真实 SillyTavern 复验，不在本轮宣称真机通过。
- 本轮修复变量块隐藏、同消息多 Renderer 块、Gal 人像兜底、图库单包/多包布局和标签管理，并把管家体检后的操作流程改成普通用户可执行的步骤。
- API 管理本轮未改；OpenAI 兼容快速切换继续作为当前常用渠道基线，冷门同格式渠道不重复扩张。

## Delivered Scope

### Message And Renderer

- 变量块隐藏不再要求整条原始消息与可见 DOM 完全相等。它从原始 `<UpdateVariable>` 证据生成保守载荷变体，兼容 `Analysis`、Markdown JSON 围栏和 ST Regex/Markdown/DOMPurify 清洗后的纯 JSON。
- 只有唯一、非空的可见载荷才会隐藏；重复或无法对应的内容保持原样。关闭隐藏、重新处理或离开编辑状态仍由快照恢复，不改写原始聊天数据。
- Renderer 单条消息可按顺序解析并独立挂载最多 3 个合法块；一个非法候选不会阻断相邻合法块，Cards + Battle 等组合不再整体失效。
- 每个 Renderer 块独立隐藏、恢复和销毁；一个模式挂载失败时只回退该块，不撤销已成功的兄弟块。
- Gal 未提供 `portrait` 时，按 `speaker` 精确匹配当前启用图包的角色名，并使用首个匹配包封面；显式 `portrait` 仍优先。
- Cards 选择项只填入 ST 输入框并提示用户检查发送，不自动发送，也不预生成未选择分支。

### Gallery And Images

- `SETTINGS_VERSION` 升至 7；图包新增 `kind: sprite | illustration` 与规范化 `customTags`，迁移、导入导出、分享串、合并拆分和预设覆盖均保留新字段。
- 同角色只有 1 个图包时按普通网格卡片排列；2 个及以上才显示多层堆叠和醒目的“`N 个图包`”，展开后横向浏览。批量管理继续全部平铺。
- 批量管理可设置“立绘/插图”类型、添加自定义标签和移除共有标签；角色标签由图包角色名只读派生，空角色显示为“其他”。
- 卡片继续显示本地、云端、本地+云端或部分本地资源状态；预设保存本地仍使用同 ID 覆盖，不再创建“（本地）”副本。
- 上传预览会检测透明通道和疑似烤入棋盘格并给出警告。不会运行可能误删白发、肤色或衣物高光的自动抠图。

### Butler Workflow

- 旧数据中“已应用但零动作”的空事务会被清理，不再错误隐藏主按钮。
- 主屏明确展示“开始检查 -> 查看发现 -> 应用建议 -> 再测一次或恢复”四步流程；建议存在时直接显示“立即应用 N 项建议”。
- “探针、事务、A/B、待复测、No Blur”等面向实现的词已替换为普通用户表述；对比失败原因也改为“检查方式不同”“页面状态不同”等可理解说明。
- “临时关闭扩展找卡顿”提供勾选、刷新、重复操作、保留或恢复的逐步引导；底层仍只调用 ST 官方扩展启停接口。
- “记忆与服务器设置建议”明确为只读，并按世界书、向量检索、自动总结、自动化规则和服务器设置解释用途与取舍。
- 详细结果页使用中文能力名称，继续只报告可观测证据，不生成综合分或虚构因果结论。

## Recorded Verification

Evidence represented by code head `d4d26a4`:

- 正式锁定依赖门禁在代码完成后运行：pnpm 10.32.1 frozen install 复用 533 个包、0 下载，`pnpm-lock.yaml` 未修改。
- 正式 Vitest 4.1.10：69 files, 887/887 passed；其中 extension build integration 15/15。
- TypeScript typecheck、完整 ESLint、Next.js 16.2.6 production build：passed。
- 最终补充复跑：本机 Vitest 3.2.4 执行同一 69 files / 887 tests，887/887 passed；用于确认最后的 E2E 文案修正未影响行为，不替代锁定版本结果。
- Playwright 1.62.0：25/25 across desktop Chromium, Pixel 7, and Galaxy S8。沙箱内 Chromium 首次为 `spawn EPERM`，批准的项目限定命令复跑通过。
- Playwright 复跑因本机依赖目录在 frozen reinstall 中被重建，使用同版本 Next 16.2.6 的 Webpack 开发服务器，并临时跳过缺失缓存的 `shadcn/tailwind.css`；行为、交互和溢出断言通过，但这不是生产依赖树的像素级视觉证明。
- `git diff --check` passed。
- 固定戳根目录与 `st-distribution/` 双轮重建稳定；4 个共享文件根目录/发布目录一致：
  - `bundle.js`: `C64679D52C3DBD1C1464B71BE9ACF32656E95FE3011C336F3BA4882F266BC638`
  - `index.js`: `D0E60A1B546D223922A7FBF01231B79205874963BDFFE4C963BD081347C9B849`
  - `style.css`: `0F27EE547B51D0048C54332720536A2303F8769B191A64495B8CD38492587E67`
  - `version.json`: `DD5B494839A9979F2BBF49FB69C31F3F9FADAFE7A83A350F735434A253F8EBF4`
- `st-distribution/` 恰好 6 个文件，不含图片、`public/`、`reference/` 或预设源码。
- 一次最终 frozen reinstall 因非 TTY 进入 CI 重建后耗时异常而中止；离线重试确认本机 store 缺 tarball，网络重试被沙箱 `EACCES`/审批限流拒绝。该过程未修改锁文件或已提交产物，但本机 `node_modules` 需要在有网络权限时重新安装。

These are automated and source-review results only. The real-ST items below remain manual evidence.

## Next Real SillyTavern Acceptance

### Runtime And Renderer

1. 从 `origin/main` 更新扩展，确认设置页显示 `0.9.0+202608182307`，聊天/角色切换后注入仍会自愈。
2. 用包含 `thinking`、Renderer、summary、Analysis、Markdown JSON 围栏和 `<UpdateVariable>` 的真实回复，开启变量隐藏后确认只隐藏目标载荷；关闭后立即恢复，重载聊天不改原消息。
3. 编辑已有 AI 消息再保存，以及进入编辑后取消，确认立绘和 Renderer 都会重新处理且不会永久失效。
4. 在同一条回复中放入 Cards + Battle 两个合法 Renderer 块，确认两者都渲染；再混入一个非法块，确认非法块保留原文、合法块仍工作。
5. 测试 1、2、3 个合法块和超过 3 个块的上限行为；关闭 Renderer 或切换聊天后，每个源块都能独立恢复且不重复挂载。
6. Gal 省略 `portrait`、只给精确 `speaker` 时确认使用启用图包封面；显式人像地址仍覆盖兜底，未知角色不误匹配。
7. 点击 Cards 选项后确认动作只进入输入框、不自动发送，并有明确提示。

### Gallery And Images

8. 同角色 1 个图包时确认普通卡片按响应式网格排列；2 个及以上才显示堆叠和数量，展开后横向浏览，批量模式全部平铺。
9. 批量选择多个包，分别设置立绘/插图类型、添加自定义标签、移除共有标签；重载后仍保留，分享/导入后字段不丢失。
10. 检查角色、类型、自定义标签和本地/云端资源标签在长名称、移动端和“使用中”状态下不遮挡选择框。
11. 将一个内置预设保存到本地，确认仍是同一张卡和同一 ID；编辑/恢复预设元数据不删除本地图。旧的云端未绑定“（本地）”副本可手动删除。
12. 上传透明 PNG、无 Alpha 图片和烤入棋盘格图片，确认透明 PNG 正常透出背景，后两类给出警告且不会破坏原图像素。

### Butler

13. 用含旧空事务的设置升级，确认体检后仍显示“立即应用 N 项建议”；应用后逐项看到改动、原因、影响、生效方式和恢复入口。
14. 按四步流程完成基础检查、应用、再次检查和恢复；检查普通用户文案中不再出现“探针、事务、A/B、待复测、No Blur”等实现术语。
15. 打开“临时关闭扩展找卡顿”，按引导临时关闭一个可牺牲的第三方扩展、刷新、重复操作并恢复；st-stage 自身不可选。
16. 打开“记忆与服务器设置建议”和详细结果，确认只读说明、中文能力名称和降级原因清楚，且不会自动改变生成语义。

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Renderer Cards pre-generated branch/pruning workflow.
- Cleanup/catalog expansion for the 143-file reference source set and selection of owned long-term hosting.
- Extraction/publishing automation for the generated standalone ST distribution repository.
- Product semantic version decision after real-ST acceptance.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- 从 `origin/main` 更新真实 SillyTavern 扩展，执行上方 16 项第四轮复验并只记录观察到的失败。
- 只修真机验收暴露的问题；API 管理不扩张渠道矩阵，除非真实用户反馈证明 OpenAI 兼容路径不足。
- 阻断项通过后再决定 `manifest.json` 是否升为 `1.0.0`，随后重新安装依赖并跑完整发布门禁。
