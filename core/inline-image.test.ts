import { describe, expect, it } from 'vitest'
import {
  extractInlineImages,
  hasInlineImageMarkup,
  replaceInlineImages,
} from './inline-image'

describe('extractInlineImages', () => {
  it('HTML 形：img 与 illustration 标记，容忍空白与大小写', () => {
    const text = '看这个 <img>ab12cd.png</img> 和 < Illustration > xy.webp </ illustration >'
    expect(extractInlineImages(text)).toEqual([
      { raw: '<img>ab12cd.png</img>', code: 'ab12cd.png' },
      { raw: '< Illustration > xy.webp </ illustration >', code: 'xy.webp' },
    ])
  })

  it('方括号形：[插图:编码] / [图:编码]，全角容错', () => {
    const text = '场景 [插图:ab12cd.png] 然后【图：xy.webp】'
    expect(extractInlineImages(text)).toEqual([
      { raw: '[插图:ab12cd.png]', code: 'ab12cd.png' },
      { raw: '【图：xy.webp】', code: 'xy.webp' },
    ])
  })

  it('两种语法混排按出现顺序', () => {
    const codes = extractInlineImages('[插图:a.png] 中间 <img>b.png</img>').map((m) => m.code)
    expect(codes).toEqual(['a.png', 'b.png'])
  })

  it('跳过非法编码（路径穿越/斜杠/空）', () => {
    expect(extractInlineImages('<img>../etc/passwd</img>')).toEqual([])
    expect(extractInlineImages('[插图:a/b.png]')).toEqual([])
    expect(extractInlineImages('<img></img>')).toEqual([])
  })

  it('开闭标签必须一致；不匹配带属性的真 HTML img', () => {
    expect(extractInlineImages('<img>a.png</illustration>')).toEqual([])
    expect(extractInlineImages('<img src="x.png">')).toEqual([])
  })

  it('不误伤立绘标签', () => {
    expect(extractInlineImages('[立绘:微笑]')).toEqual([])
  })
})

describe('hasInlineImageMarkup', () => {
  it('检测两种标记', () => {
    expect(hasInlineImageMarkup('前文 <img>a.png</img>')).toBe(true)
    expect(hasInlineImageMarkup('前文 [插图:a.png]')).toBe(true)
    expect(hasInlineImageMarkup('没有标记 [立绘:微笑]')).toBe(false)
  })
})

describe('replaceInlineImages', () => {
  it('按 replacer 替换，null 保持原文', () => {
    const text = 'A [插图:ok.png] B <img>skip.png</img>'
    const out = replaceInlineImages(text, (m) => (m.code === 'ok.png' ? `[图片]` : null))
    expect(out).toBe('A [图片] B <img>skip.png</img>')
  })

  it('非法编码原样保留', () => {
    const text = '<img>../x.png</img> [插图:a/b.png]'
    expect(replaceInlineImages(text, () => '不应出现')).toBe(text)
  })
})
