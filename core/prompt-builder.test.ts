import { describe, expect, it } from 'vitest'
import { buildInjectionPrompt, buildMultiRolePrompt } from './prompt-builder'

describe('buildInjectionPrompt（单角色）', () => {
  it('空 tags 不注入', () => {
    expect(buildInjectionPrompt([])).toBe('')
  })
  it('列出标签', () => {
    expect(buildInjectionPrompt(['微笑', '害羞'])).toContain('微笑、害羞')
  })
})

describe('buildMultiRolePrompt（功能②）', () => {
  const entries = [
    { group: '鸣人', tag: '微笑' },
    { group: '鸣人', tag: '生气' },
    { group: '佐助', tag: '微笑' },
  ]

  it('full：枚举全部 分组/图名 组合', () => {
    const p = buildMultiRolePrompt(entries, 'full')
    expect(p).toContain('鸣人/微笑')
    expect(p).toContain('鸣人/生气')
    expect(p).toContain('佐助/微笑')
  })

  it('repeat：只列分组 + 共享情绪名，不枚举全部组合（省 token）', () => {
    const p = buildMultiRolePrompt(entries, 'repeat')
    expect(p).toContain('鸣人、佐助') // 分组清单
    expect(p).toContain('微笑、生气') // 去重情绪名
    expect(p).not.toContain('佐助/微笑') // 不枚举组合
    expect(p).toContain('[立绘:鸣人/微笑]') // 仍给一个格式示例
  })

  it('无分组时退回单角色 prompt', () => {
    expect(buildMultiRolePrompt([{ group: '', tag: '微笑' }], 'full')).toContain('可用立绘表情：微笑')
  })

  it('空 entries 不注入', () => {
    expect(buildMultiRolePrompt([], 'full')).toBe('')
  })
})
