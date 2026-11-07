---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 9eeeb44b66bc9967921300bd6c0559862b6baf12
remote_code_head_at_update: cf8abbd8974c79c56822a994d6cf25b5f8391744
worktree_base_head: cf8abbd8974c79c56822a994d6cf25b5f8391744
release_code_head: eaa9ca333348084b72767fcd7b64de62486f19b8
build_version: 0.9.0+202611071846
published_build_version: 0.9.0+202611071003
phase: ux-step5-release-resuming
updated_at: 2026-11-07
updated_by: Codex
verification_source: local-1489-unit-25-release-type-lint-build-step5-preflight
history: docs/maintenance/history/2026-11-07-ux-publication.md
previous_history: docs/maintenance/history/2026-11-07-ux-phase2.md
---

# 当前项目状态

**Step 1–5 已实现并完成本地门禁，双仓发布尚未执行。** 用户原发布授权仍有效；因反复沙箱弹窗打断使用，已停止发起提权申请。整批发布命令的自动权限审核超时，进程未启动，没有新增提交、安装同步或推送。Step 5 本地候选为 **0.9.0+202611071846**，工作区位于 `main`，HEAD 仍为 `cf8abbd`。`verified_code_head` 暂保留已提交产品基线 `9eeeb44`。详见 [发布交接](history/2026-11-07-ux-publication.md)，下方 Step 1–4 历史证据保留至正式发布回执替换。

## 本轮完成

- Step 5：包信息默认折叠，展开后使用「基本信息」「提示词扩展」双 Tab；支持方向键/Home/End，切换保留表单和服装备注草稿，保存保持当前 Tab/折叠状态。内容区限高并独立滚动，保存行保持可见。1489 项单测、类型、零警告 lint、25 项发布工具测试、Next 和普通 parity 通过；四布局及 320px 中英文预检通过，正式发布候选仍待生成和验收。

- 语音切换并入输入条最左侧。浏览器识别生成可编辑草稿，用户确认发送；不支持、权限拒绝、失败或超时时保留文字入口。切换页面时取消录音并忽略迟到结果，录音结束后焦点回到输入框。
- 群聊 @ 下拉保留键盘操作，仅在群聊中显示为输入栏上方的紧凑入口。
- 删除图包使用一次确认面板，附默认不勾选的独占本地源文件选项；保留取消、共享引用保护、部分失败重试及并发设置保护。
- 群头像按人数使用 18px 四宫格或 13px 九宫格。手机壳大屏上限 380px，继续按 `vw - 16` 收缩，320px 下宽 304px。
- 第一阶段的自然图片比例、失败重试、实际 44px 热区、朋友圈折叠发布区与增量插入/阅读位置/焦点保持全部保留，见 [第一阶段记录](history/2026-11-07-ux-phase1.md)。

## 验证与产物

最终源码通过 **121 文件 / 1488 项单测**、类型、零警告 lint、**25 项发布工具测试**、858 翻译键 / 939 源引用和 Next 构建。移动 E2E **25 项通过**；后续语音焦点修复由专项单测及最终 ST 回归覆盖。真实隔离 ST 的 **1365×900、320×667、390×844、667×375** 四布局共 **152 项流程检查通过**，照片无拉伸、无横向溢出，发布与延迟图片加载后的阅读锚点保持一致。

**68 次局部 axe 扫描零违规检出**（64 次微信、4 次删除面板），保留 **52 个按规则/选择器/原因去重的不确定项**。历史全界面 118 项仍保留，见 [节点复核](history/2026-11-07-accessibility-review.md)。真实麦克风/识别服务、AI/TTS 供应商、实体设备/系统输入法和完整读屏仍需对应环境。

主包 **624657 bytes**，SHA-256 `30c87f88100ef798802387eed2f97b2f8b8000ede56c7ff46a596ca9407ecd4a`。三通道 **60 文件 parity 通过**；证据、截图及本地候选包位于 `test-results/ux-phase2-2026-11-07/`。最终合并浏览器报告为 `browser-accepted/report.json`，来源报告与截图均保留且版本/哈希一致。仅执行工作区普通 parity，没有借提交后门禁擅自提交。

前两阶段的 18772/3101 服务已停止；本次 Step 5 新建的独立 ST **PID 27640 / 18772 仍运行**，普通沙箱权限关闭返回 Access denied，未再申请提权。尚未启动本次 Next 服务。原 18771 数据保留，没有同步安装仓库。已发布版本仍为 **0.9.0+202611071003** / `9eeeb44` / 安装仓库 `eaa9ca3`，见 [历史发布交接](history/2026-11-07-publication.md)。本轮未查询远端 CI。

[五阶段计划](../superpowers/plans/2026-11-06-five-phase-evolution.md) · [微信说明](../WECHAT.md) · [后续事项](DEFERRED.md)

## 后续 CLI 接续

另一客户端的审查及修订方案已交接至 [CLI 接续方案](../superpowers/plans/2026-11-07-frontend-ux-cli-handoff.md)。其中第 1–4 步现已完成；不要重复已发布的五阶段或本轮已验收工作。

详情标签化已获授权并完成。图库瀑布流、@ 内联推荐、顶部社交菜单和拖拽调宽仍不在本轮范围。用户随后明确要求「继续任务」，现在接续正式发布及测试进程清理；沿用已准备的本地批次脚本 `test-results/ux-publication-2026-11-07/complete-release.mjs` 和已核对的文件清单，避免拆分成多次提权申请。若整批执行再次被环境阻止，记录事实而不反复重试。
