// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../../core/i18n'
import en from '../../locales/en-US.json'
import type { PhoneAppContext } from '../../../core/phone-registry'
import type { PluginSettings } from '../../../core/types'
import { defaultNewvarData, type NewvarData } from './newvar/config'
import type { NewvarRuntime } from './newvar/runtime'
import { newvarApp } from './newvar-app'

function findToggle(container: HTMLElement, label: string): HTMLInputElement {
  const row = [...container.querySelectorAll('label')].find((item) => item.textContent?.includes(label))
  const input = row?.querySelector('input')
  if (!(input instanceof HTMLInputElement)) throw new Error(`找不到开关：${label}`)
  return input
}

function mountApp(initial: Partial<NewvarData> = {}, initialHud = false) {
  let data = { ...defaultNewvarData(), ...initial }
  let coreSettings = { variableHud: initialHud } as unknown as PluginSettings
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
    getSettings: () => coreSettings,
    updateSettings: (next: PluginSettings) => { coreSettings = next },
    toast,
  } as unknown as PhoneAppContext
  const container = document.createElement('div')
  newvarApp({ runtime, openDesigner: vi.fn() }).mount(container, ctx)
  return { container, toast, getData: () => data, getSettings: () => coreSettings }
}

beforeEach(() => {
  document.body.innerHTML = ''
})
afterEach(resetI18n)

describe('newvarApp', () => {
  it('renders English settings and keeps focus when toggling the update-block display', () => {
    loadTranslations('en-US', en)
    setLocale('en-US')
    const mounted = mountApp({ enabled: true, hideUpdateBlocks: true })
    document.body.append(mounted.container)
    expect(mounted.container.textContent).toContain('Built-in tracking · Enabled')
    expect(mounted.container.textContent).toContain('<UpdateVariable>...</UpdateVariable>')
    const toggle = findToggle(mounted.container, 'Hide variable updates in messages')
    toggle.focus()
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).toBe(toggle)
    expect(mounted.toast).toHaveBeenCalledWith('success', expect.stringContaining('ST Regex'))
    expect(mounted.getData().hideUpdateBlocks).toBe(false)
    expect(mounted.getData().schema).toEqual(defaultNewvarData().schema)
  })

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

describe('变量速查悬浮窗开关（Finding 7）', () => {
  it('开关写核心设置，不写 App 私有数据', () => {
    const mounted = mountApp({ enabled: true })
    const before = mounted.getData()
    const toggle = findToggle(mounted.container, '变量速查悬浮窗')
    expect(toggle.checked).toBe(false) // 默认关闭

    toggle.checked = true
    toggle.dispatchEvent(new Event('change', { bubbles: true }))

    expect(mounted.getSettings().variableHud).toBe(true)
    expect(mounted.getData()).toEqual(before) // App 私有数据没被连带改写
  })

  it('已开启时渲染成勾选态', () => {
    const mounted = mountApp({ enabled: true }, true)
    expect(findToggle(mounted.container, '变量速查悬浮窗').checked).toBe(true)
  })

  it('说明里写清只读，避免用户以为它能改值', () => {
    const mounted = mountApp({ enabled: true })
    expect(mounted.container.textContent).toContain('只读')
  })
})
