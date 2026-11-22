import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton, foldSection } from './widgets'
import { API_APP_ID, findActiveProfile, getSource, profileSummary, sanitizeAppData, type ApiProfile } from './api/core'
import { applyProfile, onOnlineStatusChanged, readConnection, toast, type ConnectionInfo } from './api/bridge'
import { isNativeSwitching, NativeProfileError, onNativeProfilesChanged, readNativeProfiles, switchNativeProfile } from './api/native-profiles'
import { stableCharacterKey } from '../../../core/character-identity'
import { t } from '../../../core/i18n'

export interface ApiAppDeps { openManager: () => void }

interface ApiAppState {
  busy: boolean
  message: string
  connection: ConnectionInfo | null
  connectionLoaded: boolean
  alive: boolean
  refresh: number
}


export function apiApp(deps: ApiAppDeps): PhoneApp {
  let unsubscribe: (() => void) | null = null
  let mounted: ApiAppState | null = null
  return {
    id: API_APP_ID, name: 'API', icon: '📡', order: 6,
    mount(container, ctx) {
      const state: ApiAppState = { busy: false, message: '', connection: null, connectionLoaded: false, alive: true, refresh: 0 }
      mounted = state
      // 首屏同步画出来：档案列表只依赖本地设置，不该等网络。连接状态随后补。
      render(container, ctx, deps, state)
      void refreshConnection(container, ctx, deps, state)
      const refresh = () => { if (!state.busy && state.alive) void refreshConnection(container, ctx, deps, state) }
      const cleanups = [onOnlineStatusChanged(refresh), onNativeProfilesChanged(refresh), ctx.onCharacterChanged(refresh)]
      unsubscribe = () => cleanups.forEach(dispose => dispose())
    },
    unmount() { if (mounted) mounted.alive = false; mounted = null; unsubscribe?.(); unsubscribe = null },
  }
}

async function refreshConnection(container: HTMLElement, ctx: PhoneAppContext, deps: ApiAppDeps, state: ApiAppState): Promise<void> {
  const request = ++state.refresh
  const connection = await readConnection({ withSecret: false })
  if (!state.alive || !container.isConnected || request !== state.refresh) return
  state.connection = connection; state.connectionLoaded = true
  render(container, ctx, deps, state)
}

