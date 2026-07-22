/**
 * 手机壳（无框架原生 DOM，双端复用）：
 * - 收起态：可拖拽的圆形悬浮图标（📱），点击展开
 * - 展开态：手机外壳（状态栏 + 屏幕 + Home 键），屏幕内是 Home 屏 App 栅格或打开的 App
 * - 位置持久化由调用方通过 onStateChange 落盘
 *
 * 样式类名前缀 so-phone-*，样式在 st-extension/style.css（Web 端 globals.css 引用同一段）。
 */

import type { PhoneState } from './types'
import type { PhoneApp, PhoneAppContext, PhoneAppRegistry } from './phone-registry'

export interface PhoneShellDeps {
  registry: PhoneAppRegistry
  /** 构造传给 App 的上下文（goHome 由壳注入） */
  createAppContext(appId: string, goHome: () => void): PhoneAppContext
  /** 状态变化（拖拽/开合）回调，调用方负责持久化 */
  onStateChange(state: PhoneState): void
}

export interface PhoneShellController {
  setState(state: PhoneState): void
  /** 直接打开指定 App（展开手机并进入） */
  openApp(appId: string): void
  /** 显隐整个手机（图标 + 壳）；隐藏时回退纯悬浮窗模式，即时生效 */
  setVisible(visible: boolean): void
  destroy(): void
}

const DRAG_THRESHOLD = 6

