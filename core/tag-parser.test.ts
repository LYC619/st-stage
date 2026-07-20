import { describe, expect, it } from 'vitest'
import { extractTags, replaceTags, stripTags } from './tag-parser'

describe('extractTags', () => {
  it('按顺序提取全部标签，容错全角符号与空格', () => {
    expect(extractTags('你好 [立绘:微笑] 呀【立绘：害羞 】')).toEqual(['微笑', '害羞'])
  })

  it('无标签返回空数组', () => {
    expect(extractTags('普通文本')).toEqual([])
  })
})

describe('stripTags', () => {
  it('移除标签并清理行尾空白', () => {
    expect(stripTags('嗯。 [立绘:微笑]')).toBe('嗯。')
  })
})

describe('replaceTags', () => {
  it('把标签地址交给 replacer 替换（含分组地址）', () => {
    const out = replaceTags('A [立绘:鸣人/微笑] B [立绘:哭泣]', (addr) => `<${addr}>`)
    expect(out).toBe('A <鸣人/微笑> B <哭泣>')
  })

  it('replacer 返回 null 时保持原文', () => {
    const text = '嗯 [立绘:未知表情]'
    expect(replaceTags(text, () => null)).toBe(text)
  })
})
