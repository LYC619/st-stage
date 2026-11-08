import type { ChatMessage, Conversation } from './types'

const pad = (value: number) => String(value).padStart(2, '0')

/** WeChat-style list time: today HH:mm, yesterday, M/D this year, otherwise Y/M/D. */
export function listTime(at: number | undefined, now = new Date()): string {
  if (!at) return ''
  const date = new Date(at), midnight = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((midnight(now) - midnight(date)) / 86400000)
  if (days <= 0) return `${pad(date.getHours())}:${pad(date.getMinutes())}`
  if (days === 1) return '昨天'
  return date.getFullYear() === now.getFullYear() ? `${date.getMonth() + 1}/${date.getDate()}` : `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`
}

/** Absolute but compact post time; unlike "3 分钟前" it never goes stale while the feed stays open. */
export function momentTime(at: number, now = new Date()): string {
  const date = new Date(at), clock = `${pad(date.getHours())}:${pad(date.getMinutes())}`, day = listTime(at, now)
  if (day === clock) return clock
  if (day === '昨天') return `昨天 ${clock}`
  return date.getFullYear() === now.getFullYear() ? `${date.getMonth() + 1}月${date.getDate()}日 ${clock}` : `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`
}

export function messageSummary(message: ChatMessage): string {
  switch (message.type) {
    case 'voice': return '[语音]'
    case 'emoji': return '[表情]'
    case 'image': return '[图片]'
    case 'red_packet': return `[红包] ${message.content}`
    default: return message.content
  }
}

/** One-line list preview; group replies name their speaker like WeChat does. */
export function conversationPreview(conv: Conversation, group: boolean, replying: boolean): string {
  const last = conv.messages.at(-1)
  const speaker = group && last?.sender === 'contact' && last.authorName ? `${last.authorName}: ` : ''
  const text = replying ? '正在回复…' : conv.draft ? `[草稿] ${conv.draft}` : last ? speaker + messageSummary(last) : '开始聊天'
  return !conv.contactId && !group ? `旧会话${conv.chatId ? ` · ${conv.chatId}` : ''} · ${text}` : text
}
