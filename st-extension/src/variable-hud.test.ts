// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createVariableHud, type HudSectionSnapshot, type VariableHudController } from './variable-hud'

describe('variable HUD viewport bounds and lifecycle', () => {
  const controllers: VariableHudController[] = []
  const frames = new Map<number, FrameRequestCallback>()
  let nextFrame = 0
  let viewport: EventTarget

  beforeEach(() => {
    vi.stubGlobal('innerWidth', 375)
    vi.stubGlobal('innerHeight', 667)
    viewport = Object.assign(new EventTarget(), { offsetLeft: 30, offsetTop: 50 })
    vi.stubGlobal('visualViewport', viewport)
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      frames.set(++nextFrame, callback)
      return nextFrame
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation((id) => { frames.delete(id) })
  })

  afterEach(() => {
    controllers.splice(0).forEach((controller) => controller.dispose())
    frames.clear()
    document.body.replaceChildren()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  function setup(state = { x: 331, y: 623, open: true }, read = async (): Promise<HudSectionSnapshot[]> => [{
    source: 'MVU', root: { a: 'b' }, notice: '',
  }]) {
    const writeState = vi.fn()
    const unsubscribe = vi.fn()
    const controller = createVariableHud({
      readSections: read,
      subscribe: () => unsubscribe,
      readState: () => state,
      writeState,
    })
    controllers.push(controller)
    const root = document.querySelector<HTMLElement>('#st-stage-varhud')!
    const size = { width: 280, height: 380 }
    const measure = vi.spyOn(root, 'getBoundingClientRect').mockImplementation(() => {
      const open = root.classList.contains('so-varhud-open')
      return new DOMRect(Number.parseFloat(root.style.left), Number.parseFloat(root.style.top),
        open ? size.width : 44, open ? size.height : 44)
    })
    return { controller, root, size, measure, writeState, unsubscribe }
  }

  function flushFrame(): void {
    const pending = [...frames.values()]
    frames.clear()
    pending.forEach((callback) => callback(0))
  }

  function pointer(target: EventTarget, type: string, x: number, y: number): void {
    const event = new MouseEvent(type, { clientX: x, clientY: y, button: 0, bubbles: true })
    Object.assign(event, { pointerId: 1, pointerType: 'mouse' })
    target.dispatchEvent(event)
  }

  it('clamps the expanded panel using its complete rendered rectangle', async () => {
    const { root, writeState } = setup()
    await Promise.resolve()
    flushFrame()
    const rect = root.getBoundingClientRect()
    expect([rect.left, rect.top, rect.right, rect.bottom]).toEqual([95, 287, 375, 667])
    expect(writeState).toHaveBeenLastCalledWith({ x: 95, y: 287, open: true })
  })

  it('coalesces window and visual viewport events without applying offsets', async () => {
    const { root, measure } = setup({ x: 95, y: 287, open: true })
    await Promise.resolve()
    flushFrame()
    measure.mockClear()
    vi.stubGlobal('innerWidth', 360)
    vi.stubGlobal('innerHeight', 390)
    window.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    expect(measure).not.toHaveBeenCalled()
    expect(frames.size).toBe(1)
    flushFrame()
    expect(measure).toHaveBeenCalledTimes(1)
    expect(root.style.left).toBe('80px')
    expect(root.style.top).toBe('10px')
  })

  it('re-measures after an asynchronous error increases panel height', async () => {
    let reject!: (error: Error) => void
    const pending = new Promise<HudSectionSnapshot[]>((_, fail) => { reject = fail })
    const { root, size } = setup({ x: 95, y: 500, open: true }, () => pending)
    size.height = 100
    flushFrame()
    size.height = 380
    reject(new Error('<script>not markup</script>'))
    await Promise.resolve()
    flushFrame()
    expect(root.style.top).toBe('287px')
    expect(root.querySelector('script')).toBeNull()
    expect(root.textContent).toContain('<script>not markup</script>')
  })

  it('does not write late async results after dispose', async () => {
    let resolve!: (value: HudSectionSnapshot[]) => void
    const pending = new Promise<HudSectionSnapshot[]>((done) => { resolve = done })
    const { controller, root, writeState } = setup({ x: 10, y: 10, open: true }, () => pending)
    controller.dispose()
    resolve([{ source: 'late', root: { value: 'wrong' }, notice: '' }])
    await Promise.resolve()
    flushFrame()
    expect(root.isConnected).toBe(false)
    expect(root.querySelector('.so-varhud-section')).toBeNull()
    expect(writeState).not.toHaveBeenCalled()
  })

  it('cancels all pending measurements and unsubscribes exactly once', () => {
    const { controller, root, unsubscribe } = setup()
    root.querySelector<HTMLButtonElement>('.so-varhud-close')!.click()
    controller.dispose()
    controller.dispose()
    window.dispatchEvent(new Event('resize'))
    viewport.dispatchEvent(new Event('scroll'))
    expect(frames.size).toBe(0)
    expect(unsubscribe).toHaveBeenCalledTimes(1)
  })

  it('removes active drag listeners when disposed without persisting late pointer events', async () => {
    const { controller, root, writeState } = setup()
    await Promise.resolve()
    flushFrame()
    pointer(root.querySelector('.so-varhud-head')!, 'pointerdown', 100, 300)
    controller.dispose()
    writeState.mockClear()
    pointer(window, 'pointermove', 200, 400)
    pointer(window, 'pointerup', 200, 400)
    expect(writeState).not.toHaveBeenCalled()
    expect(frames.size).toBe(0)
  })

  it('clamps dragging by the full panel and does not toggle on pointercancel', async () => {
    const { root, writeState } = setup({ x: 10, y: 10, open: true })
    await Promise.resolve()
    flushFrame()
    pointer(root.querySelector('.so-varhud-head')!, 'pointerdown', 20, 20)
    pointer(window, 'pointermove', 800, 800)
    pointer(window, 'pointercancel', 800, 800)
    flushFrame()
    expect(writeState).toHaveBeenLastCalledWith({ x: 95, y: 287, open: true })
    expect(root.classList.contains('so-varhud-open')).toBe(true)
    root.querySelector<HTMLButtonElement>('.so-varhud-close')!.click()
    pointer(root.querySelector('.so-varhud-btn')!, 'pointerdown', 100, 300)
    pointer(window, 'pointermove', 800, 800)
    pointer(window, 'pointerup', 800, 800)
    flushFrame()
    expect(writeState).toHaveBeenLastCalledWith({ x: 331, y: 623, open: false })
  })
})
