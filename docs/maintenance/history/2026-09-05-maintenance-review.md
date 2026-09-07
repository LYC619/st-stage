# 2026-09-05 维护窗口总体审查

## 结论与范围

本轮是 **单代理审查，不是修复或发布**。共确认 **8 项待修问题（3 项 P1、5 项 P2）**，另记录与既有 base64 设置膨胀直接相关的存量迁移缺口 S1。P1 指建议下一次发布前优先修复的问题；记录到 DEFERRED 不代表接受其发布风险。

- 时间窗口：2026-08-27 至 2026-09-05，Asia/Shanghai；窗口内最后一次代码提交在 2026-09-03。
- 比较基线：`af1fa37f5d3e5bd9ea13726ecaa0c6d7182bdfc6`。
- 审查 HEAD：`a942d5708e5cdb32921709d11d401985b3dddbe3`，`main`，共 37 个提交。
- `core`、`st-extension/src`、`st-extension/build.mjs` 的窗口差异共 68 个文件，+3568/-1183 行，包含对应测试。
- 开发仓库远端 `main`：`a942d5708e5cdb32921709d11d401985b3dddbe3`。
- 发布仓库 `st-stage-ext` 本地与远端 `main`：`d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b`；工作树干净。
- 当前构建号：`0.9.0+202609031245`；产品版本仍为 `0.9.0`。
- 两个远端均以只读 `git ls-remote` 核实，不以旧文档或本地 tracking ref 代替。
- 没有访问或修改真实 ST 用户设置、图片、聊天或凭据。上游 API 核对固定在 SillyTavern `1.18.0`，并非宣称已在用户实际安装版本上完成验收。
- 没有修改功能源码、正式测试或根目录发布产物，没有提交或推送。预先存在的未跟踪 `tore style.css` 保持原样。

原 CURRENT 的 `verified_code_head: 9e038dc` 是 HEAD 的祖先，但排除维护文档后的代码差异检查返回 1；其“两个仓库尚未推送”描述也已过时。旧全文（含未完成的手工验收项和发布细节）保存在 `2026-09-05-pre-review-status-snapshot.md`，不能再作为当前发布状态使用。

## 这段时间实际做了什么

| 日期 | 关键提交 | 实际变化 |
| --- | --- | --- |
| 08-27 | `116103a`、`75991ce`、`d9852e9` | 选择式 ST 标准备份、分分类懒加载、受限并发读取；修复部分备份丢数据边界，统一产物换行并重建。 |
| 08-30 | `62d0135` | 吸收真实 ST 验收反馈：角色关联聊天/世界书选择、列表操作与 UI；管家的高风险扩展排查入口改为只读指引，保留旧事务恢复。 |
| 08-30 | `a164acb`、`838c2af`、`0e6352c` | 运行时识别安装目录和自身扩展；拆分开发仓库 `st-stage` 与轻量发布仓库 `st-stage-ext`。 |
| 08-30 | `8a5bb3e`、`cfa7f48` | API App 首屏不再等待 secret 查询；压缩立绘提示词中的重复范围说明和示例。 |
| 08-31 | `1d8d901`、`8af9b16` | 清理泄漏到用户界面的仓库名与死代码，纠正安装目录改名说明。 |
| 09-01 | `fa42020`、`052c0ad`、`f3b7b3a`、`c07f1c1`、`bea201c` | 产品改名“百工”；修复 App 弹窗可视高度和关联世界书取消选择；撤下棋盘格相关处理、重写图床说明；支持“图名+编号”输入。 |
| 09-01 | `5bb78f0`、`225a337`、`9e038dc` | GIF 预设测试；新增每包清单提示词、默认关闭的近似匹配、只读变量速查悬浮窗，构建 `202609012048`。 |
| 09-02～09-03 | `487fd27`、`a942d57` | README 更新；图片保存改为直接调用 `/api/images/upload`，批量上传目录改用包名，构建 `202609031245`，已同步到发布仓库。 |

