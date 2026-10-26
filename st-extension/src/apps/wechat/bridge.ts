/**
 * 微信 App 宿主环境上下文与状态桥接层
 * 负责从 SillyTavern 全局运行时、MVU / 酒馆助手以及宿主 AppHost 中读取真实角色卡、对话历史与外部变量状态。
 */

import type { AppHost } from '../../../../core/phone-registry'
import { getLastMessageId, readVariables, subscribeVarEvents } from '../mvu/bridge'
import { isTupleLeaf } from '../variable-tree'

export interface STCharacterCard {
  name?: string
  description?: string
  personality?: string
  scenario?: string
  mes_example?: string
  avatar?: string
}

export interface STChatContext {
  characterId?: string | number
  chatId?: string | number
  characterName?: string
  chat?: Array<{ mes: string; is_user: boolean }>
}

export interface ExternalCharacterState {
  source: 'mvu' | 'tavern-helper' | 'host' | 'none'
  mood?: number
  interest?: number
  money?: number
  location?: string
  mappedFields?: {
    mood?: boolean
    interest?: boolean
    money?: boolean
    location?: boolean
  }
  raw?: Record<string, unknown>
}

export interface ConversationScope {
  scopeKey: string
  characterName: string
  characterId?: string
  chatId?: string
  card?: STCharacterCard
  stRecentMessages?: Array<{ sender: 'user' | 'character'; text: string }>
  externalState: ExternalCharacterState
}

const MOOD_KEYS = ['mood', '心情', '好感', 'favor', 'favorability', 'emotion', 'happiness']
const INTEREST_KEYS = ['interest', '好感度', '兴趣', 'affinity', 'intimacy', 'love']
const MONEY_KEYS = ['money', '金钱', '余额', 'cash', 'coin', 'coins', 'wallet', 'gold']
const LOCATION_KEYS = ['location', '地点', '当前位置', 'place', 'scene']

export function unpackValue(val: unknown): unknown {
  if (isTupleLeaf(val)) {
    return val[0]
  }
  if (Array.isArray(val) && val.length === 2 && typeof val[1] === 'string') {
    return val[0]
  }
  return val
}

export function numOrUndef(raw: unknown): number | undefined {
  const val = unpackValue(raw)
  if (typeof val === 'number' && !isNaN(val)) return val
  if (typeof val === 'string' && /^-?\d+(?:\.\d+)?$/.test(val.trim())) {
    const parsed = Number(val.trim())
    if (!isNaN(parsed)) return parsed
  }
  return undefined
}

export function strOrUndef(raw: unknown): string | undefined {
  const val = unpackValue(raw)
  if (typeof val === 'string' && val.trim()) return val.trim()
  return undefined
}

function findValidNumberInPool(pool: Record<string, unknown>, keys: string[]): number | undefined {
  for (const k of keys) {
    if (k in pool && pool[k] !== undefined && pool[k] !== null) {
      const val = numOrUndef(pool[k])
      if (val !== undefined) {
        return val
      }
    }
  }
  return undefined
}

function findValidStringInPool(pool: Record<string, unknown>, keys: string[]): string | undefined {
  for (const k of keys) {
    if (k in pool && pool[k] !== undefined && pool[k] !== null) {
      const val = strOrUndef(pool[k])
      if (val !== undefined) {
        return val
      }
    }
  }
  return undefined
}

export function extractFieldsFromObject(
  obj: unknown,
  charName?: string,
): {
  mood?: number
  interest?: number
  money?: number
  location?: string
  hasAny: boolean
  mappedFields: {
    mood?: boolean
    interest?: boolean
    money?: boolean
    location?: boolean
  }
} {
  if (!obj || typeof obj !== 'object') {
    return { hasAny: false, mappedFields: {} }
  }

  const raw = obj as Record<string, unknown>
  const pools: Record<string, unknown>[] = []

  const trimmedName = charName?.trim()
  if (trimmedName && raw[trimmedName] && typeof raw[trimmedName] === 'object' && !Array.isArray(raw[trimmedName])) {
    pools.push(raw[trimmedName] as Record<string, unknown>)
  }
  if (raw.stat_data && typeof raw.stat_data === 'object' && !Array.isArray(raw.stat_data)) {
    const sd = raw.stat_data as Record<string, unknown>
    if (trimmedName && sd[trimmedName] && typeof sd[trimmedName] === 'object' && !Array.isArray(sd[trimmedName])) {
      pools.push(sd[trimmedName] as Record<string, unknown>)
    }
    pools.push(sd)
  }
  pools.push(raw)

  let mood: number | undefined
  let interest: number | undefined
  let money: number | undefined
  let location: string | undefined

  for (const pool of pools) {
    if (mood === undefined) mood = findValidNumberInPool(pool, MOOD_KEYS)
    if (interest === undefined) interest = findValidNumberInPool(pool, INTEREST_KEYS)
    if (money === undefined) money = findValidNumberInPool(pool, MONEY_KEYS)
    if (location === undefined) location = findValidStringInPool(pool, LOCATION_KEYS)
  }

  const mappedFields = {
    mood: mood !== undefined,
    interest: interest !== undefined,
    money: money !== undefined,
    location: location !== undefined,
  }

  const hasAny = Boolean(mappedFields.mood || mappedFields.interest || mappedFields.money || mappedFields.location)

  return { mood, interest, money, location, hasAny, mappedFields }
}

