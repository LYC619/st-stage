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
})
