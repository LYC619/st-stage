/**
 * 手机壳（无框架原生 DOM，双端复用）：
 * - 收起态：可拖拽的圆形悬浮图标（📱），点击展开
 * - 展开态：手机外壳（状态栏 + 屏幕 + Home 键），屏幕内是 Home 屏 App 栅格或打开的 App
 * - 位置持久化由调用方通过 onStateChange 落盘
 *
 * 样式类名前缀 so-phone-*，样式在 st-extension/style.css（Web 端 globals.css 引用同一段）。
 */

import { t, getLocale } from './i18n'
import { fixedViewport, observeFixedViewport } from './fixed-viewport'
import type { PhoneState } from './types'
import { captureScreenFocus } from './phone-focus'
import type { MountedAppContext, PhoneApp, PhoneAppRegistry } from './phone-registry'

export interface PhoneHomeSummary {
  title: string
  subtitle: string
  rows: Array<{ id: string; appId: string; label: string; value: string }>
}

export type PhoneThemeId = 'midnight' | 'tavern' | 'parchment' | 'aurora' | 'daylight'

export interface PhoneAppearance {
  wallpaper: string
  icons: Record<string, { emoji?: string; image?: string }>
  fonts: Array<{ name: string; cssUrl: string; family: string }>
  activeFont: string
  theme?: PhoneThemeId
  wallpaperDim?: number
  wallpaperBlur?: number
  characterSkins?: Record<string, { theme?: PhoneThemeId; wallpaper?: string }>
}

export interface PhoneShellDeps {
  registry: PhoneAppRegistry
  /** 构造传给 App 的上下文（goHome 由壳注入）；壳在 leaveApp 时调用其 dispose 回收 ctx 资源 */
  createAppContext(appId: string, goHome: () => void): MountedAppContext
  /** 状态变化（拖拽/开合）回调，调用方负责持久化 */
  onStateChange(state: PhoneState): void
  getHomeSummary?(): PhoneHomeSummary
  readHomeSummary?(): Promise<PhoneHomeSummary>
}

export interface PhoneShellController {
  setAppearance(appearance: PhoneAppearance): void
  setState(state: PhoneState): void
  /** 直接打开指定 App（展开手机并进入） */
  openApp(appId: string): void
  /** 显隐整个手机（图标 + 壳）；隐藏时回退纯悬浮窗模式，即时生效；与当前显隐相同时不做任何事 */
  setVisible(visible: boolean): void
  /** App 自己提交核心设置后重绘它（保留滚动与焦点）；其他来源的设置变更不重挂载打开中的 App */
  refreshApp(appId: string): void
  /** Refresh the current role card without remounting an open App. */
  refreshHome(): void
  destroy(): void
}

const DRAG_THRESHOLD = 6

/**
 * Home 屏状态栏标题：面向用户的产品名，不是仓库名/安装目录名。
 * 安装目录叫 st-stage-ext、开发仓库叫 st-stage，两者都不该出现在界面上。
 */
const HOME_TITLE = '百工'

