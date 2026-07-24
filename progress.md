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
- 真机反馈修复②：管理弹窗"打开没反应"三连 —— (1) 弹窗背景改主题色叠实底 + backdrop blur（部分 ST 主题 BlurTint 极透，弹窗整个看穿）；(2) 图库 App 打开管理前先收起手机壳（新增 collapsePhone dep）；(3) render() 兜错显示在弹窗内（移动端无控制台）。另：aspect-ratio 老内核兜底、README 补"更新后清浏览器缓存"提示。
- 真机反馈修复③：老内核浏览器（Chromium <87，常见国产壳浏览器）不支持 `inset` 简写 → 弹窗遮罩失去四边锚点整个塌成顶部一条黑条（页面也不变暗）。全部 inset:0 改四边长写 top/right/bottom/left:0。img 上的 aspect-ratio 老内核自然退化，无需处理。
- 真机反馈修复④：弹窗遮罩定位改为与手机壳同一套路径 —— JS 内联 px（innerWidth/Height + resize 重算），不再依赖 CSS 视口单位/四边锚点（各家移动端浏览器解释不一，手机壳的做法在真机上已验证可靠）。

## 会话 5 · 2026-07-24（codex 审查后 7 项修复收尾）

上个会话（session b1717ec2）按 codex 审查实现了 7 项修复，但在最后阶段（文档同步 + build:ext）遇 429 中断，未跑最终验证、未报告。本会话核实 7 项均已落地并跑通全套验证：

- **一 · 三级图片身份（group+outfit+tag）**：`sprite-store.ts` 抽出 `sameIdentity(s,tag,group,outfit)`，`upsert/remove/rename/setSpriteGroup` 均加 `outfit` 参数按三级定位；`sprite-manager.ts` 三处调用点（rename/setGroup/remove）传 `sprite.outfit ?? ''`。鸣人/居家服/微笑 与 鸣人/工作服/微笑 不再互相覆盖。
- **二 · 多包用包名兜底**：新增 `resolveRole(pack,sprite,multiPack)` = group > roleName > (多包时 `normalizeTag(pack.name)`)，**prompt 生成（getActiveAddresses）与解析（flatten→resolveSprite）共用同一函数**，杜绝「Prompt 写了包名但解析找不到」。单包仍简写 `[立绘:微笑]`。旧 `spriteRole` 只余 `share-code.ts`（单包分享，本就不该注入包名，正确）。
- **三 · remoteUrl 导入导出**：`types.ts` SpritePackFile 加 `remoteUrl`；`pack-io.ts` 导出保留合法 HTTPS remoteUrl（`remoteField`），导入只收 http/https 丢非法值；本地 url/data 与 remoteUrl 并存；round-trip 测试 + @1 兼容。
- **四 · imgbb 校验内置**：`imgbb.ts` 新增 `isValidImgbbResult`（success + HTTPS url + 合法 filename，拒 `../`、`a/b`），`uploadToImgbb` 无效直接抛错不返回空串；ST/Web 调用方仍保留本地保底。
- **五 · Web 迁移新 API**：`config-panel.tsx`/`phone-mount.tsx` 改用 `getActivePacks`（多包）、`parseSpriteFileName`（三级）、`createPhoneAppContext`；上传先存本地 data URI，imgbb 成功后写 remoteUrl/code，失败仍显示本地图。
- **六 · 真实 NUL 字节**：`prompt-builder.ts` sceneKey 已改 `|` 分隔（上个会话）。本会话补扫全树控制字节，发现并修复 `naming.test.ts` 残留的真实 0x00 与 0x1F（改 `\0`/`\x1f` 转义字面量，运行时不变）；全树 + index.js/style.css 零 C0 控制字节。
- **七 · setAppData 解耦**：`phone-registry.ts` 新增 `saveSettingsOnly` 路径 + `createPhoneAppContext`；`st index.ts`/`phone-mount.tsx` 接线，手机壳状态保存也走 saveSettingsOnly；`docs/APP-SPEC.md` 更新为真实行为。

- 范围守则遵守：characterName 绑定不动、multiRole 保留迁移字段、coverTag 分组歧义仅注释说明不改结构。
- 验证：**176 单测 ✅ lint ✅ typecheck ✅ build:ext ✅（index.js 126kb，产物与源码 SHA 一致）next build ✅**。git diff 无临时文件/调试代码/NUL。产物 index.js 已重建（style.css 无变化），**待用户提交**。
- 未处理（不在本次 7 项范围）：next.config `ignoreBuildErrors:true` 仍在（P2）、`.pnpm-store/` 未 gitignore、coverTag 分组歧义。
