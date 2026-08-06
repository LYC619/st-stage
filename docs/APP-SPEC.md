# st-stage 手机 App 开发规范（v2）

st-stage 在 SillyTavern 聊天界面提供一个「手机」悬浮框架：一个可拖拽的 📱 图标，展开后是带状态栏、返回键、关闭键和圆形 Home 键的手机屏幕，屏幕上是 App 栅格。立绘（设置中心）、图库都是内置 App。

> **方向说明（v0.7 起）**：st-stage 支持两条并列的接入路径。**内部 App**——进 `st-extension/src/apps/`，随 st-stage 一起构建发布，适合与框架/立绘深度耦合的功能；**独立 App**——你自己的 ST 扩展，一行队列注册接入（见下），免费获得 ST 扩展管理器的启停与 URL 安装分发，适合独立演进、独立发版的功能。后续新功能默认优先独立 App。两条路径的 App 对象结构与生命周期契约完全一致，本规范同样适用。
>
> **v0.9 起提供 ctx 能力层**：监听 AI 消息、注入提示词、toast、全屏弹窗从 `host`/`ctx` 直接拿，订阅与定时器由框架自动回收——写功能不再需要裸摸 ST 协议（见「ctx 能力层」一节；深耦合场景仍有逃生门）。

## 内部 App 三步接入

与框架深度耦合的功能走内部路径，三步：

1. **新建模块**：`st-extension/src/apps/<你的功能>-app.ts`，导出一个返回 `PhoneApp` 对象的工厂函数（结构见下方外部注册示例，`mount`/`ctx` 完全相同；UI 小部件直接复用 `./widgets` 里的 `appButton/toggleRow/selectRow/numberRow/textRow/textareaRow`）。
2. **加入装配清单**：在 `st-extension/src/apps/index.ts` 的 `createBuiltinApps` 返回数组里加一行。需要访问框架能力（如打开弹窗）就照 `galleryApp` 的样子通过 `BuiltinAppDeps` 传入。
3. **构建发布**：`pnpm build:ext` 并提交根目录兼容产物。需要为未来独立 ST 仓库生成干净发布目录时运行 `pnpm build:st`，产物在 `st-distribution/`；不要手动复制源码、`public/` 或 `reference/`。热更新（v0.6 加载器）会让已安装用户在 git pull 后自动拿到新代码，无需清缓存。

App 私有状态用 `ctx.getAppData/setAppData`（命名空间隔离、不触发立绘刷新）；只有确实要改核心设置才用 `ctx.updateSettings`。

## 独立 App 接入（一行注册）

独立 App = 一个普通的 SillyTavern 扩展（manifest.json + index.js）。index.js 里只做一件事——把 App 对象 push 进注册队列：

```js
;(window.stStageQueue ||= []).push({
  id: 'dice-roller',        // 唯一 ID：小写字母开头，字母/数字/连字符，2–32 字符
  name: '骰子',              // Home 屏名称，建议 ≤ 4 个汉字
  icon: '🎲',               // 单个 emoji
  order: 50,                // 排序权重，小的在前（内置 App 占 1–20）

  // 常驻层（可选，st-stage ≥ 0.9）：注册后调用一次，手机没打开也在工作；
  // host 上的订阅由平台在销毁时自动回收，不用手工退订
  setup(host) {
    if (typeof host.onMessageReceived !== 'function') return // 老版 st-stage：静默降级
    host.injectPrompt('（骰子扩展在场：剧情需要检定时，你可以让角色提议掷一次 d20。）')
    host.onMessageReceived((text) => {
      if (text.includes('骰')) host.toast('info', 'AI 提到了骰子——打开「骰子」App 掷一把')
    })
  },

  // UI 层：打开 App 时调用；经 ctx 建立的订阅/定时器在离开时自动回收
  mount(container, ctx) {
    const btn = document.createElement('div')
    btn.className = 'menu_button so-app-btn'
    btn.textContent = '掷 d20'
    btn.addEventListener('click', () => {
      const result = 1 + Math.floor(Math.random() * 20)
      ctx.setAppData({ last: result })
      btn.textContent = `d20 → ${result}`
    })
    container.append(btn)
  },
  // 只挂 DOM、订阅全走 ctx 的 App 不需要 unmount（见 dispose 契约）
})
```

