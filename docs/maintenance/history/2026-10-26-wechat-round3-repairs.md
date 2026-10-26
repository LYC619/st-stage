# 2026-10-26 微信 App 第三轮审查缺陷（W4/W1a/W1b/W1c/W1d/W8）修复实施与验证记录

## 范围与背景

针对第三轮审查报告（[2026-10-26-wechat-third-review.md](2026-10-26-wechat-third-review.md)）指出的 6 项状态桥接与异步读取缺陷，本轮对业务代码与桥接层进行了系统化重构与修复。全部修改严格保留在当前工作区，未执行 `git commit`、`git merge` 或 `git push`。

---

## 修复详情

### 1. W4 / P1：异步上下文与变量读取严格绑定会话代次与作用域键
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **问题根因**：原先 `switchScope` 同时更新了外层作用域的可变变量 `currentScopeSession` 与 `activeScopeSessionId`，使得初始异步读取返回时误判代次相等；同时未在所有异步读取完成点检查挂载状态与目标键。
- **实施方案**：
  - 彻底移除外层可变代次引用，由每次异步读取发起时就地在闭包捕获不可变三元组：
    `reqMountId = mountSessionId`、`reqScopeId = activeScopeSessionId`、`reqScopeKey = currentScope.scopeKey`。
  - `switchScope` 与 `unmount` 仅执行 `activeScopeSessionId++`，立即使所有在途异步读取与未决 Promise 失去效力。
  - 校验守卫：在初始读取、角色切换后读取、以及事件触发读取完成时，均核对：
    `!isCurrent() || reqMountId !== mountSessionId || reqScopeId !== activeScopeSessionId || reqScopeKey !== currentScope.scopeKey`
    任意项不匹配即刻安全丢弃，不写 DOM、不更新当前会话状态、不写存储。

### 2. W1a / P1：字段映射解包（含 MVU [值, 描述] 二元组）与明确逐字段外部来源
- **文件**：`st-extension/src/apps/wechat/bridge.ts`、`types.ts`、`wechat-app.ts`、`pipeline.ts`
- **问题根因**：只要变量对象非空就声明外部来源，且只认标量数字，导致 MVU 的 `[82, 'mood-note']` 二元组无法解析；未解析成功时却将默认值伪称为外部接入。
- **实施方案**：
  - 在 `bridge.ts` 中实现通用值解包 `unpackValue`，对齐 MVU `isTupleLeaf` 判据，自动提取二元组数值。
  - 实现 `extractFieldsFromObject`：
    - 支持嵌套角色子树（`vars[charName]`）、MVU 包裹树（`stat_data`）及根对象多级候选池；
    - 精确抽取 `mood`、`interest`、`money`、`location`，并生成 `mappedFields: { mood?: boolean, interest?: boolean, ... }`；
    - 仅当至少有一个字段真实映射成功（`hasAny`）时才声明外部来源；若无任何有效字段（如无关变量包 `{ other: 123 }`），明确返回 `source: 'none'`。
  - 失去来源时自动清理旧的 `hasExternalState` 与 `externalSource` 标记，恢复独立状态。
  - 界面胶囊与提示词按 `externalFields` 明确逐字段标注：外部接入字段注明数值与来源，未映射字段明确保留独立模拟参考，不冒充外部状态。

### 3. W1b / P2：主聊天上下文与外部变量动态刷新
- **文件**：`st-extension/src/apps/wechat/bridge.ts`、`wechat-app.ts`
- **问题根因**：消息事件只读外部数值且未监听 MVU 更新结束事件（`mag_variable_update_ended`），导致变量尚未结算；微信保持打开时主聊天的新消息无法进入微信提示词。
- **实施方案**：
  - 在 `bridge.ts` 中提供 `subscribeExternalContextEvents`，同时订阅 `subscribeVarEvents`（含 `VARIABLE_UPDATE_ENDED`, `CHAT_CHANGED`, `MESSAGE_SWIPED`, `MESSAGE_DELETED`）与 `host.onMessageReceived`。
  - 触发更新时并发提取最新近期 ST 聊天记录（`extractRecentSTMessages`）与外部变量，并受 W4 会话代次保护。
  - 在微信发送消息（`handleSendMessage`）组装提示词前，主动拉取一次最新的 `extractRecentSTMessages`，确保发送前所用上下文具备最高新鲜度。

