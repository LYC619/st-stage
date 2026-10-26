# 2026-10-24 · 面向维护者的项目知识整理试点

范围：用户明确要求使用 knowledge-project，先核对成果位置，再只改文档；不改产品代码、不合并、不提交、不发布。基线为主工作区 `main` / `25d62bd79860dc592cce8adf666882cb8e994400`。本次所有文档改动保留未提交。

## 核对与更正

- `git status --short --branch`：开始时仅 `?? tore style.css`，无跟踪文件改动。该文件 SHA-256 为 `C7FC8B2613D02AFF3B9B1409C2DF1DF0CD87A6C1E9A64D7693EF047D850D582B`，本次保留。
- `git worktree list --porcelain`：三个工作树。main 为 `25d62bd`；较新 `codex/i18n-acceptance` 为 `12149e8`；旧 `codex/acceptance-round2` 为 `9e5b4d1`，两个附加工作树均干净。独立分发克隆也干净，HEAD `d6e8a89`。
- 主分支旧 `verified_code_head=26a40d8c142eae9bd17dc5cc59efe5f682e090c7` 的祖先检查与原 PROTOCOL 的产品差异检查都退出 0。较新分支 `verified_code_head=cec4e8dc74eb1a99e971d0e33dfd92d65001ffab` 同样通过；这只能证明记录对应的提交范围，不能证明旧记录的文字正确。
- `git branch --no-merged main` 仅返回 `codex/i18n-acceptance`；main 为其祖先，`main..codex/i18n-acceptance` 共有 10 提交。读了其 CURRENT 和 `2026-10-07-export-final.md`；没有合并、复制产品实现或改动该工作树。
- 两次只读 `git ls-remote origin refs/heads/main` 成功：开发仓库实际远端为 `1989c2fab99a28b8b204073bcb32f59b73800079`；分发仓库实际远端为 `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`。均与 tracking ref 一致。main 领先开发远端 2 提交；并未 fetch、push 或验证写权限。10 月旧记录中的认证不可用不再作为本次读取结论。
- 实读 main 根目录 `version.json` 为 `0.9.0+202609121808`，生成目录为 `0.9.0+202609121809`；`git show 26a40d8:version.json` 和对应生成文件确认这已在基线中。七运行文件逐一 SHA-256 比较：manifest、loader、CSS 相同；bundle、version、两个 locale 不同。更正旧 CURRENT 的产物完全一致说法，未重建或覆盖它们。
- 较新工作树根目录与生成目录七运行文件哈希全部相同，版本均为 `0.9.0+202610070357`。独立发布版本为 `0.9.0+202609031245`，无两个 locale 文件。i18n 构建已有 locale 复制逻辑，未来发布需八文件，不能沿用六文件旧清单。
- `core/i18n.ts` 当前签名是 `t(key, fallback?: string)`，没有插值功能；纠正使用指南传对象的例子，CURRENT 不再沿用 9 月记录的插值支持说法。历史原文保留，后续实现见较新分支。

## 整理内容

- README 增加 CURRENT/维护指南导航，纠正导出 App 范围和“按 skill 自动提交”的描述；用户功能说明与原目录导航保留。
- CURRENT 改为当前 main 状态，加成果位置、实际产物差异、历史验收边界、发布清单和待决定事项。9 月修复细节继续链接既有 history；10 月成果引用保留分支中的文档，可用 `git show` 读取，不复制另一套历史。
- 新增 MAINTAINER，补环境版本来源、双端运行区别、模块/持久化/修改入口、典型数据流、定向验证与打包、故障定位和设计理由链接。
- PROTOCOL 扩展纯文档过期检查排除项以覆盖 docs 下的 Markdown 与 README（不排除可执行模板），明确另审文档差异、未提交产品改动和产物一致性；交接清单不再自行授予提交权限。产品代码基线未前移。
- 纠正 i18n 使用指南的当前 API 例子与分支适用范围。
- 未移动、删除或重写既有 history/specs/plans；DEFERRED 的历史、决定与未完成事项原样保留。

## 检查边界与待确认

本次验证是 Git 身份/祖先/差异、实际远端读取、版本内容、文件哈希、命令版本、模块与导航路径和文档 diff 检查。命令可用：Node `v22.14.0`、pnpm `10.32.1`；当前 shell 无 rtk，直接执行原命令。没有安装依赖、启动应用、运行产品测试、浏览器验收或构建。9/10 月测试数均为有时间与分支范围的历史证据。本次导航检查不证明真实维护者理解度或 Agent 效率得到改善。

最终静态检查：六份改动文档共 78 个本地 Markdown 链接目标全部存在；`git diff --check` 通过，新增文件另查行尾空白；主分支祖先/产品差异检查均退出 0，工作区跟踪产品文件无变化；原未跟踪 CSS 哈希未变。Git 的 LF/CRLF 提示是当前签出策略提示，没有修改行尾配置。四份原有文档修改、两份新文档保留未提交，其他工作树与发布克隆未改动。

仍由维护者决定：何时整合较新分支/发布、语义版本与许可证选择、`tore style.css` 的归属，以及下一轮优先验收事项。物理设备、真实第三方 MVU、迁移恢复/异常与 ZIP 导入等仍开放；既有暂缓条目未关闭。本次文档试点本身不依赖这些决定，可以先审阅未提交 diff。
