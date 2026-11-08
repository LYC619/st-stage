/**
 * 微信单次结构化回复、角色状态与上下文管线。
 */

import type {
  ChatMessage,
  Contact,
  EmojiItem,
  PhotoItem,
  ContactState,
  LLMReplyPayload,
  LLMMessageItem,
  WeChatConfig,
} from './types'
import type { ConversationScope } from './bridge'
import { buildRagPrompt, messageToRagText } from './rag'
import { renderWeChatPrompt } from './prompts'
import { normalizeProfile } from './profile'
import { DEFAULT_MOMENTS_PROMPT } from './moments'
import { formatStoryMemory } from './memory'

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
  private contactEmojis: Record<string, EmojiItem>
  private contactPhotos: Record<string, PhotoItem>


  constructor(
    config: WeChatConfig,
    playerEmojis: Record<string, EmojiItem>,
    contactEmojis: Record<string, EmojiItem>,
    contactPhotos: Record<string, PhotoItem>,
    _fallbackDialogues?: FallbackDialoguesConfig,
  ) {
    this.config = config
    this.playerEmojis = playerEmojis
    this.contactEmojis = contactEmojis
    this.contactPhotos = contactPhotos
  }

  public updateConfig(newConfig: Partial<WeChatConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 构建微信系统提示词（根据当前 ST 对话角色动态适配）
   */
  public buildSystemPrompt(
    state: ContactState,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '联系人',
  ): string {
    const scope = typeof characterNameOrScope === 'string'
      ? { scopeKey: '', characterName: characterNameOrScope, externalState: { source: 'none' as const } }
      : characterNameOrScope
    const list = (items: Record<string, EmojiItem | PhotoItem>) => Object.entries(items).map(([id, item]) => `${id}: ${item.name} — ${item.description}`).join('\n')
    const prompt = renderWeChatPrompt(normalizeProfile(this.config), state, timeStr, scope, list(this.contactEmojis), list(this.contactPhotos))
    return scope.group ? prompt + '\n你在群聊「' + scope.group.title + '」中，仅扮演当前角色。其他成员的发言是对话内容，不要冒充他们或用户。成员：' + JSON.stringify(scope.group.members) : prompt
  }

  /**
   * 组装完整的对话上下文消息
   */
  public buildContextMessages(
    history: ChatMessage[],
    state: ContactState,
    today: number,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '联系人',
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
          this.contactEmojis,
          this.contactPhotos,
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
        this.contactEmojis,
        this.contactPhotos,
      )
      if (ragPrompt) {
        result.push({ role: 'system', content: ragPrompt })
      }
    }

    if (typeof characterNameOrScope !== 'string' && characterNameOrScope.group) {
      for (const msg of todayMessages) {
        const self = msg.sender === 'contact' && msg.contactId === characterNameOrScope.contactId
        result.push({ role: self ? 'assistant' : 'user', content: self ? JSON.stringify({ messages: [this.formatContactMessageForLLM(msg)] }) : '[' + (msg.sender === 'player' ? '玩家' : msg.authorName || '成员') + '] ' + messageToRagText(msg, this.playerEmojis, this.contactEmojis, this.contactPhotos) })
      }
      return result
    }

    // 格式化今日消息流
    let contactBuffer: LLMMessageItem[] = []
    for (const msg of todayMessages) {
      if (msg.sender === 'contact') {
        contactBuffer.push(this.formatContactMessageForLLM(msg))
        continue
      }

      if (contactBuffer.length > 0) {
        result.push({
          role: 'assistant',
          content: JSON.stringify({ messages: contactBuffer }),
        })
        contactBuffer = []
      }

      result.push(this.formatPlayerMessageForLLM(msg))
    }

    if (contactBuffer.length > 0) {
      result.push({
        role: 'assistant',
        content: JSON.stringify({ messages: contactBuffer }),
      })
    }

    return result
  }

  private formatPlayerMessageForLLM(msg: ChatMessage): ChatCompletionMessage {
    switch (msg.type) {
      case 'text':
        return { role: 'user', content: msg.content }
      case 'emoji': {
        const item = msg.asset ?? (msg.emojiSource === 'contact' ? this.contactEmojis : this.playerEmojis)[msg.content]
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

  private formatContactMessageForLLM(msg: ChatMessage): LLMMessageItem {
    switch (msg.type) {
      case 'voice':
        return { type: 'voice', content: msg.content }
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
  public async requestContactReply(
    history: ChatMessage[], state: ContactState, today: number, timeStr: string,
    characterNameOrScope: ConversationScope | string = '联系人', signal?: AbortSignal,
  ): Promise<LLMReplyPayload> {
    if (!this.config.apiKey) return this.getLocalFallbackReply(history, state)
    const raw = await this.requestJson(this.buildContextMessages(history, state, today, timeStr, characterNameOrScope), signal)
    return this.parseReplyJson(raw, state)
  }

  private async requestJson(messages: ChatCompletionMessage[], signal?: AbortSignal): Promise<string> {
    try {
      const resp = await fetch(this.config.apiUrl || 'https://api.deepseek.com/chat/completions', {
        signal, method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + this.config.apiKey },
        body: JSON.stringify({ model: this.config.model || 'deepseek-chat', messages, temperature: 0.5, stream: false, response_format: { type: 'json_object' } }),
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

  public async requestMoment(contact: Contact, state: ContactState, signal?: AbortSignal, scope?: ConversationScope, recent: string[] = []): Promise<{ text: string; image?: PhotoItem; visibility?: 'public' | 'private' }> {
    if (!this.config.apiKey) {
      const image = Object.values(this.contactPhotos)[0]
      return { text: state.currentStatus ? '今天的小记：' + state.currentStatus : state.mood >= 60 ? '今天心情不错，想把普通的一天也记下来。' : '今天想放慢一点，给自己留些安静的时间。', image }
    }
    const photos = Object.fromEntries(Object.entries(this.contactPhotos).map(([id,item]) => [id, item.description || item.name]))
    const raw = await this.requestJson([
      { role: 'system', content: (this.config.momentsPrompt || DEFAULT_MOMENTS_PROMPT) + '\n' + (scope ? formatStoryMemory(scope) : '') + '\n' + (this.config.privateMoments === false ? 'visibility 必须为 public。' : '动态通常公开；仅在角色有自然的专属心情想分享给玩家时，偶尔使用 visibility: "private"，其余为 "public"。不要强制暧昧或编造共同经历。') },
      { role: 'user', content: JSON.stringify({ character: contact.card, name: contact.name, mood: state.mood, status: state.currentStatus, photos, recentPosts: recent, instruction: '承接已发生的剧情，用角色自己的口吻分享此刻的生活或感受，不重复已有动态，不替玩家推进剧情。' }) },
    ], signal)
    try {
      const result = JSON.parse(this.cleanJsonString(raw))
      if (!result || typeof result.text !== 'string' || !result.text.trim()) throw new Error()
      const image = typeof result.photo_id === 'string' ? this.contactPhotos[result.photo_id] : undefined
      return { text: result.text.trim().slice(0, 1000), visibility: this.config.privateMoments !== false && result.visibility === 'private' ? 'private' : 'public', ...(image ? { image } : {}) }
    } catch { throw new Error('动态格式无效，请重试。') }
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
  public parseReplyJson(rawText: string, _state?: ContactState): LLMReplyPayload {
    const cleaned = this.cleanJsonString(rawText)
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed.messages)) {
        const valid: LLMMessageItem[] = []
        for (const m of parsed.messages) {
          if (!m || typeof m !== 'object') continue
          if ((m.type === 'text' || m.type === 'voice') && typeof m.content === 'string') {
            if (m.content.trim()) valid.push({ type: m.type, content: m.content.slice(0, 4000) })
          } else if (m.type === 'emoji' && typeof m.emoji_id === 'string') {
            const safeEmojiId = m.emoji_id.trim()
            // 严格白名单校验：必须存在于提取的妹妹表情列表中
            if (this.contactEmojis[safeEmojiId]) {
              valid.push({ type: 'emoji', emoji_id: safeEmojiId })
            } else {
              valid.push({ type: 'text', content: '[表情]' })
            }
          } else if (m.type === 'image' && typeof m.pic_id === 'string') {
            const safePicId = m.pic_id.trim()
            // 严格白名单校验：必须存在于提取的自拍照片列表中
            if (this.contactPhotos[safePicId]) {
              valid.push({ type: 'image', pic_id: safePicId })
            } else {
              valid.push({ type: 'text', content: '[自拍]' })
            }
          }
        }
        if (valid.length > 0) {
          const stateText = (value: unknown) => typeof value === 'string' && value.trim() && value.length <= 500 ? value.trim() : undefined
          const innerThought = stateText(parsed.inner_thought), currentStatus = stateText(parsed.current_status)
          const mood = typeof parsed.mood === 'number' && Number.isFinite(parsed.mood) && parsed.mood >= 0 && parsed.mood <= 100 ? parsed.mood : undefined
          return { messages: valid.slice(0, 4), ...(innerThought ? { innerThought } : {}), ...(currentStatus ? { currentStatus } : {}), ...(mood !== undefined ? { mood } : {}) }
        }
      }
    } catch {
      // 降级纯文本
    }

    if (cleaned && !cleaned.startsWith('{') && !cleaned.startsWith('[')) {
      return { messages: [{ type: 'text', content: cleaned.slice(0, 4000) }] }
    }
    throw new Error('AI 回复格式无效，请重试。')
  }

  /**
   * 本地分支离线回复（Fallback 词库）
   */
  public getLocalFallbackReply(history: ChatMessage[], _state?: ContactState): LLMReplyPayload {
    const last = [...history].reverse().find(item => item.sender === 'player')
    return { messages: [{ type: 'text', content: last?.type === 'red_packet' ? '收到你的礼物了，谢谢。' : '收到你的消息了。' }] }
  }
}
