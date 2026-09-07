# 2026-09-05 批次 D/E：HUD 真实浏览器回归与发布门禁

> **执行约束：** 本文件是待批准的实施计划，不是修复、提交或发布授权。使用现有依赖、现有系统 Edge 和单 worker；不安装新浏览器、不复制用户数据、不清空发布仓库、不自动提交或推送。实施时由当前代理按 D → E 串行执行，不启动子代理或并行任务代理。

## 目标与前置条件

- D 关闭 R6/R8 的真实浏览器验收缺口：变量 HUD 展开后整个面板可见，搜索框逐字输入、光标、粘贴和 IME 组合不丢失。
- E 关闭 R7 和发布前交叉验证缺口：开发根目录、`st-distribution` 与发布仓库的运行产物按同一构建时间戳验证，README 只在两个分发位置之间比较。
- D 依赖批次 B 的搜索实现和批次 A–C 的稳定类型/调用链；E 依赖 A–D 的定向测试全部通过。
- 代码基线、发布仓库基线和真实远端引用必须在实施开始时重新读取；计划文件中的 `a942d5708e5cdb32921709d11d401985b3dddbe3` 与 `d6e8a892dbb7529a5b5fc8f53e4443e1bc33c03b` 仅是本次审查证据，不替代实时检查。

## D1：变量 HUD 按展开后的真实尺寸钳位

**文件范围：**

- `D:/8.Project/0_0_维护/st-stage/st-extension/src/variable-hud.ts`
- `D:/8.Project/0_0_维护/st-stage/st-extension/src/variable-hud.test.ts`
- `D:/8.Project/0_0_维护/st-stage/st-extension/style.css`（仅在实际几何修复需要 CSS 配合时修改）

- [ ] 在 `variable-hud.ts` 中把“可见边界”从固定 `BUTTON_SIZE = 44` 改为实际渲染盒子的边界。关闭态按按钮的完整 `DOMRect` 计算，打开态在面板显示后读取包含面板和关闭按钮的完整 `DOMRect`，再对 `left/top` 做二次钳位；不得只检查按钮矩形。
- [ ] 固定元素只使用一套坐标体系：若根节点保持 `position: fixed`，`left/top` 使用布局视口 CSS 坐标，不能把 `visualViewport.offsetLeft/offsetTop` 直接加到 fixed 坐标上。`visualViewport` 只作为移动端视口变化的事件源和重新测量触发器；`window.resize`、`visualViewport.resize`、`visualViewport.scroll` 均进入同一个合并后的重新测量流程。
- [ ] `setOpen(true)`、异步 `render()` 完成、变量内容增长、关闭、拖动结束和 resize 后都重新执行测量。重新测量不得同步递归触发自身；用一帧内合并的 `requestAnimationFrame` 或等价的单次调度，并在 `dispose()` 中取消待执行调度。
- [ ] 拖动时使用当前状态下的完整 HUD 尺寸计算最大 `x/y`，拖动结束写回已经钳位的位置；不能因为面板打开或内容变长把关闭按钮推到视口外。
- [ ] `dispose()` 取消窗口和 `visualViewport` 监听、待执行的测量帧和未完成渲染的 DOM 写入；迟到的 `readSections()` 结果不得重新填充已移除的 panel body。已有 token/disposed 保护必须保留并由测试覆盖。
- [ ] 失败路径显示的错误文本继续使用 `textContent`；不把变量值或异常消息拼接进 `innerHTML`。

**单元测试：** 在 `D:/8.Project/0_0_维护/st-stage/st-extension/src/variable-hud.test.ts` 增加可观察的几何测试，不只断言 style 字符串：

- [ ] 在 375×667 下模拟保存态 `(x=331, y=623, open=true)`，让 panel 的实际矩形为约 280×380，断言 panel 和 close button 的 `left/top/right/bottom` 全部落在视口内；同时断言关闭态按钮仍完整可见。
- [ ] 改变视口宽高并派发 `resize`，验证打开态和关闭态都重新钳位；模拟 `visualViewport.resize`/`scroll` 时验证使用同一套几何函数，且没有叠加 offset 导致坐标漂移。
- [ ] 让异步 `readSections()` 在 `dispose()` 后 resolve，断言 body、错误节点和 section 节点均不再变化；让内容从短列表增长到超过最大高度，断言 close button 仍可达且 body 继续滚动。
- [ ] 覆盖打开、关闭、拖动、pointercancel、重复 resize 和重复 dispose；断言 `writeState` 收到的坐标始终是当前完整 HUD 可见的坐标。

