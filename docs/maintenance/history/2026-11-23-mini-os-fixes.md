# Mini-OS R1–R10 修复交接（2026-11-23）

按用户要求关闭[独立审查](2026-11-23-mini-os-review.md)确认的全部 10 项问题（由 Codex 实施修复与门禁验证，Gemini 复核代码后完成 `main` 提交与推送）。

## 基线与交付边界

- 分支 `main`，产品修复提交 `abfa4ee667fc63a6d84a7e23bfdca9653b8362ae`（基于 `2a2ee44`），正式发布构建提交 `28e05afe89680a7849b305a4f4b74ac4949df1fd`，已推送至 `origin/main`；其余本地历史分支均已合并入 `main`。
- 正式版 **0.9.0+202611232112**；通过 `release-full.mjs --publish` 同步至 `../st-stage-ext` 并推送（提交 `fd7dc527fee7343d466a47bb32fdaa9997cfbbf8`，更新 `bundle.js`、`style.css`、`version.json` 共 3 个文件，其余 57 个文件不变）。
- 四处（根目录、`st-distribution/`、`public/`、`../st-stage-ext`）已通过 `verify-runtime-parity.mjs --committed` **60 文件 SHA-256** 一致性校验；主包 **758714 bytes**，SHA-256 `936660130dec1f281dd5fea120bbcf39a79c33a106a09650d7d7959e3ab615df`。发布回执与原文件备份留存于 `test-results/mini-os-fixes-publication-2026-11-23/release-full/`。没有改动既有持久化顶层键名或用户日常 ST 数据。

## 逐项修复与正式回归

下列相对路径以 `st-extension/src/apps/` 为起点，`core/`、`e2e/` 除外；单测净增 **31 项**，Chromium E2E 净增 **6 项**。

| 问题 | 实现文件与行为 | 新增正式回归 |
| --- | --- | --- |
| R1 | `wechat/contact-identity.ts`、`types.ts`、`bridge.ts`、`conversations.ts`、`wechat-app.ts`、`memory.ts`、`replies.ts`、`social-ui.ts`、`moments-controller.ts`：新增故事 NPC 身份，按故事与姓名生成稳定 ID，传播 `conversationScope.storyKey`；通讯录／私聊按故事隔离，卡片水合结果过期时丢弃；NPC 不进入要求真实卡片的群成员／动态作者目录 | `wechat/story-contact.test.ts` 2 项：创建与发送、JSON 重载、草稿／历史、同角色不同聊天隔离、旧会话并存、真实卡片兼容与迟到水合 |
| R2 | `chronicle/calendar-controller.ts`：生成提交前读取最新 notes，仅更新生成负责的 days | `chronicle/calendar-concurrency.test.ts` 3 项：等待期间新增、编辑、删除约定 |
| R3 | `theater/controller.ts`、`generate.ts`、`diary.ts`：从最新故事合并指定频道，保留赞／珍藏的正反操作与等待期间新弹幕；不更新未刷新频道 | `theater/controller.test.ts` 2 项；`generate.test.ts` 的容量夹具改为不同帖子，兼容身份去重 |
| R4 | `story-state/local-edits.ts`、`story-state-app.ts`、`store.ts`：串行读取最新状态并按条目身份修改；失败回滚自身写入且队列继续；切聊天／卸载取消排队；点击时捕获表单值 | `story-state/editing.test.ts` 8 项：连续加一、跨字段、删除后索引变化、失败恢复、切聊天／卸载、排队表单值 |
| R5 | `story-state/sync.ts`：刷新版本号与 await 后的生命周期／设置／聊天身份复核；过期失败也不能清空新注入 | `story-state/sync.test.ts` 新增 5 项：关闭、无通知切聊天、销毁、过期成功与失败 |
| R6 | `core/phone-swipe.ts`、`phone-shell.ts`、`phone-shell.css`：单指左缘方向识别，仅阻止符合条件的横向导航触摸；原生横滚容器与交互控件排除，取消／切屏／销毁清理 | `core/phone-swipe.test.ts` 3 项；`e2e/phone-gestures.spec.ts` 3 场景 × 2 设备：真实 CDP 触摸四布局返回、纵横滚动／控件／键盘、日历按钮；`e2e/load-extension.ts` 支持独立候选加载 |
| R7 | `sprite-app.ts`：共用 `effectiveSpriteAddress` 与 `formatAddress` | `sprite-app.test.ts` 新增 2 项：多角色同服装同表情、包名回退及图片级角色／服装，复制标签反解回选中图 |
| R8 | `appearance/pack.ts`、`appearance-app.ts`：显式空壁纸与缺失继承分开，角色绑定保留空串 | `appearance/pack.test.ts`、`appearance-app.test.ts` 各新增 1 项：导入／重载与角色绑定后全局壁纸变化 |
| R9 | `theater/diary.ts`：零未收藏名额返回空数组；空新增也收敛历史超额数据 | `theater/diary.test.ts` 新增 1 项：30 篇收藏满额与旧超额档案 |
| R10 | `appearance/pack.ts`、`appearance-app.ts`、`core/phone-shell.ts`：保留显式 0；缺省滑块显示 36%，仅 undefined 使用 CSS 默认值 | `appearance/pack.test.ts`、`appearance-app.test.ts`、`core/phone-shell.test.ts` 各新增 1 项：零值往返、滑块保存、CSS 应用／恢复缺省 |

## 实跑门禁与交接

- `pnpm test`：**151 文件／1660 项全通过**；首次全量有 1 项新增断言漏计夹具中既有物品，修正测试后定向 8/8 与再次完整 1660/1660 通过。
- `pnpm typecheck`、`pnpm lint --max-warnings 0`：通过，0 类型错误、0 lint 错误／警告；i18n **874 键／956 引用**、App 文档 **13 项**校验通过。
- `pnpm test:release`：**26/26**；`pnpm test:mobile --workers=2`：**33/33**；真实 Chromium 触摸覆盖 **320×667、390×844、667×375、1365×900** 无横向溢出与焦点恢复。
- `pnpm build`、`pnpm build:all` 与 `release-full.mjs --publish` 全流程通过；发布后实跑 `verify-runtime-parity.mjs --committed --root . --distribution st-distribution --preview public --release ../st-stage-ext`，四处 **60 文件 SHA-256** 与已提交清单全部对齐。
- 证据：`test-results/mini-os-fixes-2026-11-23/` 与 `test-results/mini-os-fixes-publication-2026-11-23/release-full/release-full.json`；前置定向证据另见 `mini-os-audit-2026-11-23/`。3101 测试服务已退出，`next-env.d.ts` 恢复原状。
- 已从 `DEFERRED.md` 移除 R1–R10，并完成源码仓与安装仓双仓提交和推送；[真实宿主／实体设备等外部验收](../EXTERNAL-ACCEPTANCE.md)继续保留。
