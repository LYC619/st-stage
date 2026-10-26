# 2026-10-26 微信 App 第二轮审查缺陷（W1/W2/W4/W5）修复实施与验证记录

## 范围与背景

针对第二轮审查报告（[2026-10-26-wechat-rereview.md](2026-10-26-wechat-rereview.md)）中指出初审遗留的 4 项缺陷（W1/W2/W4/W5），本轮对代码进行了针对性重构与修复。全部修改保留在当前工作区，未执行 `git commit`、`git merge` 或 `git push`。

---

## 修复详情

### 1. W1 / P1：读取当前角色卡设定、ST 对话历史与外部真实状态（MVU / 酒馆助手）
- **文件**：`st-extension/src/apps/wechat/bridge.ts`、`st-extension/src/apps/wechat/wechat-app.ts`、`pipeline.ts`、`st-extension/src/index.ts`
- **问题根因**：初审修复中仅将 `getCharacterName()` 传给标题，角色卡详细描述、性格、场景以及 ST 当前主会话的历史对话均未进入模型上下文；好感与心情强制从独立游戏初始值（60/15/5200）起算，未接入外部真实状态。
- **实施方案**：
  - 在 `st-extension/src/apps/wechat/bridge.ts`（收敛全部宿主全局访问）中实现：
    - 读取 SillyTavern 角色卡设定（`description`、`personality`、`scenario`、`avatar`）。
    - 读取 ST 对话流（`chat`）最近 5~6 条上下文消息，提炼为当前聊天连贯记忆。
    - 接入外部真实变量读取（优先读取 `host.getVariables()`，或检测全局 `window.Mvu` / `window.TavernHelper` 及 `readVariables` 楼层变量）。自动映射 `mood`（心情）、`interest/favor`（好感/态度）、`money`（钱包）、`location`（位置）。
    - 在 `st-extension/src/index.ts` 中通过 `createHostDeps` 正式桥接这三组能力。
  - **提示词自适应**：
    - 当检测到角色卡时，优先使用角色卡的完整人设，彻底解除强制设定的“兄妹同居/上班社畜”生活背景限制。
    - 将 ST 近期对话历史注入提示词，保证微信沟通与酒馆日常连贯。
    - 状态明确化：有外部状态时标注源自 MVU/ST 变量（如 `心情 82`）；无外部状态源时明确标为“未连接外部状态源（独立状态）”，界面胶囊显示 `[独立]`，不再将游戏默认值伪称为角色真实状态。
  - **状态动态更新**：
    - 订阅 `ctx.onMessageReceived`，AI 每轮回复或楼层结算后自动刷新外部变量状态。

### 2. W2 / P1：基于稳定角色标识与聊天标识的会话作用域隔离
- **文件**：`st-extension/src/apps/wechat/bridge.ts`、`types.ts`、`wechat-app.ts`
- **问题根因**：原先仅以显示名（`charName.trim()`）作为存储键，导致同名角色卡、或者同一角色的不同聊天（`first-chat` 与 `second-chat`）共用同一个字典条目，且切聊天时因角色名相同而不触发刷新。此外迁移逻辑未清理旧键，导致新建聊天重复迁移旧内容。
- **实施方案**：
  - 构造稳定的复合作用域键 `scopeKey = ${characterId || avatar || charName}::${chatId}`。
  - 同步提取首帧作用域 `resolveConversationScopeSync(ctx)`，在 `onCharacterChanged` 触发时即便角色名相同（如 Alice 切到 second-chat），由于 `scopeKey` 变化，立即执行 `switchScope`，切换到该聊天独立的数据与消息流。
  - 完善平滑迁移：从旧版单名键迁移时，在迁移后从字典中删除旧的单名键（`delete appData.conversations[characterName]`），彻底杜绝后续新聊天重复从旧记录复制数据。

