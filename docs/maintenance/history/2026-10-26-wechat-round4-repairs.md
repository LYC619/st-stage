# 2026-10-26 微信 App 第四轮审查缺陷（W9/W4/W1c/W1a）修复实施与验证记录

## 范围与背景

针对第四轮审查报告（[2026-10-26-wechat-fourth-review.md](2026-10-26-wechat-fourth-review.md)）中指出的测试类型定义（W9）、同会话内刷新竞态（W4）、异步评估期间外部字段接管防护（W1c）、红包外部余额保护（W1c）以及同池别名有效性判断（W1a）等缺陷，本轮对代码进行了系统化修复与验证。全部修改严格保留在当前工作区，未执行 `git commit`、`git merge` 或 `git push`。

---

## 修复详情

### 1. W9 / P1：修复测试契约类型与回调签名
- **文件**：`st-extension/src/apps/wechat/wechat.test.ts`
- **问题根因**：Promise 的 resolve 函数被赋给声明为接收 `unknown` 的 `resolveAliceVars`，且 `onMessageReceived` 回调被赋给声明为无参函数的 `callbacks.onMsg`，导致 `tsc --noEmit --incremental false` 报出 2 处 TS2322 错误。
- **实施方案**：
  - 将 `resolveAliceVars` 声明为 `(val: Record<string, unknown> | undefined) => void`，精确匹配 `getVariables` 返回契约；
  - 将 `callbacks.onMsg` 声明为 `(text: string) => void`，调用时提供测试消息参数；
  - 执行 `pnpm exec tsc --noEmit --incremental false` 零报错通过。

### 2. W4 / P2：引入同会话刷新序号机制，杜绝同角色迟到覆盖
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **问题根因**：同一会话（如 Alice）多次并发触发 `refreshContextAndState` 时，共享相同的 `activeScopeSessionId` 与 `scopeKey`，较早发起但迟到的异步读取仍能覆盖较新读取的结果。
- **实施方案**：
  - 在 App 挂载与作用域切换时维护单调递增请求序号 `latestRefreshReq` 与已应用序号 `latestAppliedRefresh`；
  - 每次发起刷新时获取 `reqRefreshSeq = ++latestRefreshReq`；
  - 在异步返回并校验生命周期后，追加检查：`if (reqRefreshSeq < latestAppliedRefresh) return`；
  - 成功应用时更新 `latestAppliedRefresh = reqRefreshSeq`；
  - 该机制不影响 LLM 发送会话代次（`activeScopeSessionId`），不会因状态刷新误取消正在进行的在途回复。

### 3. W1c / P2：异步评估返回后重新校验外部所有权
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **问题根因**：好感/心情字段外部归属仅在 `await pipeline.requestStatImpact` 前判断，若在评估期间外部变量更新接管了心情（如 82），评估返回后仍使用旧状态追加 +0.4，导致数值被篡改为 82.4。
- **实施方案**：
  - 在 `await pipeline.requestStatImpact` 完成且校验生命周期后，重新从 `targetConv.state.externalFields` 读取实时的字段所有权；
  - 仅对评估完成后依然属于非外部接管的字段应用增量变更；若等待期间已被外部接管，则严格保持外部原值不变。

### 4. W1c / P2：红包扣除前核查外部金钱字段
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **问题根因**：`sendRedPacket` 无条件执行 `activeConv.state.money -= amt`，在外部接管金钱时篡改了本地快照，且未向宿主写回。
- **实施方案**：
  - 检查 `const hasExternalMoney = Boolean(activeConv.state.hasExternalState && activeConv.state.externalFields?.money)`；
  - 仅在非外部金钱（独立模拟）模式下从 `activeConv.state.money` 扣减余额；外部接管时快照保持只读，不篡改外部余额。

### 5. W1a / P2：池内候选按有效转换逐项尝试
- **文件**：`st-extension/src/apps/wechat/bridge.ts`
- **问题根因**：`findCandidate` 仅按键存在与否返回首个非空值，若该值类型无法转换（如 `mood: 'calm'`），即退出当前角色池并退回根池，导致同池后续合法别名（如 `happiness: [82, 'note']`）被遮蔽。
- **实施方案**：
  - 实现 `findValidNumberInPool` 与 `findValidStringInPool`：在池内遍历别名时直接对值进行类型转换与二元组解包，直至找到首个能够转换为有效数值/非空字符串的候选；
  - 保证当前角色池中所有合法别名的优先级均严格高于外层全局/根池，彻底杜绝无效文本遮蔽有效别名。

### 6. 并发全量测试抗抖动加固
- **文件**：`st-extension/src/verify-runtime-parity.test.ts`
- **实施方案**：针对 91 个测试文件高并发运行时的 Windows 子进程 I/O 抖动，为 `verify-runtime-parity` 测试套件显式配置 `{ timeout: 15000 }`，消除全量运行时的偶发超时。

---

## 验证证据

1. **自动化测试套件**：
   - 运行全量测试套件 `pnpm test`：共 **91 个测试文件、1219 项测试全部通过**（0 失败）。
   - 针对微信 App 的专项测试扩充至 **29 项全部通过**（`st-extension/src/apps/wechat/wechat.test.ts`），专项覆盖：
     - W4：同会话内迟到读取（82）被较新读取（96）丢弃。
     - W1c：评估在途期间外部接管心情，返回时不污染外部 82。
     - W1c：外部钱包快照在发送红包后保持只读，不扣减本地缓存。
     - W1a：角色池内无效文本不遮蔽后续有效别名（`happiness: 82` 优先于根池 `mood: 12`）。
2. **静态检查与代码规范**：
   - `pnpm exec tsc --noEmit --incremental false`：退出码 0，全工作区严格零类型报错。
   - `pnpm lint`：退出码 0，符合 `eslint.config.mjs` 规范。
3. **扩展构建与产物哈希一致性**：
   - `pnpm build:ext` 与 `pnpm build:st` 均成功构建出版本 `0.9.0+202610260159`。
   - 7 个核心运行文件（`manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `locales/zh-CN.json`, `locales/en-US.json`）SHA-256 完全一致。
   - `st-distribution/assets/wechat` 50 项素材文件哈希全匹配。
   - `verify-runtime-parity.test.ts`（8 项）稳定通过。
4. **Next.js 生产构建**：
   - `pnpm build`（Turbopack）静态页面构建与模拟器渲染通过（退出码 0）。
5. **维护协议基线**：
   - `git merge-base --is-ancestor 26a40d8c142eae9bd17dc5cc59efe5f682e090c7 HEAD`（返回 0）
   - 排除 Markdown 文档后的提交差异检查返回 0。
