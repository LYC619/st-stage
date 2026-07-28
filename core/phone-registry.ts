/**
 * 手机 App 框架：注册表 + 生命周期契约 + ctx 能力层
 * （详见 docs/APP-SPEC.md 与 docs/superpowers/specs/2026-07-28-ctx-capability-layer-design.md）。
 * 平台无关：手机壳 DOM 在 core/phone-shell.ts；事件/注入/通知的原始实现由双端平台注入
 * （AppHostDeps），本文件负责包装成自动回收的 host / ctx。
 *
 * App 是一个纯对象：{ id, name, icon, order?, setup?, mount, unmount? }
 * - setup(host)：注册成功后调用一次（常驻层，手机没开也工作）；返回的清理函数在平台销毁时执行
 * - mount(container, ctx)：手机打开该 App 时调用；经 ctx 建立的订阅/定时器 unmount 自动回收
 * - unmount()：离开 App 时调用（只需清理绕过 ctx 自建的资源）
 */

import type { PluginSettings } from './types'
import { PROMPT_BUDGET_MAX } from './types'
import {
  createCapabilityTracker,
  type CapabilityTracker,
} from './capabilities'
import type { ModalBuild } from './app-modal'

/** ctx 能力层版本：独立 App 建议逐能力探测（typeof 检查），本字段辅助日志与提示 */
export const CTX_API_VERSION = 2

export type ToastKind = 'info' | 'success' | 'warning' | 'error'

/**
 * 常驻宿主：setup(host) 收到；生命周期 = 平台本次运行（bundle 执行 → 平台销毁）。
 * 经 host 建立的订阅由平台在销毁时统一回收。
 */
export interface AppHost {
  /** 能力层版本（首版 = 2；v1 无此字段） */
  readonly apiVersion: number
  /** 读当前设置（引用每次最新，只读视角） */
  getSettings(): PluginSettings
  /** 当前对话的角色名（无对话为空串） */
  getCharacterName(): string
  /** 读本 App 的私有存储（settings.apps[appId]，无则 undefined） */
  getAppData<T>(): T | undefined
  /** 写本 App 的私有存储（整体替换，需可 JSON 序列化；不触发立绘刷新） */
  setAppData<T>(data: T): void
  /** AI 消息到达（完整文本）；返回退订函数；handler 抛错由平台兜住 */
  onMessageReceived(handler: (text: string) => void): () => void
  /** 切换聊天/角色；返回退订函数 */
  onCharacterChanged(handler: () => void): () => void
  /**
   * 注入提示词：per-App 命名通道（st-stage::app:<appId>），last-write-wins，''=清除。
   * App 级状态：不随 unmount 清，平台销毁时统一清空；超 PROMPT_BUDGET_MAX 截断并告警。
   */
  injectPrompt(text: string, depth?: number): void
  /** 通知：真 ST 走 toastr，模拟器降级 console */
  toast(kind: ToastKind, message: string): void
}

/** App 收到的运行时上下文（mount）：= AppHost + UI 专属；订阅/定时器随 unmount 自动回收 */
export interface PhoneAppContext extends AppHost {
  /** 提交核心设置（持久化 + 触发框架刷新）。常驻层不提供——无人交互不改核心设置 */
  updateSettings(next: PluginSettings): void
  /** 返回 Home 屏 */
  goHome(): void
  /**
   * 全屏弹窗（复杂编辑走弹窗）：平台收起手机 → build(body, close) 渲染 →
   * close/✕/Esc 关闭时执行 build 返回的清理并回到本 App。弹窗寿命独立于 mount。
   */
  openModal(build: ModalBuild): void
  /** 定时器包装：unmount 自动清，杜绝最常见的泄漏类 */
  setTimeout(fn: () => void, ms: number): number
  setInterval(fn: () => void, ms: number): number
}

/** 手机 App 定义 */
export interface PhoneApp {
  /** 唯一 ID：小写字母/数字/连字符，同时是私有存储的命名空间键 */
  id: string
  /** Home 屏显示名（建议 ≤ 4 个汉字） */
  name: string
  /** Home 屏图标：单个 emoji 或字符 */
  icon: string
  /** Home 屏排序权重，小的在前；缺省 100 */
  order?: number
  /** 常驻初始化（可选）：注册成功后调用一次；返回的清理函数在平台销毁时执行 */
  setup?(host: AppHost): void | (() => void)
  /** 打开 App：向 container 渲染内容 */
  mount(container: HTMLElement, ctx: PhoneAppContext): void
  /** 离开 App：清理（可选；经 ctx 建立的资源框架自动回收，这里只管自建的） */
  unmount?(): void
}

/** 平台注入的原始能力实现（未包装追踪；双端各自提供，Web 模拟器可降级为安全 no-op） */
export interface PlatformCapabilityDeps {
  onMessageReceived(handler: (text: string) => void): () => void
  onCharacterChanged(handler: () => void): () => void
  /** 注入到指定 App 的命名通道；text='' 清除；depth 缺省由平台决定 */
  injectPrompt(appId: string, text: string, depth?: number): void
  toast(kind: ToastKind, message: string): void
}

