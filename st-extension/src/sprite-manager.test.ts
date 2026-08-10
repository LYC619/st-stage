// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  createDefaultSettings,
  DEFAULT_PROMPT_NOTE_PLACEMENT,
  type PluginSettings,
} from '../../core/types'
import { buildPromptSceneNotes } from '../../core/prompt-builder'
import { MAX_NOTE_CODE_POINTS } from '../../core/sprite-metadata'

const imageMocks = vi.hoisted(() => ({ compressImage: vi.fn() }))
const imgbbMocks = vi.hoisted(() => ({ uploadToImgbb: vi.fn() }))

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

/** 展开当前包详情页的「包信息」折叠面板 */
function openPackInfoPanel(): HTMLDetailsElement {
  const panel = [...document.querySelectorAll<HTMLDetailsElement>('details')]
    .find((details) => details.querySelector('summary')?.textContent === '包信息')
  if (!panel) throw new Error('找不到「包信息」面板')
  panel.open = true
  return panel
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

/** 勾选「自动拆分」（默认关闭）：按文件名前缀拆人名/服装 */
function enableAutoSplit(modal: HTMLElement): void {
  const box = modal.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (!box) throw new Error('找不到自动拆分勾选框')
  box.checked = true
  box.dispatchEvent(new Event('change'))
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

function largeGallerySettings(count: number): PluginSettings {
  return {
    ...createDefaultSettings(),
    packs: [
      {
        id: 'large',
        name: '千图包',
        sprites: Array.from({ length: count }, (_, index) => ({
          tag: `图${index + 1}`,
          url: `https://img.test/${index + 1}.png`,
        })),
      },
    ],
  }
}

function openLargeGallery(count = 1000): ReturnType<typeof createSpriteManager> {
  let settings = largeGallerySettings(count)
  const manager = createSpriteManager({
    adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
    getSettings: () => settings,
    updateSettings: (next) => { settings = next },
  })
  manager.open()
  ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
    .find((c) => c.textContent?.includes('千图包')))!.click()
  return manager
}

function openActionGallery(tags: string[], packId = 'actions') {
  let settings: PluginSettings = {
    ...createDefaultSettings(),
    packs: [{
      id: packId,
      name: '操作包',
      sprites: tags.map((tag) => ({ tag, url: `https://img.test/${tag}.png` })),
    }],
  }
  const manager = createSpriteManager({
    adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
    getSettings: () => settings,
    updateSettings: (next) => { settings = next },
  })
  manager.open()
  ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
    .find((card) => card.textContent?.includes('操作包')))!.click()
  return { manager, getSettings: () => settings }
}

