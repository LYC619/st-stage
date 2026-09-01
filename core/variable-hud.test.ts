import { describe, expect, it } from 'vitest'
import {
  clipHudValue,
  countLeafRows,
  flattenVariables,
  formatHudValue,
} from './variable-hud'

describe('formatHudValue', () => {
  it('字符串原样，null/undefined 有稳定文本', () => {
    expect(formatHudValue('好')).toBe('好')
    expect(formatHudValue(null)).toBe('null')
    expect(formatHudValue(undefined)).toBe('')
  })

  it('数字与布尔转文本', () => {
    expect(formatHudValue(0)).toBe('0')
    expect(formatHudValue(false)).toBe('false')
  })

  it('对象与数组压成单行 JSON（悬浮窗不做多行展开）', () => {
    expect(formatHudValue({ a: 1 })).toBe('{"a":1}')
    expect(formatHudValue([1, 2])).toBe('[1,2]')
  })

  it('循环引用不抛错', () => {
    const cyclic: Record<string, unknown> = { a: 1 }
    cyclic.self = cyclic
    expect(() => formatHudValue(cyclic)).not.toThrow()
  })
})

describe('clipHudValue', () => {
  it('折叠空白并按上限截断', () => {
    expect(clipHudValue('  a   b  ')).toBe('a b')
    expect(clipHudValue('x'.repeat(100), 10)).toBe(`${'x'.repeat(9)}…`)
  })

  it('恰好等于上限时不截断', () => {
    expect(clipHudValue('x'.repeat(10), 10)).toBe('x'.repeat(10))
  })
})

describe('flattenVariables', () => {
  it('非对象根返回空行', () => {
    expect(flattenVariables(null)).toEqual([])
    expect(flattenVariables('x')).toEqual([])
    expect(flattenVariables([1, 2])).toEqual([])
  })

  it('扁平变量各成一行，保持键序', () => {
    const rows = flattenVariables({ 好感度: 5, 名字: '丽丽' })
    expect(rows.map((r) => [r.key, r.value])).toEqual([
      ['好感度', '5'],
      ['名字', '丽丽'],
    ])
    expect(rows.every((r) => r.depth === 0)).toBe(true)
  })

  it('嵌套对象产出分组行（value 为 null）加子行', () => {
    const rows = flattenVariables({ 角色: { 好感度: 3 } })
    expect(rows[0]).toMatchObject({ key: '角色', depth: 0, value: null })
    expect(rows[1]).toMatchObject({ key: '好感度', depth: 1, value: '3', path: '角色.好感度' })
  })

  it('MVU 的 [值,"描述"] 二元组识别为叶子并带出描述', () => {
    const rows = flattenVariables({ 好感度: [5, '对你的好感'] })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: '好感度', value: '5', description: '对你的好感' })
  })

  // 二元组第一项是数组时不算二元组（对齐 variable-tree 的保守判据）
  it('第一项为数组时不当二元组', () => {
    const rows = flattenVariables({ x: [[1, 2], '描述'] })
    expect(rows[0].description).toBe('')
    expect(rows[0].value).toBe('[[1,2],"描述"]')
  })

  it('超过 maxDepth 的子树压成一行 JSON', () => {
    const deep = { a: { b: { c: { d: 1 } } } }
    const rows = flattenVariables(deep, 2)
    const leaf = rows.find((r) => r.key === 'c')!
    expect(leaf.value).toBe('{"d":1}')
    expect(rows.some((r) => r.key === 'd')).toBe(false)
  })

  it('空对象作为叶子展示，不产出空分组', () => {
    const rows = flattenVariables({ 空: {} })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ key: '空', value: '{}' })
  })

  it('深度上限默认 3', () => {
    const rows = flattenVariables({ a: { b: { c: { d: { e: 1 } } } } })
    expect(rows.some((r) => r.key === 'd')).toBe(true)
    expect(rows.some((r) => r.key === 'e')).toBe(false)
  })
})

describe('countLeafRows', () => {
  it('只数叶子，不数分组行', () => {
    const rows = flattenVariables({ 角色: { 好感度: 3, 名字: '丽丽' }, 金币: 10 })
    expect(rows).toHaveLength(4) // 角色分组 + 2 叶子 + 金币
    expect(countLeafRows(rows)).toBe(3)
  })
})
