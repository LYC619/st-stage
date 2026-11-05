# 2026-11-04 路线 A/B/C 本地交接

后续补验：同一 `0.9.0+202611042042` 构建已完成指定版本的真实 MVU 微信联动 5/5，见 [真实 MVU 记录](2026-11-04-real-mvu-acceptance.md)。以下保留本批结束时的事实；末尾「缺少明确版本 MVU」已由该补验更新，真实 AI/设备/读屏仍待验收。

用户授权按既定路线建立 goal 并持续执行。交付是本地实现、可审阅候选包及可用环境验证，不包含提交、推送或实际发布。分支仍为 `main`，HEAD / 本地 `origin/main` 均为 `c8c73bb03fd874ca90217bde74652c4d9b3ecc55`，本轮未 fetch。`4b615fec2898d55f4d71cfb25770d85abea3ac99` 的祖先与产品差异检查通过；以下修改未提交。

## 行为与文件

**A 稳定交付**：原生 fetch 接收者修复、图片往返与 ZIP 逐类恢复详见 [路线 A](2026-11-04-roadmap-a.md)。新增 `scripts/release-artifacts.mjs`、`prepare-release.mjs`、Node 回归与 CI 检查；验证八个基础文件、源分发 README 和 50 个微信素材。候选包工具只写新目录，不改安装仓库。旧 parity 夹具补齐新契约，多文件差异仍一次报告。

**B 角色入口**：`role-summary.ts` 汇总角色/聊天、图包、立绘、新变量、外部变量、渲染与微信配置状态，双端接入共用 phone-shell。图包状态采用既有绑定；外部变量异步读取带代次保护，不重挂当前 App。六项状态可键盘激活，未选角色/未定义变量/功能关闭/无外部接口分别说明。中英文新增 26 个翻译键。

**C 微信通用配置**：新增 `profile.ts`、`profile-editor.ts` 和回归测试；桥接层读取四项显式路径，pipeline 按预设区分提示词、素材和本地回复，微信设置保存规范化配置。默认同居行为保持，通用新会话不附加家庭背景、不发每日生活费；已有消息/数值不因预设切换重置。配置在全部微信会话共用，消息仍按角色身份和主聊天分开。表情/照片沿用既有 ID 和含义，可替换 HTTPS/用户图片路径。外部字段只读，旧映射在途读取在保存时失效；发送中阻止切换配置。设置使用共用对话框焦点管理，Escape 返回入口；素材按钮可键盘激活。说明见 [WECHAT](../../WECHAT.md)。

额外回归先失败后修复：首次创建会话丢失传入 profile；保存新映射后旧读取覆盖状态；编码的用户图片路径穿越。设置长表单移除遮挡输入的吸底操作条。历史媒体 ID 仍可回退显示；不新增群聊、朋友圈或逐角色预设库。

## 最终构建与校验

构建：`0.9.0+202611042042`。根 bundle SHA-256：`1c7dfef83919c8231dd04c3c8c54c5760081fc76af04d6164ecba6d444ee99cc`。

| 检查 | 结果与证据 |
| --- | --- |
| `pnpm typecheck` / `pnpm lint` | 退出 0 |
| 全量 `pnpm test --maxWorkers=4 --no-file-parallelism --reporter=dot` | 102 文件 / 1365 项全部通过，228.17s；`test-results/roadmap-2026-11-04/final-vitest.log` |
| 微信聚焦回归 | 最后仅调整操作条布局后，2 文件 / 37 项再次通过；其余已测逻辑未变化 |
| `pnpm test:release` | 7/7，涵盖匹配、缺失/损坏/多余素材、过期 README、输出差异/不改安装仓库、失败不产包 |
| i18n | 785 对应键、863 引用及插值参数通过 |
| `pnpm build` | Next.js 16.2.6 构建成功，2 个静态路由；`test-results/roadmap-2026-11-04/next-build.log` |
| `pnpm build:all` + parity | 同批构建根目录/分发，源/预览/分发素材及 58 文件校验通过 |
| `git diff --check` | 退出 0 |

