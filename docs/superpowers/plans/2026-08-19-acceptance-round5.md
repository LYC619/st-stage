# 第五轮真实 ST 反馈修复实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复第五轮真实 SillyTavern 验收暴露的交互、图库和管家问题，并提供用户主动确认的棋盘格清理工具。

**Architecture:** 保留现有消息后处理、手机壳、图包数据和管家测量边界。纯筛选、标签变换、图片像素清理和指标摘要下沉到可单测的纯函数；DOM 层只负责状态、确认和渲染。Renderer 分支生成协议不进入本轮。

**Tech Stack:** TypeScript、原生 DOM、Canvas/ImageData、Vitest/jsdom、Playwright、esbuild、Next.js。

---

### Task 1: 稳定变量显示开关和手机事件边界

**Files:**
- Modify: `core/phone-shell.ts`
- Modify: `core/phone-shell.test.ts`
- Modify: `st-extension/src/index.ts`
- Modify: `st-extension/src/index.test.ts`
- Modify: `st-extension/src/apps/newvar-app.ts`
- Create: `st-extension/src/apps/newvar-app.test.ts`

- [x] **Step 1: 为手机壳事件隔离写失败测试**

在 `core/phone-shell.test.ts` 创建手机后，在手机壳外层监听 `pointerdown`、`touchstart` 和 `click`，从手机内 checkbox 派发可冒泡事件，断言外层监听均未触发：

```ts
it('手机内交互不会冒泡到后方聊天控件', () => {
  const outside = vi.fn()
  document.body.addEventListener('click', outside)
  const { shell } = setup([checkboxApp()], { open: true })
  shell.openApp('settings')
  document.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
  expect(outside).not.toHaveBeenCalled()
  shell.destroy()
})
```

- [x] **Step 2: 运行测试并确认因事件仍冒泡而失败**

Run: `pnpm exec vitest run core/phone-shell.test.ts`

Expected: 新测试收到一次 body click。

- [x] **Step 3: 在手机壳边界隔离交互事件**

给 `.so-phone-shell` 安装 `pointerdown`、`touchstart`、`click` 的冒泡阻断；不调用 `preventDefault()`，保证 checkbox、按钮、滚动和输入框默认行为仍可用。`destroy()` 时移除监听。

```ts
const stopShellEvent = (event: Event) => event.stopPropagation()
for (const type of ['pointerdown', 'touchstart', 'click']) {
  shell.addEventListener(type, stopShellEvent)
}
```

- [x] **Step 4: 为变量开关反馈和外部 Regex 边界写失败测试**

在 `index.test.ts` 保持 `hideUpdateBlocks` 变化后立即调用一次消息重处理的断言；新建 `newvar-app.test.ts`，验证关闭隐藏时向用户确认 st-stage 已恢复自身快照，并说明 ST Regex 等外部规则仍可能独立删除变量块。

- [x] **Step 5: 增加可观察反馈，不改变现有同步恢复语义**

保留 `index.ts` 和 `message-postprocess.ts` 的同步恢复，不改写原始消息。新变量开关切换后使用 `ctx.toast()` 告知“已隐藏”或“已恢复”；关闭时明确提示若仍不可见，应检查 ST Regex 中删除 `UpdateVariable` 的规则。

- [x] **Step 6: 运行定向测试**

Run: `pnpm exec vitest run core/phone-shell.test.ts st-extension/src/index.test.ts st-extension/src/apps/newvar-app.test.ts st-extension/src/message-postprocess.test.ts`

Expected: 全部通过；现有开→关恢复测试继续通过。

### Task 2: 图包列表筛选、堆叠尺寸和标签管理

**Files:**
- Modify: `core/sprite-store.ts`
- Modify: `core/sprite-store.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`
- Modify: `st-extension/style.css`

- [x] **Step 1: 为包级筛选与标签重命名/删除写纯函数失败测试**

新增并测试：

```ts
filterSpritePacks(packs, {
  query: '小雪', roles: ['小雪'], kinds: ['illustration'], customTags: ['主线'],
})
renamePackCustomTag(settings, '主线', '剧情')
deletePackCustomTag(settings, '废弃')
```

筛选规则：搜索覆盖包名、角色、服装、自定义标签；不同维度取交集，同一维度多选取并集；空筛选返回原顺序。重命名合并重复标签，删除后移除空字段。

- [x] **Step 2: 运行纯函数测试并确认导出缺失**

Run: `pnpm exec vitest run core/sprite-store.test.ts`

Expected: 新函数未定义导致失败。

- [x] **Step 3: 实现最小纯函数**

使用 `normalizeLabels()` 规范化标签，不新增设置 schema 字段；角色和类型仍从图包实时派生。

- [x] **Step 4: 为列表 UI 写失败测试**

在 `sprite-manager.test.ts` 覆盖：