- **加载顺序无关**：st-stage 的真实代码是异步加载的。你的脚本先跑时，push 进的是普通数组（积压）；st-stage 就绪后统一注册积压，并把队列换成「push 即注册」的 shim。因此**不需要** `loading_order` 配合、轮询或 `window.stStage` 存在性判断。st-stage 未安装时队列无人消费，静默无害。
- **注册失败不抛错**：id 非法/重复、缺 `mount` 等问题只打印在控制台（`[sprite-overlay] 独立 App 注册失败`），不影响你扩展的其余逻辑，也不拖垮框架和其他排队的 App。`window.stStage?.registerApp(app)`（st-stage 就绪后可用）走同一通道，行为相同。
- **启停与分发走 ST 本身**：用户在 ST 扩展管理器里装/卸/停用你的扩展（启停后需刷新页面生效），用 GitHub 仓库地址分发安装——st-stage 不另建商店。
- **可复制模板**：[docs/templates/standalone-app/](templates/standalone-app/)——manifest.json + index.js，改 id 就能用。

> ⚠️ **App 私有数据更新不触发立绘刷新**：`ctx.setAppData(...)` 只持久化你的私有存储，**不会**触发立绘 refresh / Prompt 重注入 / 楼层重渲染（内部走 `saveSettingsOnly`）。只有当你调用 `ctx.updateSettings(...)` 修改**核心设置**时才会触发框架刷新——所以除非确有必要，App 状态一律用 `setAppData`。

## 生命周期

| 时机 | 调用 |
| --- | --- |
| 注册成功后（一次） | `setup(host)`（如果提供）——常驻层，手机没打开也在工作 |
| 用户在 Home 屏点你的图标 / 框架 `openApp(id)` | `mount(container, ctx)` |
| 任何离开路径（见下方契约） | `unmount()`（如果提供）→ 框架回收经 ctx 建立的资源 |
| 再次打开 | 重新 `mount`（container 是新的空 div，**不做状态保持**） |
| 平台销毁（bundle 同页重复执行等） | `setup` 返回的清理函数 + host 订阅/注入通道统一回收 |

约定：

- `mount` 必须同步返回；异步数据自己 fetch 后再填充 DOM
- `mount` / `setup` 抛错时框架打印控制台并兜住：mount 显示错误占位页，setup 失败不影响 App 上屏
- 不要在 `mount` 外持有 container 引用（离开后即失效）
- `setup` 只该做常驻初始化（订阅/注入/后台状态），不要碰 DOM——UI 一律在 `mount` 里做

### 卸载（dispose）契约

第三方 App 可以依赖框架的如下保证（实现见 `core/phone-shell.ts` 的 `leaveApp` 与 `core/phone-registry.ts` 的能力追踪器）：

- **所有离开路径都会调用 `unmount`**：返回键/Home 键/`ctx.goHome()`、切换到其他 App（含 `openApp`）、右上角收起手机、程序收起（如打开全屏弹窗前）、设置里隐藏手机、手机壳销毁——不存在「绕过 unmount 直接消失」的路径
- **经 ctx 建立的资源框架自动回收**（unmount 之后执行，unmount 里仍可正常用 ctx）：`ctx.onMessageReceived/onCharacterChanged` 的订阅、`ctx.setTimeout/setInterval` 的定时器
- **经 host 建立的订阅活到平台销毁**，由平台统一回收；`setup` 返回的清理函数同时执行
- `injectPrompt` 是 App 级状态：不随 unmount 清（想停就写 `injectPrompt('')`），平台销毁时统一清空
- 下一次 `mount`（无论哪个 App）之前，上一个活跃 App 的 `unmount` 与 ctx 回收一定已完成
- `unmount` 抛错会被框架捕获并打印控制台，不影响手机壳与其他 App
- `unmount` 后你的 container 会被框架整体丢弃，纯 DOM 不需要你手动摘除

