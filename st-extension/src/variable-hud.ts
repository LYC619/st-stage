/**
 * 变量悬浮窗（Finding 7）：常驻聊天界面的一个可拖动小圆钮，点开列出全部变量当前值。
 *
 * 只读速查，不替代「MVU」/「新变量」App 的变量面板——面板仍是编辑入口。
 * 存在的意义是省掉「开手机 → 开 App → 滑动找变量」。
 *
 * 交互取自悬浮窗立绘的同一套约定（overlay-dom.ts）：
 * - 按下到抬起位移 < 阈值算点击，否则算拖动，避免拖完顺手触发展开
 * - 监听 pointercancel：触屏上系统手势会中途接管指针，不能当成点击
 * - 位置存在 App 私有存储里，跨会话保留
 *
 * 数据源由调用方注入（readSections），本文件不碰 MVU / 酒馆助手全局，
 * 这样两个变量 App 的读取差异不会渗进 UI 层。
 */

import { countLeafRows, flattenVariables, type HudRow } from '../../core/variable-hud'

/** 一个数据源在某一时刻的快照 */
export interface HudSectionSnapshot {
  source: string
  /** 变量根；null 表示该来源当前不可用 */
  root: Record<string, unknown> | null
  /** root 为 null 时的说明文字 */
  notice: string
}

export interface VariableHudDeps {
  /** 读当前所有来源的变量；每次展开与每次收到变化事件时调用 */
  readSections(): Promise<HudSectionSnapshot[]> | HudSectionSnapshot[]
  /** 订阅变量变化；返回退订函数 */
  subscribe(handler: () => void): () => void
  /** 读展开态与位置 */
  readState(): { x: number; y: number; open: boolean }
  /** 写展开态与位置（节流由调用方决定） */
  writeState(state: { x: number; y: number; open: boolean }): void
}

export interface VariableHudController {
  /** 从 DOM 卸下并退订 */
  dispose(): void
  /** 手动重新读取并渲染（展开时才会真的重绘） */
  refresh(): void
}

const DRAG_THRESHOLD = 4
const BUTTON_SIZE = 44

/** 贴边收拢：拖到屏幕外会永远拿不回来，所以夹在可视区内。 */
function clampPosition(x: number, y: number): { x: number; y: number } {
  const maxX = Math.max(0, window.innerWidth - BUTTON_SIZE)
  const maxY = Math.max(0, window.innerHeight - BUTTON_SIZE)
  return {
    x: Math.min(maxX, Math.max(0, x)),
    y: Math.min(maxY, Math.max(0, y)),
  }
}

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

