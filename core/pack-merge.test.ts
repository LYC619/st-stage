import { describe, expect, it } from 'vitest'
import { effectiveSpriteAddress } from './address-policy'
import { applyPackMerge, inspectPackImport, previewPackMerge } from './pack-merge'
import type { SpritePack } from './types'
import { formatAddress } from './types'

describe('previewPackMerge', () => {
  it('同名即提示，但不重叠的坐标全部自动合入', () => {
    const a: SpritePack = {
      id: 'a',
      name: '鸣人包',
      sprites: [{ tag: '微笑', url: 'a' }],
    }
    const b: SpritePack = {
      id: 'b',
      name: '鸣人包',
      sprites: [{ tag: '生气', url: 'b' }],
    }
    const preview = previewPackMerge([a, b])
    expect(preview.sameName).toBe(true)
    expect(preview.automatic).toHaveLength(2)
    expect(preview.conflicts).toEqual([])
  })

  it('同语义坐标且 URL 相同自动去重，不同 URL 要求选择', () => {
    const a: SpritePack = {
      id: 'a',
      name: 'A',
      roleName: '鸣人',
      sprites: [
        { tag: '微笑', url: 'same' },
        { tag: '生气', url: 'a-angry' },
      ],
    }
    const b: SpritePack = {
      id: 'b',
      name: 'B',
      roleName: '鸣人',
      sprites: [
        { tag: '微笑', url: 'same' },
        { tag: '生气', url: 'b-angry' },
      ],
    }
    const preview = previewPackMerge([a, b])
    expect(preview.overlapCount).toBe(2)
    expect(preview.automatic).toEqual([
      expect.objectContaining({ sourcePackId: 'a', address: { role: '鸣人', outfit: '', tag: '微笑' } }),
    ])
    expect(preview.conflicts).toEqual([
      expect.objectContaining({
        address: { role: '鸣人', outfit: '', tag: '生气' },
        candidates: [
          expect.objectContaining({ sourcePackId: 'a', sprite: expect.objectContaining({ url: 'a-angry' }) }),
          expect.objectContaining({ sourcePackId: 'b', sprite: expect.objectContaining({ url: 'b-angry' }) }),
        ],
      }),
    ])
  })
})

describe('inspectPackImport', () => {
  it('不同普通包名的同 tag 在最终 multiPack 地址中不冲突', () => {
    const a: SpritePack = { id: 'a', name: '鸣人包', sprites: [{ tag: '微笑', url: 'a' }] }
    const b: SpritePack = { id: 'b', name: '佐助包', sprites: [{ tag: '微笑', url: 'b' }] }
    expect(inspectPackImport(a, b)).toEqual({ sameName: false, conflicts: [] })
  })

  it('同名即提示；相同 roleName 的同址按最终地址报告冲突', () => {
    const sameA: SpritePack = { id: 'a', name: '同名', sprites: [{ tag: '微笑', url: 'a' }] }
    const sameB: SpritePack = { id: 'b', name: '同名', sprites: [{ tag: '生气', url: 'b' }] }
    expect(inspectPackImport(sameA, sameB).sameName).toBe(true)

    const roleA: SpritePack = { ...sameA, name: 'A', roleName: '鸣人' }
    const roleB: SpritePack = { ...sameA, id: 'b', name: 'B', roleName: '鸣人', sprites: [{ tag: '微笑', url: 'b' }] }
    expect(inspectPackImport(roleA, roleB).conflicts).toHaveLength(1)
  })
})

