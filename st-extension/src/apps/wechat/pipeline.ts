/**
 * 微信单次结构化回复、角色状态与上下文管线。
 */

import type {
  ChatMessage,
  EmojiItem,
  PhotoItem,
  SisterState,
  LLMReplyPayload,
  LLMMessageItem,
  WeChatConfig,
} from './types'
import type { ConversationScope } from './bridge'
import { buildRagPrompt, messageToRagText } from './rag'
import { renderWeChatPrompt } from './prompts'
import { normalizeProfile } from './profile'

export interface FallbackBranch {
  min_mood: number
  reply: string
}

export interface FallbackKeywordItem {
  pattern: string
  reply?: string
  branches?: FallbackBranch[]
}

export interface FallbackDialoguesConfig {
  keywords?: FallbackKeywordItem[]
  default_text?: string
  red_packet_reply?: string
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class WeChatPipeline {
  private config: WeChatConfig
  private playerEmojis: Record<string, EmojiItem>
  private sisterEmojis: Record<string, EmojiItem>
  private sisterPhotos: Record<string, PhotoItem>


  constructor(
    config: WeChatConfig,
    playerEmojis: Record<string, EmojiItem>,
    sisterEmojis: Record<string, EmojiItem>,
    sisterPhotos: Record<string, PhotoItem>,
    _fallbackDialogues?: FallbackDialoguesConfig,
  ) {
    this.config = config
    this.playerEmojis = playerEmojis
    this.sisterEmojis = sisterEmojis
    this.sisterPhotos = sisterPhotos
  }

  public updateConfig(newConfig: Partial<WeChatConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 构建微信系统提示词（根据当前 ST 对话角色动态适配）
   */
  public buildSystemPrompt(
    state: SisterState,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '妹妹',
  ): string {
    const scope = typeof characterNameOrScope === 'string'
      ? { scopeKey: '', characterName: characterNameOrScope, externalState: { source: 'none' as const } }
      : characterNameOrScope
    const list = (items: Record<string, EmojiItem | PhotoItem>) => Object.entries(items).map(([id, item]) => `${id}: ${item.name} — ${item.description}`).join('\n')
    return renderWeChatPrompt(normalizeProfile(this.config), state, timeStr, scope, list(this.sisterEmojis), list(this.sisterPhotos))
  }

  /**
   * 组装完整的对话上下文消息
   */
  public buildContextMessages(
    history: ChatMessage[],
    state: SisterState,
    today: number,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '妹妹',
  ): ChatCompletionMessage[] {
    const result: ChatCompletionMessage[] = []
    result.push({ role: 'system', content: this.buildSystemPrompt(state, timeStr, characterNameOrScope) })

    // 取当天消息与最新玩家消息
    const todayMessages = history.filter((m) => m.time.day === today).slice(-60)
    let latestPlayerText = ''
    for (let i = todayMessages.length - 1; i >= 0; i--) {
      if (todayMessages[i].sender === 'player') {
        latestPlayerText = messageToRagText(
          todayMessages[i],
          this.playerEmojis,
          this.sisterEmojis,
          this.sisterPhotos,
        )
        break
      }
    }

    // 注入跨天 RAG
    if (latestPlayerText) {
      const ragPrompt = buildRagPrompt(
        latestPlayerText,
        history,
        today,
        this.playerEmojis,
        this.sisterEmojis,
        this.sisterPhotos,
      )
      if (ragPrompt) {
        result.push({ role: 'system', content: ragPrompt })
      }
    }

    // 格式化今日消息流
    let sisterBuffer: LLMMessageItem[] = []
    for (const msg of todayMessages) {
      if (msg.sender === 'sister') {
        sisterBuffer.push(this.formatSisterMessageForLLM(msg))
        continue
      }

      if (sisterBuffer.length > 0) {
        result.push({
          role: 'assistant',
          content: JSON.stringify({ messages: sisterBuffer }),
        })
        sisterBuffer = []
      }

      result.push(this.formatPlayerMessageForLLM(msg))
    }

    if (sisterBuffer.length > 0) {
      result.push({
        role: 'assistant',
        content: JSON.stringify({ messages: sisterBuffer }),
      })
    }

    return result
  }

  private formatPlayerMessageForLLM(msg: ChatMessage): ChatCompletionMessage {
    switch (msg.type) {
      case 'text':
        return { role: 'user', content: msg.content }
      case 'emoji': {
        const item = msg.asset ?? (msg.emojiSource === 'sister' ? this.sisterEmojis : this.playerEmojis)[msg.content]
        const desc = item ? `id=${msg.content}，名称=${item.name}，含义=${item.description}` : msg.content
        return { role: 'user', content: `玩家发送了一个表情包：${desc}` }
      }
      case 'red_packet':
        return { role: 'user', content: `玩家发送了一个虚构红包/礼物，内容：${msg.content}${msg.note ? `；留言：${msg.note}` : ''}` }
      case 'image':
        return { role: 'user', content: `玩家发送了一张图片：${msg.content}` }
      default:
        return { role: 'user', content: msg.content }
    }
  }

  private formatSisterMessageForLLM(msg: ChatMessage): LLMMessageItem {
    switch (msg.type) {
      case 'text':
        return { type: 'text', content: msg.content }
      case 'emoji':
        return { type: 'emoji', emoji_id: msg.content }
      case 'image':
        return { type: 'image', pic_id: msg.content }
      default:
        return { type: 'text', content: msg.content }
    }
  }

  /**
   * 阶段一：请求角色回复
   */
  public async requestSisterReply(
    history: ChatMessage[],
    state: SisterState,
    today: number,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '妹妹',
    signal?: AbortSignal,
  ): Promise<LLMReplyPayload> {
    const apiKey = this.config.apiKey
    if (!apiKey) {
      return this.getLocalFallbackReply(history, state)
    }

    const url = this.config.apiUrl || 'https://api.deepseek.com/chat/completions'
    const model = this.config.model || 'deepseek-chat'
    const messages = this.buildContextMessages(history, state, today, timeStr, characterNameOrScope)

    try {
      const resp = await fetch(url, {
        signal,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      })

      if (!resp.ok) {
        console.warn(`WeChat API error: ${resp.status} ${resp.statusText}`)
        return { ...this.getLocalFallbackReply(history, state), warning: `AI 连接失败（${resp.status}），以下为本地演示回复。` }
      }

      const data = await resp.json()
      const rawText = data?.choices?.[0]?.message?.content || ''
      return this.parseReplyJson(rawText, state)
    } catch (err) {
      if (signal?.aborted) throw err
      return { ...this.getLocalFallbackReply(history, state), warning: 'AI 请求失败，以下为本地演示回复。请检查连接设置。' }
    }
  }

  private cleanJsonString(str: string): string {
    let res = str.trim()
    if (res.startsWith('```json')) res = res.substring(7)
    if (res.startsWith('```')) res = res.substring(3)
    if (res.endsWith('```')) res = res.substring(0, res.length - 3)
    return res.trim()
  }

  /**
   * 解析模型返回的回复 JSON 并进行严格白名单过滤与安全校验
   */
  public parseReplyJson(rawText: string, _state?: SisterState): LLMReplyPayload {
    const cleaned = this.cleanJsonString(rawText)
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed.messages)) {
        const valid: LLMMessageItem[] = []
        for (const m of parsed.messages) {
          if (!m || typeof m !== 'object') continue
          if (m.type === 'text' && typeof m.content === 'string') {
            if (m.content.trim()) valid.push({ type: 'text', content: m.content.slice(0, 4000) })
          } else if (m.type === 'emoji' && typeof m.emoji_id === 'string') {
            const safeEmojiId = m.emoji_id.trim()
            // 严格白名单校验：必须存在于提取的妹妹表情列表中
            if (this.sisterEmojis[safeEmojiId]) {
              valid.push({ type: 'emoji', emoji_id: safeEmojiId })
            } else {
              valid.push({ type: 'text', content: '[表情]' })
            }
          } else if (m.type === 'image' && typeof m.pic_id === 'string') {
            const safePicId = m.pic_id.trim()
            // 严格白名单校验：必须存在于提取的自拍照片列表中
            if (this.sisterPhotos[safePicId]) {
              valid.push({ type: 'image', pic_id: safePicId })
            } else {
              valid.push({ type: 'text', content: '[自拍]' })
            }
          }
        }
        if (valid.length > 0) {
          const stateText = (value: unknown) => typeof value === 'string' && value.trim() && value.length <= 500 ? value.trim() : undefined
          const innerThought = stateText(parsed.inner_thought), currentStatus = stateText(parsed.current_status)
          return { messages: valid.slice(0, 4), ...(innerThought ? { innerThought } : {}), ...(currentStatus ? { currentStatus } : {}) }
        }
      }
    } catch {
      // 降级纯文本
    }

    if (rawText && !rawText.startsWith('{')) {
      return { messages: [{ type: 'text', content: rawText }] }
    }
    return { messages: [{ type: 'text', content: '嗯嗯。' }] }
  }

  /**
   * 本地分支离线回复（Fallback 词库）
   */
  public getLocalFallbackReply(history: ChatMessage[], _state?: SisterState): LLMReplyPayload {
    const last = [...history].reverse().find(item => item.sender === 'player')
    return { messages: [{ type: 'text', content: last?.type === 'red_packet' ? '收到你的礼物了，谢谢。' : '收到你的消息了。' }] }
  }
}
