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
