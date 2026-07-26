/**
 * 「API」App 的 ST 交互层：与 SillyTavern 的全部耦合收敛在此，UI 层不碰 ST 细节。
 * 交互方式核实自 ST release 源码（public/scripts/openai.js / st-context.js）：
 * - getContext().chatCompletionSettings 就是 oai_settings 活引用。「附加参数」三项
 *   （custom_include_body / custom_exclude_body / custom_include_headers）的 textarea
 *   只在 ST 自己的弹窗打开期间存在，必须直接写该对象，不能走 DOM
 * - URL/模型走常驻输入框 + 原生 input 事件，让 ST 自己的 handler 同步 oai_settings
 * - 密钥写 /api/secrets/write 槽位 api_key_custom；同时必须同步可见 Key 输入框——
 *   否则点「连接」时 ST 会把输入框残留的旧 Key 写回密钥库（参考项目验证过的经典坑）
 * - 拉模型列表需临时写目标站 Key，结束后还原当前连接的 Key，防止污染现有连接
 */

import type { ApiProfile } from './core'
import { parseModelList } from './core'

/** 本层用到的 ST context 最小切面（字段可能随版本缺失，全部可选） */
interface BridgeContext {
  chatCompletionSettings?: Record<string, unknown>
  getRequestHeaders?: () => Record<string, string>
  saveSettingsDebounced?: () => void
  onlineStatus?: string
  mainApi?: string
}

function getST(): BridgeContext | undefined {
  try {
    return window.SillyTavern?.getContext() as unknown as BridgeContext | undefined
  } catch {
    return undefined
  }
}

function readStr(obj: Record<string, unknown>, key: string): string {
  const v = obj[key]
  return typeof v === 'string' ? v : ''
}

export interface ConnectionInfo {
  /** 当前自定义接口 URL（未配置为空串） */
  url: string
  model: string
  /** 是否正在使用「聊天补全 → 自定义(OpenAI 兼容)」接口 */
  isCustomSource: boolean
  /** ST 报告的在线状态（false = no_connection） */
  online: boolean
  includeBody: string
  excludeBody: string
  includeHeaders: string
}

/** 读当前连接状态；无 ST 运行时（Web 模拟器）返回 null */
export function readConnection(): ConnectionInfo | null {
  const st = getST()
  const oai = st?.chatCompletionSettings
  if (!st || !oai) return null
  return {
    url: readStr(oai, 'custom_url'),
    model: readStr(oai, 'custom_model'),
    isCustomSource: st.mainApi === 'openai' && readStr(oai, 'chat_completion_source') === 'custom',
    online: (st.onlineStatus ?? 'no_connection') !== 'no_connection',
    includeBody: readStr(oai, 'custom_include_body'),
    excludeBody: readStr(oai, 'custom_exclude_body'),
    includeHeaders: readStr(oai, 'custom_include_headers'),
  }
}

async function writeSecret(st: BridgeContext, key: string): Promise<void> {
  const headers = st.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' }
  const res = await fetch('/api/secrets/write', {
    method: 'POST',
    headers,
    body: JSON.stringify({ key: 'api_key_custom', value: key ?? '' }),
  })
  if (!res.ok) throw new Error(`写入密钥失败：HTTP ${res.status}`)
}

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

function setInput(input: HTMLInputElement, value: string): void {
  input.value = value
  // jQuery 事件走原生监听，原生 dispatchEvent 能命中 ST 的 input/change handler
  input.dispatchEvent(new Event('input', { bubbles: true }))
  input.dispatchEvent(new Event('change', { bubbles: true }))
}

function setSelect(select: HTMLSelectElement, value: string): void {
  select.value = value
  select.dispatchEvent(new Event('change', { bubbles: true }))
}

/**
 * 一键切换：写密钥 → 切自定义源 → 填 URL/模型 → 同步可见 Key → 写附加参数 → 连接。
 * 失败抛错（消息可直接展示给用户）。
 */
export async function applyProfile(p: ApiProfile): Promise<void> {
  const st = getST()
  const oai = st?.chatCompletionSettings
  if (!st || !oai) throw new Error('未检测到 SillyTavern 运行时')
  const mainApiSel = document.querySelector<HTMLSelectElement>('#main_api')
  const sourceSel = document.querySelector<HTMLSelectElement>('#chat_completion_source')
  const urlInput = document.querySelector<HTMLInputElement>('#custom_api_url_text')
  const connectBtn = document.querySelector<HTMLElement>('#api_button_openai')
  if (!mainApiSel || !sourceSel || !urlInput || !connectBtn) {
    throw new Error('未找到 ST 连接面板（酒馆版本过旧？需 1.12+）')
  }

  await writeSecret(st, p.key)
  setSelect(mainApiSel, 'openai')
  setSelect(sourceSel, 'custom')
  await sleep(150)

  setInput(urlInput, p.url)
  const keyInput = document.querySelector<HTMLInputElement>('#api_key_custom')
  if (keyInput) setInput(keyInput, p.key)
  const modelInput = document.querySelector<HTMLInputElement>('#custom_model_id')
  if (modelInput && p.model) setInput(modelInput, p.model)

  // 附加参数无常驻 DOM，直接写 oai_settings；ST 组装请求时读这三项
  oai['custom_include_body'] = p.includeBody
  oai['custom_exclude_body'] = p.excludeBody
  oai['custom_include_headers'] = p.includeHeaders
  st.saveSettingsDebounced?.()
  await sleep(150)

  connectBtn.click()
}

/**
 * 从站点接口拉模型列表。
 * @param restoreKey 结束后要还原的 Key（调用方传当前生效站点的 Key；可见输入框有值时优先用它）
 */
export async function fetchModels(url: string, key: string, restoreKey: string): Promise<string[]> {
  const st = getST()
  if (!st) throw new Error('未检测到 SillyTavern 运行时')
  const visibleKey = document.querySelector<HTMLInputElement>('#api_key_custom')?.value ?? ''
  const prevKey = visibleKey || restoreKey
  const wrote = !!key && key !== prevKey
  if (wrote) await writeSecret(st, key)
  try {
    const ac = new AbortController()
    const timer = setTimeout(() => ac.abort(), 20000)
    let res: Response
    try {
      res = await fetch('/api/backends/chat-completions/status', {
        method: 'POST',
        headers: st.getRequestHeaders?.() ?? { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_completion_source: 'custom', custom_url: url }),
        signal: ac.signal,
      })
    } finally {
      clearTimeout(timer)
    }
    if (!res.ok) throw new Error(`接口返回 HTTP ${res.status}`)
    return parseModelList(await res.json())
  } finally {
    if (wrote && prevKey) {
      writeSecret(st, prevKey).catch((err) => console.warn('[st-stage] API：还原密钥失败', err))
    }
  }
}
