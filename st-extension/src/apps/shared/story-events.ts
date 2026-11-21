/**
 * 跨 App 轻量事件与深链导航总线（纯内存，无持久化耦合）。
 * 用于打通「剧情状态 ↔ 纪要/日历 ↔ 小剧场/日记 ↔ 微信 ↔ 手机壳灵动胶囊/角标」的即时反馈。
 */

export type StoryEventPayload =
  | { type: 'story-date-changed'; date: string }
  | { type: 'story-state-updated'; summary?: string; highlights?: string[] }
  | { type: 'theater-updated'; summary: string; tab?: 'square' | 'forum' | 'live' | 'diary' }
  | { type: 'chronicle-updated'; summary?: string }
  | { type: 'calendar-updated'; summary?: string }
  | { type: 'badge-changed'; appId: string; count: number }

export interface AppDeepLink {
  appId: string
  tab?: string
  date?: string
  role?: string
  contactName?: string
  openSettings?: boolean
}

const eventListeners = new Set<(event: StoryEventPayload) => void>()
const navListeners = new Set<(link: AppDeepLink) => void>()
const badgeCounts = new Map<string, number>()
let pendingDeepLink: AppDeepLink | null = null

export function emitStoryEvent(event: StoryEventPayload): void {
  for (const listener of eventListeners) {
    try {
      listener(event)
    } catch (err) {
      console.warn('[st-stage] 跨 App 事件处理异常', err)
    }
  }
}

export function onStoryEvent(listener: (event: StoryEventPayload) => void): () => void {
  eventListeners.add(listener)
  return () => {
    eventListeners.delete(listener)
  }
}

export function setAppBadge(appId: string, count: number): void {
  const normalized = Math.max(0, Math.floor(count))
  if (normalized === 0) badgeCounts.delete(appId)
  else badgeCounts.set(appId, normalized)
  emitStoryEvent({ type: 'badge-changed', appId, count: normalized })
}

export function incrementAppBadge(appId: string, delta = 1): void {
  setAppBadge(appId, getAppBadge(appId) + delta)
}

export function clearAppBadge(appId: string): void {
  if (!badgeCounts.has(appId)) return
  badgeCounts.delete(appId)
  emitStoryEvent({ type: 'badge-changed', appId, count: 0 })
}

export function getAppBadge(appId: string): number {
  return badgeCounts.get(appId) ?? 0
}

export function getTotalBadgeCount(): number {
  let sum = 0
  for (const value of badgeCounts.values()) sum += value
  return sum
}

export function requestOpenApp(link: AppDeepLink): void {
  pendingDeepLink = link
  for (const listener of navListeners) {
    try {
      listener(link)
    } catch (err) {
      console.warn('[st-stage] 跨 App 跳转异常', err)
    }
  }
}

export function onOpenAppRequest(listener: (link: AppDeepLink) => void): () => void {
  navListeners.add(listener)
  return () => {
    navListeners.delete(listener)
  }
}

export function consumeAppDeepLink(appId: string): AppDeepLink | null {
  if (!pendingDeepLink || pendingDeepLink.appId !== appId) return null
  const link = pendingDeepLink
  pendingDeepLink = null
  return link
}
