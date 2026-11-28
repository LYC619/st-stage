// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../core/i18n'
import { createPhoneShell } from '../../core/phone-shell'
import { PhoneAppRegistry } from '../../core/phone-registry'
import { createDefaultSettings } from '../../core/types'
import en from '../locales/en-US.json'
import { createOverlay } from './overlay-dom'
import { mountSettingsPanel } from './settings-panel'
import { createSpriteManager } from './sprite-manager'
import type { STAdapter } from './st-adapter'

const cleanup: Array<() => void> = []

afterEach(() => {
  cleanup.splice(0).forEach((dispose) => dispose())
  resetI18n()
  document.body.replaceChildren()
})

describe('overlay, settings panel & shell UI controls', () => {
  it('opens the Sprites app from the eye shortcut without triggering drag layout commits, and supports keyboard Enter/Space', () => {
    const onLayoutChange = vi.fn()
    const manage = vi.fn()
    const close = vi.fn()
    const onOpenSprites = vi.fn()
    const overlay = createOverlay({ x: 24, y: 80, width: 220 }, onLayoutChange, manage, close, onOpenSprites)
    cleanup.push(() => overlay.destroy())

    const eye = document.querySelector<HTMLElement>('[aria-label="打开立绘 App"]')!
    eye.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    eye.click()
    expect(onOpenSprites).toHaveBeenCalledOnce()
    expect(onLayoutChange).not.toHaveBeenCalled()

    document.querySelector<HTMLElement>('.sprite-overlay-gear')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    document.querySelector<HTMLElement>('.sprite-overlay-close')!
      .dispatchEvent(new KeyboardEvent('keydown', { key: ' ', bubbles: true }))
    expect(manage).toHaveBeenCalledOnce()
    expect(close).toHaveBeenCalledOnce()
  })

  it('mounts settings panel with idempotent cleanup and escapes custom App HTML in translated shell', () => {
    loadTranslations('en-US', en)
    setLocale('en-US')

    const settingsRoot = document.createElement('div')
    settingsRoot.id = 'extensions_settings'
    document.body.append(settingsRoot)
    const update = vi.fn()
    const disposeSettings = mountSettingsPanel({ getSettings: createDefaultSettings, updateSettings: update })
    expect(document.querySelector('.sprite-overlay-settings')?.textContent).toContain('Enable sprites')
    expect(update).not.toHaveBeenCalled()
    disposeSettings()
    disposeSettings()
    expect(document.querySelector('.sprite-overlay-settings')).toBeNull()

    const registry = new PhoneAppRegistry()
    registry.register({ id: 'custom', name: '<b>My App</b>', icon: 'X', mount: () => {} })
    const phone = createPhoneShell({ x: 10, y: 10, open: true }, {
      registry,
      createAppContext: () => { throw new Error('not opened') },
      onStateChange: () => {},
    })
    cleanup.push(() => phone.destroy())
    phone.setState({ x: 10, y: 10, open: true })
    expect(document.querySelector('.so-phone-close')?.getAttribute('aria-label')).toBe('Collapse phone')
    expect(document.querySelector('.so-phone-app-label')?.textContent).toBe('<b>My App</b>')
    expect(document.querySelector('.so-phone-app-label b')).toBeNull()
  })

  it('opens gallery menus once when the ST host also activates Enter on .menu_button', () => {
    const settings = createDefaultSettings()
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '' } as STAdapter,
      getSettings: () => settings,
      updateSettings: vi.fn(),
    })
    cleanup.push(() => manager.destroy())
    const hostKeyboard = (event: KeyboardEvent) => {
      if (event.key === 'Enter') (event.target as HTMLElement)?.closest<HTMLElement>('.menu_button')?.click()
    }
    document.addEventListener('keydown', hostKeyboard)
    cleanup.push(() => document.removeEventListener('keydown', hostKeyboard))
    manager.open()
    const newButton = Array.from(document.querySelectorAll<HTMLElement>('.so-manager-actions .so-btn'))
      .find((b) => b.textContent === '新建 ▾')!
    newButton.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
    expect(document.querySelector('.so-popover-title')?.textContent).toBe('新建立绘包')
  })
})