```ts
expect(document.querySelector('.so-pack-filter-search')).not.toBeNull()
expect(document.querySelectorAll('.so-pack-card')).toHaveLength(1)
findButton(document, '标签管理').click()
expect(document.querySelector('.so-tag-manager')).not.toBeNull()
```

同时断言：单包角色仍是普通卡；多包折叠组有 `N 个图包`；批量 checkbox 的角标层级类独立存在。

- [x] **Step 5: 实现图包列表工具栏和标签管理弹窗**

列表顶部加入搜索框、角色/类型/自定义标签筛选和“标签管理”。标签管理只允许添加、重命名、删除自定义标签；角色、类型以只读说明展示。修改预设包标签时继续调用 `persistSelectedPresetMetadata()`。

- [x] **Step 6: 修复折叠卡布局和角标层级**

移除折叠态 `.so-role-pack-group` 的无条件 `grid-column: 1 / -1`，仅展开态添加 `.so-role-pack-group-expanded` 跨满整行。堆叠卡使用普通网格单元宽度，checkbox 的 `z-index` 高于“使用中”、预设和资源标签。

- [x] **Step 7: 运行图库定向测试**

Run: `pnpm exec vitest run core/sprite-store.test.ts st-extension/src/sprite-manager.test.ts`

Expected: 全部通过，已有本地/云端、同 ID 本地化和批量管理测试不回归。

### Task 3: 棋盘格像素清理和安全本地化

**Files:**
- Create: `core/checkerboard-cleanup.ts`
- Create: `core/checkerboard-cleanup.test.ts`
- Modify: `core/image-compress.ts`
- Modify: `core/image-compress.test.ts`
- Modify: `st-extension/src/sprite-localize.ts`
- Modify: `st-extension/src/sprite-localize.test.ts`
- Modify: `st-extension/src/sprite-manager.ts`
- Modify: `st-extension/src/sprite-manager.test.ts`

- [x] **Step 1: 为保守棋盘格清理写像素级失败测试**

测试构造两种浅灰交替背景和中央彩色前景，断言：

```ts
const result = removeBakedCheckerboard({ data, width: 8, height: 8 })
expect(result.removedPixels).toBeGreaterThan(0)
expect(alphaAt(result.data, 0, 0)).toBe(0)
expect(pixelAt(result.data, 4, 4)).toEqual([220, 40, 70, 255])
```

另测普通不透明图、已有透明图和无法建立双背景色证据时返回 `null`，不得改像素。

- [x] **Step 2: 运行测试并确认模块缺失**

Run: `pnpm exec vitest run core/checkerboard-cleanup.test.ts`

Expected: 模块未找到。

- [x] **Step 3: 实现边缘连通的保守清理算法**

从边缘采样两种高亮低色差主色，确认两色占比和亮度差满足现有棋盘格证据；只 flood-fill 与这两色接近且和边缘连通的像素。对透明区域边缘一像素按背景色距离生成部分 alpha，降低灰边；中央、非连通和颜色距离过大的像素保持不变。

- [x] **Step 4: 提供 Blob 到透明 PNG 的浏览器包装**

在 `image-compress.ts` 新增 `cleanCheckerboardImage(blob)`：解码原图、读取原尺寸 ImageData、调用纯函数、写回 canvas 并导出 `image/png` Blob。不能确认棋盘格时抛出中文错误，不输出破坏性结果。

- [x] **Step 5: 为清理并保存链路写失败测试**

在 `sprite-localize.ts` 新增 `cleanAndLocalizeSprite()`，允许读取远程或 ST 本地图片 URL；确认下载后先清理再 `saveImage`，远程源返回 `{ url: local, remoteUrl: original }`，本地源只替换 `url` 并保留原有 `remoteUrl`。清理或保存失败时不更新图包。

- [x] **Step 6: 在图片详情中加入主动操作**

非预设和预设都允许对远程或本地源执行“检测并去除棋盘格”。点击后先读取像素，只有确认棋盘格时才请求风险确认并清理；成功更新同一个 sprite，同 ID 图包不新建副本；失败或不是棋盘格时保留原地址并显示原因。打开管理器或图片预览本身不得后台下载图片。

- [x] **Step 7: 运行图片定向测试**

Run: `pnpm exec vitest run core/checkerboard-cleanup.test.ts core/image-compress.test.ts st-extension/src/sprite-localize.test.ts st-extension/src/sprite-manager.test.ts`

Expected: 全部通过；普通图不出现误导性的“已清理”结果。

### Task 4: 管家中文对比报告

**Files:**
- Modify: `st-extension/src/apps/butler/types.ts`
- Modify: `st-extension/src/apps/butler/actions.ts`
- Modify: `st-extension/src/apps/butler/actions.test.ts`
- Modify: `st-extension/src/apps/butler/modals.ts`
- Modify: `st-extension/src/apps/butler-app.test.ts`

- [x] **Step 1: 为用户指标摘要写失败测试**

