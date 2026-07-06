# task_plan.md — st-stage 二期扩展

> 创建于 2026-07-06 · 状态图例：⬜ 未开始 / 🔵 进行中 / ✅ 完成 / ⏸ 暂缓

## 目标

把 st-stage 从「单一立绘悬浮窗插件」升级为「手机形态的可扩展 App 框架」，本期落地四件事：

1. **格式统一**：图片命名规范 + 导入导出格式升级（sprite-pack@2）
2. **图库管理 + 图床分享**：单图级管理（改名/删除/替换/排序）、本地压缩导入、catbox 编码分享链路
3. **手机 UI 框架**：悬浮手机壳 + App 启动器，立绘成为第一个 App
4. **App 规范**：内部 App 注册 API + 开发文档 + 示例 App，为第三方开发铺路

## 非目标（本期不做）

- 图床直传（catbox CORS 受限，需 ST server 插件代理 → 列入三期候选）
- 第三方 App 动态加载（远程代码执行有安全风险，本期只做规范+示例）
- 多角色同屏多立绘、立绘动效（Live2D 等）

## 里程碑

### M0 · 决策定稿 ✅

- [x] 用户确认 6 个决策点（全部同意，另加要求：代码规范性 + 前端体验性）
- [x] 决策写入 findings.md「决策记录」

### M1 · 数据模型与格式统一（core 层）✅

- [x] `core/naming.ts`：tag/包名/描述/路径片段四类清洗函数 + 长度上限
- [x] sprite-pack@2 schema（types.ts）：settingsVersion、Sprite.code、图源推导 getSpriteSource、包封面 getPackCover、updatedAt、renderInlineImages/imageHost 设置
- [x] `core/share-code.ts`：stpack1 紧凑分享串编解码（@host/@author 元数据、防 javascript: 注入、容忍聊天杂文）
- [x] `core/migrate.ts`：v1→v2 存储迁移（容错解析、图床 URL 反推 code、不丢图原则）
- [x] `pack-io.ts` 升级：导出 @2；导入兼容 @1；tag 清洗去重；恶意包名清洗
- [x] `sprite-store.ts` 单图操作：upsertSprite / removeSprite / renameSprite（同步 coverTag）/ moveSprite
- [x] 两端适配器接入 migrateSettings；ST 端 saveImage 路径片段清洗（防路径穿越）
- [x] 工程规范：eslint.config.mjs（flat config）+ vitest + typecheck 脚本；41 个单测全过；lint/typecheck/build:ext/next build 全绿

### M2 · 图库管理增强（双端 UI）✅

- [x] 单张立绘：重命名 tag、删除、替换图片、前移/后移排序、设封面（ST 管理弹窗立绘网格）
- [x] 批量导入 + 客户端压缩（canvas → WebP，`core/image-compress.ts`，最长边 1024/质量 0.85，失败安全回退原图）
- [x] 包元数据编辑（名称/作者/描述/封面）；预设包只读语义（提示导出后再导入为自定义包）
- [x] 管理弹窗重构为两级视图（列表卡片 → 详情网格），全部 textContent 渲染（修复 innerHTML 注入隐患）
- [x] Esc 关闭/返回、键盘可达（role/tabIndex/aria-label）、触屏 hover 降级

### M3 · 消息后处理 + 图床分享链路 ✅

- [x] `core/inline-image.ts`：插图标记解析（[插图:编码] 首选 + <img>编码</img> 兼容社区惯例）
- [x] `st-extension/src/message-postprocess.ts`：挂 CHARACTER_MESSAGE_RENDERED（缺失回退 MESSAGE_RECEIVED+延迟），TreeWalker 只处理文本节点（无注入面），幂等指纹防重复处理
- [x] 补上 `hideTagInMessage` 的 ST 端实现（历史欠账）
- [x] catbox 手动分享流程：详情页「按编码添加」（表情+图床文件名）→「复制分享串」（含跳过明细提示）
- [x] 导入分享串：列表页粘贴导入（双端）；设置增加 imageHost 可配
- [x] Web 模拟器同步实现插图渲染 + 分享串导入/导出（全链路可本地测试）

### M4 · 手机 UI 框架 ✅

- [x] `core/phone-shell.ts` 手机壳（无框架 DOM 双端复用）：悬浮 📱 图标（拖拽/点击区分阈值 6px）、状态栏+时钟、Home 屏 App 栅格、Home 键（App 内→返回，Home 屏→收起）、位置持久化（PhoneState 入 settings，migrate 兼容）
- [x] `core/phone-registry.ts` App 注册表：id 校验、order 排序、订阅刷新；mount/unmount 异常隔离
- [x] 内置 App（`st-extension/src/phone-apps.ts`）：立绘（绑定概览/表情点击预览/拉回视口）、图库（管理弹窗入口）、设置（开关+图床前缀）
- [x] `window.stStage.registerApp` 第三方注册入口
- [x] Web 模拟器接入同一手机壳（`components/phone-mount.tsx`，latest-ref 模式桥接 React）；样式抽到 `core/phone-shell.css` 双端共用（build.mjs 拼接 / globals.css import）

### M5 · App 规范与发布 ✅

- [x] `docs/APP-SPEC.md`：一分钟接入示例、生命周期表、PhoneAppContext API、样式类清单、安全红线
- [x] README 重写：功能分区（立绘链路/图库/分享/手机框架）、开发命令、数据格式说明
- [x] manifest.json 版本 0.1.0 → 0.2.0；`pnpm build:ext` 产物已重新生成（index.js 66kb）
- [ ] （交用户）git commit 产物 + 在真实 SillyTavern 中实测验证清单（见 findings.md §4）

## 待决策（M0，需用户拍板）

| # | 问题 | 我的建议 |
| --- | --- | --- |
| 1 | 分享形态：JSON 文件 + 一行紧凑分享串，两者都做？ | 都做：JSON 为完整档案，分享串为社交传播 |
| 2 | 消息内插图渲染（`<img>编码</img>` → 气泡内图）是否纳入本期？ | 纳入 M3，与隐藏标签共用同一后处理模块，边际成本低 |
| 3 | 图床直传是否推迟？ | 推迟到三期（CORS 需服务端代理），本期手动上传+回填编码 |
| 4 | 手机与立绘窗的关系？ | 手机=管理中枢+App 启动器，可最小化成悬浮图标；立绘窗仍独立悬浮（点立绘 App 时聚焦它），不塞进手机壳里 |
| 5 | 第三方 App 本期只做规范+示例，不做动态加载？ | 是，安全第一 |
| 6 | 技术选型：手机 UI 用无框架 DOM（双端复用）+ core 加 vitest？ | 是；不引 preact，esbuild 链路零改动 |

## 遇到的错误

| 错误 | 尝试次数 | 解决方案 |
| --- | --- | --- |
| （暂无） | | |
