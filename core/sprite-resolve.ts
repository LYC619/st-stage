/**
 * 多包立绘三级地址解析与角色启用清单计算（纯函数）。
 */

import type { PluginSettings, Sprite, SpriteAddress, SpritePack } from './types'
import { formatAddress, parseAddress } from './types'
import { normalizeTag } from './naming'
import {
  addressConflictKey,
  effectiveSpriteAddress,
  findAddressConflicts,
} from './address-policy'

/** 获取某角色当前启用的全部立绘包（按绑定顺序；无绑定/未启用返回空数组） */
export function getActivePacks(settings: PluginSettings, characterName: string): SpritePack[] {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled)
  if (!binding) return []
  const byId = new Map(settings.packs.map((p) => [p.id, p]))
  return binding.packIds.map((id) => byId.get(id)).filter((p): p is SpritePack => p != null)
}

/** 包名前缀的可读基名：空名使用「包」占位。 */
function packBaseAlias(pack: SpritePack): string {
  return normalizeTag(pack.name ?? '') || '包'
}

/** 展平的立绘候选：携带所属包与最终集合中的短语义坐标。 */
interface Candidate {
  pack: SpritePack
  sprite: Sprite
  role: string
  outfit: string
  /** 裸包名（旧地址兼容） */
  baseAlias: string
}

function flatten(packs: SpritePack[]): Candidate[] {
  const multiPack = packs.length > 1
  const out: Candidate[] = []
  for (const pack of packs) {
    const base = packBaseAlias(pack)
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack)
      out.push({
        pack,
        sprite,
        role: address.role,
        outfit: address.outfit,
        baseAlias: base,
      })
    }
  }
  return out
}

/** 某角色全部启用包的完整地址坐标（用于 prompt 注入） */
export function getActiveAddresses(
  settings: PluginSettings,
  characterName: string,
): SpriteAddress[] {
  const packs = getActivePacks(settings, characterName)
  const conflicted = new Set(findAddressConflicts(packs).map((conflict) => conflict.key))
  const out: SpriteAddress[] = []
  const seen = new Set<string>()
  for (const c of flatten(packs)) {
    const address = { role: c.role, outfit: c.outfit, tag: c.sprite.tag }
    if (conflicted.has(addressConflictKey(address))) continue
    const key = formatAddress(address)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(address)
  }
  return out
}

/** 绑定变更前后 Prompt 地址差异，用于在单包→多包等语义变化前给用户预览。 */
export function previewBindingAddressChanges(
  before: PluginSettings,
  after: PluginSettings,
  characterName: string,
): { removed: string[]; added: string[] } {
  const oldAddresses = getActiveAddresses(before, characterName).map(formatAddress)
  const newAddresses = getActiveAddresses(after, characterName).map(formatAddress)
  const oldSet = new Set(oldAddresses)
  const newSet = new Set(newAddresses)
  return {
    removed: oldAddresses.filter((address) => !newSet.has(address)),
    added: newAddresses.filter((address) => !oldSet.has(address)),
  }
}

/** 立绘的分组标签（功能②），缺省为空串 */
export function spriteGroup(sprite: Sprite): string {
  return sprite.group ?? ''
}

/** 包内出现过的分组（非空、按首次出现顺序去重），用于 UI 与 prompt 枚举 */
export function getGroups(pack: SpritePack): string[] {
  const seen: string[] = []
  for (const s of pack.sprites) {
    const g = spriteGroup(s)
    if (g && !seen.includes(g)) seen.push(g)
  }
  return seen
}

/** 名称匹配：精确优先，其次双向子串（用于人名/服装/图名各层的容错） */
function nameMatches(actual: string, query: string): boolean {
  if (actual === query) return true
  return actual.length > 0 && (actual.includes(query) || query.includes(actual))
}

/** 按名称过滤：精确优先；无精确时保留全部模糊候选，交给最终唯一性判断。 */
function filterByName(pool: Candidate[], query: string, of: (c: Candidate) => string): Candidate[] {
  const exact = pool.filter((c) => of(c) === query)
  if (exact.length > 0) return exact
  return pool.filter((c) => nameMatches(of(c), query))
}

function lockByRole(pool: Candidate[], query: string): Candidate[] {
  if (/[@=]/.test(query)) return []
  const roleMatches = filterByName(pool, query, (c) => c.role)
  if (roleMatches.length > 0) return roleMatches
  return filterByName(pool, query, (c) => c.baseAlias)
}

