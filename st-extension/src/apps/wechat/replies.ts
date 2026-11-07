import { applyAssetProfile } from './profile'
import { profileCharacterKey, resolveProfile } from './profile-library'
import { PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS } from './manifest-data'
import { conversationScope } from './conversations'
import { defaultContactState, isGroup, memberScope, replyMembers } from './groups'
import { WeChatPipeline } from './pipeline'
import type { Contact, Conversation, ChatMessage, ContactState, WeChatAppData } from './types'

export function contactPipeline(data: WeChatAppData, contact?: Contact, conv?: Conversation) {
  const card = contact?.card ?? (conv ? conversationScope(data, conv).card : undefined)
  const profile = resolveProfile(data.config, profileCharacterKey(card))
  const media = { player: applyAssetProfile(PLAYER_EMOJIS, 'player', profile),
    contact: applyAssetProfile(CONTACT_EMOJIS, 'contact', profile), photo: applyAssetProfile(CONTACT_PHOTOS, 'photo', profile) }
  return { media, pipe: new WeChatPipeline({ ...data.config, profile }, media.player, media.contact, media.photo) }
}

/** One transaction per conversation. Retries reuse the saved player message; group replies commit together. */
export function createReplyController(data: WeChatAppData, options: {
  persist: () => void
  changed: (key: string) => void
  activeKey: () => string | null
  report: (message: string) => void
  timeoutMs?: number
}) {
  let alive = true
  const pending = new Map<string, { controller: AbortController; timer: ReturnType<typeof setTimeout> }>()
  const recovered = Object.values(data.conversations ?? {}).filter(conv => conv.replyAttempt?.status === 'pending')
  for (const conv of recovered) conv.replyAttempt = { ...conv.replyAttempt!, status: 'failed', error: '上次回复已中断，可以重试。' }
  if (recovered.length) options.persist()
  const keyOf = (conv: Conversation) => conv.scopeKey!
  function fail(conv: Conversation, reason: string, status: 'failed' | 'canceled') {
    const key = keyOf(conv), job = pending.get(key)
    if (!job) return
    job.controller.abort(); clearTimeout(job.timer); pending.delete(key)
    if (conv.replyAttempt) conv.replyAttempt = { ...conv.replyAttempt, status, error: reason }
    try { options.persist() } catch { options.report('回复状态保存失败，请保持页面打开后重试。') }
    if (alive) options.changed(key)
  }
  async function run(conv: Conversation, player: ChatMessage) {
    const key = keyOf(conv)
    if (!alive || pending.has(key)) return
    let members: Array<Contact | undefined>
    try { members = isGroup(conv) ? replyMembers(data, conv, player.content) : [conv.contactId ? data.contacts?.[conv.contactId] : undefined] }
    catch (error) {
      conv.replyAttempt = { messageId: player.id!, status: 'failed', error: (error as Error).message }
      options.persist(); options.changed(key); return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => fail(conv, '请求超时，消息已保留。请点击重试。', 'failed'), options.timeoutMs ?? 60000)
    pending.set(key, { controller, timer })
    conv.replyAttempt = { messageId: player.id!, status: 'pending' }
    const valid = () => alive && pending.get(key)?.controller === controller && !controller.signal.aborted && data.conversations?.[key] === conv
    try {
      options.persist(); options.changed(key)
      const history = structuredClone(conv.messages), messages: ChatMessage[] = [], states: Record<string, ContactState> = {}
      let directState = { ...conv.state }
      const group = isGroup(conv), day = conv.currentDay, time = new Date().toLocaleTimeString()
      // Prepare every participant before the first await. Saving settings or refreshing
      // another card while A responds must only affect the next round, including B.
      const participants = members.map(source => {
        const member = source ? structuredClone(source) : undefined
        return { member,
          scope: structuredClone(group && member ? memberScope(data, conv, member) : conversationScope(data, conv)),
          state: structuredClone(group && member ? conv.memberStates[member.id] ?? defaultContactState() : conv.state),
          ...contactPipeline(data, member, conv),
        }
      })
      for (const { member, scope, state, media, pipe } of participants) {
        const reply = await pipe.requestContactReply([...history, ...messages], state, day, time, scope, controller.signal)
        if (!valid()) return
        for (const item of reply.messages) {
          const asset = item.type === 'emoji' ? media.contact[item.emoji_id!] : item.type === 'image' ? media.photo[item.pic_id!] : undefined
          messages.push({ id: crypto.randomUUID(), sender: 'contact', contactId: member?.id ?? conv.contactId,
            authorName: member?.name ?? scope.characterName, type: item.type, content: item.content || item.emoji_id || item.pic_id || '',
            time: { day, hour: new Date().getHours(), minute: new Date().getMinutes() }, ...(asset ? { asset: { ...asset } } : {}) })
        }
        if (reply.innerThought) state.innerThought = reply.innerThought
        if (reply.currentStatus) state.currentStatus = reply.currentStatus
        if (reply.mood !== undefined) state.mood = reply.mood
        if (reply.innerThought || reply.currentStatus || reply.mood !== undefined) state.updatedAt = Date.now()
        if (group && member) states[member.id] = state
        else directState = state
      }
      if (!valid()) return
      const prior = { messages: conv.messages, state: conv.state, memberStates: conv.memberStates,
        unreadCount: conv.unreadCount, updatedAt: conv.updatedAt, replyAttempt: conv.replyAttempt }
      conv.messages = [...conv.messages, ...messages]; conv.state = directState
      if (isGroup(conv)) conv.memberStates = { ...conv.memberStates, ...states }
      if (options.activeKey() !== key) conv.unreadCount = (conv.unreadCount ?? 0) + messages.length
      conv.updatedAt = Date.now(); delete conv.replyAttempt
      try { options.persist() } catch (error) { Object.assign(conv, prior); throw error }
    } catch (error) {
      if (valid()) fail(conv, error instanceof Error ? error.message : '回复失败，请重试。', 'failed')
    } finally {
      clearTimeout(timer)
      if (pending.get(key)?.controller === controller) pending.delete(key)
      if (alive) options.changed(key)
    }
  }
  return {
    has: (key: string) => pending.has(key),
    send: run,
    retry(conv: Conversation) {
      const player = conv.messages.find(item => item.id === conv.replyAttempt?.messageId && item.sender === 'player')
      if (player && conv.messages.filter(item => item.sender === 'player').at(-1) === player) return run(conv, player)
    },
    cancel(conv: Conversation) { fail(conv, '已取消回复，消息已保留。', 'canceled') },
    destroy() {
      alive = false
      for (const key of [...pending.keys()]) {
        const conv = data.conversations?.[key]
        if (conv) fail(conv, '页面已关闭，回复已取消。', 'canceled')
      }
    },
  }
}
