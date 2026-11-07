---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 02c8da43a2b839d51d2ab60c0958fb37f721fe9f
remote_code_head_at_update: 02c8da43a2b839d51d2ab60c0958fb37f721fe9f
release_code_head: 9aa11af869ad8167b408bb5ba6528f4899f6b2a8
build_version: 0.9.0+202611071934
published_build_version: 0.9.0+202611071934
phase: ux-refactoring-published
updated_at: 2026-11-07
updated_by: Codex
verification_source: release-full-1489-unit-25-release-25-mobile-152-wechat-35-tabs-78-axe-60-parity
history: docs/maintenance/history/2026-11-07-ux-publication.md
previous_history: docs/maintenance/history/2026-11-07-ux-phase2.md
---

# 当前项目状态

**UX Step 1–5 已完成并正式发布至两仓 main，版本 0.9.0+202611071934。** 用户明确授权的 pnpm release:full 已完成门禁、候选、备份同步、构建提交和正常推送；开发代码/构建提交 02c8da43a2b839d51d2ab60c0958fb37f721fe9f，安装提交 9aa11af869ad8167b408bb5ba6528f4899f6b2a8。共享维护文档随后单独提交；verified_code_head 指向已验证的产品提交。详见 [发布交接](history/2026-11-07-ux-publication.md)。

## 已交付

- 聊天/朋友圈图片自然比例与失败重试，表情保持 contain；手机返回/关闭实际 44px 热区；朋友圈发布区默认折叠、增量插入并保持阅读位置与焦点。
- 语音切换并入输入条，浏览器识别生成可编辑草稿并由用户确认发送，不支持/失败时保留文字入口；群聊 @ 保留原生选择器和键盘操作。
- 删除图包改为一次确认，默认保留本地文件，显式勾选仅删除独占源文件；保留共享引用、部分失败及并发设置保护。群头像使用四/九宫格；大屏手机壳最大 380px，320px 视口收缩至 304px。
- Step 5 包信息使用基本信息/提示词扩展双 Tab，切换保留草稿，方向键/Home/End 可操作；表单内部滚动、保存行常驻，默认折叠和保存后的展开偏好保持，首屏保留图库。

## 验证与发布

最终源码 **121 文件 / 1489 单测**、类型、零警告 lint、**25 发布工具测试**、860 翻译键 / 942 源引用、Next 构建全部通过；release:full 重新执行门禁后构建固定候选。该候选通过 **25 项移动 E2E**、微信四布局 **152 项流程**及详情页四布局加 320px 英文 **35 项流程**。320px 无横向溢出，图片自然比例、朋友圈锚点和 Tab 草稿/保存/重载保持通过。

共 **78 次局部 axe 扫描零违规检出**，保留 **99 个按规则/选择器/原因去重的不确定项**。真实麦克风/语音识别服务、AI/TTS 供应商、实体设备/系统输入法及完整读屏仍需对应环境；历史全界面 118 项不确定记录不因局部扫描而关闭。

主包 **625909 bytes**，SHA-256 9c04182281ec9e8212afa14eea95dab3b98aadac381e7194a96f71afc224253e。根目录、st-distribution、public 和安装仓库 **60 文件 parity 及开发提交库存门禁通过**。两仓远端 main 均核验实际提交；远端 CI 状态未另行查询，不宣称 CI 已完成。

证据、截图、候选清单、同步前备份和完整发布回执在 test-results/ux-publication-2026-11-07/。本轮 18772/3101 服务已停止，原 18771 与日常酒馆数据保留。

## 后续范围

本次无剩余实施或发布项。图库瀑布流、@ 内联推荐、顶部社交菜单、拖拽调宽仍未授权实施，继续暂缓；不要重复已发布的 Step 1–5。

[微信说明](../WECHAT.md) · [CLI 方案](../superpowers/plans/2026-11-07-frontend-ux-cli-handoff.md) · [后续事项](DEFERRED.md)