全量首次运行的旧 parity 夹具失败和 A 批证据保留在路线 A 历史；本表为修复后的结果。没有将历史 1352 项记录冒充此次运行。

## 实际宿主证据

用户确认 ST 路径为 `D:/6.YULE/ST/SillyTavern-1.18.0`。仅复制程序/default/public 到 `test-results/roadmap-2026-11-04/runtime`，依赖目录使用 junction，独立新 data 与 restore-data-v2；没有读取/复制日常账户、聊天或密钥。浏览器 Edge 143.0.3650.80，阻断外站网络，测试扩展禁用 auto_update。依赖 WASM 路径仍有缩略图转换警告，不作为图片转换或云图验收。

| 脚本/边界 | 结果 |
| --- | --- |
| `verify-role-browser.mjs` | 最终构建 4/4：中英文 × 1365/320；角色切换，状态直达、键盘返回、边界和 44px 状态行，以及 Role Bob 从未绑定经图库管理器绑定 Role pack 后返回 Home 更新 |
| `verify-wechat-profile-browser.mjs` | 最终构建 2/2：旧记录、设置重载、通用开场、显示名按文本、实际素材加载、主聊天 0/2、隔离会话、显式映射、外部字段只读、每次请求 2/1/1（独立/外部/外部故障）、503 回退；AI 与变量均为测试替身 |
| `verify-storage-browser.mjs` | 最终构建 5/5：一次上传去重、51868 字节回读、保存重载、回执选择性恢复、失败/取消、JSON 导入先准备再安装 |
| `verify-export-browser.mjs --scenario desktop-en` | 最终构建 1/1，包含注入类别失败/重试、键盘与下载 ZIP 内容检查。原即时焦点断言曾撞上异步替换控件，改为 Playwright 有界重试 `toBeFocused` 后通过；产品导出代码未改变 |
| `verify-export-restore-browser.mjs` | A 批新用户实际 PNG/JSONL 导入及世界书/预设/设置 API 恢复后重载，5/5；A 原包保留为 `test-results/export-restore-browser/source-a.zip`。最终 ZIP 容器哈希不同，但六个文件载荷逐字节一致；无需重复导入来证明同一载荷 |

以上报告分别在 `test-results/{role-browser,wechat-profile-browser,storage-browser,export-browser,export-restore-browser}/results.json`；浏览器页面错误均为 0。微信脚本等待真实 chatId 后再验证，避免同角色重选与相同主聊天标记造成夹具竞态。截图中 320px 均为浏览器模拟，不代表物理设备或真人易用性实验。

交接时已停止任务创建的 18769/18770 隔离 ST 服务，确认两端口不再监听；保留忽略目录内的合成数据和报告供复核。浏览器外站请求由路由阻断；ST 后端自身仍尝试读取公共模型元数据并记录网络失败，不涉及用户凭据，不将该状态称为完全离线宿主。

## 候选包与剩余门禁

`pnpm release:prepare --output test-results/release-2026-11-04-2042 --release ../st-stage-ext` 成功，`package/` 含 58 个已逐一哈希校验文件，同级 `release-report.json` 为差异与哈希记录。相对安装仓库：5 修改（bundle/style/version/两份 locale）、53 不变、0 新增、0 移除。独立安装仓库 Git 状态干净；旧 A2 包只是阶段性证据，不是最终候选。

源文件、生成产物、脚本、测试、README/指南/维护文档保留在工作树，没有提交、合并、推送或发布。完整变更清单以 `git status --short` / `git diff` 为准。

原生整包 ZIP 导入和完整账户恢复不在通过范围。缺少专用真实 AI 连接、明确版本的第三方 MVU 与实体设备/读屏环境，因此相应验收门禁继续开放，步骤见 [EXTERNAL-ACCEPTANCE](../EXTERNAL-ACCEPTANCE.md)。本地实现及发布准备已完成；实际发布应在处理这些门禁和获得发布授权后执行。其余历史 deferred 项保持原范围。
