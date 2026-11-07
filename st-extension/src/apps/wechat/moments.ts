import type { Contact, ContactState, Moment, WeChatAppData } from './types'
import { defaultContactState } from './groups'
export const DEFAULT_MOMENTS_PROMPT = '扮演此角色，在平行世界的朋友圈发布一条具体的日常图文动态。结合心情和当前状态，不复述人设，不假装现实行动。返回 JSON：{"text":"最多 500 字的动态","photo_id":"可选图片 ID"}。图片只能从可用列表选择，无合适图片时省略。'
export function latestContactState(data: WeChatAppData, contactId: string): ContactState {
  let latest: ContactState | undefined, latestTime = -1
  for (const conv of Object.values(data.conversations ?? {})) {
    const direct = conv.contactId === contactId
    const state = direct ? conv.state : conv.memberIds?.includes(contactId) ? conv.memberStates?.[contactId] : undefined
    if (!state) continue
    const time = state.updatedAt ?? (direct ? conv.updatedAt ?? 0 : 0)
    if (time > latestTime) { latest = state; latestTime = time }
  }
  return latest ?? defaultContactState()
}
export function addMoment(data: WeChatAppData, contact: Contact, text: string, image?: Moment['image'], state = latestContactState(data, contact.id)): Moment {
  if (!text.trim()) throw new Error('动态内容为空，请重试')
  const item: Moment = { id: crypto.randomUUID(), contactId: contact.id, authorName: contact.name, avatar: contact.avatar ?? contact.card?.avatar,
    text: text.trim().slice(0,1000), createdAt: Date.now(), likedByPlayer: false,
    mood: state.mood, status: state.currentStatus, ...(image ? { image: { ...image } } : {}) }
  data.moments = [item, ...(data.moments ?? [])].slice(0, 200)
  return item
}
