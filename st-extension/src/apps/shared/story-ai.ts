import type { AppHost, PhoneAppContext } from '../../../../core/phone-registry'
import { API_APP_ID, extractUpstreamError, sanitizeAppData } from '../api/core'
import { requestOpenApp } from './story-events'

export const STORY_AI_APP_ID = 'story-ai'

export interface StoryAiConfig {
  apiKey?: string
  apiUrl?: string
  model?: string
  sourceLabel?: string
}

export interface StoryAiMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export type MockStoryAiHandler = (
  messages: StoryAiMessage[],
  jsonMode: boolean,
  signal?: AbortSignal,
) => Promise<string> | string

declare global {
  interface Window {
    /** 网页模拟器可选挂载的本地剧情 AI 响应器，无需真实密钥即可实机体验全部叙事 App。 */
    __stStageMockStoryAi?: MockStoryAiHandler
  }
}

const OPENAI_COMPAT_ENDPOINTS: Record<string, { url: string; defaultModel: string }> = {
  deepseek: { url: 'https://api.deepseek.com/chat/completions', defaultModel: 'deepseek-chat' },
  openai: { url: 'https://api.openai.com/v1/chat/completions', defaultModel: 'gpt-4o-mini' },
  openrouter: { url: 'https://openrouter.ai/api/v1/chat/completions', defaultModel: 'deepseek/deepseek-chat' },
  groq: { url: 'https://api.groq.com/openai/v1/chat/completions', defaultModel: 'llama-3.3-70b-versatile' },
  xai: { url: 'https://api.x.ai/v1/chat/completions', defaultModel: 'grok-2-latest' },
  mistralai: { url: 'https://api.mistral.ai/v1/chat/completions', defaultModel: 'mistral-small-latest' },
}

const KNOWN_HOST_DEFAULT_PATHS: Record<string, string> = {
  'api.deepseek.com': '/chat/completions',
  'api.openai.com': '/v1/chat/completions',
  'openrouter.ai': '/api/v1/chat/completions',
  'api.groq.com': '/openai/v1/chat/completions',
  'api.x.ai': '/v1/chat/completions',
  'api.mistral.ai': '/v1/chat/completions',
}

export function toCompletionsEndpoint(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '')
  if (!trimmed) return ''
  if (trimmed.endsWith('/chat/completions')) return trimmed
  return `${trimmed}/chat/completions`
}

export function resolveChatEndpoint(rawUrl?: string): string {
  const trimmed = (rawUrl ?? '').trim().replace(/\/+$/, '')
  if (!trimmed) return 'https://api.deepseek.com/chat/completions'
  if (trimmed.endsWith('/chat/completions')) return trimmed
  if (/\/v\d+$/i.test(trimmed)) return `${trimmed}/chat/completions`
  try {
    const parsed = new URL(trimmed)
    const knownPath = (!parsed.pathname || parsed.pathname === '/')
      ? KNOWN_HOST_DEFAULT_PATHS[parsed.hostname.toLowerCase()]
      : undefined
    if (knownPath) return `${parsed.origin}${knownPath}`
  } catch {
    // 非标准 URL 保持原样交由上层校验或请求报错
  }
  return trimmed
}

function unwrapJsonReply(text: string): string {
  const trimmed = text.trim()
  const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
  if (fenced) return fenced[1].trim()
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace >= 0 && lastBrace > firstBrace && !trimmed.startsWith('{')) {
    return trimmed.slice(firstBrace, lastBrace + 1)
  }
  return trimmed
}

function normalizeDirectConfig(raw: unknown, sourceLabel: string): StoryAiConfig | null {
  if (!raw || typeof raw !== 'object') return null
  const rec = raw as Record<string, unknown>
  const apiKey = typeof rec.apiKey === 'string' ? rec.apiKey.trim() : ''
  if (!apiKey) return null
  return {
    apiKey,
    apiUrl: typeof rec.apiUrl === 'string' ? rec.apiUrl.trim() : '',
    model: typeof rec.model === 'string' ? rec.model.trim() : '',
    sourceLabel,
  }
}

/**
 * 统一读取幕后叙事 AI 连接：
 * 1. 优先读取独立直连配置（`settings.apps['story-ai']`）
 * 2. 回退复用微信 AI 连接（`settings.apps['wechat-sister'].config`）
 * 3. 自动复用「API」App 中已存密钥的 OpenAI 兼容档案
 * 4. 网页模拟器环境下回退到本地演示响应器
 */
