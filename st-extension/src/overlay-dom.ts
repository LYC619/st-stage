/**
 * 原生 DOM 悬浮窗（ST 端）：不依赖 React，挂载到 document.body。
 * 支持拖拽移动、右下角缩放、切换淡入淡出。
 */

import type { OverlayLayout } from '../../core/types'

export interface OverlayController {
  setImage(url: string, tag: string): void
  setVisible(visible: boolean): void
  setLayout(layout: OverlayLayout): void
  destroy(): void
}

export function createOverlay(
  initialLayout: OverlayLayout,
  onLayoutChange: (layout: OverlayLayout) => void,
): OverlayController {
  let layout = { ...initialLayout }

  const root = document.createElement('div')
  root.id = 'sprite-overlay-root'
  root.style.display = 'none'

  const frame = document.createElement('div')
  frame.className = 'sprite-overlay-frame'

  const img = document.createElement('img')
  img.alt = ''
  img.draggable = false

  const tagBadge = document.createElement('div')
  tagBadge.className = 'sprite-overlay-tag'

  const resizeHandle = document.createElement('div')
  resizeHandle.className = 'sprite-overlay-resize'

  frame.append(img, tagBadge, resizeHandle)
  root.append(frame)
  document.body.append(root)

  function applyLayout() {
    root.style.left = `${layout.x}px`
    root.style.top = `${layout.y}px`
    root.style.width = `${layout.width}px`
  }
  applyLayout()

  function startDrag(mode: 'move' | 'resize', startEvent: PointerEvent) {
    startEvent.preventDefault()
    const startX = startEvent.clientX
    const startY = startEvent.clientY
    const origin = { ...layout }

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (mode === 'move') {
        layout = { ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) }
      } else {
        layout = { ...origin, width: Math.min(600, Math.max(100, origin.width + dx)) }
      }
      applyLayout()
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onLayoutChange(layout)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  frame.addEventListener('pointerdown', (e) => {
    if (e.target === resizeHandle) return
    startDrag('move', e)
  })
  resizeHandle.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    startDrag('resize', e)
  })

  let fadeTimer: ReturnType<typeof setTimeout> | null = null

  return {
    setImage(url: string, tag: string) {
      if (img.src === url) return
      img.style.opacity = '0'
      if (fadeTimer) clearTimeout(fadeTimer)
      fadeTimer = setTimeout(() => {
        img.src = url
        tagBadge.textContent = tag
        img.onload = () => {
          img.style.opacity = '1'
        }
        // 已缓存图片可能不触发 onload
        if (img.complete) img.style.opacity = '1'
      }, 180)
    },
    setVisible(visible: boolean) {
      root.style.display = visible ? 'block' : 'none'
    },
    setLayout(next: OverlayLayout) {
      layout = { ...next }
      applyLayout()
    },
    destroy() {
      root.remove()
    },
  }
}