这些维护包含实质性的性能、备份和安全边界改进，并非仅改文案。不过，本轮问题集中在“宿主 API 契约、用户数据往返、完整 UI 交互、双仓库产物同步”四类边界。不能将已有单测全绿等同于这些边界已经验收。Git 作者/共同作者信息只能用于追踪提交，不据此断言每一行由哪个模型完成。

## 已确认的问题

### R1 — P1：不同立绘会写入同一个物理图片文件

- 位置：`st-extension/src/st-adapter.ts:117-128`；调用点 `sprite-manager.ts:2124-2128`、`2191-2197`；批量路径 `2536-2539`。
- 条件：在同一当前角色下，对两个包或两个服装中同名的 `happy` 立绘执行单张本地化或替换。调用方都传 `happy.webp + 当前角色名`，未包含包、角色分组、服装或独立文件身份。批量上传虽然改成包名目录，仍沿用原始文件名，而不是去重后的逻辑身份。
- 原因：适配器直接使用固定 `ch_name/filename/format`。核对的 ST 1.18.0 `/api/images/upload` 按该路径调用 `fs.promises.writeFile`，不会给已有文件自动追加唯一后缀。
- 复现：调用生产 `STAdapter`，使用与该上游源码一致的内存文件服务，依次保存两份不同字节。返回 URL 的去重数量为 **1**，第一次 URL 指向的内容已从 `QUFB` 变成 `QkJC`。
- 影响：第二次上传无提示地改掉第一张立绘，已有引用继续指向同一个文件；不是只丢一项设置映射，而是物理文件内容被覆盖。
- 归属：固定命名已有历史，但 `a942d57` 使此前未实际落盘的路径开始写文件，激活该风险。
- 修复方向：物理文件使用碰撞安全的独立身份（例如内容哈希或唯一 ID），不以展示名/标签直接决定覆盖。更新设置前确认新文件成功，避免先覆盖旧文件后再发现逻辑目标已变。

### R2 — P1：标准备份用角色显示名当聊天目录，恢复错位且 ZIP 会吞聊天

- 位置：`st-extension/src/apps/cloud-export/manifest.ts:75`；实际 ZIP 写入点 `zip.ts:28-29`。
- 条件一：角色 `avatar=Alice1.png`、`name=Alice`。备份写成 `chats/Alice/shared.jsonl`，而核对的 ST 1.18.0 `/api/chats/get` 根据 avatar 去掉 `.png` 后读取 `chats/Alice1/`。
- 条件二：`Alice.png`、`Alice1.png` 两张正常且身份不同的角色卡都显示为 Alice，并有同名聊天。两条记录会生成同一 ZIP 路径。
- 复现：生产 `buildCharacterFiles` 的 4 个预期文件只有 3 个唯一名称；进一步使用真实 JSZip 生成并重新读取 ZIP，确实仅剩 3 个非目录文件，聊天内容只保留后写入角色的那份，没有报错。
- 影响：解包后角色找不到对应聊天；同名路径情况下，备份本身已经少一份聊天，不能靠调整恢复目录救回。
- 归属：`git blame` 指向 `11dccc33`（2026-08-25），属于本次发现的存量缺陷，不误归因于 08-27 之后的提交。它与 DEFERRED 中“avatar 缺失/重复导致 ID 回退冲突”不是同一个问题：本复现的 avatar 有效且唯一。
- 修复方向：目录跟随 avatar 身份；在 ZIP 写入前检查全局路径唯一性，冲突应中止并报告，不能静默覆盖。增加导出后按 ST 目录规则恢复的往返测试。

### R3 — P1：上传失败仍被当作成功，悄悄退回 base64 设置

