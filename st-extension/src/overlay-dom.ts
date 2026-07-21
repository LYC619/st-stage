/**
 * 原生 DOM 悬浮窗（ST 端）：不依赖 React，挂载到 document.body。
 * 支持拖拽移动、右下角缩放、切换淡入淡出。
 * 功能③：一条消息含多张立绘时排队展示 —— 底部圆点指示、点击图片切下一张（循环）、
 * 可选按秒数自动轮播（手动点击后重置计时）。单张时无指示、无轮播，行为同旧版。
 */

import type { OverlayLayout } from '../../core/types'

/** 悬浮窗展示用的最小立绘引用 */
export interface OverlaySprite {
  url: string
  tag: string
}

export interface OverlayController {
  /** 展示单张立绘（等价于 setSprites 传一个元素） */
  setImage(url: string, tag: string): void
  /** 展示一条消息的立绘序列：>1 张时显示圆点指示并支持点击/自动切换 */
  setSprites(sprites: OverlaySprite[]): void
  /** 配置自动轮播（功能③）：enabled 关时仅保留点击切换 */
  setAutoSwitch(enabled: boolean, seconds: number): void
  /** 未绑定立绘包时显示占位提示（保留管理入口） */
  setPlaceholder(text: string): void
  setVisible(visible: boolean): void
  setLayout(layout: OverlayLayout): void
  destroy(): void
}

/** 点击与拖动的判定阈值（px） */
const DRAG_THRESHOLD = 6

