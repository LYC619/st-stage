import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { el, appButton, foldSection } from './widgets'
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

  const manage = el('div', 'so-app-section'); const description = el('div', 'so-app-desc'); description.textContent = '管理全部 Chat Completion、Text Completion 与其他 SillyTavern API 档案。'; manage.append(description, appButton('管理连接档案', deps.openManager)); container.append(manage, buildApiGuide())

  async function switchProfile(profile: ApiProfile): Promise<void> {
    if (state.busy || !connection) return
    state.busy = true; state.message = `正在应用「${profile.name}」的类型、来源、密钥、URL 与模型…`; await render(container, ctx, deps, state)
    try {
      const connected = await applyProfile(profile, (message) => {
        state.message = message
        if (container.isConnected) void render(container, ctx, deps, state)
      })
      state.message = `「${profile.name}」已连接${connected.model ? `，实际模型：${connected.model}` : ''}`; toast('success', state.message)
    } catch (error) {
      state.message = `切换失败：${error instanceof Error ? error.message : String(error)}`; toast('error', state.message); console.error('[st-stage] API 切换失败', error)
    } finally {
      state.busy = false; await render(container, ctx, deps, state)
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
    guideLine('1. 建档', '在“管理连接档案”中添加档案，或先打开 SillyTavern 原生 API 面板配置好连接，再用“导入当前连接”。'),
    guideLine('2. 填写', 'Key 是访问凭证，URL 是服务入口，模型 ID 必须与渠道实际提供的名称完全一致。'),
    guideLine('3. 切换', '点击档案后会依次切换渠道、写入凭证、加载模型并做最终连接回验。看到“已连接，实际模型…”才算完成。'),
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
    guideLine('Mistral AI / Cohere', '各厂商官方直连，适合明确需要其自有模型、权限和计费体系的用户。'),
    guideLine('Groq', '提供侧重低延迟的托管推理；可用的是 Groq 当前部署的模型，不是任意模型。'),
    guideLine('DeepSeek / xAI', '对应厂商官方渠道，分别使用自己的 Key 与模型列表。'),
    guideLine('自定义 OpenAI 兼容', '用于第三方中转、本地网关或其他兼容服务。通常需填写基础 URL（很多服务要求以 /v1 结尾）和服务方给出的精确模型 ID。'),
  )

  const fields = foldSection('字段、安全与排障', false)
  fields.body.append(
    guideLine('Key 与 secret-id', 'Key 写入 SillyTavern 密钥库；新版可用 secret-id 区分同渠道多把 Key。请勿在截图、日志或分享的配置中泄露凭证。'),
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
