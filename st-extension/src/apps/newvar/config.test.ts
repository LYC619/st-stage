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

  it('自定义模板归一化：合法保留、空变量/缺名丢弃', () => {
    const d = normalizeNewvarData({
      customTemplates: [
        {
          id: 'c1',
          name: '我的模板',
          description: 'x',
          variables: [{ key: 'a', type: 'number', default: 1, description: '' }],
        },
        { id: 'c2', name: '空的', description: '', variables: [] },
        { id: '', name: '缺id', variables: [{ key: 'a', type: 'number', default: 1, description: '' }] },
        'garbage',
      ],
    })
    expect(d.customTemplates).toHaveLength(1)
    expect(d.customTemplates[0].name).toBe('我的模板')
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

  it('非有限范围边界不采纳', () => {
    const d = normalizeNewvarData({
      schema: {
        variables: [
          { key: 'a', type: 'number', default: 0, range: [0, Number.POSITIVE_INFINITY] },
          { key: 'b', type: 'number', default: 0, range: [Number.NaN, 100] },
        ],
      },
    })

    expect(d.schema.variables.map((item) => item.range)).toEqual([undefined, undefined])
  })

  it('配置导入会丢弃包含危险路径段的变量和模板定义', () => {
    const d = normalizeNewvarData({
      schema: {
        variables: [
          { key: '状态.体力', type: 'number', default: 100 },
          { key: '.', type: 'string', default: 'x' },
          { key: '状态..心情', type: 'string', default: 'x' },
          { key: '__proto__.污染', type: 'string', default: 'x' },
          { key: '状态.constructor.污染', type: 'string', default: 'x' },
        ],
      },
      customTemplates: [
        {
          id: 'safe-template',
          name: '安全模板',
          variables: [
            { key: '状态.心情', type: 'string', default: '平静' },
            { key: 'prototype.污染', type: 'string', default: 'x' },
          ],
        },
        {
          id: 'unsafe-only',
          name: '仅危险路径',
          variables: [{ key: 'constructor.prototype.污染', type: 'string', default: 'x' }],
        },
      ],
    })

    expect(d.schema.variables.map((item) => item.key)).toEqual(['状态.体力'])
    expect(d.customTemplates).toHaveLength(1)
    expect(d.customTemplates[0].variables.map((item) => item.key)).toEqual(['状态.心情'])
  })
})
