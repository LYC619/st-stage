/**
 * 立绘包管理逻辑：增删改查、角色绑定解析、标签 → 图片匹配（含模糊回退）。
 * 纯函数式，状态由调用方（适配器）持有并持久化。
 */

import type { PluginSettings, Sprite, SpriteAddress, SpritePack } from './types'
import { formatAddress, parseAddress } from './types'
import { normalizeTag } from './naming'
import {
  type AddressConflict,
  addressConflictKey,
  effectiveSpriteAddress,
  findAddressConflicts,
} from './address-policy'

/** 生成简单唯一 ID */
export function genId(): string {
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

/** 获取某角色当前启用的全部立绘包（按绑定顺序；无绑定/未启用返回空数组） */
export function getActivePacks(settings: PluginSettings, characterName: string): SpritePack[] {
  const binding = settings.bindings.find((b) => b.characterName === characterName && b.enabled)
  if (!binding) return []
  const byId = new Map(settings.packs.map((p) => [p.id, p]))
  return binding.packIds.map((id) => byId.get(id)).filter((p): p is SpritePack => p != null)
}

/** 获取某角色第一个启用的立绘包（单包场景的便捷入口；多包匹配请用 getActivePacks） */
export function getActivePack(settings: PluginSettings, characterName: string): SpritePack | null {
  return getActivePacks(settings, characterName)[0] ?? null
}

/** 包名前缀的可读基名：空名使用「包」占位。 */
function packBaseAlias(pack: SpritePack): string {
  return normalizeTag(pack.name ?? '') || '包'
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

/** 获取某角色可用的标签列表（单包纯图名场景的便捷入口） */
export function getAvailableTags(settings: PluginSettings, characterName: string): string[] {
  const pack = getActivePack(settings, characterName)
  return pack ? pack.sprites.map((s) => s.tag) : []
}

/** 立绘的分组标签（功能②），缺省为空串 */
export function spriteGroup(sprite: Sprite): string {
  return sprite.group ?? ''
}

/** 立绘身份的服装维度（sprite 自身字段，缺省空串） */
function spriteOutfitTag(sprite: Sprite): string {
  return sprite.outfit ?? ''
}

/**
 * 有效人名/服装（含包级继承）：与地址解析 spriteRole/spriteOutfit 同源。
 * group/outfit 为空时继承包级 roleName/outfit。CRUD 身份按「有效地址」判定，
 * 杜绝「显式写 group=鸣人 与包级 roleName=鸣人 被当成两张、却解析到同一地址」。
 */
function effectiveRole(pack: SpritePack, group: string): string {
  return group.trim() || (pack.roleName ?? '').trim()
}
function effectiveOutfitOf(pack: SpritePack, outfit: string): string {
  return outfit.trim() || (pack.outfit ?? '').trim()
}

/**
 * 写入规范化：与包级 roleName/outfit 相同的显式 group/outfit 属冗余，清空，
 * 让存储恒为「有效地址」的最简形式（避免 getGroups 把包级人名列成分组、
 * 避免同址两张字段不一致而重复）。
 */
function normalizeIdentityFields(pack: SpritePack, sprite: Sprite): Sprite {
  const next = { ...sprite }
  if ((next.group ?? '').trim() === (pack.roleName ?? '').trim()) delete next.group
  if ((next.outfit ?? '').trim() === (pack.outfit ?? '').trim()) delete next.outfit
  return next
}

/**
 * 图片身份判定（三级寻址·有效地址版）：tag + 有效人名 + 有效服装 一致才是同一张。
 * 「有效」先取 sprite 自身字段、空则继承包级，保证 upsert/remove/rename/setGroup
 * 与解析地址定位一致。例：包 roleName=鸣人 时 {tag:微笑} 与 {group:鸣人,tag:微笑} 属同一张；
 * 鸣人/居家服/微笑 与 鸣人/工作服/微笑 outfit 不同属两张，绝不互相覆盖。
 */
function sameIdentity(
  pack: SpritePack,
  s: Sprite,
  tag: string,
  group: string,
  outfit: string,
): boolean {
  return (
    s.tag === tag &&
    effectiveRole(pack, spriteGroup(s)) === effectiveRole(pack, group) &&
    effectiveOutfitOf(pack, spriteOutfitTag(s)) === effectiveOutfitOf(pack, outfit)
  )
}

/** 有效地址身份键；JSON 数组避免字符串分隔符与内容碰撞。 */
function identityKey(pack: SpritePack, sprite: Sprite): string {
  return JSON.stringify([
    effectiveRole(pack, spriteGroup(sprite)),
    effectiveOutfitOf(pack, spriteOutfitTag(sprite)),
    sprite.tag,
  ])
}

/** 规范化冗余字段，并按有效地址保留首次出现项。 */
function dedupeSprites(pack: SpritePack, sprites: Sprite[]): Sprite[] {
  const seen = new Set<string>()
  const out: Sprite[] = []
  for (const raw of sprites) {
    const sprite = normalizeIdentityFields(pack, raw)
    const key = identityKey(pack, sprite)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(sprite)
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

/** 包内出现过的分组（非空、按首次出现顺序去重），用于 UI 与 prompt 枚举 */
export function getGroups(pack: SpritePack): string[] {
  const seen: string[] = []
  for (const s of pack.sprites) {
    const g = spriteGroup(s)
    if (g && !seen.includes(g)) seen.push(g)
  }
  return seen
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

/**
 * 短地址的人名锁定：先匹配最终有效 role；完全无命中时才用裸包名兼容旧地址。
 * `@`/`=` 属于已废弃实验格式，严格拒绝。
 */
function lockByRole(pool: Candidate[], query: string): Candidate[] {
  if (/[@=]/.test(query)) return []
  const roleMatches = filterByName(pool, query, (c) => c.role)
  if (roleMatches.length > 0) return roleMatches
  return filterByName(pool, query, (c) => c.baseAlias)
}

/** 在已锁定的人名/服装候选池内匹配图名；多解时安全返回 null。 */
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
 * - 「图名」：全局按图名匹配；跨包多解时返回 null，
 *   同一包内多个分组仍保留旧的首项兼容行为
 * - 「人名/图名」：先严格锁人名（含包名别名兜底），锁定后在该人名范围内匹配图名；均不存在→null
 * - 「人名/服装/图名」：依次严格锁人名、锁服装，再匹配图名；任一层不存在→null
 * 禁止跨包回退：人名/服装指定后，绝不落到其他角色的同名图名上。
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
    if (pool.length === 0) return null // 严格：请求人名/包名均不存在，不跨角色回退
    if (!outfit) {
      pool = pool.filter((c) => c.outfit === '')
      if (pool.length === 0) return null // 两段 role/tag 明确表示无服装，不落入任一服装变体
    }
  }
  if (outfit) {
    pool = filterByName(pool, outfit, (c) => c.outfit)
    if (pool.length === 0) return null // 严格：请求服装不存在，不跨服装回退
  }
  return matchUniqueTagInPool(pool, tag)
}

/**
 * 一条消息的多个地址 → 有序立绘序列（功能③，多包严格寻址）。
 * 逐个解析；未命中跳过；折叠相邻重复（同一张连着出现只保留一次），保留 A→B→A 往返。
 */
export function resolveSprites(packs: SpritePack[], addresses: string[]): Sprite[] {
  const out: Sprite[] = []
  for (const address of addresses) {
    const sprite = resolveSprite(packs, address)
    if (sprite && out[out.length - 1] !== sprite) out.push(sprite)
  }
  return out
}

/* ---------- 单包匹配（向后兼容：单包场景仍可直接用 pack 匹配） ---------- */

/**
 * 标签 → 立绘匹配，带模糊回退（单包）：精确 → 双向子串 → null。
 */
export function matchSprite(pack: SpritePack, tag: string): Sprite | null {
  const normalized = tag.trim()
  if (!normalized) return null
  const exact = pack.sprites.find((s) => s.tag === normalized)
  if (exact) return exact
  return pack.sprites.find((s) => s.tag.includes(normalized) || normalized.includes(s.tag)) ?? null
}

/** 地址 → 立绘匹配（单包）：等价 resolveSprite([pack], address)。 */
export function matchAddress(pack: SpritePack, address: string): Sprite | null {
  return resolveSprite([pack], address)
}

/** 一条消息的多个标签 → 有序立绘序列（单包）：等价 resolveSprites([pack], addresses)。 */
export function matchSprites(pack: SpritePack, addresses: string[]): Sprite[] {
  return resolveSprites([pack], addresses)
}

export interface BindingConflict extends AddressConflict {
  characterName: string
}

export type ConflictCheckedSettingsResult =
  | { ok: true; settings: PluginSettings }
  | { ok: false; conflicts: BindingConflict[] }

export type BindingChangeResult = ConflictCheckedSettingsResult
export type PackChangeResult = ConflictCheckedSettingsResult

function success(settings: PluginSettings): ConflictCheckedSettingsResult {
  return { ok: true, settings }
}

function conflictsForBinding(
  settings: PluginSettings,
  characterName: string,
  packIds: string[],
): BindingConflict[] {
  const byId = new Map(settings.packs.map((pack) => [pack.id, pack]))
  const packs = packIds.map((id) => byId.get(id)).filter((pack): pack is SpritePack => pack != null)
  return findAddressConflicts(packs).map((conflict) => ({ ...conflict, characterName }))
}

function uniquePackIds(packIds: string[]): string[] {
  const ids: string[] = []
  for (const id of packIds) if (id && !ids.includes(id)) ids.push(id)
  return ids
}

function withBinding(
  settings: PluginSettings,
  characterName: string,
  packIds: string[],
  enabled: boolean,
): PluginSettings {
  const others = settings.bindings.filter((binding) => binding.characterName !== characterName)
  if (packIds.length === 0) return { ...settings, bindings: others }
  return {
    ...settings,
    bindings: [...others, { characterName, packIds, enabled }],
  }
}

/** 添加/更新立绘包（同 id 覆盖）；活动包变更同样必须保持跨包地址唯一。 */
export function upsertPack(settings: PluginSettings, pack: SpritePack): PackChangeResult {
  const exists = settings.packs.some((p) => p.id === pack.id)
  const next: PluginSettings = {
    ...settings,
    packs: exists ? settings.packs.map((p) => (p.id === pack.id ? pack : p)) : [...settings.packs, pack],
  }
  const conflicts: BindingConflict[] = []
  for (const binding of next.bindings) {
    if (!binding.enabled || !binding.packIds.includes(pack.id)) continue
    conflicts.push(...conflictsForBinding(next, binding.characterName, binding.packIds))
  }
  return conflicts.length > 0 ? { ok: false, conflicts } : success(next)
}

/** 删除立绘包，并从所有绑定中摘除该包（绑定变空时整条移除） */
export function removePack(settings: PluginSettings, packId: string): PluginSettings {
  const bindings = settings.bindings
    .map((b) => ({ ...b, packIds: b.packIds.filter((id) => id !== packId) }))
    .filter((b) => b.packIds.length > 0)
  return {
    ...settings,
    packs: settings.packs.filter((p) => p.id !== packId),
    bindings,
  }
}

/** 批量删除立绘包（绑定同步摘除）；未知 id 忽略 */
export function removePacks(settings: PluginSettings, packIds: string[]): PluginSettings {
  let next = settings
  for (const id of packIds) next = removePack(next, id)
  return next
}

/** 验证已经完成 URI 解码的 ST 用户图片路径；调用方不得再次解码。 */
export function isSafeLocalUserImagePath(path: string): boolean {
  if (
    !path.startsWith('/user/images/') ||
    /%(?:2e|2f|5c)/i.test(path) ||
    path.includes('\0')
  ) return false
  return !path.split('/').some((segment) => segment === '.' || segment === '..')
}

/** 解码一次并规范化分隔符，返回可交给 ST 删除 API 的路径。 */
export function localUserImagePath(url: string): string | null {
  const rawPath = url.split(/[?#]/, 1)[0]
  let decoded: string
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    return null
  }
  const normalized = decoded.replace(/\\/g, '/')
  if (!isSafeLocalUserImagePath(normalized)) return null
  return normalized
}

/**
 * 选中包删除时允许一并清理的物理文件：仅 ST 用户图片目录，且没有未选中包继续引用。
 * 同一路径在选中包内重复出现时只返回一次。
 */
export function deletableLocalSpritePaths(settings: PluginSettings, packIds: string[]): string[] {
  const selected = new Set(packIds)
  const keptReferences = new Set<string>()
  for (const pack of settings.packs) {
    if (selected.has(pack.id)) continue
    for (const sprite of pack.sprites) {
      const path = localUserImagePath(sprite.url)
      if (path) keptReferences.add(path)
    }
  }

  const result: string[] = []
  const seen = new Set<string>()
  for (const pack of settings.packs) {
    if (!selected.has(pack.id)) continue
    for (const sprite of pack.sprites) {
      const path = localUserImagePath(sprite.url)
      if (!path || seen.has(path) || keptReferences.has(path)) continue
      seen.add(path)
      result.push(path)
    }
  }
  return result
}

/** 包列表内平移一个包（offset=-1 前移 / +1 后移）；越界或未知 id 原样返回 */
export function movePack(settings: PluginSettings, packId: string, offset: number): PluginSettings {
  const from = settings.packs.findIndex((p) => p.id === packId)
  if (from < 0) return settings
  const to = from + offset
  if (to < 0 || to >= settings.packs.length) return settings
  const packs = [...settings.packs]
  const [moved] = packs.splice(from, 1)
  packs.splice(to, 0, moved)
  return { ...settings, packs }
}

/** 拖拽排序：把 packId 移到 targetId 之前；同一个包或未知 id 原样返回 */
export function movePackBefore(
  settings: PluginSettings,
  packId: string,
  targetId: string,
): PluginSettings {
  if (packId === targetId) return settings
  const from = settings.packs.findIndex((p) => p.id === packId)
  if (from < 0) return settings
  const packs = [...settings.packs]
  const [moved] = packs.splice(from, 1)
  const to = packs.findIndex((p) => p.id === targetId)
  if (to < 0) return settings
  packs.splice(to, 0, moved)
  return { ...settings, packs }
}

/** 给角色的启用包集合追加一个包（已在其中则不动；自动启用绑定） */
export function bindPack(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): BindingChangeResult {
  const existing = settings.bindings.find((b) => b.characterName === characterName)
  const ids = uniquePackIds([...(existing?.packIds ?? []), packId])
  const conflicts = conflictsForBinding(settings, characterName, ids)
  if (conflicts.length > 0) return { ok: false, conflicts }
  return success(withBinding(settings, characterName, ids, true))
}

/** 从角色的启用包集合中移除一个包（绑定变空时整条移除） */
export function unbindPack(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): PluginSettings {
  const bindings = settings.bindings
    .map((b) =>
      b.characterName === characterName
        ? { ...b, packIds: b.packIds.filter((id) => id !== packId) }
        : b,
    )
    .filter((b) => b.packIds.length > 0)
  return { ...settings, bindings }
}

/** 设置角色的启用包集合（整体替换，去重丢空；空集合则移除绑定） */
export function setBinding(
  settings: PluginSettings,
  characterName: string,
  packIds: string[],
): BindingChangeResult {
  const ids = uniquePackIds(packIds)
  const conflicts = conflictsForBinding(settings, characterName, ids)
  if (conflicts.length > 0) return { ok: false, conflicts }
  const prev = settings.bindings.find((b) => b.characterName === characterName)
  return success(withBinding(settings, characterName, ids, prev?.enabled ?? true))
}

/** 调整角色启用包的顺序（把 packId 从 fromIndex 移到 toIndex） */
export function reorderBinding(
  settings: PluginSettings,
  characterName: string,
  fromIndex: number,
  toIndex: number,
): PluginSettings {
  return {
    ...settings,
    bindings: settings.bindings.map((b) => {
      if (b.characterName !== characterName) return b
      const ids = [...b.packIds]
      if (fromIndex < 0 || fromIndex >= ids.length || toIndex < 0 || toIndex >= ids.length) return b
      const [moved] = ids.splice(fromIndex, 1)
      ids.splice(toIndex, 0, moved)
      return { ...b, packIds: ids }
    }),
  }
}

/** 绑定角色到单个立绘包（覆盖旧绑定为仅此一包；兼容旧调用方） */
export function bindCharacter(
  settings: PluginSettings,
  characterName: string,
  packId: string,
): BindingChangeResult {
  const conflicts = conflictsForBinding(settings, characterName, [packId])
  if (conflicts.length > 0) return { ok: false, conflicts }
  return success(withBinding(settings, characterName, [packId], true))
}

/* ---------- 单张立绘操作（M2 图库管理） ---------- */

/** 更新包内容并盖 updatedAt 时间戳 */
function touchPack(pack: SpritePack, sprites: Sprite[]): SpritePack {
  return { ...pack, sprites, updatedAt: new Date().toISOString() }
}

/** 在包内新增或替换立绘（同「有效地址」group+outfit+tag 覆盖 url/code/remoteUrl） */
export function upsertSprite(pack: SpritePack, sprite: Sprite): SpritePack {
  const stored = normalizeIdentityFields(pack, sprite)
  const g = spriteGroup(stored)
  const o = spriteOutfitTag(stored)
  const sprites: Sprite[] = []
  let replaced = false
  for (const current of pack.sprites) {
    if (sameIdentity(pack, current, stored.tag, g, o)) {
      if (!replaced) {
        sprites.push(stored)
        replaced = true
      }
      continue
    }
    sprites.push(current)
  }
  if (!replaced) sprites.push(stored)
  return touchPack(pack, dedupeSprites(pack, sprites))
}

/** 删除包内一张立绘（按有效地址 group+outfit+tag 定位）；若该 tag 已无任何立绘且是封面则清掉 coverTag */
export function removeSprite(pack: SpritePack, tag: string, group = '', outfit = ''): SpritePack {
  const next = touchPack(
    pack,
    pack.sprites.filter((s) => !sameIdentity(pack, s, tag, group, outfit)),
  )
  if (next.coverTag === tag && !next.sprites.some((s) => s.tag === tag)) delete next.coverTag
  return next
}

/**
 * 重命名立绘 tag（在其所在 group+outfit 内）。失败时抛出带中文说明的 Error：
 * 新 tag 清洗后为空、或与同 group+outfit 内其他立绘重名。
 */
export function renameSprite(
  pack: SpritePack,
  oldTag: string,
  newTagRaw: string,
  group = '',
  outfit = '',
): SpritePack {
  const newTag = normalizeTag(newTagRaw)
  if (!newTag) throw new Error('表情名不能为空，且不能包含 [ ] / : | = @ 等符号')
  if (newTag === oldTag) return pack
  if (pack.sprites.some((s) => sameIdentity(pack, s, newTag, group, outfit))) {
    throw new Error(`表情名「${newTag}」在该分组中已存在`)
  }
  const sprites = pack.sprites.map((s) =>
    sameIdentity(pack, s, oldTag, group, outfit) ? { ...s, tag: newTag } : s,
  )
  const next = touchPack(pack, sprites)
  if (next.coverTag === oldTag) next.coverTag = newTag
  return next
}

/**
 * 修改某张立绘的分组（按当前 group+outfit+tag 定位，功能②）。
 * 目标分组内若已有同 outfit+tag 立绘则抛错避免撞车；toGroup 清洗后为空表示移出分组。
 */
export function setSpriteGroup(
  pack: SpritePack,
  tag: string,
  fromGroup: string,
  toGroupRaw: string,
  outfit = '',
): SpritePack {
  const toGroup = normalizeTag(toGroupRaw)
  const sources = new Set(
    pack.sprites.filter((s) => sameIdentity(pack, s, tag, fromGroup, outfit)),
  )
  if (
    pack.sprites.some(
      (s) => !sources.has(s) && sameIdentity(pack, s, tag, toGroup, outfit),
    )
  ) {
    throw new Error(`分组「${toGroup || '未分组'}」中已存在表情「${tag}」`)
  }
  const sprites = pack.sprites.map((s) => {
    if (!sources.has(s)) return s
    const next = { ...s }
    if (toGroup) next.group = toGroup
    else delete next.group
    return normalizeIdentityFields(pack, next)
  })
  return touchPack(pack, dedupeSprites(pack, sprites))
}

/** 移动立绘顺序（fromIndex → toIndex，越界时原样返回） */
export function moveSprite(pack: SpritePack, fromIndex: number, toIndex: number): SpritePack {
  const len = pack.sprites.length
  if (fromIndex === toIndex || fromIndex < 0 || fromIndex >= len || toIndex < 0 || toIndex >= len) {
    return pack
  }
  const sprites = [...pack.sprites]
  const [moved] = sprites.splice(fromIndex, 1)
  sprites.splice(toIndex, 0, moved)
  return touchPack(pack, sprites)
}

/** 切换角色绑定的启用状态 */
export function toggleBinding(
  settings: PluginSettings,
  characterName: string,
  enabled: boolean,
): BindingChangeResult {
  const binding = settings.bindings.find((item) => item.characterName === characterName)
  if (enabled && binding) {
    const conflicts = conflictsForBinding(settings, characterName, binding.packIds)
    if (conflicts.length > 0) return { ok: false, conflicts }
  }
  return success({
    ...settings,
    bindings: settings.bindings.map((b) =>
      b.characterName === characterName ? { ...b, enabled } : b,
    ),
  })
}
