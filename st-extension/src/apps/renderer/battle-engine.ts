import type { BattleRenderBlock, FighterConfig, ItemConfig, SkillConfig, StatusConfig } from './types'

export type BattleOutcome = 'ongoing' | 'won' | 'lost' | 'fled'

export type BattleEventKind = 'damage' | 'heal' | 'dodge' | 'defend' | 'status-damage' | 'flee' | 'system'

export interface BattleLogEntry {
  kind: BattleEventKind
  text: string
}

export interface BattleFighterState extends Omit<FighterConfig, 'skills' | 'items' | 'statuses'> {
  skills: SkillConfig[]
  items: ItemConfig[]
  statuses: StatusConfig[]
}

export interface BattleState {
  title: string
  player: BattleFighterState
  enemy: BattleFighterState
  turn: number
  outcome: BattleOutcome
  log: BattleLogEntry[]
  allowFlee: boolean
}

export type BattleAction =
  | { type: 'attack' }
  | { type: 'defend' }
  | { type: 'skill'; skillId: string }
  | { type: 'item'; itemId: string }
  | { type: 'flee' }

export interface BattleDispatchResult {
  ok: boolean
  error?: string
  state: BattleState
  events: BattleLogEntry[]
}

export interface BattleEngine {
  getState(): BattleState
  dispatch(action: BattleAction): BattleDispatchResult
}

export interface BattleEngineDeps {
  random?: () => number
}

const DEFENDING_STATUS_ID = '__defending'

/** 把战斗数值限制在安全整数范围。 */
function bounded(value: number, min = 0, max = 9999): number {
  if (!Number.isFinite(value)) return min
  return Math.min(max, Math.max(min, Math.round(value)))
}

/** 深拷贝角色状态，隔离配置、内部状态和调用方快照。 */
function cloneFighter(fighter: BattleFighterState): BattleFighterState {
  return {
    ...fighter,
    skills: fighter.skills.map((skill) => ({ ...skill })),
    items: fighter.items.map((item) => ({ ...item })),
    statuses: fighter.statuses.map((status) => ({ ...status })),
  }
}

/** 深拷贝完整战斗状态。 */
function cloneState(state: BattleState): BattleState {
  return {
    ...state,
    player: cloneFighter(state.player),
    enemy: cloneFighter(state.enemy),
    log: state.log.map((entry) => ({ ...entry })),
  }
}

/** 把协议角色补齐为引擎内部数组完整的可变状态。 */
function createFighter(config: FighterConfig): BattleFighterState {
  return {
    ...config,
    hp: bounded(config.hp, 0, config.maxHp),
    mp: bounded(config.mp, 0, config.maxMp),
    skills: (config.skills ?? []).map((skill) => ({ ...skill })),
    items: (config.items ?? []).map((item) => ({ ...item })),
    statuses: (config.statuses ?? []).map((status) => ({ ...status })),
  }
}

/** 计算状态修正后的攻击或防御属性。 */
function effectiveStat(fighter: BattleFighterState, stat: 'attack' | 'defense'): number {
  const field = stat === 'attack' ? 'attackDelta' : 'defenseDelta'
  const delta = fighter.statuses.reduce((sum, status) => sum + (status[field] ?? 0), 0)
  return bounded(fighter[stat] + delta)
}

/** 以稳定 ID 替换状态，避免同一效果叠加出多个副本。 */
function upsertStatus(fighter: BattleFighterState, status: StatusConfig): void {
  const index = fighter.statuses.findIndex((item) => item.id === status.id)
  if (index >= 0) fighter.statuses[index] = { ...status }
  else fighter.statuses.push({ ...status })
}

/** 创建带边界和异常兜底的随机数读取器。 */
function createRandom(source: () => number): () => number {
  return () => {
    try {
      const value = source()
      return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0.5
    } catch {
      return 0.5
    }
  }
}

