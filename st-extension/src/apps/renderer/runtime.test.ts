// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRendererSettings, type RendererSettings } from './config'
import { createRendererRuntime, type RendererModeFactory } from './runtime'

function galBlock(text = '你好'): string {
  return `<STStageRender>${galJson(text)}</STStageRender>`
}

function galJson(text = '你好'): string {
  return JSON.stringify({
    version: 1,
    mode: 'gal',
    scene: '月台',
    beats: [{ speaker: '小雪', text }],
  })
}

function cardsJson(): string {
  return JSON.stringify({
    version: 1,
    mode: 'cards',
    title: '下一步行动',
    cards: [
      { id: 'advance', title: '继续前进', description: '沿山路调查灯光', action: '我选择继续前进。' },
      { id: 'rest', title: '原地休整', description: '恢复体力', action: '我选择原地休整。' },
    ],
  })
}

function battleJson(): string {
  return JSON.stringify({
    version: 1,
    mode: 'battle',
    title: '遗迹守卫战',
    player: {
      id: 'hero', name: '旅行者', hp: 80, maxHp: 100, mp: 30, maxMp: 50,
      attack: 18, defense: 8, speed: 12, crit: 10, dodge: 5,
    },
    enemy: {
      id: 'guard', name: '遗迹守卫', hp: 120, maxHp: 120, mp: 20, maxMp: 20,
      attack: 16, defense: 10, speed: 8, crit: 5, dodge: 2,
    },
  })
}

function buildMessage(text: string, isUser = false): HTMLElement {
  const message = document.createElement('div')
  message.className = 'mes'
  message.setAttribute('is_user', isUser ? 'true' : 'false')
  const body = document.createElement('div')
  body.className = 'mes_text'
  body.textContent = text
  message.append(body)
  document.body.append(message)
  return body
}