/**
 * 将 SillyTavern 角色卡头像文件名或标识解析为可直接在 img.src 加载的有效 URL
 */
export function resolveCharacterAvatarUrl(avatar?: string): string | undefined {
  if (!avatar || typeof avatar !== 'string') return undefined
  const trimmed = avatar.trim()
  if (!trimmed) return undefined

  if (/^(?:https?:|\/|data:|blob:)/i.test(trimmed)) {
    return trimmed
  }

  try {
    const w = typeof window !== 'undefined'
      ? (window as unknown as {
          getThumbnailUrl?: (type: string, file: string) => string
          SillyTavern?: {
            getContext?: () => {
              getThumbnailUrl?: (type: string, file: string) => string
            }
          }
        })
      : undefined

    const getThumb = w?.getThumbnailUrl || w?.SillyTavern?.getContext?.()?.getThumbnailUrl
    if (typeof getThumb === 'function') {
      const url = getThumb('avatar', trimmed)
      if (url && typeof url === 'string') return url
    }
  } catch {
    // 忽略异常
  }

  return `/characters/${encodeURIComponent(trimmed)}`
}

/**
 * 从不同来源（宿主自定义、MVU、酒馆助手）尝试抽取数值状态
 */
export async function readExternalCharacterState(host?: AppHost, charName?: string): Promise<ExternalCharacterState> {
  // 1. 优先读取 host.getVariables（如果宿主提供了直接读取函数）
  try {
    if (host && typeof host.getVariables === 'function') {
      const vars = await Promise.resolve(host.getVariables())
      const extracted = extractFieldsFromObject(vars, charName)
      if (extracted.hasAny) {
        return {
          source: 'host',
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: vars && typeof vars === 'object' ? (vars as Record<string, unknown>) : undefined,
        }
      }
    }
  } catch {
    // 忽略异常，降级到环境检测
  }

  // 2. 检查全局 Mvu / TavernHelper 对象
  try {
    const w = typeof window !== 'undefined'
      ? (window as unknown as {
          Mvu?: { getMvuData?: (scope: { type: 'message'; message_id: string | number }) => { stat_data?: Record<string, unknown> } }
          TavernHelper?: { getVariables?: (scope: { type: 'message'; message_id: string | number }) => Record<string, unknown> }
        })
      : undefined

    if (w?.Mvu && typeof w.Mvu.getMvuData === 'function') {
      const mvuRes = w.Mvu.getMvuData({ type: 'message', message_id: 'latest' })
      const stat = mvuRes?.stat_data
      const extracted = extractFieldsFromObject(stat, charName)
      if (extracted.hasAny) {
        return {
          source: 'mvu',
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: stat,
        }
      }
    }

    if (w?.TavernHelper && typeof w.TavernHelper.getVariables === 'function') {
      const helperVars = await Promise.resolve(w.TavernHelper.getVariables({ type: 'message', message_id: 'latest' }))
      const extracted = extractFieldsFromObject(helperVars, charName)
      if (extracted.hasAny) {
        return {
          source: 'tavern-helper',
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: helperVars,
        }
      }
    }
  } catch {
    // 忽略异常，继续后续检查
  }

  // 3. 调用 mvu bridge 封装的标准读取通道
  try {
    const res = await readVariables({ type: 'message', message_id: 'latest' }, getLastMessageId())
    if (res.status === 'ready' && res.data) {
      const extracted = extractFieldsFromObject(res.data, charName)
      if (extracted.hasAny) {
        return {
          source: res.isMvu ? 'mvu' : 'tavern-helper',
          mood: extracted.mood,
          interest: extracted.interest,
          money: extracted.money,
          location: extracted.location,
          mappedFields: extracted.mappedFields,
          raw: res.data,
        }
      }
    }
  } catch {
    // 忽略异常
  }

  return { source: 'none' }
}

/**
 * 提取当前 ST 主会话中最近几条消息记录（作为微信连贯记忆背景）
 */
