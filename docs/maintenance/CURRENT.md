---
status_version: 1
project: st-stage
base_branch: main
working_branch: main
verified_code_head: 26a40d8c142eae9bd17dc5cc59efe5f682e090c7
remote_code_head_at_update: 1989c2fab99a28b8b204073bcb32f59b73800079
build_version: 0.9.0+202610260159
phase: wechat-fifth-review-passed-live-acceptance-pending
updated_at: 2026-10-26
updated_by: Codex
verification_source: suite-91files-1219tests-tsc-lint-controlled-async-fixtures-runtime-and-asset-hashes-2026-10-26
history: docs/maintenance/history/2026-10-26-wechat-fifth-review.md
previous_history: docs/maintenance/history/2026-10-26-wechat-round4-repairs.md
---

# 当前项目状态

当前 `main` 工作区包含微信 App、手机壳、素材及第四轮缺陷修复，尚未提交。**第五次审查通过：上一轮五项问题的代码修复均经独立复核，限定范围内未发现新的阻塞问题；真实 SillyTavern 环境与物理设备验收仍待完成。**
1. 修复微信单测中的 Promise resolve 与消息回调签名声明，`pnpm exec tsc --noEmit --incremental false` 零报错通过（W9）；
2. 引入单调递增刷新序号与已应用序号跟踪，同会话并发刷新中较旧的迟到结果自动丢弃，不覆盖较新快照（W4）；
3. 状态评估 await 完成后重新确认实时字段所有权，等待期间新接管的心情/好感字段不被增量修改（W1c）；
4. 红包扣除前核查 `hasExternalMoney`，外部余额快照保持权威只读，不篡改本地缓存（W1c）；
5. 角色池内别名检索重构为按有效数值/字符串逐项匹配，无效文本（如 `mood: 'calm'`）不遮蔽同池合法别名（如 `happiness: 82`）（W1a）；
6. 运行时校验测试的超时调为 15s，断言未减弱；本轮全量 91 文件 / 1219 项测试一次运行全部通过。

独立复现与验证边界见 [第五次审查记录](history/2026-10-26-wechat-fifth-review.md)，实施细节见 [第四轮修复记录](history/2026-10-26-wechat-round4-repairs.md)。运行与模块入口见 [维护指南](MAINTAINER.md)。

`verified_code_head` 仍指最后已提交代码 `26a40d8`：本轮祖先检查和已提交产品差异检查均通过，但不覆盖此次未提交功能；工作区处于待维护者验收与提交状态。

## 成果在哪里

| 位置 | 实际身份与状态 | 如何使用这条信息 |
| --- | --- | --- |
| 当前源码工作区 `D:\8.Project\0_0_维护\st-stage` | `main` / HEAD `25d62bd79860dc592cce8adf666882cb8e994400`，比 `origin/main` 领先 2 提交；代码基线 `26a40d8`，另有未提交微信完整修复与手机壳更新 | W1–W9 修复保留在工作区；本轮 1219 项测试、类型检查、lint、定向异步复现与产物哈希通过；可进入真实 ST 实机验收与维护者提交决策 |
| 较新成果 `C:\Users\yicha\.codex\worktrees\i18n-acceptance\st-stage` | `codex/i18n-acceptance` / HEAD `12149e8cb0d79367fc49732f9365ac2b8f136d9d`；代码/构建 `cec4e8dc74eb1a99e971d0e33dfd92d65001ffab`；干净 | 相对 main 多 10 提交，main 是其祖先；唯一尚未合入 main 的本地分支。继续翻译/键盘维护应先读该工作树自己的 CURRENT 与 10 月记录 |
| 旧验收工作树 `D:\8.Project\Work\st-stage-acceptance-round2` | `codex/acceptance-round2` / `9e5b4d1`；干净，已在 main 历史内 | 历史工作区，不是最新成果入口 |
| 独立安装仓库 `D:\8.Project\0_0_维护\st-stage-ext` | `main` / `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`；干净；构建 `0.9.0+202609031245` | 面向新安装的已发布渠道，尚无 locale 文件；不能当作最新源码成果 |

