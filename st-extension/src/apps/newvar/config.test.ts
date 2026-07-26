import { describe, it, expect } from 'vitest'
import { normalizeNewvarData, defaultNewvarData } from './config'

describe('normalizeNewvarData', () => {
  it('空/损坏输入回默认值', () => {
    expect(normalizeNewvarData(undefined)).toEqual(defaultNewvarData())
    expect(normalizeNewvarData('garbage')).toEqual(defaultNewvarData())
    expect(normalizeNewvarData({ enabled: 'yes', format: 'xml' })).toEqual(defaultNewvarData())
  })

  it('合法字段保留', () => {
    const d = normalizeNewvarData({
      enabled: true,
      format: 'lodash_set',
      injectionDepth: 7,
      schema: {
        id: 's1',
        name: '恋爱',
        version: 2,
        variables: [
          { key: '好感度', type: 'number', default: 5, description: 'x', range: [0, 100] },
          { key: '心情', type: 'enum', default: '平静', description: '', enum: ['开心', '平静'] },
        ],
      },
    })
    expect(d.enabled).toBe(true)
    expect(d.format).toBe('lodash_set')
    expect(d.injectionDepth).toBe(7)
    expect(d.schema.variables).toHaveLength(2)
    expect(d.schema.variables[0].range).toEqual([0, 100])
  })

  it('非法定义被清洗：空 key 丢弃、坏类型回 string、默认值按类型兜底并按范围修正', () => {
    const d = normalizeNewvarData({
      schema: {
        id: 's',
        name: 's',
        version: 1,
        variables: [
          { key: '', type: 'number', default: 1, description: '' },
          { key: 'a', type: 'weird', default: 3, description: '' },
          { key: 'b', type: 'number', default: 999, description: '', range: [0, 100] },
          { key: 'c', type: 'enum', default: 'x', description: '', enum: [] },
          { key: 'd', type: 'enum', default: '不在', description: '', enum: ['甲', '乙'] },
        ],
      },
    })
    const keys = d.schema.variables.map((v) => v.key)
    expect(keys).toEqual(['a', 'b', 'd']) // 空 key 与空枚举被丢弃
    expect(d.schema.variables[0].type).toBe('string')
    expect(d.schema.variables[1].default).toBe(100) // clip 到范围
    expect(d.schema.variables[2].default).toBe('甲') // 枚举外默认值回第一项
  })

  it('倒序范围（min>max）不采纳', () => {
    const d = normalizeNewvarData({
      schema: {
        id: 's',
        name: 's',
        version: 1,
        variables: [{ key: 'a', type: 'number', default: 0, description: '', range: [100, 0] }],
      },
    })
    expect(d.schema.variables[0].range).toBeUndefined()
  })
})
