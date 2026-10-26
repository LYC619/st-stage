---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 78665593bbe72631713b3babea1cd6bc14fd8e1e
remote_code_head_at_update: cf8f0ce4adaf83f590cf776943ecba82abf3ecfa
build_version: 0.9.0+202610261121
phase: merged-and-dual-repositories-published
updated_at: 2026-10-26
updated_by: Codex
verification_source: merged-suite-100files-1352tests-tsc-lint-next-build-i18n-runtime-parity-2026-10-26
history: docs/maintenance/history/2026-10-26-merge-and-release.md
previous_history: docs/maintenance/history/2026-10-26-wechat-fifth-review.md
---

# 当前项目状态

微信 App、手机壳与 W1-W9 修复已由 `752678d` 提交；`codex/i18n-acceptance` 的核心界面翻译、键盘与焦点维护随后合入 `main`，合并代码提交为 `7866559`。合并冲突保留了微信全屏布局，并结合翻译分支的可访问键盘/焦点行为。

合并后的自动验证通过：100 个测试文件、1352 项测试全部通过；`tsc --noEmit --incremental false`、lint、i18n 完整性检查、Next.js 生产构建均退出 0；根目录与 `st-distribution` 的 7 个运行文件 SHA-256 一致，三处微信素材各 50 项。真实 SillyTavern 联调、物理设备、OS 键盘及完整屏幕阅读器/WCAG 验收仍未在本轮重做。

## 当前交付边界

| 位置 | 状态 |
| --- | --- |
| 开发仓库 `D:\8.Project\0_0_维护\st-stage` | `main` / 代码 HEAD `7866559`；首轮维护记录随 `131f1e3` 推送；构建 `0.9.0+202610261121` |
| 安装仓库 `D:\8.Project\0_0_维护\st-stage-ext` | `main` / `0b24014` 已推送；8 个基础文件、README 与 50 个微信素材均通过三方哈希/清单校验 |
| 分支与工作树 | 6 个已合入的本地维护分支、i18n 工作树及 2 个已合入的远端旧分支已清理；工作树残留缓存移入回收站，可恢复 |
| 保留远端旧分支 | `origin/v0/2405142193-6702-70a2066c` 含 `main` 尚未包含的独有提交，暂不删除 |

详细合并与发布记录见 [2026-10-26 合并与发布](history/2026-10-26-merge-and-release.md)。微信审查边界见 [第五次审查](history/2026-10-26-wechat-fifth-review.md)，翻译/键盘验收边界见 [导出最终验收](history/2026-10-07-export-final.md)。运行和维护入口见 [维护指南](MAINTAINER.md)。

## 仍未完成的验收

1. 在真实 SillyTavern 中复核角色/聊天切换、微信与主会话连贯性、MVU 状态结算同步及微信素材加载。
2. 在物理设备与 OS 输入法上复核 320px 布局、组合输入、焦点返回和键盘操作。
3. 实际第三方 MVU、完整屏幕阅读器/WAVE 与 WCAG AA 验收仍受历史记录中的环境边界约束。
4. [DEFERRED](DEFERRED.md) 中 Renderer、导出身份/取消/大小写、管家恢复、分享封面、素材托管与发布自动化等事项保持暂缓。

## 发布边界

- 开发仓库保持 `st-stage`，新安装渠道保持 `st-stage-ext`；不重命名仓库、不重写或嫁接安装仓库历史。
- 安装包包含 8 个基础文件：`manifest.json`、`index.js`、`bundle.js`、`style.css`、`version.json`、`README.md`、`locales/zh-CN.json`、`locales/en-US.json`，以及 `assets/wechat/` 的 50 个素材文件。
- README 从 `st-extension/distribution-readme.md` 生成并同步；不以开发仓库首页覆盖安装仓库 README。
- 发布顺序已完成：开发仓库先推送至 `131f1e3`，随后安装仓库推送至 `0b24014`；发布状态文档推送至 `cf8f0ce` 后完成分支清理，本文件的最终提交仅记录清理结果。