上表其他工作树及发布仓库的信息沿用 10 月 24 日核对记录，本轮未重新验收。本轮确认本地 `origin/main` 为 `1989c2fab99a28b8b204073bcb32f59b73800079`，未执行 `git ls-remote` 或验证远端写入权限。

本轮仅更新 CURRENT、DEFERRED 并新增审查记录，保留所有业务代码、资产与新增测试，未执行 `git commit`、`git merge` 或 `git push`。

## 实现、构建与验证分别看

- **main 已实现：**9 月 7 日 `81b4286` 的 R1–R8/S1（图片持久化、导出路径、设置往返、HUD、搜索与显式迁移），以及 9 月 12 日 `26a40d8` 的 i18n 基础设施。
- **当前工作区产物：**根目录与 `st-distribution` 构建均为 `0.9.0+202610260159`，七个运行文件 SHA-256 本轮比较全部一致；根目录、预览与分发三处微信资源各 50 文件且哈希完全一致。本轮未重建扩展或 Next 产物；Next.js 生产构建通过仅为上一轮修复记录的证据。
- **较新分支已实现并有历史验收记录：**核心导航及立绘、图库、导出、MVU、新变量的中英翻译和实际键盘/焦点维护；管家、渲染的内部界面不在该翻译范围。详见该分支 `docs/maintenance/history/2026-10-07-export-final.md`。
- **本轮验证：**91 文件 / 1219 项测试全部通过（含 29 项微信测试），`tsc --noEmit --incremental false` 与 lint 均退出 0。补充内存源码夹具独立验证：同会话旧读取不覆盖 96；在状态评估已挂起后触发外部字段接管，迟到增量不修改 82/35；红包保持外部余额 1000；有效角色别名优先于根值。无真实 LLM 调用，未做真实 ST 实机或物理设备验收。
- **已发布渠道：**独立发布仓库停在 9 月 3 日。开发远端包含 9 月 7 日修复，但没有本地 9 月 i18n 基础及 10 月成果。manifest 语义版本仍为 `0.9.0`。

## 仍需推进或决定

1. **真实 ST 环境实机验收：**在真实酒馆环境中验证角色切换、MVU 状态更新结算同步、微信聊天与主会话连贯性及图片素材显示。
2. **分支合并与提交决策：**当前修改仍保留在未提交工作区，等待维护者确认后执行 git 提交、合并或发布。
3. **暂缓事项保留：**[DEFERRED](DEFERRED.md) 的 Renderer、导出身份/取消/大小写、管家恢复、分享封面、素材托管及发布自动化等均保持原状。

## 发布边界（未来执行时适用）

- 开发仓库保持 `st-stage`，新安装用 `st-stage-ext`。不重命名/复用旧仓库名，不重写发布历史、不嫁接开发历史。原因见 [拆分决定](history/2026-08-29-push-and-distribution-split-decision.md) 与 [发布记录](history/2026-08-30-distribution-repo-published.md)。
- 当前构建需要 **8 个基础文件及 `assets/wechat/` 素材目录**：基础文件为 `manifest.json`、`index.js`、`bundle.js`、`style.css`、`version.json`、`README.md`、`locales/zh-CN.json`、`locales/en-US.json`；微信素材当前 50 项。9 月及更早的“六文件”描述是历史基线，不能直接用于当前发布。
- 七个运行文件在根目录/生成目录/独立发布仓库间比较；README 仅比较生成目录与发布仓库，其源为 `st-extension/distribution-readme.md`，不使用源码首页覆盖它。
- 保留发布仓库 `.gitattributes` 与 LF 约束，不清空目录、不复制源码/测试/docs/public/reference/测试数据。先发布开发历史，再发布分发历史；当前尚未同步，不是已通过发布门禁。
