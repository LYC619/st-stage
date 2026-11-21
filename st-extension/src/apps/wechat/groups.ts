import { safeRandomId } from '../shared/safe-runtime'
import { stableCharacterKey } from '../../../../core/character-identity'
import type { ConversationScope } from './bridge'
import type { Contact, ContactState, Conversation, Group, WeChatAppData } from './types'
export const MAX_GROUP_MEMBERS = 50
export const defaultContactState = (): ContactState => ({ mood: 60, interest: 15, money: 0, contactLocation: '', playerLocation: '', updatedAt: 0 })
export const isGroup = (conv: Conversation): conv is Group => conv.conversationType === 'group'
export function groupContacts(data: WeChatAppData, conv: Conversation): Contact[] {
  return (conv.memberIds ?? []).flatMap(id => data.contacts?.[id] ? [data.contacts[id]] : [])
}
export function groupAvatarMembers(data: WeChatAppData, conv: Conversation) {
  const members = groupContacts(data, conv).slice(0, 9)
  return { members, columns: members.length <= 4 ? 2 : 3 }
}
function checkedMembers(items: Contact[]): Contact[] {
  const unique = [...new Map(items.map(item => [item.id, item])).values()]
  if (unique.length < 2 || unique.length > MAX_GROUP_MEMBERS) throw new Error('请选择 2–50 位不同的群成员')
  if (unique.some(item => !stableCharacterKey(item.card) || stableCharacterKey(item.card) !== item.id)) throw new Error('群成员缺少完整的角色卡身份')
  return unique
}
export function saveGroup(data: WeChatAppData, title: string, items: Contact[], existing?: Group): Group {
  const members = checkedMembers(items), name = title.trim().slice(0, 60)
  if (!name) throw new Error('请填写群名称')
  const key = existing?.scopeKey ?? safeRandomId('group:')
  const group: Group = existing ?? { scopeKey: key, conversationType: 'group', memberIds: [], title: name,
    characterName: name, messages: [], state: defaultContactState(), memberStates: {}, currentDay: 1, unreadCount: 0 }
  data.contacts ??= {}; data.conversations ??= {}
  for (const item of members) data.contacts[item.id] = { ...item, card: { ...item.card } }
  group.title = name; group.characterName = name; group.memberIds = members.map(item => item.id)
  group.memberStates ??= {}
  for (const id of group.memberIds) {
    const direct = data.conversations['direct:' + id]
    group.memberStates[id] ??= direct
      ? { ...direct.state, updatedAt: direct.state.updatedAt ?? direct.updatedAt ?? 0 }
      : defaultContactState()
  }
  // Removed members' snapshots stay with old messages and state; only current members may reply.
  data.conversations[key!] = group
  return group
}
export function mentionToken(item: Contact): string { return '@[' + item.id + ']' }
export function replyMembers(data: WeChatAppData, conv: Group, text: string): Contact[] {
  const members = groupContacts(data, conv)
  const explicit = [...text.matchAll(/@\[([^\]]+)\]/g)].map(match => match[1])
  // Ignore identity tokens when looking for display names; names can occur inside avatar filenames.
  const plain = text.replace(/@\[[^\]]+\]/g, ' ')
  const mentions = (name: string) => plain.split('@' + name).slice(1).some(tail => /^(?:$|[\s，。！？,:：!?.;；、()（）])/.test(tail))
  const names = members.filter(item => mentions(item.name))
  if (mentions('所有人') || mentions('all')) return members
  const ids = new Set([...explicit, ...names.map(item => item.id)])
  const selected = ids.size ? members.filter(item => ids.has(item.id)) : members
  if (!selected.length) throw new Error('提及的成员已不在此群，请重新选择')
  return selected
}
export function memberScope(data: WeChatAppData, group: Group, member: Contact): ConversationScope {
  return { scopeKey: group.scopeKey!, characterName: member.name, card: member.card, externalState: { source: 'none' },
    contactId: member.id, group: { title: group.title, members: groupContacts(data, group).map(({ id, name }) => ({ id, name })) } }
}
