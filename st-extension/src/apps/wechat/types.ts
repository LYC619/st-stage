/**
 * 《小登同居生活》微信对话系统类型定义
 */

export type MessageSender = 'player' | 'sister' | 'system'
export type MessageType = 'text' | 'emoji' | 'image' | 'red_packet'

export interface ChatTime {
  day: number
  hour: number
  minute: number
}

export interface ChatMessage {
  id?: string
  sender: MessageSender
  content: string // 文本、emoji id、pic id 或 红包金额
  type: MessageType
  time: ChatTime
}

export interface EmojiItem {
  id?: string
  name: string
  description: string
  file: string
}

export interface PhotoItem {
  id?: string
  name: string
  description: string
  file: string
}

export type SisterLocation = 'TOILET' | 'SCHOOL' | 'LIVING_ROOM' | 'SISTER_ROOM'
export type PlayerLocation = 'LIVING_ROOM' | 'COMPANY'

export interface SisterState {
  hasExternalState?: boolean
  externalSource?: string
  externalFields?: {
    mood?: boolean
    interest?: boolean
    money?: boolean
    location?: boolean
  }
  mood: number      // 0 ~ 100 心情
  interest: number  // 0 ~ 100 性趣 / 好感
  sisterLocation: SisterLocation | string
  playerLocation: PlayerLocation | string
  money: number     // 玩家钱包余额
}

export interface StatImpact {
  mood: number      // 范围 [-0.4, +0.4]
  interest: number  // 范围 [-0.4, +0.4]
}

export interface LLMMessageItem {
  type: 'text' | 'emoji' | 'image'
  content?: string
  emoji_id?: string
  pic_id?: string
}

export interface LLMReplyPayload {
  messages: LLMMessageItem[]
}

export interface WeChatConfig {
  apiKey?: string
  apiUrl?: string
  model?: string
  injectPrompt?: boolean
}

/** 单个角色或对话的作用域会话数据 */
export interface CharacterConversation {
  characterName: string
  characterId?: string
  chatId?: string
  scopeKey?: string
  messages: ChatMessage[]
  state: SisterState
  currentDay: number
}

/** 微信 App 全局存储：按角色与会话划分作用域隔离存储 */
export interface WeChatAppData {
  config: WeChatConfig
  /** scopeKey -> 该角色与会话的独立对话及状态 */
  conversations?: Record<string, CharacterConversation>
  activeScopeKey?: string

  // 历史兼容字段（旧版迁移用）
  activeCharacter?: string
  messages?: ChatMessage[]
  state?: SisterState
  currentDay?: number
}
