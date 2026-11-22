// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../../../core/i18n'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import en from '../../../locales/en-US.json'
import zh from '../../../locales/zh-CN.json'
import { createSTCloudExportBridge, type CloudExportBridge } from './bridge'
import { cloudExportApp } from './export-app'
import { loadSelectedExportFiles } from './export-loader'
import { buildCharacterFiles, buildExportFiles } from './manifest'
import { assertUniqueArchivePaths, downloadSTBackup } from './zip'
import type { ExportChat, ExportSelection, ExportSnapshot } from './types'

const character = { id: 'Alice.png', avatar: 'Alice.png', name: 'Alice', chats: [] }
const chat = { id: 'Alice.png:first', name: 'first', path: 'first.jsonl' }
const catalog: ExportSnapshot = { characters: [{ ...character, chats: [chat] }], worldbooks: [], presets: [], regex: null }
function selection(): ExportSelection { return { characterIds: new Set(), chatIds: new Set(), worldbookIds: new Set(), presetIds: new Set(), regex: false } }
function bridge(): CloudExportBridge {
  return {
    listCharacters: vi.fn(async () => [character]), listChats: vi.fn(async () => [chat]),
    listWorldbooks: vi.fn(async () => [{ id: '世界.json', name: '世界', fileName: '世界.json' }]),
    loadSettingsAssets: vi.fn(async () => ({ presets: [{ id: '预设.json', name: '预设', fileName: '预设.json', content: { prompt: '原始内容' } }], regex: { rules: [{ find: '原始正则' }] } })),
    readCharacterCard: vi.fn(async () => new ArrayBuffer(1)), readChat: vi.fn(async () => '{"mes":"原始聊天"}\n'),
    readWorldbook: vi.fn(async () => ({ entries: { content: '原始内容' } })),
  }
}
function deferred<T>() { let resolve!: (value: T) => void; const promise = new Promise<T>(done => { resolve = done }); return { resolve, promise } }
async function settle() { await new Promise(resolve => setTimeout(resolve, 0)) }
function control(container: HTMLElement, text: string): HTMLElement {
  const result = [...container.querySelectorAll<HTMLElement>('button, [role="button"], [role="tab"]')].find(node => node.textContent === text)
  if (!result) throw new Error(`Missing control: ${text}`)
  return result
}
const mounted: ReturnType<typeof cloudExportApp>[] = []
function mount(api = bridge(), download = vi.fn<typeof downloadSTBackup>(async () => {})) {
  const container = document.createElement('div'); document.body.append(container)
  const toast = vi.fn(); const app = cloudExportApp(api, download); mounted.push(app)
  app.mount(container, { toast } as unknown as PhoneAppContext)
  return { container, toast, app, api, download }
}
beforeEach(() => { loadTranslations('en-US', en); loadTranslations('zh-CN', zh); setLocale('en-US') })
afterEach(() => { mounted.splice(0).forEach(app => app.unmount?.()); document.body.replaceChildren(); resetI18n(); vi.unstubAllGlobals(); vi.restoreAllMocks() })

