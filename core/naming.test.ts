import { describe, expect, it } from 'vitest'
import {
  fileNameToTag,
  isValidTag,
  normalizeTag,
  parseSpriteFileName,
  sanitizePackName,
  sanitizePathSegment,
  TAG_MAX_LENGTH,
} from './naming'

describe('normalizeTag', () => {
  it('保留中文/英文/数字与空格', () => {
    expect(normalizeTag('微笑')).toBe('微笑')
    expect(normalizeTag('smile 2')).toBe('smile 2')
  })

  it('剔除标签语法与分享串分隔符', () => {
    expect(normalizeTag('[微笑]')).toBe('微笑')
    expect(normalizeTag('【微笑】')).toBe('微笑')
    expect(normalizeTag('微:笑')).toBe('微笑')
    expect(normalizeTag('微｜笑'.replace('｜', '|'))).toBe('微笑')
    expect(normalizeTag('a=b')).toBe('ab')
    expect(normalizeTag('a,b，c')).toBe('abc')
    expect(normalizeTag('@host')).toBe('host')
  })

  it('剔除 HTML/路径风险字符', () => {
    expect(normalizeTag('<img>')).toBe('img')
    expect(normalizeTag('a/b\\c')).toBe('abc')
    expect(normalizeTag(`"'\``)).toBe('')
  })

  it('压缩空白并截断', () => {
    expect(normalizeTag('  微  笑  ')).toBe('微 笑')
    expect(normalizeTag('啊'.repeat(50))).toHaveLength(TAG_MAX_LENGTH)
  })

  it('剔除控制字符', () => {
    expect(normalizeTag('微\0笑\x1f')).toBe('微笑')
  })
})

describe('isValidTag', () => {
  it('规范 tag 通过，空串与含非法字符的不通过', () => {
    expect(isValidTag('微笑')).toBe(true)
    expect(isValidTag('')).toBe(false)
    expect(isValidTag('[微笑]')).toBe(false)
    expect(isValidTag(' 微笑')).toBe(false)
  })
})

describe('fileNameToTag', () => {
  it('去扩展名并清洗', () => {
    expect(fileNameToTag('微笑.png')).toBe('微笑')
    expect(fileNameToTag('smile.final.webp')).toBe('smile.final')
    expect(fileNameToTag('.png')).toBe('')
  })
})

describe('parseSpriteFileName（八期·多分隔符三级）', () => {
  it('三级：人名/服装/图名，图名保留内部分隔符', () => {
    expect(parseSpriteFileName('鸣人-居家服-开心-闭眼.png')).toEqual({
      role: '鸣人',
      outfit: '居家服',
      tag: '开心-闭眼',
    })
  })
  it('支持下划线/横杠/en dash/em dash/空白各种分隔', () => {
    expect(parseSpriteFileName('鸣人_居家服_微笑.png')).toEqual({ role: '鸣人', outfit: '居家服', tag: '微笑' })
    expect(parseSpriteFileName('鸣人–居家服–微笑.png')).toEqual({ role: '鸣人', outfit: '居家服', tag: '微笑' })
    expect(parseSpriteFileName('鸣人—居家服—微笑.png')).toEqual({ role: '鸣人', outfit: '居家服', tag: '微笑' })
    expect(parseSpriteFileName('鸣人 居家服 微笑.png')).toEqual({ role: '鸣人', outfit: '居家服', tag: '微笑' })
  })
  it('混合分隔符也能拆前两处', () => {
    expect(parseSpriteFileName('鸣人-居家服_开心 闭眼.png')).toEqual({
      role: '鸣人',
      outfit: '居家服',
      tag: '开心 闭眼',
    })
  })
  it('两级：人名/图名', () => {
    expect(parseSpriteFileName('鸣人_微笑.png')).toEqual({ role: '鸣人', outfit: '', tag: '微笑' })
  })
  it('一级：纯图名', () => {
    expect(parseSpriteFileName('微笑.png')).toEqual({ role: '', outfit: '', tag: '微笑' })
  })
  it('连续空白视作单个分隔符', () => {
    expect(parseSpriteFileName('鸣人   微笑.png')).toEqual({ role: '鸣人', outfit: '', tag: '微笑' })
  })
})

describe('sanitizePackName', () => {
  it('剔除分隔符与 HTML 风险字符', () => {
    expect(sanitizePackName('银发萝莉')).toBe('银发萝莉')
    expect(sanitizePackName('a|b=c@d')).toBe('abcd')
    expect(sanitizePackName('<b>x</b>')).toBe('bx/b')
  })

  it('保留 tag 中不允许的冒号与方括号（包名约束更宽）', () => {
    expect(sanitizePackName('包名：测试[1]')).toBe('包名：测试[1]')
  })
})

describe('sanitizePathSegment', () => {
  it('只保留安全路径字符', () => {
    expect(sanitizePathSegment('小雪')).toBe('小雪')
    expect(sanitizePathSegment('a/b\\c')).toBe('abc')
    expect(sanitizePathSegment('日本語カナ')).toBe('日本語カナ')
  })

  it('杜绝路径穿越与非法首尾', () => {
    expect(sanitizePathSegment('../etc/passwd')).toBe('etcpasswd')
    expect(sanitizePathSegment('a..b')).toBe('a.b')
    expect(sanitizePathSegment('name. ')).toBe('name')
  })
})
