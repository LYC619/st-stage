---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 4ee95e883c723f253262daf2e26e7ec115f543a7
remote_code_head_at_update: 4ee95e883c723f253262daf2e26e7ec115f543a7
release_code_head: 205e4481e96fc751e18ba33b64affbf044f8ef79
candidate_base_head: 0bf8ae2444000b92058d015bea9b2e0168801f70
build_version: 0.9.0+202611081358
published_build_version: 0.9.0+202611081358
phase: wechat-ux-published
updated_at: 2026-11-08
updated_by: Codex
verification_source: release-full-1527-unit-25-mobile-208-browser-checks-92-scoped-axe-4-way-committed-parity
history: docs/maintenance/history/2026-11-08-wechat-ux-publication.md
previous_history: docs/maintenance/history/2026-11-08-ux-follow-up.md
---

# 当前项目状态

**0.9.0+202611081358 已正式发布到开发和安装两个仓库的 main。** 包含微信记忆／社交升级、Claude UX 审查修改、后续性能与生命周期修复，以及本地测试服务终端闪窗修复工具。产品提交 `4ee95e8`，安装提交 `205e448`；本次没有改动日常 ST 数据。

`verified_code_head` 指已发布的产品提交，之后仅更新维护文档。发布回执状态为 complete，两仓推送均成功并经实时远端核对。详见 [发布记录](history/2026-11-08-wechat-ux-publication.md)。本批始终位于 main，无额外功能分支可合并；用户确认保留旧 `v0/2405142193-6702-70a2066c`，没有合入或删除它。

## 已完成

- 微信默认读取最近 12 条主聊天及相关世界书；底部微信／通讯录／朋友圈三页、+ 菜单、自动朋友圈和仅你可见动态均保留。
- Claude 的逐级返回、设置刷新隔离、手机比例、微信阅读位置与状态行、群聊逐成员超时和世界书共享读取、图墙失败占位及导出选择修复均保留。
- 本轮让设置和图库按需加载，优化折叠区焦点查询；修复过期提示词预览覆盖和 App 加载失败时订阅滞留。设置测试不再依靠增加超时。
- 重写资料设置验收；体验旧命令统一到 evolution；旧微信 MVU 契约明确退役并保存历史复现入口。社交脚本补上角色列表加载等待，避免过早读取新建角色卡。

## 验证

发布工具从干净源码提交重新执行类型、lint、**127 文件 / 1527 项单测、25 项发布工具测试**、翻译、Next 和扩展三通道构建，全部通过。固定构建时间重建的 60 个文件与原候选逐字节一致，因此复用已通过的 **25 项手机 E2E**和浏览器证据。根目录／public／st-distribution／安装仓库 **60 文件 parity 及 committed 库存检查**通过。

隔离 ST 18774 的三套四布局验收共 **208 项检查**通过；**92 次局部 axe 扫描零违规检出，53 个不同的规则／目标不确定项保留**。检查了窄屏、横屏设置、聊天和朋友圈截图。600 张合成图库场景的桌面设置重复打开中位数由 **41.8ms 降至 12.2ms**；详见 [后续修复记录](history/2026-11-08-ux-follow-up.md)。本轮 18774 与 3101 测试服务已停止。

主包 **653026 bytes**，SHA-256 `29426c6164e32b34b24265dd39bdebed18e1cb9cc5002f74ccfd5423be08edbf`。产品验收证据位于 `test-results/ux-follow-up-2026-11-08/`；本次发布门禁、候选清单、同步备份和双仓回执位于 `test-results/ux-publication-2026-11-08/`。

## 后续边界

真实模型、麦克风／TTS、实体手机／系统输入法、完整读屏及真实 MVU 供应商仍需对应环境；局部无障碍扫描不关闭历史不确定项。世界书提取为有预算的常驻／普通文本关键词筛选，不等同原生完整扫描器。图库瀑布流、@ 内联推荐、拖拽调宽继续暂缓。

源码、测试、脚本、三处产物及维护记录均已纳入本次交付。后续新改动以当前发布提交为基线；旧 v0 分支如需整合，应另行核对其不同的数据格式和 App API。

[微信说明](../WECHAT.md) · [浏览器验收入口](BROWSER-ACCEPTANCE.md) · [实施计划](../superpowers/plans/2026-11-08-ux-follow-up.md) · [暂缓事项](DEFERRED.md)
