import type { WeChatAppData, CharacterConversation, SisterState } from './types'
import type { ConversationScope } from './bridge'
import { resolveProfile, profileCharacterKey } from './profile-library'
function createDefaultSisterState(): SisterState {
  return {
    hasExternalState: false,
    mood: 60.0,
    interest: 15.0,
    sisterLocation: 'SISTER_ROOM',
    playerLocation: 'COMPANY',
    money: 5200,
  }
}

/**
 * 按角色与聊天唯一标识（scopeKey）隔离并维护会话存储
 */
export function getScopedConversation(
  appData: WeChatAppData,
  scopeOrName: ConversationScope | string,
): CharacterConversation {
  if (!appData.conversations) {
    appData.conversations = {}
  }

  const isScope = typeof scopeOrName === 'object' && scopeOrName !== null
  const characterName = isScope ? scopeOrName.characterName : scopeOrName || '妹妹'
  const scopeKey = isScope ? scopeOrName.scopeKey : (characterName.trim() || 'default')
  const externalState = isScope ? scopeOrName.externalState : undefined
  const characterId = isScope ? scopeOrName.characterId : undefined
  const chatId = isScope ? scopeOrName.chatId : undefined

  let conv = appData.conversations[scopeKey]

  // 1. 兼容迁移：旧版本只有角色名键（如 'Alice'），迁移到复合 scopeKey（如 'Alice::first-chat'）
  if (!conv && characterName && appData.conversations[characterName]) {
    conv = appData.conversations[characterName]
    delete appData.conversations[characterName] // 移除旧的单名键，防止后续新建的会话被错误关联
    conv.scopeKey = scopeKey
    conv.characterName = characterName
    if (characterId) conv.characterId = characterId
    if (chatId) conv.chatId = chatId
    appData.conversations[scopeKey] = conv
  }

  // 2. 兼容迁移：最老版扁平根数据（appData.messages）迁移
  if (!conv && appData.messages && appData.messages.length > 0) {
    conv = {
      characterName,
      characterId,
      chatId,
      scopeKey,
      messages: [...appData.messages],
      state: appData.state ? { ...appData.state } : createDefaultSisterState(),
      currentDay: appData.currentDay || 1,
    }
    appData.conversations[scopeKey] = conv
    delete appData.messages
    delete appData.state
    delete appData.currentDay
  }

  // 3. 首次新建独立会话
  if (!conv) {
    const isSister = !characterName || characterName === '妹妹'
    const profile = resolveProfile(appData.config, isScope ? profileCharacterKey(scopeOrName.card) : null)
    conv = {
      characterName,
      characterId,
      chatId,
      scopeKey,
      messages: [
        {
          sender: 'sister',
          content: profile.openingMessage || (profile.preset === 'cohabitation' && isSister ? '哥，下班没？今天晚上想吃什么呀？' : '在吗？发个微信聊聊。'),
          type: 'text',
          time: { day: 1, hour: 18, minute: 30 },
        },
      ],
      state: profile.preset === 'general'
        ? { ...createDefaultSisterState(), sisterLocation: '未设定', playerLocation: '未设定', money: 0 }
        : createDefaultSisterState(),
      currentDay: 1,
    }
    appData.conversations[scopeKey] = conv
  }

  // 4. 同步外部状态（MVU / 酒馆助手 / host）
  if (externalState && externalState.source !== 'none' && externalState.mappedFields && Object.values(externalState.mappedFields).some(Boolean)) {
    conv.state.hasExternalState = true
    conv.state.externalSource = externalState.source
    conv.state.externalFields = { ...externalState.mappedFields }
    if (externalState.mood !== undefined) conv.state.mood = externalState.mood
    if (externalState.interest !== undefined) conv.state.interest = externalState.interest
    if (externalState.money !== undefined) conv.state.money = externalState.money
    if (externalState.location !== undefined) conv.state.sisterLocation = externalState.location
  } else if (externalState && externalState.source === 'none') {
    // 失去外部状态源时清理
    conv.state.hasExternalState = false
    conv.state.externalSource = undefined
    conv.state.externalFields = undefined
  }

  return conv
}