export function getStoryAiConfig(host: AppHost): StoryAiConfig | null {
  const apps = host.getSettings()?.apps ?? {}

  const direct = normalizeDirectConfig(apps[STORY_AI_APP_ID], '独立直连')
  if (direct) return direct

  const wechat = apps['wechat-sister'] as { config?: unknown } | undefined
  const wechatCfg = normalizeDirectConfig(wechat?.config, '微信共用')
  if (wechatCfg) {
    return { apiKey: wechatCfg.apiKey, apiUrl: wechatCfg.apiUrl, model: wechatCfg.model }
  }

  const apiData = sanitizeAppData(apps[API_APP_ID])
  for (const profile of apiData.profiles) {
    if (profile.mainApi !== 'openai' || !profile.key.trim()) continue
    if (profile.source === 'custom') {
      const apiUrl = toCompletionsEndpoint(profile.url)
      if (!apiUrl) continue
      return {
        apiKey: profile.key.trim(),
        apiUrl,
        model: profile.model.trim() || 'gpt-4o-mini',
        sourceLabel: `API 档案「${profile.name}」`,
      }
    }
    const preset = OPENAI_COMPAT_ENDPOINTS[profile.source]
    if (preset) {
      return {
        apiKey: profile.key.trim(),
        apiUrl: preset.url,
        model: profile.model.trim() || preset.defaultModel,
        sourceLabel: `API 档案「${profile.name}」`,
      }
    }
  }

  if (typeof window !== 'undefined' && typeof window.__stStageMockStoryAi === 'function') {
    return {
      apiKey: '__simulator_mock__',
      apiUrl: '__simulator_mock__',
      model: 'simulator-preview',
      sourceLabel: '模拟器本地演练',
    }
  }

  return null
}

export function saveStoryAiConfig(ctx: PhoneAppContext, next: StoryAiConfig | null): void {
  if (typeof ctx.updateSettings !== 'function') return
  const current = ctx.getSettings()
  const apps = { ...current.apps }
  if (!next || !next.apiKey?.trim()) {
    delete apps[STORY_AI_APP_ID]
  } else {
    const apiUrl = (next.apiUrl ?? '').trim()
    if (apiUrl) {
      let parsed: URL
      try {
        parsed = new URL(apiUrl)
      } catch {
        throw new Error('请填写完整的 HTTP(S) 接口地址（如 https://api.deepseek.com/chat/completions）。')
      }
      if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password) {
        throw new Error('接口地址只支持 http:// 或 https://，且不能包含账号密码。')
      }
    }
    apps[STORY_AI_APP_ID] = {
      apiKey: next.apiKey.trim(),
      apiUrl: resolveChatEndpoint(apiUrl),
      model: (next.model ?? '').trim() || 'deepseek-chat',
    }
  }
  ctx.updateSettings({ ...current, apps })
}

