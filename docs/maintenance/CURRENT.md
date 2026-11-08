---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 02c8da43a2b839d51d2ab60c0958fb37f721fe9f
remote_code_head_at_update: 0bf8ae2444000b92058d015bea9b2e0168801f70
release_code_head: 9aa11af869ad8167b408bb5ba6528f4899f6b2a8
candidate_base_head: 0bf8ae2444000b92058d015bea9b2e0168801f70
build_version: 0.9.0+202611081358
published_build_version: 0.9.0+202611071934
phase: ux-follow-up-verified-worktree
updated_at: 2026-11-08
updated_by: Codex
verification_source: local-1527-unit-25-mobile-208-browser-checks-92-scoped-axe-3-artifact-parity
history: docs/maintenance/history/2026-11-08-ux-follow-up.md
previous_history: docs/maintenance/history/2026-11-08-ux-review.md
---

# 当前项目状态

本地候选 **0.9.0+202611081358** 包含此前微信记忆／社交升级、Claude UX 审查修改及本轮后续修复，替代 `202611081207`。**全部仍在工作区，未提交、未推送、未发布**；安装仓库正式版本仍为 `0.9.0+202611071934`。

`verified_code_head` 指上次已验证的产品提交，不代表当前未提交改动。HEAD 和最近确认的 origin/main 均为 `0bf8ae2`；祖先及已提交产品差异检查通过。本轮按 [维护协议](PROTOCOL.md) 保存入场快照并区分增量。

## 已完成

- 微信默认读取最近 12 条主聊天及相关世界书；底部微信／通讯录／朋友圈三页、+ 菜单、自动朋友圈和仅你可见动态均保留。
- Claude 的逐级返回、设置刷新隔离、手机比例、微信阅读位置与状态行、群聊逐成员超时和世界书共享读取、图墙失败占位及导出选择修复均保留。
- 本轮让设置和图库按需加载，优化折叠区焦点查询；修复过期提示词预览覆盖和 App 加载失败时订阅滞留。设置测试不再依靠增加超时。
- 重写资料设置验收；体验旧命令统一到 evolution；旧微信 MVU 契约明确退役并保存历史复现入口。社交脚本补上角色列表加载等待，避免过早读取新建角色卡。

## 验证

**127 文件 / 1527 项单测、25 项发布工具测试、25 项手机 E2E**通过。类型检查、零警告 lint、Next 生产构建、扩展三通道构建、翻译检查及根目录／public／st-distribution **60 文件 parity**通过。

隔离 ST 18774 的三套四布局验收共 **208 项检查**通过；**92 次局部 axe 扫描零违规检出，53 个不同的规则／目标不确定项保留**。检查了窄屏、横屏设置、聊天和朋友圈截图。600 张合成图库场景的桌面设置重复打开中位数由 **41.8ms 降至 12.2ms**；详见 [后续修复记录](history/2026-11-08-ux-follow-up.md)。本轮 18774 与 3101 测试服务已停止。

主包 **653026 bytes**，SHA-256 `29426c6164e32b34b24265dd39bdebed18e1cb9cc5002f74ccfd5423be08edbf`。证据位于 `test-results/ux-follow-up-2026-11-08/`，包括候选副本、入场文件、测试日志、报告和截图。

## 后续边界

真实模型、麦克风／TTS、实体手机／系统输入法、完整读屏及真实 MVU 供应商仍需对应环境；局部无障碍扫描不关闭历史不确定项。世界书提取为有预算的常驻／普通文本关键词筛选，不等同原生完整扫描器。图库瀑布流、@ 内联推荐、拖拽调宽继续暂缓。

下次提交应完整纳入三轮工作区成果与生成产物；本轮没有发布或安装同步授权。

[微信说明](../WECHAT.md) · [浏览器验收入口](BROWSER-ACCEPTANCE.md) · [实施计划](../superpowers/plans/2026-11-08-ux-follow-up.md) · [暂缓事项](DEFERRED.md)
