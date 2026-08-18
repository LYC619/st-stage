/**
 * 多图包合并的纯策略：预览重复/冲突，再按用户选择生成一个新包。
 * 物理包名 fallback 只用于同时启用时的寻址，不会被固化为合并包的语义 group。
 */

import {
  type AddressConflict,
  addressConflictKey,
  findAddressConflicts,
} from './address-policy'
import type { Sprite, SpriteAddress, SpritePack } from './types'
import { spriteOutfit } from './types'
import { normalizeLabels } from './sprite-metadata'

export interface MergeCandidate {
  sourcePackId: string
  sourcePackName: string
  address: SpriteAddress
  sprite: Sprite
}

export interface MergeConflict {
  key: string
  address: SpriteAddress
  candidates: MergeCandidate[]
}

export interface PackMergeChoice {
  key: string
  candidateIndex: number
}

export class PackMergeChoiceError extends Error {
  override name = 'PackMergeChoiceError'
}

export interface PackMergePreview {
  sameName: boolean
  overlapCount: number
  automatic: MergeCandidate[]
  conflicts: MergeConflict[]
}

export interface PackImportInspection {
  sameName: boolean
  conflicts: AddressConflict[]
}

interface MergeGroup {
  key: string
  address: SpriteAddress
  candidates: MergeCandidate[]
}

/** 合并身份只保留真实语义 role；多包物理包名 fallback 在合并后不再需要。 */
function mergeAddress(pack: SpritePack, sprite: Sprite): SpriteAddress {
  return {
    role: (sprite.group ?? '').trim() || (pack.roleName ?? '').trim(),
    outfit: spriteOutfit(pack, sprite),
    tag: sprite.tag,
  }
}

function buildGroups(packs: SpritePack[]): MergeGroup[] {
  const groups = new Map<string, MergeGroup>()
  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = mergeAddress(pack, sprite)
      const key = addressConflictKey(address)
      let group = groups.get(key)
      if (!group) {
        group = { key, address, candidates: [] }
        groups.set(key, group)
      }
      group.candidates.push({
        sourcePackId: pack.id,
        sourcePackName: pack.name,
        address,
        sprite,
      })
    }
  }
  return [...groups.values()]
}

function isAutomatic(group: MergeGroup): boolean {
  return new Set(group.candidates.map((candidate) => candidate.sprite.url)).size <= 1
}

export function previewPackMerge(packs: SpritePack[]): PackMergePreview {
  const names = packs.map((pack) => pack.name.trim()).filter(Boolean)
  const sameName = new Set(names).size < names.length
  const automatic: MergeCandidate[] = []
  const conflicts: MergeConflict[] = []
  let overlapCount = 0

  for (const group of buildGroups(packs)) {
    if (group.candidates.length > 1) overlapCount++
    if (isAutomatic(group)) automatic.push(group.candidates[0])
    else conflicts.push({ key: group.key, address: group.address, candidates: group.candidates })
  }
  return { sameName, overlapCount, automatic, conflicts }
}

/** 导入提示按真实双包启用地址判断，不能把不同包名的普通同 tag 误报为运行时冲突。 */
export function inspectPackImport(existing: SpritePack, incoming: SpritePack): PackImportInspection {
  return {
    sameName: existing.name.trim() === incoming.name.trim(),
    conflicts: findAddressConflicts([existing, incoming]),
  }
}

function commonNonEmpty(values: string[]): string {
  if (values.length === 0 || !values[0]) return ''
  return values.every((value) => value === values[0]) ? values[0] : ''
}

function validateChoicesForGroups(
  groups: MergeGroup[],
  choices: PackMergeChoice[],
): Map<string, number> {
  const conflicts = groups.filter((group) => !isAutomatic(group))
  const conflictByKey = new Map(conflicts.map((group) => [group.key, group]))
  const choiceByKey = new Map<string, number>()

  for (const choice of choices) {
    const group = conflictByKey.get(choice.key)
    if (!group) {
      throw new PackMergeChoiceError(`未知冲突选择 key：${choice.key}`)
    }
    if (choiceByKey.has(choice.key)) {
      throw new PackMergeChoiceError(`地址「${group.address.tag}」存在重复选择`)
    }
    if (
      !Number.isSafeInteger(choice.candidateIndex) ||
      choice.candidateIndex < 0 ||
      choice.candidateIndex >= group.candidates.length
    ) {
      throw new PackMergeChoiceError(`地址「${group.address.tag}」的候选序号无效`)
    }
    choiceByKey.set(choice.key, choice.candidateIndex)
  }

  for (const group of conflicts) {
    if (!choiceByKey.has(group.key)) {
      throw new PackMergeChoiceError(`地址「${group.address.tag}」的冲突图片尚未选择`)
    }
  }
  return choiceByKey
}

/** 在询问结果元数据前预检用户选择；不生成包、不修改输入。 */
export function validatePackMergeChoices(packs: SpritePack[], choices: PackMergeChoice[]): void {
  validateChoicesForGroups(buildGroups(packs), choices)
}

export function applyPackMerge(
  packs: SpritePack[],
  choices: PackMergeChoice[],
  result: { id: string; name: string },
): SpritePack {
  const groups = buildGroups(packs)
  const choiceByKey = validateChoicesForGroups(groups, choices)
  const selected: MergeCandidate[] = []

  for (const group of groups) {
    if (isAutomatic(group)) {
      selected.push(group.candidates[0])
      continue
    }
    selected.push(group.candidates[choiceByKey.get(group.key)!])
  }

  const commonRole = commonNonEmpty(selected.map((candidate) => candidate.address.role))
  const commonOutfit = commonNonEmpty(selected.map((candidate) => candidate.address.outfit))
  const sprites = selected.map((candidate): Sprite => {
    const sprite: Sprite = { ...candidate.sprite }
    delete sprite.group
    delete sprite.outfit
    if (!commonRole && candidate.address.role) sprite.group = candidate.address.role
    if (!commonOutfit && candidate.address.outfit) sprite.outfit = candidate.address.outfit
    return sprite
  })

  const first = packs[0]
  const customTags = normalizeLabels(packs.flatMap((pack) => pack.customTags ?? []))
  const coverTag = first?.coverTag && sprites.some((sprite) => sprite.tag === first.coverTag)
    ? first.coverTag
    : sprites[0]?.tag
  return {
    id: result.id,
    name: result.name,
    ...(first?.author ? { author: first.author } : {}),
    ...(first?.description ? { description: first.description } : {}),
    ...(first?.kind ? { kind: first.kind } : {}),
    ...(customTags.length > 0 ? { customTags } : {}),
    ...(commonRole ? { roleName: commonRole } : {}),
    ...(commonOutfit ? { outfit: commonOutfit } : {}),
    ...(coverTag ? { coverTag } : {}),
    sprites,
    updatedAt: new Date().toISOString(),
  }
}