export function extractRecentSTMessages(host?: AppHost): Array<{ sender: 'user' | 'character'; text: string }> | undefined {
  let chatCtx: STChatContext | undefined = undefined
  if (host && typeof host.getChatContext === 'function') {
    chatCtx = host.getChatContext()
  }
  if (!chatCtx) {
    try {
      const w = typeof window !== 'undefined'
        ? (window as unknown as {
            SillyTavern?: {
              getContext: () => {
                chat?: Array<{ mes: string; is_user: boolean }>
              }
            }
          })
        : undefined
      const chat = w?.SillyTavern?.getContext?.()?.chat
      if (Array.isArray(chat)) {
        chatCtx = { chat }
      }
    } catch {
      // 忽略异常
    }
  }

  if (Array.isArray(chatCtx?.chat) && chatCtx.chat.length > 0) {
    return chatCtx.chat
      .slice(-6)
      .filter((m) => typeof m.mes === 'string' && m.mes.trim().length > 0)
      .map((m) => ({
        sender: m.is_user ? 'user' : 'character',
        text: m.mes.trim(),
      }))
  }
  return undefined
}

/**
 * 订阅 ST 宿主与 MVU 变量更新事件（包含 VARIABLE_UPDATE_ENDED, CHAT_CHANGED 等）
 */
export function subscribeExternalContextEvents(host: AppHost, onUpdate: () => void): () => void {
  const offs: Array<() => void> = []

  try {
    const unbindVar = subscribeVarEvents(onUpdate)
    offs.push(unbindVar)
  } catch {
    // 忽略异常
  }

  try {
    if (typeof host.onMessageReceived === 'function') {
      const offMsg = host.onMessageReceived(onUpdate)
      if (typeof offMsg === 'function') {
        offs.push(offMsg)
      }
    }
  } catch {
    // 忽略异常
  }

  return () => {
    for (const off of offs) {
      try {
        off()
      } catch {
        // 退订失败不阻塞
      }
    }
  }
}

/**
 * 同步解析当前对话的基础作用域标识、角色卡与聊天上下文（用于即时无闪烁切视图）
 */
export function resolveConversationScopeSync(host: AppHost): ConversationScope {
  const charName = host.getCharacterName() || '妹妹'

  let card: STCharacterCard | undefined = undefined
  let chatCtx: STChatContext | undefined = undefined

  if (typeof host.getCharacterCard === 'function') {
    card = host.getCharacterCard()
  }
  if (typeof host.getChatContext === 'function') {
    chatCtx = host.getChatContext()
  }

  try {
    const w = typeof window !== 'undefined'
      ? (window as unknown as {
          SillyTavern?: {
            getContext: () => {
              characterId?: string | number
              chatId?: string | number
              chatMetadata?: { name?: string; file_name?: string }
              characters?: Array<STCharacterCard>
              chat?: Array<{ mes: string; is_user: boolean }>
              name2?: string
            }
          }
        })
      : undefined

    const stCtx = w?.SillyTavern?.getContext?.()
    if (stCtx) {
      if (!card) {
        const id = stCtx.characterId
        if (id !== undefined && id !== null && String(id) !== '') {
          card = stCtx.characters?.[Number(id)]
        }
      }
      if (!chatCtx) {
        chatCtx = {
          characterId: stCtx.characterId,
          chatId: stCtx.chatId ?? stCtx.chatMetadata?.file_name,
          characterName: charName,
          chat: stCtx.chat,
        }
      }
    }
  } catch {
    // 忽略异常
  }

  const stableCharId = card?.avatar || (chatCtx?.characterId !== undefined && String(chatCtx.characterId) !== '' ? String(chatCtx.characterId) : '') || charName.trim()
  const stableChatId = (chatCtx?.chatId !== undefined && String(chatCtx.chatId) !== '') ? String(chatCtx.chatId) : ''
  const scopeKey = stableChatId ? `${stableCharId}::${stableChatId}` : stableCharId

  const stRecentMessages = extractRecentSTMessages(host)

  return {
    scopeKey,
    characterName: charName,
    characterId: chatCtx?.characterId !== undefined ? String(chatCtx.characterId) : undefined,
    chatId: stableChatId || undefined,
    card,
    stRecentMessages,
    externalState: { source: 'none' },
  }
}

/**
 * 完整异步解析当前对话的作用域标识、角色卡设定、ST 历史消息及外部状态
 */
export async function resolveConversationScope(host: AppHost): Promise<ConversationScope> {
  const syncScope = resolveConversationScopeSync(host)
  const externalState = await readExternalCharacterState(host, syncScope.characterName)
  return {
    ...syncScope,
    externalState,
  }
}
