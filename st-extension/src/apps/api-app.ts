import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton } from './widgets'
import { API_APP_ID, findActiveProfile, getSource, profileSummary, sanitizeAppData, type ApiProfile } from './api/core'
import { applyProfile, onOnlineStatusChanged, readConnection, toast } from './api/bridge'

export interface ApiAppDeps { openManager: () => void }

export function apiApp(deps: ApiAppDeps): PhoneApp {
  let unsubscribe: (() => void) | null = null
  return {
    id: API_APP_ID, name: 'API', icon: '📡', order: 6,
    mount(container, ctx) {
      const state = { busy: false, message: '' }
      void render(container, ctx, deps, state)
      unsubscribe = onOnlineStatusChanged(() => { if (!state.busy && container.isConnected) void render(container, ctx, deps, state) })
    },
    unmount() { unsubscribe?.(); unsubscribe = null },
  }
}

async function render(container: HTMLElement, ctx: PhoneAppContext, deps: ApiAppDeps, state: { busy: boolean; message: string }): Promise<void> {
  const data = sanitizeAppData(ctx.getAppData()); const connection = await readConnection()
  if (!container.isConnected) return
  const active = connection ? findActiveProfile(data.profiles, connection) : undefined
  container.textContent = ''

  const status = el('div', 'so-app-section'); const title = el('div', 'so-app-title'); title.textContent = '当前连接'; status.append(title)
  const line = el('div', 'so-app-desc')
  if (!connection) line.textContent = '未检测到 SillyTavern 运行时（这里只展示已保存档案）。'
  else {
    const source = getSource(connection.mainApi, connection.source)
    line.textContent = `${connection.online ? '已连接' : '未连接'} · ${source.label}${active ? ` · ${active.name}` : ''}`
    const detail = el('div', 'so-app-desc'); detail.textContent = [connection.url, connection.model].filter(Boolean).join(' · ') || '该来源没有地址或模型字段'; status.append(detail)
  }
  status.append(line); container.append(status)

  const profiles = el('div', 'so-app-section'); const profilesTitle = el('div', 'so-app-title'); profilesTitle.textContent = `连接档案（${data.profiles.length}）`; profiles.append(profilesTitle)
  if (!data.profiles.length) { const empty = el('div', 'so-app-desc'); empty.textContent = '还没有连接档案，请进入管理页添加或导入。'; profiles.append(empty) }
  for (const profile of data.profiles) profiles.append(buildRow(profile, active?.id === profile.id, state.busy, () => void switchProfile(profile)))
  if (state.message) { const feedback = el('div', 'so-app-desc'); feedback.textContent = state.message; profiles.append(feedback) }
  container.append(profiles)

  const manage = el('div', 'so-app-section'); const description = el('div', 'so-app-desc'); description.textContent = '管理全部 Chat Completion、Text Completion 与其他 SillyTavern API 档案。'; manage.append(description, appButton('管理连接档案', deps.openManager)); container.append(manage)

  async function switchProfile(profile: ApiProfile): Promise<void> {
    if (state.busy || !connection) return
    state.busy = true; state.message = `正在应用「${profile.name}」的类型、来源、密钥、URL 与模型…`; await render(container, ctx, deps, state)
    try {
      await applyProfile(profile); state.message = `「${profile.name}」设置已回验，正在连接…`; toast('success', state.message)
    } catch (error) {
      state.message = `切换失败：${error instanceof Error ? error.message : String(error)}`; toast('error', state.message); console.error('[st-stage] API 切换失败', error)
    } finally {
      state.busy = false; await render(container, ctx, deps, state)
    }
  }
}

function buildRow(profile: ApiProfile, active: boolean, busy: boolean, onActivate: () => void): HTMLElement {
  const row = el('div', `stapi-row${active ? ' stapi-row-on' : ''}${busy ? ' stapi-row-busy' : ''}`); row.setAttribute('role', 'button'); row.tabIndex = busy ? -1 : 0; row.setAttribute('aria-disabled', String(busy))
  const main = el('div', 'stapi-row-main'); const name = el('div', 'stapi-row-name'); name.textContent = profile.name
  const summary = el('div', 'stapi-row-sub'); summary.textContent = profileSummary(profile).join(' · '); main.append(name, summary)
  const mark = el('div', 'stapi-row-mark'); mark.textContent = active ? '使用中' : '切换'; row.append(main, mark)
  row.addEventListener('click', () => { if (!busy) onActivate() }); row.addEventListener('keydown', (event) => { if (!busy && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onActivate() } })
  return row
}
