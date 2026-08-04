import { describe, expect, it } from 'vitest'
import type { BattleRenderBlock, FighterConfig } from './types'
import { createBattleEngine } from './battle-engine'

function fighter(overrides: Partial<FighterConfig> = {}): FighterConfig {
  return {
    id: 'hero',
    name: '旅行者',
    hp: 100,
    maxHp: 100,
    mp: 30,
    maxMp: 50,
    attack: 20,
    defense: 5,
    speed: 12,
    crit: 10,
    dodge: 5,
    skills: [
      { id: 'slash', name: '斩击', type: 'damage', mpCost: 5, power: 25 },
      { id: 'heal', name: '治疗', type: 'heal', mpCost: 8, power: 30 },
    ],
    items: [
      { id: 'potion', name: '药水', effect: 'heal_hp', quantity: 2, power: 25 },
      { id: 'ether', name: '以太', effect: 'heal_mp', quantity: 1, power: 15 },
    ],
    statuses: [],
    ...overrides,
  }
}

function battle(player: Partial<FighterConfig> = {}, enemy: Partial<FighterConfig> = {}): BattleRenderBlock {
  return {
    version: 1,
    mode: 'battle',
    title: '测试战斗',
    player: fighter(player),
    enemy: fighter({ id: 'enemy', name: '守卫', hp: 100, maxHp: 100, attack: 16, defense: 5, ...enemy }),
    allowFlee: true,
  }
}

function sequence(...values: number[]): () => number {
  let index = 0
  return () => values[index++] ?? 0.5
}

