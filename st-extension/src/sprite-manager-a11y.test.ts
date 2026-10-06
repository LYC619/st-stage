// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../core/i18n'
import { createDefaultSettings, type PluginSettings } from '../../core/types'
import { importPack } from '../../core/pack-io'
import { decodeShareString } from '../../core/share-code'
import { createSpriteManager } from './sprite-manager'
import type { STAdapter } from './st-adapter'
import en from '../locales/en-US.json'

const cleanup: Array<() => void> = []
afterEach(() => { cleanup.splice(0).reverse().forEach(fn => fn()); resetI18n(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
function fixture(names = ['Alice', 'Bob', 'Clara']) {
  let settings: PluginSettings = { ...createDefaultSettings(), galleryFoldByRole: false,
    packs: names.map((name, index) => ({ id: names.indexOf(name) === index ? name : `${name}-${index}`, name, customTags: ['Favorite'], sprites: [{ tag: 'Smile', url: 'https://img.test/a.png' }] })) }
  const opener = document.createElement('button'); document.body.append(opener); opener.focus()
  const manager = createSpriteManager({ adapter: { getCurrentCharacterName: () => 'Test Character' } as STAdapter,
    getSettings: () => settings, updateSettings: next => { settings = next } })
  cleanup.push(() => manager.destroy()); manager.open()
  return { manager, opener, settings: () => settings }
}
function button(text: string, scope: ParentNode = document): HTMLElement {
  const node = [...scope.querySelectorAll<HTMLElement>('[role="button"],button')].find(n => n.textContent === text)
  if (!node) throw new Error(`Missing button: ${text}`)
  return node
}
function key(target: Element, value: string) { target.dispatchEvent(new KeyboardEvent('keydown', { key: value, bubbles: true, cancelable: true })) }

describe('deep gallery language and keyboard behavior', () => {
  it('contains focus in the manager and restores the opener when closed', () => {
    const { manager, opener } = fixture()
    const dialog = document.querySelector<HTMLElement>('.so-manager')!
    expect(dialog.getAttribute('aria-modal')).toBe('true')
    expect(dialog.contains(document.activeElement)).toBe(true)
    opener.focus(); expect(dialog.contains(document.activeElement)).toBe(true)
    manager.close(); expect(document.activeElement).toBe(opener)
  })

  it('labels popover relationships and closes only the popover on Escape', () => {
    fixture()
    const trigger = button('新建 ▾'); trigger.focus(); key(trigger, 'Enter')
    const popover = document.querySelector<HTMLElement>('.so-popover')!
    expect(trigger.getAttribute('aria-expanded')).toBe('true')
    expect(trigger.getAttribute('aria-controls')).toBe(popover.id)
    expect(popover.id).not.toBe('')
    key(document.activeElement!, 'Escape')
    expect(document.querySelector('.so-popover')).toBeNull()
    expect(trigger.getAttribute('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(trigger)
    expect(document.querySelector('.so-manager')).not.toBeNull()
  })

  it('closes a nested tag dialog first and restores the tag trigger', () => {
    fixture()
    const trigger = button('标签管理'); trigger.focus(); key(trigger, 'Enter')
    const modal = document.querySelector<HTMLElement>('.so-tag-manager')!
    expect(modal.getAttribute('aria-modal')).toBe('true')
    expect(modal.contains(document.activeElement)).toBe(true)
    key(document.activeElement!, 'Escape')
    expect(document.querySelector('.so-tag-manager')).toBeNull()
    expect(document.querySelector('.so-manager')).not.toBeNull()
    expect(document.activeElement).toBe(trigger)
  })

  it('retains an enabled-pack checkbox after immediate save and panel rebuild', () => {
    const { settings } = fixture()
    const trigger = document.querySelector<HTMLElement>('.so-enable-btn')!
    trigger.focus(); key(trigger, 'Enter')
    const checkbox = document.querySelector<HTMLInputElement>('.so-enable-pop input')!
    checkbox.focus(); checkbox.click()
    const replacement = document.querySelector<HTMLInputElement>('.so-enable-pop input')!
    expect(replacement.checked).toBe(true)
    expect(document.activeElement).toBe(replacement)
    expect(settings().bindings[0].packIds).toEqual(['Alice'])
  })

  it('contains upload-preview focus and returns to Add sprites after Escape', () => {
    fixture(); document.querySelector<HTMLElement>('.so-pack-card')!.click()
    vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(function(this: HTMLInputElement) {
      if (this.type !== 'file') return
      Object.defineProperty(this, 'files', { value: [new File(['image'], 'Smile.png', { type: 'image/png' })] })
      this.dispatchEvent(new Event('change'))
    })
    const trigger = button('添加立绘 ▾'); trigger.focus(); key(trigger, 'Enter')
    button('选择图片（自动压缩+解析预览）').click()
    const modal = document.querySelector<HTMLElement>('.so-upload-modal')!
    expect(modal.getAttribute('aria-modal')).toBe('true')
    expect(modal.contains(document.activeElement)).toBe(true)
    expect(modal.querySelector('select')?.getAttribute('aria-labelledby')).toBeTruthy()
    key(document.activeElement!, 'Escape')
    expect(document.querySelector('.so-upload-modal')).toBeNull()
    expect(document.activeElement).toBe(trigger)
    expect(document.querySelector('.so-manager-back')?.getAttribute('style')).not.toContain('none')
  })

  it('restores the originating card when keyboard navigation returns from its details', () => {
    fixture()
    const cards = [...document.querySelectorAll<HTMLElement>('.so-pack-card')]
    cards[1].focus(); key(cards[1], 'Enter')
    const back = document.querySelector<HTMLElement>('.so-manager-back')!
    back.focus(); key(back, 'Enter')
    expect(document.activeElement).toBe(document.querySelectorAll('.so-pack-card')[1])
    expect(getComputedStyle(document.activeElement!).display).not.toBe('none')
  })

  it('distinguishes enabled-pack focus by ID when names and image counts match', () => {
    const { settings } = fixture(['Same', 'Same', 'Clara'])
    document.querySelector<HTMLElement>('.so-enable-btn')!.click()
    const checkbox = document.querySelectorAll<HTMLInputElement>('.so-enable-pop input')[1]
    checkbox.focus(); checkbox.click()
    const current = document.querySelectorAll<HTMLInputElement>('.so-enable-pop input')
    expect(current[1].checked).toBe(true)
    expect(current[0].checked).toBe(false)
    expect(document.activeElement).toBe(current[1])
    expect(settings().bindings[0].packIds).toEqual(['Same-1'])
  })

  it.each([false, true])('keeps fallback-copy selection within the active dialog and cleans it up (throws=%s)', async throws => {
    fixture(); document.querySelector<HTMLElement>('.so-pack-card')!.click()
    vi.stubGlobal('navigator', { clipboard: { writeText: vi.fn().mockRejectedValue(new Error('denied')) } })
    vi.spyOn(window, 'prompt').mockReturnValue(null)
    const oldExec = document.execCommand
    let copied = ''
    document.execCommand = vi.fn(() => {
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement && active.closest('.so-manager')) {
        copied = active.value.slice(active.selectionStart, active.selectionEnd)
      }
      if (throws) throw new Error('copy rejected')
      return Boolean(copied)
    })
    cleanup.push(() => { document.execCommand = oldExec })
    const count = document.querySelectorAll('textarea').length
    const trigger = button('复制分享串'); trigger.focus(); trigger.click()
    await vi.waitFor(() => expect(document.execCommand).toHaveBeenCalledOnce())
    expect(copied).toBe('stpack2:Alice|@tags=%5B%22Favorite%22%5D|Smile=https://img.test/a.png')
    expect(document.querySelectorAll('textarea')).toHaveLength(count)
    expect(document.activeElement).toBe(trigger)
    if (throws) expect(window.prompt).toHaveBeenCalled()
  })

  it('uses the lightbox when it gains focus while a clipboard request is pending', async () => {
    fixture(); document.querySelector<HTMLElement>('.so-pack-card')!.click()
    let rejectClipboard!: (reason: Error) => void
    const clipboardRequest = new Promise<void>((_, reject) => { rejectClipboard = reject })
    vi.stubGlobal('navigator', { clipboard: { writeText: () => clipboardRequest } })
    button('复制分享串').click()
    const sprite = document.querySelector<HTMLElement>('.so-sprite-cell')!
    sprite.focus(); key(sprite, 'Enter')
    const priorFocus = document.activeElement
    const oldExec = document.execCommand
    let copied = ''
    document.execCommand = vi.fn(() => {
      const active = document.activeElement
      if (active instanceof HTMLTextAreaElement && active.closest('.so-lightbox')) copied = active.value
      return Boolean(copied)
    })
    cleanup.push(() => { document.execCommand = oldExec })
    rejectClipboard(new Error('denied'))
    await vi.waitFor(() => expect(document.execCommand).toHaveBeenCalledOnce())
    expect(copied).toContain('stpack2:Alice|')
    expect(document.querySelector('.so-lightbox textarea')).toBeNull()
    expect(document.activeElement).toBe(priorFocus)
  })

  it('supports card arrow navigation and opens sprites using the keyboard', () => {
    fixture()
    const cards = [...document.querySelectorAll<HTMLElement>('.so-pack-card')]
    cards[0].focus(); key(cards[0], 'ArrowRight'); expect(document.activeElement).toBe(cards[1])
    key(cards[1], 'End'); expect(document.activeElement).toBe(cards[2])
    key(cards[2], 'Home'); expect(document.activeElement).toBe(cards[0])
    key(cards[0], 'Enter')
    const sprite = document.querySelector<HTMLElement>('.so-sprite-cell')!
    expect(sprite.tabIndex).toBe(0)
    expect(sprite.getAttribute('aria-label')).toContain('Smile')
    sprite.focus(); key(sprite, 'Enter'); expect(document.querySelector('.so-lightbox')).not.toBeNull()
  })

  it('keeps nested ordering buttons from toggling a selected card', () => {
    const { settings } = fixture(); button('批量管理').click()
    const card = document.querySelector<HTMLElement>('.so-pack-card')!
    const order = card.querySelector<HTMLElement>('[aria-label="后移"]')!
    expect(order.tabIndex).toBe(0)
    order.focus(); key(order, 'Enter')
    expect(settings().packs.map(p => p.id)).toEqual(['Bob', 'Alice', 'Clara'])
    expect(document.querySelectorAll('.so-card-selected')).toHaveLength(0)
  })

  it('translates deep filters, pack metadata, actions and import errors without changing protocol values', () => {
    loadTranslations('en-US', en); setLocale('en-US')
    const { settings } = fixture()
    expect(document.querySelector('.so-pack-filter-search')?.getAttribute('placeholder')).toBe('Search packs, characters, outfits or tags')
    expect(document.querySelector('.so-pack-filter-kind')?.textContent).toBe('All typesSpritesIllustrations')
    expect([...document.querySelectorAll<HTMLOptionElement>('.so-pack-filter-kind option')].map(o => o.value)).toEqual(['', 'sprite', 'illustration'])
    document.querySelector<HTMLElement>('.so-pack-card')!.click()
    expect(document.querySelector('.so-manager-body')?.textContent).toContain('Pack information')
    expect(document.querySelector('.so-manager-body')?.textContent).toContain('Export JSON')
    expect(document.querySelector('[aria-label="Rename"]')).not.toBeNull()
    expect(() => importPack('bad')).toThrow('Import failed: invalid JSON file')
    expect(() => decodeShareString('bad')).toThrow('Import failed: no share string starting with stpack1: was found')
    expect(settings().packs[0].name).toBe('Alice')
  })
})
