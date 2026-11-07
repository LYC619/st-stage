import type { ContactState, Conversation, WeChatAppData } from './types'

/** Normalize historical storage only here; keep message IDs, snapshots and conversation keys. */
export function migrateContactState(state: ContactState): void {
  const legacy = state as ContactState & { sisterLocation?: string }
  if (typeof legacy.contactLocation !== 'string') legacy.contactLocation = legacy.sisterLocation ?? ''
  delete legacy.sisterLocation
}

export function migrateConversation(conversation: Conversation): void {
  migrateContactState(conversation.state)
  // Only legacy direct conversations have a useful timestamp estimate. A group's
  // activity cannot date any particular member's snapshot, so keep it unknown.
  conversation.state.updatedAt ??= conversation.conversationType === 'group' ? 0 : conversation.updatedAt ?? 0
  for (const state of Object.values(conversation.memberStates ?? {})) {
    migrateContactState(state)
    state.updatedAt ??= 0
  }
  for (const message of conversation.messages) {
    const legacy = message as unknown as { sender: string; emojiSource?: string }
    if (legacy.sender === 'sister') legacy.sender = 'contact'
    if (legacy.emojiSource === 'sister') legacy.emojiSource = 'contact'
    if (message.sender === 'contact') {
      message.contactId ??= conversation.contactId
      message.authorName ??= conversation.characterName
    }
  }
}

export function migrateWeChatData(data: WeChatAppData): void {
  // Re-run at each boundary: imported records can be older than the saved schema.
  if (data.state) migrateContactState(data.state)
  for (const conversation of Object.values(data.conversations ?? {})) migrateConversation(conversation)
  data.schemaVersion = 2
}