export function createVariableHud(deps: VariableHudDeps): VariableHudController {
  const saved = deps.readState()
  let position = clampPosition(saved.x, saved.y)
  let open = saved.open
  let disposed = false

  const root = el('div', 'so-varhud')
  root.id = 'st-stage-varhud'

  const button = el('button', 'so-varhud-btn')
  button.setAttribute('type', 'button')
  button.setAttribute('aria-label', '变量速查')
  button.textContent = '🔢'

  const panel = el('div', 'so-varhud-panel')
  const panelHead = el('div', 'so-varhud-head')
  const panelTitle = el('span', 'so-varhud-title')
  panelTitle.textContent = '变量速查'
  const closeBtn = el('button', 'so-varhud-close')
  closeBtn.setAttribute('type', 'button')
  closeBtn.setAttribute('aria-label', '收起')
  closeBtn.textContent = '✕'
  panelHead.append(panelTitle, closeBtn)
  const panelBody = el('div', 'so-varhud-body')
  panel.append(panelHead, panelBody)

  root.append(button, panel)
  document.body.append(root)

  function applyPosition(): void {
    root.style.left = `${position.x}px`
    root.style.top = `${position.y}px`
  }

  function applyOpen(): void {
    root.classList.toggle('so-varhud-open', open)
    // 展开时按钮让位给面板：两者不同时出现，省得在小屏上互相遮挡
    button.style.display = open ? 'none' : 'flex'
    panel.style.display = open ? 'flex' : 'none'
  }

  function renderRows(container: HTMLElement, rows: HudRow[]): void {
    for (const row of rows) {
      const line = el('div', row.value === null ? 'so-varhud-group' : 'so-varhud-row')
      line.style.paddingLeft = `${row.depth * 12}px`
      const key = el('span', 'so-varhud-key')
      key.textContent = row.key
      line.append(key)
      if (row.value !== null) {
        const value = el('span', 'so-varhud-value')
        value.textContent = row.value
        line.append(value)
        if (row.description) line.title = row.description
      }
      container.append(line)
    }
  }

  let renderToken = 0
  async function render(): Promise<void> {
    if (disposed || !open) return
    const token = ++renderToken
    let sections: HudSectionSnapshot[]
    try {
      sections = await deps.readSections()
    } catch (err) {
      if (token !== renderToken || disposed) return
      panelBody.textContent = ''
      const fail = el('div', 'so-varhud-notice')
      fail.textContent = `读取失败：${err instanceof Error ? err.message : String(err)}`
      panelBody.append(fail)
      return
    }
    // 异步读期间用户可能已收起或又点开一次：晚到的结果直接丢掉
    if (token !== renderToken || disposed || !open) return

    panelBody.textContent = ''
    let anyRow = false
    for (const section of sections) {
      const block = el('div', 'so-varhud-section')
      const label = el('div', 'so-varhud-source')
      const rows = section.root ? flattenVariables(section.root) : []
      label.textContent = section.root
        ? `${section.source}（${countLeafRows(rows)}）`
        : section.source
      block.append(label)
      if (!section.root) {
        const notice = el('div', 'so-varhud-notice')
        notice.textContent = section.notice || '当前不可用'
        block.append(notice)
      } else if (rows.length === 0) {
        const empty = el('div', 'so-varhud-notice')
        empty.textContent = '暂无变量'
        block.append(empty)
      } else {
        anyRow = true
        renderRows(block, rows)
      }
      panelBody.append(block)
    }
    if (sections.length === 0) {
      const empty = el('div', 'so-varhud-notice')
      empty.textContent = '没有可用的变量来源'
      panelBody.append(empty)
    }
    panelTitle.textContent = anyRow ? '变量速查' : '变量速查（空）'
  }

  function setOpen(next: boolean): void {
    open = next
    applyOpen()
    deps.writeState({ ...position, open })
    if (open) void render()
  }

  // —— 拖动：按下起测位移，超过阈值才算拖，否则抬起时当点击 ——
  function startDrag(event: PointerEvent): void {
    if (event.button !== 0 && event.pointerType === 'mouse') return
    const startX = event.clientX
    const startY = event.clientY
    const origin = { ...position }
    let moved = false

    const onMove = (ev: PointerEvent): void => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      moved = true
      position = clampPosition(origin.x + dx, origin.y + dy)
      applyPosition()
    }
    const finish = (asClick: boolean): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
      if (moved) deps.writeState({ ...position, open })
      else if (asClick) setOpen(!open)
    }
    const onUp = (): void => finish(true)
    // 系统手势接管：保留已拖到的位置，但不当作点击
    const onCancel = (): void => finish(false)

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  }

  button.addEventListener('pointerdown', (event) => {
    event.stopPropagation()
    startDrag(event)
  })
  panelHead.addEventListener('pointerdown', (event) => {
    if (event.target === closeBtn) return
    event.stopPropagation()
    startDrag(event)
  })
  closeBtn.addEventListener('click', (event) => {
    event.stopPropagation()
    setOpen(false)
  })
  // 面板内部的点击不要冒泡到 ST 的聊天控件上（与手机壳同一约定）
  for (const type of ['pointerdown', 'click'] as const) {
    panelBody.addEventListener(type, (event) => event.stopPropagation())
  }

  const unsubscribe = deps.subscribe(() => void render())

  const onResize = (): void => {
    position = clampPosition(position.x, position.y)
    applyPosition()
  }
  window.addEventListener('resize', onResize)

  applyPosition()
  applyOpen()
  if (open) void render()

  return {
    dispose() {
      disposed = true
      unsubscribe()
      window.removeEventListener('resize', onResize)
      root.remove()
    },
    refresh() {
      void render()
    },
  }
}
