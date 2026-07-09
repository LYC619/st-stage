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
  const statusTitle = document.createElement('span')
  statusTitle.className = 'so-phone-status-title'
  statusTitle.textContent = 'st-stage'
  const clock = document.createElement('span')
  clock.className = 'so-phone-clock'
  statusBar.append(statusTitle, clock)

  const screen = document.createElement('div')
  screen.className = 'so-phone-screen'

  const homeBar = document.createElement('div')
  homeBar.className = 'so-phone-homebar'
  const homeBtn = document.createElement('div')
  homeBtn.className = 'so-phone-homebtn'
  homeBtn.title = '返回主屏 / 收起手机'
  homeBtn.setAttribute('role', 'button')
  homeBtn.setAttribute('aria-label', '返回主屏或收起手机')
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
  function applyLayout(): void {
    if (hidden) {
      fab.style.display = 'none'
      shell.style.display = 'none'
      return
    }
    const clampedX = Math.max(0, Math.min(state.x, window.innerWidth - 56))
    const clampedY = Math.max(0, Math.min(state.y, window.innerHeight - 56))
    fab.style.left = `${clampedX}px`
    fab.style.top = `${clampedY}px`
    fab.style.display = state.open ? 'none' : 'flex'
    shell.style.display = state.open ? 'flex' : 'none'
    if (state.open) {
      // 手机展开位置：优先贴着图标，越界时收回视口内
      const shellW = 320
      const shellH = Math.min(580, window.innerHeight - 32)
      shell.style.height = `${shellH}px`
      shell.style.left = `${Math.max(8, Math.min(clampedX, window.innerWidth - shellW - 8))}px`
      shell.style.top = `${Math.max(8, Math.min(clampedY, window.innerHeight - shellH - 8))}px`
    }
  }
  applyLayout()

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
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (moved) {
        commitState(state)
      } else {
        commitState({ ...state, open: true })
        renderScreen()
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  })

  homeBtn.addEventListener('click', () => {
    if (activeApp) {
      leaveApp()
      renderScreen()
    } else {
      commitState({ ...state, open: false })
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
      state = { ...next }
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
      applyLayout()
    },
    destroy() {
      clearInterval(clockTimer)
      unsubscribe()
      leaveApp()
      fab.remove()
      shell.remove()
    },
  }
}
