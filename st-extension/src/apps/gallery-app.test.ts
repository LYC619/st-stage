// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { galleryApp } from './gallery-app'
import { createDefaultSettings, DEFAULT_IMAGE_HOST } from '../../../core/types'
import type { PhoneAppContext } from '../../../core/phone-registry'
import { loadTranslations, resetI18n, setLocale } from '../../../core/i18n'
import en from '../../locales/en-US.json'

afterEach(() => { resetI18n(); document.body.replaceChildren() })

describe('Gallery App translations', () => {
  it('renders translated overview without translating or sorting stored pack names', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    const settings = { ...createDefaultSettings(), packs: Array.from({length: 7}, (_, i) => ({id: String(i), name: `用户包${i}<b>`, sprites: [{tag: '原始标签', url: 'https://example.invalid/image.png'}]})), bindings: [{characterName: '用户角色', packIds: ['6'], enabled: true}] }
    const snapshot = JSON.stringify(settings)
    const openManager = vi.fn()
    const updateSettings = vi.fn()
    const app = galleryApp({openManager})
    expect(app.name).toBe('Gallery')
    const container = document.createElement('div'); document.body.append(container)
    app.mount(container, {getSettings: () => settings, updateSettings} as unknown as PhoneAppContext)
    expect(container.textContent).toContain('Sprite packs: 7')
    expect(container.textContent).toContain('· 用户包6<b> · Images: 1 · In use')
    expect(container.textContent).toContain('2 more packs')
    expect(container.querySelector('b')).toBeNull()
    container.querySelector<HTMLElement>('[role="button"]')!.click()
    expect(openManager).toHaveBeenCalledOnce()
    expect(JSON.stringify(settings)).toBe(snapshot)
    expect(updateSettings).not.toHaveBeenCalled()
  })

  it('translates missing-key feedback and retains key/prefix save normalization', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    const settings = createDefaultSettings()
    const updateSettings = vi.fn()
    const container = document.createElement('div'); document.body.append(container)
    galleryApp({openManager: vi.fn()}).mount(container, {getSettings: () => settings, updateSettings} as unknown as PhoneAppContext)
    const auto = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    auto.checked = true; auto.dispatchEvent(new Event('change'))
    expect(updateSettings).not.toHaveBeenCalled()
    expect(auto.checked).toBe(false)
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Enter an imgbb API key first (free: https://api.imgbb.com/).')
    const key = container.querySelector<HTMLInputElement>('input[type="password"]')!
    expect(key.labels?.[0].textContent).toBe('imgbb API key (stored as plain text in ST settings)')
    key.value = ' private-key '; key.dispatchEvent(new Event('change'))
    expect(updateSettings).toHaveBeenLastCalledWith({...settings, imgbbApiKey: 'private-key'})
    const prefix = container.querySelector<HTMLInputElement>('input[type="text"]')!
    prefix.value = 'https://images.example.test'; prefix.dispatchEvent(new Event('change'))
    expect(updateSettings).toHaveBeenLastCalledWith({...settings, imageHost: 'https://images.example.test/'})
    prefix.value = 'invalid'; prefix.dispatchEvent(new Event('change'))
    expect(updateSettings).toHaveBeenLastCalledWith({...settings, imageHost: DEFAULT_IMAGE_HOST})
  })

  it('keeps Chinese fallback usable with no dictionary', () => {
    const app = galleryApp({openManager: vi.fn()})
    expect(app.name).toBe('图库')
    const container = document.createElement('div')
    app.mount(container, {getSettings: createDefaultSettings, updateSettings: vi.fn()} as unknown as PhoneAppContext)
    expect(container.textContent).toContain('打开立绘包管理')
  })

  it('keeps missing-key feedback visible when settings updates remount the App', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    let settings = createDefaultSettings()
    const app = galleryApp({openManager: vi.fn()})
    const container = document.createElement('div'); document.body.append(container)
    const ctx = {
      getSettings: () => settings,
      updateSettings: (next: typeof settings) => { settings = next; container.replaceChildren(); app.mount(container, ctx as unknown as PhoneAppContext) },
    }
    app.mount(container, ctx as unknown as PhoneAppContext)
    const checkbox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true; checkbox.dispatchEvent(new Event('change'))
    expect(container.querySelector('[role="status"]')?.textContent).toBe('Enter an imgbb API key first (free: https://api.imgbb.com/).')
    expect(container.querySelector<HTMLInputElement>('input[type="checkbox"]')?.checked).toBe(false)
    expect(settings.autoUpload).toBe(false)
  })
})
