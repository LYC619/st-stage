// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { buildActiveSpritePrompt } from '../../../core/active-prompt'
import type { PhoneAppContext } from '../../../core/phone-registry'
import { getPresetPacks } from '../../../core/presets'
import { createDefaultSettings, type SpritePack } from '../../../core/types'
import { resolveSprite } from '../../../core/sprite-store'
import * as safeRuntime from './shared/safe-runtime'
import { spriteApp } from './sprite-app'
import { loadTranslations, resetI18n, setLocale } from '../../../core/i18n'
import { BUILTIN_TEMPLATE } from '../../../core/prompt-builder'
import en from '../../locales/en-US.json'

afterEach(() => { resetI18n(); vi.restoreAllMocks() })

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('spriteApp', () => {
  it.each([
    [
      { id: 'a', name: 'Alice pack', roleName: 'Alice', outfit: 'Casual', sprites: [{ tag: 'Smile', url: '/alice.png' }] },
      { id: 'b', name: 'Bob pack', roleName: 'Bob', outfit: 'Casual', sprites: [{ tag: 'Smile', url: '/bob.png' }] },
    ],
    [
      { id: 'a', name: 'Pack A', sprites: [{ tag: 'Smile', url: '/a.png' }] },
      { id: 'b', name: 'Pack B', sprites: [{ tag: 'Smile', url: '/b.png', group: 'Bob', outfit: 'Raincoat' }] },
    ],
  ] as SpritePack[][])('copies a tag that resolves back to the selected sprite across role and outfit collisions', (...packs) => {
    const settings = { ...createDefaultSettings(), packs, bindings: [{ characterName: 'Story', packIds: packs.map(p => p.id), enabled: true }] }
    const copy = vi.spyOn(safeRuntime, 'safeCopyText').mockResolvedValue(true)
    const container = document.createElement('div')
    spriteApp().mount(container, { getSettings: () => settings, getCharacterName: () => 'Story', updateSettings: vi.fn() } as unknown as PhoneAppContext)
    container.querySelectorAll<HTMLButtonElement>('.so-sprite-chip')[1].click()
    container.querySelector<HTMLButtonElement>('.so-sprite-copy-btn')!.click()
    const tag = copy.mock.calls[0][0]
    expect(tag).toMatch(/^\[立绘:.+\]$/)
    expect(resolveSprite(packs, tag.slice(4, -1))?.url).toBe(packs[1].sprites[0].url)
    expect(container.querySelector<HTMLImageElement>('.so-sprite-stage-preview img')!.getAttribute('src')).toBe(packs[1].sprites[0].url)
  })
  it('renders English settings while preserving user content, stored values and prompt syntax', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    const settings = { ...createDefaultSettings(), promptTemplate: '私人 Prompt {清单} {数量} [立绘:图名]', apps: { custom: { message: '原样' } } }
    const updateSettings = vi.fn()
    const container = document.createElement('div')
    document.body.append(container)
    const app = spriteApp()
    expect(app.name).toBe('Sprites')
    app.mount(container, { getSettings: () => settings, getCharacterName: () => '<b>角色甲</b>', updateSettings } as unknown as PhoneAppContext)
    expect(container.textContent).toContain('Current character: <b>角色甲</b>')
    expect(container.querySelector('b')).toBeNull()
    expect(container.textContent).toContain('Display')
    expect(container.textContent).toContain('Slideshow interval (seconds)')
    expect(container.textContent).toContain('[立绘:xxx]')
    expect(container.textContent).toContain('[立绘:服装/图名]')
    const template = container.querySelector('textarea')!
    expect(template.value).toBe(settings.promptTemplate)
    expect(template.placeholder).toContain('{清单}')
    expect(template.placeholder).toContain('{数量}')
    expect(template.labels?.[0].textContent).toBe('Custom prompt (blank = built-in)')
    const location = container.querySelector('select')!
    expect([...location.options].map(o => o.value)).toEqual(['overlay', 'inline', 'both'])
    location.value = 'inline'; location.dispatchEvent(new Event('change'))
    expect(updateSettings).toHaveBeenCalledWith({ ...settings, spriteDisplayMode: 'inline' })
    expect(settings.promptTemplate).toBe('私人 Prompt {清单} {数量} [立绘:图名]')
  })

  it('translates overwrite confirmation without changing the built-in prompt', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    const settings = { ...createDefaultSettings(), promptTemplate: 'My original {清单}' }
    const updateSettings = vi.fn()
    const container = document.createElement('div')
    spriteApp().mount(container, { getSettings: () => settings, getCharacterName: () => '', updateSettings } as unknown as PhoneAppContext)
    const fill = [...container.querySelectorAll<HTMLElement>('[role="button"]')].find(b => b.textContent?.startsWith('Use built-in draft'))!
    expect(fill).toBeDefined()
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    fill.click()
    expect(confirm).toHaveBeenCalledWith('Replace the current custom prompt with the built-in draft?')
    expect(updateSettings).not.toHaveBeenCalled()
    confirm.mockReturnValue(true); fill.click()
    expect(updateSettings).toHaveBeenLastCalledWith({ ...settings, promptTemplate: BUILTIN_TEMPLATE })
    expect(container.querySelector('textarea')?.value).toBe(BUILTIN_TEMPLATE)
  })

  it('Prompt 预览与包含场景备注的真实注入内容长度一致', () => {
    const packs = getPresetPacks()
    const characterName = '塞拉菲娜'
    const settings = {
      ...createDefaultSettings(),
      enabled: true,
      packs,
      bindings: [{ characterName, packIds: packs.map((pack) => pack.id), enabled: true }],
      multiRolePromptMode: 'repeat' as const,
      spriteCount: 3,
      promptBudget: 0,
    }
    const ctx = {
      getSettings: () => settings,
      getCharacterName: () => characterName,
      updateSettings: vi.fn(),
    } as unknown as PhoneAppContext
    const container = document.createElement('div')

    spriteApp().mount(container, ctx)

    const injected = buildActiveSpritePrompt(settings, characterName)
    expect(container.textContent).toContain(`当前提示词约 ${injected.length} 字`)
  })

  it('悬浮窗不透明度使用滑块，拖动只预览读数、松手后提交设置', () => {
    const settings = createDefaultSettings()
    const updateSettings = vi.fn()
    const previewOpacity = vi.fn()
    const ctx = {
      getSettings: () => settings,
      getCharacterName: () => '',
      updateSettings,
    } as unknown as PhoneAppContext
    const container = document.createElement('div')

    spriteApp({ previewOpacity }).mount(container, ctx)

    const slider = container.querySelector<HTMLInputElement>('input[type="range"]')!
    expect(slider).not.toBeNull()
    expect(slider.value).toBe(String(settings.spriteOpacity))
    slider.value = '47'
    slider.dispatchEvent(new Event('input', { bubbles: true }))
    expect(container.querySelector<HTMLOutputElement>('output')?.value).toBe('47%')
    expect(previewOpacity).toHaveBeenCalledWith(47)
    expect(updateSettings).not.toHaveBeenCalled()

    slider.dispatchEvent(new Event('change', { bubbles: true }))
    expect(updateSettings).toHaveBeenCalledWith({ ...settings, spriteOpacity: 47 })
  })
})