describe('Cloud Export translated UI and keyboard ownership', () => {
  it('loads actual English copy after module import and keeps raw asset names and archive contents', async () => {
    const { container, app, download } = mount()
    await settle()
    expect(app.name).toBe('Export')
    expect(container.textContent).toContain('Selective SillyTavern Backup')
    expect(container.querySelector('input.so-app-input')?.getAttribute('aria-label')).toBe('Search this category')
    expect([...container.querySelectorAll('[role="tab"]')].map(node => node.textContent)).toEqual(['Characters', 'Worldbooks', 'Presets', 'Regex'])
    expect(container.textContent).toContain('Update time unknown')
    control(container, 'Worldbooks').click(); await settle()
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!; box.click()
    control(container, 'Presets').click(); await settle()
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    control(container, 'Regex').click(); await settle()
    expect(container.textContent).toContain('Global regex (1 rules)')
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click()
    control(container, 'Export selected backup').click(); await settle()
    const files = download.mock.calls[0] as unknown as [Array<{ path: string; data: string }>]
    expect(files[0].map(file => file.path)).toEqual(['settings.json', 'worlds/世界.json', 'OpenAI Settings/预设.json'])
    expect(JSON.parse(files[0][0].data)).toEqual({ extension_settings: { regex: [{ find: '原始正则' }] }, world_info_settings: { world_info: { globalSelect: ['世界'] } } })
    expect(JSON.parse(files[0][2].data)).toEqual({ prompt: '原始内容' })
    expect(container.textContent).not.toMatch(/[\u4e00-\u9fff]/)
  })

  it('gives tabs relationships, roving focus and arrow/Home/End navigation', async () => {
    const { container, api } = mount(); await settle()
    const first = control(container, 'Characters'); first.focus()
    expect(first.getAttribute('aria-selected')).toBe('true')
    expect(container.querySelector('[role="tablist"]')?.getAttribute('aria-label')).toBe('Backup categories')
    first.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true })); await settle()
    const world = control(container, 'Worldbooks')
    expect(document.activeElement).toBe(world)
    expect(world.tabIndex).toBe(0)
    expect(control(container, 'Characters').tabIndex).toBe(-1)
    const panel = container.querySelector('[role="tabpanel"]')!
    expect(world.getAttribute('aria-controls')).toBe(panel.id)
    expect(panel.getAttribute('aria-labelledby')).toBe(world.id)
    world.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true, cancelable: true })); await settle()
    expect(document.activeElement).toBe(control(container, 'Regex'))
    control(container, 'Regex').dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true, cancelable: true })); await settle()
    expect(document.activeElement).toBe(control(container, 'Characters'))
    expect(api.listCharacters).toHaveBeenCalledOnce()
  })

  it('preserves tab semantics when the ST accessibility observer annotates inserted menu buttons', async () => {
    // ST 1.18.0 a11y.js applies role=button to every inserted .menu_button, including descendants.
    const annotate = (node: Element) => {
      if (node.matches('.menu_button')) node.setAttribute('role', 'button')
      node.querySelectorAll('.menu_button').forEach(button => button.setAttribute('role', 'button'))
    }
    const observer = new MutationObserver(records => records.forEach(record => record.addedNodes.forEach(node => {
      if (node instanceof Element) annotate(node)
    })))
    observer.observe(document.body, { childList: true, subtree: true })
    try {
      const { container } = mount(); await settle()
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(4)
      const tab = control(container, 'Worldbooks')
      expect(tab.tagName).toBe('BUTTON')
      expect(tab.getAttribute('type')).toBe('button')
      tab.focus(); tab.click(); await settle()
      expect(container.querySelectorAll('[role="tab"]')).toHaveLength(4)
      expect(document.activeElement).toBe(control(container, 'Worldbooks'))
      expect(control(container, 'Worldbooks').getAttribute('aria-selected')).toBe('true')
    } finally { observer.disconnect() }
  })

  it('preserves checkbox identity during asynchronous bundle loading and blocks busy selection changes', async () => {
    const api = bridge(); const chats = deferred<ExportChat[]>(); vi.mocked(api.listChats).mockReturnValue(chats.promise)
    const { container } = mount(api); await settle()
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!; box.focus(); box.click()
    const busyBox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(document.activeElement).toBe(busyBox)
    expect(busyBox.getAttribute('aria-disabled')).toBe('true')
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Collecting related data for Alice')
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-busy')).toBe('true')
    busyBox.click()
    expect(busyBox.checked).toBe(true)
    chats.resolve([chat]); await settle()
    const readyBox = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!
    expect(document.activeElement).toBe(readyBox)
    expect(readyBox.checked).toBe(true)
    expect(container.textContent).toContain('Selected: 1 characters, 1 chats')
  })

  it.each(['search', 'outside', 'unmount'] as const)('does not steal asynchronous focus after moving to %s', async destination => {
    const api = bridge(); const chats = deferred<ExportChat[]>(); vi.mocked(api.listChats).mockReturnValue(chats.promise)
    const { container, app } = mount(api); await settle()
    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')!; box.focus(); box.click()
    const outside = document.createElement('button'); document.body.append(outside)
    const target = destination === 'search' ? container.querySelector<HTMLInputElement>('input.so-app-input')! : outside
    target.focus()
    if (destination === 'unmount') { app.unmount?.(); container.remove() }
    chats.resolve([chat]); await settle()
    expect(document.activeElement).toBe(target)
  })

  it('keeps chat summary and individual chat focus through expansion and checkbox rebuilds', async () => {
    const { container } = mount(); await settle()
    const summary = container.querySelector('summary')!; summary.focus()
    const details = container.querySelector('details')!; details.open = true; details.dispatchEvent(new Event('toggle')); await settle()
    const nextSummary = container.querySelector('summary')!
    expect(document.activeElement).toBe(nextSummary)
    expect(nextSummary.getAttribute('aria-expanded')).toBe('true')
    expect(document.getElementById(nextSummary.getAttribute('aria-controls')!)?.contains(container.querySelector('.cloud-export-chat'))).toBe(true)
    expect(nextSummary.getAttribute('aria-label')).toContain('Alice')
    const box = container.querySelector<HTMLInputElement>('.cloud-export-chat input')!; box.focus(); box.click()
    expect(document.activeElement).toBe(container.querySelector('.cloud-export-chat input'))
    expect(container.textContent).toContain('Selected: 1 characters, 1 chats')
  })

  it('keeps a failed chat read visible without automatic retries from restored open details', async () => {
    const api = bridge(); vi.mocked(api.listChats).mockRejectedValueOnce(new Error('offline'))
    const { container } = mount(api); await settle()
    const details = container.querySelector('details')!; details.open = true; details.dispatchEvent(new Event('toggle'))
    await settle(); await settle(); await settle()
    expect(api.listChats).toHaveBeenCalledOnce()
    expect(container.querySelector('[role="status"]')?.textContent).toContain('Read failed: Error: offline')
    const retryDetails = container.querySelector('details')!
    retryDetails.open = false; retryDetails.dispatchEvent(new Event('toggle'))
    const closedDetails = container.querySelector('details')!
    closedDetails.open = true; closedDetails.dispatchEvent(new Event('toggle')); await settle()
    expect(api.listChats).toHaveBeenCalledTimes(2)
    expect(container.querySelector('summary')?.textContent).toBe('Chats (1)')
  })

  it('restores same-name worldbooks by ID and keeps batch-action focus', async () => {
    const api = bridge(); vi.mocked(api.listWorldbooks).mockResolvedValue([
      { id: 'one.json', name: 'Shared name', fileName: 'one.json' }, { id: 'two.json', name: 'Shared name', fileName: 'two.json' },
    ])
    const { container } = mount(api); await settle(); control(container, 'Worldbooks').click(); await settle()
    const second = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')[1]; second.focus(); second.click()
    const boxes = container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')
    expect(document.activeElement).toBe(boxes[1]); expect(boxes[0].checked).toBe(false); expect(boxes[1].checked).toBe(true)
    for (const label of ['Select all results', 'Invert selection', 'Clear this category']) {
      const action = control(container, label); action.focus(); action.click()
      expect(document.activeElement).toBe(control(container, label))
    }
  })

  it('translates partial bundle warnings and export failures', async () => {
    const api = bridge(); vi.mocked(api.listCharacters).mockResolvedValue([{ ...character, linkedWorldName: 'Missing' }])
    vi.mocked(api.listChats).mockRejectedValue(new Error('offline'))
    const download = vi.fn<typeof downloadSTBackup>(async () => { throw new Error('disk full') })
    const { container, toast } = mount(api, download); await settle()
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); await settle()
    expect(toast).toHaveBeenCalledWith('warning', 'Alice was selected, but these items could not be included: Chat list, Linked worldbook “Missing” was not found (or multiple worldbooks share that name)')
    control(container, 'Export selected backup').click(); await settle()
    expect(toast).toHaveBeenCalledWith('error', 'Export failed: Error: disk full')
    expect(container.querySelector('[role="tabpanel"]')?.getAttribute('aria-busy')).toBe('false')
  })

  it('retains footer focus and status nodes through export progress without double Enter activation', async () => {
    const pending = deferred<void>()
    const download = vi.fn<typeof downloadSTBackup>(async (_files, _name, progress) => { progress({ percent: 42 }); await pending.promise })
    const { container } = mount(bridge(), download); await settle()
    container.querySelector<HTMLInputElement>('input[type="checkbox"]')!.click(); await settle()
    const button = control(container, 'Export selected backup'); button.focus()
    const status = container.querySelector('[role="status"]')!
    const host = vi.fn((event: KeyboardEvent) => { if (event.key === 'Enter') (event.target as HTMLElement).click() })
    document.addEventListener('keydown', host)
    try {
      button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })); await settle()
      expect(download).toHaveBeenCalledOnce(); expect(host).not.toHaveBeenCalled()
      expect(document.activeElement).toBe(control(container, 'Processing…'))
      expect(container.querySelector('[role="status"]')).toBe(status)
      expect(status.textContent).toContain('Compressing 42%')
      pending.resolve(); await settle()
      expect(document.activeElement).toBe(control(container, 'Export selected backup'))
    } finally { document.removeEventListener('keydown', host) }
  })

  it('translates load failures, retry and empty results with actual dictionaries', async () => {
    const api = bridge(); vi.mocked(api.listCharacters).mockRejectedValueOnce(new Error('offline'))
    const { container } = mount(api); await settle()
    expect(container.textContent).toContain('Read failed: Error: offline')
    control(container, 'Retry').click(); await settle()
    const search = container.querySelector<HTMLInputElement>('input.so-app-input')!; search.value = 'missing'; search.dispatchEvent(new InputEvent('input'))
    expect(container.textContent).toContain('No matching items')
  })
})

