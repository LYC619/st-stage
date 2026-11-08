# 2026-11-09 夜间目标（Codex 无人值守执行）

计划由 Claude Code 编写，Codex 执行。用户在睡觉，**中途没人回答问题**。遇到计划没说清的，按 `AGENTS.md`「计划与执行」一节处理。

## 开工前

1. 读 `AGENTS.md`（新增了代码风格、验证范围、文档写法三条规则，本次必须遵守）、`docs/maintenance/CURRENT.md`、`docs/maintenance/PROTOCOL.md`。
2. 做 PROTOCOL 里的 `verified_code_head` 检查。基线应为 `main` / `e9f591f` 或其后的纯文档提交。
3. `git status`：工作区应只有本批计划文件和 `AGENTS.md` 的改动（Claude 写的，未提交）。如果还有其他产品代码改动，**停止**，在 `test-results/overnight-2026-11-09/STOPPED.md` 写明原因。
4. 建分支：`git switch -c codex/overnight-2026-11-09`。第一个提交只包含 `AGENTS.md` 和 `docs/superpowers/plans/2026-11-09-*.md`，信息 `docs: add overnight plans and agent rules`。

## 执行顺序

| 顺序 | 计划 | 提交信息前缀 |
| --- | --- | --- |
| 0 | [文档瘦身](2026-11-09-batch0-docs-slimming.md) | `docs:` |
| 1 | [小剧场 App](2026-11-09-batch1-theater.md) | `feat(theater):` |
| 2 | [剧情状态 App](2026-11-09-batch2-story-state.md) | `feat(story-state):` |
| 3 | [斜杠命令](2026-11-09-batch3-slash-toggle.md) | `feat(slash):` |

每批：实现 → 按该计划的「验证」跑 → 全过就提交一次 → 进入下一批。

## 某一批卡住时

同一个失败修了 3 次还不过：

1. 把这批的改动存成补丁：`git diff > test-results/overnight-2026-11-09/batchN-unfinished.patch`（新文件先 `git add -N`）。
2. 恢复到上一个提交：`git restore --staged --worktree .` 后删掉本批新建的未跟踪文件。
3. 在最终 history 里写清楚卡在哪、补丁在哪。
4. 继续下一批。批次 2 依赖批次 1 的共享 AI 请求模块；批次 1 失败时由批次 2 自己建这个模块（见批次 2 计划）。

## 边界

- **不推送**，不运行 `release:full` / `release:sync`，不碰安装仓库 `st-stage-ext`。
- 不启动、不修改日常酒馆（18771 端口和 `D:\6.YULE\ST` 下的数据）。本次不需要启动任何酒馆实例。
- 所有子进程隐藏窗口运行（用户在睡觉，弹窗会吵醒人）。
- `pnpm build:ext` 会改 `version.json` 和根目录产物，这些随每批一起提交。

## 收尾

1. 写一篇 `docs/maintenance/history/2026-11-09-overnight.md`，**不超过 60 行**。每批一小节：做了什么 / 怎么验证的 / 偏离计划的地方。最后一节写没完成的。
2. 更新 `CURRENT.md`：`phase: overnight-branch-unmerged`，正文说明分支名、包含哪些批次、等待审查。按 PROTOCOL 填 front matter。
3. 全量跑一次 `pnpm vitest run`、`pnpm typecheck`、`pnpm lint`，结果写进 history。
4. 提交 `docs: record overnight batches`。
5. 最后一条回复列出：分支名、每批的提交哈希、没完成的事。