export function createPhoneShell(
  initialState: PhoneState,
  deps: PhoneShellDeps,
): PhoneShellController {
  let state: PhoneState = { ...initialState }
  let activeApp: PhoneApp | null = null
  /** 当次 mount 的 ctx 回收句柄（离开 App 时调用，自动退订经 ctx 建立的订阅/定时器） */
  let activeCtxDispose: (() => void) | null = null
  /** 上一次 renderScreen 时的 App id：同 App 重挂载（设置变更）恢复滚动位置用 */
  let screenScrollAppId: string | null = null
  // 手机总显隐（功能④）：隐藏时图标与壳都不显示，回退纯悬浮窗模式
  let hidden = false
  let destroyed = false
  let homeGeneration = 0
  let homeCard: HTMLDetailsElement | null = null
  let appearance: PhoneAppearance = { wallpaper: '', icons: {}, fonts: [], activeFont: '' }
  let fontLink: HTMLLinkElement | undefined

  /* ---- 悬浮图标 ---- */
  const fab = document.createElement('div')
  fab.className = 'so-phone-fab'
  fab.title = t('phone.open', '打开手机')
  fab.textContent = '📱'
  fab.setAttribute('role', 'button')
  fab.setAttribute('aria-label', t('phone.open_panel', '打开手机面板'))
  fab.tabIndex = 0
  fab.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return
    event.preventDefault()
    event.stopPropagation()
    commitState({ ...state, open: true })
    renderScreen()
    focusHome()
  })

  /* ---- 手机壳 ---- */
  const shell = document.createElement('div')
  shell.className = 'so-phone-shell'
  shell.setAttribute('role', 'region')
  shell.setAttribute('aria-label', HOME_TITLE)
  shell.style.display = 'none'
  const stopShellEvent = (event: Event) => event.stopPropagation()
  for (const type of ['pointerdown', 'touchstart', 'click']) {
    shell.addEventListener(type, stopShellEvent)
  }
  shell.addEventListener('keydown', (event) => {
    // Keep native input/selection defaults while isolating ST's global shortcuts.
    event.stopPropagation()
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) {
      event.preventDefault()
      if (activeApp) goBack()
      else collapse()
    }
  })

  const statusBar = document.createElement('div')
  statusBar.className = 'so-phone-status'
  // App 内左上角返回键：固定在顶部，滚到哪都能返回；先让 App 内部后退一级，到顶层再回主屏
  const backBtn = document.createElement('div')
  backBtn.className = 'so-phone-back'
  backBtn.textContent = '‹'
  backBtn.title = t('phone.back_step', '返回')
  backBtn.setAttribute('role', 'button')
  backBtn.setAttribute('aria-label', t('phone.back_step', '返回'))
  backBtn.tabIndex = 0
  backBtn.addEventListener('click', () => goBack())
  backBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      goBack()
    }
  })
  const statusTitle = document.createElement('span')
  statusTitle.className = 'so-phone-status-title'
  statusTitle.textContent = HOME_TITLE
  const clock = document.createElement('span')
  clock.className = 'so-phone-clock'
  // 右上角固定关闭键：收起手机壳，恢复为可拖动图标（App 会先 unmount）
  const closeBtn = document.createElement('div')
  closeBtn.className = 'so-phone-close'
  closeBtn.textContent = '✕'
  closeBtn.title = t('phone.collapse', '收起手机')
  closeBtn.setAttribute('role', 'button')
  closeBtn.setAttribute('aria-label', t('phone.collapse', '收起手机'))
  closeBtn.tabIndex = 0
  const collapse = () => {
    leaveApp()
    commitState({ ...state, open: false })
    if (!hidden) fab.focus({ preventScroll: true })
  }
  closeBtn.addEventListener('click', collapse)
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      collapse()
    }
  })
  const indicators = document.createElement('span')
  indicators.className = 'so-phone-indicators'
  indicators.textContent = '5G 🔋'
  statusBar.append(backBtn, statusTitle, indicators, clock, closeBtn)

  const screen = document.createElement('div')
  screen.className = 'so-phone-screen'

  // 底部圆形 Home 键（≥44×44 命中区）：只负责返回主屏，收起手机用右上角 ✕
  const homeBar = document.createElement('div')
  homeBar.className = 'so-phone-homebar'
  const homeBtn = document.createElement('div')
  homeBtn.className = 'so-phone-homebtn'
  homeBtn.title = t('phone.back', '返回主屏')
  homeBtn.setAttribute('role', 'button')
  homeBtn.setAttribute('aria-label', t('phone.back', '返回主屏'))
  homeBtn.tabIndex = 0
  homeBar.append(homeBtn)

  shell.append(statusBar, screen, homeBar)
  document.body.append(fab, shell)

  const clockTimer = setInterval(updateClock, 30_000)
  updateClock()
  function updateClock(): void {
    clock.textContent = new Date().toLocaleTimeString(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  /* ---- 布局 ---- */
  /** 可视视口尺寸：优先 visualViewport（移动端地址栏伸缩/软键盘时更准） */
  function viewportSize(): { w: number; h: number; left: number; top: number } {
    const vv = fixedViewport()
    return {
      w: Math.round(vv.width),
      h: Math.round(vv.height),
      left: Math.round(vv.left),
      top: Math.round(vv.top),
    }
  }

  function applyLayout(): void {
    if (hidden) {
      fab.style.display = 'none'
      shell.style.display = 'none'
      return
    }
    const { w: vw, h: vh, left, top } = viewportSize()
    const clampedX = Math.max(0, Math.min(state.x, vw - 56))
    const clampedY = Math.max(0, Math.min(state.y, vh - 56))
    fab.style.left = `${left + clampedX}px`
    fab.style.top = `${top + clampedY}px`
    fab.style.display = state.open ? 'none' : 'flex'
    shell.style.display = state.open ? 'flex' : 'none'
    if (state.open) {
      // 手机按真实尺寸完整钳入视口：窄屏收窄、矮屏压高，保证四边都在可视区内。
      // 高度跟随宽度取接近真机的 2:1（下限沿用 580），高屏不再把聊天类 App 压成矮条。
      const targetMaxW = vw >= 768 ? 380 : 320
      const shellW = Math.min(targetMaxW, vw - 16)
      const shellH = Math.min(Math.max(580, shellW * 2), vh - 16)
      shell.style.width = `${shellW}px`
      shell.style.height = `${shellH}px`
      shell.style.left = `${left + Math.max(8, Math.min(clampedX, vw - shellW - 8))}px`
      shell.style.top = `${top + Math.max(8, Math.min(clampedY, vh - shellH - 8))}px`
    }
  }
  applyLayout()
  // 旋转屏幕 / 移动端地址栏伸缩 / 软键盘弹出时重新钳位
  const stopViewport = observeFixedViewport(applyLayout)

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
        // 触屏 tap（桌面鼠标同理）在 pointerup 后还会在同一坐标补发一个合成 click；
        // 此时图标已隐藏、壳已渲染，这发 click 会"幽灵点击"落点下的 App 图标。
        // 展开前挂一个一次性捕获监听吞掉它（未补发则 400ms 后自清）。
        const swallowGhostClick = (e: MouseEvent) => {
          e.stopPropagation()
          e.preventDefault()
        }
        window.addEventListener('click', swallowGhostClick, { capture: true, once: true })
        setTimeout(
          () => window.removeEventListener('click', swallowGhostClick, { capture: true }),
          400,
        )
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
    if (activeApp) goHome()
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
  /** 已执行 mount、尚未 unmount 的 App：同一 App 重挂载前必须先完整卸载，否则订阅/定时器泄漏 */
  let mountedApp: PhoneApp | null = null

  function unmountActive(): void {
    if (!mountedApp) return
    const app = mountedApp
    mountedApp = null
    try {
      app.unmount?.()
    } catch (err) {
      console.error(`[sprite-overlay] App「${app.id}」unmount 失败`, err)
    }
    // ctx 资源回收在 unmount 之后：unmount 里仍可正常使用 ctx（如保存状态）
    activeCtxDispose?.()
    activeCtxDispose = null
  }

  function leaveApp(): void {
    if (activeApp) {
      screen.classList.remove('so-phone-screen-fullbleed')
      unmountActive()
      activeApp = null
    }
  }

  function renderScreen(): void {
    ++homeGeneration
    homeCard = null
    // 同一 App 因设置变更整体重挂载时保持滚动位置：拨一个开关整页跳回顶部的体验极差
    const prevScrollAppId = screenScrollAppId
    const prevScrollTop = screen.scrollTop
    const restore = prevScrollAppId === activeApp?.id ? captureScreenFocus(screen, focusApp) : null
    unmountActive()
    screen.innerHTML = ''
    screen.classList.toggle('so-phone-screen-wallpaper', !activeApp && !!appearance.wallpaper)
    backBtn.style.display = activeApp ? 'flex' : 'none'
    if (activeApp) {
      statusTitle.textContent = activeApp.name
      if (activeApp.fullbleed) {
        screen.classList.add('so-phone-screen-fullbleed')
      } else {
        screen.classList.remove('so-phone-screen-fullbleed')
      }
      const container = document.createElement('div')
      container.className = 'so-phone-app-container'
      if (activeApp.fullbleed) {
        container.classList.add('so-phone-app-fullbleed')
      }
      container.tabIndex = -1
      container.setAttribute('role', 'group')
      container.setAttribute('aria-label', activeApp.name)
      screen.append(container)
      try {
        const mounted = deps.createAppContext(activeApp.id, goHome)
        activeCtxDispose = mounted.dispose
        mountedApp = activeApp
        activeApp.mount(container, mounted.ctx)
      } catch (err) {
        console.error(`[sprite-overlay] App「${activeApp.id}」mount 失败`, err)
        unmountActive()
        // 强清容器：mount 半途抛错可能留下半渲染 DOM，错误占位页不与残骸混排
        container.replaceChildren()
        const errBox = document.createElement('div')
        errBox.className = 'so-phone-app-error'
        errBox.textContent = t('phone.app_error', 'App 打开失败，详见控制台')
        container.append(errBox)
      }
      if (prevScrollAppId === activeApp.id && prevScrollTop > 0) screen.scrollTop = prevScrollTop
      screenScrollAppId = activeApp.id
      restore?.()
      return
    }

    screenScrollAppId = null
    screen.classList.remove('so-phone-screen-fullbleed')
    statusTitle.textContent = HOME_TITLE
    if (deps.getHomeSummary) {
      homeCard = document.createElement('details')
      homeCard.className = 'so-phone-role'
      homeCard.setAttribute('aria-label', t('phone.role.heading', '当前角色'))
      try { homeCard.open = localStorage.getItem('baigong:phone:role-expanded') === 'true' } catch { /* Storage can be unavailable. */ }
      const roleDetails = homeCard
      homeCard.ontoggle = () => { if (roleDetails.isConnected) { try { localStorage.setItem('baigong:phone:role-expanded', String(roleDetails.open)) } catch { /* Keep session usable. */ } } }
    }
    const grid = document.createElement('div')
    grid.className = 'so-phone-home-grid'
    for (const app of deps.registry.list()) {
      grid.append(renderAppIcon(app))
    }
    screen.append(grid)
    // 角色概览是辅助入口，放在 App 网格之后；默认折叠，避免占据主屏首屏。
    if (homeCard) {
      screen.append(homeCard)
      refreshHome()
    }
  }

  function renderSummary(summary: PhoneHomeSummary): void {
    if (!homeCard) return
    const focused = homeCard.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.roleAction : undefined
    const wasOpen = homeCard instanceof HTMLDetailsElement ? homeCard.open : false
    homeCard.replaceChildren()
    if (homeCard instanceof HTMLDetailsElement) homeCard.open = wasOpen
    const summaryEl = document.createElement('summary')
    const eyebrow = document.createElement('div')
    eyebrow.className = 'so-phone-role-eyebrow'
    eyebrow.textContent = t('phone.role.heading', '当前角色')
    const title = document.createElement('strong')
    title.className = 'so-phone-role-title'
    title.textContent = summary.title
    const subtitle = document.createElement('div')
    subtitle.className = 'so-phone-role-subtitle'
    subtitle.textContent = summary.subtitle
    summaryEl.append(eyebrow, title, subtitle)
    homeCard.append(summaryEl)
    const actions = document.createElement('div')
    actions.className = 'so-phone-role-actions'
    for (const row of summary.rows) {
      if (!deps.registry.get(row.appId)) continue
      const action = document.createElement('button')
      action.type = 'button'
      action.className = 'so-phone-role-action'
      action.dataset.roleAction = row.id
      const label = document.createElement('span'), value = document.createElement('span')
      label.textContent = row.label
      value.textContent = row.value
      action.append(label, value)
      action.addEventListener('click', () => {
        const app = deps.registry.get(row.appId)
        if (!app) return
        leaveApp(); activeApp = app; renderScreen(); focusApp()
      })
      actions.append(action)

    }
    homeCard.append(actions)
    if (focused) [...actions.querySelectorAll<HTMLButtonElement>('button')].find(button => button.dataset.roleAction === focused)?.focus({ preventScroll: true })
  }

  function refreshHome(): void {
    // 收起或隐藏时不读宿主变量：主屏下次展开会重新渲染并读取，避免后台反复轮询
    if (destroyed || hidden || !state.open || activeApp || !homeCard || !deps.getHomeSummary) return
    const generation = ++homeGeneration
    renderSummary(deps.getHomeSummary())
    if (deps.readHomeSummary) void deps.readHomeSummary().then(summary => {
      if (!destroyed && !activeApp && generation === homeGeneration && homeCard?.isConnected) renderSummary(summary)
    }).catch((err) => { console.warn('[st-stage:phone-shell] 读取主屏概览变量状态失败', err) })
  }

  function renderAppIcon(app: PhoneApp): HTMLElement {
    const cell = document.createElement('div')
    cell.className = 'so-phone-app-icon'
    cell.dataset.appId = app.id
    cell.setAttribute('role', 'button')
    cell.tabIndex = 0
    cell.setAttribute('aria-label', t('phone.open_app', '打开 {{name}}', { name: app.name }))

    const icon = document.createElement('div')
    icon.className = 'so-phone-app-glyph'
    const custom = appearance.icons[app.id]
    if (custom?.image) {
      const image = document.createElement('img'); image.alt = app.name; image.src = custom.image
      image.onerror = () => { icon.textContent = app.icon }
      icon.append(image)
    } else icon.textContent = custom?.emoji || app.icon

    const label = document.createElement('div')
    label.className = 'so-phone-app-label'
    label.textContent = app.name

    cell.append(icon, label)
    const openThis = () => {
      activeApp = app
      renderScreen()
      focusApp()
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
    const appId = activeApp?.id
    leaveApp()
    renderScreen()
    focusHome(appId)
  }

  /** 后退一级：App 有内部页面时先交给它（如聊天 → 列表），否则回主屏。 */
  function goBack(): void {
    try {
      if (activeApp?.back?.()) return
    } catch (err) {
      console.error(`[sprite-overlay] App「${activeApp?.id}」back 失败`, err)
    }
    goHome()
  }

  function focusHome(appId?: string): void {
    const icons = Array.from(screen.querySelectorAll<HTMLElement>('.so-phone-app-icon'))
    ;(icons.find(icon => icon.dataset.appId === appId) ?? icons[0] ?? closeBtn).focus({ preventScroll: true })
  }

  function focusApp(): void {
    screen.querySelector<HTMLElement>('.so-phone-app-container')?.focus({ preventScroll: true })
  }


  return {
    refreshHome,
    setAppearance(next: PhoneAppearance) {
      if (destroyed) return
      appearance = next
      if (next.wallpaper) screen.style.setProperty('--so-wallpaper', `url(${JSON.stringify(next.wallpaper)})`)
      else screen.style.removeProperty('--so-wallpaper')
      const font = next.fonts.find(font => font.name === next.activeFont)
      if (font) {
        if (!fontLink) {
          fontLink = document.head.querySelector<HTMLLinkElement>('link[data-so-font]') ?? document.createElement('link')
          fontLink.rel = 'stylesheet'; fontLink.dataset.soFont = ''; document.head.append(fontLink)
        }
        fontLink.href = font.cssUrl; shell.style.fontFamily = font.family
      } else { fontLink?.remove(); fontLink = undefined; shell.style.removeProperty('font-family') }
      if (!activeApp && state.open) renderScreen()
    },
    setState(next: PhoneState) {
      if (destroyed) return
      const wasOpen = state.open
      state = { ...next }
      // 收起（外部调用如 collapsePhone）也走完整生命周期：先卸载 App 清理定时器/监听
      if (wasOpen && !state.open) leaveApp()
      applyLayout()
      if (state.open) renderScreen()
    },
    openApp(appId: string) {
      if (destroyed) return
      const app = deps.registry.get(appId)
      if (!app) return
      leaveApp()
      activeApp = app
      if (!state.open) commitState({ ...state, open: true })
      renderScreen()
      focusApp()
    },
    setVisible(visible: boolean) {
      if (destroyed) return
      // 平台每次改核心设置都会同步一次显隐；未变化时不重绘，打开中的 App（草稿、在途请求、勾选）不受外部设置打扰
      if (hidden === !visible) return
      hidden = !visible
      // 整机隐藏时同样卸载 App（不可见的 App 不允许残留定时器）
      if (hidden) leaveApp()
      applyLayout()
      if (!hidden && state.open) renderScreen()
    },
    refreshApp(appId: string) {
      if (destroyed || hidden || !state.open || activeApp?.id !== appId) return
      renderScreen()
    },
    destroy() {
      if (destroyed) return
      destroyed = true
      clearInterval(clockTimer)
      stopViewport()
      unsubscribe()
      leaveApp()
      for (const type of ['pointerdown', 'touchstart', 'click']) {
        shell.removeEventListener(type, stopShellEvent)
      }
      fab.remove()
      shell.remove()
      fontLink?.remove()
    },
  }
}