/** 创建纯状态转换战斗引擎；唯一外部输入是可注入 RNG。 */
export function createBattleEngine(config: BattleRenderBlock, deps: BattleEngineDeps = {}): BattleEngine {
  const random = createRandom(deps.random ?? Math.random)
  const player = createFighter(config.player)
  const enemy = createFighter(config.enemy)
  const state: BattleState = {
    title: config.title,
    player,
    enemy,
    turn: 1,
    outcome: enemy.hp <= 0 ? 'won' : player.hp <= 0 ? 'lost' : 'ongoing',
    log: [],
    allowFlee: config.allowFlee === true,
  }

  /** 记录本次动作和全局日志。 */
  function record(events: BattleLogEntry[], kind: BattleEventKind, text: string): void {
    const entry = { kind, text }
    events.push(entry)
    state.log.push({ ...entry })
  }

  /** 结算一次可闪避、可暴击的伤害。 */
  function dealDamage(
    attacker: BattleFighterState,
    target: BattleFighterState,
    power: number,
    events: BattleLogEntry[],
    allowCritical = true,
  ): void {
    if (random() * 100 < target.dodge) {
      record(events, 'dodge', `${target.name} 闪避了 ${attacker.name} 的攻击。`)
      return
    }
    const critical = allowCritical && random() * 100 < attacker.crit
    const raw = critical ? Math.floor(power * 1.5) : power
    const damage = Math.max(1, bounded(raw - effectiveStat(target, 'defense')))
    target.hp = bounded(target.hp - damage, 0, target.maxHp)
    record(events, 'damage', `${attacker.name}${critical ? '暴击' : ''}对 ${target.name} 造成 ${damage} 点伤害。`)
  }

  /** 根据生命值同步胜负状态。 */
  function updateOutcome(): void {
    if (state.enemy.hp <= 0) state.outcome = 'won'
    else if (state.player.hp <= 0) state.outcome = 'lost'
  }

  /** 结算一个角色的持续伤害并递减状态持续回合。 */
  function tickStatuses(fighter: BattleFighterState, events: BattleLogEntry[]): void {
    const next: StatusConfig[] = []
    for (const status of fighter.statuses) {
      if ((status.damagePerTurn ?? 0) > 0 && fighter.hp > 0) {
        const damage = bounded(status.damagePerTurn ?? 0)
        fighter.hp = bounded(fighter.hp - damage, 0, fighter.maxHp)
        record(events, 'status-damage', `${fighter.name} 受到 ${status.name} 的 ${damage} 点伤害。`)
      }
      const duration = status.duration - 1
      if (duration > 0) next.push({ ...status, duration })
    }
    fighter.statuses = next
  }

  /** 敌方固定执行基础攻击，保持本地结果可预测。 */
  function runEnemyTurn(events: BattleLogEntry[]): void {
    if (state.outcome !== 'ongoing') return
    dealDamage(state.enemy, state.player, effectiveStat(state.enemy, 'attack'), events)
    updateOutcome()
  }

  /** 回合末结算状态并进入下一玩家回合。 */
  function finishRound(events: BattleLogEntry[]): void {
    tickStatuses(state.player, events)
    tickStatuses(state.enemy, events)
    updateOutcome()
    state.turn += 1
  }

  /** 返回失败结果，不改变任何内部状态。 */
  function reject(error: string): BattleDispatchResult {
    return { ok: false, error, state: cloneState(state), events: [] }
  }

  /** 执行玩家动作和至多一次敌方回合。 */
  function dispatch(action: BattleAction): BattleDispatchResult {
    if (state.outcome !== 'ongoing') return reject('战斗已经结束。')
    const actionType = (action as { type?: unknown } | null)?.type
    if (!['attack', 'defend', 'skill', 'item', 'flee'].includes(String(actionType))) {
      return reject('不支持的战斗动作。')
    }

    let validationError: string | null = null
    let skill: SkillConfig | undefined
    let item: ItemConfig | undefined
    if (action.type === 'skill') {
      skill = state.player.skills.find((candidate) => candidate.id === action.skillId)
      if (!skill) validationError = '找不到该技能。'
      else if (state.player.mp < skill.mpCost) validationError = 'MP 不足。'
    } else if (action.type === 'item') {
      item = state.player.items.find((candidate) => candidate.id === action.itemId)
      if (!item) validationError = '找不到该物品。'
      else if (item.quantity <= 0) validationError = '该物品已经用完。'
    } else if (action.type === 'flee' && !state.allowFlee) {
      validationError = '本场战斗不能逃跑。'
    }
    if (validationError) return reject(validationError)

    const events: BattleLogEntry[] = []
    if (action.type === 'attack') {
      dealDamage(state.player, state.enemy, effectiveStat(state.player, 'attack'), events)
    } else if (action.type === 'defend') {
      upsertStatus(state.player, {
        id: DEFENDING_STATUS_ID,
        name: '防御',
        duration: 1,
        defenseDelta: Math.max(10, effectiveStat(state.player, 'defense')),
      })
      record(events, 'defend', `${state.player.name} 进入防御姿态。`)
    } else if (action.type === 'skill' && skill) {
      state.player.mp = bounded(state.player.mp - skill.mpCost, 0, state.player.maxMp)
      if (skill.type === 'damage') dealDamage(state.player, state.enemy, skill.power, events)
      else {
        const before = state.player.hp
        state.player.hp = bounded(state.player.hp + skill.power, 0, state.player.maxHp)
        record(events, 'heal', `${state.player.name} 恢复 ${state.player.hp - before} 点生命。`)
      }
    } else if (action.type === 'item' && item) {
      item.quantity -= 1
      const field = item.effect === 'heal_hp' ? 'hp' : 'mp'
      const maxField = item.effect === 'heal_hp' ? 'maxHp' : 'maxMp'
      const before = state.player[field]
      state.player[field] = bounded(before + item.power, 0, state.player[maxField])
      record(events, 'heal', `${state.player.name} 使用 ${item.name}，恢复 ${state.player[field] - before} 点资源。`)
    } else if (action.type === 'flee') {
      if (random() < 0.5) {
        state.outcome = 'fled'
        record(events, 'flee', `${state.player.name} 成功脱离战斗。`)
        return { ok: true, state: cloneState(state), events: events.map((event) => ({ ...event })) }
      }
      record(events, 'flee', `${state.player.name} 逃跑失败。`)
    }

    updateOutcome()
    if (state.outcome === 'ongoing') runEnemyTurn(events)
    if (state.outcome === 'ongoing') finishRound(events)
    return { ok: true, state: cloneState(state), events: events.map((event) => ({ ...event })) }
  }

  return {
    getState: () => cloneState(state),
    dispatch,
  }
}
