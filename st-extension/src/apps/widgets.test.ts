// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { appButton, hintField, numberRow, rangeRow, selectRow, textareaRow, textRow, toggleRow } from './widgets'
import { loadTranslations, resetI18n, setLocale } from '../../../core/i18n'
import en from '../../locales/en-US.json'

afterEach(() => { document.body.replaceChildren(); resetI18n() })

describe('widget accessibility', () => {
  it('associates labels with text/password and multiline controls using unique IDs', () => {
    const rows = [textRow('API key', '', '', vi.fn(), 'password'), textareaRow('Custom prompt', '', '', vi.fn()), textRow('API key', '', '', vi.fn())]
    document.body.append(...rows)
    const controls = [...document.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea')]
    expect(new Set(controls.map(c => c.id)).size).toBe(3)
    for (const control of controls) {
      expect(control.id).not.toBe('')
      expect(control.labels?.length).toBe(1)
      expect(control.labels?.[0].htmlFor).toBe(control.id)
    }
  })

  it('gives range a label separate from its changing value and links the output', () => {
    const row = rangeRow('Opacity', 80, 20, 100, vi.fn(), vi.fn(), value => `${value}%`)
    document.body.append(row)
    const input = row.querySelector('input')!
    const output = row.querySelector('output')!
    expect(document.getElementById(input.getAttribute('aria-labelledby')!)?.textContent).toBe('Opacity')
    expect(output.htmlFor.value).toBe(input.id)
    expect(input.getAttribute('aria-valuetext')).toBe('80%')
    input.value = '44'
    input.dispatchEvent(new Event('input'))
    expect(input.getAttribute('aria-valuetext')).toBe('44%')
  })

  it('links translated hint disclosure and help text to its real control', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    const row = toggleRow('Parse illustrations', false, vi.fn())
    const input = row.querySelector('input')!
    const oldDescription = document.createElement('div')
    oldDescription.id = 'existing-help'
    input.setAttribute('aria-describedby', oldDescription.id)
    const field = hintField(row, 'Use <img>编码</img> tags.')
    document.body.append(oldDescription, field)
    const badge = field.querySelector('button')!
    const detail = field.querySelector<HTMLElement>('.so-app-hint')!
    expect(badge.getAttribute('aria-label')).toBe('Help')
    expect(badge.getAttribute('aria-controls')).toBe(detail.id)
    expect(detail.id).not.toBe('')
    expect(input.getAttribute('aria-describedby')?.split(' ')).toEqual(['existing-help', detail.id])
    expect(badge.getAttribute('aria-describedby')).toBe(detail.id)
    badge.click()
    expect(detail.hidden).toBe(false)
    expect(badge.getAttribute('aria-expanded')).toBe('true')
    badge.click()
    expect(detail.hidden).toBe(true)
    expect(input.checked).toBe(false)
  })

  it('activates App buttons only once with the real host Enter delegation pattern', () => {
    const action = vi.fn()
    const button = appButton('Open manager', action)
    const host = (event: KeyboardEvent) => { if (event.key === 'Enter') (event.target as HTMLElement).closest<HTMLElement>('.menu_button')?.click() }
    document.body.append(button)
    document.addEventListener('keydown', host)
    try {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
      expect(action).toHaveBeenCalledTimes(1)
      button.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true, cancelable: true }))
      expect(action).toHaveBeenCalledTimes(2)
    } finally { document.removeEventListener('keydown', host) }
  })

  it('retains native control labels and machine values', () => {
    const change = vi.fn()
    document.body.append(selectRow('Location', 'overlay', [{value: 'overlay', label: 'Overlay'}, {value: 'inline', label: 'Chat only'}], change), numberRow('Count', 1, 1, 5, change))
    const select = document.querySelector('select')!
    expect(select.labels?.[0].textContent).toContain('Location')
    expect(document.getElementById(select.getAttribute('aria-labelledby')!)?.textContent).toBe('Location')
    select.value = 'inline'; select.dispatchEvent(new Event('change'))
    expect(change).toHaveBeenLastCalledWith('inline')
    const number = document.querySelector('input')!
    number.value = '999'; number.dispatchEvent(new Event('change'))
    expect(change).toHaveBeenLastCalledWith(5)
  })
})

describe('rangeRow', () => {
  it('拖动时更新稳定读数，松手 change 时才提交', () => {
    const onInput = vi.fn()
    const onCommit = vi.fn()
    const row = rangeRow('不透明度', 80, 20, 100, onInput, onCommit, (value) => `${value}%`)
    const input = row.querySelector<HTMLInputElement>('input[type="range"]')!
    const output = row.querySelector<HTMLOutputElement>('output')!

    expect(input.value).toBe('80')
    expect(output.value).toBe('80%')

    input.value = '55'
    input.dispatchEvent(new Event('input', { bubbles: true }))
    expect(output.value).toBe('55%')
    expect(onInput).toHaveBeenLastCalledWith(55)
    expect(onCommit).not.toHaveBeenCalled()

    input.dispatchEvent(new Event('change', { bubbles: true }))
    expect(onCommit).toHaveBeenLastCalledWith(55)
  })

  it('夹取越界值并同步回输入框', () => {
    const onInput = vi.fn()
    const onCommit = vi.fn()
    const row = rangeRow('数值', 50, 20, 100, onInput, onCommit)
    const input = row.querySelector<HTMLInputElement>('input')!

    input.value = '120'
    input.dispatchEvent(new Event('input'))
    expect(input.value).toBe('100')
    expect(onInput).toHaveBeenLastCalledWith(100)

    input.dispatchEvent(new Event('change'))
    expect(onCommit).toHaveBeenLastCalledWith(100)
  })
})