### 4. W1c / P2：外部只读快照与独立模拟状态明确解耦
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **问题根因**：外部变量读入后，第二阶段本地好感分析器（`requestStatImpact`）仍直接对 `state.mood` 加减（如 82 变成 82.4），污染了外部快照。
- **实施方案**：
  - 明确外部状态源为权威只读基准：当某字段已被外部状态接管时（`state.externalFields?.mood` / `interest`），第二阶段本地好感分析器绝对不修改该外部字段。
  - 仅在未接管的字段或纯独立模式下，本地分析器才增减对应数值。
  - 设置面板手动修改数值保存时，明确清除外部标记，转为纯独立模拟；发放生活费按钮仅在未从外部接管金钱时发放独立零花钱。

### 5. W1d / P2：保留提示词中的外部非枚举真实地点
- **文件**：`st-extension/src/apps/wechat/pipeline.ts`
- **问题根因**：外部地点未命中原游戏固定地点枚举时，被简单替换为占位词。
- **实施方案**：
  - `const sisterLoc = (state.sisterLocation && SISTER_LOCATIONS[state.sisterLocation]) ? SISTER_LOCATIONS[state.sisterLocation] : (state.sisterLocation || `${characterName}当前位置`)`
  - 无论是否在预设枚举内，均在系统提示词的“当前所处场景”中完整传递实际地点字符串（如 `CUSTOM_LIBRARY_LOCATION`）。

### 6. W8 / P2：ST 头像文件名解析与加载失败优雅兜底
- **文件**：`st-extension/src/apps/wechat/bridge.ts`、`wechat-app.ts`
- **问题根因**：直接将角色卡文件名（如 `Alice.png`）作为 `img.src`，在宿主中解析为无效相对路径，且无 `onerror`。
- **实施方案**：
  - 在 `bridge.ts` 中实现 `resolveCharacterAvatarUrl`：完整 URL 直接保留；文件名通过 ST `getThumbnailUrl('avatar', filename)` 或标准静态目录 `/characters/<filename>` 解析。
  - 在头像 DOM 节点挂载 `avatar.onerror` 监听器，若网络或图片损坏自动降级为默认角色头像 `DEFAULT_SISTER_AVATAR`。

---

## 验证证据

1. **自动化测试套件**：
   - 运行全量测试套件 `pnpm test`：共 **91 个测试文件、1215 项测试全部通过**（0 失败）。
   - 针对微信 App 的专项测试扩充至 **25 项通过**（`st-extension/src/apps/wechat/wechat.test.ts`），专项覆盖：
     - W4：迟到的变量读取在切角色或卸载后安全丢弃。
     - W1a：MVU 二元组解包、无关变量对象不冒充外部状态、界面与提示词显式标注独立。
     - W1b：主聊天与变量在事件到达及发送前动态刷新。
     - W1c：外部心情快照不受本地评估污染，保持权威原值。
     - W1d：非枚举自定义地点在系统提示词中完整保留。
     - W8：头像文件名解析为 `/characters/` 路径并在错误时退回默认头像。
2. **静态检查与代码规范**：
   - `pnpm exec tsc --noEmit`：退出码 0，全工作区无类型报错。
   - `pnpm lint`：退出码 0，符合 `eslint.config.mjs` 规范（包括全局对象限制收敛至 `apps/*/bridge.ts`）。
3. **扩展构建与产物哈希一致性**：
   - `pnpm build:ext` 与 `pnpm build:st` 均成功构建出版本 `0.9.0+202610260128`。
   - 7 个核心运行文件（`manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `locales/zh-CN.json`, `locales/en-US.json`）SHA-256 完全一致（`verify-runtime-parity.test.ts` 通过）。
   - `st-distribution/assets/wechat` 50 项素材完整。
4. **Next.js 生产构建**：
   - `pnpm build`（Turbopack）静态页面构建与模拟器渲染通过（退出码 0）。
5. **维护协议基线**：
   - `git merge-base --is-ancestor 26a40d8c142eae9bd17dc5cc59efe5f682e090c7 HEAD`（返回 0）
   - 排除 Markdown 文档后的提交差异检查返回 0。
