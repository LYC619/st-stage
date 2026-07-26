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

  it('creates a pack from the header 新建 dropdown and enters its detail view', () => {
    let settings: PluginSettings = createDefaultSettings()
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()

    const newBtn = [...document.querySelectorAll<HTMLElement>('.so-manager-actions .menu_button')]
      .find((b) => b.textContent?.includes('新建'))
    expect(newBtn).toBeDefined()
    newBtn!.click()

    const input = document.querySelector<HTMLInputElement>('.so-popover input')
    expect(input).not.toBeNull()
    input!.value = '新包'
    const createBtn = [...document.querySelectorAll<HTMLElement>('.so-popover .menu_button')]
      .find((b) => b.textContent === '创建')
    createBtn!.click()

    expect(settings.packs.some((p) => p.name === '新包')).toBe(true)
    // 创建成功直接进入详情页，且下拉浮层随重渲染关闭
    expect(document.querySelector('.so-manager-title')?.textContent).toBe('新包')
    expect(document.querySelector('.so-popover')).toBeNull()
    manager.close()
  })

  it('opens the lightbox from a sprite cell, steps with arrow keys, closes with Escape', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        {
          id: 'p1',
          name: '测试包',
          sprites: [
            { tag: '微笑', url: 'https://img.test/a.png' },
            { tag: '生气', url: 'https://img.test/b.png' },
          ],
        },
      ],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((c) => c.textContent?.includes('测试包')))!.click()

    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()
    const img = document.querySelector<HTMLImageElement>('.so-lightbox img')
    expect(img?.src).toBe('https://img.test/a.png')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(img?.src).toBe('https://img.test/b.png')

    // Esc 只关查看器，不退出详情页
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(document.querySelector('.so-lightbox')).toBeNull()
    expect(document.querySelector('.so-manager-title')?.textContent).toBe('测试包')
    manager.close()
  })

  it('unhooks the lightbox keydown listener when the manager closes over it', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        {
          id: 'p1',
          name: '测试包',
          sprites: [
            { tag: '微笑', url: 'https://img.test/a.png' },
            { tag: '生气', url: 'https://img.test/b.png' },
          ],
        },
      ],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((c) => c.textContent?.includes('测试包')))!.click()
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()
    expect(document.querySelector('.so-lightbox')).not.toBeNull()

    // 灯箱还开着时整体关闭弹窗：全局方向键不能再被残留监听 preventDefault
    manager.close()
    const arrow = new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true })
    document.dispatchEvent(arrow)
    expect(arrow.defaultPrevented).toBe(false)
  })
})