describe('createSpriteManager binding conflict UI', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    imageMocks.compressImage.mockReset()
  })

  it('冲突启用被取消时勾选框回到未勾选状态', () => {
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
    findButton(document, '启用包（1） ▾').click()
    const incomingRow = [...document.querySelectorAll<HTMLElement>('.so-popover[data-pop="启用包"] label')]
      .find((row) => row.textContent?.includes('待启用包'))
    expect(incomingRow).not.toBeUndefined()
    const input = incomingRow!.querySelector<HTMLInputElement>('input')!
    input.checked = true
    input.dispatchEvent(new Event('change'))

    // 冲突确认被取消：绑定不变，浮层按真实状态重建、勾选框回到未勾选
    expect(settings.bindings[0].packIds).toEqual(['active'])
    const rebuilt = [...document.querySelectorAll<HTMLElement>('.so-popover[data-pop="启用包"] label')]
      .find((row) => row.textContent?.includes('待启用包'))
    expect(rebuilt?.querySelector<HTMLInputElement>('input')?.checked).toBe(false)
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
    const lightbox = document.querySelector<HTMLElement>('.so-lightbox')
    expect(lightbox?.parentElement).toBe(document.body)
    expect(document.querySelector('.so-manager-body')?.contains(lightbox)).toBe(false)
    expect(lightbox?.querySelector('.so-lightbox-actions')).not.toBeNull()
    expect([...lightbox!.querySelectorAll<HTMLElement>('[data-action-id]')].map((item) => item.textContent)).toEqual([
      '✎重命名',
      '#标签',
      '🏷设分组',
      '🖼重新上传 / 替换图片',
      '↓保存到本地',
      '🔗远程地址',
      '★设为封面',
      '✕删除',
    ])
    const img = lightbox?.querySelector<HTMLImageElement>('img')
    expect(img?.src).toBe('https://img.test/a.png')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(img?.src).toBe('https://img.test/b.png')

    vi.spyOn(window, 'prompt').mockReturnValue('开心')
    lightbox!.querySelector<HTMLElement>('[data-action-id="rename"]')!.click()
    expect(document.querySelector('.so-lightbox')).toBe(lightbox)
    expect(document.querySelector('.so-lightbox-caption')?.textContent).toBe('开心（2/2）')

    // Esc 只关查看器，不退出详情页
    document.querySelector<HTMLElement>('.so-lightbox-close')!.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }),
    )
    expect(document.querySelector('.so-lightbox')).toBeNull()
    expect(document.querySelector('.so-manager-title')?.textContent).toBe('测试包')
    manager.close()
  })

  it('refreshes source-dependent actions when lightbox navigation changes sprites', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'sources',
        name: '来源包',
        sprites: [
          { tag: '本地', url: '/user/images/local.png' },
          { tag: '远程', url: 'https://img.test/remote.png' },
        ],
      }],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('来源包')))!.click()
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    expect(document.querySelector<HTMLButtonElement>('[data-action-id="localize"]')?.disabled).toBe(true)
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(document.querySelector<HTMLButtonElement>('[data-action-id="localize"]')?.disabled).toBe(false)

    manager.close()
  })

  it('does not fetch remote sprites merely by opening the manager or lightbox', () => {
    const fetchImage = vi.fn()
    vi.stubGlobal('fetch', fetchImage)
    const { manager } = openActionGallery(['远程图'])

    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    expect(fetchImage).not.toHaveBeenCalled()
    manager.close()
  })

  it('localizes a remote sprite only after the explicit action succeeds', async () => {
    const order: string[] = []
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'localize',
        name: '本地化包',
        sprites: [{ tag: '远程图', url: 'https://img.test/remote.png', labels: ['保留'] }],
      }],
    }
    const fetchImage = vi.fn(async () => {
      order.push('fetch')
      return {
        ok: true,
        status: 200,
        headers: new Headers({ 'content-type': 'image/png' }),
        blob: async () => new Blob(['remote'], { type: 'image/png' }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchImage)
    imageMocks.compressImage.mockImplementation(async () => {
      order.push('compress')
      return {
        dataUri: 'data:image/webp;base64,AA==',
        compressed: true,
        bytes: 1,
      }
    })
    const saveImageFile = vi.fn(async () => {
      order.push('save')
      return '/user/images/remote.webp'
    })
    const manager = createSpriteManager({
      adapter: {
        getCurrentCharacterName: () => '阿珍',
        saveImageFile,
      } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => {
        order.push('commit')
        settings = next
      },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('本地化包')))!.click()
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    document.querySelector<HTMLButtonElement>('[data-action-id="localize"]')!.click()

    await vi.waitFor(() => expect(settings.packs[0].sprites[0]).toEqual({
      tag: '远程图',
      url: '/user/images/remote.webp',
      remoteUrl: 'https://img.test/remote.png',
      labels: ['保留'],
    }))
    expect(fetchImage).toHaveBeenCalledTimes(1)
    expect(imageMocks.compressImage).toHaveBeenCalledTimes(1)
    expect(saveImageFile).toHaveBeenCalledTimes(1)
    expect(order).toEqual(['fetch', 'compress', 'save', 'commit'])
    expect(document.querySelector<HTMLButtonElement>('[data-action-id="localize"]')?.disabled).toBe(true)
    manager.close()
  })

  it('keeps settings unchanged when explicit localization fails', async () => {
    const original = { tag: '远程图', url: 'https://img.test/remote.png', labels: ['保留'] }
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{ id: 'localize-fail', name: '失败包', sprites: [original] }],
    }
    vi.stubGlobal('fetch', vi.fn(async () => {
      throw new TypeError('CORS blocked')
    }))
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('失败包')))!.click()
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    document.querySelector<HTMLButtonElement>('[data-action-id="localize"]')!.click()

    await vi.waitFor(() => expect(document.querySelector('.so-toast')?.textContent).toContain('下载远程图片失败'))
    expect(settings.packs[0].sprites[0]).toBe(original)
    manager.close()
  })

  it('shows replacement completion in the current manager body after rerender', async () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'replace',
        name: '替换包',
        sprites: [{ tag: '旧图', url: 'https://img.test/old.png' }],
      }],
    }
    imageMocks.compressImage.mockResolvedValue({
      dataUri: 'data:image/webp;base64,AA==',
      compressed: true,
      bytes: 1,
    })
    installFilePicker([new File(['image'], 'new.png', { type: 'image/png' })])
    const manager = createSpriteManager({
      adapter: {
        getCurrentCharacterName: () => '阿珍',
        saveImage: async () => '/user/images/replaced.webp',
      } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('替换包')))!.click()
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    document.querySelector<HTMLButtonElement>('[data-action-id="replace"]')!.click()

    await vi.waitFor(() => {
      expect(settings.packs[0].sprites[0].url).toBe('/user/images/replaced.webp')
      expect(document.querySelector('.so-toast')?.textContent).toContain('已替换「旧图」')
    })
    manager.close()
  })

  it.each([
    { name: 'keeps the same index after deleting a middle sprite', start: 1, expectedTag: '第三张', expectedCaption: '第三张（2/2）' },
    { name: 'clamps to the previous sprite after deleting the end', start: 2, expectedTag: '第二张', expectedCaption: '第二张（2/2）' },
  ])('$name', ({ start, expectedTag, expectedCaption }) => {
    const { manager, getSettings } = openActionGallery(['第一张', '第二张', '第三张'])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    document.querySelectorAll<HTMLElement>('.so-sprite-cell')[start].click()

    document.querySelector<HTMLElement>('[data-action-id="delete"]')!.click()

    expect(getSettings().packs[0].sprites.map((item) => item.tag)).not.toContain(
      start === 1 ? '第二张' : '第三张',
    )
    expect(document.querySelector<HTMLImageElement>('.so-lightbox img')?.alt).toBe(expectedTag)
    expect(document.querySelector('.so-lightbox-caption')?.textContent).toBe(expectedCaption)
    manager.close()
  })

  it('closes the lightbox after deleting the final sprite', () => {
    const { manager, getSettings } = openActionGallery(['唯一一张'])
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    document.querySelector<HTMLElement>('[data-action-id="delete"]')!.click()

    expect(getSettings().packs[0].sprites).toEqual([])
    expect(document.querySelector('.so-lightbox')).toBeNull()
    manager.close()
  })

  it('exposes no edit actions for readonly packs', () => {
    const { manager } = openActionGallery(['只读'], 'preset_silver_loli')
    document.querySelector<HTMLElement>('.so-sprite-cell')!.click()

    expect(document.querySelectorAll('.so-sprite-actions')).toHaveLength(0)
    expect(document.querySelectorAll('.so-lightbox [data-action-id]')).toHaveLength(0)
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

describe('createSpriteManager bounded sprite gallery rendering', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('renders only the first 60 sprites from a 1000-sprite pack and loads one page at a time', () => {
    const manager = openLargeGallery()

    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(60)
    expect(document.body.textContent).toContain('60/1000')
    const firstCell = document.querySelector('.so-sprite-cell')

    findButton(document, '加载更多').click()
    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(120)
    expect(document.body.textContent).toContain('120/1000')
    expect(document.querySelector('.so-sprite-cell')).toBe(firstCell)

    manager.close()
  })

  it('never adds more than 60 sprites per load and removes the control at the end', () => {
    const manager = openLargeGallery()

    while (document.body.textContent?.includes('加载更多')) {
      const before = document.querySelectorAll('.so-sprite-cell').length
      findButton(document, '加载更多').click()
      const after = document.querySelectorAll('.so-sprite-cell').length
      expect(after - before).toBeLessThanOrEqual(60)
    }

    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(1000)
    expect(document.body.textContent).toContain('1000/1000')
    expect([...document.querySelectorAll<HTMLElement>('[role="button"]')]
      .some((item) => item.textContent === '加载更多')).toBe(false)

    manager.close()
  }, 15_000)

  it('keeps named groups before the ungrouped section when a group first appears on a later page', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'paged-groups',
        name: '分页分组包',
        sprites: [
          ...Array.from({ length: 60 }, (_, index) => ({
            tag: `未分组${index + 1}`,
            url: `https://img.test/plain-${index + 1}.png`,
          })),
          ...Array.from({ length: 10 }, (_, index) => ({
            tag: `分组${index + 1}`,
            url: `https://img.test/group-${index + 1}.png`,
            group: 'Z',
          })),
        ],
      }],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('分页分组包')))!.click()

    expect([...document.querySelectorAll('.so-group-head')].map((head) => head.textContent))
      .toEqual(['未分组'])
    findButton(document, '加载更多').click()
    expect([...document.querySelectorAll('.so-group-head')].map((head) => head.textContent))
      .toEqual(['Z', '未分组'])

    manager.close()
  })

  it('does not show a load-more control for packs of 60 sprites or fewer', () => {
    const manager = openLargeGallery(60)

    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(60)
    expect(document.body.textContent).toContain('60/60')
    expect([...document.querySelectorAll<HTMLElement>('[role="button"]')]
      .some((item) => item.textContent === '加载更多')).toBe(false)

    manager.close()
  })

  it('keeps lightbox navigation on the full sprite list beyond the rendered boundary', () => {
    const manager = openLargeGallery()
    const cells = document.querySelectorAll<HTMLElement>('.so-sprite-cell')

    cells[59].click()
    const img = document.querySelector<HTMLImageElement>('.so-lightbox img')
    expect(img?.src).toBe('https://img.test/60.png')

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    expect(img?.src).toBe('https://img.test/61.png')
    expect(document.querySelector('.so-lightbox-caption')?.textContent).toContain('61/1000')

    manager.close()
  })

  it('resets the 60-sprite render window when search or label filters change', () => {
    const manager = openLargeGallery(130)
    findButton(document, '加载更多').click()
    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(120)

    const search = document.querySelector<HTMLInputElement>('.so-gallery-search')!
    search.value = '图'
    search.dispatchEvent(new Event('input'))

    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(60)
    expect(document.querySelector('.so-sprite-count')?.textContent).toContain('60/130')
    manager.close()
  })

  it('deduplicates selected label chips and removes them on command', () => {
    let settings = largeGallerySettings(25)
    settings.packs[0].sprites.forEach((sprite, index) => { sprite.labels = [`标签${index + 1}`] })
    settings.packs[0].sprites[0].labels = ['动作']
    settings.packs[0].sprites[1].labels = ['动作', '室内']
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('千图包')))!.click()
    const labels = document.querySelector<HTMLSelectElement>('.so-gallery-label-select')!
    expect(labels.options).toHaveLength(26)

    labels.value = '动作'
    labels.dispatchEvent(new Event('change'))
    labels.value = '动作'
    labels.dispatchEvent(new Event('change'))

    expect(document.querySelectorAll('.so-gallery-filter-chip')).toHaveLength(1)
    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(2)
    document.querySelector<HTMLElement>('.so-gallery-filter-chip')!.click()
    expect(document.querySelectorAll('.so-gallery-filter-chip')).toHaveLength(0)
    expect(document.querySelectorAll('.so-sprite-cell')).toHaveLength(25)
    manager.close()
  })

  it('folds each role into a first-cover card stack and expands one horizontal row at a time', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      galleryFoldByRole: true,
      packs: [
        { id: 'a', name: '小雅居家', roleName: '小雅', sprites: [{ tag: '一', url: 'a' }] },
        { id: 'b', name: '小雅外出', roleName: '小雅', sprites: [{ tag: '二', url: 'b' }] },
        { id: 'c', name: '小雪居家', roleName: '小雪', sprites: [{ tag: '四', url: 'd' }] },
        { id: 'd', name: '小雪礼服', roleName: '小雪', sprites: [{ tag: '五', url: 'e' }] },
        { id: 'free', name: '独立包', sprites: [{ tag: '三', url: 'c' }] },
      ],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()

    const stacks = document.querySelectorAll<HTMLElement>('.so-role-pack-stack')
    expect(stacks).toHaveLength(2)
    expect(stacks[0].textContent).toContain('小雅')
    expect(stacks[0].textContent).toContain('2 个图包')
    expect(stacks[0].querySelector<HTMLImageElement>('.so-role-stack-cover img')?.getAttribute('src')).toBe('a')
    expect(stacks[0].querySelectorAll('[aria-hidden="true"].so-role-stack-layer')).toHaveLength(2)
    expect(document.querySelectorAll('.so-pack-card')).toHaveLength(1)
    expect(document.querySelector('.so-role-pack-standalone')).not.toBeNull()

    stacks[0].click()
    let strip = document.querySelector<HTMLElement>('.so-role-pack-strip')!
    expect(strip).not.toBeNull()
    expect(strip.querySelectorAll('.so-pack-card')).toHaveLength(2)
    expect(strip.scrollWidth).toBeGreaterThanOrEqual(strip.clientWidth)
    expect(document.querySelectorAll('.so-role-pack-stack')).toHaveLength(1)

    document.querySelector<HTMLElement>('.so-role-pack-stack')!.click()
    strip = document.querySelector<HTMLElement>('.so-role-pack-strip')!
    expect(strip.closest('.so-role-pack-group')?.textContent).toContain('小雪')
    expect(document.querySelectorAll('.so-role-pack-strip')).toHaveLength(1)
    manager.close()
  })

  it('edits pack prompt placement and notes for every known outfit', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'notes',
        name: '备注包',
        outfit: '居家',
        promptNote: '旧图包备注',
        promptNotePlacement: 'before-list',
        outfitNotes: { 居家: '旧居家备注', 礼服: '旧礼服备注' },
        sprites: [
          { tag: '日常', url: 'daily', outfit: '外出' },
          { tag: '休息', url: 'rest' },
        ],
      }],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('备注包')))!.click()

    const panel = [...document.querySelectorAll<HTMLDetailsElement>('details')]
      .find((details) => details.querySelector('summary')?.textContent === '包信息')
    expect(panel).not.toBeUndefined()
    panel!.open = true
    const promptNote = panel!.querySelector<HTMLTextAreaElement>('.so-pack-prompt-note')
    const placement = panel!.querySelector<HTMLSelectElement>('.so-pack-prompt-placement')
    expect(promptNote?.value).toBe('旧图包备注')
    expect(placement?.value).toBe('before-list')

    const notes = new Map(
      [...panel!.querySelectorAll<HTMLTextAreaElement>('.so-outfit-note-input')]
        .map((input) => [input.dataset.outfit!, input]),
    )
    expect([...notes.keys()]).toEqual(['居家', '外出', '礼服'])
    promptNote!.value = '仅在夜晚剧情使用'
    placement!.value = 'after-list'
    notes.get('居家')!.value = '适用于居家场景'
    notes.get('外出')!.value = '适用于外出场景'
    notes.get('礼服')!.value = ''
    findButton(panel!, '保存包信息').click()

    const updated = settings.packs[0]
    expect(updated.promptNote).toBe('仅在夜晚剧情使用')
    expect(updated.promptNotePlacement).toBe('after-list')
    expect(updated.outfitNotes).toEqual({
      居家: '适用于居家场景',
      外出: '适用于外出场景',
    })
    manager.close()
  })

  it('shows the same placement default the prompt builder injects with', () => {
    // 导入的 @3 包可能只带 promptNote 不带 placement：面板显示的位置必须与
    // buildPromptSceneNotes 实际采用的默认位置一致，否则用户改个包名点保存
    // 就把注入位置静默改掉了。
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'imported',
        name: '导入包',
        roleName: '小雪',
        promptNote: '导入包备注',
        sprites: [{ tag: '微笑', url: 'smile' }],
      }],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '小雪' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('导入包')))!.click()

    const panel = openPackInfoPanel()
    const shown = panel.querySelector<HTMLSelectElement>('.so-pack-prompt-placement')!.value
    expect(shown).toBe(DEFAULT_PROMPT_NOTE_PLACEMENT)
    expect(buildPromptSceneNotes(settings.packs, [{ role: '小雪', outfit: '', tag: '微笑' }]))
      .toEqual([{ role: '小雪', outfit: '', note: '导入包备注', placement: shown }])

    // 只改包名保存：placement 不能被写成另一个值
    panel.querySelector<HTMLInputElement>('input')!.value = '改名后的包'
    findButton(panel, '保存包信息').click()
    expect(settings.packs[0].promptNotePlacement).toBe(DEFAULT_PROMPT_NOTE_PLACEMENT)
    manager.close()
  })

  it('keys outfit notes by the normalized outfit name so injection can match them', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'dirty-outfit',
        name: '脏服装包',
        roleName: '小雪',
        sprites: [{ tag: '微笑', url: 'smile' }],
      }],
    }
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '小雪' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('脏服装包')))!.click()

    // 「居家:服」的冒号会被 normalizeTag 剔除；备注键必须跟着规范化，
    // 否则存下来的键与 pack.outfit 不同源，注入时永远匹配不上。
    const panel = openPackInfoPanel()
    const outfitInput = [...panel.querySelectorAll<HTMLInputElement>('input')]
      .find((input) => input.placeholder === '服装（可空）')!
    outfitInput.value = '居家:服'
    outfitInput.dispatchEvent(new Event('change'))

    const note = panel.querySelector<HTMLTextAreaElement>('.so-outfit-note-input')!
    expect(note.dataset.outfit).toBe('居家服')
    note.value = '适用于居家场景'
    findButton(panel, '保存包信息').click()

    const saved = settings.packs[0]
    expect(saved.outfit).toBe('居家服')
    expect(saved.outfitNotes).toEqual({ 居家服: '适用于居家场景' })
    expect(buildPromptSceneNotes(saved ? [saved] : [], [{ role: '小雪', outfit: '居家服', tag: '微笑' }]))
      .toEqual([{ role: '小雪', outfit: '居家服', note: '适用于居家场景', placement: DEFAULT_PROMPT_NOTE_PLACEMENT }])
    manager.close()
  })

  it('caps note inputs at the persisted note length so saving never truncates silently', () => {
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '小雪' } as STAdapter,
      getSettings: () => ({
        ...createDefaultSettings(),
        packs: [{ id: 'cap', name: '上限包', outfit: '居家', sprites: [{ tag: '微笑', url: 'smile' }] }],
      }),
      updateSettings: () => {},
    })
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('上限包')))!.click()

    const panel = openPackInfoPanel()
    expect(panel.querySelector<HTMLTextAreaElement>('.so-pack-prompt-note')!.maxLength)
      .toBe(MAX_NOTE_CODE_POINTS)
    expect(panel.querySelector<HTMLTextAreaElement>('.so-outfit-note-input')!.maxLength)
      .toBe(MAX_NOTE_CODE_POINTS)
    manager.close()
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
    enableAutoSplit(modal)

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
    enableAutoSplit(modal)

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

