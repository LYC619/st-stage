import type { AppHost } from '../../../../core/phone-registry'

export interface StoryAiConfig { apiKey?: string; apiUrl?: string; model?: string }
export interface StoryAiMessage { role: 'system' | 'user' | 'assistant'; content: string }

export function getStoryAiConfig(host: AppHost): StoryAiConfig | null {
  const data = host.getSettings().apps['wechat-sister'] as { config?: StoryAiConfig } | undefined
  const config = data?.config
  if (typeof config?.apiKey !== 'string' || !config.apiKey.trim()) return null
  return { apiKey: config.apiKey, apiUrl: typeof config.apiUrl === 'string' ? config.apiUrl : '',
    model: typeof config.model === 'string' ? config.model : '' }
}

export async function requestChat(config: StoryAiConfig, messages: StoryAiMessage[], signal?: AbortSignal): Promise<string> {
  try {
    const resp = await fetch(config.apiUrl || 'https://api.deepseek.com/chat/completions', {
      signal, method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + config.apiKey },
      body: JSON.stringify({ model: config.model || 'deepseek-chat', messages, temperature: 0.5, stream: false, response_format: { type: 'json_object' } }),
    })
    if (!resp.ok) throw new Error('AI 连接失败（' + resp.status + '），请检查连接后重试。')
    const data = await resp.json()
    const content = data?.choices?.[0]?.message?.content
    if (typeof content !== 'string' || !content.trim()) throw new Error('AI 返回了空回复，请重试。')
    return content
  } catch (error) {
    if (signal?.aborted) throw error
    if (error instanceof Error && error.message.startsWith('AI ')) throw error
    throw new Error('AI 请求失败，请检查网络或连接设置后重试。', { cause: error })
  }
}