function render(container: HTMLElement, ctx: PhoneAppContext, deps: ApiAppDeps, state: ApiAppState): void {
  const data = sanitizeAppData(ctx.getAppData()); const connection = state.connection
  if (!state.alive || !container.isConnected) return
  const active = connection ? findActiveProfile(data.profiles, connection) : undefined
  const focused = container.contains(document.activeElement) ? (document.activeElement as HTMLElement).dataset.apiFocus : undefined
  const legacyOpen = container.querySelector<HTMLDetailsElement>('[data-api-legacy]')?.open ?? false
  container.textContent = ''

  const status = el('div', 'so-app-section'); const title = el('div', 'so-app-title'); title.textContent = t('nativeApi.status', '当前连接'); status.append(title)
  const line = el('div', 'so-app-desc')
  if (!state.connectionLoaded) line.textContent = t('nativeApi.loading', '正在读取当前连接…')
  else if (!connection) line.textContent = t('nativeApi.noHost', '当前不在酒馆页面内，无法读取连接状态。')
  else {
    const source = getSource(connection.mainApi, connection.source)
    line.textContent = `${connection.online ? t('nativeApi.online', '已连接（可发消息）') : t('nativeApi.offline', '未连接')} · ${source.label}${active ? ` · ${active.name}` : ''}`
    const detail = el('div', 'so-app-desc'); detail.textContent = [connection.url, connection.model].filter(Boolean).join(' · ') || '该来源没有地址或模型字段'; status.append(detail)
    if (connection.statusText) { const nativeStatus = el('div', 'so-app-desc'); nativeStatus.textContent = `${t('nativeApi.hostStatus', '酒馆状态')}：${connection.statusText}`; status.append(nativeStatus) }
  }
  status.append(line); container.append(status)

  const native = readNativeProfiles(), busy = state.busy || isNativeSwitching()
  const nativeBox = el('div', 'so-app-section'); nativeBox.dataset.nativeProfiles = ''
  const nativeTitle = el('div', 'so-app-title'); nativeTitle.textContent = t('nativeApi.title', 'SillyTavern 连接档案')
  const nativeHint = el('p', 'so-app-desc'); nativeHint.textContent = native.available
    ? t('nativeApi.hint', '直接调用酒馆自带的连接档案（地址与密钥仍在酒馆顶部插头面板维护）。切档后留意上方是否显示已连接。')
    : t('nativeApi.unavailable', '未检测到酒馆自带的「连接配置（Connection Manager）」（可能未加载或已停用）。可在酒馆扩展里开启它，或展开下方的百工独立档案。')
  nativeBox.append(nativeTitle, nativeHint)
  if (!native.profiles.length && native.available) {
    const empty = el('p', 'so-app-desc'); empty.textContent = t('nativeApi.empty', '还没有原生连接档案。请先在酒馆 API 面板创建。'); nativeBox.append(empty)
  }
  const key = stableCharacterKey(ctx.getCharacterCard?.())
  const recommendedId = key ? data.nativeCharacterProfiles?.[key] : undefined
  const recommendation = el('label', 'so-app-desc'); recommendation.textContent = t('nativeApi.recommendation', '当前角色推荐（点击档案才会切换）')
  recommendation.style.cssText = 'display:flex;flex-direction:column;gap:6px;'
  const select = document.createElement('select'); select.dataset.apiFocus = 'recommendation'
  select.setAttribute('aria-label', t('nativeApi.recommendation', '当前角色推荐（点击档案才会切换）'))
  select.style.cssText = 'min-width:0;width:100%;min-height:44px;box-sizing:border-box;'
  select.add(new Option(t('nativeApi.none', '不指定推荐连接'), ''))
  for (const profile of native.profiles) select.add(new Option(profile.name, profile.id))
  if (recommendedId && !native.profiles.some(profile => profile.id === recommendedId)) select.add(new Option(t('nativeApi.missing', '推荐档案已删除，可解除关联'), recommendedId))
  select.value = recommendedId ?? ''; select.disabled = !key || busy
  select.onchange = () => {
    if (!key || !state.alive || key !== stableCharacterKey(ctx.getCharacterCard?.())) return
    const latest = sanitizeAppData(ctx.getAppData()), refs = { ...latest.nativeCharacterProfiles }
    if (select.value) refs[key] = select.value; else delete refs[key]
    ctx.setAppData({ ...latest, nativeCharacterProfiles: refs }); render(container, ctx, deps, state)
  }
  recommendation.append(select); nativeBox.append(recommendation)
  if (!key) { const note = el('div', 'so-app-desc'); note.textContent = t('nativeApi.noCharacter', '先打开一张单人角色卡，就能为 TA 记住常用的连接档案。'); nativeBox.append(note) }
  for (const profile of [...native.profiles].sort((a, b) => Number(b.id === recommendedId) - Number(a.id === recommendedId))) {
    const row = document.createElement('button'); row.type = 'button'; row.className = `stapi-row${native.selectedId === profile.id ? ' stapi-row-on' : ''}`
    row.style.cssText = 'width:100%;min-height:52px;text-align:start;font:inherit;color:inherit;'
    row.disabled = busy || !native.available; row.dataset.apiFocus = `native:${profile.id}`; row.dataset.nativeProfileId = profile.id
    row.setAttribute('aria-pressed', String(native.selectedId === profile.id))
    const main = el('span', 'stapi-row-main'), name = el('span', 'stapi-row-name'), meta = el('span', 'stapi-row-sub')
    name.textContent = profile.name; name.style.overflowWrap = 'anywhere'
    meta.textContent = [profile.mode === 'tc' ? 'Text Completion' : 'Chat Completion', profile.model, recommendedId === profile.id ? t('nativeApi.recommended', '角色推荐') : ''].filter(Boolean).join(' · ')
    main.append(name, meta)
    const mark = el('span', 'stapi-row-mark'); mark.textContent = native.selectedId === profile.id ? t('nativeApi.selected', '已选档案') : t('nativeApi.switch', '切换')
    row.append(main, mark); row.onclick = () => void switchNative(profile.id, profile.name); nativeBox.append(row)
  }
  const feedback = el('div', 'so-app-desc'); feedback.setAttribute('role', 'status'); feedback.textContent = state.message; nativeBox.append(feedback)
  container.append(nativeBox)

  const legacy = document.createElement('details'); legacy.dataset.apiLegacy = ''; legacy.open = legacyOpen
  const legacyTitle = document.createElement('summary'); legacyTitle.textContent = `${t('nativeApi.legacy', '旧百工档案与管理')} (${data.profiles.length})`; legacyTitle.dataset.apiFocus = 'legacy'
  legacy.append(legacyTitle)

  const profiles = el('div', 'so-app-section'); const profilesTitle = el('div', 'so-app-title'); profilesTitle.textContent = `连接档案（${data.profiles.length}）`; profiles.append(profilesTitle)
  if (!data.profiles.length) { const empty = el('div', 'so-app-desc'); empty.textContent = '还没有连接档案，请进入管理页添加或导入。'; profiles.append(empty) }
  for (const profile of data.profiles) profiles.append(buildRow(profile, active?.id === profile.id, busy, () => void switchProfile(profile)))
  legacy.append(profiles)

  const manage = el('div', 'so-app-section'); const description = el('div', 'so-app-desc'); description.textContent = t('nativeApi.legacyHint', '保留已有百工档案。建议新连接在酒馆原生面板建档，避免重复维护。'); manage.append(description, appButton(t('nativeApi.legacyManage', '管理旧百工档案'), deps.openManager)); legacy.append(manage, buildApiGuide()); container.append(legacy)
  if (focused) [...container.querySelectorAll<HTMLElement>('[data-api-focus]')].find(item => item.dataset.apiFocus === focused)?.focus({ preventScroll: true })

  async function switchNative(id: string, name: string): Promise<void> {
    if (state.busy || isNativeSwitching()) return
    state.busy = true; state.message = `${t('nativeApi.applying', '正在应用档案')} · ${name}`; state.refresh++; render(container, ctx, deps, state)
    try {
      await switchNativeProfile(id)
      const actual = await readConnection({ withSecret: false })
      if (!state.alive) return
      state.connection = actual; state.connectionLoaded = true
      state.message = actual?.online ? t('nativeApi.appliedOnline', '已切到该连接档案，酒馆已就绪（首次发消息时才会真正请求模型）。') : t('nativeApi.appliedOffline', '已切到该档案，但当前仍未连接。请去酒馆顶部 API 面板核对接口地址、模型名与密钥。')
    } catch (error) {
      if (!state.alive) return
      state.message = error instanceof NativeProfileError ? ({
        unavailable: t('nativeApi.unavailable', '未检测到酒馆自带的「连接配置（Connection Manager）」（可能未加载或已停用）。可在酒馆扩展里开启它，或展开下方的百工独立档案。'), missing: t('nativeApi.gone', '档案已不存在，请重新选择。'), busy: t('nativeApi.busy', '已有档案正在切换。'),
        timeout: t('nativeApi.timeout', '等待档案应用超时。酒馆可能仍在处理，请检查原生面板的实际状态。'), interrupted: t('nativeApi.interrupted', '原生面板的选择已改变，请检查当前连接。'),
      })[error.code] : t('nativeApi.failed', '应用档案失败，请检查原生连接面板。')
    } finally { state.busy = false; if (state.alive) { render(container, ctx, deps, state); void refreshConnection(container, ctx, deps, state) } }
  }

  async function switchProfile(profile: ApiProfile): Promise<void> {
    if (state.busy || isNativeSwitching()) return
    state.busy = true; state.message = `正在应用「${profile.name}」的类型、来源、密钥、URL 与模型…`; render(container, ctx, deps, state)
    try {
      const connected = await applyProfile(profile, (message) => {
        state.message = message
        if (state.alive && container.isConnected) render(container, ctx, deps, state)
      })
      if (!state.alive) return
      state.connection = connected; state.connectionLoaded = true
      state.message = `已切到「${profile.name}」${connected.model ? `（模型：${connected.model}）` : ''}，酒馆已就绪，发条消息试试吧。`; toast('success', state.message)
    } catch (error) {
      if (!state.alive) return
      state.message = `切换失败：${error instanceof Error ? error.message : String(error)}`; toast('error', state.message); console.error('[st-stage] API 切换失败', error)
    } finally {
      state.busy = false; render(container, ctx, deps, state)
      if (state.alive) void refreshConnection(container, ctx, deps, state)
    }
  }
}

