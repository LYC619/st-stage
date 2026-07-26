import { describe, it, expect } from 'vitest'
import {
  normalizeUrl,
  sanitizeAppData,
  validateDraft,
  upsertProfile,
  findActiveProfile,
  parseModelList,
  emptyDraft,
  type ApiProfile,
} from './core'

function profile(over: Partial<ApiProfile> = {}): ApiProfile {
  return {
    id: 'p1',
    name: '站点A',
    url: 'https://a.com/v1',
    key: 'sk-a',
    model: 'gpt-x',
    includeBody: '',
    excludeBody: '',
    includeHeaders: '',
    ...over,
  }
}

describe('normalizeUrl', () => {
  it('去首尾空白与尾部斜杠', () => {
    expect(normalizeUrl('  https://a.com/v1///  ')).toBe('https://a.com/v1')
  })
  it('空值安全', () => {
    expect(normalizeUrl('')).toBe('')
    expect(normalizeUrl(undefined as unknown as string)).toBe('')
  })
})

describe('sanitizeAppData', () => {
  it('undefined/非法输入返回空列表', () => {
    expect(sanitizeAppData(undefined).profiles).toEqual([])
    expect(sanitizeAppData({ profiles: 'x' }).profiles).toEqual([])
  })
  it('缺字段补默认值，缺 name/url 的条目丢弃', () => {
    const data = sanitizeAppData({
      profiles: [
        { id: 'a', name: 'A', url: 'https://a.com/' },
        { name: '', url: 'https://b.com' },
        { name: 'C' },
        'junk',
      ],
    })
    expect(data.profiles).toHaveLength(1)
    expect(data.profiles[0]).toMatchObject({
      id: 'a',
      name: 'A',
      url: 'https://a.com',
      key: '',
      model: '',
      includeBody: '',
      excludeBody: '',
      includeHeaders: '',
    })
  })
  it('无 id 的旧条目补发 id', () => {
    const data = sanitizeAppData({ profiles: [{ name: 'A', url: 'https://a.com' }] })
    expect(data.profiles[0].id).toBeTruthy()
  })
})

describe('validateDraft', () => {
  it('名称与 URL 必填，URL 需 http(s) 开头', () => {
    expect(validateDraft({ name: '', url: 'https://a.com' })).toContain('名称')
    expect(validateDraft({ name: 'A', url: '' })).toContain('URL')
    expect(validateDraft({ name: 'A', url: 'ftp://a.com' })).toContain('http')
    expect(validateDraft({ name: 'A', url: 'https://a.com' })).toBeNull()
  })
})

describe('upsertProfile', () => {
  it('新增：清洗 URL 并分配 id', () => {
    const r = upsertProfile([], { ...emptyDraft(), name: ' A ', url: 'https://a.com/' }, null)
    if ('error' in r) throw new Error(r.error)
    expect(r.profiles[0].name).toBe('A')
    expect(r.profiles[0].url).toBe('https://a.com')
    expect(r.profiles[0].id).toBeTruthy()
  })
  it('新增同名冲突', () => {
    const r = upsertProfile([profile()], { ...emptyDraft(), name: '站点A', url: 'https://b.com' }, null)
    expect(r).toHaveProperty('error')
  })
  it('编辑：保留 id、允许保持自身名称', () => {
    const r = upsertProfile([profile()], { ...emptyDraft(), name: '站点A', url: 'https://new.com' }, 'p1')
    if ('error' in r) throw new Error(r.error)
    expect(r.profiles).toHaveLength(1)
    expect(r.profiles[0]).toMatchObject({ id: 'p1', url: 'https://new.com' })
  })
  it('编辑撞了别的站点名', () => {
    const list = [profile(), profile({ id: 'p2', name: '站点B', url: 'https://b.com' })]
    const r = upsertProfile(list, { ...emptyDraft(), name: '站点A', url: 'https://b.com' }, 'p2')
    expect(r).toHaveProperty('error')
  })
  it('编辑的 id 不存在', () => {
    const r = upsertProfile([], { ...emptyDraft(), name: 'A', url: 'https://a.com' }, 'ghost')
    expect(r).toHaveProperty('error')
  })
})

describe('findActiveProfile', () => {
  it('归一化后匹配（尾斜杠不影响）', () => {
    const list = [profile()]
    expect(findActiveProfile(list, 'https://a.com/v1/')).toBe(list[0])
  })
  it('当前 URL 为空不匹配任何站点', () => {
    expect(findActiveProfile([profile()], '')).toBeUndefined()
  })
})

describe('parseModelList', () => {
  it('兼容纯数组 / {data} / {models} 三种形状', () => {
    expect(parseModelList(['b', 'a'])).toEqual(['a', 'b'])
    expect(parseModelList({ data: [{ id: 'm1' }, { model: 'm2' }, { name: 'm3' }] })).toEqual(['m1', 'm2', 'm3'])
    expect(parseModelList({ models: ['x'] })).toEqual(['x'])
  })
  it('去重排序、过滤空元素', () => {
    expect(parseModelList(['b', 'a', 'b', '', { junk: 1 }])).toEqual(['a', 'b'])
  })
  it('空列表与 error 响应抛错', () => {
    expect(() => parseModelList([])).toThrow('模型列表')
    expect(() => parseModelList({ error: true, message: '密钥无效' })).toThrow('密钥无效')
  })
})
