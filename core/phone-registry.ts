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

const APP_ID_REGEX = /^[a-z][a-z0-9-]{1,31}$/

export class PhoneAppRegistry {
  private apps = new Map<string, PhoneApp>()
  private listeners = new Set<() => void>()

  /** 注册 App；id 非法或重复时抛错（第三方 App 装载失败不应拖垮框架，调用方自行 catch） */
  register(app: PhoneApp): void {
    if (!APP_ID_REGEX.test(app.id)) {
      throw new Error(`App id「${app.id}」非法：需匹配 ${APP_ID_REGEX}`)
    }
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
