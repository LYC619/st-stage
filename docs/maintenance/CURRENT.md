---
status_version: 1
project: st-stage
base_branch: main
verified_code_head: 28e05afe89680a7849b305a4f4b74ac4949df1fd
remote_code_head_at_update: 28e05afe89680a7849b305a4f4b74ac4949df1fd
release_code_head: fd7dc527fee7343d466a47bb32fdaa9997cfbbf8
build_version: 0.9.0+202611232112
published_build_version: 0.9.0+202611232112
phase: mini-os-review-fixes-published
updated_at: 2026-11-23
updated_by: Codex + Gemini
verification_source: release-full-published-1660-unit-26-release-33-mobile-4way-60-committed-parity
history: docs/maintenance/history/2026-11-23-mini-os-fixes.md
previous_history: docs/maintenance/history/2026-11-23-mini-os-review.md
---

# 当前项目状态

R1–R10 审查修复已正式发布为 **0.9.0+202611232112**：产品代码 `abfa4ee`、正式构建提交 `28e05af`（源码仓 `main` 已推送），安装仓 `../st-stage-ext` 已通过 `release-full.mjs --publish` 同步并推送至 `fd7dc52`（更新 `bundle.js`、`style.css`、`version.json` 共 3 个文件）。详见[修复与发布记录](history/2026-11-23-mini-os-fixes.md)。

`release-full.mjs` 实跑全量 **151 文件／1660 单测、26 发布工具测试、类型、零警告 lint、翻译／App 文档、Next 生产构建**及四处 `--committed` **60 文件 SHA-256** 一致性校验全通过（主包 758714 bytes，前置 33 项移动 E2E 全通过）。

两仓本地与远端 `main` 均干净对齐，所有历史分支已合入 `main`。[其他暂缓](DEFERRED.md)与[外部环境验收](EXTERNAL-ACCEPTANCE.md)继续保留。
