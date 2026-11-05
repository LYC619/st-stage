# 2026-11-04 发布前集中收尾

用户要求把现有待办集中完成，再统一实测。本批已完成 [D1–D7](../../superpowers/plans/2026-11-04-release-readiness.md) 的本地修复、发布文件工具、最终构建与可用环境验收。真实 AI、实体设备/输入法、完整读屏和正式发布仍未执行，统一入口见 [实测清单](../UNIFIED-ACCEPTANCE.md)。

## Git 与授权边界

- 工作树：`D:/8.Project/0_0_维护/st-stage`，`main`，HEAD / 本地 `origin/main` `c8c73bb03fd874ca90217bde74652c4d9b3ecc55`；未 fetch。
- `verified_code_head` `4b615fec2898d55f4d71cfb25770d85abea3ac99` 的祖先检查及排除 Markdown 后的提交间产品差异检查均为 0。此前 A/B/C 全部未提交改动保留。
- 本批未提交、合并、推送或发布；没有启动子代理。安装仓库 `../st-stage-ext` 仍干净，HEAD `0b2401417b42a7b87bc41e86be7dc7fb4d0f081e`。
- 仅使用日常 ST 的程序资源和独立合成用户，未复制日常设置/密钥/角色/聊天，未修改日常扩展或连接。

## 行为变化

| 项目 | 最终行为与主要文件 |
| --- | --- |
| 分享封面 | `core/share-code.ts` 为 stpack2 增加可选、URI 编码的封面标签；仅保留可分享且真实存在的图片引用，保持图片原顺序，兼容旧码。宿主 UI 复制/导入及封面实际显示通过 |
| Renderer | `renderer/runtime.ts` 保存原节点及递归结构，恢复监听和宿主引用；既有 DOM 所有权检查继续保护迟到修改。`parser.ts` 缩小 HTML 检测，允许普通比较符号 |
| 导出身份/世界书 | 缺失或重复 avatar 时拒绝清单，避免在宿主 API 无法唯一读取时猜名字；世界书精确 ID/名称优先，忽略大小写仅接受唯一候选 |
| 导出取消 | 桥接读取传 AbortSignal，首个失败中止兄弟请求；取消停止新任务和迟到进度。ZIP 用 JSZip 公共流接口暂停；取消、卸载和下载前均检查信号。页面保留选择并返回导出按钮焦点 |
| 管家 | 逐槽恢复有效数据，损坏事务/实验的提示持久化；确认只清提示。二分候选为零或已到单个时停止无效循环，保留备份和实际禁用清单；不重新开放实验 UI |
| 发布同步 | `scripts/sync-release.mjs` 默认预览，显式 apply 校验候选/目标身份/干净状态/安全路径，备份后逐文件替换并核验，普通异常自动回滚。只测试临时 Git 仓库，真实安装仓库只预览 |
| 文档 | 管家旧版按钮/手动微调说明改为当前体检→建议→比较/恢复流程；分享、导出、维护、统一实测和共享状态同步更新 |

Renderer 历史条目的 `1<2 and 3>4` 在基线已经可解析；实际复现并修复的是 `x<y+3 且 z>4`。不把历史举例当作新的失败证据。

SillyTavern 1.18.0 的 `public/script.js` 保存 `world_info_settings: getWorldInfoSettings()`、加载时传 `settings.world_info_settings ?? settings`；`scripts/world-info.js` 返回 `world_info`，并读取 `settings.world_info?.globalSelect`。现有导出嵌套结构正确，此项只补源码核对与实际恢复证据。

同步工具的逐文件原子替换不等于断电安全的整批事务。强制终止或 `rollback-failed` 时，使用备份 `originals/` 和 `sync-report.json` 手动恢复，再核验。工具不负责 Git 提交、推送、远端或历史重写。

## 静态与单元门禁

| 检查 | 结果 |
| --- | --- |
| `pnpm test --maxWorkers=4 --no-file-parallelism --reporter=dot` | **102 文件 / 1,386 项通过**，206.22 秒 |
| D1 分享/包 IO | 2 文件 / 52 项通过 |
| D2 Renderer | 10 文件 / 99 项通过；新节点恢复/比较符号回归先失败后修复 |
| D3 导出 | 6 文件 / 98 项通过；最后两条中文 fallback 对齐后，翻译聚焦 16 项再次通过 |
| D4 管家 | 13 文件 / 181 项通过；新增 4 项先失败后修复 |
| `pnpm test:release` | **12/12**，旧准备/校验 7 项 + 新同步 5 项；preview/apply、磁盘错误回滚、脏/错目标、候选篡改、备份/junction 边界 |
| `pnpm typecheck`、`pnpm lint` | 退出 0 |
| `node scripts/verify-i18n-completeness.mjs` | **788** 对应翻译键、866 源引用/插值检查通过 |
| `pnpm build` | Next 生产构建成功 |
| `pnpm build:all` | 根目录/分发使用同批版本，预览素材同步 |
| `verify-runtime-parity --root . --distribution st-distribution --preview public` | **58 文件 / 50 微信素材** 完整清单与哈希通过 |
| `git diff --check` | 通过；没有提交 |