describe('createSpriteManager 实测反馈批次（上传默认不拆分 / 批量管理 / 保存不折叠 / 勾选启用）', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    imageMocks.compressImage.mockReset()
  })

  function threePackSettings(): PluginSettings {
    return {
      ...createDefaultSettings(),
      packs: [
        { id: 'a', name: '甲包', sprites: [{ tag: '微笑', url: 'a-url' }] },
        { id: 'b', name: '乙包', sprites: [{ tag: '生气', url: 'b-url' }] },
        { id: 'c', name: '丙包', sprites: [{ tag: '哭泣', url: 'c-url' }] },
      ],
      bindings: [{ characterName: '阿珍', packIds: ['a'], enabled: true }],
    }
  }

  function createManager(initial: PluginSettings) {
    let settings = initial
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    return { manager, getSettings: () => settings }
  }

  it('上传预览默认不拆分：整名作图名，人名/服装输入禁用；勾选后才按前缀拆分', () => {
    const { manager } = createManager(uploadSettings())
    const modal = openUploadPreview(manager, '当前包', [new File(['a'], '鸣人-居家服-微笑.png')])

    const tagInput = [...modal.querySelectorAll<HTMLInputElement>('input')]
      .find((input) => input.placeholder === '图名')
    const roleInput = [...modal.querySelectorAll<HTMLInputElement>('input')]
      .find((input) => input.placeholder === '人名')
    expect(tagInput?.value).toBe('鸣人-居家服-微笑')
    expect(roleInput?.disabled).toBe(true)
    expect(roleInput?.value).toBe('')

    enableAutoSplit(modal)
    const roleAfter = [...modal.querySelectorAll<HTMLInputElement>('input')]
      .find((input) => input.placeholder === '人名')
    const tagAfter = [...modal.querySelectorAll<HTMLInputElement>('input')]
      .find((input) => input.placeholder === '图名')
    expect(roleAfter?.disabled).toBe(false)
    expect(roleAfter?.value).toBe('鸣人')
    expect(tagAfter?.value).toBe('微笑')
    manager.close()
  })

  it('批量管理：点卡片勾选、删除所选、◀▶ 调整包顺序', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { manager, getSettings } = createManager(threePackSettings())
    manager.open()

    findButton(document, '批量管理').click()
    const cardOf = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('.so-pack-card')]
        .find((card) => card.textContent?.includes(name))!

    // 后移甲包：a b c → b a c
    ;([...cardOf('甲包').querySelectorAll<HTMLElement>('[role="button"]')]
      .find((btn) => btn.getAttribute('aria-label') === '后移'))!.click()
    expect(getSettings().packs.map((p) => p.id)).toEqual(['b', 'a', 'c'])

    // 勾选乙包 + 丙包后删除：只剩甲包，绑定保留
    cardOf('乙包').click()
    cardOf('丙包').click()
    findButton(document, '删除所选（2）').click()
    expect(getSettings().packs.map((p) => p.id)).toEqual(['a'])
    expect(getSettings().bindings).toEqual([{ characterName: '阿珍', packIds: ['a'], enabled: true }])

    findButton(document, '完成').click()
    expect(document.querySelector('.so-batch-tip')).toBeNull()
    manager.close()
  })

  it('保存包信息后面板保持展开、按钮独占一行', () => {
    const { manager, getSettings } = createManager(threePackSettings())
    manager.open()
    ;([...document.querySelectorAll<HTMLElement>('.so-pack-card')]
      .find((card) => card.textContent?.includes('甲包')))!.click()

    const panel = openPackInfoPanel()
    panel.dispatchEvent(new Event('toggle'))
    const nameInput = panel.querySelector<HTMLInputElement>('input')!
    nameInput.value = '甲包改名'
    findButton(panel, '保存包信息').click()

    expect(getSettings().packs.find((p) => p.id === 'a')?.name).toBe('甲包改名')
    const panelAfter = [...document.querySelectorAll<HTMLDetailsElement>('details')]
      .find((details) => details.querySelector('summary')?.textContent === '包信息')
    expect(panelAfter?.open).toBe(true)
    expect(panelAfter?.querySelector('.so-meta-save-row')).not.toBeNull()
    manager.close()
  })

  it('启用包勾选浮层：勾=启用、取消勾=停用，操作后浮层保持展开', () => {
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { manager, getSettings } = createManager(threePackSettings())
    manager.open()

    findButton(document, '启用包（1） ▾').click()
    const panel = document.querySelector<HTMLElement>('.so-popover[data-pop="启用包"]')
    expect(panel).not.toBeNull()
    const rowOf = (name: string) =>
      [...document.querySelectorAll<HTMLElement>('.so-popover[data-pop="启用包"] label')]
        .find((row) => row.textContent?.includes(name))!

    const bInput = rowOf('乙包').querySelector<HTMLInputElement>('input')!
    bInput.checked = true
    bInput.dispatchEvent(new Event('change'))
    expect(getSettings().bindings[0].packIds).toEqual(['a', 'b'])
    // 提交触发整体重渲染后浮层原地重建
    expect(document.querySelector('.so-popover[data-pop="启用包"]')).not.toBeNull()

    const aInput = rowOf('甲包').querySelector<HTMLInputElement>('input')!
    expect(aInput.checked).toBe(true)
    aInput.checked = false
    aInput.dispatchEvent(new Event('change'))
    expect(getSettings().bindings[0].packIds).toEqual(['b'])
    expect(document.querySelector('.so-popover[data-pop="启用包"]')).not.toBeNull()
    manager.close()
  })
})

