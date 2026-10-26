# 2026-10-26 微信 App 当前角色上下文接入、安全加固与体验优化记录

## 范围与背景

根据维护审查报告（[2026-10-26-wechat-review.md](2026-10-26-wechat-review.md)）中提出的 7 项问题（W1–W7），本轮在工作区完整实现了微信 App 对 SillyTavern 当前角色的深度适配、数据作用域隔离、DOM 安全加固、请求生命周期控制、资源相对路径动态解析、输入法事件防误触以及窄屏布局自适应。

全部变更保留在未提交工作区，未执行 `git commit`、`git merge` 或 `git push`。

---

## 修复实施详情

### 1. W1 / P1：角色身份与当前 ST 对话上下文接入
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`、`pipeline.ts`
- **实现**：
  - 在 `mount` 中通过 `ctx.getCharacterName()` 读取 ST 当前会话角色名，并注册 `ctx.onCharacterChanged` 监听角色/会话切换。
  - 动态切换对话时更新顶部标题栏 `#wt-contact-name`，动态载入该角色的独立消息记录与好感状态。
  - 动态提示词生成：`WeChatPipeline.buildSystemPrompt` 支持传入当前角色名 `characterName`，并在提示词中自适应角色代称与行为指导。

### 2. W2 / P1：按角色与会话隔离存储与历史平滑迁移
- **文件**：`st-extension/src/apps/wechat/types.ts`、`wechat-app.ts`
- **实现**：
  - 重构数据结构 `WeChatAppData`，新增 `conversations: Record<string, CharacterConversation>`。
  - 单个角色会话 `CharacterConversation` 包含专属的 `messages`、`state`（心情、好感度、位置、余额）与 `currentDay`。
  - 实现平滑向后兼容迁移 `getScopedConversation`：检测到旧版单会话扁平数据时，自动将其无损迁移至当前活跃角色的作用域内，确保旧用户历史记录不丢失。
  - 角色切换时仅写入和读取当前角色的数据，彻底杜绝 Alice 与 Bob 之间的消息与状态串流。

### 3. W3 / P1：模型输出 Schema 严格校验与 DOM 安全构造（防止 XSS）
- **文件**：`st-extension/src/apps/wechat/pipeline.ts`、`wechat-app.ts`
- **实现**：
  - `parseReplyJson` 严格校验返回对象的 schema。对于 `emoji` 类型，强制使用 `SISTER_EMOJIS` 字典白名单匹配 `emoji_id`，未知 ID 降级为安全文本；对于 `image` 类型，强制使用 `SISTER_PHOTOS` 字典白名单匹配 `pic_id`，未知 ID 降级为安全文本。
  - 彻底移除 `wechat-app.ts` 消息渲染中的 `innerHTML` 模板拼接，改用原生安全的 DOM 构建（`document.createElement`、`textContent`、`setAttribute`）。
  - 图片/表情元素的 `src` 通过安全解析器注入，完全杜绝模型输出中携带恶意引号、事件属性注入或执行脚本的可能。

### 4. W4 / P2：会话生命周期 Token 守卫（防止卸载/重开后旧请求回写）
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **实现**：
  - 引入会话代次计数器 `mountSessionId`，在每次 `mount` 时自增并生成 `isCurrent()` 检查闭包。
  - 在异步回复流的每个边界（`requestSisterReply`、`simulateTypingDelay` 打字延迟、`requestStatImpact` 数值结算）及最终提交 DOM/存储前，严格校验 `isCurrent()`。
  - 当用户在模型请求在途时关闭 App、切换 App 或切换角色，挂起的任务被静默丢弃，不再往已失效的 DOM 或共享存储写入旧数据。

### 5. W5 / P2：安装态与预览态双兼容的相对资源路径动态解析
- **文件**：`st-extension/src/apps/wechat/assets.ts`、`wechat-app.ts`
- **实现**：
  - 新增 `resolveWeChatAssetUrl` 统一路径解析工具。
  - 优先从运行时模块地址（`import.meta.url`）探测当前扩展所在目录（支持 SillyTavern 的 `/scripts/extensions/third-party/<folder>/` 路径及 `st-distribution` 相对路径），解析为正确的基础 URL；在 Next.js 本地开发与预览环境自动回落至 `/assets/wechat/`。
  - 50 个提取自游戏的表情与立绘资源完整归档在 `assets/wechat/` 与 `public/assets/wechat/`。

### 6. W6 / P2：输入法组合输入保护（IME Composition Guard）
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **实现**：
  - 监听输入框的 `compositionstart` 与 `compositionend` 事件，维护 `isComposing` 状态。
  - 在 `keydown` 回车事件中，增加对 `e.isComposing` 与 `e.keyCode === 229` 的严格拦截。
  - 中文拼音输入法敲击 Enter 确认候选词时不再误触发消息发送。

### 7. W7 / P2：窄屏输入栏弹性收缩修复
- **文件**：`st-extension/src/apps/wechat/wechat-app.ts`
- **实现**：
  - 给 `#wt-input-text` 明确设置 `min-width: 0; box-sizing: border-box;`。
  - 彻底解决 flex 容器默认 `min-width: auto` 导致的在 302px 手机屏幕/320px 视口下输入框溢出并将右侧发送按钮挤出可视区域的排版缺陷。

---

## 验证结论

- **单元测试**：
  - `st-extension/src/apps/wechat/wechat.test.ts` 新增并扩展为 15 项测试，覆盖 W1 角色切换联动、W2 会话隔离与旧数据迁移、W3 恶意表情注入拦截、W4 离开 App 后旧回复回写取消、W5 资源相对路径转换、W6 输入法组合拦截、W7 窄屏 min-width 样式。
  - 全局测试运行：`pnpm test`，共 **91 个测试文件、1204 项测试**全部通过（`exit code 0`）。
- **静态检查**：
  - `pnpm typecheck`（`tsc --noEmit`）：无类型报错（`exit code 0`）。
  - `pnpm lint`（ESLint）：无语法及格式报错（`exit code 0`）。
- **构建与产物一致性**：
  - `pnpm build:ext` 与 `pnpm build:st` 均成功构建出版本 `0.9.0+202610260023`。
  - 对比根目录与 `st-distribution/` 下的 7 个核心运行文件（`manifest.json`, `index.js`, `bundle.js`, `style.css`, `version.json`, `locales/zh-CN.json`, `locales/en-US.json`），SHA-256 哈希完全一致。
  - Next.js Web 构建：`pnpm build`（Turbopack）静态页面构建通过。