- 位置：`st-extension/src/st-adapter.ts:152-155`；单图本地化对保存结果的判断在 `sprite-localize.ts:69`。
- 条件：图片接口 HTTP 413/500、网络错误，或请求头能力调用失败。
- 原因：catch 只打印控制台错误，随后 `return base64Data`。调用方收到的是 fulfilled Promise，继续记入设置，批量路径还会按成功处理。
- 复现：将 fetch 响应设为 HTTP 413，生产适配器仍 resolve 为 `data:image/webp;base64,QUFB`；“必须拒绝失败上传”的断言失败。成功上传的对照组确实返回短路径，不把 data URI 写入设置。
- 影响：09-03 修复解决了正常请求路径，但用户报告的设置膨胀仍会在失败路径重现，而且用户看不到明确的上传失败。
- 归属：静默回退理念并非 09-03 才出现；`a942d57` 在更换接口时仍保留了它，属于该修复没有闭合的缺口。
- 修复方向：失败必须显式向上传播，保留原设置并允许重试。若仍需内嵌模式，必须明确选择并有容量限制，不能作为默认失败策略。

### R4 — P2：自定义图包的清单提示词刷新即丢，JSON 往返也不保留

- 位置：`core/migrate.ts:337-354`；`core/pack-io.ts:54-75`、`165-200`。
- 条件：编辑自定义图包的 `inventoryPrompt` 后保存，再刷新页面；或把图包导出为 JSON 后重新导入。
- 原因：`225a337` 增加了类型、编辑入口、prompt 消费和预设 override 处理，却没有把字段接入 `migratePack` 和 JSON 导入导出。saveSettings 会保存字段，loadSettings 必经的迁移函数随后将其丢弃；下一次保存会进一步抹掉持久化副本。
- 复现：生产 `STAdapter.saveSettings → loadSettings` 和 `exportPack → importPack` 两条路径，作者填写的测试文字都变为 `undefined`。
- 范围：确认影响自定义图包；预设 override 有单独 sanitizer，不把两者混为一谈。
- 修复方向：统一 metadata 的校验/序列化路径，补两条真实往返测试，而不只测编辑和 prompt builder 的单点结果。

### R5 — P2：最新上传修改使 TypeScript 门禁失败

- 位置：`st-extension/src/st-adapter.ts:139`。
- 证据：`node node_modules/typescript/bin/tsc --noEmit --incremental false` 返回 2，唯一诊断为 `TS2722: Cannot invoke an object which is possibly 'undefined'`。
- 原因：`STContext.getRequestHeaders` 被声明为可选，却直接调用；该行来自 `a942d57`。同文件的删除接口已有可选调用和 fallback。
- 影响：类型门禁不通过；在确实缺少该能力的宿主/适配环境中，异常还会进入 R3 的静默回退。esbuild 只转译，所以能构建不说明类型检查通过；不据此断言标准 ST 上每次上传都失败。
- 修复方向：明确宿主能力契约，缺失时显式处理，并将 tsc 纳入每次发布门禁。

### R6 — P2：变量悬浮窗只按 44px 按钮限位，展开面板和关闭按钮仍出屏

- 位置：`st-extension/src/variable-hud.ts:46-55`、`172-176`；面板宽度 `st-extension/style.css:2466-2470`。
- 条件：把折叠按钮放在手机右下角，再展开；或读取该位置且展开态为 true 的保存状态。
- 原因：所有位置只按 `BUTTON_SIZE=44` 限位，打开面板后不按实际面板尺寸重算；面板约 280px 宽。
- 复现：真实 headless Edge，375×667 视口，生产 HUD + 完整生成 CSS，合成保存状态 `(331,623,open=true)`。面板矩形为 `(331,623,282,96)`，右边界 613、下边界 719；关闭按钮 x=580、右边界 602，确定在屏幕之外。
- 范围：即使 CSS 完整也存在，因此当前 `st-stage-ext` 渠道同样受影响，不能与 R7 混为一谈。这是隔离浏览器几何验证，不是完整 ST 或真机验收。
- 归属：`225a337`。
- 修复方向：打开、数据重绘、拖动结束和视口变化时，依据展开态的实际尺寸夹紧位置，保证关闭入口始终可见。

### R7 — P2：旧安装渠道的根目录 CSS 没随变量 HUD 一起更新

