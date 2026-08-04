import { createBattleEngine, type BattleAction, type BattleFighterState, type BattleState } from '../battle-engine'
import type { RendererModeDeps, RendererMount } from '../runtime'
import type { BattleRenderBlock } from '../types'

const ACTION_DELAY_MS = 180

/** 创建只写 textContent 的元素。 */
function textElement(tag: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

/** 创建舞台图片；加载失败时隐藏。 */
function imageElement(className: string, src: string, alt: string, onError?: () => void): HTMLImageElement {
  const image = document.createElement('img')
  image.className = className
  image.src = src
  image.alt = alt
  image.draggable = false
  image.addEventListener('error', () => {
    image.hidden = true
    onError?.()
  })
  return image
}

/** 解析普通 portrait URL 或图库 sprite 地址。 */
function resolvePortrait(value: string | undefined, deps: RendererModeDeps): string | null {
  if (!value) return null
  if (!value.startsWith('sprite:')) return value
  try {
    return deps.resolvePortrait?.(value.slice('sprite:'.length)) ?? null
  } catch {
    return null
  }
}

/** 创建 HP/MP 原生进度条与数值标签。 */
function resourceRow(label: string, value: number, max: number, className: string): HTMLElement {
  const row = document.createElement('div')
  row.className = `st-render-resource ${className}`
  const heading = textElement('span', 'st-render-resource-label', label)
  const progress = document.createElement('progress')
  progress.max = Math.max(1, max)
  progress.value = value
  progress.setAttribute('aria-label', `${label} ${value} / ${max}`)
  const amount = textElement('span', 'st-render-resource-value', `${value} / ${max}`)
  row.append(heading, progress, amount)
  return row
}

/** 创建一方战斗摘要。 */
function combatantView(fighter: BattleFighterState, side: 'player' | 'enemy', deps: RendererModeDeps): HTMLElement {
  const card = document.createElement('section')
  card.className = `st-render-combatant st-render-combatant-${side}`
  const heading = textElement('h3', 'st-render-combatant-name', fighter.name)
  const portrait = resolvePortrait(fighter.portrait, deps)
  if (portrait) {
    card.append(imageElement('st-render-combatant-portrait', portrait, fighter.name, () => {
      card.classList.add('st-render-combatant-no-portrait')
    }))
  } else {
    card.classList.add('st-render-combatant-no-portrait')
  }
  card.append(
    heading,
    resourceRow('HP', fighter.hp, fighter.maxHp, 'st-render-resource-hp'),
    resourceRow('MP', fighter.mp, fighter.maxMp, 'st-render-resource-mp'),
  )
  const statuses = document.createElement('div')
  statuses.className = 'st-render-combatant-statuses'
  statuses.setAttribute('aria-label', '状态')
  for (const status of fighter.statuses) {
    statuses.append(textElement('span', 'st-render-status-chip', `${status.name} · ${status.duration}`))
  }
  card.append(statuses)
  return card
}

/** 创建带动作标识的按钮。 */
function actionButton(action: string, label: string, disabled: boolean): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'st-render-battle-action'
  button.dataset.action = action
  button.textContent = label
  button.disabled = disabled
  return button
}