/** 构造 AppHost 的依赖 */
export interface AppHostDeps extends PlatformCapabilityDeps {
  /** 本 App 的命名空间键 */
  appId: string
  /** 读当前设置（引用每次最新） */
  getSettings(): PluginSettings
  /** 仅持久化设置：不触发立绘刷新（App 私有数据走这里） */
  saveSettingsOnly(next: PluginSettings): void
  /** 当前对话角色名（无对话为空串） */
  getCharacterName(): string
}

/** 构造 PhoneAppContext 的依赖（把「核心设置」与「App 私有数据」两条持久化路径分开） */
export interface AppContextDeps extends AppHostDeps {
  /** 提交核心设置：持久化 + 触发框架刷新（立绘 refresh / Prompt 重注入 / 楼层重渲染） */
  updateSettings(next: PluginSettings): void
  /** 返回 Home 屏 */
  goHome(): void
  /** 打开全屏弹窗（平台实现收手机/回 App 的钩子） */
  openModal(appId: string, build: ModalBuild): void
}

/** 注入截断护栏：对齐 Prompt 预算精神——单 App 注入不允许超过 PROMPT_BUDGET_MAX 字符 */
function capInjectionText(appId: string, text: string): string {
  if (text.length <= PROMPT_BUDGET_MAX) return text
  console.warn(
    `[sprite-overlay] App「${appId}」注入 ${text.length} 字符超上限，已截断到 ${PROMPT_BUDGET_MAX}`,
  )
  return text.slice(0, PROMPT_BUDGET_MAX)
}

/**
 * 构造常驻宿主（setup 用；双端共用）。经 host 建立的订阅登记进 tracker，
 * 由平台在销毁时统一回收——App 作者不再手工退订。
 */
export function createAppHost(deps: AppHostDeps, tracker: CapabilityTracker): AppHost {
  return {
    apiVersion: CTX_API_VERSION,
    getSettings: () => deps.getSettings(),
    getCharacterName: () => deps.getCharacterName(),
    getAppData: <T,>() => deps.getSettings().apps[deps.appId] as T | undefined,
    setAppData: <T,>(data: T) =>
      deps.saveSettingsOnly({
        ...deps.getSettings(),
        apps: { ...deps.getSettings().apps, [deps.appId]: data },
      }),
    onMessageReceived: (handler) => tracker.track(deps.onMessageReceived(handler)),
    onCharacterChanged: (handler) => tracker.track(deps.onCharacterChanged(handler)),
    injectPrompt: (text, depth) =>
      deps.injectPrompt(deps.appId, capInjectionText(deps.appId, text), depth),
    toast: (kind, message) => deps.toast(kind, message),
  }
}

/** createPhoneAppContext 的返回：ctx 交给 mount，dispose 由手机壳在 leaveApp 时调用 */
export interface MountedAppContext {
  ctx: PhoneAppContext
  /** 回收本次 mount 经 ctx 建立的订阅与定时器（幂等） */
  dispose(): void
}

/**
 * 构造 App 运行时上下文（双端共用）。
 * 关键解耦（阶段7）：setAppData 走 saveSettingsOnly —— 任何 App 保存私有数据都**不会**
 * 触发立绘 refresh / Prompt 重注入 / 楼层重渲染；只有改核心设置（updateSettings）才刷新。
 * v2（阶段五）：附带 CapabilityTracker——经 ctx 的订阅/定时器在 dispose 时自动回收。
 */
export function createPhoneAppContext(deps: AppContextDeps): MountedAppContext {
  const tracker = createCapabilityTracker()
  const ctx: PhoneAppContext = {
    ...createAppHost(deps, tracker),
    updateSettings: (next) => deps.updateSettings(next),
    goHome: deps.goHome,
    openModal: (build) => deps.openModal(deps.appId, build),
    setTimeout: (fn, ms) => {
      let untrack = () => {}
      // 浏览器返回 number；@types/node 判成 Timeout 对象，按运行环境（浏览器/jsdom）收窄
      const id = globalThis.setTimeout(() => {
        untrack() // 已触发：从登记表摘除（对已触发的 id 跑 clearTimeout 无害）
        fn()
      }, ms) as unknown as number
      untrack = tracker.track(() => globalThis.clearTimeout(id))
      return id
    },
    setInterval: (fn, ms) => {
      const id = globalThis.setInterval(fn, ms) as unknown as number
      tracker.track(() => globalThis.clearInterval(id))
      return id
    },
  }
  return { ctx, dispose: () => tracker.dispose() }
}

/**
 * 注册成功后调用 App 的常驻初始化（存在时）。host 订阅经 tracker 追踪，
 * setup 返回的清理函数一并登记——平台销毁时统一回收；抛错只打日志，不影响 App 上屏。
 */
