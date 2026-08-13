---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 4317d0bdc5a9904bf1cf143b7d937dec46c0ea93
remote_code_head_at_update: bf44be7e75e08806eda8064543e9118b88ab133b
build_version: 0.9.0+202608132024
phase: round3-and-butler-ready-awaiting-real-sillytavern
updated_at: 2026-08-13T20:39:01+08:00
updated_by: codex
verification_source: codex-round3-butler-2026-08-13
history: docs/maintenance/history/2026-08-13-acceptance-round3-butler-performance.md
---

# Current Project Status

## Snapshot

- 第三轮真实 ST 实测暴露的问题与管家 2.0 已在分支 `codex/butler-performance-2-design` 完成，代码与固定构建产物提交为 `4317d0b`。
- 当前尚未合并或推送；`origin/main` 仍为 `bf44be7`。产品版本保持 `0.9.0`，构建戳为 `0.9.0+202608132024`。
- 自动化门禁已完成。下一步是从该分支安装到真实 SillyTavern，复验修复项并执行管家新增验收；通过后再决定 `1.0.0`。
- API 管理本轮未改。维护者已确认 OpenAI 兼容快速切换基本满足需求，冷门同格式渠道不再扩充；后续只按真实用户反馈修复。

## Delivered Scope

### Round Three Fixes

- 消息编辑后会重新处理立绘与 Renderer；关闭“隐藏立绘标签”或变量块隐藏后可恢复原始可见内容，原始聊天数据不被改写。
- Renderer 支持唯一、合法的裸 JSON 保守恢复；提示词明确要求用户主动测试或指定 Galgame/选项卡/战斗模式时必须输出结构化块。
- 立绘不透明度改为滑块并即时预览；悬浮窗眼睛按钮可直达立绘 App。
- 普通图包按角色显示多层卡片并横向展开，批量模式强制平铺；选择框与“使用中”标记不再遮挡。
- 图包卡片显示“本地 / 云端 / 本地+云端 / 部分本地”资源状态。
- 预设包保存本地改为同 ID 覆盖，不再生成“（本地）”副本；用户可编辑预设元数据、恢复内置信息，并保留远程地址供分享与回退。
- 旧“表情”版内置 Prompt 在未被用户修改时精确迁移到当前压缩底稿；三种地址形式与塞拉菲娜预设矩阵已覆盖回归测试。

### Butler 2.0

- 四层可解释体检：聊天与消息 DOM、主线程与渲染、媒体与资源、扩展与配置。只展示可观测事实和不可用原因，不生成综合分。
- 支持固定 6 秒静置采样与受控滚动探针；聊天切换、页面隐藏、生成或用户干预会使样本取消或失效。
- 一键安全方案只降低或保持现有开销，不会把用户更低的 FPS 或消息加载数调高；无有效动态样本时先自动采基线。
- 每次动作先保存分组事务，再读取实际值；支持同探针复测、可比性判断、冲突保护恢复和最近 10 次记录，App 数据总预算 64 KiB。
- 扩展治理只调用 SillyTavern 1.18.0 官方启停接口；支持依赖警告、自身保护、选定扩展 A/B、二分隔离、跨刷新续接和完整恢复。
- 最初禁用清单同时保存在 App 数据、可用时的 `localStorage` 和控制台恢复命令；受限存储环境会安全降级，不再阻断其他 App 注册。
- World Info、Vector Storage、Summarize、Regex 与服务端建议位于独立只读顾问，不进入安全优化方案，不自动改变生成语义。
- Capability Layer 5b dogfood 已完成并形成候选结论，详见 `docs/maintenance/history/2026-08-13-butler-capability-dogfood.md`。

## Recorded Verification

Fresh automated evidence represented by code head `4317d0b`:

- Vitest：69 files, 868/868 tests passed。构建测试通过时将 `TEMP/TMP` 指向仓库内临时目录，以避开沙箱对用户临时目录的读取限制。
- TypeScript typecheck and full ESLint: passed.
- Next.js 16.2.6 production build with Turbopack: passed.
- Playwright：25/25 across desktop Chromium, Pixel 7, and Galaxy S8. 沙箱内 Chromium 启动被权限层阻断后，使用批准的项目限定命令完成复跑。
- Extension build tests：15/15，包含在全量 Vitest 中。
- `git diff --check` passed；`core/prompt-builder.ts` 无真实 NUL 字节。
- 固定戳根目录与 `st-distribution/` 双轮重建稳定；4 个共享文件 SHA-256 逐项一致。
- `st-distribution/` 恰好 6 个文件，不含图片、`public/`、`reference/` 或预设源码。
- Frozen install was attempted but not verified：本机 Corepack 离线时无法解析锁定的 pnpm 10.32.1，包装命令又因无 TTY 拒绝重建 `node_modules`。其余门禁使用现有锁文件对应的依赖树完成，`pnpm-lock.yaml` 未修改。

