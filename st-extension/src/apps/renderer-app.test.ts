// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppHost, PhoneAppContext } from '../../../core/phone-registry'
import { createDefaultSettings } from '../../../core/types'
import { rendererApp } from './renderer-app'
import type { RendererSettings } from './renderer/config'

function findInput(container: HTMLElement, label: string): HTMLInputElement {
  const row = Array.from(container.querySelectorAll('label')).find((item) => item.textContent?.includes(label))
  const input = row?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`找不到控件: ${label}`)
  return input
}

function change(input: HTMLInputElement, value: boolean | string): void {
  if (typeof value === 'boolean') input.checked = value
  else input.value = value
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function createHost(initial?: unknown) {
  let data = initial
  const injectPrompt = vi.fn()
  const setAppData = vi.fn((next: unknown) => { data = next })
  const base = {
    apiVersion: 2,
    getSettings: () => createDefaultSettings(),
    getCharacterName: () => '',
    getAppData: <T,>() => data as T | undefined,
    setAppData,
    onMessageReceived: () => () => {},
    onCharacterChanged: () => () => {},
    injectPrompt,
    toast: vi.fn(),
  } satisfies AppHost
  return {
    host: base,
    ctx: {
      ...base,
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: vi.fn(),
      setInterval: vi.fn(),
    } as unknown as PhoneAppContext,
    injectPrompt,
    setAppData,
    getData: () => data as RendererSettings | undefined,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('rendererApp', () => {
  it('显示总开关、模式、深度和动态效果控件', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { ctx } = createHost()
    const container = document.createElement('div')

    app.mount(container, ctx)

    expect(app).toMatchObject({ id: 'renderer', name: '渲染', order: 7 })
    expect(findInput(container, '启用渲染').checked).toBe(false)
    expect(findInput(container, 'Galgame').checked).toBe(true)
    expect(findInput(container, '卡片选择').checked).toBe(true)
    expect(findInput(container, '战斗').checked).toBe(true)
    expect(findInput(container, '注入深度').value).toBe('4')
    expect(findInput(container, '打字机').checked).toBe(true)
    expect(findInput(container, '减少动态').checked).toBe(false)
  })

  it('首次打开时显示三步快速开始、真实配置状态和模式说明', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { ctx } = createHost()
    const container = document.createElement('div')

    app.mount(container, ctx)

    expect(container.querySelector('.renderer-quick-start')).not.toBeNull()
    expect(container.querySelector('.renderer-status')?.textContent).toContain('未启用')
    expect(container.querySelectorAll('.renderer-quick-step')).toHaveLength(3)
    expect(container.querySelector('.renderer-mode-guide')?.textContent).toContain('Galgame')
    expect(container.querySelector('.renderer-mode-guide')?.textContent).toContain('卡片选择')
    expect(container.querySelector('.renderer-mode-guide')?.textContent).toContain('战斗')
    expect(container.querySelector('.renderer-recommend')?.textContent).toBe('启用渲染')
  })

  it('启用后保留状态并隐藏首次使用步骤和启用操作', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { ctx } = createHost({
      enabled: true,
      galEnabled: true,
      cardsEnabled: false,
      battleEnabled: true,
    })
    const container = document.createElement('div')

    app.mount(container, ctx)

    expect(container.querySelector('.renderer-status')?.textContent).toContain('已启用')
    expect(container.querySelectorAll('.renderer-quick-step')).toHaveLength(0)
    expect(container.querySelector('.renderer-recommend')).toBeNull()
  })

  it('启用操作只打开总开关并保留用户的模式选择', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { ctx, getData, injectPrompt } = createHost({
      enabled: false,
      galEnabled: true,
      cardsEnabled: false,
      battleEnabled: true,
    })
    const container = document.createElement('div')

    app.mount(container, ctx)
    const recommendation = container.querySelector<HTMLElement>('.renderer-recommend')
    expect(recommendation).not.toBeNull()
    recommendation?.click()

    expect(getData()).toMatchObject({
      enabled: true,
      galEnabled: true,
      cardsEnabled: false,
      battleEnabled: true,
    })
    expect(injectPrompt.mock.calls.at(-1)?.[0]).toContain('ST Stage 结构化渲染协议')
    expect(runtime.reprocessAll).toHaveBeenCalledTimes(1)
  })

  it('启用但没有模式时显示警告并清空渲染协议提示词', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { host, ctx, injectPrompt } = createHost({
      enabled: true,
      galEnabled: false,
      cardsEnabled: false,
      battleEnabled: false,
    })
    const container = document.createElement('div')

    app.setup?.(host)
    app.mount(container, ctx)

    expect(container.querySelector('.renderer-status')?.textContent).toContain('没有启用模式')
    expect(injectPrompt).toHaveBeenLastCalledWith('', 4)
  })

  it('每次修改都持久化、刷新提示词并重处理消息', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { ctx, injectPrompt, getData } = createHost()
    const container = document.createElement('div')
    app.mount(container, ctx)

    change(findInput(container, '启用渲染'), true)
    expect(getData()?.enabled).toBe(true)
    expect(injectPrompt.mock.calls.at(-1)?.[0]).toContain('ST Stage 结构化渲染协议')
    expect(injectPrompt.mock.calls.at(-1)?.[1]).toBe(4)

    change(findInput(container, '注入深度'), '99')
    expect(getData()?.injectionDepth).toBe(20)
    expect(injectPrompt.mock.calls.at(-1)?.[1]).toBe(20)

    change(findInput(container, '打字机'), false)
    change(findInput(container, '减少动态'), true)
    expect(getData()).toMatchObject({ typewriter: false, reducedMotion: true })

    change(findInput(container, 'Galgame'), false)
    expect(injectPrompt.mock.calls.at(-1)?.[0]).not.toContain('"mode":"gal"')
    change(findInput(container, '卡片选择'), false)
    change(findInput(container, '战斗'), false)
    expect(injectPrompt.mock.calls.at(-1)?.[0]).toBe('')
    expect(runtime.reprocessAll).toHaveBeenCalledTimes(7)
  })

  it('常驻 setup 在未打开手机页时注入已保存配置，并在平台销毁时清空', () => {
    const runtime = { reprocessAll: vi.fn() }
    const app = rendererApp({ runtime })
    const { host, injectPrompt } = createHost({
      enabled: true,
      galEnabled: false,
      cardsEnabled: true,
      battleEnabled: false,
      injectionDepth: 9,
      typewriter: false,
      reducedMotion: true,
    })

    const cleanup = app.setup?.(host)

    expect(injectPrompt).toHaveBeenCalledWith(expect.stringContaining('"mode":"cards"'), 9)
    expect(injectPrompt.mock.calls[0][0]).not.toContain('"mode":"gal"')
    expect(runtime.reprocessAll).not.toHaveBeenCalled()
    expect(cleanup).toEqual(expect.any(Function))
    if (typeof cleanup === 'function') cleanup()
    expect(injectPrompt).toHaveBeenLastCalledWith('')
  })
})