describe('applyPackMerge', () => {
  const conflicting = (): SpritePack[] => [
    {
      id: 'a',
      name: 'A',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'a-smile' }],
    },
    {
      id: 'b',
      name: 'B',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'b-smile' }],
    },
  ]

  const expectChoiceError = (run: () => unknown): Error => {
    let caught: unknown
    try {
      run()
    } catch (error) {
      caught = error
    }
    expect(caught).toBeInstanceOf(Error)
    expect((caught as Error).name).toBe('PackMergeChoiceError')
    return caught as Error
  }

  it('不同 URL 冲突未全部选择时拒绝生成', () => {
    expect(() => applyPackMerge(conflicting(), [], { id: 'm', name: '合并包' })).toThrow('尚未选择')
  })

  it('按候选序号选择冲突图片', () => {
    const packs = conflicting()
    packs[0].kind = 'illustration'
    packs[0].customTags = ['剧情']
    packs[1].customTags = ['战斗']
    const key = previewPackMerge(packs).conflicts[0].key
    const merged = applyPackMerge(
      packs,
      [{ key, candidateIndex: 1 }],
      { id: 'm', name: '合并包' },
    )
    expect(merged.sprites).toHaveLength(1)
    expect(merged.sprites[0].url).toBe('b-smile')
    expect(merged.roleName).toBe('鸣人')
    expect(merged.sprites[0].group).toBeUndefined()
    expect(merged.kind).toBe('illustration')
    expect(merged.customTags).toEqual(['剧情', '战斗'])
  })

  it('即使必需选择齐全，也拒绝未知冲突 key', () => {
    const packs = conflicting()
    const key = previewPackMerge(packs).conflicts[0].key
    const error = expectChoiceError(() => applyPackMerge(
      packs,
      [
        { key, candidateIndex: 0 },
        { key: 'unknown-conflict-key', candidateIndex: 0 },
      ],
      { id: 'm', name: '合并包' },
    ))
    expect(error.message).toContain('未知')
  })

  it.each([
    [[0, 1]],
    [[1, 0]],
  ])('拒绝同一冲突 key 的重复选择（顺序 %j）', (candidateIndexes) => {
    const packs = conflicting()
    const key = previewPackMerge(packs).conflicts[0].key
    const error = expectChoiceError(() => applyPackMerge(
      packs,
      candidateIndexes.map((candidateIndex) => ({ key, candidateIndex })),
      { id: 'm', name: '合并包' },
    ))
    expect(error.message).toContain('重复')
  })

  it.each([
    ['非整数', 0.5],
    ['负数', -1],
    ['越界', 2],
    ['非安全整数', Number.MAX_SAFE_INTEGER + 1],
  ])('拒绝%s候选序号 %s', (_label, candidateIndex) => {
    const packs = conflicting()
    const key = previewPackMerge(packs).conflicts[0].key
    const error = expectChoiceError(() => applyPackMerge(
      packs,
      [{ key, candidateIndex }],
      { id: 'm', name: '合并包' },
    ))
    expect(error.message).toContain('候选序号无效')
  })

  it('同一脏包内同址多图也能选择第二个候选', () => {
    const dirty: SpritePack = {
      id: 'a',
      name: 'A',
      roleName: '鸣人',
      sprites: [
        { tag: '微笑', url: 'first' },
        { tag: '微笑', url: 'second' },
      ],
    }
    const key = previewPackMerge([dirty]).conflicts[0].key
    const merged = applyPackMerge(
      [dirty],
      [{ key, candidateIndex: 1 }],
      { id: 'm', name: '合并包' },
    )
    expect(merged.sprites[0].url).toBe('second')
  })

  it('先实体化包级继承；多角色/服装结果使用图片级字段且地址不漂移', () => {
    const packs: SpritePack[] = [
      {
        id: 'a',
        name: 'A',
        roleName: '鸣人',
        outfit: '居家服',
        sprites: [{ tag: '微笑', url: 'a' }],
      },
      {
        id: 'b',
        name: 'B',
        roleName: '佐助',
        outfit: '忍者服',
        sprites: [{ tag: '冷漠', url: 'b' }],
      },
    ]
    const merged = applyPackMerge(packs, [], { id: 'm', name: '合并包' })
    expect(merged.roleName).toBeUndefined()
    expect(merged.outfit).toBeUndefined()
    expect(merged.sprites.map((sprite) => [sprite.group, sprite.outfit])).toEqual([
      ['鸣人', '居家服'],
      ['佐助', '忍者服'],
    ])
    expect(merged.sprites.map((sprite) => formatAddress(effectiveSpriteAddress(merged, sprite, false)))).toEqual([
      '鸣人/居家服/微笑',
      '佐助/忍者服/冷漠',
    ])
  })

  it('所有图片共享 role/outfit 时压回包级默认值', () => {
    const packs: SpritePack[] = [
      {
        id: 'a', name: 'A', roleName: '鸣人', outfit: '居家服',
        sprites: [{ tag: '微笑', url: 'a' }],
      },
      {
        id: 'b', name: 'B', roleName: '鸣人', outfit: '居家服',
        sprites: [{ tag: '生气', url: 'b' }],
      },
    ]
    const merged = applyPackMerge(packs, [], { id: 'm', name: '合并包' })
    expect(merged).toMatchObject({ roleName: '鸣人', outfit: '居家服' })
    expect(merged.sprites.every((sprite) => sprite.group == null && sprite.outfit == null)).toBe(true)
  })

  it('普通同名包合并后不把物理包名固化为 group', () => {
    const packs: SpritePack[] = [
      { id: 'a', name: '同名', sprites: [{ tag: '微笑', url: 'a' }] },
      { id: 'b', name: '同名', sprites: [{ tag: '生气', url: 'b' }] },
    ]
    const merged = applyPackMerge(packs, [], { id: 'm', name: '新包名' })
    expect(merged.roleName).toBeUndefined()
    expect(merged.sprites.every((sprite) => sprite.group == null)).toBe(true)
    expect(merged.sprites.map((sprite) => formatAddress(effectiveSpriteAddress(merged, sprite, false)))).toEqual([
      '微笑',
      '生气',
    ])
  })

  it('无语义人名但有 outfit 时使用合并结果包名形成可逆地址', () => {
    const packs: SpritePack[] = [
      { id: 'a', name: 'A', outfit: '居家服', sprites: [{ tag: '微笑', url: 'a' }] },
      { id: 'b', name: 'B', outfit: '居家服', sprites: [{ tag: '生气', url: 'b' }] },
    ]
    const merged = applyPackMerge(packs, [], { id: 'm', name: '合并包' })
    expect(merged.outfit).toBe('居家服')
    expect(merged.sprites.map((sprite) => formatAddress(effectiveSpriteAddress(merged, sprite, false)))).toEqual([
      '合并包/居家服/微笑',
      '合并包/居家服/生气',
    ])
  })
})