function enabledSettings(overrides: Partial<RendererSettings> = {}): RendererSettings {
  return { ...defaultRendererSettings(), enabled: true, ...overrides }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('createRendererRuntime', () => {
  it('工厂成功后才隐藏原始块并挂载一个 renderer', () => {
    const destroy = vi.fn()
    const factory = vi.fn<RendererModeFactory>((root, block) => {
      root.textContent = block.mode
      return { destroy }
    })
    const runtime = createRendererRuntime({ getSettings: () => enabledSettings(), factories: { gal: factory } })
    const raw = galBlock()
    const body = buildMessage(`前文 ${raw} 后文`)

    runtime.processMessage(body)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(1)
    const source = body.querySelector('.st-stage-render-source') as HTMLElement | null
    expect(source?.hidden).toBe(true)
    expect(source?.textContent).toBe(raw)
    expect(body.textContent).toContain('前文')
    expect(body.textContent).toContain('后文')
  })

  it('裸 Gal 只隐藏 JSON 并保留前后文后挂载', () => {
    const factory = vi.fn<RendererModeFactory>((root, block) => {
      root.textContent = block.mode
      return { destroy: vi.fn() }
    })
    const runtime = createRendererRuntime({ getSettings: () => enabledSettings(), factories: { gal: factory } })
    const raw = galJson()
    const body = buildMessage(`前文\n${raw}\n后文`)

    runtime.processMessage(body)

    expect(factory).toHaveBeenCalledTimes(1)
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(1)
    const source = body.querySelector('.st-stage-render-source') as HTMLElement | null
    expect(source?.hidden).toBe(true)
    expect(source?.textContent).toBe(raw)
    expect(body.textContent).toContain('前文')
    expect(body.textContent).toContain('后文')
  })

  it('同一条真实失败消息独立挂载 Cards 与 Battle 裸块', () => {
    const factory = vi.fn<RendererModeFactory>((root, block) => {
      root.textContent = block.mode
      return { destroy: vi.fn() }
    })
    const runtime = createRendererRuntime({
      getSettings: () => enabledSettings(),
      factories: { cards: factory, battle: factory },
    })
    const cards = cardsJson()
    const battle = battleJson()
    const body = buildMessage(`前文\n${cards}\n战斗开始\n${battle}\n后文`)

    runtime.processMessage(body)

    expect(factory.mock.calls.map((call) => call[1].mode)).toEqual(['cards', 'battle'])
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(2)
    expect(Array.from(body.querySelectorAll('.st-stage-render-source')).map((source) => source.textContent)).toEqual([
      cards,
      battle,
    ])
    expect(body.textContent).toContain('前文')
    expect(body.textContent).toContain('后文')
  })

  it('Cards 工厂失败只保留该块原文且 Battle 兄弟仍挂载', () => {
    const cardsFactory = vi.fn<RendererModeFactory>(() => {
      throw new Error('cards mount failed')
    })
    const battleFactory = vi.fn<RendererModeFactory>((root, block) => {
      root.textContent = block.mode
      return { destroy: vi.fn() }
    })
    const runtime = createRendererRuntime({
      getSettings: () => enabledSettings(),
      factories: { cards: cardsFactory, battle: battleFactory },
    })
    const cards = cardsJson()
    const battle = battleJson()
    const body = buildMessage(`${cards}\n${battle}`)

    runtime.processMessage(body)

    expect(cardsFactory).toHaveBeenCalledTimes(1)
    expect(battleFactory).toHaveBeenCalledTimes(1)
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(1)
    expect(body.querySelector('.st-stage-render-source')?.textContent).toBe(battle)
    expect(body.textContent).toContain(cards)
  })

  it('重复事件保持当前实例，ST 重渲染才销毁并重新挂载', () => {
    const destroys: Array<ReturnType<typeof vi.fn>> = []
    const factory = vi.fn<RendererModeFactory>((root, block) => {
      root.textContent = block.mode
      const destroy = vi.fn()
      destroys.push(destroy)
      return { destroy }
    })
    const runtime = createRendererRuntime({ getSettings: () => enabledSettings(), factories: { gal: factory } })
    const body = buildMessage(galBlock('第一版'))

    runtime.processMessage(body)
    runtime.processMessage(body)
    expect(factory).toHaveBeenCalledTimes(1)
    expect(destroys[0]).not.toHaveBeenCalled()
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(1)

    body.textContent = galBlock('滑动后的版本')
    runtime.processMessage(body)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(destroys[0]).toHaveBeenCalledTimes(1)
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(1)
  })

  it('ST 在 marker 后迟到追加内容时不被旧快照覆盖', () => {
    const destroy = vi.fn()
    const factory = vi.fn<RendererModeFactory>((root) => {
      root.textContent = 'renderer'
      return { destroy }
    })
    const runtime = createRendererRuntime({ getSettings: () => enabledSettings(), factories: { gal: factory } })
    const body = buildMessage(galBlock())

    runtime.processMessage(body)
    body.append(document.createTextNode('流式追加'))
    runtime.processMessage(body)

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(2)
    expect(body.textContent).toContain('流式追加')
    expect(body.querySelectorAll('.st-stage-renderer')).toHaveLength(1)
  })

  it('非法块、流式未闭合块和抛错工厂都保留原文', () => {
    const throwingFactory = vi.fn<RendererModeFactory>(() => {
      throw new Error('mount failed')
    })
    const runtime = createRendererRuntime({ getSettings: () => enabledSettings(), factories: { gal: throwingFactory } })
    const malformed = buildMessage('<STStageRender>{bad}</STStageRender>')
    const partial = buildMessage('<STStageRender>{"version":1')
    const valid = buildMessage(galBlock())
    const original = valid.innerHTML

    runtime.processMessage(malformed)
    runtime.processMessage(partial)
    runtime.processMessage(valid)

    expect(throwingFactory).toHaveBeenCalledTimes(1)
    expect(malformed.querySelector('.st-stage-renderer')).toBeNull()
    expect(partial.querySelector('.st-stage-renderer')).toBeNull()
    expect(valid.innerHTML).toBe(original)
  })

  it('忽略用户消息、关闭的模式和未注册工厂', () => {
    const factory = vi.fn<RendererModeFactory>(() => ({ destroy: vi.fn() }))
    const settings = enabledSettings({ galEnabled: false })
    const runtime = createRendererRuntime({ getSettings: () => settings, factories: { gal: factory } })

    runtime.processMessage(buildMessage(galBlock(), true))
    runtime.processMessage(buildMessage(galBlock()))

    expect(factory).not.toHaveBeenCalled()
  })

  it('设置关闭、全量重处理和 dispose 都恢复原文且每个实例只清理一次', () => {
    let settings = enabledSettings()
    const destroy = vi.fn()
    const factory = vi.fn<RendererModeFactory>((root) => {
      root.textContent = 'renderer'
      return { destroy }
    })
    const runtime = createRendererRuntime({ getSettings: () => settings, factories: { gal: factory } })
    const raw = galBlock()
    const body = buildMessage(raw)

    runtime.processMessage(body)
    settings = { ...settings, enabled: false }
    runtime.reprocessAll()

    expect(destroy).toHaveBeenCalledTimes(1)
    expect(body.textContent).toBe(raw)
    expect(body.querySelector('.st-stage-renderer')).toBeNull()

    settings = enabledSettings()
    runtime.reprocessAll()
    expect(factory).toHaveBeenCalledTimes(2)
    runtime.dispose()
    runtime.dispose()
    expect(destroy).toHaveBeenCalledTimes(2)
    expect(body.textContent).toBe(raw)
  })

  it('处理新楼层时释放已从文档移除的旧楼层实例', () => {
    const destroys: Array<ReturnType<typeof vi.fn>> = []
    const factory = vi.fn<RendererModeFactory>((root) => {
      root.textContent = 'renderer'
      const destroy = vi.fn()
      destroys.push(destroy)
      return { destroy }
    })
    const runtime = createRendererRuntime({ getSettings: () => enabledSettings(), factories: { gal: factory } })
    const first = buildMessage(galBlock('旧楼层'))
    runtime.processMessage(first)
    first.closest('.mes')?.remove()

    runtime.processMessage(buildMessage(galBlock('新楼层')))

    expect(destroys[0]).toHaveBeenCalledTimes(1)
    expect(factory).toHaveBeenCalledTimes(2)
  })
})
