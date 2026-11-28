/**
 * 立绘包管理逻辑：增删改查、角色绑定与冲突检查。
 * 三级地址解析与角色启用清单计算位于 ./sprite-resolve.ts 并在此统一导出。
 */

import type { PluginSettings, Sprite, SpritePack, SpritePackKind } from './types'
import { normalizeTag } from './naming'
import { t } from './i18n'
import { normalizeLabels } from './sprite-metadata'
import { type AddressConflict, findAddressConflicts } from './address-policy'
import { spriteGroup } from './sprite-resolve'

export {
  getActiveAddresses,
  getActivePacks,
  getGroups,
  matchAddress,
  previewBindingAddressChanges,
  resolveSprite,
  resolveSprites,
  spriteGroup,
} from './sprite-resolve'

/** 生成简单唯一 ID */
export function genId(): string {
  return `pack_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
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

/** 为选中的图包统一设置用途；未知 id 忽略。 */
export function setPackKind(
  settings: PluginSettings,
  packIds: string[],
  kind: SpritePackKind,
): PluginSettings {
  const selected = new Set(packIds)
  return {
    ...settings,
    packs: settings.packs.map((pack) => selected.has(pack.id) ? { ...pack, kind } : pack),
  }
}

/** 为选中的图包追加一个规范化自定义标签；空标签不产生改动。 */
export function addPackCustomTag(
  settings: PluginSettings,
  packIds: string[],
  rawTag: string,
): PluginSettings {
  const tag = normalizeLabels([rawTag])[0]
  if (!tag) return settings
  const selected = new Set(packIds)
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      if (!selected.has(pack.id)) return pack
      const customTags = normalizeLabels([...(pack.customTags ?? []), tag])
      return { ...pack, customTags }
    }),
  }
}

/** 从选中的图包移除一个规范化自定义标签；清空后删除字段。 */
export function removePackCustomTag(
  settings: PluginSettings,
  packIds: string[],
  rawTag: string,
): PluginSettings {
  const tag = normalizeLabels([rawTag])[0]
  if (!tag) return settings
  const selected = new Set(packIds)
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      if (!selected.has(pack.id)) return pack
      const customTags = normalizeLabels(pack.customTags).filter((item) => item !== tag)
      const next = { ...pack }
      if (customTags.length > 0) next.customTags = customTags
      else delete next.customTags
      return next
    }),
  }
}

export interface SpritePackFilter {
  query?: string
  roles?: string[]
  kinds?: SpritePackKind[]
  customTags?: string[]
}

/** 图包列表筛选：不同维度取交集，同一维度多选取并集。 */
export function filterSpritePacks(packs: SpritePack[], filter: SpritePackFilter): SpritePack[] {
  const query = filter.query?.trim().toLocaleLowerCase() ?? ''
  const roles = new Set(normalizeLabels(filter.roles))
  const kinds = new Set(filter.kinds ?? [])
  const customTags = new Set(normalizeLabels(filter.customTags))
  if (!query && roles.size === 0 && kinds.size === 0 && customTags.size === 0) return packs

  return packs.filter((pack) => {
    const role = pack.roleName?.trim() || '其他'
    const kind = pack.kind ?? 'sprite'
    const tags = normalizeLabels(pack.customTags)
    const searchable = [pack.name, role, pack.outfit ?? '', ...tags]
      .join('\n')
      .toLocaleLowerCase()
    return (
      (!query || searchable.includes(query)) &&
      (roles.size === 0 || roles.has(role)) &&
      (kinds.size === 0 || kinds.has(kind)) &&
      (customTags.size === 0 || tags.some((tag) => customTags.has(tag)))
    )
  })
}

/** 全局重命名自定义标签；目标标签已存在时自动合并去重。 */
export function renamePackCustomTag(
  settings: PluginSettings,
  rawFrom: string,
  rawTo: string,
): PluginSettings {
  const from = normalizeLabels([rawFrom])[0]
  const to = normalizeLabels([rawTo])[0]
  if (!from || !to || from === to) return settings
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      const tags = normalizeLabels(pack.customTags)
      if (!tags.includes(from)) return pack
      return { ...pack, customTags: normalizeLabels(tags.map((tag) => tag === from ? to : tag)) }
    }),
  }
}

/** 全局删除自定义标签；图包不再有标签时移除字段。 */
export function deletePackCustomTag(settings: PluginSettings, rawTag: string): PluginSettings {
  const tag = normalizeLabels([rawTag])[0]
  if (!tag) return settings
  return {
    ...settings,
    packs: settings.packs.map((pack) => {
      const tags = normalizeLabels(pack.customTags)
      if (!tags.includes(tag)) return pack
      const customTags = tags.filter((item) => item !== tag)
      const next = { ...pack }
      if (customTags.length > 0) next.customTags = customTags
      else delete next.customTags
      return next
    }),
  }
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

/* ---------- 单张立绘操作（M2 图库管理） ---------- */

/** 更新包内容并盖 updatedAt 时间戳 */
function touchPack(pack: SpritePack, sprites: Sprite[]): SpritePack {
  return { ...pack, sprites, updatedAt: new Date().toISOString() }
}

/** 按有效地址（group + outfit + tag，含包级继承）查找包内同身份立绘。 */
export function findSameSprite(
  pack: SpritePack,
  sprite: Pick<Sprite, 'tag' | 'group' | 'outfit'>,
): Sprite | null {
  return (
    pack.sprites.find((s) =>
      sameIdentity(pack, s, sprite.tag, sprite.group ?? '', sprite.outfit ?? ''),
    ) ?? null
  )
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
 * 重命名立绘 tag（在其所在 group+outfit 内）。失败时抛出本地化说明的 Error：
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
  if (!newTag) throw new Error(t('spriteValidation.invalid_name', '表情名不能为空，且不能包含 [ ] / : | = @ 等符号'))
  if (newTag === oldTag) return pack
  if (pack.sprites.some((s) => sameIdentity(pack, s, newTag, group, outfit))) {
    throw new Error(t('spriteValidation.duplicate_name', '表情名「{{name}}」在该分组中已存在', { name: newTag }))
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
    throw new Error(t('spriteValidation.duplicate_group', '分组「{{group}}」中已存在表情「{{name}}」', {
      group: toGroup || t('spriteValidation.ungrouped', '未分组'), name: tag,
    }))
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
