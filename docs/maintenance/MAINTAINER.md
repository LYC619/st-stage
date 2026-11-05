# 百工维护指南

百工（STS / `st-stage`）是给 SillyTavern（ST）使用者的功能平台：在聊天页放一部小手机，里面是立绘、图库、变量、API 切换、渲染、导出与性能管家。典型流程是导入图包、绑定角色、让 AI 输出 `[立绘:微笑]`，扩展解析后切换角色图片；普通卡无需改成专用卡。用户流程从 [首页](../../README.md)、[立绘指南](../SPRITE.md)、[变量指南](../VARIABLES.md) 和 [管家指南](../BUTLER.md) 进入。

## 回来后先核对哪里

1. 读 [CURRENT](CURRENT.md)：区分本工作树、生成目录与实际发布仓库。核心界面翻译、键盘维护和微信均已合入 `main`；当前本地任务及验收边界以 CURRENT 和关联执行计划为准。
2. 按 [PROTOCOL](PROTOCOL.md) 检查 `git status --short --branch`、`git worktree list`、`git branch -avv` 和代码基线。记录过期时先用 Git 和相关 history 校正；提交检查不会覆盖未提交修改。
3. 查 [DEFERRED](DEFERRED.md)，判断本次修改是否碰到已知边界。设计理由在 [specs](../superpowers/specs/)，实施过程在 [plans](../superpowers/plans/) 与 [history](history/)；计划中的勾选不单独证明已经实现或发布。

历史分支已经合并清理，不再依赖旧分支名读取成果。追溯实现时使用 CURRENT 中记录的提交及 `history/`；判断当前能力时核对实际源码和 `package.json`。

## 准备与运行

在选定的源码工作树根目录执行。Node **22** 来自 [CI](../../.github/workflows/ci.yml)；pnpm **10.32.1** 来自 [package.json](../../package.json) 的 `packageManager`，依赖精确解析以 `pnpm-lock.yaml` 为准。2026-10-24 当前 shell 实测 Node `v22.14.0`、pnpm `10.32.1` 可调用。测试模拟器基本交互无需服务端密钥；访问真实 AI、图床或 ST 数据是另外的环境能力。

```powershell
pnpm install --frozen-lockfile
pnpm dev
```

打开 `http://localhost:3000`，预期看到聊天模拟器、立绘与手机入口。停止服务用 Ctrl+C。安装和启动是操作说明，本次文档整理没有重新执行。模拟器经 [WebAdapter](../../lib/web-adapter.ts) 用浏览器 localStorage 保存模拟设置，不能证明真实 ST 的磁盘保存、API 档案或性能设置有效；管家在这里降级为只读指南。

真实 ST 的新安装使用首页给出的 `st-stage-ext` 地址。开发验收应使用隔离 ST 用户目录和合成数据，确认设置页显示的构建号；不要把日常 settings 或完整备份当测试夹具。ST 设置由 [STAdapter](../../st-extension/src/st-adapter.ts) 的 `extensionSettings.sprite_overlay` 和宿主延迟保存管理，保存函数返回不代表磁盘已落盘，必须重载确认。图床/API 密钥是宿主设置中的明文数据；分享/导出不应含密钥。

## 从需求找到代码

双端共享的纯逻辑在 `core/`；真实宿主接线在 `st-extension/src/`；`app/`、`components/`、`lib/` 提供 Next.js 网页模拟器。手机里的 App 是注册到百工底座的功能模块，不等于另装一个 ST 插件。

