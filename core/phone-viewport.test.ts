// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { createPhoneShell } from './phone-shell'
import { PhoneAppRegistry } from './phone-registry'

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren() })
it('widens on desktop and reclamps after zoom, resize and panning', () => {
  const viewport = Object.assign(new EventTarget(), { width: 1365, height: 900, offsetLeft: 0, offsetTop: 0 })
  vi.stubGlobal('visualViewport', viewport)
  const shell = createPhoneShell({ x: 1200, y: 20, open: true }, { registry: new PhoneAppRegistry(), createAppContext: vi.fn(), onStateChange: vi.fn() })
  try {
    const phone = document.querySelector<HTMLElement>('.so-phone-shell')!
    for (const [width, expected] of [[1365,380],[768,380],[767,320],[320,304],[280,264]]) {
      viewport.width = width; viewport.offsetLeft = 14; viewport.dispatchEvent(new Event('resize'))
      expect(parseFloat(phone.style.width)).toBe(expected)
      expect(parseFloat(phone.style.left)).toBeGreaterThanOrEqual(22)
      expect(parseFloat(phone.style.left) + expected).toBeLessThanOrEqual(width + 6)
    }
  } finally { shell.destroy() }
})
it('keeps the phone inside an offset visual viewport and follows viewport panning', () => {
  const viewport = Object.assign(new EventTarget(), { width: 320, height: 260, offsetLeft: 14, offsetTop: 180 })
  vi.stubGlobal('visualViewport', viewport)
  const shell = createPhoneShell({ x: 20, y: 20, open: true }, { registry: new PhoneAppRegistry(), createAppContext: vi.fn(), onStateChange: vi.fn() })
  try {
    const phone = document.querySelector<HTMLElement>('.so-phone-shell')!
    expect(parseFloat(phone.style.top)).toBeGreaterThanOrEqual(188)
    expect(parseFloat(phone.style.top) + parseFloat(phone.style.height)).toBeLessThanOrEqual(432)
    expect(parseFloat(phone.style.left)).toBeGreaterThanOrEqual(22)
    viewport.offsetTop = 100; viewport.dispatchEvent(new Event('scroll'))
    expect(parseFloat(phone.style.top)).toBeGreaterThanOrEqual(108)
    expect(parseFloat(phone.style.top) + parseFloat(phone.style.height)).toBeLessThanOrEqual(352)
  } finally { shell.destroy() }
})
