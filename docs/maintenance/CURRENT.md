---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 4d635f4efb9801396dc9a55815278e70d2fcf963
remote_code_head_at_update: 4d635f4efb9801396dc9a55815278e70d2fcf963
build_version: 0.9.0+202611052252
phase: wechat-current-contact-entry-published
updated_at: 2026-11-05
updated_by: Codex
verification_source: 54-wechat-tests-typecheck-lint-11-host-workflow-checks-and-58-file-parity
history: docs/maintenance/history/2026-11-05-wechat-current-contact.md
previous_history: docs/maintenance/history/2026-11-05-publication.md
---

# 当前项目状态

当前发布 **0.9.0+202611052252** 修复从角色卡进入微信时未加入该角色的问题：每次进入会话列表都会补上当前角色，已有会话不重复创建或重置，未选角色不创建占位联系人。开发提交 **`4d635f4`**、扩展发布 **`6e6eb95`** 均已推送两个仓库的 `main`；本会话 A–G 成果继续包含在发布中。日常 SillyTavern 安装目录和用户数据未修改。[原隔离实测入口](http://127.0.0.1:18771/) 已更新且保留原 mvu-data。

## 本轮行为

- 首页角色概览移至 App 网格底部，默认折叠并记住偏好。
- 微信从会话列表进入，可在酒馆与 A 聊天时联系 B。稳定角色身份、独立历史/草稿/未读/状态，旧记录保留；在途回复归原会话，不读取另一个主聊天或 MVU。
- 明确的右上角设置；常用字段直接编辑，通用/联系人专用两个目标，保存后重开一致；模板收起，保存/失败反馈固定在底部。
- 全部聊天/状态/格式提示词可见、可改、可恢复、可预览；单次回复 JSON 同步内心想法和当前状态。钱包、天数、生活费和第二次评估退出新工作流。
- 表情分组预览、修改、启停与图库导入；历史素材快照。红包支持任意内容和附言。

## 当前修复证据与产物

新增 4 项入口回归先复现失败后通过；微信模块 **9 文件 / 54 项**通过，类型及定向 lint 通过。真实隔离 ST 320×667 完成 **11 组流程检查、6 次 axe 扫描零检出**，保留 2 条 incomplete 规则。源码/预览/分发/安装仓库 **58 文件**一致，实际仅 bundle/version 变化。18771 HTTP 已核对版本和 bundle SHA-256 `75a90031849a832a6ec451af11366d7280a7ac54eec262c520113c31ceb54391`；临时 18772 已停止。

[当前交接](history/2026-11-05-wechat-current-contact.md) · [候选与清单](../../test-results/release-2026-11-05-2252/) · [回归报告](../../test-results/wechat-entry-2026-11-05/browser/report.json) · [用户体验清单](UNIFIED-ACCEPTANCE.md) · [微信说明](../WECHAT.md)。日志与备份是本地忽略产物；远端维护者可按提交和交接摘要追溯。

## 前一版 A–G 验收（2119）

最终相关 **9 文件 / 68 项**通过；此前全量 113 文件/1416 项经 3 个沙盒夹具权限失败重跑收敛。类型/lint、855 翻译键、最终 Next 与扩展构建、58 文件一致性、12 发布工具、25 网页移动 E2E 通过。

真实 ST 四档布局共 **40 组流程检查、24 次 axe 扫描零检出**，保留 8 条不确定规则记录。桌面/320/390 对应 2114；2119 只补消息滚动区键盘入口与焦点轮廓，横屏完整复核通过，前面未变化业务证据仍保留原构建号。真实 AI/实体设备/完整读屏不在该自动证据内。

[发布记录](history/2026-11-05-publication.md) · [验收汇总](../../test-results/release-2026-11-05-2119/acceptance-summary.json) · [功能交接](history/2026-11-05-wechat-experience.md) · [用户体验清单](UNIFIED-ACCEPTANCE.md) · [微信说明](../WECHAT.md)。发布前按相同构建时间重新生成的 58 文件与验收候选逐一哈希一致；同步后源码/预览/分发/安装仓库完整一致。bundle SHA-256 为 `fa33178e26c32faf369c3fe040839a2b3bb80a3d529de60f222d1a44a568f07b`，与实际 18771 HTTP 一致；自动 18772 服务已停止。测试日志和备份为本地忽略产物，远端仓库中的证据摘要见发布记录。

## 既有成果与边界

A–F 成果与 G 一起提交发布：原生 Connection Manager、角色推荐、卡片分支与选择恢复、图库存储/分享、逐类恢复/导出、Renderer/管家修复以及手机可视区定位。历史证据见 [F 交接](history/2026-11-05-character-play-mobile.md)。旧微信跟随主聊天、MVU 数值/钱包和双阶段请求已由本轮独立会话契约取代，不再要求用户验收旧行为；变量 App 自身的 MVU 能力保留。

发布前已 fetch 两个 origin，均与本地基线一致；正常快进推送，没有重写历史。最新扩展同步备份及回执在 `test-results/wechat-entry-2026-11-05/ext-backup/`。群聊/朋友圈、完整账户恢复、素材托管、真实 AI/实体设备/完整读屏验收仍属后续范围；[DEFERRED](DEFERRED.md) 已记录本次提交对历史未发布状态的取代关系。

远端 Actions 因当前 API/浏览器无可用读取登录而未确认；本地验收和产物一致性通过不代表远端 CI 通过，详情见发布记录。
