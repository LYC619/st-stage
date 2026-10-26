// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings, type PluginSettings } from '../../core/types'
import { openImageStorageDialog } from './image-storage-dialog'
import { createMigrationReceipt, createStorageBackup } from '../../core/image-storage-backup'
import { scanEmbeddedImages } from '../../core/image-storage'
import { openAppModal } from '../../core/app-modal'
import { loadTranslations, resetI18n, setLocale } from '../../core/i18n'
import en from '../locales/en-US.json'

const embedded = 'data:image/png;base64,QUFB'
function findButton(text: string): HTMLButtonElement {
  const button = [...document.querySelectorAll<HTMLButtonElement>('button')].find((item) => item.textContent === text)
  if (!button) throw new Error('button not found: ' + text)
  return button
}

function confirmReceipt(): void {
  const input = document.querySelector<HTMLInputElement>('[data-confirm="receipt"]')!
  expect(input).not.toBeNull()
  input.checked = true
  input.dispatchEvent(new Event('change'))
}

function confirmBackup(): void {
  const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
  input.checked = true
  input.dispatchEvent(new Event('change'))
}

beforeEach(() => {
  vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
})

afterEach(() => {
  resetI18n()
  document.body.innerHTML = ''
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('image storage migration dialog', () => {
  it('translates backup, staged migration and apply feedback while preserving confirmation gates', async () => {
    loadTranslations('en-US', en)
    setLocale('en-US')
    let settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '用户名称', sprites: [{ tag: '一', url: embedded }] }] }
    const updateSettings = vi.fn((next: PluginSettings) => { settings = next })
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings, saveDataUri: async () => '/user/images/migrated.png', onClosed: vi.fn() })
    expect(document.querySelector('.so-storage-dialog')?.getAttribute('aria-label')).toBe('Storage check & migration')
    expect(document.querySelector('.so-storage-dialog')?.textContent).toContain('1 embedded image references')
    findButton('Download current plugin backup').click()
    expect(findButton('Migrate embedded images').disabled).toBe(true)
    confirmBackup()
    findButton('Migrate embedded images').click()
    await vi.waitFor(() => expect(findButton('Download migration receipt').disabled).toBe(false))
    expect(updateSettings).not.toHaveBeenCalled()
    findButton('Download migration receipt').click()
    confirmReceipt()
    findButton('Apply successful items').click()
    expect(document.querySelector('.so-storage-status')?.textContent).toContain('Applied 1 item(s)')
    expect(settings.packs[0].name).toBe('用户名称')
    controller.close()
  })

  it('owns focus above an App dialog and handles only one Escape layer at a time', () => {
    const settings = createDefaultSettings()
    const closeOuter = openAppModal(body => { body.innerHTML = '<button id="storage-opener">Storage</button>' }, { onOpen() {}, onClose() {} })
    const opener = document.querySelector<HTMLElement>('#storage-opener')!
    opener.focus()
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings: vi.fn(), saveDataUri: vi.fn(), onClosed: vi.fn() })
    const dialog = document.querySelector('.so-storage-dialog')!
    expect(dialog.contains(document.activeElement)).toBe(true)
    const close = findButton('关闭')
    close.focus()
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(findButton('下载当前插件状态备份'))
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(document.querySelector('.so-storage-dialog')).toBeNull()
    expect(document.querySelector('.so-app-modal')).not.toBeNull()
    expect(document.activeElement).toBe(opener)
    controller.close()
    closeOuter()
  })

  it.each(['before staging', 'before applying'])('blocks newly unmapped raw images %s', async (when) => {
    const settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: 'pack', sprites: [{ tag: 'a', url: embedded }] }] }
    let raw: unknown = settings
    const updateSettings = vi.fn()
    const saveDataUri = vi.fn(async () => '/user/images/a.png')
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => raw } as never,
      getSettings: () => settings, updateSettings, saveDataUri, onClosed: vi.fn() })
    findButton('下载当前插件状态备份').click()
    confirmBackup()
    const changeRaw = () => { raw = { ...settings, presetOverrides: { old: { localSprites: { old: embedded } } } } }
    if (when === 'before staging') changeRaw()
    findButton('开始迁移内嵌图片').click()
    if (when === 'before applying') {
      await vi.waitFor(() => expect(findButton('下载迁移回执').disabled).toBe(false))
      findButton('下载迁移回执').click()
      confirmReceipt()
      changeRaw()
      findButton('确认应用成功项').click()
    } else {
      await Promise.resolve()
      expect(saveDataUri).not.toHaveBeenCalled()
    }
    expect(updateSettings).not.toHaveBeenCalled()
    expect(document.querySelector('.so-storage-status')?.textContent).toContain('未能映射')
    expect(findButton('开始迁移内嵌图片').disabled).toBe(true)
    controller.close()
  })

  it('does not apply before backup and receipt confirmations', async () => {
    let settings: PluginSettings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    const updateSettings = vi.fn((next: PluginSettings) => { settings = next })
    const saveDataUri = vi.fn(async () => '/user/images/migrated.png')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const controller = openImageStorageDialog({
      adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings,
      updateSettings,
      saveDataUri,
      onClosed: vi.fn(),
    })
    const start = findButton('开始迁移内嵌图片')
    expect(start.disabled).toBe(true)
    findButton('下载当前插件状态备份').click()
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    expect(start.disabled).toBe(false)
    start.click()
    await vi.waitFor(() => expect(findButton('下载迁移回执').disabled).toBe(false))
    expect(updateSettings).not.toHaveBeenCalled()
    findButton('下载迁移回执').click()
    expect(findButton('确认应用成功项').disabled).toBe(true)
    confirmReceipt()
    expect(findButton('确认应用成功项').disabled).toBe(false)
    expect(updateSettings).not.toHaveBeenCalled()
    findButton('确认应用成功项').click()
    expect(updateSettings).toHaveBeenCalledOnce()
    expect(settings.packs[0].sprites[0].url).toBe('/user/images/migrated.png')
    controller.close()
  })

  it('keeps settings unchanged when staging fails', async () => {
    const settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    const updateSettings = vi.fn()
    const saveDataUri = vi.fn().mockRejectedValue(new Error('HTTP 413'))
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings, saveDataUri, onClosed: vi.fn() })
    findButton('下载当前插件状态备份').click()
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    findButton('开始迁移内嵌图片').click()
    await vi.waitFor(() => expect(document.querySelector('.so-storage-status')?.textContent).toContain('未完成'))
    expect(updateSettings).not.toHaveBeenCalled()
    controller.close()
  })

  it('disables migration for ambiguous references and unmapped embedded values', () => {
    const settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [
      { tag: '一', url: embedded },
      { tag: '一', url: '/user/images/other.png' },
    ] }] }
    const controller = openImageStorageDialog({
      adapter: { getStoredSettingsForBackup: () => ({ ...settings, packs: [{ id: 'preset_seraphina_casual', name: '预设', sprites: [{ tag: '一', url: embedded }] }] }) } as never,
      getSettings: () => settings,
      updateSettings: vi.fn(),
      saveDataUri: vi.fn(),
      onClosed: vi.fn(),
    })
    findButton('下载当前插件状态备份').click()
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    expect(findButton('开始迁移内嵌图片').disabled).toBe(true)
    expect(document.querySelector('.so-storage-status')?.textContent).toContain('不能自动迁移')
    controller.close()
  })

  it('requires a new backup when the embedded candidate changes after backup', () => {
    let settings: PluginSettings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    const saveDataUri = vi.fn(async () => '/user/images/migrated.png')
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const controller = openImageStorageDialog({
      adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings,
      updateSettings: vi.fn(),
      saveDataUri,
      onClosed: vi.fn(),
    })
    findButton('下载当前插件状态备份').click()
    settings = { ...settings, packs: [{ ...settings.packs[0], sprites: [{ tag: '一', url: 'data:image/png;base64,QkJC' }] }] }
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    findButton('开始迁移内嵌图片').click()
    expect(saveDataUri).not.toHaveBeenCalled()
    expect(document.querySelector('.so-storage-status')?.textContent).toContain('重新下载备份')
    controller.close()
  })

  it('requires confirmation again after downloading a replacement backup', () => {
    const settings: PluginSettings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const controller = openImageStorageDialog({
      adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings,
      updateSettings: vi.fn(),
      saveDataUri: vi.fn(),
      onClosed: vi.fn(),
    })
    const backupButton = findButton('下载当前插件状态备份')
    backupButton.click()
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    expect(findButton('开始迁移内嵌图片').disabled).toBe(false)
    backupButton.click()
    expect(checkbox.checked).toBe(false)
    expect(findButton('开始迁移内嵌图片').disabled).toBe(true)
    controller.close()
  })

  it('does not apply a late staging result after the dialog is closed', async () => {
    let release!: () => void
    const pending = new Promise<string>((resolve) => { release = () => resolve('/user/images/migrated.png') })
    const settings: PluginSettings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    const updateSettings = vi.fn()
    const saveDataUri = vi.fn(() => pending)
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const controller = openImageStorageDialog({
      adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings,
      updateSettings,
      saveDataUri,
      onClosed: vi.fn(),
    })
    findButton('下载当前插件状态备份').click()
    const checkbox = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    checkbox.checked = true
    checkbox.dispatchEvent(new Event('change'))
    findButton('开始迁移内嵌图片').click()
    controller.close()
    release()
    await Promise.resolve()
    await Promise.resolve()
    expect(updateSettings).not.toHaveBeenCalled()
    expect(document.querySelector('.so-storage-backdrop')).toBeNull()
  })

  it('keeps partial successes staged until confirmed and reports failures without their image bytes', async () => {
    let settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [
      { tag: '一', url: embedded }, { tag: '二', url: 'data:image/gif;base64,QkJC' },
    ] }] }
    const updateSettings = vi.fn((next: PluginSettings) => { settings = next })
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings, onClosed: vi.fn(),
      saveDataUri: vi.fn().mockResolvedValueOnce('/user/images/a.png').mockRejectedValueOnce(new Error('HTTP 413')) })
    findButton('下载当前插件状态备份').click()
    confirmBackup()
    findButton('开始迁移内嵌图片').click()
    await vi.waitFor(() => expect(findButton('下载迁移回执').disabled).toBe(false))
    expect(updateSettings).not.toHaveBeenCalled()
    expect(document.querySelector('.so-storage-status')?.textContent).toContain('失败 1')
    expect(document.querySelector('.so-storage-errors')?.textContent).toContain('HTTP 413')
    expect(document.querySelector('.so-storage-dialog')?.textContent).not.toContain(embedded)
    findButton('下载迁移回执').click()
    confirmReceipt()
    findButton('确认应用成功项').click()
    expect(settings.packs[0].sprites.map((sprite) => sprite.url)).toEqual(['/user/images/a.png', 'data:image/gif;base64,QkJC'])
    controller.close()
  })

  it('revokes downloaded blobs and clears timers when closed', () => {
    vi.useFakeTimers()
    const scheduled = vi.spyOn(window, 'setTimeout')
    const cleared = vi.spyOn(window, 'clearTimeout')
    const settings = createDefaultSettings()
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings: vi.fn(), saveDataUri: vi.fn(), onClosed: vi.fn() })
    findButton('下载当前插件状态备份').click()
    controller.close()
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:test')
    const revokeTimer = scheduled.mock.calls.findIndex((call) => call[1] === 60_000)
    expect(cleared).toHaveBeenCalledWith(scheduled.mock.results[revokeTimer].value)
    // Focusing the dialog queues jsdom's own selectionchange notification.
    vi.advanceTimersByTime(0)
    expect(vi.getTimerCount()).toBe(0)
  })

  it('invalidates prior confirmation when a replacement download fails', () => {
    const settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings: vi.fn(), saveDataUri: vi.fn(), onClosed: vi.fn() })
    findButton('下载当前插件状态备份').click()
    confirmBackup()
    vi.mocked(HTMLAnchorElement.prototype.click).mockImplementationOnce(() => { throw new Error('download failed') })
    findButton('下载当前插件状态备份').click()
    expect(findButton('开始迁移内嵌图片').disabled).toBe(true)
    controller.close()
  })

  it('cancels staging without waiting for a hung save or accepting its late result', async () => {
    const settings = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [{ tag: '一', url: embedded }] }] }
    let resolve!: (url: string) => void
    const pending = new Promise<string>((done) => { resolve = done })
    const updateSettings = vi.fn()
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings, saveDataUri: () => pending, onClosed: vi.fn() })
    findButton('下载当前插件状态备份').click()
    confirmBackup()
    findButton('开始迁移内嵌图片').click()
    findButton('取消暂存').click()
    expect(findButton('下载当前插件状态备份').disabled).toBe(false)
    resolve('/user/images/late.png')
    await Promise.resolve()
    await Promise.resolve()
    expect(updateSettings).not.toHaveBeenCalled()
    expect(findButton('下载迁移回执').disabled).toBe(true)
    controller.close()
  })

  it('restores only unchanged migrated images after a fresh current-state backup', async () => {
    const original = { ...createDefaultSettings(), packs: [{ id: 'p', name: '包', sprites: [
      { tag: '一', url: embedded }, { tag: '二', url: 'data:image/gif;base64,QkJC' },
    ] }] }
    const backup = createStorageBackup(original, original, 'f'.repeat(32), 'now')
    const receipt = createMigrationReceipt(backup, scanEmbeddedImages(original).candidates.map((candidate, i) => ({
      ref: candidate.ref, expectedUrl: candidate.sourceUrl, nextUrl: `/user/images/${i}.png`,
    })))
    let settings: PluginSettings = { ...original, apps: { private: { changed: true } }, packs: [{ ...original.packs[0],
      sprites: [{ tag: '一', url: '/user/images/0.png' }, { tag: '二', url: '/user/images/edited.png' }] }] }
    const updateSettings = vi.fn((next: PluginSettings) => { settings = next })
    const controller = openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings } as never,
      getSettings: () => settings, updateSettings, saveDataUri: vi.fn(), onClosed: vi.fn() })
    for (const [label, content] of [['迁移前备份', backup], ['迁移回执', receipt]] as const) {
      const input = document.querySelector<HTMLInputElement>(`input[aria-label="${label}"]`)!
      expect(input).not.toBeNull()
      Object.defineProperty(input, 'files', { value: [new File([JSON.stringify(content)], 'test.json')] })
      input.dispatchEvent(new Event('change'))
    }
    await vi.waitFor(() => expect(findButton('检查恢复文件').disabled).toBe(false))
    findButton('检查恢复文件').click()
    await vi.waitFor(() => expect(document.querySelector('.so-storage-status')?.textContent).toContain('可恢复 1'))
    expect(findButton('确认恢复图片').disabled).toBe(true)
    findButton('下载当前插件状态备份').click()
    confirmBackup()
    findButton('确认恢复图片').click()
    expect(updateSettings).toHaveBeenCalledOnce()
    expect(settings.packs[0].sprites.map((sprite) => sprite.url)).toEqual([embedded, '/user/images/edited.png'])
    expect(settings.apps).toEqual({ private: { changed: true } })
    controller.close()
  })
})
