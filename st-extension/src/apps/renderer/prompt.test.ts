import { describe, expect, it } from 'vitest'
import { parseRendererBlock } from './parser'
import { defaultRendererSettings, type RendererSettings } from './config'
import { buildRendererPrompt } from './prompt'

function enabledSettings(overrides: Partial<RendererSettings> = {}): RendererSettings {
  return { ...defaultRendererSettings(), enabled: true, ...overrides }
}

describe('buildRendererPrompt', () => {
  it('总开关关闭或所有模式关闭时不注入提示词', () => {
    expect(buildRendererPrompt(defaultRendererSettings())).toBe('')
    expect(buildRendererPrompt(enabledSettings({ galEnabled: false, cardsEnabled: false, battleEnabled: false }))).toBe('')
  })

  it('只列出已启用模式的协议和示例', () => {
    const prompt = buildRendererPrompt(enabledSettings({ galEnabled: false, battleEnabled: false }))

    expect(prompt).toContain('"mode":"cards"')
    expect(prompt).not.toContain('"mode":"gal"')
    expect(prompt).not.toContain('"mode":"battle"')
  })

  it('明确普通回复、单块、无 HTML 及块外叙事回退规则', () => {
    const prompt = buildRendererPrompt(enabledSettings())

    expect(prompt).toMatch(/普通回复.*不需要/)
    expect(prompt).toMatch(/最多.*一个/)
    expect(prompt).toMatch(/禁止.*HTML|不得.*HTML/)
    expect(prompt).toMatch(/代码/)
    expect(prompt).toMatch(/块外.*独立可读/)
  })

  it('每个模式示例都是解析器可接受的独立 JSON 块', () => {
    const prompt = buildRendererPrompt(enabledSettings())
    const examples = [...prompt.matchAll(/<STStageRender>[\s\S]*?<\/STStageRender>/g)].map((match) => match[0])

    expect(examples).toHaveLength(3)
    expect(examples.map((example) => parseRendererBlock(example))).toEqual([
      expect.objectContaining({ ok: true, block: expect.objectContaining({ mode: 'gal' }) }),
      expect.objectContaining({ ok: true, block: expect.objectContaining({ mode: 'cards' }) }),
      expect.objectContaining({ ok: true, block: expect.objectContaining({ mode: 'battle' }) }),
    ])
  })

  it('写明嵌套结构、属性关系和图片协议边界', () => {
    const prompt = buildRendererPrompt(enabledSettings())

    expect(prompt).toMatch(/speaker.*text/)
    expect(prompt).toMatch(/hp.*不得大于.*maxHp/)
    expect(prompt).toMatch(/crit.*dodge.*0-100/)
    expect(prompt).toMatch(/damage.*heal/)
    expect(prompt).toMatch(/heal_hp.*heal_mp/)
    expect(prompt).toMatch(/attackDelta.*defenseDelta.*damagePerTurn/)
    expect(prompt).toMatch(/base64.*栅格/)
    expect(prompt).toMatch(/sprite:地址/)
  })
})
