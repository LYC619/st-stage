// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings, type PluginSettings } from '../../core/types'
import { createSpriteManager } from './sprite-manager'
import type { STAdapter } from './st-adapter'

describe('createSpriteManager binding conflict UI', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('resets the pack selector when a conflicting bind is cancelled', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        {
          id: 'active',
          name: '现用包',
          roleName: '鸣人',
          sprites: [{ tag: '微笑', url: 'active-url' }],
        },
        {
          id: 'incoming',
          name: '待启用包',
          roleName: '鸣人',
          sprites: [{ tag: '微笑', url: 'incoming-url' }],
        },
      ],
      bindings: [
        { characterName: '阿珍', packIds: ['active'], enabled: true },
      ],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    vi.spyOn(window, 'prompt').mockReturnValue(null)

    manager.open()
    const select = document.querySelector<HTMLSelectElement>('select[aria-label*="添加启用立绘包"]')
    expect(select).not.toBeNull()
    select!.value = 'incoming'
    select!.dispatchEvent(new Event('change'))

    expect(settings.bindings[0].packIds).toEqual(['active'])
    expect(document.querySelector<HTMLSelectElement>('select[aria-label*="添加启用立绘包"]')?.value).toBe('')
    manager.close()
  })
})
