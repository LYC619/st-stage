// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { fixedViewport, observeFixedViewport } from './fixed-viewport'

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })

it('compensates a scrolled transformed root and preserves the visual viewport offset', () => {
  vi.stubGlobal('visualViewport', { width: 300, height: 240, offsetLeft: 10, offsetTop: 40 })
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: -9, top: -25, width: 1, height: 1 } as DOMRect)
  expect(fixedViewport()).toEqual({ width: 300, height: 240, left: 19, top: 65 })
  expect(document.body.childElementCount).toBe(0)
})

it('uses the captured viewport when removing listeners after a host replacement', () => {
  const viewport = new EventTarget(), update = vi.fn()
  vi.stubGlobal('visualViewport', viewport)
  const dispose = observeFixedViewport(update)
  window.dispatchEvent(new Event('scroll')); viewport.dispatchEvent(new Event('resize'))
  expect(update).toHaveBeenCalledTimes(2)
  vi.stubGlobal('visualViewport', new EventTarget()); dispose()
  window.dispatchEvent(new Event('scroll')); viewport.dispatchEvent(new Event('resize'))
  expect(update).toHaveBeenCalledTimes(2)
})
