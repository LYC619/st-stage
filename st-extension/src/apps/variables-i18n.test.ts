// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../../core/i18n'
import { createDefaultSettings } from '../../../core/types'
import type { PhoneAppContext } from '../../../core/phone-registry'
import { manageDialogFocus } from '../../../core/dialog-focus'
import en from '../../locales/en-US.json'
import { mvuApp } from './mvu-app'
import { createVariableTreeView, type VariableTreeModel } from './variable-tree'
import { createNewvarDesigner } from './newvar/designer'
import { defaultNewvarData } from './newvar/config'
import { NEWVAR_TEMPLATES } from './newvar/templates'
import { applyOps, buildInjection, parseUpdateBlock, validateValue } from './newvar/engine'
import type { ParseReport } from './newvar/runtime'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).reverse().forEach(fn => fn())
  resetI18n()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function english() { loadTranslations('en-US', en); setLocale('en-US') }
function designer(report: ParseReport | null = null) {
  let data = defaultNewvarData()
  const setData = vi.fn(next => { data = next })
  const instance = createNewvarDesigner({
    getData: () => data, setData, buildPreview: () => '', getLastParse: () => report,
  })
  cleanup.push(() => instance.close())
  instance.open()
  return { instance, getData: () => data, setData }
}

describe('variable UI translations and keyboard focus', () => {
  it('translates MVU loading and empty states without requiring the host', async () => {
    english()
    const container = document.createElement('div')
    document.body.append(container)
    const app = mvuApp()
    cleanup.push(() => app.unmount?.())
    app.mount(container, { getSettings: createDefaultSettings } as unknown as PhoneAppContext)
    expect(container.textContent).toContain('Reading')
    await vi.waitFor(() => expect(container.textContent).toContain('No conversation'))
    expect(container.textContent).toContain('No variables in this message')
    expect(container.textContent).toContain('Variable quick view')
  })

  it('labels tree editors, reports validation in English, and restores the edited leaf on cancel', () => {
    english()
    const container = document.createElement('div')
    document.body.append(container)
    const model: VariableTreeModel = { data: { '体力': 50 }, definitions: [{ key: '体力', type: 'number' }],
      isMvu: false, delta: new Map(), status: 'ready', statusText: 'Test', emptyText: '', canWrite: true, addHint: '' }
    createVariableTreeView(container, { getModel: () => model, commitSet: vi.fn(), commitDelete: vi.fn(), requestRefresh: vi.fn() }).render()
    const leaf = container.querySelector<HTMLElement>('.vm-leaf-main')!
    leaf.focus()
    leaf.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const input = container.querySelector<HTMLInputElement>('.vm-edit-input')!
    expect(input.getAttribute('aria-label')).toContain('体力')
    expect(document.activeElement).toBe(input)
    input.value = ''
    container.querySelector<HTMLElement>('.vm-act')!.click()
    expect(container.querySelector('.vm-add-err')?.textContent).toBe('Enter a valid number.')
    container.querySelector<HTMLElement>('.vm-act-ghost')!.click()
    expect(document.activeElement).toBe(container.querySelector('.vm-leaf-main'))
    expect(container.querySelector('.vm-val')?.getAttribute('title')).toBe('Type: Number')
  })

  it('translates designer controls while importing the original template data', () => {
    english()
    const { getData } = designer()
    expect(document.querySelector('.so-manager')?.getAttribute('aria-label')).toBe('Variable designer')
    expect(document.querySelector('.so-manager')?.textContent).toContain('Template library')
    expect(document.querySelector('.so-manager')?.textContent).toContain('Romance · Single character')
    expect(document.querySelector('input')?.getAttribute('aria-label') || document.querySelector('input')?.closest('label')?.textContent).toBeTruthy()
    document.querySelector<HTMLElement>('.nv-tpl-actions button')!.click()
    expect(getData().schema.variables).toEqual(NEWVAR_TEMPLATES[0].variables)
    expect(getData().schema.name).toBe(NEWVAR_TEMPLATES[0].name)
  })

  it('keeps custom template names and saved metadata intact while translating the generated count', () => {
    english()
    const { getData } = designer()
    document.querySelector<HTMLElement>('.nv-tpl-actions button')!.click()
    const input = document.querySelector<HTMLInputElement>('.nv-tpl-save input')!
    input.value = '我的角色 {{name}}'
    document.querySelector<HTMLElement>('.nv-tpl-save button')!.click()
    const saved = getData().customTemplates[0]
    expect(saved.name).toBe('我的角色 {{name}}')
    expect(saved.description).toBe(`自定义 · ${saved.variables.length} 项`)
    const lastCard = [...document.querySelectorAll('.nv-tpl-card')].at(-1)!
    expect(lastCard.textContent).toContain('我的角色 {{name}}')
    expect(lastCard.querySelector('.nv-tpl-desc')?.textContent).toBe(`Custom · ${saved.variables.length} items`)
  })

  it('contains nested designer focus, consumes only its Escape, and returns focus to the opener', () => {
    english()
    const parent = document.createElement('div')
    parent.innerHTML = '<button>Open designer</button>'
    document.body.append(parent)
    const outerEscape = vi.fn()
    const outerFocus = manageDialogFocus(parent, { onEscape: outerEscape })
    cleanup.push(() => outerFocus.dispose())
    const opener = parent.querySelector('button')!
    opener.focus()
    const { instance } = designer()
    const dialog = document.querySelector<HTMLElement>('.so-manager')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)
    const close = dialog.querySelector<HTMLElement>('.so-manager-close')!
    close.focus()
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true, cancelable: true }))
    expect(document.activeElement).not.toBe(close)
    expect(dialog.contains(document.activeElement)).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(instance.isOpen()).toBe(false)
    expect(outerEscape).not.toHaveBeenCalled()
    expect(document.activeElement).toBe(opener)
  })

  it('keeps focus on the type selector after rebuilding the definition form', () => {
    english()
    designer()
    const add = [...document.querySelectorAll<HTMLElement>('.so-app-btn')].find(node => node.textContent?.includes('Add variable'))!
    add.click()
    const select = document.querySelector<HTMLSelectElement>('.nv-defs-editor select')!
    select.focus()
    select.value = 'enum'
    select.dispatchEvent(new Event('change', { bubbles: true }))
    expect(document.activeElement).toBe(document.querySelector('.nv-defs-editor select'))
    expect(document.querySelector('.nv-defs-editor')?.textContent).toContain('Allowed choices')
  })

  it('gives parse log outcomes readable translated labels', () => {
    english()
    designer({ messageId: 3, found: true, log: [{ path: '体力', status: 'accepted' }, { path: '心情', status: 'rejected', detail: 'Bad value' }] })
    expect(document.querySelector('.so-manager')?.textContent).toContain('Message #3')
    const entries = [...document.querySelectorAll('.nv-log-line')].map(node => node.textContent)
    expect(entries[0]).toContain('Accepted')
    expect(entries[1]).toContain('Rejected')
    expect(entries[1]).toContain('心情')
  })

  it('activates template actions once when the host also clicks menu buttons on Enter', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { setData } = designer()
    const hostEnter = (event: KeyboardEvent) => {
      if (event.key === 'Enter') (event.target as HTMLElement).closest<HTMLElement>('.menu_button')?.click()
    }
    document.addEventListener('keydown', hostEnter)
    cleanup.push(() => document.removeEventListener('keydown', hostEnter))
    const button = document.querySelector<HTMLButtonElement>('.nv-tpl-actions button')!
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    button.dispatchEvent(event)
    // jsdom has no native default action; emulate the browser's uncancelled Enter click.
    if (!event.defaultPrevented) button.click()
    expect(setData).toHaveBeenCalledOnce()
  })

  it('translates engine diagnostics while keeping the AI prompt byte-for-byte unchanged', () => {
    const schema = { id: 'test', name: '用户方案', version: 1, variables: NEWVAR_TEMPLATES[0].variables }
    const original = buildInjection({}, schema, 'json_patch')
    english()
    expect(buildInjection({}, schema, 'json_patch')).toBe(original)
    expect(validateValue(schema.variables[0], 'wrong').error).toContain('Expected a number')
    const result = applyOps({}, [{ op: 'replace', path: 'unknown', value: 1 }], schema)
    expect(result.log[0].detail).toBe('Undefined variable path')
    expect(parseUpdateBlock('<UpdateVariable>bad</UpdateVariable>', 'json_patch').error).toBe('No JSON Patch array found')
    expect(parseUpdateBlock('<UpdateVariable>bad</UpdateVariable>', 'lodash_set').error).toContain('Line 1, column 1')
  })
})