- 位置：新增源样式 `st-extension/style.css:2441`；产物生成点 `st-extension/build.mjs:129-135`；受影响产物为仓库根 `style.css`。
- 证据：固定 `ST_STAGE_BUILD_TIME='2026-09-03 12:45'` 在隔离目录重建。根 `style.css` 为 **82,381 B**，重建和发布仓库 CSS 均为 **85,162 B**。根文件完全没有 `#st-stage-varhud` 选择器，但根 `bundle.js` 已含 HUD 逻辑。
- 三方校验：`bundle.js`、`index.js`、`version.json`、`manifest.json` 均与重建及发布仓库逐字节一致；仅根 `style.css` 不一致。根 CSS SHA256 为 `aa0417171e99244b2675f0d1af2f70a9b6f6a44d9e13a86ccff920dada5d6811`，正确 CSS 为 `af3d2f994ab3ac6e81be2d4eeffb3a71dfa816d6fd4c171a0ffdbe616d1ad03f`。
- 范围：**只影响仍从 `st-stage` 开发仓库安装并更新的兼容渠道；当前 `st-stage-ext` 发布仓库 CSS 是正确的。** 不将该缺失归因于所有已发布用户。
- 归属：`225a337` 增加样式后根产物漏同步；本轮核实仍未修复。
- 修复方向：同一时间戳重建两套产物，发布前做根目录、分发输出、发布克隆的五个运行文件 hash 校验，阻止 JS/CSS 混版。

### R8 — P2：备份搜索框每输入一个字符就失去焦点

- 位置：`st-extension/src/apps/cloud-export/export-app.ts:238`、`244`。
- 条件：正常点击“搜索当前分类”并连续键入。
- 原因：input 事件同步调用 `render()`，后者 `replaceChildren()` 删除包含搜索框的整棵 DOM，再新建 input；只恢复查询值和滚动位置，不恢复焦点/光标。
- 复现：挂载生产 `cloudExportApp`，聚焦搜索框并派发一次输入事件后，`document.activeElement` 不再是页面里的搜索框。
- 影响：无法连续输入搜索词，输入法组合态也面临被销毁的风险；本轮没有把 IME 专项真机验收当作已完成。
- 归属：搜索重渲染路径来自 `116103a`（2026-08-27），后续修了滚动位置但没覆盖输入焦点。
- 修复方向：保留输入节点，仅重绘结果区域；若必须重建，应处理 selection 和 composition 生命周期，不能只在测试中一次性赋完整字符串。

## S1 — 存量 base64 与 JSON 导入：升级本身不会缩小旧 settings

这项单独列为迁移/存储设计缺口，不冒充新引入的解析 bug。便携 JSON 支持内嵌图片是现有设计，但它与“日常运行设置只保存路径”的目标尚未分离。

- `loadSettings → migrateSettings → saveSettings` 保留原有内嵌图片，未做上传迁移；仅升级到当前版本不会把用户已膨胀的设置变小。
- `sprite-manager.ts:740-750` 的 JSON 导入只有大于 2MB 的确认提示，然后直接安装 `importPack` 的结果；内嵌图片没有经过 `saveImage`。
- 用合成 64KB data URI 分别跑旧设置加载/保存和 JSON 导入/保存，两者都原样保留内嵌字节，fetch 调用为 0。
- 建议单独提供可预览的存量迁移：先备份，按图片去重并采用 R1 的碰撞安全命名，成功写入并验证路径后才替换该 URI；失败保留原值、可重试，不提前删除旧数据。JSON 的便携格式可以继续内嵌，但安装到运行设置时应统一经过图片持久化边界。
- 本轮没有批量迁移、删除或重写用户真实设置。

## 验证记录

| 项目 | 本轮结果 | 说明 |
| --- | --- | --- |
| 原有 Vitest 完整套件 | **81 文件、1013 测试全部通过** | 单 worker、关闭文件并行；完整复跑用时 146.24s。 |
| TypeScript | **失败：1 个 TS2722** | R5，不因构建通过而忽略。 |
| ESLint | 通过，退出 0 | `core st-extension/src lib components app`。 |
| 固定时间戳隔离构建 | 通过 | 输出在忽略的 `.planning` 下，没有覆盖根产物。 |
| 新增隔离审查探针 | 13 项：**8 个期望断言失败、5 个对照/行为观察通过** | 8 个失败断言覆盖 R1/R2/R3/R4/R7/R8 六类根因；R2、R4 各有两个断言。不是原有套件新增了 8 个失败。 |
| HUD 浏览器几何 | 复现出屏，关闭入口不可见 | R6；真实 Edge + 合成页面，不使用用户浏览器资料。 |
| 双仓库远端状态 | 已只读核实 | 开发 `a942d57`，发布 `d6e8a89`。 |
| 真实 ST / 真机人工验收 | **未做** | 旧状态里的验收编号不自动变成已通过。 |

