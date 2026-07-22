import { describe, expect, it } from 'vitest'
import type { SpritePack } from './types'
import {
  autoRenameTag,
  planUploads,
  previewGroupSplit,
  splitPackByGroup,
  type UploadEntry,
} from './pack-split'

/* ---------------- 旧分组拆包 ---------------- */

function multiGroupPack(): SpritePack {
  return {
    id: 'old',
    name: '合集',
    author: '我',
    sprites: [
      { tag: '微笑', url: 'n1', group: '鸣人' },
      { tag: '生气', url: 'n2', group: '鸣人' },
      { tag: '微笑', url: 's1', group: '佐助' },
      { tag: '无组', url: 'x1' },
    ],
  }
}

describe('previewGroupSplit', () => {
  it('按 group 归类，忽略无分组', () => {
    const preview = previewGroupSplit(multiGroupPack())
    expect(preview.map((p) => p.roleName)).toEqual(['鸣人', '佐助'])
    expect(preview[0]).toMatchObject({ roleName: '鸣人', count: 2, packName: '合集·鸣人' })
    expect(preview[1]).toMatchObject({ roleName: '佐助', count: 1 })
  })
  it('少于 2 个分组不拆（返回空）', () => {
    expect(previewGroupSplit({ id: 'p', name: 'x', sprites: [{ tag: 'a', url: 'u' }] })).toEqual([])
    expect(
      previewGroupSplit({ id: 'p', name: 'x', sprites: [{ tag: 'a', url: 'u', group: '鸣人' }] }),
    ).toEqual([])
  })
})

describe('splitPackByGroup', () => {
  it('生成多个新包：roleName=组名、立绘去 group、新 id', () => {
    const packs = splitPackByGroup(multiGroupPack())
    expect(packs).toHaveLength(2)
    const naruto = packs.find((p) => p.roleName === '鸣人')!
    expect(naruto.id).not.toBe('old')
    expect(naruto.sprites.map((s) => s.tag)).toEqual(['微笑', '生气'])
    expect(naruto.sprites.every((s) => s.group === undefined)).toBe(true)
    expect(naruto.author).toBe('我')
  })
  it('原包对象不被修改（可逆前提：先建新包再决定是否删原）', () => {
    const original = multiGroupPack()
    const snapshot = JSON.stringify(original)
    splitPackByGroup(original)
    expect(JSON.stringify(original)).toBe(snapshot)
  })
})

/* ---------------- 自动改名 ---------------- */

describe('autoRenameTag', () => {
  it('未占用原样返回', () => {
    expect(autoRenameTag(new Set(['a']), 'b')).toBe('b')
  })
  it('占用则依次加序号', () => {
    expect(autoRenameTag(new Set(['微笑']), '微笑')).toBe('微笑_2')
    expect(autoRenameTag(new Set(['微笑', '微笑_2']), '微笑')).toBe('微笑_3')
  })
})

/* ---------------- 批量上传规划 ---------------- */

const entry = (fileName: string, role = '', outfit = '', tag = ''): UploadEntry => ({
  fileName,
  role,
  outfit,
  tag,
})

describe('planUploads', () => {
  const existing: SpritePack[] = [
    {
      id: 'naruto',
      name: '鸣人',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'u' }],
    },
  ]

  it('匹配已有 人名 包，无人名/服装则落到 batchPackName', () => {
    const plans = planUploads(
      [entry('a.png', '鸣人', '', '生气'), entry('b.png', '', '', '开心')],
      existing,
      'skip',
      '默认包',
    )
    expect(plans[0].targetPackId).toBe('naruto')
    expect(plans[0].action).toBe('add')
    expect(plans[1].targetPackId).toBeNull()
    expect(plans[1].targetPackName).toBe('默认包')
  })

  it('人名+服装自动生成「人名·服装」新包名', () => {
    const plans = planUploads([entry('a.png', '鸣人', '居家服', '微笑')], existing, 'skip', 'D')
    expect(plans[0].targetPackId).toBeNull() // 鸣人无居家服包 → 新建
    expect(plans[0].targetPackName).toBe('鸣人·居家服')
  })

  it('重名策略：跳过', () => {
    const plans = planUploads([entry('a.png', '鸣人', '', '微笑')], existing, 'skip', 'D')
    expect(plans[0].conflict).toBe(true)
    expect(plans[0].action).toBe('skip')
  })

  it('重名策略：覆盖（finalTag 不变）', () => {
    const plans = planUploads([entry('a.png', '鸣人', '', '微笑')], existing, 'overwrite', 'D')
    expect(plans[0].action).toBe('overwrite')
    expect(plans[0].finalTag).toBe('微笑')
  })

  it('重名策略：改名（加序号）', () => {
    const plans = planUploads([entry('a.png', '鸣人', '', '微笑')], existing, 'rename', 'D')
    expect(plans[0].action).toBe('add')
    expect(plans[0].finalTag).toBe('微笑_2')
  })

  it('本批内自相重名也计入（同目标包连续两张同名）', () => {
    const plans = planUploads(
      [entry('a.png', '鸣人', '', '开心'), entry('b.png', '鸣人', '', '开心')],
      existing,
      'rename',
      'D',
    )
    expect(plans[0].finalTag).toBe('开心')
    expect(plans[1].conflict).toBe(true)
    expect(plans[1].finalTag).toBe('开心_2')
  })

  it('同批同「人名/服装」的图归到同一个新包（合成键）', () => {
    const plans = planUploads(
      [entry('a.png', '雏田', '', '微笑'), entry('b.png', '雏田', '', '微笑')],
      existing,
      'rename',
      'D',
    )
    expect(plans[0].targetPackName).toBe('雏田')
    expect(plans[1].targetPackName).toBe('雏田')
    // 第二张与第一张在同一新包内重名 → 改名
    expect(plans[1].finalTag).toBe('微笑_2')
  })
})
