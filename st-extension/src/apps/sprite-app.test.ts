// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { buildActiveSpritePrompt } from '../../../core/active-prompt'
import type { PhoneAppContext } from '../../../core/phone-registry'
import { getPresetPacks } from '../../../core/presets'
import { createDefaultSettings } from '../../../core/types'
import { spriteApp } from './sprite-app'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('spriteApp', () => {
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
    expect(container.textContent).toContain(`预计注入 ${injected.length} 字符`)
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