| 要改什么 | 先看入口与逻辑 | 数据和边界 |
| --- | --- | --- |
| ST 初始化、事件与持久化 | [index.ts](../../st-extension/src/index.ts)、[st-adapter.ts](../../st-extension/src/st-adapter.ts)、[adapter 契约](../../core/adapter.ts) | 宿主事件/Prompt/图片接口；不要把宿主全局对象引入纯 core |
| 手机外壳或新增 App | [phone-shell.ts](../../core/phone-shell.ts)、[phone-registry.ts](../../core/phone-registry.ts)、[内置清单](../../st-extension/src/apps/index.ts) | 生命周期与自动清理；App 私有状态在 `settings.apps[appId]`；先读 [APP-SPEC](../APP-SPEC.md) |
| 立绘选择、注入与切换 | [sprite-store.ts](../../core/sprite-store.ts)、[prompt-builder.ts](../../core/prompt-builder.ts)、[tag-parser.ts](../../core/tag-parser.ts)、[overlay-dom.ts](../../st-extension/src/overlay-dom.ts) | 图包、角色/聊天绑定与标签地址；网页显示在 [sprite-overlay.tsx](../../components/sprite-overlay.tsx) |
| 图库、导入与图片保存 | [sprite-manager.ts](../../st-extension/src/sprite-manager.ts)、[pack-io.ts](../../core/pack-io.ts)、[image-storage.ts](../../st-extension/src/image-storage.ts)、[image-persistence.ts](../../st-extension/src/image-persistence.ts) | ST 用户图片 URL/外部托管；迁移需备份、分阶段应用、收据恢复，不自动清理孤儿图片 |
| 变量与 HUD | [newvar-app.ts](../../st-extension/src/apps/newvar-app.ts)、[newvar/runtime.ts](../../st-extension/src/apps/newvar/runtime.ts)、[mvu-app.ts](../../st-extension/src/apps/mvu-app.ts)、[variable-tree.ts](../../st-extension/src/apps/variable-tree.ts) | 新变量逐楼快照与 App 设置；MVU 依赖宿主第三方数据，不与新变量互相代替 |
| API 连接档案 | [api-app.ts](../../st-extension/src/apps/api-app.ts)、[api/manager.ts](../../st-extension/src/apps/api/manager.ts) | 私有设置与宿主模型连接；排错勿打印密钥 |
| 结构化回复渲染 | [renderer-app.ts](../../st-extension/src/apps/renderer-app.ts)、[renderer/runtime.ts](../../st-extension/src/apps/renderer/runtime.ts)、[parser.ts](../../st-extension/src/apps/renderer/parser.ts) | `<STStageRender>` 协议；无效内容回退原文，卡片只填输入框 |
| 管家性能与恢复 | [butler-app.ts](../../st-extension/src/apps/butler-app.ts)、[butler/bridge.ts](../../st-extension/src/apps/butler/bridge.ts) | 修改宿主 `power_user`，需快照恢复；[BUTLER](../BUTLER.md) 解释选项 |
| 标准 ZIP 导出 | [cloud-export/README](../../st-extension/src/apps/cloud-export/README.md)、[export-app.ts](../../st-extension/src/apps/cloud-export/export-app.ts)、[bridge.ts](../../st-extension/src/apps/cloud-export/bridge.ts) | 合成新下载包，不写回 ST；不是完整账户备份；ZIP 导入另行验收 |
| 设置结构与升级兼容 | [types.ts](../../core/types.ts)、[migrate.ts](../../core/migrate.ts) | 默认值、版本迁移与历史用户数据；不要随产品改名重命名持久化 key |
| 中英文本 | [i18n.ts](../../core/i18n.ts)、[字典目录](../../st-extension/locales/)、[用法与支持范围](../i18n-usage.md) | 核心界面及五个主要 App 已支持中英文；其余 App 和实体设备/读屏验收另见 CURRENT |
| 微信角色对话 | [wechat-app.ts](../../st-extension/src/apps/wechat/wechat-app.ts)、[conversations.ts](../../st-extension/src/apps/wechat/conversations.ts)、[pipeline.ts](../../st-extension/src/apps/wechat/pipeline.ts) | 按独立联系人保存历史/草稿/状态；不读取另一个主聊天或 MVU；区分合成响应与真实 AI 验收 |