对应地，你在 `unmount` 里只需要清理**绕过 ctx 自建**的资源：

- 直接调 `window.setTimeout` / `eventSource.on(...)` / DOM 级监听等逃生门产物（能走 ctx 的尽量走 ctx，就不用写这些）
- 让在途异步回调失效（`disposed` 标记 / render token），`unmount` 之后不得再触碰 container 与 ctx
- 只挂 DOM、订阅全走 ctx 的 App，可以不提供 `unmount`

参考实现：`mvu-app.ts`（实例 token + 事件退订）、`newvar-app.ts`（runtime 订阅退订）。

### ST 耦合纪律（bridge 模式）

要跟页面全局打交道（`window.SillyTavern`、`window.parent` 上的 Mvu/酒馆助手、jQuery、toastr…）时，把这些耦合收敛到 `apps/<你的功能>/bridge.ts`（照 `apps/api/bridge.ts` 的样子：最小切面类型 + 全部字段可选 + 无 ST 时降级返回）。App UI 文件 0 直连——ESLint 对 `apps/**` 里 bridge 之外的文件直接拦截 `window.SillyTavern` / `window.parent` / `window` 类型断言。

## ctx 能力层（v0.9+）

`setup(host)` 收到 **AppHost**，`mount(container, ctx)` 收到 **PhoneAppContext = AppHost + UI 专属**。同名方法语义一致，只有回收时机不同：host 订阅活到平台销毁，ctx 订阅活到 unmount。

**AppHost（host 与 ctx 都有）：**

| 成员 | 说明 |
| --- | --- |
| `apiVersion` | 能力层版本（当前 2）。**推荐逐能力探测**：`typeof ctx.injectPrompt === 'function'`，老版 st-stage 上自行降级 |
| `getSettings()` | 读 st-stage 当前完整设置（只读视角，每次调用取最新） |
| `getCharacterName()` | 当前对话角色名，无对话为空串 |
| `getAppData<T>()` | 读你的私有存储（`settings.apps[你的id]`），无则 `undefined` |
| `setAppData<T>(data)` | 写私有存储（整体替换，**仅持久化、不触发立绘刷新**）。必须可 JSON 序列化；**不要存 base64 图片**（settings 体积敏感），图片走图床 URL |
| `onMessageReceived(fn)` | AI 消息到达（完整文本）。返回退订函数；框架自动回收，fn 抛错被兜住不拖垮别人 |
| `onCharacterChanged(fn)` | 切换聊天/角色。返回退订函数；框架自动回收 |
| `injectPrompt(text, depth?)` | 注入提示词：你的专属通道（`st-stage::app:<你的id>`），与立绘/其他 App 互不覆盖。last-write-wins，`''`=清除，超 20000 字符截断告警。**不随 unmount 清**，平台销毁时统一清空 |
| `toast(kind, message)` | 通知（`info/success/warning/error`）：真 ST 走 toastr，模拟器降级 console |

**PhoneAppContext 额外提供（仅 mount）：**

| 成员 | 说明 |
| --- | --- |
| `updateSettings(next)` | 提交**核心设置**（持久化 + 触发框架刷新）。**除非明确要改核心设置，否则用 setAppData** |
| `goHome()` | 编程式返回 Home 屏（会触发你的 unmount） |
| `openModal(build)` | 全屏弹窗（复杂编辑走弹窗的标准动作）：框架收起手机 → `build(body, close)` 渲染 → close/✕/Esc 关闭时执行 build 返回的清理并回到本 App。弹窗寿命独立于 mount |
| `setTimeout/setInterval(fn, ms)` | 定时器包装：unmount 自动清，杜绝最常见的泄漏类 |

**逃生门**：App 运行在 ST 页面主上下文，`window.SillyTavern` 等全局照常可用——能力层包常用的 80%，深耦合场景（如管家改 `power_user`）自己直连，但相应资源的清理回到你自己负责（见 dispose 契约）。Web 模拟器里逃生门多半拿不到东西，注意判空降级。

## 样式

