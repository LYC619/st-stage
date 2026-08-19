// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../core/phone-registry'
import { defaultNewvarData, type NewvarData } from './newvar/config'
import type { NewvarRuntime } from './newvar/runtime'
import { newvarApp } from './newvar-app'

function findToggle(container: HTMLElement, label: string): HTMLInputElement {
  const row = [...container.querySelectorAll('label')].find((item) => item.textContent?.includes(label))
  const input = row?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`找不到开关：${label}`)
  return input
}

function mountApp(initial: Partial<NewvarData> = {}) {
  let data = { ...defaultNewvarData(), ...initial }
  const toast = vi.fn()
  const runtime = {
    isSTAvailable: () => true,
    getData: () => data,
    getCurrentState: () => ({}),
    getPrevState: () => null,
    setManualValue: () => ({ ok: true as const, value: null }),
    deleteVariable: vi.fn(),
    onConfigChanged: vi.fn(),
    buildPreview: () => '',
    getLastParse: () => null,
    subscribe: () => () => {},
    start: vi.fn(),
    dispose: vi.fn(),
  } satisfies NewvarRuntime
  const ctx = {
    setAppData: (next: NewvarData) => { data = next },
    toast,
  } as unknown as PhoneAppContext
  const container = document.createElement('div')
  newvarApp({ runtime, openDesigner: vi.fn() }).mount(container, ctx)
  return { container, toast, getData: () => data }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('newvarApp', () => {
  it('关闭变量记录隐藏时明确提示已恢复以及 ST Regex 的独立影响', () => {
    const mounted = mountApp({ enabled: true, hideUpdateBlocks: true })
    const toggle = findToggle(mounted.container, '隐藏正文中的变量更新记录')

    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))

    expect(mounted.getData().hideUpdateBlocks).toBe(false)
    expect(mounted.toast).toHaveBeenCalledWith(
      'success',
      expect.stringMatching(/已恢复.*ST Regex.*UpdateVariable/),
    )
    expect(mounted.container.textContent).toContain('ST Regex')
  })
})
