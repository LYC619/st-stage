// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRendererSettings, type RendererSettings } from '../config'
import type { BattleRenderBlock, FighterConfig } from '../types'
import { mountBattleMode } from './battle'

function fighter(overrides: Partial<FighterConfig> = {}): FighterConfig {
  return {
    id: 'hero',
    name: '旅行者',
    hp: 80,
    maxHp: 100,
    mp: 20,
    maxMp: 30,
    attack: 20,
    defense: 5,
    speed: 10,
    crit: 0,
    dodge: 0,
    portrait: '/user/hero.webp',
    skills: [
      { id: 'slash', name: '斩击', type: 'damage', mpCost: 5, power: 25 },
      { id: 'costly', name: '奥义', type: 'damage', mpCost: 99, power: 99 },
    ],
    items: [
      { id: 'potion', name: '药水', effect: 'heal_hp', quantity: 1, power: 20 },
      { id: 'empty', name: '空瓶', effect: 'heal_hp', quantity: 0, power: 1 },
    ],
    statuses: [{ id: 'focus', name: '专注', duration: 2, attackDelta: 2 }],
    ...overrides,
  }
}

function block(enemy: Partial<FighterConfig> = {}): BattleRenderBlock {
  return {
    version: 1,
    mode: 'battle',
    title: '遗迹守卫战',
    background: 'assets/ruins.webp',
    player: fighter(),
    enemy: fighter({ id: 'enemy', name: '遗迹守卫', hp: 70, maxHp: 70, mp: 0, maxMp: 0, attack: 12, portrait: '/user/guard.webp', skills: [], items: [], statuses: [], ...enemy }),
    enemyIntent: '蓄力攻击',
    allowFlee: true,
  }
}

function settings(overrides: Partial<RendererSettings> = {}): RendererSettings {
  return { ...defaultRendererSettings(), enabled: true, reducedMotion: true, ...overrides }
}