describe('createBattleEngine', () => {
  it('普通攻击按闪避、暴击和防御顺序结算，并执行敌方回合', () => {
    const normal = createBattleEngine(battle(), { random: () => 0.5 })
    const result = normal.dispatch({ type: 'attack' })
    expect(result.ok).toBe(true)
    expect(result.state.enemy.hp).toBe(85)
    expect(result.state.player.hp).toBe(89)
    expect(result.events.map((event) => event.kind)).toEqual(['damage', 'damage'])

    const critical = createBattleEngine(battle(), { random: sequence(0.5, 0, 0.5, 0.5) })
    expect(critical.dispatch({ type: 'attack' }).state.enemy.hp).toBe(75)

    const dodged = createBattleEngine(battle({}, { dodge: 100 }), { random: () => 0 })
    expect(dodged.dispatch({ type: 'attack' }).state.enemy.hp).toBe(100)
  })

  it('防御只覆盖紧随其后的敌方回合且重复防御不叠加状态', () => {
    const engine = createBattleEngine(battle(), { random: () => 0.5 })
    const defended = engine.dispatch({ type: 'defend' })
    expect(defended.state.player.hp).toBe(99)
    expect(defended.state.player.statuses.filter((status) => status.id === '__defending')).toHaveLength(0)

    const second = engine.dispatch({ type: 'defend' })
    expect(second.state.player.hp).toBe(98)
    expect(second.state.player.statuses.filter((status) => status.id === '__defending')).toHaveLength(0)
  })

  it('伤害技能扣 MP，治疗技能不超过 maxHp', () => {
    const damage = createBattleEngine(battle(), { random: () => 0.5 })
    const damageResult = damage.dispatch({ type: 'skill', skillId: 'slash' })
    expect(damageResult.state.player.mp).toBe(25)
    expect(damageResult.state.enemy.hp).toBe(80)

    const healing = createBattleEngine(battle({ hp: 80 }), { random: () => 0.5 })
    const healResult = healing.dispatch({ type: 'skill', skillId: 'heal' })
    expect(healResult.state.player.hp).toBe(89)
    expect(healResult.state.player.mp).toBe(22)
    expect(healResult.events[0].text).toContain('恢复 20 点')
  })

  it('物品按效果恢复资源并减少数量', () => {
    const hpEngine = createBattleEngine(battle({ hp: 60 }), { random: () => 0.5 })
    const hp = hpEngine.dispatch({ type: 'item', itemId: 'potion' })
    expect(hp.state.player.hp).toBe(74)
    expect(hp.events[0].text).toContain('恢复 25 点')
    expect(hp.state.player.items.find((item) => item.id === 'potion')?.quantity).toBe(1)

    const mpEngine = createBattleEngine(battle({ mp: 10 }), { random: () => 0.5 })
    const mp = mpEngine.dispatch({ type: 'item', itemId: 'ether' })
    expect(mp.state.player.mp).toBe(25)
    expect(mp.state.player.items.find((item) => item.id === 'ether')?.quantity).toBe(0)
  })

  it('初始状态修正属性、结算持续伤害并按轮到期', () => {
    const engine = createBattleEngine(battle({
      statuses: [{ id: 'focus', name: '专注', duration: 1, attackDelta: 5 }],
    }, {
      statuses: [{ id: 'burn', name: '灼烧', duration: 1, damagePerTurn: 7 }],
    }), { random: () => 0.5 })

    const result = engine.dispatch({ type: 'attack' })

    expect(result.state.enemy.hp).toBe(73)
    expect(result.state.player.statuses).toHaveLength(0)
    expect(result.state.enemy.statuses).toHaveLength(0)
    expect(result.events.some((event) => event.kind === 'status-damage')).toBe(true)
  })

  it('逃跑成功立即结束，失败才执行敌方回合', () => {
    const escaped = createBattleEngine(battle(), { random: () => 0 })
    const success = escaped.dispatch({ type: 'flee' })
    expect(success.state.outcome).toBe('fled')
    expect(success.state.player.hp).toBe(100)

    const failed = createBattleEngine(battle(), { random: sequence(0.99, 0.5, 0.5) })
    const failure = failed.dispatch({ type: 'flee' })
    expect(failure.state.outcome).toBe('ongoing')
    expect(failure.state.player.hp).toBe(89)
  })

  it('任一方归零后立即结束，不再执行多余回合', () => {
    const won = createBattleEngine(battle({}, { hp: 10, maxHp: 10 }), { random: () => 0.5 })
    const result = won.dispatch({ type: 'attack' })
    expect(result.state.outcome).toBe('won')
    expect(result.state.enemy.hp).toBe(0)
    expect(result.state.player.hp).toBe(100)
  })

  it('初始 0 HP 直接判定结束，未知运行时动作被拒绝', () => {
    const alreadyWon = createBattleEngine(battle({}, { hp: 0 }), { random: () => 0.5 })
    expect(alreadyWon.getState().outcome).toBe('won')
    expect(alreadyWon.dispatch({ type: 'attack' })).toMatchObject({ ok: false, error: expect.stringMatching(/结束/) })

    const engine = createBattleEngine(battle(), { random: () => 0.5 })
    const before = engine.getState()
    expect(engine.dispatch({ type: 'unknown' } as never)).toMatchObject({ ok: false, error: expect.stringMatching(/动作/) })
    expect(engine.getState()).toEqual(before)
  })

  it('拒绝不存在、资源不足和战斗结束后的动作且不改变状态', () => {
    const engine = createBattleEngine(battle({ mp: 0 }), { random: () => 0.5 })
    const before = engine.getState()
    expect(engine.dispatch({ type: 'skill', skillId: 'missing' })).toMatchObject({ ok: false, error: expect.stringMatching(/技能/) })
    expect(engine.dispatch({ type: 'skill', skillId: 'slash' })).toMatchObject({ ok: false, error: expect.stringMatching(/MP/) })
    expect(engine.dispatch({ type: 'item', itemId: 'missing' })).toMatchObject({ ok: false, error: expect.stringMatching(/物品/) })
    expect(engine.getState()).toEqual(before)

    const ended = createBattleEngine(battle({}, { hp: 1, maxHp: 1 }), { random: () => 0.5 })
    ended.dispatch({ type: 'attack' })
    expect(ended.dispatch({ type: 'attack' })).toMatchObject({ ok: false, error: expect.stringMatching(/结束/) })
  })

  it('返回深拷贝快照，调用方修改不会污染引擎', () => {
    const config = battle()
    const originalConfig = structuredClone(config)
    const engine = createBattleEngine(config, { random: () => 0.5 })
    const snapshot = engine.getState()
    snapshot.player.hp = 0
    snapshot.player.items[0].quantity = 0
    snapshot.log.push({ kind: 'system', text: '外部修改' })

    const current = engine.getState()
    expect(current.player.hp).toBe(100)
    expect(current.player.items[0].quantity).toBe(2)
    expect(current.log).toEqual([])
    expect(config).toEqual(originalConfig)
  })
})
