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
- 验证：**176 单测 ✅ lint ✅ typecheck ✅ build:ext ✅（index.js 126kb，产物与源码 SHA 一致）next build ✅**。git diff 无临时文件/调试代码/NUL。产物 index.js 已重建（style.css 无变化）。**已提交并推送 `8856cf0` → origin/main**。
- 未处理（不在本次 7 项范围）：next.config `ignoreBuildErrors:true` 仍在（P2）、`.pnpm-store/` 未 gitignore、coverTag 分组歧义。

## 会话 6 · 2026-07-24（codex 复审 3 项加固）

`8856cf0` 后 codex 复审提出 2 个重要逻辑缺口 + 1 个 UX 回退，本会话全部修复：

- **P1 · CRUD 身份统一为「有效地址」**：`sameIdentity` 原先只比 sprite 自身 group/outfit，而地址解析会继承 `pack.roleName/outfit`；显式写入与包级相同的字段会被当成两张、却映射到同一地址（Web 上传路径可造此数据）。改为 `sameIdentity(pack,s,tag,group,outfit)` 按 `effectiveRole/effectiveOutfitOf`（含包级继承）判定；`upsertSprite` 写入前经 `normalizeIdentityFields` 清除与包级相同的冗余 group/outfit，存储恒为最简有效地址。upsert/remove/rename/setSpriteGroup 全部改传 pack。
- **P1 · 包名别名稳定唯一 + 单包兼容**：解析新增 `lockByRole`——先按语义人名锁定，无匹配再按裸包名兜底（**单包也认包名**，多包停用回单包后历史 `[立绘:包名/图名]` 仍可解析）。`flatten`/`getActiveAddresses` 共用同一前缀。
- **P2 · Web 立绘 App 去掉缩略图**：`phone-mount.tsx` 删除 `so-app-sprite-strip` 预览块与 `onPreviewSprite`，立绘 App 只保留状态 + 设置（与 ST 端及既定产品分工一致：立绘负责设置、图库负责图片/图包）；`page.tsx` 同步移除 prop。

## 会话 7 · 2026-07-24（codex 再审：别名设计返工）

会话 6 的别名方案被 codex 判定有确定缺陷（P1×2，另两项已确认修好，本轮只动别名）：
1) 4 位截断哈希 `shortId` 真实 genId 格式下会碰撞（`pack_mdy0_000000` 与 `pack_mdy0_000001` 都得 `1wke`）；
2) 后缀只在当前启用集合冲突时才加，同名包停用一个后剩余包别名回退无后缀，历史带后缀地址失效；
3) 裸包名可能与另一包的 `roleName`/图片 `group` 冲突，`lockByRole` 仍命中第一个。

返工后的稳定唯一方案（`core/sprite-store.ts`）：
- **规范别名 = `包名@判别码`**：判别码 `packDisc` 取**完整** pack.id（去 `pack_`、只留 tag 安全字符），无截断无哈希 → 不同 id 必不同码，且与启用集合无关（修 ①②）。分隔符 `@` 在包名与 tag/group/roleName 中均被禁止，故地址含 `@` 必为规范别名，可无歧义识别。
- **prompt 前缀 `buildPromptPrefixes`**：默认裸包名；当裸包名与**其他包**的 roleName / 任意 sprite.group / 另一裸包名冲突时才升级为规范别名，保证生成地址真正唯一（修 ③）。升级只影响显示。
- **解析 `lockByRole`**：地址含 `@` → 只按 `canonicalAlias` 精确匹配（全局唯一、与启用集合无关；目标包不在启用集则严格 null，绝不误落别包）；不含 `@` → 先语义人名、再裸包名兜底。规范别名恒可复算，故停用/切换后历史带后缀地址永久兼容（修 ②）。
- 验证：**184 单测 ✅（同名包唯一+各归各 / 完整 id 无碰撞含 codex 复现对 / 规范别名停用后仍解析且不误落 / 别名与启用序无关 / 别名⇄roleName 冲突升级；另 CRUD 有效地址与单包兼容测试保留）lint ✅ typecheck ✅ build:ext ✅（index.js 128.2kb，含 buildPromptPrefixes/packCanonicalAlias/packDisc/ALIAS_SEP）全树+产物零控制字节**。

## 会话 8 · 2026-07-25（Codex 接手：规范 token 与安全旧址解析）

会话 7 的过滤式完整 ID 与按冲突升级前缀仍不能提供严格单射、全量稳定的多包地址。本轮按书面规格重新实现，并以本节为当前最终状态：

