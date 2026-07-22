import { describe, expect, it } from 'vitest'
import { buildInjectionPrompt, buildMultiRolePrompt, buildPrompt } from './prompt-builder'
import type { SpriteAddress } from './types'

const addr = (role: string, outfit: string, tag: string): SpriteAddress => ({ role, outfit, tag })

describe('buildPrompt — 全量', () => {
  it('空地址不注入', () => {
    expect(buildPrompt([], 'full', 1)).toBe('')
  })

  it('纯图名场景等价旧的图名清单', () => {
    const p = buildPrompt([addr('', '', '微笑'), addr('', '', '害羞')], 'full', 1)
    expect(p).toContain('微笑、害羞')
    expect(p).toContain('[角色立绘系统]')
  })

  it('三级地址枚举完整地址', () => {
    const p = buildPrompt(
      [addr('鸣人', '居家服', '微笑'), addr('鸣人', '', '生气'), addr('佐助', '', '微笑')],
      'full',
      1,
    )
    expect(p).toContain('鸣人/居家服/微笑')
    expect(p).toContain('鸣人/生气')
    expect(p).toContain('佐助/微笑')
  })
})

describe('buildPrompt — 智能精简', () => {
  const entries = [
    addr('鸣人', '', '微笑'),
    addr('鸣人', '', '生气'),
    addr('佐助', '', '微笑'),
  ]

  it('共有图名合并列出，不枚举全部组合', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    expect(p).toContain('鸣人、佐助') // 场景（人名）清单
    expect(p).toContain('微笑') // 共有图名
    expect(p).not.toContain('佐助/微笑') // 共有的不逐条枚举
  })

  it('非共有图名进「其他图片」并写完整地址', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    // 生气 只有鸣人有 → 其他图片，完整地址
    expect(p).toContain('鸣人/生气')
    expect(p).toMatch(/其他图片/)
  })

  it('不生成不存在的组合（佐助没有生气就不出现 佐助/生气）', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    expect(p).not.toContain('佐助/生气')
  })

  it('单场景退化为纯清单', () => {
    const p = buildPrompt([addr('鸣人', '', '微笑'), addr('鸣人', '', '生气')], 'repeat', 1)
    expect(p).toContain('鸣人/微笑')
    expect(p).toContain('鸣人/生气')
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
    expect(p).toContain('鸣人/微笑')
    expect(p).toContain('佐助/微笑')
  })

  it('buildMultiRolePrompt 空不注入', () => {
    expect(buildMultiRolePrompt([], 'full')).toBe('')
  })
})