一条典型链路：图库导入经 `pack-io` 校验，图片准备成功后写入图包与绑定；`index.ts` 用 `sprite-store` 和 `prompt-builder` 给当前角色生成清单，经 STAdapter 注入宿主。宿主消息事件回来后用 `tag-parser` 提取标签、`sprite-store` 寻址，再由 DOM overlay 显示。设置通过 adapter 保存。修改标签格式会同时影响解析、注入和寻址；修改图片路径会碰到导入、存储与备份，不能只改界面。

## 做一次小修改

例如修复标签识别：先读 `tag-parser.ts` 及旁边的 `tag-parser.test.ts`，明确原有地址兼容规则，运行定向单测，再依实际影响扩大检查。纯文档调整只需检查事实、路径和 diff，不需要重建产品。

```powershell
pnpm exec vitest run core/tag-parser.test.ts
pnpm typecheck
pnpm lint
pnpm test --maxWorkers=4 --no-file-parallelism
pnpm build
```

定向测试证明受测逻辑，类型与 lint 检查静态约束；全套测试与 Next 构建仍不能证明真实 ST 的宿主行为。UI 变更另看 [设计走查](../DESIGN-WALKTHROUGH.md)；`pnpm test:mobile` 是 Playwright 的网页移动视口检查，首次需安装其 Chromium，不是物理手机或 OS 输入法验收。控制测试并发以免重型测试与构建争用资源。

当前微信真实宿主回归入口为 `node scripts/verify-wechat-experience-browser.mjs --url http://127.0.0.1:18772/ --isolated-data`，须先启动独立自动测试 runtime/data。脚本会替换测试配置，明确拒绝使用保留用户实测数据的 18771；也不能指向日常账户。旧 `verify-wechat-mvu-browser.mjs` 只对应已退出新微信流程的历史主聊天/MVU 数值契约，见 [历史记录](history/2026-11-04-real-mvu-acceptance.md)，不要用于验收独立微信。若隔离 runtime 通过 junction 复用依赖，用 `node --preserve-symlinks server.js ...` 保持 WASM 路径位于 runtime 内；不要关闭宿主文件路径或聊天完整性校验来绕过错误。

角色配置/原生档案/分支的整体验收使用 `node scripts/verify-character-play-browser.mjs --url http://127.0.0.1:18769 --isolated-data`；九 App 六档手机检查使用 `verify-mobile-apps-browser.mjs`，参数相同。它们会替换测试配置，使用同一用户的宿主脚本须顺序执行。`PLAYWRIGHT_CHANNEL=msedge` 可让脚本和网页移动回归复用已安装 Edge。Playwright 输出固定到 `test-results/playwright/`，不要将其清理目录设成整个 `test-results/`，其中还有隔离数据与候选包。失败时的布局附件用于区分产品、宿主样式和夹具问题。

打包脚本会覆盖跟踪产物并改变构建号。修改产品后，用统一入口以同一时间戳生成根目录与分发目录：

```powershell
pnpm build:all
node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution
```

`build:ext` 单独写根目录；`build:st` 单独写 `st-distribution/`；`build:all` 同批生成两处产物，包括语言文件与微信素材。CI 使用已提交的 `version.json` 时间戳重建以核对产物。打包不是发布；发布的八文件清单和三方比较见 CURRENT。生成的 `bundle.js`、根目录 `style.css`、locale 副本不应手改。

准备可审阅的安装包时，先完成上述构建和适用验收，再执行：

```powershell
pnpm test:release
pnpm release:prepare --output test-results/release-candidate --release ../st-stage-ext
```

输出目录必须尚不存在；重跑请选新的目录名。命令验证八个基础文件、源 README 的 LF 归一结果，以及源目录/预览/分发中的完整微信素材清单和 SHA-256，然后写入 `package/` 与 `release-report.json`。报告列出相对安装仓库的新增、修改和待移除素材；不修改安装仓库，不构建、不提交也不推送。报告写入成功才表示准备完成。产物一致只证明文件一致，不能替代源码重建和真实宿主验收。

