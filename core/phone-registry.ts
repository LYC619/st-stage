/**
 * 手机 App 框架：注册表 + 生命周期契约（详见 docs/APP-SPEC.md）。
 * 平台无关：手机壳 DOM 在 core/phone-shell.ts，本文件只管 App 的注册与查询。
 *
 * App 是一个纯对象：{ id, name, icon, order?, mount, unmount? }
 * - mount(container, ctx)：手机打开该 App 时调用，往 container 里渲染原生 DOM
 * - unmount()：离开 App（返回 Home / 关手机）时调用，清理事件与定时器
 * - ctx（PhoneAppContext）：读写设置、当前角色名、App 私有存储、返回 Home
 */

import type { PluginSettings } from './types'

/** App 收到的运行时上下文 */
export interface PhoneAppContext {
  /** 读当前设置（引用每次最新） */
  getSettings(): PluginSettings
  /** 提交新设置（持久化 + 触发框架刷新） */
  updateSettings(next: PluginSettings): void
  /** 当前对话的角色名（无对话为空串） */
  getCharacterName(): string
  /** 读本 App 的私有存储（settings.apps[appId]，无则 undefined） */
  getAppData<T>(): T | undefined
  /** 写本 App 的私有存储（整体替换，需可 JSON 序列化） */
  setAppData<T>(data: T): void
  /** 返回 Home 屏 */
  goHome(): void
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
  /** 打开 App：向 container 渲染内容 */
  mount(container: HTMLElement, ctx: PhoneAppContext): void
  /** 离开 App：清理（可选） */
  unmount?(): void
}

/** 构造 PhoneAppContext 的依赖（把「核心设置」与「App 私有数据」两条持久化路径分开） */
export interface AppContextDeps {
  /** 本 App 的命名空间键 */
  appId: string
  /** 读当前设置（引用每次最新） */
  getSettings(): PluginSettings
  /** 提交核心设置：持久化 + 触发框架刷新（立绘 refresh / Prompt 重注入 / 楼层重渲染） */
  updateSettings(next: PluginSettings): void
  /** 仅持久化设置：不触发立绘刷新/Prompt 重注入/楼层重渲染（App 私有数据、手机壳状态走这里） */
  saveSettingsOnly(next: PluginSettings): void
  /** 当前对话角色名（无对话为空串） */
  getCharacterName(): string
  /** 返回 Home 屏 */
  goHome(): void
}

/**
 * 构造 App 运行时上下文（双端共用）。
 * 关键解耦（阶段7）：setAppData 走 saveSettingsOnly —— 任何 App 保存私有数据都**不会**
 * 触发立绘 refresh / Prompt 重注入 / 楼层重渲染；只有改核心设置（updateSettings）才刷新。
 */
export function createPhoneAppContext(deps: AppContextDeps): PhoneAppContext {
  return {
    getSettings: () => deps.getSettings(),
    updateSettings: (next) => deps.updateSettings(next),
    getCharacterName: () => deps.getCharacterName(),
    getAppData: <T,>() => deps.getSettings().apps[deps.appId] as T | undefined,
    setAppData: <T,>(data: T) =>
      deps.saveSettingsOnly({
        ...deps.getSettings(),
        apps: { ...deps.getSettings().apps, [deps.appId]: data },
      }),
    goHome: deps.goHome,
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
