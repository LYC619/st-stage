/**
 * 《小登同居生活》跨天 RAG 检索算法 (TypeScript 原生实现)
 * 基于 1-char / 2-char N-Gram 切词与 Jaccard 相似度加权
 */

import type { ChatMessage, EmojiItem, PhotoItem } from './types'

export function normalizeRagText(text: string): string {
  let res = text.toLowerCase()
  const removePunct = ['，', '。', '！', '？', '：', '“', '”', ' ', ',', '.', '!', '?', ':', '"']
  for (const p of removePunct) {
    res = res.split(p).join('')
  }
  return res
}

export function getRagTokens(text: string): string[] {
  const norm = normalizeRagText(text)
  const tokens: string[] = []

  for (let i = 0; i < norm.length; i++) {
    // 1-char token
    const one = norm.charAt(i)
    if (one) tokens.push(one)

    // 2-chars token
    if (i + 1 < norm.length) {
      tokens.push(norm.substring(i, i + 2))
    }
  }

  const words = norm.split(' ').filter(Boolean)
  for (const w of words) {
    tokens.push(w)
  }

  return tokens
}

export function messageToRagText(
  msg: ChatMessage,
  playerEmojis: Record<string, EmojiItem>,
  sisterEmojis: Record<string, EmojiItem>,
  sisterPhotos: Record<string, PhotoItem>,
): string {
  const { sender, content, type } = msg

  switch (type) {
    case 'text':
      return content
    case 'emoji':
      if (sender === 'player' && playerEmojis[content]) {
        return `玩家发送了一个表情包：id=${content}，名称=${playerEmojis[content].name}，含义=${playerEmojis[content].description}`
      }
      if (sender === 'sister' && sisterEmojis[content]) {
        return `${sisterEmojis[content].name} ${sisterEmojis[content].description}`
      }
      return content
    case 'red_packet':
      return `红包 金额 ${content}`
    case 'image':
      if (sender === 'sister' && sisterPhotos[content]) {
        return `${sisterPhotos[content].name} ${sisterPhotos[content].description}`
      }
      return '图片'
    default:
      return content
  }
}

export function calculateRagScore(
  query: string,
  msg: ChatMessage,
  index: number,
  playerEmojis: Record<string, EmojiItem>,
  sisterEmojis: Record<string, EmojiItem>,
  sisterPhotos: Record<string, PhotoItem>,
): number {
  const msgText = messageToRagText(msg, playerEmojis, sisterEmojis, sisterPhotos)
  if (!msgText) return 0.0

  const queryTokens = getRagTokens(query)
  const msgTokens = getRagTokens(msgText)
  if (queryTokens.length === 0 || msgTokens.length === 0) return 0.0

  const msgTokenSet = new Set(msgTokens)
  let sameCount = 0
  for (const token of queryTokens) {
    if (msgTokenSet.has(token)) {
      sameCount++
    }
  }

  if (sameCount <= 0) return 0.0

  // Jaccard-like score + recency tie-breaker
  let score = sameCount / queryTokens.length
  score += index * 0.0001
  return score
}

export function getRagMessages(
  query: string,
  allMessages: ChatMessage[],
  today: number,
  playerEmojis: Record<string, EmojiItem>,
  sisterEmojis: Record<string, EmojiItem>,
  sisterPhotos: Record<string, PhotoItem>,
  maxCount: number = 3,
): ChatMessage[] {
  const scored: { score: number; message: ChatMessage }[] = []

  for (let i = 0; i < allMessages.length; i++) {
    const msg = allMessages[i]
    // 跳过今天消息与正在分析的最后一条消息
    if (msg.time.day === today || i === allMessages.length - 1) {
      continue
    }

    const score = calculateRagScore(query, msg, i, playerEmojis, sisterEmojis, sisterPhotos)
    if (score > 0) {
      scored.push({ score, message: msg })
    }
  }

  scored.sort((a, b) => b.score - a.score)
  return scored.slice(0, maxCount).map((s) => s.message)
}

export function buildRagPrompt(
  query: string,
  allMessages: ChatMessage[],
  today: number,
  playerEmojis: Record<string, EmojiItem>,
  sisterEmojis: Record<string, EmojiItem>,
  sisterPhotos: Record<string, PhotoItem>,
  maxCount: number = 3,
): string {
  const ragMessages = getRagMessages(query, allMessages, today, playerEmojis, sisterEmojis, sisterPhotos, maxCount)
  if (ragMessages.length === 0) return ''

  let text = '\n以下是从过去聊天记录中检索出的可能相关内容。\n这些内容仅供参考，不一定与当前问题有关。\n不要直接提及“历史记录”“RAG”或“检索”。\n请结合妹妹当前的人设和当天上下文自然回复。\n\n相关历史：\n'

  for (const msg of ragMessages) {
    const senderName = msg.sender === 'player' ? '玩家' : '妹妹'
    const content = messageToRagText(msg, playerEmojis, sisterEmojis, sisterPhotos)
    text += `[第${msg.time.day}天][${senderName}] ${content}\n`
  }

  return text
}