执行入口（工作目录为仓库根）：

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --reporter=dot
node node_modules/typescript/bin/tsc --noEmit --incremental false
node node_modules/eslint/bin/eslint.js core st-extension/src lib components app
$env:ST_STAGE_BUILD_TIME='2026-09-03 12:45'
node st-extension/build.mjs --output-root .planning/maintenance-review-2026-09-05/rebuild
node node_modules/vitest/vitest.mjs run --config .planning/maintenance-review-2026-09-05/vitest.audit.config.mjs --reporter=verbose
node .planning/maintenance-review-2026-09-05/hud-viewport.mjs
```

环境说明：rtk 不在当前 PATH。安装的 pnpm 11 与项目要求的 pnpm 10.32.1 不符，其自动重新安装流程在无 TTY 环境退出；未重装依赖，改用已有 node_modules 中的入口。首次沙箱运行的 4 个构建测试失败原因是 esbuild 读取 `C:/Users/yicha` 被拒绝；按权限流程获准后构建测试 18/18 通过，再次完整复跑 1013/1013 通过，没有把环境错误误报为产品问题。

### 证据位置与复验边界

本地临时证据位于 `.planning/maintenance-review-2026-09-05/`（git-ignored，不会随维护文档提交）：

- `audit.test.ts`、`vitest.audit.config.mjs`、`audit-probes.log`：生产模块调用和上述确定性断言。
- `full-suite-verified.log`、`typecheck.log`、`lint.log`、`rebuild.log`：门禁原始日志。
- `artifact-parity.json`：五个运行文件的三方 SHA256/大小结果。
- `hud-viewport.mjs`、`hud-viewport.json`、`hud-mobile-clipping.png`：浏览器复现脚本、矩形数据及截图；报告结论依据矩形数据。
- `upstream-images-1.18.0.js`、`upstream-chats-1.18.0.js`、`upstream-util-1.18.0.js`：上游固定版本只读取证副本。图片 probe 模拟了核实后的固定文件路径写入契约，不是声称请求过真实用户服务器。

供其他工作区重新取证的官方源码地址：

```text
https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/src/endpoints/images.js
https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/src/endpoints/chats.js
https://raw.githubusercontent.com/SillyTavern/SillyTavern/1.18.0/src/util.js
```

分别核对 `/upload` 固定路径与 `fs.promises.writeFile`、`/get` 的 avatar 目录身份、`clientRelativePath` 返回格式。`clientRelativePath` 本身未发现所怀疑的路径错误。没有将未经复现的近似匹配调参猜测列为确认缺陷，也没有把既有 DEFERRED 项重复计入八项结果。

## 建议修复顺序与后续门禁

1. 先处理 R1/R2/R3，阻止静默文件覆盖、备份缺项和上传失败吞错；同时规划 S1，避免用户误以为更新就能消除既有 30MB 设置。
2. 修复 R4 和 R5；数据字段须增加保存/重载和导入/导出的端到端往返断言。
3. 修复 R6/R7/R8；增加靠边展开、连续输入、两渠道产物一致性验证。
4. 完整运行测试、tsc、lint、同时间戳双输出构建及 hash 比较后，再进入真实 ST 验收。至少覆盖两套同名立绘、同名不同 avatar 角色备份恢复、HTTP 413/500、旧内嵌设置迁移、刷新后的提示词保留、手机边缘 HUD 和中文连续搜索。
5. 修复及发布要有独立后续授权。本轮只更新共享维护状态和审查历史，不提交、不合并、不推送，不把“审查完成”写成“问题已解决”。
