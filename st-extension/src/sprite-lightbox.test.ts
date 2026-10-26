// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpritePack } from '../../core/types'
import {
  openSpriteLightbox,
  type SpriteLightboxController,
} from './sprite-lightbox'
import type { SpriteAction } from './sprite-actions'
import { openAppModal } from '../../core/app-modal'
import { loadTranslations, resetI18n, setLocale } from '../../core/i18n'
import en from '../locales/en-US.json'

interface MutableVisualViewport extends EventTarget {
  offsetLeft: number
  offsetTop: number
  width: number
  height: number
}

const originalVisualViewport = Object.getOwnPropertyDescriptor(window, 'visualViewport')
const controllers: SpriteLightboxController[] = []

function pack(id: string, tags: string[]): SpritePack {
  return {
    id,
    name: `Pack ${id}`,
    sprites: tags.map((tag) => ({ tag, url: `https://img.test/${tag}.png` })),
  }
}

function installVisualViewport(
  values: Pick<MutableVisualViewport, 'offsetLeft' | 'offsetTop' | 'width' | 'height'>,
): MutableVisualViewport {
  const viewport = Object.assign(new EventTarget(), values) as MutableVisualViewport
  Object.defineProperty(window, 'visualViewport', {
    configurable: true,
    value: viewport,
  })
  return viewport
}

function open(
  overrides: Partial<Parameters<typeof openSpriteLightbox>[0]> = {},
): SpriteLightboxController {
  const controller = openSpriteLightbox({
    pack: pack('a', ['one', 'two', 'three']),
    index: 0,
    readonly: false,
    actions: [],
    onNavigate: () => {},
    onClose: () => {},
    ...overrides,
  })
  controllers.push(controller)
  return controller
}

function getLayer(): HTMLElement {
  const layer = document.querySelector<HTMLElement>('.so-lightbox')
  if (!layer) throw new Error('Lightbox layer was not mounted')
  return layer
}

