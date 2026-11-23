import { stableCharacterKey } from '../../../../core/character-identity'
import type { Contact } from './types'

/** Story characters have their own identity; they never impersonate an ST avatar. */
export function storyContactId(storyKey: string, name: string): string {
  return `story:${encodeURIComponent(storyKey)}:${encodeURIComponent(name.trim())}`
}

export function createStoryContact(storyKey: string, name: string): Contact {
  const clean = name.trim().slice(0, 100)
  if (!storyKey || !clean) throw new Error('当前故事或联系人名称为空，无法建立私聊。')
  return {
    id: storyContactId(storyKey, clean), name: clean, kind: 'story', storyKey,
    card: { name: clean, description: '当前主线故事中的登场人物，言行与记忆遵循当前主聊天与世界书。' },
  }
}

/** Contact records enter through saved settings as well as the host card catalogue. */
export function hasContactIdentity(item: Contact): boolean {
  if (item.kind === 'story') {
    return typeof item.storyKey === 'string' && item.storyKey.length > 0
      && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 100
      && item.id === storyContactId(item.storyKey, item.name) && item.card?.name === item.name
  }
  return Boolean(stableCharacterKey(item.card) && stableCharacterKey(item.card) === item.id)
}

export function contactBelongsToStory(item: Contact, storyKey: string): boolean {
  return item.kind !== 'story' || hasContactIdentity(item) && item.storyKey === storyKey
}