describe('Cloud Export English diagnostics retain archive identity', () => {
  it('translates loader task progress and failure labels', async () => {
    const api = bridge(); const selected = selection(); selected.characterIds.add(character.id)
    const progress = vi.fn(); await loadSelectedExportFiles({ bridge: api, catalog, selection: selected, onProgress: progress })
    expect(progress).toHaveBeenCalledWith({ completed: 1, total: 1, current: 'Character card Alice' })
    vi.mocked(api.readCharacterCard).mockRejectedValue(new Error('offline'))
    await expect(loadSelectedExportFiles({ bridge: api, catalog, selection: selected })).rejects.toThrow('Failed to read Character card Alice: offline')
  })
  it('translates bridge HTTP and chat data errors without changing fallback data identities', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(new Response('', { status: 502 })).mockResolvedValueOnce(new Response('{}')).mockResolvedValueOnce(new Response('[{}]')).mockResolvedValueOnce(new Response('[{}]'))
    vi.stubGlobal('fetch', fetcher); const api = createSTCloudExportBridge()
    await expect(api.listCharacters()).rejects.toThrow('/api/characters/all request failed (503)')
    await expect(api.readCharacterCard(character)).rejects.toThrow('/api/characters/export request failed (502)')
    await expect(api.readChat(character, chat)).rejects.toThrow('Chat first returned data that cannot be exported')
    await expect(api.listCharacters()).rejects.toThrow('Character “角色 1” has no unique avatar filename')
    expect((await api.listChats(character))[0]).toMatchObject({ id: `${character.id}:聊天 1`, name: '聊天 1', path: '' })
  })
  it('translates archive safety errors while retaining the exact paths and original data', async () => {
    expect(() => assertUniqueArchivePaths([{ path: 'a/../b' }])).toThrow('Invalid backup path: a/../b')
    expect(() => assertUniqueArchivePaths([{ path: 'A' }, { path: 'a' }])).toThrow('Conflicting backup paths: A and a')
    await expect(downloadSTBackup([], 'backup', vi.fn())).rejects.toThrow('Nothing selected to export')
    const selected = selection(); selected.characterIds.add(character.id)
    expect(() => buildCharacterFiles({ ...character, avatar: '../Alice.png' }, new ArrayBuffer(1), new Map(), selected)).toThrow('Cannot create a restorable backup: invalid character avatar filename')
    expect(() => buildCharacterFiles({ ...character, avatar: 'Alice.jpg' }, new ArrayBuffer(1), new Map(), selected)).toThrow('Cannot determine the character chat folder: the avatar must be a PNG file')
    selected.worldbookIds.add('bad')
    expect(() => buildExportFiles({ ...catalog, worldbooks: [{ id: 'bad', name: '原名', fileName: '../bad', content: {} }] }, selected)).toThrow('invalid worldbook filename')
  })
})
