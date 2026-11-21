import { safeRandomId } from '../shared/safe-runtime'
import type { Contact, ContactState, Moment, WeChatAppData } from './types'
import { defaultContactState } from './groups'
export const DEFAULT_MOMENTS_PROMPT = '扮演此角色，在故事中的朋友圈发布一条自然、具体的日常动态。结合最近主线、世界书、心情与当前状态，保持人物关系和事件顺序，不复述人设，不重复旧动态，不凭空推进重大剧情。返回 JSON：{"text":"最多 500 字的动态","photo_id":"可选图片 ID","visibility":"public 或 private"}。图片只能从可用列表选择，无合适图片时省略。'
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
export function addMoment(data: WeChatAppData, contact: Contact, text: string, image?: Moment['image'], state = latestContactState(data, contact.id), visibility: Moment['visibility'] = 'public', storyKey?: string): Moment {
  if (!text.trim()) throw new Error('动态内容为空，请重试')
  const item: Moment = { id: safeRandomId(), contactId: contact.id, authorName: contact.name, avatar: contact.avatar ?? contact.card?.avatar,
    text: text.trim().slice(0,1000), createdAt: Date.now(), likedByPlayer: false,
    mood: state.mood, status: state.currentStatus, visibility: visibility === 'private' ? 'private' : 'public', ...(storyKey ? { storyKey } : {}), ...(image ? { image: { ...image } } : {}) }
  data.moments = [item, ...(data.moments ?? [])].slice(0, 200)
  return item
}
