# 2026-10-26 微信 App 与手机壳更新审查

## 范围与结论

用户请求审查另一 agent 的更新，并明确微信应读取 SillyTavern 当前对话角色的状态。本轮审查未提交工作区相对 `25d62bd79860dc592cce8adf666882cb8e994400` 的改动，包括新增微信目录、图片资源、手机壳、预览、语言包与分发产物。

结论：当前微信仍是固定角色的独立聊天应用，尚未完成当前角色适配；W1–W3 为 P1，W4–W7 为 P2，修复前不应按“ST 深度整合完成”验收。10 月 25 日的实现记录保留为历史描述，其中完成结论由本次审查纠正。本轮只审查并记录问题，不修改业务代码，不提交、合并或推送。

## Git 与构建基线

- 分支 `main`，HEAD `25d62bd79860dc592cce8adf666882cb8e994400`；本地 `origin/main` 为 `1989c2fab99a28b8b204073bcb32f59b73800079`，领先 2 提交；未联网刷新远端引用。
- `verified_code_head=26a40d8c142eae9bd17dc5cc59efe5f682e090c7` 的祖先检查、排除维护 Markdown 后的已提交产品差异检查均退出 0。微信与手机壳新行为都在未提交工作区，不能由该检查推导为已验证。
- 两处 `version.json` 都为 `0.9.0+202610252355`。根目录与分发目录的 manifest、loader、bundle、CSS、version、两份 locale 共七文件 SHA-256 全相同。这不证明图片分发完整，见 W5。

## 审查发现

### W1 / P1：角色身份与状态没有接入当前 ST 对话

位置：`st-extension/src/apps/wechat/wechat-app.ts:42-47,62-92,103`；`pipeline.ts:79-107,138-175,240-269`。

初始化写死角色状态、场景、余额及天数，页面和提示词也固定角色。App 没有调用 `getCharacterName`、`onCharacterChanged`、`onMessageReceived`，也没有读取角色卡、ST 对话历史或现有变量桥接。实际发给模型的是独立 App 历史与独立状态；即使 ST 正在与其他角色聊天，模型仍收到固定人物设定。独立 API Key 为空时直接进入离线词库，ST 的已有连接不会自动被使用。

修复方向：建立微信所需的当前对话上下文接口，读取角色身份、相关聊天上下文和有依据的状态字段，并订阅聊天/变量变化。仓库已有 `apps/mvu/bridge.ts` 的楼层变量读取和事件订阅可评估复用，但不能假定所有角色都使用 MVU 或相同字段名；没有状态源时应明确不可用。生成服务可以单独配置，但不能因此脱离当前角色上下文。

### W2 / P1：不同角色和聊天共用一份记录与状态

位置：`st-extension/src/apps/wechat/wechat-app.ts:30-33,62,543`；存储契约见 `core/phone-registry.ts:139-144`。

`getAppData/setAppData` 对应全局 `settings.apps['wechat-sister']`，数据没有角色或聊天键。A 角色发过的消息，切到 B 后重开微信仍可见，且会进入后续生成/RAG 上下文；同一角色的不同聊天也无法隔离。这里需要存储身份边界修复，单纯把标题换为角色名无法解决。

复现：受控 DOM 宿主从 Alice 切换到 Bob 后重挂 App，B 页面包含 A 的测试消息，角色读取与角色变化订阅调用次数都为 0。应按稳定角色标识与聊天标识保存历史，并定义旧全局数据迁移，切换时更新当前存储作用域。

### W3 / P1：模型返回的资源 ID 能注入可执行 HTML

位置：`st-extension/src/apps/wechat/wechat-app.ts:330-335,338-352`；`pipeline.ts:383-393`。

回复解析只筛选 `type`，不验证字段类型或表情/图片 ID 是否在资源清单内。渲染又把未知 ID 放入 `innerHTML` 的 URL、属性及文本位置。合法 JSON 中的引号和 HTML 因此可以创建事件属性，并在宿主 ST 页面执行脚本；该风险来自模型/API 输出进入 DOM 的实际路径。

复现：注入一个仅设置本地测试标记的未知表情 ID，经过真实 `parseReplyJson` 和 App 渲染后，DOM 出现额外事件属性，触发本地 error 事件成功设置标记；未访问网络或读取用户数据。应严格验证输出 schema 和资源 ID 白名单，并使用 DOM 属性赋值及 `textContent` 构造内容。

### W4 / P2：离开 App 后旧请求仍可写回

位置：`st-extension/src/apps/wechat/wechat-app.ts:19-21,59-60,505-511,526-543,614-616`。