vi.mock('../../core/imgbb', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../core/imgbb')>()
  return { ...actual, uploadToImgbb: imgbbMocks.uploadToImgbb }
})

describe('createSpriteManager safe pack deletion', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
  })

  it('removes metadata only when local deletion is declined', async () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{ id: 'a', name: '本地包', sprites: [{ tag: '微笑', url: '/user/images/a.webp' }] }],
    }
    const deleteImage = vi.fn()
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false)
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍', deleteImage } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    document.querySelector<HTMLElement>('.so-pack-card')!.click()

    findButton(document, '删除立绘包').click()
    await Promise.resolve()

    expect(settings.packs).toHaveLength(0)
    expect(deleteImage).not.toHaveBeenCalled()
    manager.close()
  })

  it('keeps pack metadata when physical deletion fails so the user can retry', async () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'a', name: '本地包', sprites: [
          { tag: '成功', url: '/user/images/a.webp' },
          { tag: '失败', url: '/user/images/b.webp' },
        ],
      }],
    }
    const deleteImage = vi.fn()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('HTTP 500'))
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍', deleteImage } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    manager.open()
    document.querySelector<HTMLElement>('.so-pack-card')!.click()

    findButton(document, '删除立绘包').click()
    await vi.waitFor(() => expect(deleteImage).toHaveBeenCalledTimes(2))

    expect(settings.packs).toHaveLength(1)
    expect(document.querySelector('.so-toast')?.textContent).toContain('图包尚未删除，可再次重试')
    manager.close()
  })
})

