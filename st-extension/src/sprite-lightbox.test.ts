// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SpritePack } from '../../core/types'
import {
  openSpriteLightbox,
  type SpriteLightboxAction,
  type SpriteLightboxController,
} from './sprite-lightbox'

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
    controllers.splice(0).forEach((controller) => controller.close())
    document.body.innerHTML = ''
    vi.restoreAllMocks()
    if (originalVisualViewport) {
      Object.defineProperty(window, 'visualViewport', originalVisualViewport)
    } else {
      Reflect.deleteProperty(window, 'visualViewport')
    }
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
    const actions: SpriteLightboxAction[] = [
      { id: 'rename', label: 'Rename', icon: '✎', run },
    ]
    const controller = open({ actions })
    const layer = getLayer()
    const nextPack = pack('b', ['updated'])
    actions[0].disabled = true
    actions[0].destructive = true

    controller.update(nextPack, 0)

    expect(getLayer()).toBe(layer)
    expect(layer.querySelector<HTMLImageElement>('img')?.src).toBe('https://img.test/updated.png')
    expect(layer.querySelector('.so-lightbox-caption')?.textContent).toBe('updated（1/1）')
    expect(layer.querySelector<HTMLButtonElement>('.so-lightbox-prev')?.disabled).toBe(true)
    expect(layer.querySelector<HTMLButtonElement>('.so-lightbox-next')?.disabled).toBe(true)
    const action = layer.querySelector<HTMLButtonElement>('[data-action-id="rename"]')!
    expect(action.disabled).toBe(true)
    expect(action.classList.contains('so-lightbox-action-danger')).toBe(true)
    expect(action.textContent).toContain('✎')
    expect(action.textContent).toContain('Rename')
    action.click()
    expect(run).not.toHaveBeenCalled()
  })

  it('collapses the action column when empty and restores it for async actions', () => {
    installVisualViewport({ offsetLeft: 0, offsetTop: 0, width: 800, height: 600 })
    const actions: SpriteLightboxAction[] = []
    const controller = open({ actions })
    const layer = getLayer()

    expect(layer.classList.contains('so-lightbox-no-actions')).toBe(true)
    actions.push({ id: 'save', label: 'Save locally', run: async () => {} })
    controller.update(pack('b', ['updated']), 0)

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
