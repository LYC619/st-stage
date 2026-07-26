/**
 * 「API」App — OpenAI 兼容接口快速切换（手机页只做「展示 + 快速切换 + 入口」）：
 * - 当前连接卡：在线状态 / 命中的站点名 / 模型
 * - 站点列表：点行即切换（写 Key → 切自定义源 → 填 URL/模型/附加参数 → 自动连接）
 * - 「管理站点」入口：增删改、拉模型、附加参数走全屏弹窗（api/manager.ts）
 *
 * ST 交互细节全部收敛在 api/bridge.ts；Web 模拟器无 ST 运行时，降级为只读列表。
 */

import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton } from './widgets'
import { API_APP_ID, sanitizeAppData, findActiveProfile, type ApiProfile } from './api/core'
import { readConnection, applyProfile } from './api/bridge'

export interface ApiAppDeps {
  /** 打开站点管理弹窗（index.ts 负责收起手机并在关闭后回本页） */
  openManager: () => void
}

/** toastr 是 ST 全局的通知库；模拟器等场景可能不存在，仅作锦上添花 */
function toast(kind: 'success' | 'error', message: string): void {
  const t = (window as { toastr?: Record<string, (msg: string, title?: string) => void> }).toastr
  t?.[kind]?.(message, 'API 切换')
}

export function apiApp(deps: ApiAppDeps): PhoneApp {
  return {
    id: API_APP_ID,
    name: 'API',
    icon: '📡',
    order: 6,
    mount(container, ctx) {
      render(container, ctx, deps, { busy: false })
    },
  }
}

function render(
  container: HTMLElement,
  ctx: PhoneAppContext,
  deps: ApiAppDeps,
  state: { busy: boolean },
): void {
  container.textContent = ''
  const data = sanitizeAppData(ctx.getAppData())
  const conn = readConnection()
  const active = conn ? findActiveProfile(data.profiles, conn.url) : undefined
  const rerender = () => {
    // 切换是异步的：期间用户可能已退出本 App（container 随之失效）
    if (container.isConnected) render(container, ctx, deps, state)
  }

  // —— 当前连接 ——
  const status = el('div', 'so-app-section')
  const title = el('div', 'so-app-title')
  title.textContent = '当前连接'
  status.append(title)
  if (!conn) {
    const d = el('div', 'so-app-desc')
    d.textContent = '未检测到 SillyTavern 运行时（Web 模拟器中仅展示站点列表）。'
    status.append(d)
  } else {
    const line = el('div', 'so-app-desc')
    const dot = el('span', `stapi-dot${conn.online ? ' stapi-dot-on' : ''}`)
    const text = document.createElement('span')
    text.textContent = conn.online ? '已连接' : '未连接'
    line.append(dot, text)
    status.append(line)

    const site = el('div', 'so-app-desc')
    site.textContent = active
      ? `站点：${active.name}`
      : conn.url
        ? `接口：${conn.url}（未存为站点，可在管理页「读取当前连接」录入）`
        : '尚未配置自定义接口。'
    status.append(site)
    if (conn.model) {
      const model = el('div', 'so-app-desc')
      model.textContent = `模型：${conn.model}`
      status.append(model)
    }
    if (!conn.isCustomSource) {
      const warn = el('div', 'so-app-desc')
      warn.textContent = '当前没有走「自定义(OpenAI 兼容)」接口；点下方任一站点即可切换接管。'
      status.append(warn)
    }
  }
  container.append(status)

  // —— 站点列表（点行即切换）——
  const sites = el('div', 'so-app-section')
  const sitesTitle = el('div', 'so-app-title')
  sitesTitle.textContent = `站点（${data.profiles.length}）`
  sites.append(sitesTitle)

  const feedback = el('div', 'so-app-desc')
  feedback.hidden = true
  const say = (text: string) => {
    feedback.textContent = text
    feedback.hidden = false
  }

  if (data.profiles.length === 0) {
    const empty = el('div', 'so-app-desc')
    empty.textContent = '还没有站点，点下方「管理站点」添加。'
    sites.append(empty)
  }

  const doSwitch = (p: ApiProfile) => {
    if (state.busy) return
    if (!conn) {
      say('仅在 SillyTavern 内可切换。')
      return
    }
    state.busy = true
    say(`正在切换到「${p.name}」…`)
    applyProfile(p)
      .then(() => {
        toast('success', `已切换到「${p.name}」`)
        // 连接结果异步返回，稍等一拍再刷新在线状态
        return new Promise<void>((resolve) => setTimeout(resolve, 800))
      })
      .catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err)
        toast('error', msg)
        say(`切换失败：${msg}`)
        console.error('[st-stage] API 切换失败', err)
      })
      .then(() => {
        state.busy = false
        rerender()
      })
  }

  for (const p of data.profiles) {
    const isActive = active?.id === p.id
    const row = el('div', `stapi-row${isActive ? ' stapi-row-on' : ''}`)
    row.setAttribute('role', 'button')
    row.tabIndex = 0
    const main = el('div', 'stapi-row-main')
    const name = el('div', 'stapi-row-name')
    name.textContent = p.name
    main.append(name)
    const subParts = [p.model || '模型沿用当前']
    if (p.includeBody.trim() || p.excludeBody.trim() || p.includeHeaders.trim()) subParts.push('附加参数')
    const sub = el('div', 'stapi-row-sub')
    sub.textContent = subParts.join(' · ')
    main.append(sub)
    const mark = el('div', 'stapi-row-mark')
    mark.textContent = isActive ? '✓' : '›'
    row.append(main, mark)
    row.addEventListener('click', () => doSwitch(p))
    row.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        doSwitch(p)
      }
    })
    sites.append(row)
  }
  sites.append(feedback)
  container.append(sites)

  // —— 管理入口 ——
  const manage = el('div', 'so-app-section')
  const manageDesc = el('div', 'so-app-desc')
  manageDesc.textContent = '添加/编辑站点 · 从接口获取模型 · 附加参数（随站点切换）。'
  manage.append(manageDesc, appButton('管理站点', () => deps.openManager()))
  container.append(manage)
}
