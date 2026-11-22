/**
 * 手机壳（无框架原生 DOM，双端复用）：
 * - 收起态：可拖拽的圆形悬浮图标（📱 + 未读角标），点击展开
 * - 展开态：掌上 Mini-OS 外壳（状态栏 + 灵动胶囊 + 屏幕 + 手势底栏），支持主题切换、左缘右滑返回与丝滑转场
 * - 位置持久化由调用方通过 onStateChange 落盘
 *
 * 样式类名前缀 so-phone-*，样式在 core/phone-shell.css（ST 与 Web 双端共享）。
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

export interface PhoneWorldWidget {
  characterName: string
  avatarUrl?: string
  dateText?: string
  weatherText?: string
  eventText?: string
  locationText?: string
  questText?: string
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

export interface PhonePillNotification {
  icon?: string
  text: string
  appId?: string
}

export interface PhoneShellDeps {
  registry: PhoneAppRegistry
  /** 构造传给 App 的上下文（goHome 由壳注入）；壳在 leaveApp 时调用其 dispose 回收 ctx 资源 */
  createAppContext(appId: string, goHome: () => void): MountedAppContext
  /** 状态变化（拖拽/开合）回调，调用方负责持久化 */
  onStateChange(state: PhoneState): void
  getHomeSummary?(): PhoneHomeSummary
  readHomeSummary?(): Promise<PhoneHomeSummary>
  getWorldWidget?(): PhoneWorldWidget | null
  readWorldWidget?(): Promise<PhoneWorldWidget | null>
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
  /** Refresh the current role card & world widget without remounting an open App. */
  refreshHome(): void
  /** 在手机顶部弹出灵动通知胶囊（点击可直达对应 App）。 */
  notifyPill(notification: PhonePillNotification): void
  /** 更新各 App 与悬浮球的未读角标计数。 */
  setBadges(badges: Record<string, number>): void
  destroy(): void
}

const DRAG_THRESHOLD = 6
const DOCK_APP_IDS = ['wechat-sister', 'theater', 'story-state', 'chronicle'] as const

/**
 * Home 屏状态栏标题：面向用户的产品名，不是仓库名/安装目录名。
 */
const HOME_TITLE = '百工'

function createStatusIndicatorsSvg(): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = 'so-phone-indicators'
  wrap.setAttribute('aria-hidden', 'true')
  const ns = 'http://www.w3.org/2000/svg'

  const signal = document.createElementNS(ns, 'svg')
  signal.setAttribute('viewBox', '0 0 16 11')
  signal.setAttribute('width', '14')
  signal.setAttribute('height', '10')
  for (const [x, y, h] of [[1, 7, 3], [4.5, 5, 5], [8, 3, 7], [11.5, 1, 9]]) {
    const bar = document.createElementNS(ns, 'rect')
    bar.setAttribute('x', String(x))
    bar.setAttribute('y', String(y))
    bar.setAttribute('width', '2.2')
    bar.setAttribute('height', String(h))
    bar.setAttribute('rx', '0.8')
    bar.setAttribute('fill', 'currentColor')
    signal.append(bar)
  }

  const battery = document.createElementNS(ns, 'svg')
  battery.setAttribute('viewBox', '0 0 22 11')
  battery.setAttribute('width', '19')
  battery.setAttribute('height', '10')
  const body = document.createElementNS(ns, 'rect')
  body.setAttribute('x', '0.75')
  body.setAttribute('y', '1')
  body.setAttribute('width', '17.5')
  body.setAttribute('height', '9')
  body.setAttribute('rx', '2.4')
  body.setAttribute('fill', 'none')
  body.setAttribute('stroke', 'currentColor')
  body.setAttribute('stroke-width', '1.2')
  const fill = document.createElementNS(ns, 'rect')
  fill.setAttribute('x', '2.5')
  fill.setAttribute('y', '2.7')
  fill.setAttribute('width', '12.8')
  fill.setAttribute('height', '5.6')
  fill.setAttribute('rx', '1.2')
  fill.setAttribute('fill', 'currentColor')
  const cap = document.createElementNS(ns, 'rect')
  cap.setAttribute('x', '19.4')
  cap.setAttribute('y', '3.5')
  cap.setAttribute('width', '1.6')
  cap.setAttribute('height', '4')
  cap.setAttribute('rx', '0.8')
  cap.setAttribute('fill', 'currentColor')
  battery.append(body, fill, cap)

  wrap.append(signal, battery)
  return wrap
}