function guideLine(title: string, text: string): HTMLElement {
  const line = el('div', 'so-app-desc'); const strong = document.createElement('strong'); strong.textContent = `${title}：`; line.append(strong, document.createTextNode(text)); return line
}

function buildApiGuide(): HTMLElement {
  const guide = el('div', 'so-app-section'); const title = el('div', 'so-app-title'); title.textContent = 'API 使用说明'; guide.append(title)

  const quick = foldSection('快速开始', false)
  quick.body.append(
    guideLine('1. 建档', '新连接建议在 SillyTavern 原生 API 面板建档，再从上方点选。已有百工档案可在“管理旧百工档案”中继续维护。'),
    guideLine('2. 填写', 'Key 是访问凭证，URL 是服务入口，模型 ID 必须与渠道实际提供的名称完全一致。Key 会明文保存在本扩展档案中。'),
    guideLine('3. 切换', '点击旧档案后会依次切换渠道、写入凭证、加载模型并检查酒馆状态。自定义 API 可能跳过状态检查；“允许发送”仍需用实际模型请求验证。'),
  )

  const completion = foldSection('补全方式有什么不同', false)
  completion.body.append(
    guideLine('Chat Completion', '以 system、user、assistant 消息列表发送上下文。现代云模型主要使用这种方式，角色与指令边界清晰，通常是首选。'),
    guideLine('Text Completion', '把整个提示词拼成一段文本续写。适合本地推理后端、旧模型和需要精细控制提示模板的玩法。'),
    guideLine('NovelAI', '面向创作续写的专用服务，偏小说语料与采样控制，不等同于通用聊天 API。'),
    guideLine('KoboldAI', '常用于本地或自托管文本生成后端，玩法自由，但 URL、模型加载和性能取决于自己的服务。'),
    guideLine('KoboldAI Horde', '由社区算力池处理请求，不必自备推理服务；可用模型、排队时间和速度会随在线工作节点变化。'),
    guideLine('注意', '“补全方式”描述请求协议，不代表模型聪明程度。同一个模型可能被不同后端包装成不同协议。'),
  )

  const channels = foldSection('Chat Completion 渠道说明', false)
  channels.body.append(
    guideLine('OpenAI', '官方直连渠道，模型名称和能力以 OpenAI 当前控制台为准。'),
    guideLine('Claude', 'Anthropic 官方渠道，擅长长上下文与文本任务；使用 Anthropic Key。'),
    guideLine('OpenRouter', '聚合多家模型的统一入口，切模型方便；模型 ID 通常带厂商前缀，计费与路由由 OpenRouter 管理。'),
    guideLine('Google AI Studio', 'Google Gemini 开发者渠道；区域可用性、限额与模型名以 AI Studio 为准。'),
    guideLine('自定义 OpenAI 兼容', '用于第三方中转、本地网关或其他兼容服务。通常需填写基础 URL（很多服务要求以 /v1 结尾）和服务方给出的精确模型 ID。'),
    guideLine('其他厂商', 'DeepSeek、xAI、Mistral、Groq 等兼容 OpenAI 请求格式的服务统一使用“自定义 OpenAI 兼容”，不再重复提供厂商入口。'),
  )

  const fields = foldSection('字段、安全与排障', false)
  fields.body.append(
    guideLine('Key 与 secret-id', '输入框会遮罩显示，但 Key 在本扩展档案中明文保存，并同步写入 SillyTavern 密钥库；新版可用 secret-id 区分同渠道多把 Key。请勿分享含档案数据的配置。'),
    guideLine('URL', '404 常见于路径不对，请核对是否需要 /v1；不要把具体的 /chat/completions 路径重复填进基础 URL。'),
    guideLine('NONE', '通常表示模型列表仍在加载、模型 ID 不存在或账号无权限。现在切换会等待并回验，不会把明显的 NONE 当成功。'),
    guideLine('401 / 403', '通常是 Key 错误、额度/权限不足或服务区域限制。'),
    guideLine('旧版兼容', '旧版 SillyTavern 可能不允许回读 Key；导入时会保留表单中已有 Key，并回退到单密钥槽位。'),
  )

  guide.append(quick.box, completion.box, channels.box, fields.box)
  return guide
}

function buildRow(profile: ApiProfile, active: boolean, busy: boolean, onActivate: () => void): HTMLElement {
  const row = el('div', `stapi-row${active ? ' stapi-row-on' : ''}${busy ? ' stapi-row-busy' : ''}`); row.setAttribute('role', 'button'); row.tabIndex = busy ? -1 : 0; row.setAttribute('aria-disabled', String(busy))
  const main = el('div', 'stapi-row-main'); const name = el('div', 'stapi-row-name'); name.textContent = profile.name
  const summary = el('div', 'stapi-row-sub'); summary.textContent = profileSummary(profile).join(' · '); main.append(name, summary)
  const mark = el('div', 'stapi-row-mark'); mark.textContent = active ? '使用中' : '切换'; row.append(main, mark)
  row.addEventListener('click', () => { if (!busy) onActivate() }); row.addEventListener('keydown', (event) => { if (!busy && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onActivate() } })
  return row
}
