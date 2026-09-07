import { isPresetPack } from './presets'
import type { PluginSettings, Sprite, SpritePack } from './types'

export interface ImageRef {
  packId: string
  group: string
  outfit: string
  tag: string
}

export interface EmbeddedImageCandidate {
  ref: ImageRef
  sourceUrl: string
}

export interface ImageChange {
  ref: ImageRef
  expectedUrl: string
  nextUrl: string
}

export interface StorageScan {
  candidates: EmbeddedImageCandidate[]
  ambiguous: ImageRef[]
  embeddedReferenceCount: number
  uniqueEmbeddedCount: number
  embeddedTextBytes: number
}

export interface ImageApplyResult {
  settings: PluginSettings
  applied: ImageChange[]
  conflicts: ImageChange[]
}

export function imageRefKey(ref: ImageRef): string {
  return JSON.stringify([ref.packId, ref.group, ref.outfit, ref.tag])
}

export function spriteImageRef(pack: SpritePack, sprite: Sprite): ImageRef {
  return {
    packId: pack.id,
    group: sprite.group ?? '',
    outfit: sprite.outfit ?? '',
    tag: sprite.tag,
  }
}

export function scanEmbeddedImages(settings: PluginSettings): StorageScan {
  const candidates: EmbeddedImageCandidate[] = []
  const byRef = new Map<string, number>()
  const uniqueUrls = new Set<string>()
  for (const pack of settings.packs) {
    if (isPresetPack(pack.id)) continue
    for (const sprite of pack.sprites) {
      const ref = spriteImageRef(pack, sprite)
      const key = imageRefKey(ref)
      byRef.set(key, (byRef.get(key) ?? 0) + 1)
      if (!/^data:/i.test(sprite.url)) continue
      uniqueUrls.add(sprite.url)
      candidates.push({ ref, sourceUrl: sprite.url })
    }
  }
  const encoder = new TextEncoder()
  return {
    candidates,
    ambiguous: candidates
      .filter((candidate) => (byRef.get(imageRefKey(candidate.ref)) ?? 0) > 1)
      .map((candidate) => candidate.ref)
      .filter((ref, index, refs) => refs.findIndex((item) => imageRefKey(item) === imageRefKey(ref)) === index),
    embeddedReferenceCount: candidates.length,
    uniqueEmbeddedCount: uniqueUrls.size,
    embeddedTextBytes: [...uniqueUrls].reduce((total, url) => total + encoder.encode(url).byteLength, 0),
  }
}

export function applyImageChanges(latest: PluginSettings, changes: ImageChange[]): ImageApplyResult {
  const changeCounts = new Map<string, number>()
  for (const change of changes) {
    const key = imageRefKey(change.ref)
    changeCounts.set(key, (changeCounts.get(key) ?? 0) + 1)
  }
  const targets = new Map<string, Sprite[]>()
  for (const pack of latest.packs) {
    if (isPresetPack(pack.id)) continue
    for (const sprite of pack.sprites) {
      const key = imageRefKey(spriteImageRef(pack, sprite))
      const list = targets.get(key) ?? []
      list.push(sprite)
      targets.set(key, list)
    }
  }
  const accepted = new Map<string, ImageChange>()
  const conflicts: ImageChange[] = []
  for (const change of changes) {
    const key = imageRefKey(change.ref)
    const matches = targets.get(key) ?? []
    if (
      changeCounts.get(key) !== 1 ||
      matches.length !== 1 ||
      matches[0].url !== change.expectedUrl ||
      !change.nextUrl
    ) {
      conflicts.push(change)
    } else {
      accepted.set(key, change)
    }
  }
  if (accepted.size === 0) return { settings: latest, applied: [], conflicts }
  const packs = latest.packs.map((pack) => {
    if (isPresetPack(pack.id)) return pack
    let changed = false
    const sprites = pack.sprites.map((sprite) => {
      const change = accepted.get(imageRefKey(spriteImageRef(pack, sprite)))
      if (!change) return sprite
      changed = true
      return { ...sprite, url: change.nextUrl }
    })
    return changed ? { ...pack, sprites } : pack
  })
  return { settings: { ...latest, packs }, applied: [...accepted.values()], conflicts }
}
