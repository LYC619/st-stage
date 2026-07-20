# progress.md — 会话日志

## 会话 1 · 2026-07-06

- 完整梳理代码库架构（core / 适配层 / 双端 UI / esbuild 构建链路），结论写入 findings.md §1
- 发现历史欠账：`hideTagInMessage` ST 端无实现（Web 端有），列入 M3
- 调研关键技术事实：catbox 随机文件名与 CORS 限制、ST 扩展目录更新覆盖风险、canvas WebP 压缩可行性 → findings.md §2
- 创建三份规划文件：task_plan.md（M0–M5 六个里程碑 + 6 个决策点）、findings.md、progress.md
- M0 完成：用户全部同意 6 个决策点，附加要求「代码规范性 + 前端体验性」→ findings.md §5

### M1 完成（格式统一，core 层）

新增文件：
- `core/naming.ts` — tag/包名/描述/路径片段清洗（naming 是所有入口的守门员）
- `core/share-code.ts` — stpack1 一行分享串编解码
- `core/migrate.ts` — v1→v2 存储迁移（needsMigration + migrateSettings）
- `core/*.test.ts` × 5、`vitest.config.ts`、`eslint.config.mjs`

修改：
- `core/types.ts` — sprite-pack@2：SETTINGS_VERSION=2、Sprite.code、getSpriteSource、getPackCover、renderInlineImages、imageHost
- `core/pack-io.ts` — 导出 @2 / 导入兼容 @1，tag 清洗去重
- `core/sprite-store.ts` — 单图操作 upsert/remove/rename/moveSprite
- `st-adapter.ts` / `web-adapter.ts` — 接迁移；ST saveImage 防路径穿越
- `sprite-manager.ts` — 新建包名/上传文件名过清洗
- `tsconfig.json` target ES6→ES2020；package.json 加 test/typecheck 脚本
- `components/*.tsx` — 移除失效的 eslint-disable 注释

验证：41 单测 ✅ lint ✅ typecheck ✅ build:ext ✅ next build ✅

### M2–M5 完成（同会话连续推进）

**M2 图库管理**：sprite-manager.ts 全量重写为两级视图（包卡片列表 → 立绘网格详情）。单图改名/替换/删除/排序/设封面；上传自动压缩（新增 core/image-compress.ts）；包元数据编辑；修复 innerHTML 注入隐患（全部 textContent）；Esc/键盘/触屏适配。

**M3 消息后处理**：新增 core/inline-image.ts（[插图:编码] + <img>编码</img> 双语法）与 st-extension/src/message-postprocess.ts（渲染事件 + TreeWalker 文本节点处理，幂等指纹）。补上 hideTagInMessage ST 端实现。分享串完整链路：详情页按编码添加 → 复制分享串；列表页粘贴导入。Web 模拟器同步支持。

**M4 手机框架**：core/phone-registry.ts（App 注册表）+ core/phone-shell.ts（手机壳，拖拽阈值区分点击）+ core/phone-shell.css（双端共用样式，build.mjs 拼进产物 / globals.css import）。ST 内置 3 个 App（立绘/图库/设置），window.stStage.registerApp 开放第三方。Web 端 phone-mount.tsx 桥接（latest-ref 模式）。settings 加 phone/apps 字段（migrate 兼容）。

**M5 规范发布**：docs/APP-SPEC.md（接入示例/生命周期/ctx API/样式类/安全红线）、README 重写、manifest 0.2.0。

**最终验证**：54 单测 ✅ lint ✅ typecheck ✅ build:ext（index.js 66kb）✅ next build ✅

**遗留（需用户/真实 ST 环境）**：
1. git 提交（含根目录产物 index.js/style.css）
2. findings.md §4 待验证清单：真实 ST 中渲染事件名、saveBase64AsFile 路径、移动端表现
3. 三期候选：图床直传（需 server 插件代理 CORS）、第三方 App 动态加载

## 会话 4 · 2026-07-20（四期续：楼层内立绘 + 移动端适配）

- 新设置 `spriteDisplayMode: overlay/inline/both`（立绘显示位置）：inline/both 时消息后处理把 `[立绘:xxx]` 原位替换为立绘图片（`matchAddress` → `sprite.url`，本地上传/内嵌/图床三种图源通吃，**不依赖图床正则**）；inline 时悬浮窗隐藏。按气泡 `.mes[ch_name]` 逐条解析绑定包，群聊也正确。匹配不到的标签退回「隐藏标签」语义。
- core：`tag-parser.replaceTags()` 新增（含测试）；migrate 补默认值（无需 bump 版本，loadSettings 每次全量重建字段）。
- 移动端适配：悬浮窗/手机图标渲染时视口钳位（只钳显示不改持久化坐标）+ `resize` 重钳；拖拽补 `pointercancel`（浏览器手势接管时保位置、不误判点击）；触屏缩放手柄 20→28px；悬浮窗宽度钳到视口内。
- 双端同步：设置面板 + 手机设置 App + Web 模拟器（config-panel 下拉、chat-simulator 楼层内渲染同逻辑）。
- 坑：message-postprocess/chat-simulator 旧占位符是**真 NUL 字节**写在源码里（Edit 工具匹配不上，Read 显示成空格）；已统一改为 `\0` 转义字面量 + `split('\0')` 字符串切分（奇数位=元素序号，避开 no-control-regex）。
- 验证：87 单测 ✅ lint ✅ typecheck ✅ build:ext ✅ next build ✅；manifest 0.3.0 → 0.4.0；README 补说明。产物 index.js/style.css 已重建，待用户提交。
- 真机反馈修复：管理弹窗在手机上顶部被截断/窗口过大 —— `100dvh` 与移动端浏览器 fixed 可视区不一致（地址栏/工具栏、ST 缩放），改为弹窗 stretch 撑满 backdrop（inset:0 恒等于真实可视区，全程不用视口单位）；手机端封面卡片墙加密为自适应约 3 列。