**D1 门禁命令：**

```powershell
node node_modules/vitest/vitest.mjs run st-extension/src/variable-hud.test.ts --maxWorkers=1 --no-file-parallelism --reporter=dot
node node_modules/typescript/bin/tsc --noEmit
```

## D2：真实浏览器回归（Edge，单 worker）

**新增测试范围：**

- `D:/8.Project/0_0_维护/st-stage/e2e/variable-hud.spec.ts` 或等价的独立 Playwright harness；若实现选择独立 harness，必须把入口、启动命令和 fixture 写入测试文件，不依赖人工点击。
- `D:/8.Project/0_0_维护/st-stage/playwright.config.ts`（仅增加单 worker 的专用 project/命令，不改变现有移动端项目的覆盖范围）
- 可复用但不提交运行日志：`D:/8.Project/0_0_维护/st-stage/.planning/maintenance-review-2026-09-05/hud-viewport.mjs`

- [ ] 真实浏览器优先使用本机系统 Edge（`PLAYWRIGHT_CHANNEL=msedge`）；配置 `workers: 1`，不下载或安装新浏览器。测试失败时保留 Playwright trace/screenshot 到临时目录，不能把真实用户 settings、密钥或本机路径样本写进仓库。
- [ ] 在真实浏览器中建立可重复的变量 HUD fixture，注入足够长的变量列表，逐一打开/关闭并读取 `getBoundingClientRect()`；测试断言 panel 和 `.so-varhud-close` 的完整矩形，不接受只断言 `.so-varhud-btn` 的结果。
- [ ] 固定回归场景：375×667、保存态 `(331,623,open=true)`；再覆盖 360×740、390×844、844×390 和一次页面旋转/等价 viewport 交换。每个场景都断言 `0 ≤ left/top`、`right ≤ innerWidth`、`bottom ≤ innerHeight`，并断言关闭按钮可见且可点击。
- [ ] 在面板已经打开后增加变量内容、触发异步刷新、拖动 HUD、触发 resize 和 visual viewport 变化；每一步都重新读取矩形，验证内容增长、拖动和视口变化不会把面板或 close button 推出视口。
- [ ] 关闭 HUD 后验证状态写入；调用 dispose 后触发一次迟到的异步读取，断言 DOM 不再恢复且事件监听不再造成写入。
- [ ] 对备份搜索页面使用真实键盘逐字输入、光标移到中间插入、退格、粘贴和 compositionstart/compositionupdate/compositionend；每个阶段断言同一个 input 节点仍在 DOM、仍有 focus，value/caret 与浏览器输入结果一致。不得只用 `dispatchEvent(new Event('input'))` 或 jsdom 合成事件作为唯一证据。

**D2 门禁命令：**

```powershell
$env:PLAYWRIGHT_CHANNEL='msedge'
node node_modules/@playwright/test/cli.js test e2e/variable-hud.spec.ts --workers=1 --project=variable-hud-edge
```

如果专用 harness 需要现有 Next server，则沿用 `D:/8.Project/0_0_维护/st-stage/playwright.config.ts` 的 `webServer`，不得另起会写入用户目录的服务；没有系统 Edge 时保留测试未验收，不能改成“已通过”。

## E1：代码与全套验证门禁

- [ ] 重新运行批次 A–D 的所有定向测试；然后运行全套 Vitest、tsc、lint、Next build 和 extension build。继续使用现有 `node_modules`，不执行依赖安装，不把 pnpm 11 当成项目声明的 pnpm 10.32.1。
- [ ] 全套命令必须显式单 worker、无文件级并行；失败输出保存在临时目录，最终只将摘要和命令写入维护 history，不提交日志、settings 或密钥。

```powershell
node node_modules/vitest/vitest.mjs run --maxWorkers=1 --no-file-parallelism --reporter=dot
node node_modules/typescript/bin/tsc --noEmit
node node_modules/eslint/bin/eslint.js core st-extension/src lib components app
node node_modules/next/dist/bin/next build
node st-extension/build.mjs
node st-extension/build.mjs --output-root st-distribution
```

