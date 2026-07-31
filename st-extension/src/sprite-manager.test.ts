// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings, type PluginSettings } from '../../core/types'

const imageMocks = vi.hoisted(() => ({ compressImage: vi.fn() }))

vi.mock('../../core/image-compress', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/image-compress')>()
  return { ...actual, compressImage: imageMocks.compressImage }
})

import { createSpriteManager } from './sprite-manager'
import type { STAdapter } from './st-adapter'

function findButton(scope: ParentNode, text: string): HTMLElement {
  const button = [...scope.querySelectorAll<HTMLElement>('[role="button"]')].find(
    (item) => item.textContent === text,
  )
  if (!button) throw new Error(`找不到按钮：${text}`)
  return button
}

function installFilePicker(files: File[]): void {
  vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function (this: HTMLInputElement) {
    if (this.type !== 'file') return
    Object.defineProperty(this, 'files', { configurable: true, value: files as unknown as FileList })
    this.dispatchEvent(new Event('change'))
  })
}

function openUploadPreview(manager: ReturnType<typeof createSpriteManager>, packName: string, files: File[]): HTMLElement {
  installFilePicker(files)
  manager.open()
  const pack = [...document.querySelectorAll<HTMLElement>('.so-pack-card')].find((item) =>
    item.textContent?.includes(packName),
  )
  if (!pack) throw new Error(`找不到图包：${packName}`)
  pack.click()
  findButton(document, '添加立绘 ▾').click()
  findButton(document, '选择图片（自动压缩+解析预览）').click()
  const modal = document.querySelector<HTMLElement>('.so-upload-modal')
  if (!modal) throw new Error('上传预览未打开')
  return modal
}

function uploadSettings(): PluginSettings {
  return {
    ...createDefaultSettings(),
    packs: [
      { id: 'current', name: '当前包', roleName: '鸣人', sprites: [] },
      {
        id: 'other',
        name: '冲突包',
        roleName: '鸣人',
        sprites: [{ tag: '冲突', url: 'other-url' }],
      },
    ],
    bindings: [{ characterName: '阿珍', packIds: ['current', 'other'], enabled: true }],
  }
}

describe('createSpriteManager binding conflict UI', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    imageMocks.compressImage.mockReset()
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

  it('destroy is idempotent and prevents stale callers from reopening the manager', () => {
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: createDefaultSettings,
      updateSettings: () => {},
    })
    manager.open()

    manager.destroy()
    manager.destroy()
    manager.open()

    expect(document.querySelector('.so-manager-backdrop')).toBeNull()
  })
})

describe('createSpriteManager upload finalization', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    imageMocks.compressImage.mockReset()
  })

  it('ignores repeated start clicks while an upload is running', async () => {
    let settings = uploadSettings()
    let release!: () => void
    const pending = new Promise<void>((resolve) => {
      release = resolve
    })
    imageMocks.compressImage.mockImplementation(async () => {
      await pending
      return { dataUri: 'data:image/png;base64,AA==', compressed: false, bytes: 1 }
    })
    const manager = createSpriteManager({
      adapter: {
        getCurrentCharacterName: () => '阿珍',
        saveImage: async () => 'saved-url',
      } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => {
        settings = next
      },
    })
    const modal = openUploadPreview(manager, '当前包', [new File(['a'], '鸣人-安全.png')])
    const start = findButton(modal, '开始上传')

    start.click()
    start.click()
    try {
      expect(imageMocks.compressImage).toHaveBeenCalledTimes(1)
    } finally {
      release()
      await vi.waitFor(() => expect(document.querySelector('.so-upload-modal')).toBeNull())
      manager.close()
    }
  })

  it('finalizes a conflict with counts and preserves earlier successes', async () => {
    let settings = uploadSettings()
    imageMocks.compressImage.mockResolvedValue({
      dataUri: 'data:image/png;base64,AA==',
      compressed: false,
      bytes: 1,
    })
    const manager = createSpriteManager({
      adapter: {
        getCurrentCharacterName: () => '阿珍',
        saveImage: async (name: string) => `saved:${name}`,
      } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => {
        settings = next
      },
    })
    const modal = openUploadPreview(manager, '当前包', [
      new File(['a'], '鸣人-安全.png'),
      new File(['b'], '鸣人-冲突.png'),
    ])

    findButton(modal, '开始上传').click()

    await vi.waitFor(() => expect(document.querySelector('.so-upload-modal')).toBeNull())
    expect(settings.packs.find((pack) => pack.id === 'current')?.sprites).toEqual([
      { tag: '安全', url: 'saved:鸣人-安全.png' },
    ])
    expect(document.querySelector('.so-toast')?.textContent).toContain(
      '成功 1 张，冲突 1 张，失败 0 张，未处理 0 张',
    )
    manager.close()
  })

  it('does not report a persisted sprite as failed when refresh throws', async () => {
    let settings = uploadSettings()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    imageMocks.compressImage.mockResolvedValue({
      dataUri: 'data:image/png;base64,AA==',
      compressed: false,
      bytes: 1,
    })
    const manager = createSpriteManager({
      adapter: {
        getCurrentCharacterName: () => '阿珍',
        saveImage: async () => 'saved-url',
      } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => {
        settings = next
        throw new Error('refresh failed after persistence')
      },
    })
    const modal = openUploadPreview(manager, '当前包', [new File(['a'], '鸣人-安全.png')])

    findButton(modal, '开始上传').click()

    await vi.waitFor(() => expect(document.querySelector('.so-upload-modal')).toBeNull())
    expect(settings.packs.find((pack) => pack.id === 'current')?.sprites).toEqual([
      { tag: '安全', url: 'saved-url' },
    ])
    expect(document.querySelector('.so-toast')?.textContent).toContain(
      '成功 1 张，冲突 0 张，失败 0 张，未处理 0 张',
    )
    expect(warn).toHaveBeenCalledWith(
      '[sprite-overlay] 图片已保存，但后续界面刷新失败',
      expect.objectContaining({ message: 'refresh failed after persistence' }),
    )
    manager.close()
  })
})