/** 挂载战斗界面并编排确定性引擎动作。 */
export function mountBattleMode(root: HTMLElement, block: BattleRenderBlock, deps: RendererModeDeps): RendererMount {
  const engine = createBattleEngine(block, { random: deps.random })
  const section = document.createElement('section')
  section.className = 'st-render-battle'
  if (block.background) section.append(imageElement('st-render-battle-background', block.background, ''))
  const content = document.createElement('div')
  content.className = 'st-render-battle-content'
  const header = document.createElement('header')
  header.className = 'st-render-battle-header'
  const title = textElement('h2', 'st-render-battle-title', block.title)
  const turn = textElement('span', 'st-render-battle-turn', '')
  header.append(title, turn)
  const intent = textElement('div', 'st-render-battle-intent', block.enemyIntent ? `敌方意图：${block.enemyIntent}` : '')
  const combatants = document.createElement('div')
  combatants.className = 'st-render-battle-combatants'
  const outcome = textElement('div', 'st-render-battle-outcome', '')
  outcome.setAttribute('role', 'status')
  const log = document.createElement('ol')
  log.className = 'st-render-battle-log'
  log.setAttribute('aria-label', '战斗日志')
  const actions = document.createElement('div')
  actions.className = 'st-render-battle-actions'
  const notice = textElement('div', 'st-render-battle-notice', '')
  notice.setAttribute('role', 'status')
  notice.setAttribute('aria-live', 'polite')
  content.append(header, intent, combatants, outcome, log, actions, notice)
  section.append(content)
  root.replaceChildren(section)

  let pending = false
  let destroyed = false
  let freeOpen = false
  let timer: ReturnType<typeof setTimeout> | null = null

  /** 返回战斗结束文案。 */
  function outcomeText(state: BattleState): string {
    if (state.outcome === 'won') return '战斗胜利'
    if (state.outcome === 'lost') return '战斗失败'
    if (state.outcome === 'fled') return '已脱离战斗'
    return ''
  }

  /** 把最近战斗日志压缩为可编辑的剧情续写草稿。 */
  function continuationText(state: BattleState): string {
    const summary = state.log.slice(-6).map((entry) => entry.text).join(' ')
    return `战斗结果：${outcomeText(state)}。战斗摘要：${summary || '战斗已结束。'}`
  }

  /** 创建技能或物品下拉框。 */
  function createSelect(
    className: string,
    options: Array<{ id: string; label: string; disabled: boolean }>,
    disabled: boolean,
  ): HTMLSelectElement {
    const select = document.createElement('select')
    select.className = className
    select.disabled = disabled
    for (const option of options) {
      const element = document.createElement('option')
      element.value = option.id
      element.textContent = option.label
      element.disabled = option.disabled
      select.append(element)
    }
    const firstAvailable = options.find((option) => !option.disabled)
    if (firstAvailable) select.value = firstAvailable.id
    return select
  }

  /** 根据最新快照重建数值、日志和动作可用性。 */
  function render(): void {
    const state = engine.getState()
    const ended = state.outcome !== 'ongoing'
    turn.textContent = `回合 ${state.turn}`
    combatants.replaceChildren(
      combatantView(state.player, 'player', deps),
      combatantView(state.enemy, 'enemy', deps),
    )
    outcome.replaceChildren()
    if (ended) {
      outcome.append(
        textElement('span', 'st-render-battle-outcome-text', outcomeText(state)),
        actionButton('continue', '继续剧情', false),
      )
    }
    outcome.hidden = !ended

    log.replaceChildren()
    if (state.log.length === 0) log.append(textElement('li', 'st-render-battle-log-entry', '等待行动'))
    else {
      for (const entry of state.log.slice(-12)) log.append(textElement('li', `st-render-battle-log-entry st-render-battle-log-${entry.kind}`, entry.text))
    }

    actions.replaceChildren()
    const locked = ended || pending
    const attack = actionButton('attack', '⚔ 攻击', locked)
    const defend = actionButton('defend', '◆ 防御', locked)
    const skillOptions = state.player.skills.map((skill) => ({
      id: skill.id,
      label: `${skill.name} · ${skill.mpCost} MP`,
      disabled: state.player.mp < skill.mpCost,
    }))
    const skillSelect = createSelect('st-render-battle-skill-select', skillOptions, locked || skillOptions.length === 0)
    const skill = actionButton('skill', '✦ 施放技能', locked || !skillOptions.some((option) => !option.disabled))
    const itemOptions = state.player.items.map((item) => ({
      id: item.id,
      label: `${item.name} · ${item.quantity}`,
      disabled: item.quantity <= 0,
    }))
    const itemSelect = createSelect('st-render-battle-item-select', itemOptions, locked || itemOptions.length === 0)
    const item = actionButton('item', '＋ 使用物品', locked || !itemOptions.some((option) => !option.disabled))
    const flee = actionButton('flee', '↗ 逃跑', locked || !state.allowFlee)
    const free = actionButton('free', '… 自由行动', locked)
    actions.append(attack, defend, skillSelect, skill, itemSelect, item, flee, free)

    if (freeOpen && !locked) {
      const freePanel = document.createElement('div')
      freePanel.className = 'st-render-battle-free'
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'st-render-battle-free-input'
      input.maxLength = 500
      input.placeholder = '输入行动'
      const submit = actionButton('free-submit', '填入草稿', false)
      freePanel.append(input, submit)
      actions.append(freePanel)
      input.focus()
    }
  }

  /** 立即执行引擎动作并刷新 UI。 */
  function execute(action: BattleAction): void {
    if (destroyed) return
    timer = null
    const result = engine.dispatch(action)
    pending = false
    notice.textContent = result.ok ? '' : result.error ?? '行动失败'
    render()
  }

  /** 按动态设置立即执行或进入短过渡锁。 */
  function schedule(action: BattleAction): void {
    if (pending || engine.getState().outcome !== 'ongoing') return
    freeOpen = false
    if (deps.getSettings().reducedMotion) {
      execute(action)
      return
    }
    pending = true
    render()
    timer = setTimeout(() => execute(action), ACTION_DELAY_MS)
  }

  /** 统一处理战斗命令和自由行动草稿。 */
  function onClick(event: MouseEvent): void {
    if (destroyed || !(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('button[data-action]')
    if (!button || !root.contains(button) || button.disabled) return
    const action = button.dataset.action
    if (action === 'attack' || action === 'defend' || action === 'flee') {
      schedule({ type: action })
    } else if (action === 'skill') {
      const select = root.querySelector<HTMLSelectElement>('.st-render-battle-skill-select')
      if (select?.value) schedule({ type: 'skill', skillId: select.value })
    } else if (action === 'item') {
      const select = root.querySelector<HTMLSelectElement>('.st-render-battle-item-select')
      if (select?.value) schedule({ type: 'item', itemId: select.value })
    } else if (action === 'free') {
      freeOpen = !freeOpen
      render()
    } else if (action === 'free-submit') {
      const input = root.querySelector<HTMLInputElement>('.st-render-battle-free-input')
      const value = input?.value.trim() ?? ''
      if (!value) {
        notice.textContent = '请输入自由行动。'
        return
      }
      const result = deps.insertDraft?.(`战斗行动：${value}`) ?? { ok: false as const, error: '未找到 SillyTavern 输入框。' }
      notice.textContent = result.ok ? '已填入自由行动' : result.error
    } else if (action === 'continue') {
      const state = engine.getState()
      if (state.outcome === 'ongoing') return
      const result = deps.insertDraft?.(continuationText(state)) ?? { ok: false as const, error: '未找到 SillyTavern 输入框。' }
      notice.textContent = result.ok ? '已填入战斗结果' : result.error
    }
  }

  root.addEventListener('click', onClick)
  render()
  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      if (timer !== null) clearTimeout(timer)
      timer = null
      root.removeEventListener('click', onClick)
    },
  }
}