手机屏幕内可直接使用这些现成类（双端一致，暗色调）：

- `so-app-section` — 圆角卡片分组容器
- `so-app-title` / `so-app-desc` — 分组标题 / 说明文字
- `so-app-btn`（配合 ST 的 `menu_button`）— 全宽按钮
- `so-app-toggle` — 开关行（label + checkbox）
- `so-app-input` — 全宽输入框（配合 ST 的 `text_pole`）
- `so-app-sprite-strip` — 三列图片网格

自定义样式请加你自己的前缀（如 `dice-`），不要覆写 `so-phone-*` / `so-app-*`。

## 安全红线

1. **所有用户可控文本一律 `textContent`**，禁止拼 `innerHTML`（角色名、包名、聊天内容都可能含 HTML）
2. 外链图片只用 `https:` URL；不要往 `settings` 写函数/DOM 引用/循环结构
3. 你的 App 运行在 ST 页面主上下文里，权限与 ST 本身等同——不要引入远程执行的代码

## 内置 App 一览（参考实现）

内置 App 各自成模块，放在 `st-extension/src/apps/`，由 `apps/index.ts` 统一装配。
旧的独立「设置」App 已移除：立绘设置迁入「立绘」App，图床/图包设置迁入「图库」App。

| id | 名称 | 说明 | 源码 |
| --- | --- | --- | --- |
| `sprites` | 立绘 | 当前绑定概览、显示/轮播/Prompt 设置 | `st-extension/src/apps/sprite-app.ts` |
| `gallery` | 图库 | 打开立绘包管理弹窗、图包概览、图床设置（前缀/imgbb Key/自动上传） | `st-extension/src/apps/gallery-app.ts` |
| `butler` | 管家 | ST 性能管家：一键性能模式 + 改动前快照还原、power_user 手动微调、体检与优化指南（仅 ST 内生效，Web 模拟器降级为只读指南）。ST 耦合收敛在 `butler/bridge.ts` | `st-extension/src/apps/butler-app.ts` + `butler/` |
| `mvu` | MVU | MVU 楼层变量可视化/编辑：树状卡片 + 类型感知编辑 + delta 高亮 + 精准事件刷新（MVU/酒馆助手双通道，模拟器只读）。数据耦合收敛在 `mvu/bridge.ts` | `st-extension/src/apps/mvu-app.ts` + `mvu/` |
| `newvar` | 新变量 | 内置轻量变量追踪：GUI 定义 schema → 注入状态+规则 → 解析 `<UpdateVariable>` → 逐楼快照。手机页仅开关+状态树，设计走全屏弹窗 | `st-extension/src/apps/newvar-app.ts` + `newvar/` |
| `api` | API | OpenAI 兼容接口一键切换：手机页点站点行即「写 Key → 切自定义源 → 填 URL/模型/附加参数 → 自动连接」；站点增删改/拉模型列表/附加参数走全屏管理弹窗。ST 交互收敛在 `api/bridge.ts`（模拟器降级只读） | `st-extension/src/apps/api-app.ts` + `api/` |
| `renderer` | 渲染 | 结构化回复渲染：Galgame、卡片选择和本地确定性战斗；手机页含首次使用引导与配置状态 | `st-extension/src/apps/renderer-app.ts` |

装配清单：`st-extension/src/apps/index.ts`。

两个变量 App 复用共享视图 `apps/variable-tree.ts`（折叠分组/类型感知编辑/delta 徽标，「模型+回调」契约）。「新变量」的注入走**命名注入通道** `adapter.injectChannel(channel, prompt, depth)`（ST 端每通道一个独立 `setExtensionPrompt` 槽位，key=`st-stage::<channel>`）——v0.9 起 App 不用自己碰通道：`ctx.injectPrompt` 已按 appId 自动分配（`app:<你的id>`），互不覆盖，也不会碰立绘的注入。
框架源码：注册表与能力层 `core/phone-registry.ts` + `core/capabilities.ts`、全屏弹窗 `core/app-modal.ts`、手机壳 `core/phone-shell.ts`、样式 `core/phone-shell.css`。
