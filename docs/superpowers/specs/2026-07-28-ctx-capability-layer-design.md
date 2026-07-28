# ctx 能力层设计（阶段五入场券）

日期：2026-07-28
状态：方向已拍板（用户确认「独立 App 只解决了分发没解决开发」的缺口），本方案为实施前设计稿

## 1. 决策摘要

v0.7.0 的独立 App 支持解决了**分发与摆放**（stStageQueue 队列注册 + ST 扩展管理器启停），但没有兑现**简化开发**：`ctx` 只有七个壳内方法，任何真功能的大头——监听 AI 消息、注入提示词、弹通知、开编辑弹窗——仍要裸写 ST 协议，与直接写 ST 扩展难度相当。内部六个 App 被迫各写 bridge 的那些坑（MVU 真事件要翻源码、`oai_settings` 是活引用、Key 回写陷阱），第三方一个不少要重踩，且拿不到仓库内的 bridge 与 skill，处境比内置 App 还差。

本方案把内置 App 已经调通、有单测的适配层**上移为平台能力**，不凭空设计 SDK：

1. **两层生命周期**：`setup(host)` 常驻层（注册后调用一次，覆盖「手机没开也要工作」的场景）+ `mount(container, ctx)` UI 层（现状）。这对应内置 App 早已形成的 runtime + app 分层（新变量即此结构）。
2. **框架代管回收**：经 host/ctx 建立的事件订阅、定时器由平台登记，unmount / 平台销毁时自动退订——把 APP-SPEC dispose 契约里最难、最易错的义务从「App 作者的责任」变成「平台的保证」。
3. **四个已被内置 App 证明的能力**进入 v1：消息/角色事件、per-App 命名通道注入、toast、全屏弹窗助手。没有内部消费方的接口一律不进。
4. **能力探测降级** + `window.SillyTavern` 逃生门：平台包常用的 80%，不装监狱、不追求包完。

## 2. 目标与非目标

### 目标

- 独立 App 的常见功能（响应消息 → 处理 → 注入/提示）只写 st-stage 的小而稳接口，ST 协议漂移由平台一处吸收。
- 事件订阅与定时器泄漏在结构上不可能发生（自动回收），而不是靠作者自觉。
- 同一 App 对象双端可跑：真 ST 全功能，Web 模拟器降级但不崩。
- 老版 st-stage 上运行新 App 时可探测降级，不炸。
- 模板从「摆一个按钮」升级为「五行代码响应 AI 消息并注入提示词」的真演示。

### 非目标

- 不封装 ST 全 API（生成调用、世界书、秘钥、power_user 等长尾场景走逃生门直连，`window.SillyTavern` 依旧可用——App 本就运行在页面主上下文）。
- 不做 iframe 沙箱与权限系统：App 与 ST 同权，安全红线（textContent、不引远程代码）照旧。
- 不做跨 App 通信总线。
- 不承诺模拟器功能对等：以「不崩 + 主链路可视」为度。
- 不强迁内置 App：新变量 runtime 等现有结构照旧工作，向 setup 收敛是后续可选项。

## 3. 分层模型

```
扩展脚本顶层（独立 App 的 index.js）
  └─ (window.stStageQueue ||= []).push(app)      ← 唯一入口，不变
       │
       ├─ app.setup?(host)      注册成功后调用一次 —— 常驻层
       │    生命周期：平台本次运行（bundle 执行 → 平台销毁/同页重复执行）
       │    用途：手机没打开也要工作的逻辑（监听消息、维护注入、后台统计）
       │    返回值：可选清理函数，平台销毁时调用
       │
       └─ app.mount(container, ctx)               每次打开调用 —— UI 层（现状）
            生命周期：打开 → 任一离开路径（unmount）
            ctx = host 全部能力 + UI 专属（updateSettings/goHome/openModal/定时器）
```

关键规则：**经 host 建的订阅活到平台销毁；经 ctx 建的订阅活到 unmount**。同名方法语义一致，只有回收时机不同。注入是 App 级状态（见 4.2），不随 unmount 清。

## 4. 能力面 API

```ts
/** 常驻宿主：setup(host) 收到；生命周期 = 平台本次运行 */
export interface AppHost {
  /** 能力层版本，首版 = 2（v1 = 现状七方法，无此字段） */
  readonly apiVersion: number
  /** 读当前设置（只读视角，引用每次最新） */
  getSettings(): PluginSettings
  /** 当前对话角色名（无对话为空串） */
  getCharacterName(): string
  /** 读/写本 App 私有存储（不触发立绘刷新，现状语义） */
  getAppData<T>(): T | undefined
  setAppData<T>(data: T): void
  /** AI 消息到达（收到完整文本）；返回退订函数；handler 抛错平台兜住 */
  onMessageReceived(handler: (text: string) => void): () => void
  /** 切换聊天/角色；返回退订函数 */
  onCharacterChanged(handler: () => void): () => void
  /**
   * 注入提示词：per-App 命名通道（st-stage::app:<appId>），last-write-wins，
   * ''=清除；depth 缺省跟随扩展默认（当前 4）。App 级状态：不随 unmount 清，
   * 平台销毁时统一清空。超过 PROMPT_BUDGET_MAX 截断并 console.warn。
   */
  injectPrompt(text: string, depth?: number): void
  /** 通知：真 ST 走 toastr，模拟器降级 console */
  toast(kind: 'info' | 'success' | 'warning' | 'error', message: string): void
}

/** UI 上下文：mount 收到；= AppHost + UI 专属；订阅/定时器随 unmount 自动回收 */
export interface PhoneAppContext extends AppHost {
  /** 提交核心设置（触发框架刷新，现状语义；常驻层不提供——无人交互不改核心设置） */
  updateSettings(next: PluginSettings): void
  goHome(): void
  /**
   * 全屏弹窗（三原则：复杂编辑走弹窗）：平台收起手机 → 建遮罩与 body 容器 →
   * build(body, close) 渲染内容；close/✕/Esc 关闭时执行 build 返回的清理函数，
   * 并重新展开手机回到本 App。弹窗寿命独立于 mount（与现行 manager 模式一致）。
   */
  openModal(build: (body: HTMLElement, close: () => void) => void | (() => void)): void
  /** 定时器包装：unmount 自动清，杜绝最常见泄漏类 */
  setTimeout(fn: () => void, ms: number): number
  setInterval(fn: () => void, ms: number): number
}
```