describe('createSpriteManager selected-pack resource actions', () => {
  afterEach(() => {
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
    imageMocks.compressImage.mockReset()
    imgbbMocks.uploadToImgbb.mockReset()
  })

  function selectAll(manager: ReturnType<typeof createSpriteManager>): void {
    manager.open()
    findButton(document, '批量管理').click()
    findButton(document, '全选').click()
  }

  it('uploads selected packs to imgbb sequentially and keeps local display URLs', async () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      imgbbApiKey: 'key',
      packs: [
        { id: 'a', name: '甲', sprites: [{ tag: '一', url: 'data:image/png;base64,QQ==' }] },
        { id: 'b', name: '乙', sprites: [{ tag: '二', url: 'data:image/png;base64,Qg==' }] },
      ],
    }
    imgbbMocks.uploadToImgbb
      .mockResolvedValueOnce({ url: 'https://i.ibb.co/a.webp', code: 'a.webp' })
      .mockResolvedValueOnce({ url: 'https://i.ibb.co/b.webp', code: 'b.webp' })
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    selectAll(manager)

    findButton(document, '上传云端（2）').click()
    await vi.waitFor(() => expect(imgbbMocks.uploadToImgbb).toHaveBeenCalledTimes(2))

    expect(settings.packs[0].sprites[0]).toMatchObject({
      url: 'data:image/png;base64,QQ==', remoteUrl: 'https://i.ibb.co/a.webp', code: 'a.webp',
    })
    expect(settings.packs[1].sprites[0].remoteUrl).toBe('https://i.ibb.co/b.webp')
    expect(document.querySelector('.so-toast')?.textContent).toContain('上传云端完成：成功 2 张，失败 0 张')
    manager.close()
  })

  it('localizes hosted sprites in selected packs and summarizes retryable failures', async () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        { id: 'a', name: '甲', sprites: [{ tag: '一', url: 'https://img.test/a.webp' }] },
        { id: 'b', name: '乙', sprites: [{ tag: '二', url: 'https://img.test/b.webp' }] },
      ],
    }
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        headers: { get: () => null },
        blob: async () => new Blob(['a'], { type: 'image/webp' }),
      })
      .mockRejectedValueOnce(new Error('offline')))
    imageMocks.compressImage.mockResolvedValue({
      dataUri: 'data:image/webp;base64,QQ==', compressed: false, bytes: 1,
    })
    const saveImageFile = vi.fn().mockResolvedValue('/user/images/local-a.webp')
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍', saveImageFile } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    selectAll(manager)

    findButton(document, '保存本地（2）').click()
    await vi.waitFor(() => expect(document.querySelector('.so-toast')?.textContent).toContain('保存本地完成'))

    expect(settings.packs[0].sprites[0]).toMatchObject({
      url: '/user/images/local-a.webp', remoteUrl: 'https://img.test/a.webp',
    })
    expect(settings.packs[1].sprites[0].url).toBe('https://img.test/b.webp')
    expect(document.querySelector('.so-toast')?.textContent).toContain('成功 1 张，失败 1 张')
    manager.close()
  })

  it('selects a hosted preset, saves it as a persistent local copy, and replaces active bindings', async () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [{
        id: 'preset_seraphina_casual',
        name: '塞拉菲娜预设',
        roleName: '塞拉菲娜',
        outfit: '常服',
        sprites: [{ tag: '中性', url: 'https://img.test/preset.webp' }],
      }],
      bindings: [{ characterName: '阿珍', packIds: ['preset_seraphina_casual'], enabled: true }],
    }
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: { get: () => null },
      blob: async () => new Blob(['preset'], { type: 'image/webp' }),
    }))
    imageMocks.compressImage.mockResolvedValue({
      dataUri: 'data:image/webp;base64,QQ==', compressed: false, bytes: 1,
    })
    const saveImageFile = vi.fn().mockResolvedValue('/user/images/preset-local.webp')
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍', saveImageFile } as unknown as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    selectAll(manager)

    findButton(document, '保存本地（1）').click()
    await vi.waitFor(() => expect(document.querySelector('.so-toast')?.textContent).toContain('保存本地完成'))

    const preset = settings.packs.find((pack) => pack.id === 'preset_seraphina_casual')!
    const localCopy = settings.packs.find((pack) => !pack.id.startsWith('preset_'))!
    expect(preset.sprites[0].url).toBe('https://img.test/preset.webp')
    expect(localCopy).toMatchObject({ name: '塞拉菲娜预设（本地）', roleName: '塞拉菲娜', outfit: '常服' })
    expect(localCopy.sprites[0]).toMatchObject({
      url: '/user/images/preset-local.webp',
      remoteUrl: 'https://img.test/preset.webp',
    })
    expect(settings.bindings[0].packIds).toEqual([localCopy.id])
    manager.close()
  })

  it('allows preset selection for resource actions but excludes presets from deletion', () => {
    let settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        { id: 'preset_seraphina_casual', name: '预设', sprites: [{ tag: '一', url: 'https://img.test/a.webp' }] },
        { id: 'custom', name: '自建', sprites: [{ tag: '二', url: '/user/images/b.webp' }] },
      ],
    }
    vi.spyOn(window, 'confirm').mockReturnValueOnce(true).mockReturnValueOnce(false)
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
    })
    selectAll(manager)

    expect(findButton(document, '保存本地（2）')).toBeTruthy()
    findButton(document, '删除所选（1）').click()

    expect(settings.packs.map((pack) => pack.id)).toEqual(['preset_seraphina_casual'])
    manager.close()
  })

  it('copies one share string per selected pack', async () => {
    const settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        { id: 'a', name: '甲', sprites: [{ tag: '一', url: 'https://img.test/a.webp' }] },
        { id: 'b', name: '乙', sprites: [{ tag: '二', url: 'https://img.test/b.webp' }] },
      ],
    }
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } })
    const manager = createSpriteManager({
      adapter: { getCurrentCharacterName: () => '阿珍' } as STAdapter,
      getSettings: () => settings,
      updateSettings: vi.fn(),
    })
    selectAll(manager)

    findButton(document, '复制分享串（2）').click()
    await vi.waitFor(() => expect(writeText).toHaveBeenCalledOnce())

    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain('stpack2:甲|')
    expect(copied).toContain('stpack2:乙|')
    expect(copied.split('\n\n')).toHaveLength(2)
    manager.close()
  })
})