需要核验已发布副本时运行 `node scripts/verify-runtime-parity.mjs --root . --distribution st-distribution --preview public --release ../st-stage-ext`。待发布产物与旧安装仓库不同是正常差异；准备命令报告差异，发布后校验命令则要求完全一致。

现在可用同步工具取代手工复制。默认只预览；实际同步应在当前任务已授权更新安装仓库后执行，并指定尚不存在、位于候选和安装仓库之外的备份目录（父目录须存在）：

```powershell
pnpm release:sync --candidate test-results/release-candidate --release ../st-stage-ext
pnpm release:sync --candidate test-results/release-candidate --release ../st-stage-ext --backup ../st-stage-ext-backup-YYYYMMDD-HHmm --apply
```

工具校验候选清单/哈希、独立安装仓库身份和干净状态，拒绝路径冲突及符号链接；先备份旧安装产物，再逐文件替换、检查最终清单。普通写入失败会自动回滚并写入备份目录的 `sync-report.json`。备份中 `originals/` 保留原文件；`rollback-failed` 或进程被强制终止时应停止后续发布，对照回执的 `previous`、`expected` 和 `changes` 手动恢复，再验证哈希。逐文件原子替换不等于整个批次可抵抗断电。工具不提交、推送、拉取、重写历史或设置远端。

2026-11-05 已在用户授权后实际同步 `st-stage-ext` 并完成提交推送；备份、哈希、提交和验证记录见 [发布记录](history/2026-11-05-publication.md)。失败回滚验证仍来自临时仓库，真实同步未发生失败。人工实测入口见 [统一验收](UNIFIED-ACCEPTANCE.md)。

## 故障定位与设计理由

| 现象 | 首查与下一步 |
| --- | --- |
| 更新了但界面没变化 | 对照 ST 设置页构建号、目标仓库 `version.json` 和 bundle；先判断源码/生成目录/发布仓库是否同批，历史版本号不足以证明本次已加载 |
| 网页正常、ST 出错 | 从 STAdapter、真实宿主事件/接口与主题入手；用隔离用户目录重现，记录 ST/浏览器版本与构建号 |
| 图片迁移后容量或显示异常 | 从存储对话框、图片持久化与收据检查，核对备份后重载；不在真实用户数据上反复试迁移；未验收项看 DEFERRED |
| 改 App 后状态丢失或副作用重复 | 检查 settings 迁移、App 命名空间、生命周期清理与 Prompt 通道；先找对应邻近测试 |
| 旧文档称已验收、文件却不同 | Git 和实际文件优先，保留旧记录时间，写更正和证据，不沿用旧结论 |

- 平台与 App 分层、ctx 能力及自动资源回收的契约见 [APP-SPEC](../APP-SPEC.md) 与 [能力层设计](../superpowers/specs/2026-07-28-ctx-capability-layer-design.md)。新 App 开发流程仍复用 [.claude/skills/st-app](../../.claude/skills/st-app/SKILL.md)，提交行为服从当次授权。
- 独立分发的理由是减小安装历史负担，同时保留旧安装的更新链；[拆分决定](history/2026-08-29-push-and-distribution-split-decision.md) 解释为何不能复用旧仓库名。
- 图片迁移选择用户显式执行、先备份与可恢复收据，背景见 [存储迁移计划](../superpowers/plans/2026-09-05-storage-migration.md) 和 [修复记录](history/2026-09-07-maintenance-repairs.md)。更新扩展本身不会自动瘦身历史设置。

交接时更新 CURRENT、必要的 history 和 DEFERRED，按 PROTOCOL 区分代码完成、自动验证、实际宿主验收、打包与发布。本次检查仅为静态阅读、Git/文件核对与导航验证；尚无真实维护者按本文完成小任务的试用结果。
