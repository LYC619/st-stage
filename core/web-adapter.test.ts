// @vitest-environment jsdom

import { afterEach, describe, expect, it } from 'vitest'
import { createDefaultSettings } from './types'
import { getPresetPacks, presetSpriteKey } from './presets'
import { WebAdapter } from '../lib/web-adapter'

const STORAGE_KEY = 'sprite-overlay-settings-v1'

afterEach(() => window.localStorage.clear())

describe('WebAdapter settings persistence', () => {
  it('loads preset overrides and retains custom IDs that only look like presets', async () => {
    const preset = getPresetPacks()[0]
    const sprite = preset.sprites[0]
    const saved = createDefaultSettings()
    saved.packs = [{ id: 'preset_custom_story', name: '自定义故事包', sprites: [] }]
    saved.presetOverrides[preset.id] = {
      metadata: { name: '网页本地常服' },
      localSprites: { [presetSpriteKey(sprite)]: '/user/images/sprite-overlay/web.webp' },
    }
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(saved))

    const loaded = await new WebAdapter().loadSettings()

    const loadedPreset = loaded.packs.find((pack) => pack.id === preset.id)!
    expect(loadedPreset.name).toBe('网页本地常服')
    expect(loadedPreset.sprites).toHaveLength(preset.sprites.length)
    expect(loadedPreset.sprites[0]).toMatchObject({
      url: '/user/images/sprite-overlay/web.webp',
      remoteUrl: sprite.url,
    })
    expect(loaded.packs.some((pack) => pack.id === 'preset_custom_story')).toBe(true)
  })

  it('saves only custom packs together with preset overrides', async () => {
    const preset = getPresetPacks()[0]
    const settings = createDefaultSettings()
    settings.packs = [
      ...getPresetPacks(),
      { id: 'preset_custom_story', name: '自定义故事包', sprites: [] },
    ]
    settings.presetOverrides[preset.id] = { metadata: { name: '覆盖名' } }

    await new WebAdapter().saveSettings(settings)

    const persisted = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null')
    expect(persisted.packs).toEqual([
      { id: 'preset_custom_story', name: '自定义故事包', sprites: [] },
    ])
    expect(persisted.presetOverrides).toEqual(settings.presetOverrides)
  })
})