function action(root: HTMLElement, name: string): HTMLButtonElement {
  const button = root.querySelector<HTMLButtonElement>(`button[data-action="${name}"]`)
  if (!button) throw new Error(`找不到动作: ${name}`)
  return button
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mountBattleMode', () => {
  it('渲染双方摘要、HP/MP、状态、意图、背景和日志', () => {
    const root = document.createElement('div')
    document.body.append(root)
    mountBattleMode(root, block(), { getSettings: () => settings(), random: () => 0.5 })

    expect(root.querySelector('.st-render-battle-title')?.textContent).toBe('遗迹守卫战')
    expect(root.querySelectorAll('.st-render-combatant')).toHaveLength(2)
    expect(root.querySelectorAll('progress')).toHaveLength(4)
    expect(root.textContent).toContain('80 / 100')
    expect(root.textContent).toContain('专注')
    expect(root.textContent).toContain('蓄力攻击')
    expect(root.querySelector<HTMLImageElement>('.st-render-battle-background')?.src).toContain('/assets/ruins.webp')
    expect(root.querySelectorAll('.st-render-combatant-portrait')).toHaveLength(2)
    expect(root.querySelector('.st-render-battle-log')?.textContent).toMatch(/等待行动/)
  })

  it('复用图库解析 sprite 立绘，并为缺失或破损立绘切换单列摘要', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const value = block()
    value.player.portrait = 'sprite:旅行者/战斗/默认'
    delete value.enemy.portrait
    const resolvePortrait = vi.fn(() => '/user/resolved/hero.webp')
    mountBattleMode(root, value, { getSettings: () => settings(), random: () => 0.5, resolvePortrait })

    expect(resolvePortrait).toHaveBeenCalledWith('旅行者/战斗/默认')
    const player = root.querySelector<HTMLElement>('.st-render-combatant-player')!
    expect(player.querySelector<HTMLImageElement>('img')?.src).toContain('/user/resolved/hero.webp')
    expect(root.querySelector('.st-render-combatant-enemy')?.classList.contains('st-render-combatant-no-portrait')).toBe(true)

    player.querySelector('img')?.dispatchEvent(new Event('error'))
    expect(player.classList.contains('st-render-combatant-no-portrait')).toBe(true)
  })

  it('提供攻击、技能、防御、物品、逃跑和自由行动控件，并禁用不可用选项', () => {
    const root = document.createElement('div')
    document.body.append(root)
    mountBattleMode(root, block(), { getSettings: () => settings(), random: () => 0.5 })

    for (const name of ['attack', 'skill', 'defend', 'item', 'flee', 'free']) expect(action(root, name)).toBeTruthy()
    const skill = root.querySelector<HTMLSelectElement>('.st-render-battle-skill-select')
    const item = root.querySelector<HTMLSelectElement>('.st-render-battle-item-select')
    expect(skill?.querySelector<HTMLOptionElement>('option[value="costly"]')?.disabled).toBe(true)
    expect(item?.querySelector<HTMLOptionElement>('option[value="empty"]')?.disabled).toBe(true)
  })

  it('攻击、技能、防御和物品会更新数值、资源、回合与日志', () => {
    const root = document.createElement('div')
    document.body.append(root)
    mountBattleMode(root, block(), { getSettings: () => settings(), random: () => 0.5 })

    action(root, 'attack').click()
    expect(root.textContent).toContain('回合 2')
    expect(root.querySelector('.st-render-battle-log')?.textContent).toContain('造成')

    const skill = root.querySelector<HTMLSelectElement>('.st-render-battle-skill-select')!
    skill.value = 'slash'
    action(root, 'skill').click()
    expect(root.textContent).toContain('15 / 30')

    action(root, 'defend').click()
    const item = root.querySelector<HTMLSelectElement>('.st-render-battle-item-select')!
    item.value = 'potion'
    action(root, 'item').click()
    expect(root.querySelector('.st-render-battle-log')?.textContent).toContain('药水')
  })

  it('结束状态会禁用战斗动作并显示结果', () => {
    const root = document.createElement('div')
    document.body.append(root)
    mountBattleMode(root, block({ hp: 10, maxHp: 10 }), { getSettings: () => settings(), random: () => 0.5 })

    action(root, 'attack').click()

    expect(root.querySelector('.st-render-battle-outcome')?.textContent).toMatch(/胜利/)
    expect(Array.from(root.querySelectorAll<HTMLButtonElement>('.st-render-battle-actions button')).every((button) => button.disabled)).toBe(true)
    expect(Array.from(root.querySelectorAll<HTMLSelectElement>('.st-render-battle-actions select')).every((select) => select.disabled)).toBe(true)
  })

  it('非减少动态模式在过渡期间锁定并序列化连点动作', () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    document.body.append(root)
    mountBattleMode(root, block(), { getSettings: () => settings({ reducedMotion: false }), random: () => 0.5 })

    action(root, 'attack').click()
    action(root, 'attack').click()
    expect(action(root, 'attack').disabled).toBe(true)
    expect(Array.from(root.querySelectorAll<HTMLSelectElement>('.st-render-battle-actions select')).every((select) => select.disabled)).toBe(true)
    expect(root.querySelector('.st-render-battle-free-input')).toBeNull()
    expect(root.textContent).toContain('回合 1')
    vi.advanceTimersByTime(200)

    expect(root.textContent).toContain('回合 2')
  })

  it('自由行动只插入结构化可读草稿，不调用本地引擎', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const insertDraft = vi.fn(() => ({ ok: true as const }))
    mountBattleMode(root, block(), { getSettings: () => settings(), random: () => 0.5, insertDraft })

    action(root, 'free').click()
    const input = root.querySelector<HTMLInputElement>('.st-render-battle-free-input')!
    input.value = '尝试说服守卫停手'
    action(root, 'free-submit').click()

    expect(insertDraft).toHaveBeenCalledWith('战斗行动：尝试说服守卫停手')
    expect(root.textContent).toContain('已填入自由行动')
    expect(root.textContent).toContain('回合 1')
  })

  it('自由行动拒绝空输入并显示草稿写入失败原因', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const insertDraft = vi.fn(() => ({ ok: false as const, error: '输入框被占用' }))
    mountBattleMode(root, block(), { getSettings: () => settings(), random: () => 0.5, insertDraft })

    action(root, 'free').click()
    action(root, 'free-submit').click()
    expect(insertDraft).not.toHaveBeenCalled()
    expect(root.textContent).toContain('请输入自由行动')

    const input = root.querySelector<HTMLInputElement>('.st-render-battle-free-input')!
    input.value = '绕到守卫身后'
    action(root, 'free-submit').click()
    expect(insertDraft).toHaveBeenCalledWith('战斗行动：绕到守卫身后')
    expect(root.textContent).toContain('输入框被占用')
    expect(root.textContent).toContain('回合 1')
  })

  it('destroy 清理事件和待执行过渡', () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    document.body.append(root)
    const remove = vi.spyOn(root, 'removeEventListener')
    const mount = mountBattleMode(root, block(), { getSettings: () => settings({ reducedMotion: false }), random: () => 0.5 })
    action(root, 'attack').click()
    mount.destroy()
    vi.runAllTimers()

    expect(remove).toHaveBeenCalledWith('click', expect.any(Function))
    expect(root.textContent).toContain('回合 1')
  })
})
