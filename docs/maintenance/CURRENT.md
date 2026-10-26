---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 4b615fec2898d55f4d71cfb25770d85abea3ac99
remote_code_head_at_update: 4b615fec2898d55f4d71cfb25770d85abea3ac99
build_version: 0.9.0+202610261121
phase: merged-published-and-real-st-accepted
updated_at: 2026-10-26
updated_by: Codex
verification_source: real-st-1.18.0-edge-i18n-10-gallery-4-variables-4-export-4-wechat-2-2026-10-26
history: docs/maintenance/history/2026-10-26-real-st-acceptance.md
previous_history: docs/maintenance/history/2026-10-26-merge-and-release.md
---

# 当前项目状态

微信 App、手机壳与 W1-W9 修复已由 `752678d` 提交；`codex/i18n-acceptance` 的核心界面翻译、键盘与焦点维护随后合入 `main`，合并代码提交为 `7866559`。Variables 真实宿主脚本的角色列表水合竞态由 `4b615fe` 修正并已推送。

合并构建的本地门禁保持通过：100 个测试文件、1352 项测试，TypeScript、lint、i18n 完整性、Next.js 构建及运行产物一致性均通过。在隔离合成数据上的 SillyTavern 1.18.0 自动验收随后完成：i18n 10/10、Gallery 4/4、Variables 4/4、Cloud Export 4/4、微信桌面与 320×667 两个场景通过；浏览器页面错误为 0。移动结果是浏览器模拟，微信 AI 响应为本地拦截，物理设备、真实 AI、受控第三方 MVU 和完整无障碍验收未完成。

## 当前交付边界

| 位置 | 状态 |
| --- | --- |
| 开发仓库 `D:\8.Project\0_0_维护\st-stage` | `main` / 已推送代码 HEAD `4b615fe`；构建 `0.9.0+202610261121` |
| 安装仓库 `D:\8.Project\0_0_维护\st-stage-ext` | `main` / `0b24014` 已推送；8 个基础文件、README 与 50 个微信素材均通过三方哈希/清单校验 |
| 分支与工作树 | 6 个已合入的本地维护分支、i18n 工作树及 2 个已合入的远端旧分支已清理；工作树残留缓存移入回收站，可恢复 |
| 保留远端旧分支 | `origin/v0/2405142193-6702-70a2066c` 含 `main` 尚未包含的独有提交，暂不删除 |

真实宿主结果与限制见 [2026-10-26 真实 SillyTavern 自动验收](history/2026-10-26-real-st-acceptance.md)，合并与发布记录见 [2026-10-26 合并与发布](history/2026-10-26-merge-and-release.md)。微信审查边界见 [第五次审查](history/2026-10-26-wechat-fifth-review.md)，运行和维护入口见 [维护指南](MAINTAINER.md)。

## 仍未完成的验收

1. 在物理设备与 OS 输入法上复核 320px 布局、组合输入、焦点返回和键盘操作；本轮 320px 仅为浏览器模拟。
2. 以受控、明确识别的第三方 MVU 安装复核真实读写、事件与微信状态结算；仅检测到宿主 helper 全局不能关闭该门禁。
3. 完整屏幕阅读器、WAVE、WCAG AA 与真实外部 AI 调用仍未验收。
4. 图片迁移/恢复、标准 ZIP 导入及 [DEFERRED](DEFERRED.md) 中 Renderer、导出身份/取消/大小写、管家恢复、分享封面、素材托管与发布自动化等事项保持暂缓。

## 发布边界

- 开发仓库保持 `st-stage`，新安装渠道保持 `st-stage-ext`；不重命名仓库、不重写或嫁接安装仓库历史。
- 安装包包含 8 个基础文件：`manifest.json`、`index.js`、`bundle.js`、`style.css`、`version.json`、`README.md`、`locales/zh-CN.json`、`locales/en-US.json`，以及 `assets/wechat/` 的 50 个素材文件。
- README 从 `st-extension/distribution-readme.md` 生成并同步；不以开发仓库首页覆盖安装仓库 README。
- 发布顺序已完成：开发仓库先推送至 `131f1e3`，随后安装仓库推送至 `0b24014`；发布状态文档推送至 `cf8f0ce` 后完成分支清理，清理记录为 `6f4eb76`。验收脚本修正 `4b615fe` 已推送；本次文档收尾记录真实宿主验收及剩余门禁。
