/**
 * APP 注册表：管理已注册的 PhoneApp 与生命周期调度。
 * 内置 APP 与第三方 APP（window.STStage.registerApp）共用。
 */

import type { PhoneApp } from '../../../core/app-api'

type ChangeListener = () => void

const apps = new Map<string, PhoneApp>()
const listeners = new Set<ChangeListener>()

export const appRegistry = {
  register(app: PhoneApp): void {
    if (!app || typeof app.id !== 'string' || typeof app.mount !== 'function') {
      console.warn('[st-stage] registerApp：APP 定义非法，需要 { id, name, icon, mount }', app)
      return
    }
    if (apps.has(app.id)) {
      console.warn(`[st-stage] registerApp：APP id "${app.id}" 已存在，将被覆盖`)
    }
    apps.set(app.id, app)
    for (const fn of listeners) fn()
  },

  get(id: string): PhoneApp | undefined {
    return apps.get(id)
  },

  /** 按 order 升序返回全部 APP */
  list(): PhoneApp[] {
    return [...apps.values()].sort((a, b) => (a.order ?? 100) - (b.order ?? 100))
  },

  /** 订阅注册表变化（第三方运行时注册新 APP 后刷新主屏） */
  onChange(fn: ChangeListener): () => void {
    listeners.add(fn)
    return () => listeners.delete(fn)
  },
}
