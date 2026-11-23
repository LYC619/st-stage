/** Edge navigation owns only a rightward single-pointer drag, never a native scroll/control. */
export function installPhoneSwipe(screen: HTMLElement, canGoBack: () => boolean, goBack: () => void) {
  let cancel = () => {}
  let activePointer: number | undefined

  function nativeGesture(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return true
    if (target.closest('input, textarea, select, button, a, [role="button"], [contenteditable]:not([contenteditable="false"]), [data-no-swipe]')) return true
    for (let node: Element | null = target; node && node !== screen; node = node.parentElement) {
      if (node.scrollWidth > node.clientWidth && /^(auto|scroll)$/.test(getComputedStyle(node).overflowX)) return true
    }
    return false
  }

  function start(event: PointerEvent) {
    if (activePointer !== undefined) { cancel(); return }
    if (!canGoBack() || !event.isPrimary || event.button !== 0 || nativeGesture(event.target)) return
    const offset = event.clientX - screen.getBoundingClientRect().left
    if (offset < 0 || offset > 22) return
    activePointer = event.pointerId
    const pointerId = event.pointerId, startX = event.clientX, startY = event.clientY

    function direction(x: number, y: number) {
      const dx = x - startX, dy = Math.abs(y - startY)
      if (dx < -8 || (dy > 8 && dy >= Math.abs(dx))) { cancel(); return false }
      return dx > 0 && dx > dy
    }
    function move(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return
      if (direction(ev.clientX, ev.clientY) && ev.clientX - startX >= 58) {
        cancel()
        goBack()
      }
    }
    function finish(ev: PointerEvent) { if (ev.pointerId === pointerId) cancel() }
    function anotherPointer(ev: PointerEvent) { if (ev.pointerId !== pointerId) cancel() }
    function touchMove(ev: TouchEvent) {
      if (ev.touches.length !== 1) { cancel(); return }
      const touch = ev.touches[0]
      // Prevent browser horizontal takeover before pointercancel, only for our edge gesture.
      // A blanket pan-y on an ancestor would also disable calendar/other horizontal scrollers.
      if (direction(touch.clientX, touch.clientY) && ev.cancelable) ev.preventDefault()
    }
    cancel = () => {
      activePointer = undefined
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', finish)
      window.removeEventListener('pointercancel', finish)
      window.removeEventListener('pointerdown', anotherPointer, true)
      screen.removeEventListener('touchmove', touchMove)
      cancel = () => {}
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', finish)
    window.addEventListener('pointercancel', finish)
    window.addEventListener('pointerdown', anotherPointer, true)
    screen.addEventListener('touchmove', touchMove, { passive: false })
  }
  screen.addEventListener('pointerdown', start)
  return {
    cancel: () => cancel(),
    dispose() { cancel(); screen.removeEventListener('pointerdown', start) },
  }
}
