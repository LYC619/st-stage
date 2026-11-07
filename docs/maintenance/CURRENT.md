---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 4d635f4efb9801396dc9a55815278e70d2fcf963
worktree_base_head: 2b642a416924b301d8b0bd0def9cdf92dbaa540b
remote_code_head_at_update: 2b642a416924b301d8b0bd0def9cdf92dbaa540b
build_version: 0.9.0+202611071003
phase: five-phase-review-repaired-uncommitted
updated_at: 2026-11-07
updated_by: Codex
verification_source: 1470-unit-25-release-104-wechat-25-mobile-4-export-44-scoped-axe-60-artifact-hashes
history: docs/maintenance/history/2026-11-07-five-phase-repairs.md
previous_history: docs/maintenance/history/2026-11-07-five-phase-review.md
---

# 当前项目状态

**2026-11-07 复审修复与本地验收完成。** 七项 P2 已修复，另补朋友圈生成/保存状态快照竞态和心情更新来源；独立交叉复核未发现新的 P1/P2。详见 [修复与证据](history/2026-11-07-five-phase-repairs.md)。五阶段功能和本轮修复仍全部未提交、未推送，安装仓库未同步。

最新已发布版本仍是 **0.9.0+202611052252**（开发 4d635f4、安装仓库 6e6eb95）。本地新候选为 **0.9.0+202611071003**，不属于 verified_code_head。HEAD 与本地跟踪 origin/main 为 2b642a4，本轮未重新查询真实远端；发布基线祖先及已提交产品差异检查通过，工作区变更单独验收。

## 实现与修复

- 图库职责拆分；微信 Contact/Group 模型及历史数据迁移保留旧身份和记录。
- 群聊、@、九格头像、朋友圈/点赞、语音/TTS 和取消/超时/失败恢复均已实现。整轮群回复冻结配置和角色快照；状态按成员更新时间选择，朋友圈请求与保存使用同一快照；提及支持完整边界和身份/名字并集。
- 语音点击即展开文字，宿主回调返回不宣称播放成功；控件跨重绘保留展开、请求状态及焦点，超时可重试，卸载忽略迟到结果。
- JSZip 按需分块等待可立即取消；CI 核对 HEAD 中完整产物清单，防止未跟踪 chunk 掩盖漏提交；预览 locale 固定 LF。
- `pnpm release:full` 提供构建、检查、候选、备份同步、双仓正常推送和恢复回执，默认只准备，见 [发布说明](../RELEASE.md)。本轮未执行真实发布。

## 最新验证

- 全量 119 文件 / **1470 项**、发布工具 **25 项**、类型、lint、855 翻译键和 Next 构建全部通过。
- 真实隔离 ST 微信四布局 **104 项**流程通过；移动 E2E **25 项**通过；中英文桌面/手机导出 **4 场景**通过，含真实 JSZip chunk 挂起取消、重试一次下载及 ZIP 内容核对。
- 微信范围 **44 次 axe 扫描零检出**；保留 45 个规则/目标/原因去重不确定项。本次未重跑全部应用扫描；历史全界面 118 个去重不确定项与节点复核仍保留于 [无障碍记录](history/2026-11-07-accessibility-review.md)，不宣称完整 WCAG 达标。
- 三通道 **60 文件**一致，候选归档逐文件 SHA-256 校验通过。主包 **614748 bytes**，SHA-256 `b35358be6cc134914f2092730e79cd8f8ff6fe14b81b71f2c81e4ef560343840`。候选：`test-results/review-fixes-2026-11-07/candidate-1003/`。

本次 18772 ST 和 3101 Next 临时服务已停止；18771 原测试入口与数据保留。真实 AI、实际音频供应商、实体设备/系统输入法、完整读屏和真实远端 CI 尚未验证。新 `--committed` 门禁在当前未提交工作区应失败，成功/失败场景由临时 Git fixture 验证。

[五阶段计划](../superpowers/plans/2026-11-06-five-phase-evolution.md) · [微信说明](../WECHAT.md) · [后续事项](DEFERRED.md)