export function createPhoneShell(
  initialState: PhoneState,
  deps: PhoneShellDeps,
): PhoneShellController {
  let state: PhoneState = { ...initialState }
  let activeApp: PhoneApp | null = null
  // 手机总显隐（功能④）：隐藏时图标与壳都不显示，回退纯悬浮窗模式
  let hidden = false

  /* ---- 悬浮图标 ---- */
  const fab = document.createElement('div')
  fab.className = 'so-phone-fab'
  fab.title = '打开手机'
  fab.textContent = '📱'
  fab.setAttribute('role', 'button')
  fab.setAttribute('aria-label', '打开手机面板')

  /* ---- 手机壳 ---- */
  const shell = document.createElement('div')
  shell.className = 'so-phone-shell'
  shell.style.display = 'none'

  const statusBar = document.createElement('div')
  statusBar.className = 'so-phone-status'
  // App 内左上角返回键：固定在顶部，滚到哪都能返回
  const backBtn = document.createElement('div')
  backBtn.className = 'so-phone-back'
  backBtn.textContent = '‹'
  backBtn.title = '返回主屏'
  backBtn.setAttribute('role', 'button')
  backBtn.setAttribute('aria-label', '返回主屏')
  backBtn.tabIndex = 0
  backBtn.addEventListener('click', () => goHome())
  backBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      goHome()
    }
  })
  const statusTitle = document.createElement('span')
  statusTitle.className = 'so-phone-status-title'
  statusTitle.textContent = 'st-stage'
  const clock = document.createElement('span')
  clock.className = 'so-phone-clock'
  // 右上角固定关闭键：收起手机壳，恢复为可拖动图标（App 会先 unmount）
  const closeBtn = document.createElement('div')
  closeBtn.className = 'so-phone-close'
  closeBtn.textContent = '✕'
  closeBtn.title = '收起手机'
  closeBtn.setAttribute('role', 'button')
  closeBtn.setAttribute('aria-label', '收起手机')
  closeBtn.tabIndex = 0
  const collapse = () => {
    leaveApp()
    commitState({ ...state, open: false })
  }
  closeBtn.addEventListener('click', collapse)
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      collapse()
    }
  })
  statusBar.append(backBtn, statusTitle, clock, closeBtn)

  const screen = document.createElement('div')
  screen.className = 'so-phone-screen'

  // 底部圆形 Home 键（≥44×44 命中区）：只负责返回主屏，收起手机用右上角 ✕
  const homeBar = document.createElement('div')
  homeBar.className = 'so-phone-homebar'
  const homeBtn = document.createElement('div')
  homeBtn.className = 'so-phone-homebtn'
  homeBtn.title = '返回主屏'
  homeBtn.setAttribute('role', 'button')
  homeBtn.setAttribute('aria-label', '返回主屏')
  homeBtn.tabIndex = 0
  homeBar.append(homeBtn)

  shell.append(statusBar, screen, homeBar)
  document.body.append(fab, shell)

  const clockTimer = setInterval(updateClock, 30_000)
  updateClock()
  function updateClock(): void {
    clock.textContent = new Date().toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /* ---- 布局 ---- */
  /** 可视视口尺寸：优先 visualViewport（移动端地址栏伸缩/软键盘时更准） */
  function viewportSize(): { w: number; h: number } {
    const vv = typeof window !== 'undefined' ? window.visualViewport : null
    return {
      w: Math.round(vv?.width ?? window.innerWidth),
      h: Math.round(vv?.height ?? window.innerHeight),
    }
  }

  function applyLayout(): void {
    if (hidden) {
      fab.style.display = 'none'
      shell.style.display = 'none'
      return
    }
    const { w: vw, h: vh } = viewportSize()
    const clampedX = Math.max(0, Math.min(state.x, vw - 56))
    const clampedY = Math.max(0, Math.min(state.y, vh - 56))
    fab.style.left = `${clampedX}px`
    fab.style.top = `${clampedY}px`
    fab.style.display = state.open ? 'none' : 'flex'
    shell.style.display = state.open ? 'flex' : 'none'
    if (state.open) {
      // 手机按真实尺寸完整钳入视口：窄屏收窄、矮屏压高，保证四边都在可视区内
      const shellW = Math.min(320, vw - 16)
      const shellH = Math.min(580, vh - 16)
      shell.style.width = `${shellW}px`
      shell.style.height = `${shellH}px`
      shell.style.left = `${Math.max(8, Math.min(clampedX, vw - shellW - 8))}px`
      shell.style.top = `${Math.max(8, Math.min(clampedY, vh - shellH - 8))}px`
    }
  }
  applyLayout()
  // 旋转屏幕 / 移动端地址栏伸缩 / 软键盘弹出时重新钳位
  window.addEventListener('resize', applyLayout)
  window.visualViewport?.addEventListener('resize', applyLayout)

  function commitState(next: PhoneState): void {
    state = next
    applyLayout()
    deps.onStateChange(state)
  }

  /* ---- 拖拽（区分点击与拖动） ---- */
  fab.addEventListener('pointerdown', (startEvent) => {
    startEvent.preventDefault()
    const startX = startEvent.clientX
    const startY = startEvent.clientY
    const origin = { ...state }
    let moved = false

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (!moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) return
      moved = true
      state = { ...origin, x: origin.x + dx, y: origin.y + dy }
      applyLayout()
    }
    const onUp = () => {
      cleanup()
      if (moved) {
        commitState(state)
      } else {
        commitState({ ...state, open: true })
        renderScreen()
      }
    }
    // 触屏上浏览器可能中途接管指针（边缘滑动/系统手势）：保留已拖到的位置，不当作点击展开
    const onCancel = () => {
      cleanup()
      if (moved) commitState(state)
    }
    function cleanup() {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('pointercancel', onCancel)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('pointercancel', onCancel)
  })

  // 圆形 Home 键：只返回主屏（在主屏时无动作）；收起手机走右上角 ✕
  const onHomePress = () => {
    if (activeApp) {
      leaveApp()
      renderScreen()
    }
  }
  homeBtn.addEventListener('click', onHomePress)
  homeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onHomePress()
    }
  })

  const unsubscribe = deps.registry.subscribe(() => {
    if (state.open && !activeApp) renderScreen()
  })

  /* ---- 屏幕渲染 ---- */
  function leaveApp(): void {
    if (activeApp) {
      try {
        activeApp.unmount?.()
      } catch (err) {
        console.error(`[sprite-overlay] App「${activeApp.id}」unmount 失败`, err)
      }
      activeApp = null
    }
  }

  function renderScreen(): void {
    screen.innerHTML = ''
    backBtn.style.display = activeApp ? 'flex' : 'none'
    if (activeApp) {
      statusTitle.textContent = activeApp.name
      const container = document.createElement('div')
      container.className = 'so-phone-app-container'
      screen.append(container)
      try {
        activeApp.mount(container, deps.createAppContext(activeApp.id, goHome))
      } catch (err) {
        console.error(`[sprite-overlay] App「${activeApp.id}」mount 失败`, err)
        const errBox = document.createElement('div')
        errBox.className = 'so-phone-app-error'
        errBox.textContent = 'App 打开失败，详见控制台'
        container.append(errBox)
      }
      return
    }

    statusTitle.textContent = 'st-stage'
    const grid = document.createElement('div')
    grid.className = 'so-phone-home-grid'
    for (const app of deps.registry.list()) {
      grid.append(renderAppIcon(app))
    }
    screen.append(grid)
  }

  function renderAppIcon(app: PhoneApp): HTMLElement {
    const cell = document.createElement('div')
    cell.className = 'so-phone-app-icon'
    cell.setAttribute('role', 'button')
    cell.tabIndex = 0
    cell.setAttribute('aria-label', `打开 ${app.name}`)

    const icon = document.createElement('div')
    icon.className = 'so-phone-app-glyph'
    icon.textContent = app.icon

    const label = document.createElement('div')
    label.className = 'so-phone-app-label'
    label.textContent = app.name

    cell.append(icon, label)
    const openThis = () => {
      activeApp = app
      renderScreen()
    }
    cell.addEventListener('click', openThis)
    cell.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        openThis()
      }
    })
    return cell
  }

  function goHome(): void {
    leaveApp()
    renderScreen()
  }

  return {
    setState(next: PhoneState) {
      const wasOpen = state.open
      state = { ...next }
      // 收起（外部调用如 collapsePhone）也走完整生命周期：先卸载 App 清理定时器/监听
      if (wasOpen && !state.open) leaveApp()
      applyLayout()
      if (state.open) renderScreen()
    },
    openApp(appId: string) {
      const app = deps.registry.get(appId)
      if (!app) return
      leaveApp()
      activeApp = app
      if (!state.open) commitState({ ...state, open: true })
      renderScreen()
    },
    setVisible(visible: boolean) {
      hidden = !visible
      // 整机隐藏时同样卸载 App（不可见的 App 不允许残留定时器）
      if (hidden) leaveApp()
      applyLayout()
      if (!hidden && state.open) renderScreen()
    },
    destroy() {
      clearInterval(clockTimer)
      window.removeEventListener('resize', applyLayout)
      window.visualViewport?.removeEventListener('resize', applyLayout)
      unsubscribe()
      leaveApp()
      fab.remove()
      shell.remove()
    },
  }
}
