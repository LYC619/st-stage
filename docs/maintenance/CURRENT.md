---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 9eeeb44b66bc9967921300bd6c0559862b6baf12
remote_code_head_at_update: 9eeeb44b66bc9967921300bd6c0559862b6baf12
release_code_head: eaa9ca333348084b72767fcd7b64de62486f19b8
build_version: 0.9.0+202611071003
phase: five-phase-published
updated_at: 2026-11-07
updated_by: Codex
verification_source: release-full-complete-1470-unit-25-release-60-matching-hashes-and-confirmed-dual-remote-heads
history: docs/maintenance/history/2026-11-07-publication.md
previous_history: docs/maintenance/history/2026-11-07-five-phase-repairs.md
---

# 当前项目状态

**五阶段演进、复审修复和双仓发布已完成。** 用户授权提交、推送及同步后，开发代码/产物 `9eeeb44` 和安装仓库 `eaa9ca3` 已正常推送到两仓 main，版本 **0.9.0+202611071003**。没有待合并功能分支；工作直接位于 main。发布回执为 complete，安装仓库备份与同步回执保留。详见 [发布交接](history/2026-11-07-publication.md)。

## 已交付

- 图库职责拆分、微信 Contact/Group 及兼容迁移；群聊、提及、九格头像、朋友圈/点赞、语音/TTS、取消/超时/失败重试。
- 七项复审 P2 全部修复，另补朋友圈生成/保存快照竞态和聊天心情来源。整轮群聊冻结配置，状态按成员更新时间选择，语音保留转写/焦点且不把宿主回调返回等同播放成功。
- JSZip 按需分块等待支持立即取消；CI 验证完整三通道产物已提交，预览 locale 固定 LF。
- `pnpm release:full` 已在真实双仓完成检查、候选、备份、同步、提交、正常推送及完成回执；[发布说明](../RELEASE.md)包含恢复方式。

## 验证与产物

发布准备重新通过类型、lint、119 文件/**1470 项单测**、855 翻译键/931 源引用、**25 项发布工具测试**和 Next 构建。固定 10:03 构建时间，三个通道 60 文件与已验收候选逐文件 SHA-256 完全相同；实际安装仓库 parity 与开发提交库存门禁通过。

同版本已通过真实隔离 ST 微信四布局 **104 项**、移动 E2E **25 项**、中英文桌面/手机导出 **4 场景**。微信 **44 次 axe 扫描零检出**，保留 45 个去重不确定项；历史全界面 118 项仍保留，见 [节点复核](history/2026-11-07-accessibility-review.md)。

主包 **614748 bytes**，SHA-256 `b35358be6cc134914f2092730e79cd8f8ff6fe14b81b71f2c81e4ef560343840`。发布候选、哈希、安装仓库备份和完整回执位于 `test-results/publication-2026-11-07/`。原验收记录在 `test-results/review-fixes-2026-11-07/`。

Git 远端提交已确认；GitHub Actions API 状态当前无法读取，不宣称远端 CI 已通过。真实 AI、实际音频供应商、实体设备/系统输入法及完整读屏仍需对应环境。18772/3101 验收服务已停止，原 18771 测试入口和数据保留；本次同步独立 st-stage-ext 安装仓库，未改日常酒馆数据。

[五阶段计划](../superpowers/plans/2026-11-06-five-phase-evolution.md) · [微信说明](../WECHAT.md) · [后续事项](DEFERRED.md)