`PhoneApp` 增加可选 `setup?(host: AppHost): void | (() => void)`。现有六字段与 v1 的七个 ctx 方法完全保留——**v2 是纯超集，零破坏**。

### 4.1 事件分发

平台对 ST 只保持一份订阅（现有 `adapter.onMessageReceived/onCharacterChanged`），内部扇出到各 App 登记的 handler；每个 handler 独立 try/catch + console.error，坏 App 不拖垮别人。模拟器端由 Web adapter 喂模拟回复，同一接口。

### 4.2 注入通道

复用 `adapter.injectChannel(channel, prompt, depth)`（ST 端每通道独立 `setExtensionPrompt` 槽位，key=`st-stage::<channel>`），App 通道名固定 `app:<appId>`，与内置通道（立绘主注入、newvar）天然隔离。选 last-write-wins 而非随 unmount 清：注入是幂等状态不是累积泄漏，且「UI 里改配置、常驻层维持注入」的新变量式结构必须允许注入越过 unmount 存续。想停就写 `injectPrompt('')`。

### 4.3 能力探测与版本

推荐逐能力探测：`typeof ctx.injectPrompt === 'function'`；`apiVersion` 用于日志与提示。队列注册本身不依赖版本——老版 st-stage 上新 App 照常上屏，只是在 setup/mount 里探测到能力缺失后自行降级或提示「需要 st-stage ≥ 0.9」。

## 5. 回收保证（对齐 dispose 契约）

| 资源 | 建立方 | 回收时机 |
| --- | --- | --- |
| 事件订阅 | ctx | unmount（平台销毁兜底） |
| 事件订阅 | host | 平台销毁（`__stStageDispose`） |
| 定时器 | ctx.setTimeout/setInterval | unmount |
| 注入通道 | host/ctx.injectPrompt | 平台销毁统一清空；unmount 不清 |
| setup 返回的清理函数 | — | 平台销毁 |
| 弹窗 | ctx.openModal | 关闭时；平台销毁兜底 |

APP-SPEC 的 dispose 契约随实现改写：作者仍需自理的只剩「绕过 ctx 自建的资源」（用了逃生门就回到自己负责，写进文档）。

## 6. 实现落点

- `core/phone-registry.ts`：`AppHost`/`PhoneAppContext` v2 类型；能力追踪器（订阅/定时器登记与批量回收，纯逻辑带单测）；`createPhoneAppContext` 返回 `{ ctx, dispose }`。
- `core/phone-shell.ts`：`leaveApp` 时调用当次 mount 的 `dispose`（在现有 unmount try/catch 之后）。
- `st-extension/src/index.ts`：host 工厂（adapter 扇出、`app:<appId>` 注入、toastr）；register 成功后调 `setup`（try/catch，失败不影响上屏）；`__stStageDispose` 扩展：host 清理 + App 通道清空。
- `app/page.tsx` / Web adapter：降级实现（事件接模拟回复流、注入 no-op 或调试展示、toast→console）。
- `docs/templates/standalone-app/index.js`：升级为「响应 AI 消息 + 注入提示词 + 记次数」演示，含能力探测分支。
- `docs/APP-SPEC.md`：生命周期两层化、能力表、回收保证表、逃生门章节；`docs/` 增补「ST 协议速查」一篇兜长尾（后续可独立成文）。

## 7. 实施划分（阶段五）

- **5a·能力层 v1（本方案，一次提交，目标 v0.9.0）**
  1. core：类型 + 能力追踪器 + 单测（RED→GREEN）
  2. 接线：shell dispose、ST host 工厂、setup 调用点、平台销毁扩展
  3. Web 降级 + 模板升级 + APP-SPEC 改写
  4. 五项验证 + 构建产物
- **5b·dogfood**：第一个真实新功能按独立 App 开发，只准用 ctx 能力层 + 逃生门；过程中暴露的缺口决定 v1.5 是否追加「聊天读侧（最近 N 楼）」等候选能力——在有真实消费方之前不预铺。

## 8. 开放问题（留到 5b 决）

- 聊天历史读侧接口形态（最近 N 楼文本？含用户楼层？）——等 dogfood 需求。
- host 是否需要定时器包装——常驻定时器目前无消费方，cleanup 已可覆盖。
- openModal 的移动端细节（软键盘、内部滚动）按 DESIGN-WALKTHROUGH 弹窗类条目验收。
