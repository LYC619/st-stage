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
  content: string // 文本、emoji id、pic id 或礼物内容
  /** 红包/礼物附言；保留在消息中供历史和模型读取 */
  note?: string
  /** Snapshot preserves sent media when a group is disabled or edited. */
  asset?: EmojiItem
  type: MessageType
  /** Drawer asset family; older messages derive it from the sender. */
  emojiSource?: 'player' | 'sister'
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
  money: number     // 历史兼容字段；新 UI 不再展示或自动扣减
  /** AI 回复一并返回的角色内心想法 */
  innerThought?: string
  /** AI 回复一并返回的角色当前状态 */
  currentStatus?: string
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
  innerThought?: string
  currentStatus?: string
  warning?: string
}

export type ConversationKind = 'direct' | 'group'

export interface WeChatContact {
  id: string
  name: string
  avatar?: string
  characterId?: string
  card?: import('./bridge').STCharacterCard
  kind?: 'character' | 'manual'
  conversationKey?: string
}

export interface WeChatConfig {
  apiKey?: string
  apiUrl?: string
  model?: string
  injectPrompt?: boolean
  profile?: Partial<import('./profile').WeChatProfile>
  /** Avatar filename is the stable card identity; never bind by a mutable display name or array index. */
  characterProfiles?: Record<string, Partial<import('./profile').WeChatProfile>>
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
  contactId?: string
  conversationType?: ConversationKind
  title?: string
  unreadCount?: number
  memberIds?: string[]
  card?: import('./bridge').STCharacterCard
  draft?: string
  updatedAt?: number
}

/** 微信 App 全局存储：按角色与会话划分作用域隔离存储 */
export interface WeChatAppData {
  config: WeChatConfig
  profileTemplates?: import('./profile-library').WeChatProfileTemplate[]
  profileEditorScopes?: Record<string, 'global' | 'character'>
  /** scopeKey -> 该角色与会话的独立对话及状态 */
  conversations?: Record<string, CharacterConversation>
  activeScopeKey?: string
  /** 可扩展联系人目录；群聊成员后续复用同一目录 */
  contacts?: Record<string, WeChatContact>

  // 历史兼容字段（旧版迁移用）
  activeCharacter?: string
  messages?: ChatMessage[]
  state?: SisterState
  currentDay?: number
}