function matchUniqueTagInPool(pool: Candidate[], tag: string): Sprite | null {
  const exact = pool.filter((c) => c.sprite.tag === tag)
  if (exact.length === 1) return exact[0].sprite
  if (exact.length > 1) {
    const packIds = new Set(exact.map((c) => c.pack.id))
    return packIds.size === 1 ? exact[0].sprite : null
  }
  const fuzzy = pool.filter((c) => nameMatches(c.sprite.tag, tag))
  if (fuzzy.length === 1) return fuzzy[0].sprite
  if (fuzzy.length > 1) {
    const packIds = new Set(fuzzy.map((c) => c.pack.id))
    return packIds.size === 1 ? fuzzy[0].sprite : null
  }
  return null
}

function strictTagMatch(pool: Candidate[], tag: string): { matched: boolean; sprite: Sprite | null } {
  const exact = pool.filter((candidate) => candidate.sprite.tag === tag)
  if (exact.length > 0) return { matched: true, sprite: exact.length === 1 ? exact[0].sprite : null }
  const fuzzy = pool.filter((candidate) => nameMatches(candidate.sprite.tag, tag))
  return { matched: fuzzy.length > 0, sprite: fuzzy.length === 1 ? fuzzy[0].sprite : null }
}

function isRelativeOutfitSet(packs: SpritePack[], candidates: Candidate[]): boolean {
  if (packs.length < 2) return false
  const role = candidates[0]?.role
  return Boolean(
    role
      && candidates.length > 0
      && candidates.every((candidate) => candidate.role === role && Boolean(candidate.outfit)),
  )
}

/**
 * 多包严格地址解析（六期核心）：地址 → 立绘。
 */
export function resolveSprite(packs: SpritePack[], address: string): Sprite | null {
  const raw = address.trim()
  if (!raw) return null
  const partCount = raw.split('/').length
  const { role, outfit, tag } = parseAddress(raw)
  if (!tag) return null

  const all = flatten(packs)
  if (partCount === 1) {
    const firstPack = packs[0]
    if (firstPack && isRelativeOutfitSet(packs, all)) {
      const preferred = strictTagMatch(
        all.filter((candidate) => candidate.pack.id === firstPack.id),
        tag,
      )
      if (preferred.matched) return preferred.sprite
    }
    return matchUniqueTagInPool(all, tag)
  }

  if (partCount === 2) {
    const exactRole = all.filter((candidate) => candidate.role === role)
    if (exactRole.length > 0) {
      const rolePool = exactRole.filter((candidate) => candidate.outfit === '')
      return strictTagMatch(rolePool, tag).sprite
    }

    const exactAliasPool = all
      .filter((candidate) => candidate.baseAlias === role)
      .filter((candidate) => candidate.outfit === '')
    if (exactAliasPool.length > 0) {
      const legacy = strictTagMatch(exactAliasPool, tag)
      if (legacy.matched) return legacy.sprite
    }

    const exactOutfit = all.filter((candidate) => candidate.outfit === role)
    if (exactOutfit.length > 0) return strictTagMatch(exactOutfit, tag).sprite

    const fuzzyRole = all.filter((candidate) => nameMatches(candidate.role, role))
    if (fuzzyRole.length > 0) {
      const rolePool = fuzzyRole.filter((candidate) => candidate.outfit === '')
      return strictTagMatch(rolePool, tag).sprite
    }
    const fuzzyAliasPool = all
      .filter((candidate) => nameMatches(candidate.baseAlias, role))
      .filter((candidate) => candidate.outfit === '')
    if (fuzzyAliasPool.length > 0) {
      const legacy = strictTagMatch(fuzzyAliasPool, tag)
      if (legacy.matched) return legacy.sprite
    }
    const fuzzyOutfit = all.filter((candidate) => nameMatches(candidate.outfit, role))
    return strictTagMatch(fuzzyOutfit, tag).sprite
  }

  let pool = all
  if (role) {
    pool = lockByRole(pool, role)
    if (pool.length === 0) return null
    if (!outfit) {
      pool = pool.filter((c) => c.outfit === '')
      if (pool.length === 0) return null
    }
  }
  if (outfit) {
    pool = filterByName(pool, outfit, (c) => c.outfit)
    if (pool.length === 0) return null
  }
  return matchUniqueTagInPool(pool, tag)
}

/**
 * 一条消息的多个地址 → 有序立绘序列（折叠相邻重复，保留 A→B→A 往返）。
 */
export function resolveSprites(packs: SpritePack[], addresses: string[]): Sprite[] {
  const out: Sprite[] = []
  for (const address of addresses) {
    const sprite = resolveSprite(packs, address)
    if (sprite && out[out.length - 1] !== sprite) out.push(sprite)
  }
  return out
}

/** 地址 → 立绘匹配（单包）：等价 resolveSprite([pack], address)。 */
export function matchAddress(pack: SpritePack, address: string): Sprite | null {
  return resolveSprite([pack], address)
}
