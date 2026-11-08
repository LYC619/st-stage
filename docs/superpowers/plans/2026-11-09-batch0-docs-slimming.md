# 批次 0：维护文档瘦身

目标：让 `DEFERRED.md` 和 `CURRENT.md` 能一眼看懂。只改文档，不碰产品代码。

## 要做的

### 1. 重写 `docs/maintenance/DEFERRED.md`（目标 ≤ 60 行）

现在 279 行，大部分是已经解决、或被后续发布取代的历史状态。按下面的分类重写，**只保留仍未解决的事项**：

```
# 暂缓与遗留事项

只列仍未解决的事。解决后直接删除，历史看 Git。

## 功能暂缓
## 已知小问题（不影响使用）
## 待真实环境验证
（一句话 + 链接到 EXTERNAL-ACCEPTANCE.md，不展开）
## 需要维护者决定
```

逐条核对旧条目。下面这些在 11/04–11/08 的提交里已经修复，核对代码确认后删除：

| 旧条目 | 修复依据 |
| --- | --- |
| Renderer Snapshot Image Listeners | `history/2026-11-04-release-readiness.md` 第一条 |
| Conservative HTML Detection | 同上 |
| Cloud Export：avatar/name 身份合并、失败后读取不停、globalSelect 未核对、世界书大小写 | 同上第二条 |
| Butler：坏 activeTransaction 静默丢弃、二分排查空候选 | 同上第三条 |
| Share Strings Do Not Carry `coverTag` | 同上第四条（`stpack2`） |
| Hardcoded Install Directory Name | 2026-08-30 已解决 |
| 所有带日期的「Uncommitted / Verified Worktree Candidate / Published」状态段 | 均已发布，状态以 CURRENT 为准 |
| 2026-10-26 W1–W9、2026-09-05 R1–R8、S1 表格 | 代码已提交；剩下的只是真实环境验证，归入「待真实环境验证」一句话 |

核对方法：打开对应源文件看一眼修复是否在。确认不了的，留在「已知小问题」里并注明「待核实」，不要展开论证。

预计保留的（核对后可增删）：

- 功能暂缓：图库瀑布流、输入时 @ 内联推荐、拖拽调宽、Renderer 预生成分支、立绘素材清理与图床长期托管、原生整包 ZIP 导入/完整账户恢复、发布无人值守自动化（如果 `release:full` 已覆盖就删）。
- 需要维护者决定：语义版本号（仍是 0.9.0）、许可证与徽章。
- 已知小问题：`build.mjs` stub 的 `st-stage` 字面量兜底（如仍认为值得记录）。

每条一到两行：是什么、在哪个文件。不写影响分析长段。

### 2. 精简 `docs/maintenance/CURRENT.md`

保留 front matter 不变（字段按 PROTOCOL）。正文改成 ≤ 25 行：

- 一句话：当前发布版本、两个仓库的提交。
- 「已有功能」：按 App 列，每个 App 一行。
- 「下一步」：指向 `docs/superpowers/plans/2026-11-09-overnight-goal.md`。
- 链接：DEFERRED、EXTERNAL-ACCEPTANCE、最新 history。

不要写验证数字明细，那些在 history 里。

### 3. 整理 `docs/maintenance/EXTERNAL-ACCEPTANCE.md`

它是**唯一**记录「哪些只能在真实环境验证」的地方。把开头那段改成一句话说明用途；表格保留，删除「当前证据」列里过时的构建号细节，只留「已在什么环境验过 / 还缺什么」。

## 不做

- 不改 `history/` 下任何旧文件。
- 不改 `PROTOCOL.md`、`MAINTAINER.md`、`UNIFIED-ACCEPTANCE.md`。
- 不改产品代码、不构建。

## 完成标准

- DEFERRED ≤ 60 行，CURRENT 正文 ≤ 25 行。
- 文档内相对链接都能打开（用脚本或 grep 检查链接目标存在）。
- 本批 history 不需要单独写，在总目标的最终 history 里一句话带过。