定义 `MeasurementSummaryRow`，并测试 `summarizeMeasurementComparison(before, after)` 输出固定顺序：网页内存、页面节点、消息数、图片/媒体数、6 秒长任务、最长卡顿、95% 帧间隔、定时器延迟。每行包含中文名、格式化前值/后值、变化和解释。

- [x] **Step 2: 运行测试并确认摘要函数缺失**

Run: `pnpm exec vitest run st-extension/src/apps/butler/actions.test.ts`

Expected: 新导出不存在。

- [x] **Step 3: 实现显式路径映射而非递归暴露内部字段**

从现有 metrics 的稳定路径读取数据；缺失项显示“未读取到”，不补零。内存以 MB、时延以 ms、计数以项显示。只有 `compareMeasurements().comparable` 时给出变化方向。

- [x] **Step 4: 改造详细报告 DOM**

“优化前后”先显示中文摘要表，再显示说明：网页内存受垃圾回收和缓存影响，单次升降不能证明设置有效；需结合长任务、帧间隔和同条件复测。内部原始 JSON 下移到默认折叠的“高级：原始数据”。

- [x] **Step 5: 运行管家报告测试**

Run: `pnpm exec vitest run st-extension/src/apps/butler/actions.test.ts st-extension/src/apps/butler-app.test.ts`

Expected: 中文摘要、内存说明和高级原始数据断言通过。

### Task 5: 常用系统扩展用途顾问

**Files:**
- Create: `st-extension/src/apps/butler/extension-advisor.ts`
- Create: `st-extension/src/apps/butler/extension-advisor.test.ts`
- Modify: `st-extension/src/apps/butler/modals.ts`
- Modify: `st-extension/src/apps/butler-app.test.ts`

- [x] **Step 1: 为扩展目录建议写失败测试**

对 `expressions`、`gallery`、`memory`、`quick-reply`、`regex`、`stable-diffusion`、`translate`、`tts`、`vectors` 等常用系统扩展返回：中文名称、用途、适用场景、关闭后失去什么、建议等级。未知扩展只显示 manifest 和当前状态，不虚构性能结论。

- [x] **Step 2: 运行测试并确认模块缺失**

Run: `pnpm exec vitest run st-extension/src/apps/butler/extension-advisor.test.ts`

Expected: 模块未找到。

- [x] **Step 3: 实现静态用途目录和保守建议规则**

建议只取 `保留`、`不用时可临时关闭`、`排障时可临时关闭观察`。规则基于扩展用途和当前启用状态，不宣称实际耗时，不自动改变禁用清单。

- [x] **Step 4: 在扩展排查界面先展示顾问，再展示勾选操作**

系统扩展进入只读用途卡片；第三方扩展继续使用官方启停和刷新后生效流程。每个建议明确“为什么建议”“关闭会失去什么”“下一步怎么做”，st-stage 自身继续受保护。

- [x] **Step 5: 运行扩展顾问测试**

Run: `pnpm exec vitest run st-extension/src/apps/butler/extension-advisor.test.ts st-extension/src/apps/butler-app.test.ts st-extension/src/apps/butler/bridge.test.ts`

Expected: 常用扩展说明可见，系统扩展不被默认批量勾选，现有紧急恢复和二分排查测试通过。

### Task 6: 完整验证、产物和维护交接

**Files:**
- Modify: `docs/maintenance/CURRENT.md`
- Modify: `docs/maintenance/DEFERRED.md`
- Create: `docs/maintenance/history/2026-08-19-acceptance-round5.md`
- Regenerate: `bundle.js`
- Regenerate: `index.js`
- Regenerate: `style.css`
- Regenerate: `version.json`
- Regenerate: `st-distribution/*`

- [x] **Step 1: 恢复锁定依赖**

Run: `pnpm install --frozen-lockfile`

Expected: pnpm 10.32.1 成功，`pnpm-lock.yaml` 无变化。

- [x] **Step 2: 运行完整代码门禁**

```powershell
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm test:mobile
git diff --check
```

Expected: Vitest、TypeScript、ESLint、Next production build、桌面/Pixel 7/Galaxy S8 Playwright 全绿。

- [x] **Step 3: 固定新构建戳并双轮重建**

使用同一个 `ST_STAGE_BUILD_TIME` 依次运行根产物和 `st-distribution/` 构建两轮，核对共享 4 文件 SHA-256 完全一致，发布目录恰好 6 文件且不含图片、`public/`、`reference/` 或预设源。

- [ ] **Step 4: 更新延期和真实 ST 复验清单**

`DEFERRED.md` 保留 Cards 预生成分支、143 张源图全量清理/CDN、Renderer 图片监听和 HTML 检测。`CURRENT.md` 只记录自动化结果，把第五轮功能列为待真实 ST 复验，不宣称真机通过。

- [ ] **Step 5: 提交、快进合并并推送**

```powershell
git add <本轮文件>
git commit -m "fix: complete fifth ST acceptance round"
git switch main
git merge --ff-only codex/acceptance-round5
git push origin main
```

Expected: `HEAD == origin/main`，工作区干净。
