/**
 * 原生 DOM 悬浮窗（ST 端）：不依赖 React，挂载到 document.body。
 * 支持拖拽移动、右下角缩放、切换淡入淡出。
 */

import type { OverlayLayout } from '../../core/types'

export interface OverlayController {
  setImage(url: string, tag: string): void
  /** 未绑定立绘包时显示占位提示（保留管理入口） */
  setPlaceholder(text: string): void
  setVisible(visible: boolean): void
  setLayout(layout: OverlayLayout): void
  destroy(): void
}

export function createOverlay(
  initialLayout: OverlayLayout,
  onLayoutChange: (layout: OverlayLayout) => void,
  onManage?: () => void,
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

  // 未绑定立绘包时的占位提示
  const placeholder = document.createElement('div')
  placeholder.className = 'sprite-overlay-placeholder'
  placeholder.style.display = 'none'

  // 齿轮按钮：打开立绘包管理弹窗
  const gearBtn = document.createElement('div')
  gearBtn.className = 'sprite-overlay-gear'
  gearBtn.title = '立绘包管理'
  gearBtn.textContent = '⚙'
  gearBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
  gearBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onManage?.()
  })

  frame.append(img, placeholder, tagBadge, gearBtn, resizeHandle)
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
      placeholder.style.display = 'none'
      img.style.display = 'block'
      tagBadge.style.display = ''
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
    setPlaceholder(text: string) {
      img.style.display = 'none'
      tagBadge.style.display = 'none'
      placeholder.textContent = text
      placeholder.style.display = 'flex'
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