export function runAppSetup(app: PhoneApp, deps: AppHostDeps, tracker: CapabilityTracker): void {
  if (typeof app.setup !== 'function') return
  try {
    const cleanup = app.setup(createAppHost(deps, tracker))
    if (typeof cleanup === 'function') tracker.track(cleanup)
  } catch (err) {
    console.error(`[sprite-overlay] App「${app.id}」setup 失败`, err)
  }
}

const APP_ID_REGEX = /^[a-z][a-z0-9-]{1,31}$/

/**
 * 运行时形状校验：独立 App 从纯 JS 注册（docs/APP-SPEC.md），没有 TS 类型保护，
 * 坏对象要在注册入口用人话报错，而不是等 mount 时炸在手机壳里。
 */
function assertAppShape(app: PhoneApp): void {
  const a: unknown = app
  if (typeof a !== 'object' || a === null) {
    throw new Error('registerApp 参数必须是 App 对象（{ id, name, icon, mount, ... }）')
  }
  const o = a as Record<string, unknown>
  if (typeof o.id !== 'string' || !APP_ID_REGEX.test(o.id)) {
    throw new Error(`App id「${String(o.id)}」非法：需匹配 ${APP_ID_REGEX}`)
  }
  if (typeof o.name !== 'string' || o.name.trim() === '') {
    throw new Error(`App「${o.id}」的 name 需为非空字符串`)
  }
  if (typeof o.icon !== 'string' || o.icon.trim() === '') {
    throw new Error(`App「${o.id}」的 icon 需为非空字符串`)
  }
  if (typeof o.mount !== 'function') {
    throw new Error(`App「${o.id}」缺少 mount(container, ctx) 函数`)
  }
  if (o.setup !== undefined && typeof o.setup !== 'function') {
    throw new Error(`App「${o.id}」的 setup 需为函数`)
  }
  if (o.unmount !== undefined && typeof o.unmount !== 'function') {
    throw new Error(`App「${o.id}」的 unmount 需为函数`)
  }
  if (o.order !== undefined && typeof o.order !== 'number') {
    throw new Error(`App「${o.id}」的 order 需为数字`)
  }
}

export class PhoneAppRegistry {
  private apps = new Map<string, PhoneApp>()
  private listeners = new Set<() => void>()

  /** 注册 App；形状非法或 id 重复时抛错（独立 App 走注册队列 shim，由 shim 统一 catch） */
  register(app: PhoneApp): void {
    assertAppShape(app)
    if (this.apps.has(app.id)) {
      throw new Error(`App id「${app.id}」已被注册`)
    }
    this.apps.set(app.id, app)
    this.notify()
  }

  unregister(id: string): void {
    if (this.apps.delete(id)) this.notify()
  }

  get(id: string): PhoneApp | undefined {
    return this.apps.get(id)
  }

  /** 按 order 升序返回全部 App */
  list(): PhoneApp[] {
    return [...this.apps.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  }

  /** 订阅注册表变化（Home 屏据此重绘），返回退订函数 */
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  private notify(): void {
    for (const l of this.listeners) l()
  }
}

/* ---- 独立 App 注册队列（docs/APP-SPEC.md） ---- */

/**
 * 时序竞争背景：st-stage 的真实代码经 stub 异步加载（fetch version.json →
 * import(bundle) → await 设置），独立 App（普通 ST 扩展）的同步脚本几乎必然先执行。
 * 约定第三方只写一行：`;(window.stStageQueue ||= []).push(app)` ——
 * st-stage 就绪后用 installRegisterQueue 把这个数组换成 shim：先吃掉积压，
 * 之后的 push 即时注册。注册失败（形状非法/id 重复）只打控制台——
 * 坏 App 不拖垮第三方扩展自身，也不拖垮框架和其他排队的 App。
 */
export interface RegisterQueueShim {
  push(app: PhoneApp): void
  /** 收到过的全部 push；bundle 同页重复执行时，新实例据此重放（旧注册表已随旧手机壳销毁） */
  seen: PhoneApp[]
}

export function installRegisterQueue(
  prev: unknown,
  register: (app: PhoneApp) => void,
): RegisterQueueShim {
  const seen: PhoneApp[] = []
  const shim: RegisterQueueShim = {
    seen,
    push(app) {
      seen.push(app)
      try {
        register(app)
      } catch (err) {
        console.error('[sprite-overlay] 独立 App 注册失败', err)
      }
    },
  }
  // prev 的两种来路：真数组（本实例就绪前第三方的积压）或旧实例 shim（bundle 同页重复执行）
  const backlog: unknown[] = Array.isArray(prev)
    ? prev
    : typeof prev === 'object' && prev !== null && Array.isArray((prev as RegisterQueueShim).seen)
      ? (prev as RegisterQueueShim).seen
      : []
  for (const app of backlog) shim.push(app as PhoneApp)
  return shim
}