/** 渲染内嵌式「幕后 AI 连接」折叠面板，无需强制绕道微信即可在任意叙事 App 内直连。 */
export function renderStoryAiSetupCard(ctx: PhoneAppContext, onChanged: () => void): HTMLElement {
  const box = document.createElement('details')
  box.className = 'so-ai-hub'
  const active = getStoryAiConfig(ctx)
  const storedDirect = normalizeDirectConfig(ctx.getSettings()?.apps?.[STORY_AI_APP_ID], '独立直连')
  if (!active) box.open = true

  const summary = document.createElement('summary')
  summary.className = 'so-ai-hub-summary'
  const badge = document.createElement('span')
  badge.className = `so-ai-hub-badge${active ? ' is-ready' : ''}`
  badge.textContent = active
    ? `幕后 AI 已就绪 · ${active.sourceLabel || active.model || '微信共用'}`
    : '幕后 AI 未连接 · 点此接通（也可沿用微信或酒馆 API）'
  summary.append(badge)

  const body = document.createElement('div')
  body.className = 'so-ai-hub-body'

  const hint = document.createElement('p')
  hint.className = 'so-ai-hub-hint'
  hint.textContent = '小剧场、剧情状态与纪要共用同一套幕后 AI。可在此单独填写轻量模型，也可直接沿用微信或「API」里的兼容档案。'

  const makeField = (labelText: string, placeholder: string, value: string, type = 'text') => {
    const label = document.createElement('label')
    label.className = 'so-ai-hub-field'
    const span = document.createElement('span')
    span.textContent = labelText
    const input = document.createElement('input')
    input.type = type
    input.placeholder = placeholder
    input.value = value
    label.append(span, input)
    return { label, input }
  }

  const realActive = active?.apiKey === '__simulator_mock__' ? null : active
  const urlField = makeField('接口地址', 'https://api.deepseek.com/chat/completions', storedDirect?.apiUrl || realActive?.apiUrl || 'https://api.deepseek.com/chat/completions', 'url')
  const keyField = makeField('API 密钥', 'sk-...', storedDirect?.apiKey || '', 'password')
  const modelField = makeField('模型名称', 'deepseek-chat', storedDirect?.model || realActive?.model || 'deepseek-chat')

  const feedback = document.createElement('p')
  feedback.className = 'so-ai-hub-feedback'

  const actions = document.createElement('div')
  actions.className = 'so-ai-hub-actions'

  const saveBtn = document.createElement('button')
  saveBtn.type = 'button'
  saveBtn.className = 'so-ai-hub-primary'
  saveBtn.textContent = '保存直连'
  saveBtn.onclick = () => {
    try {
      const apiKey = keyField.input.value.trim()
      if (!apiKey) throw new Error('请先填写 API 密钥。')
      saveStoryAiConfig(ctx, {
        apiKey,
        apiUrl: urlField.input.value.trim(),
        model: modelField.input.value.trim(),
      })
      feedback.textContent = '已保存幕后 AI 连接。'
      ctx.toast?.('success', '幕后 AI 连接已保存')
      onChanged()
    } catch (err) {
      feedback.textContent = (err as Error).message
    }
  }

  const wechatBtn = document.createElement('button')
  wechatBtn.type = 'button'
  wechatBtn.textContent = '去微信连接设置'
  wechatBtn.onclick = () => requestOpenApp({ appId: 'wechat-sister', openSettings: true })

  actions.append(saveBtn, wechatBtn)

  if (storedDirect) {
    const clearBtn = document.createElement('button')
    clearBtn.type = 'button'
    clearBtn.textContent = '清除独立直连'
    clearBtn.onclick = () => {
      saveStoryAiConfig(ctx, null)
      onChanged()
    }
    actions.append(clearBtn)
  }

  body.append(hint, urlField.label, keyField.label, modelField.label, actions, feedback)
  box.append(summary, body)
  return box
}

export async function requestChat(
  config: StoryAiConfig,
  messages: StoryAiMessage[],
  signal?: AbortSignal,
  jsonMode = true,
): Promise<string> {
  if (
    config.apiKey === '__simulator_mock__' &&
    typeof window !== 'undefined' &&
    typeof window.__stStageMockStoryAi === 'function'
  ) {
    signal?.throwIfAborted()
    return await window.__stStageMockStoryAi(messages, jsonMode, signal)
  }
  try {
    const endpoint = resolveChatEndpoint(config.apiUrl)
    const doPost = (withResponseFormat: boolean) =>
      fetch(endpoint, {
        signal,
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
        body: JSON.stringify({
          model: config.model || 'deepseek-chat',
          messages,
          temperature: 0.5,
          stream: false,
          ...(withResponseFormat ? { response_format: { type: 'json_object' } } : {}),
        }),
      })
    let resp = await doPost(jsonMode)
    // 部分反代（Claude / Gemini / R1）遇到 json_object 返回 400，自动降级重试一次
    if (jsonMode && resp.status === 400) {
      resp = await doPost(false)
    }
    if (!resp.ok) {
      const detail = typeof resp.json === 'function'
        ? extractUpstreamError(await resp.json().catch(() => null)).slice(0, 160)
        : ''
      throw new Error('AI 连接失败（' + resp.status + (detail ? '：' + detail : '') + '），请检查连接后重试。')
    }
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI 返回了空回复，请重试。')
    return jsonMode ? unwrapJsonReply(content) : content
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof Error && error.message.startsWith('AI ')) throw error
    throw new Error('AI 请求失败，请检查网络或连接设置后重试。', { cause: error })
  }
}
