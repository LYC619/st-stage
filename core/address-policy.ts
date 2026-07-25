/**
 * 立绘有效地址与跨包冲突策略。
 *
 * 本模块只处理纯数据：同一组 packs 在最终启用上下文中会生成哪些语义坐标，
 * 以及哪些坐标被两个以上物理包同时拥有。UI 与绑定函数共用这一个判断源。
 */

import { normalizeTag } from './naming'
import type { Sprite, SpriteAddress, SpritePack } from './types'
import { formatAddress, spriteOutfit } from './types'

export interface AddressConflictOwner {
  packId: string
  packName: string
  spriteUrl: string
}

export interface AddressConflict {
  key: string
  address: SpriteAddress
  formattedAddress: string
  owners: AddressConflictOwner[]
}

/** 有效坐标的稳定比较键；字段数组避免字符串拼接边界碰撞。 */
export function addressConflictKey(address: SpriteAddress): string {
  return JSON.stringify([address.role, address.outfit, address.tag])
}

/**
 * 图片在最终启用集合中的短语义地址。
 *
 * - group > pack.roleName；
 * - sprite.outfit > pack.outfit；
 * - 多包或存在 outfit 时，无语义人名的图片用包名补足 role；
 * - 真正的单包、无角色、无服装场景继续保留纯图名。
 */
export function effectiveSpriteAddress(
  pack: SpritePack,
  sprite: Sprite,
  multiPack: boolean,
): SpriteAddress {
  const outfit = spriteOutfit(pack, sprite)
  const semanticRole = (sprite.group ?? '').trim() || (pack.roleName ?? '').trim()
  const role = semanticRole || ((multiPack || outfit) ? normalizeTag(pack.name) : '')
  return { role, outfit, tag: sprite.tag }
}

/**
 * 找出最终启用集合中的跨包同址。
 * 同一包内部的历史重复由 CRUD/数据清理负责，不在这里扩大成跨包冲突。
 */
export function findAddressConflicts(packs: SpritePack[]): AddressConflict[] {
  const multiPack = packs.length > 1
  const grouped = new Map<
    string,
    { address: SpriteAddress; owners: Map<string, AddressConflictOwner> }
  >()

  for (const pack of packs) {
    for (const sprite of pack.sprites) {
      const address = effectiveSpriteAddress(pack, sprite, multiPack)
      const key = addressConflictKey(address)
      let entry = grouped.get(key)
      if (!entry) {
        entry = { address, owners: new Map() }
        grouped.set(key, entry)
      }
      if (!entry.owners.has(pack.id)) {
        entry.owners.set(pack.id, {
          packId: pack.id,
          packName: pack.name,
          spriteUrl: sprite.url,
        })
      }
    }
  }

  const conflicts: AddressConflict[] = []
  for (const [key, entry] of grouped) {
    if (entry.owners.size < 2) continue
    conflicts.push({
      key,
      address: entry.address,
      formattedAddress: formatAddress(entry.address),
      owners: [...entry.owners.values()],
    })
  }
  return conflicts
}
