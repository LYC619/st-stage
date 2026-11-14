// Prompt rules copied from 玉子手机 tables/sources/纪要/01-纪要表.md, sourceData.note constraints 2–5.
import type { AppHost } from '../../../../core/phone-registry'
import { getWeChatHostContext } from '../wechat/bridge'
import { storyText } from '../wechat/memory'
import { getStoryAiConfig, requestChat } from '../shared/story-ai'
import { formatStoryDate, storyToday } from '../shared/story-date'
import { normalizeContent } from './store'
import type { ChronicleContent, ChronicleEntry } from './types'

const SYSTEM = `你负责将已经发生的剧情整理成纪要。只输出 JSON：{"timeSpan":"","summary":"","text":"","keyDialogue":["说话人：原话"]}。
text 为300–500字，keyDialogue 为重要对话数组。
2.时间跨度格式为 "YYYY-MM-DD HH:MM ~ YYYY-MM-DD HH:MM"，覆盖本轮事件的实际时间范围。
3.概览作用是概括本轮纪要内容，简单交代起因经过结果，≤50字。

4.纪要规范：
- 以第三方视角中立客观记录正文发生的一切，移除所有修辞。不滥用环境描写、不加评论、不抒情、不升华。
- 用词直白生活化，避免正式措辞。
- 结尾必须开放，在事件自然流动中结束，不得归纳状态或做封闭式收束。
- 多轮交互整合为一条记录。
- 字数不少于300字。

5.重要对话仅摘录直接推动剧情转折、揭示关键信息、改变人物关系/决策或构成承诺/誓言/约定的原文台词，标明说话人。通常3句，最多5句。
剧情没有明确日期时，timeSpan 必须写空字符串，不要编造日期。`

export interface PendingStory { lastMessageIndex: number; endIndex: number; aiCount: number; messages: string[] }
export function pendingStory(host: AppHost, lastMessageIndex: number): PendingStory {
  const native = getWeChatHostContext() as { chat?: unknown[]; name1?: string } | undefined
  const chat = Array.isArray(native?.chat) ? native.chat : host.getChatContext?.()?.chat ?? []
  const cursor = chat.length <= lastMessageIndex ? chat.length - 1 : lastMessageIndex
  let aiCount = 0
  const messages = chat.slice(cursor + 1).flatMap(value => {
    if (!value || typeof value !== 'object') return []
    const msg = value as Record<string, unknown>
    if (msg.is_system || typeof msg.mes !== 'string') return []
    const content = storyText(msg.mes)
    if (!content) return []
    if (!msg.is_user) aiCount++
    const name = typeof msg.name === 'string' && msg.name ? msg.name : msg.is_user ? native?.name1 || '用户' : host.getCharacterName()
    return [`${name}：${content}`]
  })
  return { lastMessageIndex: cursor, endIndex: chat.length - 1, aiCount, messages }
}

export function parseChronicle(text: string): ChronicleContent {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('纪要返回的 JSON 无法解析，请重试。') }
  const content = normalizeContent(raw)
  if (!content) throw new Error('纪要返回的内容格式不对，请重试。')
  return content
}

export async function generateChronicle(host: AppHost, pending: PendingStory, previous: ChronicleEntry[], signal: AbortSignal): Promise<ChronicleContent> {
  const config = getStoryAiConfig(host)
  if (!config) throw new Error('请先在微信设置里连接 AI。')
  const today = await storyToday(host)
  signal.throwIfAborted()
  return parseChronicle(await requestChat(config, [{ role: 'system', content: SYSTEM }, { role: 'user', content:
    `当前剧情日期：${today ? formatStoryDate(today) : '未知；请从待整理消息提取明确日期，没有明确日期时 timeSpan 写空字符串'}\n最近纪要概览：\n${previous.slice(-3).map(entry => entry.summary).join('\n')}\n待整理的消息：\n${pending.messages.join('\n')}` }], signal))
}
