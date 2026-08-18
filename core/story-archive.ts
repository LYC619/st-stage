import { normalizeTag, sanitizePackName } from './naming'
import type { PluginSettings, Sprite, SpritePack } from './types'

export interface StoryKeyParts {
  chatId?: string | number | null
  characterId?: string | number | null
  groupId?: string | number | null
  title?: string | null
  characterName?: string | null
}

export interface StoryContext {
  key: string
  title: string
  characterName: string
}

export function storyArchiveKey(parts: StoryKeyParts): string {
  const groupId = clean(parts.groupId)
  const characterId = clean(parts.characterId)
  const characterName = clean(parts.characterName)
  const owner = groupId
    ? `group:${groupId}`
    : characterId || (characterName ? `name:${characterName}` : 'unknown')
  const chatId = clean(parts.chatId)
  const title = clean(parts.title)
  const chat = chatId || (title ? `title:${title}` : 'current')
  return `${owner}::${chat}`
}

export function upsertStorySprite(
  settings: PluginSettings,
  story: StoryContext,
  source: Sprite,
): PluginSettings {
  const existingIndex = settings.packs.findIndex((pack) => pack.sourceStoryKey === story.key)
  const existing = existingIndex >= 0 ? settings.packs[existingIndex] : null
  const sourceUrls = new Set([source.url, source.remoteUrl].filter((url): url is string => Boolean(url)))
  if (existing?.sprites.some((sprite) =>
    sourceUrls.has(sprite.url) || Boolean(sprite.remoteUrl && sourceUrls.has(sprite.remoteUrl)),
  )) return settings

  const pack = existing ?? createStoryPack(story)
  const tag = uniqueTag(pack, source.tag)
  const nextPack: SpritePack = {
    ...pack,
    roleName: pack.roleName || normalizeTag(story.characterName) || undefined,
    updatedAt: new Date().toISOString(),
    sprites: [...pack.sprites, { ...source, tag }],
  }
  const packs = [...settings.packs]
  if (existingIndex >= 0) packs[existingIndex] = nextPack
  else packs.push(nextPack)
  return { ...settings, packs }
}

function createStoryPack(story: StoryContext): SpritePack {
  const title = sanitizePackName(story.title) || sanitizePackName(story.characterName) || 'Untitled'
  return {
    id: `story_${hash(story.key)}`,
    name: sanitizePackName(`Story - ${title}`) || 'Story',
    kind: 'illustration',
    roleName: normalizeTag(story.characterName) || undefined,
    sourceStoryKey: story.key,
    sprites: [],
  }
}

function uniqueTag(pack: SpritePack, raw: string): string {
  const fallback = `Generated image ${pack.sprites.length + 1}`
  const base = normalizeTag(raw) || normalizeTag(fallback)
  const used = new Set(pack.sprites.map((sprite) => sprite.tag))
  if (!used.has(base)) return base
  for (let suffix = 2; ; suffix += 1) {
    const suffixText = ` ${suffix}`
    const stem = Array.from(base).slice(0, Math.max(1, 20 - suffixText.length)).join('')
    const candidate = normalizeTag(`${stem}${suffixText}`)
    if (!used.has(candidate)) return candidate
  }
}

function clean(value: unknown): string {
  return value === null || value === undefined ? '' : String(value).trim()
}

function hash(value: string): string {
  let result = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 16777619)
  }
  return (result >>> 0).toString(36)
}
