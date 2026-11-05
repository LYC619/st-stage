---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: d3d513930d0e65124718d8b8b883645a340e447f
remote_code_head_at_update: d3d513930d0e65124718d8b8b883645a340e447f
build_version: 0.9.0+202611052119
phase: roadmap-and-wechat-published
updated_at: 2026-11-05
updated_by: Codex
verification_source: final-68-affected-tests-40-host-workflow-checks-24-axe-scans-and-25-mobile-web-tests
history: docs/maintenance/history/2026-11-05-publication.md
previous_history: docs/maintenance/history/2026-11-05-wechat-experience.md
---

# 当前项目状态

本会话 A–G 成果已按用户授权提交并推送到两个仓库的 `main`：开发代码 **`d3d5139`**，独立扩展发布 **`184e987`**，版本 **0.9.0+202611052119**。两个仓库都没有本次任务遗留的待合并分支。源码、兼容旧安装的根目录产物与独立扩展仓库已经同步；日常 SillyTavern 安装目录和用户数据未修改。[原隔离实测入口](http://127.0.0.1:18771/) 保留原 mvu-data 与测试服务。

## 本轮行为

- 首页角色概览移至 App 网格底部，默认折叠并记住偏好。
- 微信从会话列表进入，可在酒馆与 A 聊天时联系 B。稳定角色身份、独立历史/草稿/未读/状态，旧记录保留；在途回复归原会话，不读取另一个主聊天或 MVU。
- 明确的右上角设置；常用字段直接编辑，通用/联系人专用两个目标，保存后重开一致；模板收起，保存/失败反馈固定在底部。
- 全部聊天/状态/格式提示词可见、可改、可恢复、可预览；单次回复 JSON 同步内心想法和当前状态。钱包、天数、生活费和第二次评估退出新工作流。
- 表情分组预览、修改、启停与图库导入；历史素材快照。红包支持任意内容和附言。

## 证据与产物

最终相关 **9 文件 / 68 项**通过；此前全量 113 文件/1416 项经 3 个沙盒夹具权限失败重跑收敛。类型/lint、855 翻译键、最终 Next 与扩展构建、58 文件一致性、12 发布工具、25 网页移动 E2E 通过。

真实 ST 四档布局共 **40 组流程检查、24 次 axe 扫描零检出**，保留 8 条不确定规则记录。桌面/320/390 对应 2114；2119 只补消息滚动区键盘入口与焦点轮廓，横屏完整复核通过，前面未变化业务证据仍保留原构建号。真实 AI/实体设备/完整读屏不在该自动证据内。

[发布记录](history/2026-11-05-publication.md) · [验收汇总](../../test-results/release-2026-11-05-2119/acceptance-summary.json) · [功能交接](history/2026-11-05-wechat-experience.md) · [用户体验清单](UNIFIED-ACCEPTANCE.md) · [微信说明](../WECHAT.md)。发布前按相同构建时间重新生成的 58 文件与验收候选逐一哈希一致；同步后源码/预览/分发/安装仓库完整一致。bundle SHA-256 为 `fa33178e26c32faf369c3fe040839a2b3bb80a3d529de60f222d1a44a568f07b`，与实际 18771 HTTP 一致；自动 18772 服务已停止。测试日志和备份为本地忽略产物，远端仓库中的证据摘要见发布记录。

## 既有成果与边界

A–F 成果与 G 一起提交发布：原生 Connection Manager、角色推荐、卡片分支与选择恢复、图库存储/分享、逐类恢复/导出、Renderer/管家修复以及手机可视区定位。历史证据见 [F 交接](history/2026-11-05-character-play-mobile.md)。旧微信跟随主聊天、MVU 数值/钱包和双阶段请求已由本轮独立会话契约取代，不再要求用户验收旧行为；变量 App 自身的 MVU 能力保留。

发布前已 fetch 两个 origin，均与本地基线一致；正常快进推送，没有重写历史。扩展同步备份及回执在 `test-results/publication-2026-11-05/ext-backup/`。群聊/朋友圈、完整账户恢复、素材托管、真实 AI/实体设备/完整读屏验收仍属后续范围；[DEFERRED](DEFERRED.md) 已记录本次提交对历史未发布状态的取代关系。

远端 Actions 因当前 API/浏览器无可用读取登录而未确认；本地验收和产物一致性通过不代表远端 CI 通过，详情见发布记录。
