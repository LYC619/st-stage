// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { installPhoneSwipe } from './phone-swipe'

let dispose = () => {}
afterEach(() => { dispose(); document.body.replaceChildren() })
function setup() {
  const screen = document.createElement('div'); document.body.append(screen)
  const back = vi.fn(), swipe = installPhoneSwipe(screen, () => true, back)
  dispose = swipe.dispose
  const pointer = (target: EventTarget, type: string, id: number, x: number, y = 30) => {
    target.dispatchEvent(new PointerEvent(type, { pointerId: id, clientX: x, clientY: y, isPrimary: id === 1, button: 0, bubbles: true }))
  }
  return { screen, back, swipe, pointer }
}
it('ignores other pointer movements and cancels navigation when a second finger joins', () => {
  const f = setup()
  f.pointer(f.screen, 'pointerdown', 1, 8)
  f.pointer(window, 'pointermove', 2, 100)
  f.pointer(window, 'pointerup', 2, 100)
  expect(f.back).not.toHaveBeenCalled()
  f.pointer(window, 'pointerdown', 2, 8)
  f.pointer(window, 'pointermove', 1, 100)
  expect(f.back).not.toHaveBeenCalled()
  f.pointer(f.screen, 'pointerdown', 1, 8)
  f.pointer(window, 'pointermove', 1, 100)
  expect(f.back).toHaveBeenCalledOnce()
})
it('cancels after vertical intent, pointercancel or disposal without a late return', () => {
  const f = setup()
  f.pointer(f.screen, 'pointerdown', 1, 8)
  f.pointer(window, 'pointermove', 1, 9, 55)
  f.pointer(window, 'pointermove', 1, 100, 55)
  f.pointer(f.screen, 'pointerdown', 1, 8)
  f.pointer(window, 'pointercancel', 1, 8)
  f.pointer(window, 'pointermove', 1, 100)
  f.pointer(f.screen, 'pointerdown', 1, 8)
  f.swipe.dispose()
  f.pointer(window, 'pointermove', 1, 100)
  expect(f.back).not.toHaveBeenCalled()
})
it('leaves interactive targets and horizontal scrollers to their own gestures', () => {
  const f = setup()
  f.screen.innerHTML = '<button>B</button><input><div data-no-swipe>X</div><div id="scroll" style="overflow-x:auto"><span>Strip</span></div>'
  const strip = f.screen.querySelector('#scroll')!
  Object.defineProperties(strip, { scrollWidth: { value: 600 }, clientWidth: { value: 200 } })
  for (const target of f.screen.querySelectorAll('button,input,[data-no-swipe],span')) {
    f.pointer(target, 'pointerdown', 1, 8)
    f.pointer(window, 'pointermove', 1, 100)
    f.pointer(window, 'pointerup', 1, 100)
  }
  expect(f.back).not.toHaveBeenCalled()
})
