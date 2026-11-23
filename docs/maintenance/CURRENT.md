---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: abfa4ee667fc63a6d84a7e23bfdca9653b8362ae
remote_code_head_at_update: abfa4ee667fc63a6d84a7e23bfdca9653b8362ae
release_code_head: aefa86b8a6d6ee666ae09f1a50fab6625d4225da
build_version: 0.9.0+202611231945
published_build_version: 0.9.0+202611220955
phase: mini-os-review-fixes-committed-unpublished
updated_at: 2026-11-23
updated_by: Codex + Gemini
verification_source: committed-abfa4ee-1660-unit-26-release-33-mobile-60-committed-parity
history: docs/maintenance/history/2026-11-23-mini-os-fixes.md
previous_history: docs/maintenance/history/2026-11-23-mini-os-review.md
---

# 当前项目状态

R1–R10 修复与回归测试已提交并推送至源码仓 `main`（产品提交 `abfa4ee`，候选构建 **0.9.0+202611231945**），详见[修复交接](history/2026-11-23-mini-os-fixes.md)。所有本地历史分支均已合并入 `main`。

全量 **151 文件／1660 单测、26 发布工具测试、33 移动 E2E** 通过；类型、零警告 lint、翻译／App 文档、Next 构建及 `--committed` 三处 60 文件 SHA-256 一致性校验全部通过（主包 758714 bytes）。

安装仓 `../st-stage-ext` 尚未同步发布，正式版仍为 **0.9.0+202611220955**（`aefa86b`）；待明确发布授权后再执行双仓发布同步。[其他暂缓](DEFERRED.md)与[外部环境验收](EXTERNAL-ACCEPTANCE.md)继续保留。
