'use client'

/**
 * 立绘悬浮窗：fixed 定位、可拖拽、右下角缩放、切换时淡入淡出。
 * React 薄壳，状态与匹配逻辑在 core 层。
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import type { OverlayLayout } from '@/core/types'

interface SpriteOverlayProps {
  imageUrl: string | null
  tag: string | null
  characterName: string
  layout: OverlayLayout
  onLayoutChange: (layout: OverlayLayout) => void
  visible: boolean
}

export function SpriteOverlay({
  imageUrl,
  tag,
  characterName,
  layout,
  onLayoutChange,
  visible,
}: SpriteOverlayProps) {
  const [displayUrl, setDisplayUrl] = useState(imageUrl)
  const [fading, setFading] = useState(false)
  const dragState = useRef<{ mode: 'move' | 'resize'; startX: number; startY: number; origin: OverlayLayout } | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  // 图片切换时淡出 → 换图 → 淡入
  useEffect(() => {
    if (imageUrl === displayUrl) return
    setFading(true)
    const timer = setTimeout(() => {
      setDisplayUrl(imageUrl)
      setFading(false)
    }, 180)
    return () => clearTimeout(timer)
  }, [imageUrl, displayUrl])

  const onPointerDown = useCallback(
    (mode: 'move' | 'resize') => (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      dragState.current = { mode, startX: e.clientX, startY: e.clientY, origin: { ...layoutRef.current } }

      const onMove = (ev: PointerEvent) => {
        const state = dragState.current
        if (!state) return
        const dx = ev.clientX - state.startX
        const dy = ev.clientY - state.startY
        if (state.mode === 'move') {
          onLayoutChange({
            ...state.origin,
            x: Math.max(0, state.origin.x + dx),
            y: Math.max(0, state.origin.y + dy),
          })
        } else {
          onLayoutChange({
            ...state.origin,
            width: Math.min(600, Math.max(100, state.origin.width + dx)),
          })
        }
      }
      const onUp = () => {
        dragState.current = null
        window.removeEventListener('pointermove', onMove)
        window.removeEventListener('pointerup', onUp)
      }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    },
    [onLayoutChange],
  )

  if (!visible || !displayUrl) return null

  return (
    <div
      className="fixed z-50 select-none"
      style={{ left: layout.x, top: layout.y, width: layout.width }}
      role="img"
      aria-label={`${characterName}的立绘${tag ? `：${tag}` : ''}`}
    >
      <div
        className="group relative cursor-move overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
        onPointerDown={onPointerDown('move')}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={displayUrl || '/placeholder.svg'}
          alt=""
          draggable={false}
          className="block w-full transition-opacity duration-200"
          style={{ opacity: fading ? 0 : 1 }}
        />
        {/* 标签徽章 */}
        {tag && (
          <div className="pointer-events-none absolute bottom-2 left-2 rounded-md bg-foreground/70 px-2 py-0.5 text-xs text-background backdrop-blur-sm">
            {tag}
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
