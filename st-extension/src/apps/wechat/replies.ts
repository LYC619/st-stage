import { safeRandomId } from '../shared/safe-runtime'
import { applyAssetProfile } from './profile'
import { profileCharacterKey, resolveProfile } from './profile-library'
import { PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS } from './manifest-data'
import { conversationScope } from './conversations'
import { defaultContactState, isGroup, memberScope, replyMembers } from './groups'
import { WeChatPipeline } from './pipeline'
import type { Contact, Conversation, ChatMessage, ContactState, WeChatAppData } from './types'
import type { AppHost } from '../../../../core/phone-registry'
import { captureStory, readStoryMemory } from './memory'

export function contactPipeline(data: WeChatAppData, contact?: Contact, conv?: Conversation) {
  const card = contact?.card ?? (conv ? conversationScope(data, conv).card : undefined)
  const profile = resolveProfile(data.config, profileCharacterKey(card))
  const media = { player: applyAssetProfile(PLAYER_EMOJIS, 'player', profile),
    contact: applyAssetProfile(CONTACT_EMOJIS, 'contact', profile), photo: applyAssetProfile(CONTACT_PHOTOS, 'photo', profile) }
  return { media, pipe: new WeChatPipeline({ ...data.config, profile }, media.player, media.contact, media.photo) }
}

export interface ReplyProgress { index: number; total: number; name: string }
interface ReplyJob { controller: AbortController; timer?: ReturnType<typeof setTimeout>; progress?: ReplyProgress }

/** One transaction per conversation. Retries reuse the saved player message; group replies commit together. */
export function createReplyController(data: WeChatAppData, options: {
  persist: () => void
  changed: (key: string) => void
  activeKey: () => string | null
  report: (message: string) => void
  /** A group round names the member being requested; defaults to `changed`. */
  progress?: (key: string) => void
  timeoutMs?: number
  host?: AppHost
}) {
  let alive = true
  const pending = new Map<string, ReplyJob>()
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
    const controller = new AbortController(), job: ReplyJob = { controller }
    // Every request gets its own window: a large group answers member by member and may need longer than one minute in total.
    const arm = () => { clearTimeout(job.timer); job.timer = setTimeout(() => fail(conv, '请求超时，消息已保留。请点击重试。', 'failed'), options.timeoutMs ?? 60000) }
    arm(); pending.set(key, job)
    conv.replyAttempt = { messageId: player.id!, status: 'pending' }
    const valid = () => alive && pending.get(key) === job && !controller.signal.aborted && data.conversations?.[key] === conv
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
          profile: resolveProfile(data.config, profileCharacterKey(member?.card ?? conversationScope(data, conv).card)),
        }
      })
      if (options.host && participants.some(item => item.profile.contextMessageCount > 0 || item.profile.includeWorldbook)) {
        // Members share the same story and books; read each worldbook once per round.
        const story = captureStory(options.host), books = new Map<string, Promise<unknown>>()
        await Promise.all(participants.map(async participant => {
          participant.scope = await readStoryMemory(options.host!, participant.scope, participant.profile, controller.signal, story, player.content, undefined, books)
        }))
        if (!valid()) return
        const warnings = [...new Set(participants.flatMap(item => item.scope.memoryWarnings ?? []))]
        if (warnings.length) options.report(warnings.join(' '))
      }
      for (const [index, { member, scope, state, media, pipe }] of participants.entries()) {
        if (participants.length > 1) {
          job.progress = { index, total: participants.length, name: member?.name ?? scope.characterName }
          arm(); (options.progress ?? options.changed)(key)
        }
        const reply = await pipe.requestContactReply([...history, ...messages], state, day, time, scope, controller.signal)
        if (!valid()) return
        for (const item of reply.messages) {
          const asset = item.type === 'emoji' ? media.contact[item.emoji_id!] : item.type === 'image' ? media.photo[item.pic_id!] : undefined
          messages.push({ id: safeRandomId(), sender: 'contact', contactId: member?.id ?? conv.contactId,
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
      clearTimeout(job.timer)
      if (pending.get(key) === job) pending.delete(key)
      if (alive) options.changed(key)
    }
  }
  return {
    has: (key: string) => pending.has(key),
    /** Member currently being requested in a group round. */
    progress: (key: string) => pending.get(key)?.progress,
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
