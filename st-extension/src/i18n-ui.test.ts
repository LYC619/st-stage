// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../core/i18n'
import { createPhoneShell } from '../../core/phone-shell'
import { PhoneAppRegistry } from '../../core/phone-registry'
import { createDefaultSettings } from '../../core/types'
import { createOverlay } from './overlay-dom'
import { createSpriteManager } from './sprite-manager'
import { mountSettingsPanel } from './settings-panel'
import type { STAdapter } from './st-adapter'
import zh from '../locales/zh-CN.json'
import en from '../locales/en-US.json'

const cleanup: Array<() => void> = []
afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  resetI18n()
  document.body.replaceChildren()
})

describe('first translated UI surfaces', () => {
  it.each(['zh-CN', 'en-US'] as const)('renders phone navigation and preserves custom App names in %s', (locale) => {
    loadTranslations('zh-CN', zh)
    loadTranslations('en-US', en)
    setLocale(locale)
    const registry = new PhoneAppRegistry()
    registry.register({ id: 'custom', name: '<b>My App</b>', icon: 'X', mount: () => {} })
    const phone = createPhoneShell({ x: 10, y: 10, open: true }, {
      registry, createAppContext: () => { throw new Error('not opened') }, onStateChange: () => {},
    })
    cleanup.push(() => phone.destroy())
    phone.setState({ x: 10, y: 10, open: true })
    expect(document.querySelector('.so-phone-close')?.getAttribute('aria-label')).toBe(locale === 'en-US' ? 'Collapse phone' : '收起手机')
    expect(document.querySelector('.so-phone-app-icon')?.getAttribute('aria-label')).toBe(`${locale === 'en-US' ? 'Open' : '打开'} <b>My App</b>`)
    expect(document.querySelector('.so-phone-app-label')?.textContent).toBe('<b>My App</b>')
    expect(document.querySelector('.so-phone-app-label b')).toBeNull()
  })

  it('exposes translated overlay controls and keyboard activation', () => {
    loadTranslations('en-US', en)
    setLocale('en-US')
    const manage = vi.fn()
    const close = vi.fn()
    const overlay = createOverlay({ x: 10, y: 10, width: 200 }, () => {}, manage, close)
    cleanup.push(() => overlay.destroy())
    const gear = document.querySelector<HTMLElement>('.sprite-overlay-gear')!
    expect(gear.getAttribute('aria-label')).toBe('Manage sprite packs')
    expect(gear.tabIndex).toBe(0)
    gear.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(manage).toHaveBeenCalledOnce()
    document.querySelector('.sprite-overlay-close')!.dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(close).toHaveBeenCalledOnce()
  })

  it('translates gallery dialog entry controls and settings without changing saved values', () => {
    loadTranslations('en-US', en)
    setLocale('en-US')
    const settings = createDefaultSettings()
    const update = vi.fn()
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '' } as STAdapter,
      getSettings: () => settings, updateSettings: update,
    })
    cleanup.push(() => manager.destroy())
    manager.open()
    expect(document.querySelector('.so-manager')?.getAttribute('aria-label')).toBe('Manage sprite packs')
    expect(document.querySelector('.so-manager-title')?.textContent).toBe('Manage sprite packs')
    expect(document.querySelector('.so-manager-close')?.getAttribute('aria-label')).toBe('Close')
    document.querySelector('.so-manager-close')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(document.querySelector('.so-manager')).toBeNull()
    const target = document.createElement('div')
    target.id = 'extensions_settings'
    document.body.append(target)
    cleanup.push(mountSettingsPanel({ getSettings: () => settings, updateSettings: update }))
    expect(target.textContent).toContain('Enable sprites')
    expect(target.textContent).toContain('Show phone')
    expect(update).not.toHaveBeenCalled()
  })

  it('keeps Chinese UI usable before locale assets load', () => {
    const overlay = createOverlay({ x: 10, y: 10, width: 200 }, () => {})
    cleanup.push(() => overlay.destroy())
    expect(document.querySelector('.sprite-overlay-gear')?.getAttribute('aria-label')).toBe('立绘包管理')
  })

  it('opens gallery menus once when the ST host also activates Enter on menu buttons', () => {
    const settings = createDefaultSettings()
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '' } as STAdapter,
      getSettings: () => settings, updateSettings: vi.fn(),
    })
    cleanup.push(() => manager.destroy())
    // ST 1.18 keyboard.js activates .menu_button on bubbling Enter, even if defaultPrevented.
    const hostKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Enter') (event.target as HTMLElement)?.closest<HTMLElement>('.menu_button')?.click()
    }
    document.addEventListener('keydown', hostKeyboard)
    cleanup.push(() => document.removeEventListener('keydown', hostKeyboard))
    manager.open()
    const newButton = Array.from(document.querySelectorAll<HTMLElement>('.so-manager-actions .so-btn')).find(b => b.textContent === '新建 ▾')!
    newButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(document.querySelector('.so-popover-title')?.textContent).toBe('新建立绘包')
  })
})
