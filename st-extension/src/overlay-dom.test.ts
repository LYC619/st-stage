// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createOverlay } from './overlay-dom'

afterEach(() => {
  document.body.replaceChildren()
})

describe('createOverlay app shortcut', () => {
  it('眼睛按钮打开立绘 App，且按钮手势不触发悬浮窗拖拽提交', () => {
    const onLayoutChange = vi.fn()
    const onOpenSprites = vi.fn()
    const overlay = createOverlay(
      { x: 24, y: 80, width: 220 },
      onLayoutChange,
      undefined,
      undefined,
      onOpenSprites,
    )
    const button = document.querySelector<HTMLElement>('[aria-label="打开立绘 App"]')!

    expect(button).not.toBeNull()
    button.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    button.click()

    expect(onOpenSprites).toHaveBeenCalledTimes(1)
    expect(onLayoutChange).not.toHaveBeenCalled()
    overlay.destroy()
  })
})