### 3. W4 / P1：切角色/切聊天时在途请求与状态评估全链路废弃
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **问题根因**：原先会话代次 `mountSessionId` 仅在挂载时递增，切角色时仅改变外层引用变量 `activeConv`；在途的 `requestSisterReply` 与 `requestStatImpact` 在 await 完成后仍会向被替换的 `activeConv` 写入数据，导致 Alice 的回复与好感变化写给 Bob。
- **实施方案**：
  - 引入会话作用域代次计数器 `activeScopeSessionId`，在每次 `switchScope`（切换角色或切换聊天）及 `unmount` 时均执行 `++activeScopeSessionId`。
  - 发送消息时在闭包中固定局部上下文：
    - `targetScopeSession = activeScopeSessionId`
    - `targetScopeKey = currentScope.scopeKey`
    - `targetConv = activeConv`
    - 状态守卫：`isRequestValid = () => isCurrent() && targetScopeSession === activeScopeSessionId`
  - 在回复返回、打字延迟结束、好感评估返回三个异步边界均校验 `isRequestValid()`：
    - 一旦中途切换了角色或聊天，在途任务即刻被安全丢弃，不写 DOM，不写新角色的内存对象，也不写回持久化存储。
    - 只有当用户依然处于发送时的同一作用域下，才向 `conversations[targetScopeKey]` 提交更新。

### 4. W5 / P2：扩展分发包补齐静态资源目录与完整性验证
- **文件**：`st-extension/build.mjs`、`st-extension/build.test.ts`、`st-extension/src/apps/wechat/assets.ts`
- **问题根因**：`st-extension/build.mjs` 在打包到 `--output-root st-distribution` 时未复制 `assets/` 静态图片目录，导致实际安装包中资源 404。
- **实施方案**：
  - 在 `buildExtension` 中增加静态资源复制逻辑：当源目录存在 `assets/` 且输出目录不同于源码根目录时，通过 `cpSync` 递归完整复制到 `outputRoot/assets/`。
  - 重新执行 `pnpm build:st`，`st-distribution/assets/wechat/` 成功同步全部 50 项提取的游戏表情与照片资源。
  - 在 `st-extension/build.test.ts` 中新增专项测试：断言分发构建必须完整包含 `assets/wechat/` 资源文件。
  - 优化 `resolveWeChatAssetUrl`，增强针对已有路径前缀的规范化处理。

---

## 验证证据

1. **自动化测试套件**：
   - 运行全量测试套件 `pnpm test`：共 **91 个测试文件、1209 项测试全部通过**（0 失败）。
   - 针对 W1–W7 的专项单元测试扩展为 **19 项**（`st-extension/src/apps/wechat/wechat.test.ts`），专项覆盖：
     - W1：读取角色卡人设与性格、读取 MVU 变量（如 `mood: 82`）、无外部状态源时的“独立状态”标识。
     - W2：同名角色在不同 `chatId`（`first-chat` 与 `second-chat`）下隔离消息流与存储条目。
     - W4：回复在途期间切角色丢弃回复、好感评估在途期间切角色丢弃数值写回、卸载时丢弃。
     - W5：分发构建自动包含 `assets/wechat` 目录。
     - W3：模型返回非法表情/图片 ID 安全降级、纯原生 DOM 构造防 XSS。
     - W6：中文输入法拼音组合键防护。
     - W7：输入框弹性收缩（`min-width: 0`）窄屏防裁切。
2. **静态检查与代码规范**：
   - `pnpm exec tsc --noEmit`：退出码 0，全工作区无类型报错。
   - `pnpm lint`：退出码 0，符合 `eslint.config.mjs` 规范（包括全局对象限制收敛至 `apps/*/bridge.ts`）。
3. **扩展构建与产物哈希一致性**：
   - `pnpm build:ext` 与 `pnpm build:st` 均成功构建出版本 `0.9.0+202610260058`。
   - 7 个核心运行文件（`manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `locales/zh-CN.json`, `locales/en-US.json`）SHA-256 完全一致。
   - `st-distribution/assets/wechat` 完整存在，包含全部 50 个图片/表情文件。
4. **Next.js 生产构建**：
   - `pnpm build`（Turbopack）静态页面构建与模拟器渲染通过（退出码 0）。
5. **维护协议基线**：
   - `git merge-base --is-ancestor 26a40d8c142eae9bd17dc5cc59efe5f682e090c7 HEAD`（返回 0）
   - 排除 Markdown 文档后的提交差异检查返回 0。