`isDisposed` 与 `pipeline` 位于 App 实例层；重开会重置同一个标记，使上次挂载的请求重新通过检查。第二阶段 `await requestStatImpact` 后完全没有生命周期检查。复现中，重开后旧回复写入旧 DOM 和共享存储，新页面却看不到该回复；在状态评估阶段卸载且不重开，仍发生一次 `setAppData`。这也会让旧结果干扰清空记录或重新设置后的状态。

应使用每次挂载/会话独立的 token 和请求取消，在每个异步边界、DOM 更新及提交前核对所属会话；避免旧闭包使用新挂载覆盖的 pipeline。

### W5 / P2：资源地址只适合 Next 预览，ST 安装无法按此加载

位置：`st-extension/src/apps/wechat/wechat-app.ts:330,339,397`；`st-extension/build.mjs` 的分发复制逻辑。

表情和图片使用宿主根路径 `/assets/wechat/...`，实际资源只在源码仓库 `public/assets/wechat/`，分发脚本没有复制资源。Next 会把 public 映射到根路径，ST 的扩展安装目录则是 `/scripts/extensions/third-party/<目录名>/`，因此预览成功不能证明安装成功；当前标准分发连文件都不包含。

应统一按扩展运行位置解析资源路径，并将相关文件纳入分发清单与安装态验证。两个内联头像不解决表情和图片缺失。

### W6 / P2：中文输入法确认候选词会触发发送

位置：`st-extension/src/apps/wechat/wechat-app.ts:546-549`。

keydown 只判断 Enter，没有判断组合输入状态。DOM 复现中，发送 `key=Enter,isComposing=true` 后立即调用一次回复请求并清空输入框。中文输入用户确认候选词时会误发正在组合的文本。应保护 composition 状态，并覆盖平台兼容情形；物理输入法仍需后续验收。

### W7 / P2：窄屏输入栏裁切发送按钮

位置：`st-extension/src/apps/wechat/wechat-app.ts:132`。

输入框虽然 `flex:1`，但默认最小宽度阻止进一步收缩。独立审查使用真实输入栏 HTML 与现有 Next 构建 CSS，在隔离 headless Edge 的 320px 视口下复现：按手机壳布局得到 304px 手机、302px 内容区，输入栏 scrollWidth 为 314px，发送按钮右侧裁切约 11.56px。仅设置输入框 `min-width:0` 后 scrollWidth 回到 302px。应给输入框允许收缩的最小宽度，并验证窄屏与实际 ST 样式；该夹具不等于完整真 ST 或物理手机验收。

## 验证与限制

- 本轮 `pnpm test -- --reporter=dot`：91 文件、1199 测试通过。新增微信 10 项测试覆盖算法、离线回复及初次挂载，没有覆盖当前角色读取、会话隔离、在途请求卸载、输出注入和输入法。
- `pnpm exec tsc --noEmit --incremental false`、`pnpm lint` 均退出 0。
- 一次内存 esbuild + jsdom 受控复现验证 W2/W3/W4/W6；API 与延迟使用本地桩，不向外部 LLM 发送请求。W1/W5 由源码、调用关系与分发清单确认，W7 为独立审查的 Edge 布局夹具结果。
- 未改业务代码、未重建 bundle、未重跑 Next 生产构建，未验收真实 ST、真实 MVU 或物理输入法。类型与现有测试通过不能覆盖这些已复现缺陷。

## 后续适配顺序

先明确当前对话身份及角色状态来源，解决 W1/W2；同时关闭 W3 的不可信输出渲染入口。随后修复请求生命周期、资源分发、输入法与窄屏布局，再针对真实 ST 切换角色/聊天、刷新页面、关闭重开及安装资源加载做验收。状态字段读取应先适配实际角色卡；本轮没有擅自选定固定字段映射或增加写回角色变量的行为。

## 工作区交接

审查开始时已有已跟踪修改：`README.md`、根目录及分发 `bundle.js/style.css/version.json`、`components/phone-mount.tsx`、`core/phone-registry.ts`、`core/phone-shell.ts/css`、`docs/i18n-usage.md`、`CURRENT.md`、`PROTOCOL.md`、两份根目录 locale、`st-extension/src/apps/index.ts` 与其测试。另有 `.user/`、`MAINTAINER.md`、10 月 24/25 日记录、`public/assets/`、`st-extension/src/apps/wechat/` 未跟踪。本轮保留这些内容，只更新 `CURRENT.md`、`DEFERRED.md` 并添加本记录；未提交、合并、推送或改发布仓库。
