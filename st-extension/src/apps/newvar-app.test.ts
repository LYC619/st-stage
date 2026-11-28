// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { manageDialogFocus } from '../../../core/dialog-focus'
import { loadTranslations, resetI18n, setLocale } from '../../../core/i18n'
import type { PhoneAppContext } from '../../../core/phone-registry'
import type { PluginSettings } from '../../../core/types'
import en from '../../locales/en-US.json'
import { defaultNewvarData, type NewvarData } from './newvar/config'
import { createNewvarDesigner } from './newvar/designer'
import { buildInjection } from './newvar/engine'
import type { NewvarRuntime, ParseReport } from './newvar/runtime'
import { NEWVAR_TEMPLATES } from './newvar/templates'
import { newvarApp } from './newvar-app'

const cleanup: Array<() => void> = []

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

function openDesigner(report: ParseReport | null = null) {
  let data = defaultNewvarData()
  const setData = vi.fn((next: NewvarData) => { data = next })
  const instance = createNewvarDesigner({
    getData: () => data,
    setData,
    buildPreview: () => '',
    getLastParse: () => report,
  })
  cleanup.push(() => instance.close())
  instance.open()
  return { instance, getData: () => data, setData }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  cleanup.splice(0).reverse().forEach((fn) => fn())
  resetI18n()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('newvarApp settings & HUD toggle', () => {
  it('preserves focus when toggling hideUpdateBlocks and warns about ST Regex', () => {
    const mounted = mountApp({ enabled: true, hideUpdateBlocks: true })
    document.body.append(mounted.container)
    const toggle = findToggle(mounted.container, '隐藏正文中的变量更新记录')
    toggle.focus()
    toggle.checked = false
    toggle.dispatchEvent(new Event('change', { bubbles: true }))

    expect(document.activeElement).toBe(toggle)
    expect(mounted.getData().hideUpdateBlocks).toBe(false)
    expect(mounted.toast).toHaveBeenCalledWith('success', expect.stringMatching(/已恢复.*ST Regex.*UpdateVariable/))
  })

  it('writes variableHud to core settings without mutating app-private schema data', () => {
    const mounted = mountApp({ enabled: true })
    expect(mounted.container.textContent).toContain('只读')
    const before = mounted.getData()
    const toggle = findToggle(mounted.container, '变量速查悬浮窗')
    expect(toggle.checked).toBe(false)

    toggle.checked = true
    toggle.dispatchEvent(new Event('change', { bubbles: true }))
    expect(mounted.getSettings().variableHud).toBe(true)
    expect(mounted.getData()).toEqual(before)
    expect(findToggle(mountApp({ enabled: true }, true).container, '变量速查悬浮窗').checked).toBe(true)
  })
})

describe('newvar designer focus, host Enter guard & AI prompt locale invariance', () => {
  it('traps focus inside nested designer, consumes only its own Escape, and keeps focus on rebuilt type select', () => {
    const parent = document.createElement('div')
    parent.innerHTML = '<button>Open designer</button>'
    document.body.append(parent)
    const outerEscape = vi.fn()
    const outerFocus = manageDialogFocus(parent, { onEscape: outerEscape })
    cleanup.push(() => outerFocus.dispose())
    const opener = parent.querySelector('button')!
    opener.focus()

    const { instance } = openDesigner()
    const dialog = document.querySelector<HTMLElement>('.so-manager')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)

    const add = [...document.querySelectorAll<HTMLElement>('.so-app-btn')].find((node) => node.textContent?.includes('添加变量'))!
    add.click()
    const select = document.querySelector<HTMLSelectElement>('.nv-defs-editor select')!
    select.focus()
    select.value = 'enum'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).toBe(document.querySelector('.nv-defs-editor select'))

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(instance.isOpen()).toBe(false)
    expect(outerEscape).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
  })

  it('activates template actions once when ST host clicks .menu_button on Enter, and keeps AI injection locale-invariant', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { setData } = openDesigner()
    const hostEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter') (event.target as HTMLElement).closest<HTMLElement>('.menu_button')?.click()
    }
    document.addEventListener('keydown', hostEnter)
    cleanup.push(() => document.removeEventListener('keydown', hostEnter))
    const button = document.querySelector<HTMLButtonElement>('.nv-tpl-actions button')!
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    if (!event.defaultPrevented) button.click()
    expect(setData).toHaveBeenCalledOnce()

    const schema = { id: 'test', name: '用户方案', version: 1, variables: NEWVAR_TEMPLATES[0].variables }
    const zhInjection = buildInjection({}, schema, 'json_patch')
    loadTranslations('en-US', en)
    setLocale('en-US')
    expect(buildInjection({}, schema, 'json_patch')).toBe(zhInjection)
  })

  it('updates the intended variable definition after deleting an earlier row while editing (STAGE-003)', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    let data = defaultNewvarData()
    data.schema.variables = ['A', 'B', 'C'].map((key, index) => ({
      key,
      type: 'number',
      default: index + 1,
      description: key,
    }))
    const designer = createNewvarDesigner({
      getData: () => data,
      setData: (next) => { data = next },
      buildPreview: () => '',
      getLastParse: () => null,
    })
    cleanup.push(() => designer.close())
    designer.open()

    // 打开 B 编辑为 B-renamed，不关闭表单删除前序行 A，再保存
    document.querySelector<HTMLElement>('[data-variable-focus="definition:B"]')!.click()
    const keyInput = document.querySelector<HTMLInputElement>('.nv-defs-editor input')!
    keyInput.value = 'B-renamed'
    keyInput.dispatchEvent(new Event('input', { bubbles: true }))
    keyInput.dispatchEvent(new Event('change', { bubbles: true }))

    document.querySelector<HTMLButtonElement>('[aria-label="删除定义 A"]')!.click()
    expect(data.schema.variables.map((v) => v.key)).toEqual(['B', 'C'])

    document.querySelector<HTMLButtonElement>('[data-variable-focus="save-definition"]')!.click()
    expect(data.schema.variables.map((v) => v.key)).toEqual(['B-renamed', 'C'])
    expect(data.schema.variables[1]).toMatchObject({ key: 'C', default: 3 })

    // 不改名仅改默认值时，删除前序行后保存也不应误报重名或写错行
    document.querySelector<HTMLElement>('[data-variable-focus="definition:C"]')!.click()
    const inputs = document.querySelectorAll<HTMLInputElement>('.nv-defs-editor input')
    const defaultInput = inputs[1]!
    defaultInput.value = '30'
    defaultInput.dispatchEvent(new Event('input', { bubbles: true }))
    defaultInput.dispatchEvent(new Event('change', { bubbles: true }))

    document.querySelector<HTMLButtonElement>('[aria-label="删除定义 B-renamed"]')!.click()
    expect(data.schema.variables.map((v) => v.key)).toEqual(['C'])

    document.querySelector<HTMLButtonElement>('[data-variable-focus="save-definition"]')!.click()
    expect(data.schema.variables).toEqual([
      { key: 'C', type: 'number', default: 30, description: 'C' },
    ])
  })
})
