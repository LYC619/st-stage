// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRendererSettings, type RendererSettings } from './config'
import { createRendererRuntime, type RendererModeFactory } from './runtime'

function galBlock(text = '你好'): string {
  return `<STStageRender>${JSON.stringify({
    version: 1,
    mode: 'gal',
    scene: '月台',
    beats: [{ speaker: '小雪', text }],
  })}</STStageRender>`
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