- **多包统一规范 token**：每个候选均使用 `<可读名称>@<p|r>=<完整ID编码>`；`p` 表示无语义人名的包名兜底，`r` 表示 `sprite.group` / `pack.roleName`。单包继续输出原有简写。
- **ID 编码严格单射**：保留 `[0-9A-Za-z_-]`，其他 UTF-16 code unit 编为 `~hhhh`，不删除 `pack_`、不截断、不哈希；空 ID 使用专用值 `~e`。覆盖相邻生成 ID、标点、Unicode、`~`、控制字符与空串边界。
- **规范解析按 ID 锁包**：`p` 忽略可变的可读包名，因此包改名后历史地址仍有效；`r` 同时精确校验当前语义人名；含 `@` 但格式错误、目标包停用或类型不符时严格返回 `null`。
- **旧裸地址安全兼容**：语义人名与裸包名共同参与候选过滤，跨包多解返回 `null`，不再静默落到第一个包；同一包内多个分组/服装共享纯图名时仍保留旧的首项行为。
- **CRUD 有效地址修复保留并补强**：`upsertSprite()` 清理历史重复有效地址，`setSpriteGroup()` 排除源项自身并规范化继承字段；Prompt 最终地址按首次出现顺序去重。
- 设计与实施记录：`docs/superpowers/specs/2026-07-24-stable-sprite-alias-design.md`、`docs/superpowers/plans/2026-07-24-stable-sprite-alias.md`。
- 最终复验：**190 单测 ✅ TypeScript ✅ ESLint ✅ build:ext ✅（index.js 129.5kb）Next.js build ✅；新 helper 已进入 bundle，旧 `buildPromptPrefixes/packDisc/shortId/buildPackAliases` 均不存在，源码/测试/产物控制字节为 0，工作树保持未提交供 Claude 复审。**

## 会话 9 · 2026-07-25（大图包 token 成本策略草案）

用户确认不把“切换图包后主动重绘旧楼层”作为核心功能，因此上一节的“始终 canonical”实现不再是最终产品方向。本轮仅形成待审设计，尚未改代码；绑定变化只保证后续新消息和当前悬浮窗，不增加全楼层 fingerprint/重处理链路：

- 上游在导入/合并/绑定时检查有效 `role + outfit + tag` 冲突；允许安装同名包，但阻止会产生歧义的启用集合，并提供替换/合并/取消。
- 下游恢复短语义地址，异常脏数据仍跨包多解返回 `null`；不再让每张图片携带完整包 ID。
- `full` 改为按场景分组，`repeat` 改为共有表情 + 场景增量；大系列建议按角色拆包、统一 tag 词表。
- 大包运行时改为命中式/有界预加载，避免激活时遍历全部图片。
- 完整草案：`docs/superpowers/specs/2026-07-25-semantic-sprite-address-and-large-pack-design.md`，等待 Claude Code 审查和用户确认后再实施。

## 会话 10 · 2026-07-25（短语义地址与大图包方案实现）

Claude Code 复审 v2 规格后，用户批准按“取消主动换肤、上游约束冲突、下游短地址失败安全”的方向实施。本轮已完成：

- **短语义地址取代 canonical token**：多包 Prompt 恢复 `角色/表情`、`角色/服装/表情`；运行时不再生成或解析 `@p=` / `@r=`。脏数据若跨包多解则严格返回 `null`，冲突地址也不会进入 Prompt。解析先匹配 Prompt 的最终有效 role，仅完全无命中时才回退裸包名兼容别名，避免“某包角色名 = 另一包包名”让合法地址失效。二段地址严格表示空服装，服装图只能由三级地址命中。
- **核心冲突边界原子化**：新增 `core/address-policy.ts`，以变更后的最终包集合计算有效坐标；`bindPack`、`setBinding`、`bindCharacter`、`toggleBinding`、活动包 `upsertPack` 均返回判别联合，冲突时设置不发生部分修改。Web/ST 只提交 `ok: true` 的 settings。
- **Prompt 压缩且可逆**：`full` 按场景列出表情，`repeat` 使用“共有表情（适用于全部场景）+ 各场景其余表情”；比较完整字符串的 UTF-16 `length`，同长选择 full。50 角色 × 20 共有表情（1000 组合）已有回归测试。
- **大包加载有界**：新增 `core/sprite-preload.ts`；激活预加载最多 4 张、命中序列最多 10 张并按 URL 去重，超出部分按需加载。inline 楼层仍由 `recentFloors` 独立限制，不扫描整包。
- **导入/绑定合并策略**：新增 `core/pack-merge.ts`；同 URL 自动去重，不同 URL 按候选序号选择；同一脏包同址多图也可精确选择。choice 对未知/重复 key、非安全整数、负数、越界和缺失选择均严格拒绝，输入顺序不改变结果；双端在询问结果包名前预检，并区分用户选择错误与内部异常。导入只在同名或真实有效地址冲突时提示，不再把不同包名的普通同 tag 误报为冲突。绑定合并始终包含待启用包，源包保留供其他角色使用。
- **双端交互一致**：Web/ST 导入支持合并、重命名、仅安装、取消；绑定冲突支持替换、合并、取消；单包追加第二包前预览地址变化。ST 冲突/取消会重置 selector，最终校验失败先重渲染再提示，避免控件与持久化设置不一致。
- **明确不做**：不因 packs/bindings 变化重处理历史 inline 楼层，不修改消息 fingerprint；切包只影响后续消息和当前悬浮立绘。
- **最终验证**：**18 个测试文件 / 228 tests passed**；TypeScript `--noEmit`、ESLint、扩展构建、Next 生产构建均通过。`index.js` 已重建为 **149118 bytes（约 145.6kb）**，包含 `findAddressConflicts`、有效 role 优先解析、`inspectPackImport`、严格 choice 校验、有界 preload 与 ST 失败重绘逻辑；运行时 canonical helper/标记搜索为 0。59 个源码/测试/产物文件控制字节为 0，含规划文档的 68 文件复扫也为 0；`git diff --check` 通过（仅 CRLF 提示）。
- 工作树按用户要求保持**未提交、未推送**，供 Claude Code 继续复审；用户既有 `components/phone-mount.tsx` 修改已保留。
