'use client'

/**
 * 立绘悬浮窗：fixed 定位、可拖拽、右下角缩放、切换时淡入淡出。
 * 功能③：接收一条消息的立绘序列，>1 张时底部圆点指示 + 点击切换 + 可选自动轮播。
 * React 薄壳，序列/匹配逻辑在 core 层与父组件。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OverlayLayout } from '@/core/types'

interface SpriteRef {
  url: string
  tag: string
}

interface SpriteOverlayProps {
  /** 当前消息的立绘序列（单张即一个元素） */
  sprites: SpriteRef[]
  characterName: string
  layout: OverlayLayout
  onLayoutChange: (layout: OverlayLayout) => void
  visible: boolean
  /** 自动轮播开关（功能③） */
  autoSwitch: boolean
  /** 自动轮播间隔秒数 */
  autoSwitchSeconds: number
}

const DRAG_THRESHOLD = 6

export function SpriteOverlay({
  sprites,
  characterName,
  layout,
  onLayoutChange,
  visible,
  autoSwitch,
  autoSwitchSeconds,
}: SpriteOverlayProps) {
  const [index, setIndex] = useState(0)
  // 手动点击后自增，作为自动轮播 effect 的依赖 → 重置计时
  const [manualTick, setManualTick] = useState(0)
  const current = sprites[index] ?? null

  const [displayUrl, setDisplayUrl] = useState<string | null>(current?.url ?? null)
  const [fading, setFading] = useState(false)
  const dragState = useRef<{ startX: number; startY: number; origin: OverlayLayout } | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // 序列变化 → 回到第一张
  useEffect(() => {
    setIndex(0)
  }, [sprites])

  // 图片切换时淡出 → 换图 → 淡入
  useEffect(() => {
    const url = current?.url ?? null
    if (url === displayUrl) return
    setFading(true)
    const timer = setTimeout(() => {
      setDisplayUrl(url)
      setFading(false)
    }, 180)
    return () => clearTimeout(timer)
  }, [current?.url, displayUrl])

  // 自动轮播；手动点击（manualTick 变化）会重启计时
  useEffect(() => {
    if (!autoSwitch || sprites.length <= 1) return
    const id = setInterval(
      () => setIndex((i) => (i + 1) % sprites.length),
      Math.max(1, autoSwitchSeconds) * 1000,
    )
    return () => clearInterval(id)
  }, [autoSwitch, autoSwitchSeconds, sprites, manualTick])

  const advance = useCallback(() => {
    if (sprites.length <= 1) return
    setIndex((i) => (i + 1) % sprites.length)
    setManualTick((k) => k + 1)
  }, [sprites.length])

  const onPointerDown = useCallback(
    (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      const startX = e.clientX
      const startY = e.clientY
      const origin = { ...layoutRef.current }
      dragState.current = { startX, startY, origin }
      let moved = false

      const onMove = (ev: PointerEvent) => {
        const dx = ev.clientX - startX
        const dy = ev.clientY - startY
        if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
        moved = true
        if (mode === 'move') {
          onLayoutChange({ ...origin, x: Math.max(0, origin.x + dx), y: Math.max(0, origin.y + dy) })
        } else {
          onLayoutChange({ ...origin, width: Math.min(600, Math.max(100, origin.width + dx)) })
        }
      }
      const onUp = () => {
        dragState.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
        if (!moved && mode === 'move') advance() // 点击（未拖动）→ 切下一张
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [onLayoutChange, advance],
  )

  if (!visible || !displayUrl) return null

  return (
    <div
      className="fixed z-50 select-none"
      style={{ left: layout.x, top: layout.y, width: layout.width }}
      role="img"
      aria-label={`${characterName}的立绘${current?.tag ? `：${current.tag}` : ''}`}
    >
      <div
        className="group relative cursor-move overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onPointerDown={onPointerDown('move')}
      >
        <img
          src={displayUrl || '/placeholder.svg'}
          alt=""
          draggable={false}
          className="block w-full transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        />
        {/* 标签徽章 */}
        {current?.tag && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-foreground/70 px-2 py-0.5 text-xs text-background backdrop-blur-sm">
            {current.tag}
          </div>
        )}
        {/* 圆点指示器（序列 >1 张） */}
        {sprites.length > 1 && (
          <div className="pointer-events-none absolute inset-x-0 bottom-2 flex justify-center gap-1.5">
            {sprites.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 w-1.5 rounded-full ${i === index ? 'bg-white' : 'bg-white/45'}`}
                style={{ boxShadow: '0 0 2px rgba(0,0,0,0.65)' }}
              />
            ))}
          </div>
        )}
        {/* 缩放手柄 */}
        <div
          className="absolute right-0 bottom-0 h-5 w-5 cursor-nwse-resize opacity-0 transition-opacity group-hover:opacity-100"
          onPointerDown={onPointerDown('resize')}
          aria-hidden="true"
        >
          <div className="absolute right-1 bottom-1 h-3 w-3 rounded-sm border-r-2 border-b-2 border-muted-foreground" />
        </div>
      </div>
    </div>
  )
}