全量日志：[readiness-full-tests.log](../../../test-results/roadmap-2026-11-04/readiness-full-tests.log)。类型、lint、Next 和扩展构建日志同目录，前缀均为 `readiness-`。导出最初新增身份用例的夹具曾被 `it.each` 展开错位，修正夹具后通过；不把该夹具错误算作产品失败。最终全量后只修改两条 fallback 文本与验收脚本/文档，没有另改业务逻辑。

## 最终构建宿主验收

实际百工版本 **`0.9.0+202611042230`**，bundle SHA-256 **`54090a0c73eb5619b36b4b520e835dadf91454009601af61c6ab3da1ebd895aa`**。隔离安装名 `baigong-acceptance`，仅该副本的 manifest 禁用自动更新；浏览器回读的版本/bundle 与候选一致。

| 脚本 | 通过数 | 核对内容 |
| --- | --- | --- |
| `verify-role-browser.mjs` | 4 | 中英文 × 桌面/320px，角色首页状态、绑定和导航 |
| `verify-wechat-profile-browser.mjs` | 2 | 桌面/320px，场景配置、上下文 0/2、请求 1/2、外部只读、503 回退；AI/变量提供者为明确夹具 |
| `verify-storage-browser.mjs` | 5 | 图片迁移/上传/回读/重载/回执恢复，失败/取消及 JSON 导入 |
| `verify-export-browser.mjs` | 4 | 中英文 × 桌面/375px，取消后保持选择与焦点、重试下载、实际 ZIP 六项内容 |
| `verify-export-restore-browser.mjs` | 5 | 全新 `readiness-restore-data` 用户，宿主逐类 API 恢复角色、两份聊天、世界书、预设、正则/联动选择；重载后核对 |
| `verify-wechat-mvu-browser.mjs` | 6 | 真实助手/MVU 既有五项 + Variables App 改值/取消/新增/删除/重载；页面错误及宿主 API 失败为 0 |
| `verify-readiness-browser.mjs` | 3 | Renderer 比较符号与原图片节点恢复后 Enter 重试；管家损坏提示跨重载/确认；真实 UI 复制/导入后的封面与顺序 |
| `verify-i18n-browser.mjs` | 10 | 中英 UI、键盘/布局、宿主语言切换、缺失/损坏/超时字典回退 |
| `verify-gallery-browser.mjs` | 4 | 中英文 × 桌面/移动模拟，图库管理与键盘/焦点 |
| `verify-variables-browser.mjs` | 4 | 中英文 × 桌面/移动模拟，变量设计/编辑/取消/重载、HUD、无 MVU 时的提示 |
| **合计** | **47** | 全部对应最终构建，页面未捕获错误为 0 |

机器可读汇总与每套报告位置：[acceptance-summary.json](../../../test-results/release-2026-11-04-2230/acceptance-summary.json)。截图在各 `test-results/*-browser/` 目录，已检查 Renderer、管家提示及移动导出截图。剪贴板测试捕获页面生成的字符串，不写用户系统剪贴板；图片首次失败、分类 HTTP 失败和 AI 响应均为明确注入条件。真实 ZIP 由浏览器下载，恢复时按类型调用宿主 API，不声明原生整包/完整账户导入。

验收发现的环境/脚本问题已排除：酒馆 `.menu_button` 的 `display:flex` 会覆盖原生 hidden，已在最终 CSS 为隐藏的 App 按钮补规则并验证；新 Renderer 脚本最初写错选择器，改用实际 `.st-stage-renderer`；旧 i18n 脚本默认悬浮显示，连跑时继承了图片测试的 inline 模式，已通过真实立绘 App 显式选择悬浮模式后测复位，10/10 通过。这些与产品故障分别记录。

真实 MVU 的程序来源、原始哈希与启动约束沿用 [前次来源记录](2026-11-04-real-mvu-acceptance.md)：助手 4.11.3、MVU `74f930e` 未修改原包。浏览器放行必要 jsDelivr GET，响应哈希写入报告；ST 后端仍可能获取公共模型元数据，不宣称完全离线。常规验收用户禁用助手，真实 MVU 用户独立，避免把替身和真实组件混用。

## 候选与交接

`test-results/release-2026-11-04-2230/package/` 包含 58 个文件，[release-report.json](../../../test-results/release-2026-11-04-2230/release-report.json) 记录完整哈希。相对安装仓库是 **0 新增 / 5 修改 / 0 删除 / 53 不变**，仅 bundle、CSS、version 和两份 locale 变化。旧 `2042` 候选由本包取代，保留旧证据。

已执行 `release:sync` 默认预览，没有 `--apply`；安装仓库仍干净。测试端口 18769、18770、18771 已停止，独立数据/程序/日志保留在忽略目录供复核。当前源码/测试、脚本、文档及根目录/分发产物均可通过 Git diff/未跟踪文件审阅；没有提交或发布。

外部 AI、实体设备/OS 输入法、完整读屏与 WCAG AA、其他 MVU 版本及特定真实竞态继续按 [外部验收](../EXTERNAL-ACCEPTANCE.md) 记录。预生成分支、素材清理/扩库/托管、完整账户导入与远端发布基础设施不并入本批；旧 DEFERRED 条目待实际修复提交后再移除。