- [ ] 构建前记录工作树状态、当前 commit、manifest 版本和 UTC/Asia-Shanghai 构建时间；使用同一个显式构建时间戳依次生成开发根产物与 `st-distribution`，不覆盖未授权的用户目录或正式发布仓库。
- [ ] 验证五个运行文件的根目录与 `st-distribution` 字节完全一致：`manifest.json`、`index.js`、`bundle.js`、`style.css`、`version.json`。五个文件任一 hash 不同即失败，不自动复制、加后缀或继续发布。

## E2：只读跨渠道产物与 README 一致性

**新增只读脚本：**

- `D:/8.Project/0_0_维护/st-stage/scripts/verify-runtime-parity.mjs`

- [ ] 脚本只接受显式的开发根目录、`st-distribution` 和发布仓库目录参数；只执行 `stat/read/hash/compare`，不含复制、删除、移动、git commit、git push 或目录清空能力。五个运行文件逐一输出相对路径、字节数和 SHA-256；缺失、路径是目录、大小写/路径越界或 hash 不一致时以非零状态退出。
- [ ] 脚本额外比较 `st-distribution/README.md` 与发布仓库 `README.md`；不把开发根目录 `README.md` 当成分发 README 的相等对象。
- [ ] 在发布仓库 `D:/8.Project/0_0_维护/st-stage-ext` 已存在且获得明确只读检查授权时，执行脚本只读比较；不存在、不可访问或远端未重新验证时保留跨渠道门禁未验收，不猜测结果。
- [ ] 验证 `st-stage-ext` 目录的 `.gitattributes` 和 LF 规则没有被开发构建改写；不向该目录复制任何源码、测试、`docs/`、`public/` 或 `reference/` 内容。

**E2 门禁命令：**

```powershell
node scripts/verify-runtime-parity.mjs `
  --root . `
  --distribution st-distribution `
  --release D:/8.Project/0_0_维护/st-stage-ext
```

## E3：发布决策边界与完成定义

- [ ] 默认不发布、不提交、不推送。实施完成最多得到“代码修复 + 本地门禁通过”的状态；只有用户另行明确授权时，才进入提交、复制、发布仓库检查或推送步骤。
- [ ] 发布授权后仍保持顺序：先在开发仓库提交源码和五个根产物，再在分发仓库只放入六个允许文件（五个运行文件 + `README.md`），再次运行只读 parity，最后才可提交/推送分发仓库；不重写分发历史、不强推、不清空现有 clone。
- [ ] 任何一项真实 ST、系统 Edge、跨渠道 hash、重载后 settings 或物理手机验收缺失，都必须在最终报告中明确标为未验收，不能用单元测试、旧审查结果或“构建成功”替代。
- [ ] R6 完成定义：375×667 保存态 `(331,623,open=true)` 下 panel 与 close button 完整可见；旋转、resize、内容增长、拖动、关闭、dispose 和迟到异步读取均有真实浏览器或单元证据。
- [ ] R7 完成定义：根目录与 `st-distribution` 五文件字节一致；若发布仓库可读，则与 `st-stage-ext` 五文件一致，distribution README 与发布 README 一致；开发根 README 不参与该 README 等值断言。
- [ ] R8 完成定义：连续逐键输入、中间插入、删除、粘贴和 IME 组合过程中，search input 节点、焦点、caret 和 value 不因 render 重建而丢失。
- [ ] E3 完成后更新 `D:/8.Project/0_0_维护/st-stage/docs/maintenance/CURRENT.md`、`D:/8.Project/0_0_维护/st-stage/docs/maintenance/DEFERRED.md` 和新的维护 history，写入真实 commit、构建时间、测试命令、hash 摘要和未验收项；不把本计划的预期结果写成已完成事实。

## 批次 D/E 最终检查表

- [ ] `git diff --check` 通过；`git status --short` 只包含已授权的源码、测试、计划和维护文档改动，保留原有未跟踪的 `D:/8.Project/0_0_维护/st-stage/tore style.css`。
- [ ] 变更范围未触碰真实用户 settings、备份、发布仓库数据或 `D:/8.Project/0_0_维护/st-stage-ext`；没有自动提交或推送。
- [ ] 没有把任何审查基线的 81 文件/1013 测试、13 个 probe 或旧构建 hash 冒充本次修复结果。
- [ ] 只有在 R1–R8、S1 的完成定义、D2 真实浏览器回归和 E2 产物 parity 全部具备证据后，才可以向用户报告“可考虑发布”；否则报告具体缺口。
