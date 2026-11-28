// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { fixedViewport, observeFixedViewport } from './fixed-viewport'
import { PhoneAppRegistry } from './phone-registry'
import { createPhoneShell } from './phone-shell'
import { installPhoneSwipe } from './phone-swipe'

let swipeDispose = () => {}

afterEach(() => {
  swipeDispose()
  swipeDispose = () => {}
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

describe('fixedViewport & phone shell viewport clamping', () => {
  it('compensates transformed roots, cleans up captured visualViewport listeners, and clamps shell across sizes/panning', () => {
    vi.stubGlobal('visualViewport', { width: 300, height: 240, offsetLeft: 10, offsetTop: 40 })
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: -9, top: -25, width: 1, height: 1 } as DOMRect)
    expect(fixedViewport()).toEqual({ width: 300, height: 240, left: 19, top: 65 })
    vi.restoreAllMocks()

    const oldVp = new EventTarget()
    const update = vi.fn()
    vi.stubGlobal('visualViewport', oldVp)
    const disposeObs = observeFixedViewport(update)
    window.dispatchEvent(new Event('scroll'))
    oldVp.dispatchEvent(new Event('resize'))
    expect(update).toHaveBeenCalledTimes(2)
    vi.stubGlobal('visualViewport', new EventTarget())
    disposeObs()
    oldVp.dispatchEvent(new Event('resize'))
    expect(update).toHaveBeenCalledTimes(2)

    const viewport = Object.assign(new EventTarget(), { width: 1365, height: 900, offsetLeft: 0, offsetTop: 0 })
    vi.stubGlobal('visualViewport', viewport)
    const shell = createPhoneShell({ x: 1200, y: 20, open: true }, { registry: new PhoneAppRegistry(), createAppContext: vi.fn(), onStateChange: vi.fn() })
    try {
      const phone = document.querySelector<HTMLElement>('.so-phone-shell')!
      for (const [width, expected, height] of [[1365, 380, 760], [767, 320, 640], [280, 264, 580]]) {
        viewport.width = width
        viewport.offsetLeft = 14
        viewport.dispatchEvent(new Event('resize'))
        expect(parseFloat(phone.style.width)).toBe(expected)
        expect(parseFloat(phone.style.height)).toBe(height)
      }
      viewport.width = 320
      viewport.height = 260
      viewport.offsetTop = 180
      viewport.dispatchEvent(new Event('resize'))
      expect(parseFloat(phone.style.top)).toBeGreaterThanOrEqual(188)
      viewport.offsetTop = 100
      viewport.dispatchEvent(new Event('scroll'))
      expect(parseFloat(phone.style.top) + parseFloat(phone.style.height)).toBeLessThanOrEqual(352)
    } finally {
      shell.destroy()
    }
  })
})

describe('installPhoneSwipe edge back gesture', () => {
  function setupSwipe() {
    const screen = document.createElement('div')
    document.body.append(screen)
    const back = vi.fn()
    const swipe = installPhoneSwipe(screen, () => true, back)
    swipeDispose = swipe.dispose
    const pointer = (target: EventTarget, type: string, id: number, x: number, y = 30) => {
      target.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, isPrimary: id === 1, button: 0, bubbles: true }))
    }
    return { screen, back, swipe, pointer }
  }

  it('navigates on clean primary edge swipe while rejecting multi-touch, vertical scroll, interactive targets, and horizontal scrollers', () => {
    const f = setupSwipe()
    f.pointer(f.screen, 'pointerdown', 1, 8)
    f.pointer(window, 'pointerdown', 2, 8)
    f.pointer(window, 'pointermove', 1, 100)
    expect(f.back).not.toHaveBeenCalled()

    f.pointer(f.screen, 'pointerdown', 1, 8)
    f.pointer(window, 'pointermove', 1, 9, 55)
    f.pointer(window, 'pointermove', 1, 100, 55)
    expect(f.back).not.toHaveBeenCalled()

    f.screen.innerHTML = '<button>B</button><input><div data-no-swipe>X</div><div id="scroll" style="overflow-x:auto"><span>Strip</span></div>'
    Object.defineProperties(f.screen.querySelector('#scroll')!, { scrollWidth: { value: 600 }, clientWidth: { value: 200 } })
    for (const target of f.screen.querySelectorAll('button,input,[data-no-swipe],span')) {
      f.pointer(target, 'pointerdown', 1, 8)
      f.pointer(window, 'pointermove', 1, 100)
      f.pointer(window, 'pointerup', 1, 100)
    }
    expect(f.back).not.toHaveBeenCalled()

    f.pointer(f.screen, 'pointerdown', 1, 8)
    f.pointer(window, 'pointermove', 1, 100)
    expect(f.back).toHaveBeenCalledOnce()
  })
})
