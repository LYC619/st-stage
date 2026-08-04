import { describe, expect, it } from 'vitest'
import { parseLegacySetCalls } from './legacy-set-parser'

describe('parseLegacySetCalls', () => {
  it('精确解析字符串中的 URL、逗号、括号和转义引号', () => {
    const source = [
      "_.set('状态.网址', 'https://example.test/a//b', 'https://next.test/a,b')",
      '_.set("状态.说明", "旧值,含逗号", "新值)含括号")',
      "_.set('状态.引号', 'old', '他说\\'你好\\'') // escaped quote",
    ].join('\n')

    expect(parseLegacySetCalls(source)).toEqual({
      calls: [
        {
          path: '状态.网址',
          oldValue: 'https://example.test/a//b',
          newValue: 'https://next.test/a,b',
        },
        { path: '状态.说明', oldValue: '旧值,含逗号', newValue: '新值)含括号' },
        { path: '状态.引号', oldValue: 'old', newValue: "他说'你好'" },
      ],
      errors: [],
    })
  })

  it('解析 JSON 风格的数字、布尔和 null，支持同一行多条调用', () => {
    const source = "_.set('状态.体力', 10, 12.5); _.set('状态.在场', false, true); _.set('状态.备注', null, '有')"

    expect(parseLegacySetCalls(source)).toEqual({
      calls: [
        { path: '状态.体力', oldValue: 10, newValue: 12.5 },
        { path: '状态.在场', oldValue: false, newValue: true },
        { path: '状态.备注', oldValue: null, newValue: '有' },
      ],
      errors: [],
    })
  })

  it.each([
    ["_.set('状态.说明', 'old', 'new)", '未闭合引号'],
    ["_.set('状态.说明', 'old', 'new') alert(1)", '尾随内容'],
    ["_.set('状态.说明', 'new')", '参数不足'],
    ["_.set('状态.说明', 'old', getValue())", '可执行表达式'],
    ["_.set('__proto__.polluted', 'old', 'new')", '危险路径'],
  ])('拒绝%s（%s）', (source) => {
    const result = parseLegacySetCalls(source)

    expect(result.calls).toEqual([])
    expect(result.errors).not.toEqual([])
  })
})
