import { describe, expect, it } from 'vitest'
import { effectiveSpriteAddress, findAddressConflicts } from './address-policy'
import type { Sprite, SpritePack } from './types'

const sprite = (tag = '微笑', url = 'u', extra: Partial<Sprite> = {}): Sprite => ({
  tag,
  url,
  ...extra,
})

describe('effectiveSpriteAddress', () => {
  it('单包无语义层时保持纯图名', () => {
    const pack: SpritePack = { id: 'a', name: '鸣人包', sprites: [sprite()] }
    expect(effectiveSpriteAddress(pack, pack.sprites[0], false)).toEqual({
      role: '',
      outfit: '',
      tag: '微笑',
    })
  })

  it('单包有服装但无人名时使用包名，避免服装维度丢失', () => {
    const pack: SpritePack = {
      id: 'a',
      name: '鸣人包',
      outfit: '居家服',
      sprites: [sprite()],
    }
    expect(effectiveSpriteAddress(pack, pack.sprites[0], false)).toEqual({
      role: '鸣人包',
      outfit: '居家服',
      tag: '微笑',
    })
  })

  it('group 优先于 roleName，sprite outfit 优先于包级 outfit', () => {
    const pack: SpritePack = {
      id: 'a',
      name: '包名',
      roleName: '包级人名',
      outfit: '包级服装',
      sprites: [sprite('微笑', 'u', { group: '图片人名', outfit: '图片服装' })],
    }
    expect(effectiveSpriteAddress(pack, pack.sprites[0], true)).toEqual({
      role: '图片人名',
      outfit: '图片服装',
      tag: '微笑',
    })
  })

  it('多包无语义层时使用清洗后的包名', () => {
    const pack: SpritePack = { id: 'a', name: ' 鸣人/包 ', sprites: [sprite()] }
    expect(effectiveSpriteAddress(pack, pack.sprites[0], true).role).toBe('鸣人包')
  })
})

describe('findAddressConflicts', () => {
  it('按变更后的多包集合重算 fallback，同名包同址产生冲突', () => {
    const a: SpritePack = { id: 'a', name: '同名', sprites: [sprite('微笑', 'a')] }
    const b: SpritePack = { id: 'b', name: '同名', sprites: [sprite('微笑', 'b')] }
    const conflicts = findAddressConflicts([a, b])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0]).toMatchObject({
      formattedAddress: '同名/微笑',
      owners: [
        { packId: 'a', packName: '同名', spriteUrl: 'a' },
        { packId: 'b', packName: '同名', spriteUrl: 'b' },
      ],
    })
  })

  it('同角色但 tag 不重叠、或同 tag 但 outfit 不同均允许共存', () => {
    const a: SpritePack = {
      id: 'a',
      name: 'A',
      roleName: '鸣人',
      sprites: [sprite('微笑', 'a')],
    }
    const disjoint: SpritePack = {
      id: 'b',
      name: 'B',
      roleName: '鸣人',
      sprites: [sprite('生气', 'b')],
    }
    const outfit: SpritePack = {
      id: 'c',
      name: 'C',
      roleName: '鸣人',
      outfit: '居家服',
      sprites: [sprite('微笑', 'c')],
    }
    expect(findAddressConflicts([a, disjoint, outfit])).toEqual([])
  })

  it('包名 fallback 与另一包 roleName/group 使用同一命名空间', () => {
    const fallback: SpritePack = { id: 'a', name: '鸣人', sprites: [sprite('微笑', 'a')] }
    const roleName: SpritePack = {
      id: 'b',
      name: 'B',
      roleName: '鸣人',
      sprites: [sprite('微笑', 'b')],
    }
    const group: SpritePack = {
      id: 'c',
      name: 'C',
      sprites: [sprite('微笑', 'c', { group: '鸣人' })],
    }
    const conflicts = findAddressConflicts([fallback, roleName, group])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].owners.map((owner) => owner.packId)).toEqual(['a', 'b', 'c'])
  })

  it('不同包即使 URL 相同也报告两个所有者，同包历史重复不扩大为跨包冲突', () => {
    const a: SpritePack = {
      id: 'a',
      name: 'A',
      roleName: '鸣人',
      sprites: [sprite('微笑', 'same'), sprite('微笑', 'same')],
    }
    const b: SpritePack = {
      id: 'b',
      name: 'B',
      roleName: '鸣人',
      sprites: [sprite('微笑', 'same')],
    }
    const conflicts = findAddressConflicts([a, b])
    expect(conflicts).toHaveLength(1)
    expect(conflicts[0].owners).toHaveLength(2)
    expect(conflicts[0].owners.map((owner) => owner.packId)).toEqual(['a', 'b'])
  })
})
