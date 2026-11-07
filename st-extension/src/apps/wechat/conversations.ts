import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import type { ConversationScope, STCharacterCard } from './bridge'
import type { Conversation, WeChatAppData, Contact } from './types'
import { resolveProfile } from './profile-library'

import { getWeChatHostContext, type HostCharacterCard } from './bridge'
type HostCard = HostCharacterCard
const hostContext = getWeChatHostContext
function snapshot(raw: HostCard): STCharacterCard {
  const result: STCharacterCard = {}
  for (const key of ['name', 'avatar', 'description', 'personality', 'scenario', 'mes_example'] as const) {
    const value = raw[key] ?? raw.data?.[key]
    if (typeof value === 'string') result[key] = value.slice(0, key === 'avatar' ? 256 : key === 'name' ? 100 : 16000)
  }
  return result
}
function contact(raw: HostCard): Contact | undefined {
  const id = stableCharacterKey(raw)
  return id ? { id, name: raw.name?.trim() || raw.data?.name?.trim() || '未命名角色', avatar: raw.avatar, kind: 'character', card: snapshot(raw) } : undefined
}
export function listContacts(host: AppHost): Contact[] {
  const cards = [...(hostContext()?.characters ?? [])]
  const current = host.getCharacterCard?.()
  if (current) cards.push(current)
  const result = new Map<string, Contact>()
  for (const card of cards) { const item = contact(card); if (item && !result.has(item.id)) result.set(item.id, item) }
  return [...result.values()]
}
export async function loadContact(host: AppHost, id: string): Promise<Contact> {
  const context = hostContext()
  const index = context?.characters?.findIndex(item => stableCharacterKey(item) === id) ?? -1
  if (index >= 0 && context?.characters?.[index].shallow) {
    if (!context.unshallowCharacter) throw new Error('角色卡详情尚未加载，请先在酒馆中载入该角色')
    await context.unshallowCharacter(String(index))
  }
  // Hydration can reorder the host array. Never use the old index after await.
  const raw = hostContext()?.characters?.find(item => stableCharacterKey(item) === id)
  if (raw?.shallow) throw new Error('角色卡详情加载失败，请重试')
  const item = raw ? contact(raw) : listContacts(host).find(item => item.id === id)
  if (!item) throw new Error('此角色卡已不存在，请重新选择')
  return item
}
export function addContactConversation(data: WeChatAppData, item: Contact): Conversation {
  if (!stableCharacterKey(item.card) || stableCharacterKey(item.card) !== item.id) throw new Error('联系人缺少稳定的角色卡身份')
  data.contacts ??= {}; data.conversations ??= {}
  data.contacts[item.id] = { ...item, card: snapshot(item.card!) }
  const key = `direct:${item.id}`
  if (!data.conversations[key]) {
    const profile = resolveProfile(data.config, item.id)
    data.conversations[key] = {
      scopeKey: key, contactId: item.id, conversationType: 'direct', memberIds: [item.id], characterName: item.name,
      messages: profile.openingMessage ? [{ sender: 'contact', contactId: item.id, authorName: item.name, type: 'text', content: profile.openingMessage, time: { day: 1, hour: 0, minute: 0 } }] : [],
      state: { mood: 60, interest: 15, money: 0, contactLocation: '', playerLocation: '', updatedAt: 0 }, currentDay: 1, unreadCount: 0,
    }
  }
  return data.conversations[key]
}
export function conversationScope(data: WeChatAppData, conv: Conversation): ConversationScope {
  const item = conv.contactId ? data.contacts?.[conv.contactId] : undefined
  // Old keys contain a stable avatar when available. Link only that exact identity.
  const avatarKey = conv.scopeKey?.match(/^(avatar:[^:]+)(?:::|$)/)?.[1]
  const stored = item ?? (avatarKey ? data.contacts?.[avatarKey] : undefined)
  return { scopeKey: conv.scopeKey!, characterName: stored?.name ?? conv.characterName, card: stored?.card ?? conv.card,
    characterId: conv.characterId, chatId: conv.chatId, externalState: { source: 'none' } }
}