export function createOverlay(
  initialLayout: OverlayLayout,
  onLayoutChange: (layout: OverlayLayout) => void,
  onManage?: () => void,
  onClose?: () => void,
): OverlayController {
  let layout = { ...initialLayout }

  // 功能③ 序列状态
  let sprites: OverlaySprite[] = []
  let index = 0
  let autoEnabled = false
  let autoSeconds = 3
  let autoTimer: ReturnType<typeof setInterval> | null = null
  let fadeTimer: ReturnType<typeof setTimeout> | null = null

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

  // 圆点指示器（序列 >1 张时显示）
  const dots = document.createElement('div')
  dots.className = 'sprite-overlay-dots'
  dots.style.display = 'none'

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

  // 关闭按钮：只隐藏窗体并记住状态（不关立绘功能），重新打开入口在「立绘」App
  const closeBtn = document.createElement('div')
  closeBtn.className = 'sprite-overlay-close'
  closeBtn.title = '关闭悬浮窗（立绘功能不受影响，可在手机「立绘」App 重新打开）'
  closeBtn.textContent = '✕'
  closeBtn.setAttribute('role', 'button')
  closeBtn.setAttribute('aria-label', '关闭悬浮窗')
  closeBtn.addEventListener('pointerdown', (e) => e.stopPropagation())
  closeBtn.addEventListener('click', (e) => {
    e.stopPropagation()
    onClose?.()
  })

  frame.append(img, placeholder, tagBadge, dots, gearBtn, closeBtn, resizeHandle)
  root.append(frame)
  document.body.append(root)

  function applyLayout() {
    // 视口钳位（移动端适配）：按真实尺寸完整钳回视口，不只是露出一角。
    // 只钳显示不改 layout —— 回到大屏后仍按原坐标展示。
    const w = Math.min(layout.width, Math.max(100, window.innerWidth - 16))
    root.style.width = `${w}px`
    // 高度随图片比例动态变化：取当前实际高度（未渲染时按最小 48 兜底）
    const h = Math.min(root.offsetHeight || 48, window.innerHeight - 8)
    root.style.left = `${Math.max(0, Math.min(layout.x, window.innerWidth - w))}px`
    root.style.top = `${Math.max(0, Math.min(layout.y, window.innerHeight - h))}px`
  }
  applyLayout()
  // 旋转屏幕 / 移动端地址栏伸缩时重新钳位（visualViewport 对地址栏变化更敏感）
  window.addEventListener('resize', applyLayout)
  window.visualViewport?.addEventListener('resize', applyLayout)
  // 图片加载后高度才确定，重新钳一次
  img.addEventListener('load', applyLayout)

  /** 淡出 → 换图 → 淡入 */
  function showImage(url: string, tag: string) {
    placeholder.style.display = 'none'
    img.style.display = 'block'
    tagBadge.style.display = ''
    if (img.src === url) {
      tagBadge.textContent = tag
      return
    }
    img.style.opacity = '0'
    if (fadeTimer) clearTimeout(fadeTimer)
    fadeTimer = setTimeout(() => {
      img.src = url
      tagBadge.textContent = tag // 与换图同步，避免标签早于图片翻转
      img.onload = () => {
        img.style.opacity = '1'
      }
      // 已缓存图片可能不触发 onload
      if (img.complete) img.style.opacity = '1'
    }, 180)
  }

  /** 重建圆点（序列变化时） */
  function renderDots() {
    dots.replaceChildren()
    if (sprites.length <= 1) {
      dots.style.display = 'none'
      return
    }
    sprites.forEach((_, i) => {
      const dot = document.createElement('span')
      if (i === index) dot.className = 'active'
      dots.append(dot)
    })
    dots.style.display = 'flex'
  }

  /** 展示当前序号的立绘并同步圆点高亮 */
  function renderCurrent() {
    const cur = sprites[index]
    if (!cur) return
    showImage(cur.url, cur.tag)
    Array.from(dots.children).forEach((el, i) =>
      (el as HTMLElement).classList.toggle('active', i === index),
    )
  }

  function stopAuto() {
    if (autoTimer) {
      clearInterval(autoTimer)
      autoTimer = null
    }
  }
  function startAuto() {
    stopAuto()
    if (autoEnabled && sprites.length > 1) {
      autoTimer = setInterval(() => {
        index = (index + 1) % sprites.length
        renderCurrent()
      }, Math.max(1, autoSeconds) * 1000)
    }
  }
  /** 点击切下一张（循环），并重置自动轮播计时 */
  function advanceManually() {
    if (sprites.length <= 1) return
    index = (index + 1) % sprites.length
    renderCurrent()
    startAuto()
  }

  function applySprites(list: OverlaySprite[]) {
    if (list.length === 0) return // 没有匹配到立绘：保持当前不变
    sprites = list
    index = 0
    renderDots()
    renderCurrent()
    startAuto()
  }

  function startDrag(mode: 'move' | 'resize', startEvent: PointerEvent) {
    startEvent.preventDefault()
    const startX = startEvent.clientX
    const startY = startEvent.clientY
    const origin = { ...layout }
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      moved = true
      if (mode === 'move') {
        layout = { ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) }
      } else {
        layout = {
          ...origin,
          width: Math.min(600, window.innerWidth - 16, Math.max(100, origin.width + dx)),
        }
      }
      applyLayout()
    }
    const onUp = () => {
      cleanup()
      if (moved) {
        onLayoutChange(layout)
      } else if (mode === 'move') {
        advanceManually() // 点击（未拖动）→ 切下一张
      }
    }
    // 触屏上浏览器可能中途接管指针（边缘滑动/系统手势）：保留已拖到的位置，不当作点击
    const onCancel = () => {
      cleanup()
      if (moved) onLayoutChange(layout)
    }
    function cleanup() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  frame.addEventListener('pointerdown', (e) => {
    if (e.target === resizeHandle) return
    startDrag('move', e)
  })
  resizeHandle.addEventListener('pointerdown', (e) => {
    e.stopPropagation()
    startDrag('resize', e)
  })

  return {
    setImage(url: string, tag: string) {
      applySprites([{ url, tag }])
    },
    setSprites(list: OverlaySprite[]) {
      applySprites(list)
    },
    setAutoSwitch(enabled: boolean, seconds: number) {
      autoEnabled = enabled
      autoSeconds = Math.max(1, seconds)
      startAuto() // 立即按新配置起停计时
    },
    setPlaceholder(text: string) {
      stopAuto()
      sprites = []
      index = 0
      dots.replaceChildren()
      dots.style.display = 'none'
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
      stopAuto()
      if (fadeTimer) clearTimeout(fadeTimer)
      window.removeEventListener('resize', applyLayout)
      window.visualViewport?.removeEventListener('resize', applyLayout)
      root.remove()
    },
  }
}