describe('openSpriteLightbox', () => {
  afterEach(() => {
    resetI18n()
    controllers.splice(0).forEach((controller) => controller.close())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport)
    } else {
      Reflect.deleteProperty(window, 'visualViewport')
    }
  })

  it('translates preview controls and announces navigation without translating user tags', () => {
    loadTranslations('en-US', en)
    setLocale('en-US')
    open({ pack: pack('translated', ['用户标签', 'Second']) })
    expect(getLayer().getAttribute('aria-label')).toBe('Sprite preview')
    expect(getLayer().querySelector('.so-lightbox-prev')?.getAttribute('aria-label')).toBe('Previous image (Left arrow)')
    const caption = getLayer().querySelector('[role="status"]')!
    expect(caption.textContent).toBe('用户标签 (1/2)')
    getLayer().querySelector<HTMLElement>('.so-lightbox-next')!.click()
    expect(caption.textContent).toBe('Second (2/2)')
  })

  it('contains keyboard focus and restores the opener after closing', () => {
    const opener = document.createElement('button')
    document.body.append(opener)
    opener.focus()
    const controller = open()
    const layer = getLayer()
    expect(layer.contains(document.activeElement)).toBe(true)
    const close = layer.querySelector<HTMLElement>('.so-lightbox-close')!
    close.focus()
    close.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true, cancelable: true }))
    expect(document.activeElement).toBe(layer.querySelector('.so-lightbox-prev'))
    controller.close()
    expect(document.activeElement).toBe(opener)
  })

  it('does not navigate or close behind a nested dialog, and preserves action focus on updates', () => {
    const onNavigate = vi.fn()
    const controller = open({ onNavigate, actions: [{ id: 'edit', label: 'Edit', run() {} }] })
    const action = getLayer().querySelector<HTMLElement>('[data-action-id="edit"]')!
    action.focus()
    controller.update(pack('a', ['one', 'two']), 0)
    expect(document.activeElement).toBe(getLayer().querySelector('[data-action-id="edit"]'))
    const closeNested = openAppModal(body => { body.innerHTML = '<input aria-label="Name">' }, { onOpen() {}, onClose() {} })
    document.querySelector<HTMLElement>('.so-app-modal input')!.focus()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true, cancelable: true }))
    expect(onNavigate).not.toHaveBeenCalled()
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
    expect(document.querySelector('.so-app-modal')).toBeNull()
    expect(document.querySelector('.so-lightbox')).not.toBeNull()
    closeNested()
  })

  it('mounts every lightbox surface in one body-level visual viewport layer', () => {
    installVisualViewport({ offsetLeft: 11, offsetTop: 72, width: 390, height: 620 })

    open()

    const layer = getLayer()
    expect(layer.parentElement).toBe(document.body)
    expect(layer.style.left).toBe('11px')
    expect(layer.style.top).toBe('72px')
    expect(layer.style.width).toBe('390px')
    expect(layer.style.height).toBe('620px')
    for (const selector of [
      'img',
      '.so-lightbox-caption',
      '.so-lightbox-close',
      '.so-lightbox-prev',
      '.so-lightbox-next',
      '.so-lightbox-actions',
    ]) {
      expect(layer.querySelector(selector), selector).not.toBeNull()
    }
  })

  it('tracks visual viewport resize and scroll, then unregisters both listeners once', () => {
    const viewport = installVisualViewport({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600 })
    const remove = vi.spyOn(viewport, 'removeEventListener')
    const onClose = vi.fn()
    const controller = open({ onClose })
    const layer = getLayer()

    Object.assign(viewport, { offsetLeft: 9, offsetTop: 31, width: 412, height: 701 })
    viewport.dispatchEvent(new Event('resize'))
    expect([layer.style.left, layer.style.top, layer.style.width, layer.style.height]).toEqual([
      '9px',
      '31px',
      '412px',
      '701px',
    ])

    Object.assign(viewport, { offsetLeft: 13, offsetTop: 47, width: 410, height: 655 })
    viewport.dispatchEvent(new Event('scroll'))
    expect([layer.style.left, layer.style.top, layer.style.width, layer.style.height]).toEqual([
      '13px',
      '47px',
      '410px',
      '655px',
    ])

    controller.close()
    controller.close()
    expect(remove.mock.calls.filter(([type]) => type === 'resize')).toHaveLength(1)
    expect(remove.mock.calls.filter(([type]) => type === 'scroll')).toHaveLength(1)
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.so-lightbox')).toBeNull()
  })

  it('falls back to the layout viewport when visualViewport is unavailable', () => {
    Reflect.deleteProperty(window, 'visualViewport')
    vi.spyOn(window, 'innerWidth', 'get').mockReturnValue(1024)
    vi.spyOn(window, 'innerHeight', 'get').mockReturnValue(768)

    open()

    const layer = getLayer()
    expect([layer.style.left, layer.style.top, layer.style.width, layer.style.height]).toEqual([
      '0px',
      '0px',
      '1024px',
      '768px',
    ])
  })

  it('wraps every navigation path and reports every resulting index', () => {
    installVisualViewport({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600 })
    const onNavigate = vi.fn()
    open({ onNavigate })
    const layer = getLayer()
    const image = layer.querySelector<HTMLImageElement>('img')!
    vi.spyOn(image, 'getBoundingClientRect').mockReturnValue({
      left: 100,
      right: 300,
      top: 50,
      bottom: 450,
      width: 200,
      height: 400,
      x: 100,
      y: 50,
      toJSON: () => ({}),
    })

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', cancelable: true }))
    layer.querySelector<HTMLElement>('.so-lightbox-prev')!.click()
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', cancelable: true }))
    layer.querySelector<HTMLElement>('.so-lightbox-next')!.click()
    image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 120 }))
    image.dispatchEvent(new MouseEvent('click', { bubbles: true, clientX: 280 }))

    expect(onNavigate.mock.calls.map(([index]) => index)).toEqual([1, 0, 2, 0, 2, 0])
    expect(image.src).toBe('https://img.test/one.png')
    expect(layer.querySelector('.so-lightbox-caption')?.textContent).toBe('one（1/3）')
    expect(image.alt).toBe('one')
  })

  it('updates content, navigation, and action state without reopening', () => {
    installVisualViewport({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600 })
    const run = vi.fn()
    const actions: SpriteAction[] = [
      { id: 'rename', label: 'Rename', icon: '✎', run },
    ]
    const controller = open({ actions })
    const layer = getLayer()
    const nextPack = pack('b', ['updated'])
    const updatedActions: SpriteAction[] = [
      { id: 'rename', label: 'Updated rename', icon: '✎', disabled: true, destructive: true, run },
    ]

    controller.update(nextPack, 0, updatedActions)

    expect(getLayer()).toBe(layer)
    expect(layer.querySelector<HTMLImageElement>('img')?.src).toBe('https://img.test/updated.png')
    expect(layer.querySelector('.so-lightbox-caption')?.textContent).toBe('updated（1/1）')
    expect(layer.querySelector<HTMLButtonElement>('.so-lightbox-prev')?.disabled).toBe(true)
    expect(layer.querySelector<HTMLButtonElement>('.so-lightbox-next')?.disabled).toBe(true)
    const action = layer.querySelector<HTMLButtonElement>('[data-action-id="rename"]')!
    expect(action.disabled).toBe(true)
    expect(action.classList.contains('so-lightbox-action-danger')).toBe(true)
    expect(action.textContent).toContain('✎')
    expect(action.textContent).toContain('Updated rename')
    action.click()
    expect(run).not.toHaveBeenCalled()
  })

  it('collapses the action column when empty and restores it for async actions', () => {
    installVisualViewport({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600 })
    const actions: SpriteAction[] = []
    const controller = open({ actions })
    const layer = getLayer()

    expect(layer.classList.contains('so-lightbox-no-actions')).toBe(true)
    actions.push({ id: 'save', label: 'Save locally', run: async () => {} })
    controller.update(pack('b', ['updated']), 0, actions)

    expect(layer.classList.contains('so-lightbox-no-actions')).toBe(false)
    expect(layer.querySelector('[data-action-id="save"]')).not.toBeNull()
  })

  it('suppresses edit actions in readonly mode and supports Escape and backdrop close', () => {
    installVisualViewport({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600 })
    const run = vi.fn()
    const onClose = vi.fn()
    open({
      readonly: true,
      actions: [{ id: 'delete', label: 'Delete', destructive: true, run }],
      onClose,
    })
    expect(getLayer().querySelectorAll('[data-action-id]')).toHaveLength(0)

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(1)

    open({ onClose })
    const layer = getLayer()
    layer.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    expect(onClose).toHaveBeenCalledTimes(2)
    expect(document.querySelector('.so-lightbox')).toBeNull()
  })
})