export function createPhoneShell(
  initialState: PhoneState,
  deps: PhoneShellDeps,
): PhoneShellController {
  let state: PhoneState = { ...initialState }
  let activeApp: PhoneApp | null = null
  let activeCtxDispose: (() => void) | null = null
  let screenScrollAppId: string | null = null
  let hidden = false
  let destroyed = false
  let homeGeneration = 0
  let homeCard: HTMLDetailsElement | null = null
  let worldBox: HTMLElement | null = null
  let navMotion: 'none' | 'enter' | 'home' = 'none'
  let appearance: PhoneAppearance = { wallpaper: '', icons: {}, fonts: [], activeFont: '' }
  let appBadges: Record<string, number> = {}
  let fontLink: HTMLLinkElement | undefined
  let pillTimer: ReturnType<typeof setTimeout> | undefined

  /* ---- 悬浮图标 ---- */
  const fab = document.createElement('div')
  fab.className = 'so-phone-fab'
  fab.title = t('phone.open', '打开手机')
  const fabGlyph = document.createElement('span')
  fabGlyph.className = 'so-phone-fab-glyph'
  fabGlyph.textContent = '📱'
  const fabBadge = document.createElement('span')
  fabBadge.className = 'so-phone-fab-badge'
  fabBadge.hidden = true
  fab.append(fabGlyph, fabBadge)
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
  shell.dataset.theme = 'midnight'
  shell.setAttribute('role', 'region')
  shell.setAttribute('aria-label', HOME_TITLE)
  shell.style.display = 'none'
  const stopShellEvent = (event: Event) => event.stopPropagation()
  for (const type of ['pointerdown', 'touchstart', 'click']) {
    shell.addEventListener(type, stopShellEvent)
  }
  shell.addEventListener('keydown', (event) => {
    event.stopPropagation()
    if (event.key === 'Escape' && !event.defaultPrevented && !event.isComposing) {
      event.preventDefault()
      if (activeApp) goBack()
      else collapse()
    }
  })

  const statusBar = document.createElement('div')
  statusBar.className = 'so-phone-status'
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
  const indicators = createStatusIndicatorsSvg()
  statusBar.append(backBtn, statusTitle, indicators, clock, closeBtn)

  /* ---- 灵动通知胶囊 ---- */
  const island = document.createElement('button')
  island.type = 'button'
  island.className = 'so-phone-island'
  island.hidden = true
  let islandTargetApp = ''
  island.addEventListener('click', () => {
    island.hidden = true
    clearTimeout(pillTimer)
    if (islandTargetApp && deps.registry.get(islandTargetApp)) {
      navMotion = 'enter'
      leaveApp()
      activeApp = deps.registry.get(islandTargetApp)!
      renderScreen()
      focusApp()
    }
  })

  const screen = document.createElement('div')
  screen.className = 'so-phone-screen'

  /* ---- 左缘右滑返回手势（App 内生效，避开原生滑块/文本框） ---- */
  screen.addEventListener('pointerdown', (startEv) => {
    if (!activeApp || startEv.button !== 0) return
    const target = startEv.target as HTMLElement | null
    if (target?.closest('input, textarea, select, [data-no-swipe]')) return
    const rect = screen.getBoundingClientRect()
    if (startEv.clientX - rect.left > 22) return
    const startX = startEv.clientX
    const startY = startEv.clientY
    let triggered = false
    const onMove = (ev: PointerEvent) => {
      if (triggered) return
      const dx = ev.clientX - startX
      const dy = ev.clientY - startY
      if (Math.abs(dy) > 42) { cleanupSwipe(); return }
      if (dx >= 58) {
        triggered = true
        cleanupSwipe()
        goBack()
      }
    }
    const cleanupSwipe = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', cleanupSwipe)
      window.removeEventListener('pointercancel', cleanupSwipe)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', cleanupSwipe)
    window.addEventListener('pointercancel', cleanupSwipe)
  })

  // 底部手势 Home 键（≥44×44 命中区）：只负责返回主屏，收起手机用右上角 ✕
  const homeBar = document.createElement('div')
  homeBar.className = 'so-phone-homebar'
  const homeBtn = document.createElement('div')
  homeBtn.className = 'so-phone-homebtn'
  homeBtn.title = t('phone.back', '返回主屏')
  homeBtn.setAttribute('role', 'button')
  homeBtn.setAttribute('aria-label', t('phone.back', '返回主屏'))
  homeBtn.tabIndex = 0
  homeBar.append(homeBtn)

  const wallpaperClip = document.createElement('div')
  wallpaperClip.className = 'so-phone-wallpaper-clip'
  wallpaperClip.setAttribute('aria-hidden', 'true')
  wallpaperClip.hidden = true
  const wallpaperBg = document.createElement('div')
  wallpaperBg.className = 'so-phone-wallpaper-bg'
  wallpaperClip.append(wallpaperBg)

  shell.append(wallpaperClip, statusBar, island, screen, homeBar)
  document.body.append(fab, shell)

  const clockTimer = setInterval(updateClock, 30_000)
  updateClock()
  function updateClock(): void {
    clock.textContent = new Date().toLocaleTimeString(getLocale(), {
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  function syncBadgeDom(): void {
    let total = 0
    for (const val of Object.values(appBadges)) if (val > 0) total += val
    fabBadge.hidden = total <= 0
    fabBadge.textContent = total > 99 ? '99+' : String(total)

    for (const node of screen.querySelectorAll<HTMLElement>('.so-phone-app-icon[data-app-id]')) {
      const id = node.dataset.appId || ''
      const count = appBadges[id] ?? 0
      let badge = node.querySelector<HTMLElement>('.so-phone-icon-badge')
      if (count > 0) {
        if (!badge) {
          badge = document.createElement('span')
          badge.className = 'so-phone-icon-badge'
          node.querySelector('.so-phone-app-glyph')?.append(badge)
        }
        badge.textContent = count > 99 ? '99+' : String(count)
      } else {
        badge?.remove()
      }
    }
    for (const node of screen.querySelectorAll<HTMLElement>('.so-phone-dock-btn[data-dock-app]')) {
      const id = node.dataset.dockApp || ''
      const count = appBadges[id] ?? 0
      node.classList.toggle('has-unread', count > 0)
    }
  }

  /* ---- 布局 ---- */
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
    activeCtxDispose?.()
    activeCtxDispose = null
  }

  function dismissIsland(): void {
    island.hidden = true
    clearTimeout(pillTimer)
  }

  function leaveApp(): void {
    dismissIsland()
    if (activeApp) {
      screen.classList.remove('so-phone-screen-fullbleed')
      unmountActive()
      activeApp = null
    }
  }

  function renderWorldWidget(widget: PhoneWorldWidget | null): void {
    if (!worldBox) return
    if (!widget || (!widget.characterName && !widget.dateText && !widget.locationText)) {
      worldBox.hidden = true
      worldBox.replaceChildren()
      return
    }
    worldBox.hidden = false
    worldBox.replaceChildren()

    const top = document.createElement('div')
    top.className = 'so-phone-world-top'

    if (widget.avatarUrl) {
      const img = document.createElement('img')
      img.className = 'so-phone-world-avatar'
      img.src = widget.avatarUrl
      img.alt = widget.characterName
      img.onerror = () => { img.remove() }
      top.append(img)
    }

    const meta = document.createElement('div')
    meta.className = 'so-phone-world-meta'
    const nameRow = document.createElement('div')
    nameRow.className = 'so-phone-world-title'
    const strong = document.createElement('strong')
    strong.textContent = widget.characterName || HOME_TITLE
    nameRow.append(strong)
    if (widget.weatherText) {
      const wx = document.createElement('span')
      wx.className = 'so-phone-world-pill'
      wx.textContent = widget.weatherText
      nameRow.append(wx)
    }
    meta.append(nameRow)

    const sub = document.createElement('div')
    sub.className = 'so-phone-world-sub'
    sub.textContent = [widget.dateText, widget.locationText].filter(Boolean).join(' · ') || '打开故事聊天，随剧情记录时空与风物'
    meta.append(sub)
    top.append(meta)
    worldBox.append(top)

    const extraLine = widget.eventText || widget.questText
    if (extraLine) {
      const note = document.createElement('div')
      note.className = 'so-phone-world-note'
      note.textContent = extraLine
      worldBox.append(note)
    }

    const quickRow = document.createElement('div')
    quickRow.className = 'so-phone-world-Quick'
    for (const [appId, label] of [['story-state', '🎒 状态手账'], ['chronicle', '📅 风物日历'], ['theater', '🎪 小剧场']] as const) {
      const target = deps.registry.get(appId)
      if (!target) continue
      const btn = document.createElement('button')
      btn.type = 'button'
      btn.className = 'so-phone-world-chip'
      btn.textContent = label
      btn.onclick = () => {
        navMotion = 'enter'
        activeApp = target
        renderScreen()
        focusApp()
      }
      quickRow.append(btn)
    }
    if (quickRow.childElementCount) worldBox.append(quickRow)
  }

  function renderScreen(): void {
    ++homeGeneration
    homeCard = null
    worldBox = null
    const prevScrollAppId = screenScrollAppId
    const prevScrollTop = screen.scrollTop
    const restore = prevScrollAppId === activeApp?.id ? captureScreenFocus(screen, focusApp) : null
    const motion = navMotion
    navMotion = 'none'

    unmountActive()
    screen.innerHTML = ''
    const showWall = !activeApp && !!appearance.wallpaper
    screen.classList.toggle('so-phone-screen-wallpaper', showWall)
    wallpaperClip.hidden = !showWall
    shell.classList.toggle('so-phone-in-app', Boolean(activeApp))
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
      if (motion === 'enter' && prevScrollAppId !== activeApp.id) {
        container.classList.add('so-anim-enter')
      }
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

    if (deps.getWorldWidget || deps.readWorldWidget) {
      worldBox = document.createElement('section')
      worldBox.className = 'so-phone-world'
      worldBox.hidden = true
      screen.append(worldBox)
    }

    if (deps.getHomeSummary) {
      homeCard = document.createElement('details')
      homeCard.className = 'so-phone-role'
      homeCard.setAttribute('aria-label', t('phone.role.heading', '当前角色'))
      try { homeCard.open = localStorage.getItem('baigong:phone:role-expanded') === 'true' } catch { /* Storage can be unavailable. */ }
      const roleDetails = homeCard
      homeCard.ontoggle = () => {
        if (roleDetails.isConnected) {
          try { localStorage.setItem('baigong:phone:role-expanded', String(roleDetails.open)) } catch { /* Keep session usable. */ }
        }
      }
    }

    const grid = document.createElement('div')
    grid.className = `so-phone-home-grid${motion === 'home' ? ' so-anim-home' : ''}`
    for (const app of deps.registry.list()) {
      grid.append(renderAppIcon(app))
    }
    screen.append(grid)

    // 保持 .so-phone-role 紧随 .so-phone-home-grid 之后（锁住辅助卡片与单测 DOM 邻接约定）
    if (homeCard) {
      screen.append(homeCard)
    }

    // 底部磨砂常用叙事 Dock（使用独立类名与属性，不重复 [data-app-id]）
    const dockApps = DOCK_APP_IDS.map(id => deps.registry.get(id)).filter((a): a is PhoneApp => Boolean(a))
    if (dockApps.length >= 2) {
      const dock = document.createElement('nav')
      dock.className = 'so-phone-dock'
      dock.setAttribute('aria-label', '随身快捷栏')
      for (const app of dockApps) {
        const btn = document.createElement('button')
        btn.type = 'button'
        btn.className = 'so-phone-dock-btn'
        btn.dataset.dockApp = app.id
        btn.title = app.name
        const glyph = document.createElement('span')
        glyph.className = 'so-phone-dock-glyph'
        const custom = appearance.icons[app.id]
        if (custom?.image) {
          const img = document.createElement('img')
          img.alt = app.name
          img.src = custom.image
          img.onerror = () => { glyph.textContent = app.icon }
          glyph.append(img)
        } else {
          glyph.textContent = custom?.emoji || app.icon
        }
        const lbl = document.createElement('small')
        lbl.textContent = app.name
        btn.append(glyph, lbl)
        btn.onclick = () => {
          navMotion = 'enter'
          activeApp = app
          renderScreen()
          focusApp()
        }
        dock.append(btn)
      }
      screen.append(dock)
    }

    syncBadgeDom()
    refreshHome()
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
        navMotion = 'enter'
        leaveApp(); activeApp = app; renderScreen(); focusApp()
      })
      actions.append(action)
    }
    homeCard.append(actions)
    if (focused) [...actions.querySelectorAll<HTMLButtonElement>('button')].find(button => button.dataset.roleAction === focused)?.focus({ preventScroll: true })
  }

  function refreshHome(): void {
    if (destroyed || hidden || !state.open || activeApp) return
    const generation = ++homeGeneration
    if (homeCard && deps.getHomeSummary) {
      renderSummary(deps.getHomeSummary())
      if (deps.readHomeSummary) {
        void deps.readHomeSummary().then(summary => {
          if (!destroyed && !activeApp && generation === homeGeneration && homeCard?.isConnected) renderSummary(summary)
        }).catch((err) => { console.warn('[st-stage:phone-shell] 读取主屏概览变量状态失败', err) })
      }
    }
    if (worldBox) {
      if (deps.getWorldWidget) renderWorldWidget(deps.getWorldWidget())
      if (deps.readWorldWidget) {
        void deps.readWorldWidget().then(widget => {
          if (!destroyed && !activeApp && generation === homeGeneration && worldBox?.isConnected) renderWorldWidget(widget)
        }).catch((err) => { console.warn('[st-stage:phone-shell] 读取主屏风物卡片失败', err) })
      }
    }
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

    const count = appBadges[app.id] ?? 0
    if (count > 0) {
      const badge = document.createElement('span')
      badge.className = 'so-phone-icon-badge'
      badge.textContent = count > 99 ? '99+' : String(count)
      icon.append(badge)
    }

    const label = document.createElement('div')
    label.className = 'so-phone-app-label'
    label.textContent = app.name

    cell.append(icon, label)
    const openThis = () => {
      navMotion = 'enter'
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
    navMotion = 'home'
    leaveApp()
    renderScreen()
    focusHome(appId)
  }

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
    notifyPill(notification: PhonePillNotification) {
      if (destroyed || hidden) return
      if (notification.appId && activeApp?.id === notification.appId) return
      clearTimeout(pillTimer)
      islandTargetApp = notification.appId || ''
      island.replaceChildren()
      if (notification.icon) {
        const ic = document.createElement('span')
        ic.className = 'so-phone-island-icon'
        ic.textContent = notification.icon
        island.append(ic)
      }
      const txt = document.createElement('span')
      txt.className = 'so-phone-island-text'
      txt.textContent = notification.text
      island.append(txt)
      island.hidden = false
      pillTimer = setTimeout(() => {
        island.hidden = true
      }, 3800)
    },
    setBadges(badges: Record<string, number>) {
      if (destroyed) return
      appBadges = { ...badges }
      syncBadgeDom()
    },
    setAppearance(next: PhoneAppearance) {
      if (destroyed) return
      appearance = next
      shell.dataset.theme = next.theme || 'midnight'
      if (next.wallpaperDim && next.wallpaperDim > 0) {
        shell.style.setProperty('--so-wall-dim', `${Math.min(0.85, next.wallpaperDim / 100)}`)
      } else {
        shell.style.removeProperty('--so-wall-dim')
      }
      if (next.wallpaperBlur && next.wallpaperBlur > 0) {
        shell.style.setProperty('--so-wall-blur', `${next.wallpaperBlur}px`)
      } else {
        shell.style.removeProperty('--so-wall-blur')
      }
      if (next.wallpaper) {
        const wallValue = `url(${JSON.stringify(next.wallpaper)})`
        shell.style.setProperty('--so-wallpaper', wallValue)
        screen.style.setProperty('--so-wallpaper', wallValue)
      } else {
        shell.style.removeProperty('--so-wallpaper')
        screen.style.removeProperty('--so-wallpaper')
      }
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
      if (wasOpen && !state.open) leaveApp()
      applyLayout()
      if (state.open) renderScreen()
    },
    openApp(appId: string) {
      if (destroyed) return
      const app = deps.registry.get(appId)
      if (!app) return
      navMotion = 'enter'
      leaveApp()
      activeApp = app
      if (!state.open) commitState({ ...state, open: true })
      renderScreen()
      focusApp()
    },
    setVisible(visible: boolean) {
      if (destroyed) return
      if (hidden === !visible) return
      hidden = !visible
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
      clearTimeout(pillTimer)
      stopViewport()
      unsubscribe()
      leaveApp()
      for (const type of ['pointerdown', 'touchstart', 'click']) {
        shell.removeEventListener(type, stopShellEvent)
      }
      fontLink?.remove()
      fab.remove()
      shell.remove()
    },
  }
}