These are automated and source-review results only. The real-ST items below remain manual evidence.

## Next Real SillyTavern Acceptance

### Runtime And Renderer

1. 从该分支更新已安装扩展，确认设置页显示 `0.9.0+202608132024`，且聊天/角色切换后立绘与 Renderer 注入仍会自愈。
2. 编辑已有 AI 消息再保存，确认立绘与 Renderer 立即重处理；进入编辑再取消不会让渲染永久失效。
3. 分别开关“隐藏立绘标签”和变量块隐藏，确认可见内容能恢复，重新加载聊天后原始消息没有被改写。
4. 让模型明确“测试 Galgame 能力”，确认其输出结构化协议并成功渲染；再验证唯一合法裸 JSON 可恢复、错误或多段 JSON 保留原文。
5. 复验 Galgame、选项卡、战斗三种 Renderer 的流式、交互、设置变化与源文本兜底。
6. 复验立绘悬浮窗滑块的即时透明度变化，松手后持久化；点击眼睛按钮可直接打开立绘 App。

### Gallery And Prompt

7. 普通模式下，同角色图包以首包封面堆叠并横向展开；切到批量管理后全部平铺，选择框不被“使用中”覆盖。
8. 检查纯云端、纯本地、同时本地+云端和部分本地图包的资源标签是否与实际图片地址一致。
9. 将一个内置预设保存到本地，确认仍是同一张卡、同一 ID 和原绑定，没有“（本地）”副本；失败可重试，成功项不会重复下载。
10. 编辑预设角色名、服装名、备注和别名并重载，确认覆盖持久化；恢复内置信息后本地图片仍保留。
11. 复验上传预览、默认关闭自动拆分、包启用清单、分页、批量排序/删除/上传与分享串。
12. 删除本地图片时检查 Network：只请求安全的 `/user/images/` 路径；500 保留元数据供重试，404 可收敛为已删除。
13. 对旧“表情”版未修改底稿升级，确认自动迁移到“图名”压缩版；用户自定义 Prompt 不应被覆盖。
14. 检查塞拉菲娜注入内容包含共有图名、服装增量、`_变` 后缀、战损缩水集合和缩进备注，不再出现旧输出格式。
15. 真机生成并解析 `[立绘:图名]`、`[立绘:服装/图名]`、`[立绘:角色/服装/图名]`；错误、歧义或跨角色地址不能误显示。

### Butler 2.0

16. 在同一长聊天分别运行 6 秒静置和受控滚动探针；滚动位置恢复，切后台、切聊天、生成或用户干预会取消并给出重试说明。
17. 检查四层报告只展示原始证据、设置摘要和不可用原因，没有综合分或未经 A/B 证明的因果结论。
18. 在 FPS 或消息加载数已更保守时应用安全方案，确认不会被调高；无动态样本时应先完成基线再写设置。
19. 应用后逐项查看“改了什么、为什么、影响、是否刷新、怎么恢复”，用同一探针复测，并完整恢复事务前实际值。
20. 修改一个动作后的字段再点恢复，确认出现冲突提示而非静默覆盖；重复复测始终与本次事务前基线比较。
21. 禁用一个可牺牲的第三方扩展并刷新，确认其脚本和样式未加载；恢复后重新加载。系统扩展默认不进入候选，st-stage 自身不可选。
22. 选择有依赖关系的扩展，确认依赖警告和二次确认；批量操作部分失败时不刷新，也不能继续给出错误的二分判断。
23. 运行选定扩展 A/B 与一次二分隔离，确认跨刷新续接；结束时 UI、`localStorage` 紧急副本和控制台命令都能恢复最初禁用清单。
24. 在 Chrome 与不支持部分 Performance API 的环境各体检一次，确认支持项显示真实值，不支持项明确降级且不造数。
25. 检查玩法/服务端顾问默认只读；管家历史不得包含 Key、Prompt、聊天正文或带查询参数的完整 URL。

## Deferred

- Renderer snapshot image-listener restoration.
- Conservative Renderer HTML detection.
- Cleanup/catalog expansion for the 143-file reference source set and selection of owned long-term hosting.
- Extraction/publishing automation for the generated standalone ST distribution repository.
- Product semantic version decision after real-ST acceptance.

See `docs/maintenance/DEFERRED.md` for details.

## Next Actions

- 安装分支 `codex/butler-performance-2-design` 的构建，执行上方 25 项真实 SillyTavern 验收并记录失败项。
- 只修真实验收暴露的问题；API 管理不扩张渠道矩阵，除非真实用户反馈证明当前 OpenAI 兼容路径不足。
- 全部阻断项通过后，再将 `manifest.json` 与构建产物升级为 `1.0.0`，重新跑发布门禁，然后合并并推送。
