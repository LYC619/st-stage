import { describe, expect, it } from 'vitest'
import {
  buildInjectionPrompt,
  buildMultiRolePrompt,
  buildPrompt,
  chooseShorterPrompt,
} from './prompt-builder'
import type { SpriteAddress } from './types'

const addr = (role: string, outfit: string, tag: string): SpriteAddress => ({ role, outfit, tag })

describe('buildPrompt — 全量', () => {
  it('空地址不注入', () => {
    expect(buildPrompt([], 'full', 1)).toBe('')
  })

  it('纯图名场景按默认场景分组', () => {
    const p = buildPrompt([addr('', '', '微笑'), addr('', '', '害羞')], 'full', 1)
    expect(p).toContain('- 默认：微笑、害羞')
    expect(p).toContain('[角色立绘系统]')
  })

  it('按 role/outfit 场景分组，空 outfit 与具体 outfit 分行', () => {
    const p = buildPrompt(
      [addr('鸣人', '居家服', '微笑'), addr('鸣人', '', '生气'), addr('佐助', '', '微笑')],
      'full',
      1,
    )
    expect(p).toContain('- 鸣人/居家服：微笑')
    expect(p).toContain('- 鸣人：生气')
    expect(p).toContain('- 佐助：微笑')
    expect(p).toContain('两段地址表示无服装')
  })
})

describe('buildPrompt — 智能精简', () => {
  const shared = Array.from({ length: 12 }, (_, index) => `共有_${index.toString().padStart(2, '0')}`)
  const entries = ['鸣人', '佐助', '小樱'].flatMap((role) =>
    shared.map((tag) => addr(role, '', tag)),
  )
  entries.push(addr('鸣人', '', '联名'), addr('佐助', '', '联名'), addr('小樱', '', '治愈'))

  it('共有表情只列一次，并明确适用于全部场景', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    expect(p).toContain('共有表情（适用于全部场景）')
    expect(p).toContain('可用场景：鸣人、佐助、小樱')
    expect(p.match(/共有_00/g)).toHaveLength(1)
  })

  it('非共有项按各场景其余表情列出，不误称专属', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    expect(p).toContain('各场景其余表情')
    expect(p).not.toContain('专属')
    expect(p).toMatch(/- 鸣人：联名/)
    expect(p).toMatch(/- 佐助：联名/)
    expect(p).toMatch(/- 小樱：治愈/)
  })

  it('交集为空或共享格式不更短时使用分组精确格式', () => {
    const p = buildPrompt([addr('鸣人', '', '微笑'), addr('佐助', '', '冷漠')], 'repeat', 1)
    expect(p).toContain('可用立绘（按场景）')
    expect(p).not.toContain('共有表情（适用于全部场景）')
  })

  it('长度相同选择分组精确格式', () => {
    expect(chooseShorterPrompt('分组', '共享')).toBe('分组')
    expect(chooseShorterPrompt('分组更长', '短')).toBe('短')
  })
})

describe('大包 Prompt 压缩', () => {
  it('50 角色 × 20 共同表情可逆压缩，不重复逐图身份', () => {
    const roles = Array.from({ length: 50 }, (_, index) => `角色_${index.toString().padStart(2, '0')}`)
    const tags = Array.from({ length: 20 }, (_, index) => `表情_${index.toString().padStart(2, '0')}`)
    const addresses = roles.flatMap((role) => tags.map((tag) => addr(role, '', tag)))
    const prompt = buildPrompt(addresses, 'repeat', 1)
    const naive = addresses.map((address) => `${address.role}/${address.tag}`).join('、')

    expect(addresses).toHaveLength(1000)
    expect(prompt.length).toBeLessThan(naive.length / 3)
    expect(prompt).not.toMatch(/@p=|@r=/)
    for (const role of roles) expect(prompt).toContain(role)
    for (const tag of tags) expect(prompt.match(new RegExp(tag, 'g'))).toHaveLength(1)
  })
})

describe('buildPrompt — N 张立绘', () => {
  it('N=1 用单标签语义', () => {
    const p = buildPrompt([addr('', '', '微笑')], 'full', 1)
    expect(p).toContain('选择一个')
    expect(p).not.toMatch(/依次输出/)
  })

  it('N>1 要求按情节顺序输出 N 个标签', () => {
    const p = buildPrompt([addr('', '', '微笑'), addr('', '', '害羞')], 'full', 3)
    expect(p).toContain('3 张立绘')
    expect(p).toContain('依次输出 3 个')
  })

  it('N 非法回退 1', () => {
    const p = buildPrompt([addr('', '', '微笑')], 'full', 0)
    expect(p).toContain('选择一个')
  })
})

describe('向后兼容旧签名', () => {
  it('buildInjectionPrompt 空/列表', () => {
    expect(buildInjectionPrompt([])).toBe('')
    expect(buildInjectionPrompt(['微笑', '害羞'])).toContain('微笑、害羞')
  })

  it('buildMultiRolePrompt full 枚举地址', () => {
    const p = buildMultiRolePrompt(
      [
        { group: '鸣人', tag: '微笑' },
        { group: '佐助', tag: '微笑' },
      ],
      'full',
    )
    expect(p).toContain('- 鸣人：微笑')
    expect(p).toContain('- 佐助：微笑')
  })

  it('buildMultiRolePrompt 空不注入', () => {
    expect(buildMultiRolePrompt([], 'full')).toBe('')
  })
})
