# findings.md — 调研与发现

> st-stage 二期扩展规划 · 创建于 2026-07-06

## 1. 代码库现状（已完成架构梳理）

三层架构，双端共用核心：

- **core/**（平台无关纯 TS）：types / tag-parser（提取 `[立绘:xxx]`）/ prompt-builder / sprite-store（绑定+模糊匹配）/ pack-io（sprite-pack@1 导入导出）/ presets（2 套内置包）
- **适配层**：`PlatformAdapter` 接口 → `st-extension/src/st-adapter.ts`（ST 端）与 `lib/web-adapter.ts`（Web 模拟器）
- **UI 层**：ST 端原生 DOM（overlay-dom / sprite-manager / settings-panel），Web 端 React（chat-simulator / config-panel / sprite-overlay）
- **构建**：`pnpm build:ext` → esbuild 打包 `st-extension/src/index.ts` 为根目录 `index.js`（IIFE），**产物必须提交 git**

### 已知缺口

- ⚠️ `hideTagInMessage`（消息中隐藏 `[立绘:xxx]`）**ST 端只有开关无实现**：Web 模拟器 `chat-simulator.tsx:144` 用 `stripTags()` 实现了，`st-extension/src/` 无对应逻辑。需要一个「消息渲染后处理」模块 —— 该模块同时是后续「消息内插图渲染」的地基。
- 上传图片时 tag 固定取文件名（去扩展名），无法改名/删除单张/排序（`sprite-manager.ts` 只有包级操作）。
- `saveImage` 的子目录用 `characterName` 拼接（`sprite-overlay/<角色名>`），角色名含特殊字符时路径安全性未验证。

## 2. 关键技术事实与风险

| 事实 | 影响 |
| --- | --- |
| catbox.moe 上传后返回**随机 6 位编码文件名**（如 `ab12cd.png`），用户无法指定最终文件名 | 「微笑+字母编码」应理解为 **tag → 编码的映射表**，分享码格式据此设计 |
| catbox API（`catbox.moe/user/api.php`）**不发 CORS 头**（社区共识，需实测确认） | 浏览器内直传大概率被拦；插件内置直传需走 ST 服务器代理（server plugin）或换带 CORS 的图床 |
| ST 第三方扩展目录 `/scripts/extensions/third-party/<repo>/` 在扩展更新时被 git 覆盖重置 | **用户图片绝不能存扩展目录**；本地图片应继续走 `saveBase64AsFile`（ST 用户数据目录，更新不丢） |
| ST 社区流行的「catbox 插图正则」玩法：AI 输出 `<img>编码</img>`，正则脚本替换为 `<center><img src="https://files.catbox.moe/...">` | 用户点 2 提到的正则即此模式；若纳入，可由消息后处理模块原生实现（比用户手写正则脚本更稳） |
| ST 事件：`MESSAGE_RECEIVED`（已用）、`CHAT_CHANGED`（已用）；消息渲染完成事件 `CHARACTER_MESSAGE_RENDERED` / `USER_MESSAGE_RENDERED`（**名称待实测验证**） | 消息后处理模块的挂载点 |
| 浏览器端压缩可行：canvas 重绘导出 WebP（`canvas.toBlob('image/webp', q)`），无需依赖库 | 本地批量导入的「相应压缩」可纯前端做 |

## 3. 竞品/社区参考

- ST 社区已有「手机 UI」类扩展（聊天内嵌手机壳），说明该形态用户接受度高；差异化点在于**开放 App 规范**让立绘、图库、后续功能都成为 App。
- 立绘类扩展官方有 Character Expressions（表情立绘），但依赖分类模型/本地文件夹；本插件的差异化是 **prompt 注入 + 标签提取 + 图床分享生态**，零模型依赖。

## 4. 待验证清单（实现阶段逐项确认）

- [ ] ST 消息渲染事件的确切名称与回调参数（`CHARACTER_MESSAGE_RENDERED`?）
- [ ] catbox API 浏览器直传 CORS 实测（若做内置直传才需要）
- [ ] `saveBase64AsFile` 返回路径格式与中文文件名兼容性
- [ ] ST 移动端（手机浏览器）下悬浮窗/手机壳的可用性
- [ ] `extensionSettings` 存大量绑定/包元数据的体积上限（图片不入 settings，仅存 URL/编码，风险低）

## 5. 决策记录（2026-07-06 用户确认）

1. ✅ 分享形态：JSON 文件 + 一行紧凑分享串，两者都做
2. ✅ 消息内插图渲染纳入本期 M3（与隐藏标签共用消息后处理模块）
3. ✅ 图床直传推迟三期（CORS 硬约束，本期手动上传+回填编码）
4. ✅ 手机=管理中枢+App 启动器（可最小化悬浮图标）；立绘窗独立悬浮，点 App 聚焦
5. ✅ 第三方 App 本期只做规范+示例，不做动态加载
6. ✅ 手机 UI 用无框架 DOM 双端复用；core 层补 vitest 单测

**用户附加要求**：从一开始做好代码规范性 + 前端体验性。
→ 落实：补 ESLint 配置（现状 `pnpm lint` 无配置跑不起来）、vitest 锁核心行为、错误信息中文可操作化、UI 交互细节（M2 起）。

## 6. 安全隐患（M2 修复）

`sprite-manager.ts` 的 `renderPackItem` 用 `innerHTML` 插值 `pack.name`（`<b>${pack.name}</b>`），select options 同样。导入的第三方立绘包 JSON 可借包名注入 HTML。
→ M1 先在导入路径做 `sanitizePackName`（剥 `<>` 等）防御；M2 重写 UI 时全部改用 `textContent`。
