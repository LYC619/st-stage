import { safeRandomId } from '../shared/safe-runtime'
import type { PhoneApp, PhoneAppContext, AppHost } from '../../../../core/phone-registry'
import { manageDialogFocus } from '../../../../core/dialog-focus'
import { resolveCharacterAvatarUrl, resolveConversationScopeSync } from './bridge'
import { profileCharacterKey, resolveProfile } from './profile-library'
import { applyAssetProfile } from './profile'
import { createProfileSettings } from './profile-settings'
import { addContactConversation, conversationScope, listContacts, loadContact } from './conversations'
import { getScopedConversation } from './legacy-conversation'
import { DEFAULT_PLAYER_AVATAR, DEFAULT_CONTACT_AVATAR, PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS } from './manifest-data'
import { resolveWeChatAssetUrl } from './assets'
import { WeChatPipeline } from './pipeline'
import { migrateWeChatData } from './migrations'
import { isGroup, groupContacts, groupAvatarMembers } from './groups'
import { createReplyController } from './replies'
import { createSocialUI } from './social-ui'
import { createVoiceBubble, type VoiceBubbleController } from './voice'
import { createImageMedia } from './image-media'
import { createVoiceInput } from './voice-input'
import { createWeChatNavigation, type WeChatPage } from './navigation'
import { createMomentsController } from './moments-controller'
import { readStoryMemory } from './memory'
import { conversationPreview, listTime } from './list-format'
import { latestContactState } from './moments'
import { WECHAT_VIEW } from './view'
import type { Conversation, ChatMessage, EmojiItem, WeChatAppData } from './types'
export { getScopedConversation } from './legacy-conversation'

function initialize(host: AppHost, entering = false): WeChatAppData {
  const existing = host.getAppData<WeChatAppData>()
  const data: WeChatAppData = existing ?? { config: { profile: { preset: 'general', contextMessageCount: 12 } } }
  data.config ??= {}; data.conversations ??= {}; data.contacts ??= {}
  const current = resolveConversationScopeSync(host, 0)
  // Flat legacy records belong to their saved character. Do not silently attach them to another card.
  if (data.messages?.length) {
    const name = data.activeCharacter || current.characterName
    getScopedConversation(data, name === current.characterName ? current : name)
  }
  for (const [key, conv] of Object.entries(data.conversations)) {
    conv.scopeKey = key
    if (key === current.scopeKey && !conv.card && profileCharacterKey(current.card)) conv.card = current.card
    // Older composite keys start with the avatar filename, without the new "avatar:" prefix.
    if (!conv.card && !conv.contactId) {
      const match = listContacts(host).find(item => item.avatar === key.split('::')[0])
      if (match) conv.card = match.card
    }
  }
  // setup can run before a card is selected. Offer the current card on each entry,
  // preserving an existing conversation and its saved persona instead of refreshing it.
  const contactId = profileCharacterKey(current.card)
  if (entering && contactId && !data.conversations[`direct:${contactId}`]) {
    addContactConversation(data, { id: contactId, name: current.card?.name || current.characterName, avatar: current.card?.avatar, card: current.card, kind: 'character' })
  }
  migrateWeChatData(data)
  host.setAppData(data)
  return data
}

export function createWeChatApp(): PhoneApp {
  let cleanup: (() => void) | undefined
  /** In-app back for the phone shell: overlays first, then chat → list. */
  let stepBack: (() => boolean) | undefined
  let background: ReturnType<typeof createMomentsController> | undefined
  return {
    id: 'wechat-sister', name: '微信', icon: '💬', order: 25, fullbleed: true,
    setup(host) { initialize(host); background?.destroy(); background = createMomentsController(host); return () => { background?.destroy(); background = undefined } },
    mount(container: HTMLElement, ctx: PhoneAppContext) {
      cleanup?.()
      const data = initialize(ctx, true), conversations = data.conversations!
      let alive = true, activeKey: string | null = null, drawerTab: 'player' | 'contact' = 'player', selecting = 0
      let dialogFocus: ReturnType<typeof manageDialogFocus> | null = null
      let currentDialog: HTMLElement | null = null
      let photoMessage: ChatMessage | undefined, photoScopeKey: string | null = null
      container.classList.add('so-phone-app-fullbleed'); container.innerHTML = WECHAT_VIEW
      const el = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!
      const input = el<HTMLInputElement>('wt-input-text'), list = el('wt-conversations'), scroll = el('wt-scroll'), jump = el<HTMLButtonElement>('wt-jump-latest')
      // Scope by the actual conversation/message, including legacy messages without IDs.
      const voices = new Map<Conversation, Map<ChatMessage, { text: string; author: string; view: VoiceBubbleController }>>()
      const images = new WeakMap<ChatMessage, { key: string; element: HTMLElement }>()
      // Rows are cached per message object: a new reply appends instead of rebuilding every bubble and avatar.
      const rows = new WeakMap<ChatMessage, { key: string; row: HTMLElement }>()
      let renderedKey: string | null = null, renderedCount = 0, stickNext = false
      function pruneVoices() {
        const retained = new Set(Object.values(conversations))
        for (const [conv, entries] of voices) {
          const messages = new Set(retained.has(conv) ? conv.messages.filter(message => message.type === 'voice') : [])
          for (const [message, entry] of entries) if (!messages.has(message)) { entry.view.dispose(); entries.delete(message); rows.delete(message) }
          if (!entries.size) voices.delete(conv)
        }
      }
      function voiceFor(conv: Conversation, message: ChatMessage, author: string) {
        let entries = voices.get(conv)
        if (!entries) { entries = new Map(); voices.set(conv, entries) }
        let entry = entries.get(message)
        if (!entry || entry.text !== message.content || entry.author !== author) {
          entry?.view.dispose()
          entry = { text: message.content, author, view: createVoiceBubble(message.content, author) }
          entries.set(message, entry)
        }
        return entry.view.element
      }
      const feedback = el('wt-settings-feedback')
      const active = () => activeKey ? conversations[activeKey] : undefined
      const scopeFor = (conv: Conversation) => conversationScope(data, conv)
      const profileFor = (conv?: Conversation) => resolveProfile(data.config, conv ? profileCharacterKey(scopeFor(conv).card) : null)
      const mediaFor = (conv?: Conversation) => {
        const profile = profileFor(conv)
        return { player: applyAssetProfile(PLAYER_EMOJIS, 'player', profile), contact: applyAssetProfile(CONTACT_EMOJIS, 'contact', profile), photo: applyAssetProfile(CONTACT_PHOTOS, 'photo', profile) }
      }
      const persist = () => ctx.setAppData(data)
      const voiceInput = createVoiceInput(container, saveDraft)
      const pending = createReplyController(data, { host: ctx, persist, activeKey: () => activeKey, report: message => ctx.toast('error', message),
        changed: key => { if (!alive) return; if (activeKey === key) { renderMessages(); syncState() } else renderList() },
        progress: key => { if (alive && activeKey === key) syncState() } })
      function saveDraft() { const conv = active(); if (conv) { conv.draft = input.value; persist() } }
      function closeDialog(restore = true) {
        if (currentDialog) social.dialogClosed(currentDialog.id)
        if (currentDialog?.id === 'wt-settings-modal') profileSettings?.close()
        const wasPhoto = currentDialog?.id === 'wt-photo-lightbox'
        if (currentDialog?.id === 'wt-contacts-modal') selecting++
        const focus = dialogFocus; dialogFocus = null; focus?.dispose()
        if (currentDialog) currentDialog.hidden = true
        currentDialog = null
        if (restore) focus?.restoreFocus()
        if (wasPhoto && restore && activeKey === photoScopeKey && photoMessage) {
          const index = active()?.messages.indexOf(photoMessage) ?? -1
          scroll.querySelector<HTMLButtonElement>(`[data-wt-photo="${index}"]`)?.focus({ preventScroll: true })
        }
        if (wasPhoto) { photoMessage = undefined; photoScopeKey = null }
      }
      function showDialog(id: string, opener: HTMLElement) {
        navigation.closeMenu()
        voiceInput.interrupt()
        closeDrawer(false); closeDialog(false)
        currentDialog = el(id); currentDialog.hidden = false
        dialogFocus = manageDialogFocus(currentDialog, { onEscape: () => closeDialog(), opener })
        dialogFocus.focusInitial()
      }
      function closeDrawer(restore = true) {
        const wasOpen = !el('wt-emoji-drawer').hidden
        el('wt-emoji-drawer').hidden = true; el('wt-emoji-btn').setAttribute('aria-expanded', 'false')
        if (wasOpen && restore) el('wt-emoji-btn').focus()
      }
      function avatar(url?: string, name = '') {
        const img = document.createElement('img'); img.className = 'wt-avatar'; img.alt = name
        img.src = resolveCharacterAvatarUrl(url) || DEFAULT_CONTACT_AVATAR
        img.onerror = () => { img.onerror = null; img.src = DEFAULT_CONTACT_AVATAR }; return img
      }
      function titleFor(conv: Conversation) { return conv.title || profileFor(conv).contactName || scopeFor(conv).characterName }
      function notice(message?: string) {
        // Demo mode is a state, not an error: say what it means and offer the fix in place.
        const demo = !message && !data.config.apiKey
        el('wt-notice').textContent = message ?? (demo ? '本地演示模式 · 回复为示例文字' : '')
        el('wt-connect-ai').hidden = !demo
        el('wt-notice-bar').hidden = !el('wt-notice').textContent
      }
      function conversationAvatar(conv: Conversation): HTMLElement {
        if (!isGroup(conv)) return avatar(scopeFor(conv).card?.avatar)
        const { members, columns } = groupAvatarMembers(data, conv)
        const picture = document.createElement('span'); picture.className = 'wt-avatar wt-group-avatar'; picture.dataset.columns = String(columns)
        picture.setAttribute('aria-label', '群头像'); for (const member of members) picture.append(avatar(member.avatar ?? member.card?.avatar))
        return picture
      }
      function renderList() {
        pruneVoices()
        list.replaceChildren()
        const entries = Object.entries(conversations).sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        if (!entries.length) { const empty = document.createElement('p'); empty.className = 'wt-empty'; empty.textContent = '还没有会话。点击右上角 + 添加好友。'; list.append(empty) }
        for (const [key, conv] of entries) {
          const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'wt-conversation'; btn.dataset.conversation = key
          const copy = document.createElement('span'); copy.className = 'wt-conversation-copy'
          const title = document.createElement('span'); title.className = 'wt-conversation-title'; title.textContent = titleFor(conv)
          const preview = document.createElement('span'); preview.className = 'wt-conversation-preview'
          preview.textContent = conversationPreview(conv, isGroup(conv), pending.has(key))
          copy.append(title, preview)
          btn.append(conversationAvatar(conv), copy)
          const meta = document.createElement('span'); meta.className = 'wt-conversation-meta'
          const time = listTime(conv.updatedAt)
          if (time) { const stamp = document.createElement('span'); stamp.className = 'wt-conversation-time'; stamp.textContent = time; meta.append(stamp) }
          if (conv.unreadCount) { const badge = document.createElement('span'); badge.className = 'wt-unread'; badge.textContent = String(conv.unreadCount); badge.setAttribute('aria-label', `${conv.unreadCount} 条未读`); meta.append(badge) }
          if (meta.childElementCount) btn.append(meta)
          btn.onclick = () => openConversation(key); list.append(btn)
        }
      }
      function syncState() {
        const conv = active(); if (!conv) return
        el('wt-contact-name').textContent = titleFor(conv)
        const members = isGroup(conv) ? groupContacts(data, conv) : []
        const states = members.map(member => ({ name: member.name, state: conv.memberStates?.[member.id] }))
        el('wt-inner-thought').textContent = states.length ? states.map(item => item.name + '：' + (item.state?.innerThought || '等待回复')).join('\n') : conv.state.innerThought || '等待角色回复'
        el('wt-current-status').textContent = states.length ? states.map(item => item.name + '：' + (item.state?.currentStatus || '等待回复')).join('\n') : conv.state.currentStatus || '等待角色回复'
        // A group has no single state; summarize the member who updated most recently.
        const latest = states.filter(item => item.state?.currentStatus).sort((a, b) => (b.state!.updatedAt ?? 0) - (a.state!.updatedAt ?? 0))[0]
        el('wt-state-summary').textContent = states.length
          ? `成员状态 · ${latest ? latest.name + '：' + latest.state!.currentStatus : '等待更新'}`
          : `角色状态 · ${conv.state.currentStatus || '等待更新'}`
        const busy = pending.has(activeKey!), progress = pending.progress(activeKey!)
        el('wt-typing-badge').hidden = !busy
        el('wt-typing-badge').textContent = progress ? `${progress.name} 正在输入…（${progress.index + 1}/${progress.total}）` : '对方正在输入…'
        voiceInput.setBusy(busy)
        el('wt-recovery').hidden = !busy && !conv.replyAttempt
        el('wt-cancel-reply').hidden = !busy
        el('wt-retry-reply').hidden = busy || !conv.replyAttempt
        el('wt-reply-error').textContent = conv.replyAttempt?.error ?? ''
        social.sync()
        // Typing, recovery and @ share one compact row so a pending reply does not squeeze the conversation.
        el('wt-chat-status').hidden = el('wt-chat-tools').hidden && el('wt-typing-badge').hidden && el('wt-recovery').hidden
      }
      function openConversation(key: string) {
        if (!conversations[key]) return
        voiceInput.textMode(); saveDraft(); closeDialog(false); closeDrawer(false)
        activeKey = key; data.activeScopeKey = key; conversations[key].unreadCount = 0; renderedKey = null
        navigation.showChat()
        input.value = conversations[key].draft || ''; persist(); renderMessages(); syncState(); notice()
        input.focus({ preventScroll: true })
      }
      function showList() {
        showPage(navigation.page())
        container.querySelector<HTMLElement>('[role=tab][aria-selected=true]')?.focus({ preventScroll: true })
      }
      function showPage(page: WeChatPage) {
        voiceInput.textMode(); saveDraft(); closeDialog(false); closeDrawer(false); activeKey = null
        navigation.show(page); social.sync(); renderList(); renderAddressBook(); notice()
        if (page === 'moments') social.refresh()
      }
      function renderAddressBook() {
        const directory = el('wt-address-book'); directory.replaceChildren()
        const heading = (text: string) => { const h = document.createElement('h2'); h.className = 'wt-directory-heading'; h.textContent = text; directory.append(h) }
        const row = (name: string, detail: string, picture: HTMLElement, open: () => void) => {
          const button = document.createElement('button'); button.type = 'button'; button.className = 'wt-conversation'
          const copy = document.createElement('span'); copy.className = 'wt-conversation-copy'
          const title = document.createElement('span'); title.className = 'wt-conversation-title'; title.textContent = name; copy.append(title)
          if (detail) { const sub = document.createElement('span'); sub.className = 'wt-conversation-preview'; sub.textContent = detail; copy.append(sub) }
          button.append(picture, copy); button.onclick = open; directory.append(button); return button
        }
        heading('群聊')
        const groups = Object.values(conversations).filter(isGroup)
        for (const group of groups) row(group.title, `${group.memberIds.length} 位成员`, conversationAvatar(group), () => openConversation(group.scopeKey!))
        if (!groups.length) { const hint = document.createElement('p'); hint.className = 'wt-hint'; hint.style.padding = '0 14px'; hint.textContent = '点击右上角 + 发起群聊'; directory.append(hint) }
        heading('好友')
        for (const contact of Object.values(data.contacts ?? {}).sort((a, b) => a.name.localeCompare(b.name))) {
          // Like a WeChat signature line: the character's latest known status, when there is one.
          const button = row(contact.name, latestContactState(data, contact.id).currentStatus ?? '', avatar(contact.avatar ?? contact.card?.avatar), () => { const conv = addContactConversation(data, contact); persist(); openConversation(conv.scopeKey!) })
          button.dataset.friend = contact.id
        }
      }
      /** The visual bubble for one message; image and voice controls keep their own caches. */
      function messageBubble(conv: Conversation, msg: ChatMessage, author: string, item: EmojiItem | undefined): HTMLElement {
        if (msg.type === 'voice') return voiceFor(conv, msg, author)
        const bubble = document.createElement('div'); bubble.className = 'wt-bubble'
        if (msg.type === 'text') { bubble.textContent = msg.content; return bubble }
        if (msg.type === 'red_packet') {
          bubble.classList.add('wt-gift'); bubble.textContent = `🧧 ${msg.content}`
          const sub = document.createElement('small'); sub.textContent = msg.note || '微信红包 / 礼物'; bubble.append(sub); return bubble
        }
        if (!item) { bubble.textContent = msg.type === 'image' ? `[图片：${msg.content}]` : `[表情：${msg.content}]`; return bubble }
        const key = JSON.stringify([msg.type, item.file, item.name, item.description])
        let cached = images.get(msg)
        if (!cached || cached.key !== key) {
          const view = createImageMedia(resolveWeChatAssetUrl(item.file), item.name, () => {
            const preview = createImageMedia(view.image.src, item.name); preview.image.id = 'wt-lightbox-img'
            el('wt-lightbox-media').replaceChildren(preview.element)
            el('wt-lightbox-desc').textContent = item.description; showDialog('wt-photo-lightbox', view.element); photoMessage = msg; photoScopeKey = activeKey
          })
          view.element.classList.add('wt-bubble', 'wt-media')
          if (msg.type === 'emoji') view.element.classList.add('wt-emoji')
          cached = { key, element: view.element }; images.set(msg, cached)
        }
        return cached.element
      }
      function messageRow(conv: Conversation, msg: ChatMessage, index: number, media: ReturnType<typeof mediaFor>, profile: ReturnType<typeof profileFor>): HTMLElement {
        const player = msg.sender === 'player', grouped = isGroup(conv) && !player
        const author = player ? profile.playerName || '用户' : msg.authorName || titleFor(conv)
        const card = msg.contactId ? data.contacts?.[msg.contactId]?.card : scopeFor(conv).card
        const avatarUrl = player ? DEFAULT_PLAYER_AVATAR : card?.avatar
        const fromPlayer = msg.emojiSource ? msg.emojiSource === 'player' : player
        const item = msg.type === 'emoji' || msg.type === 'image'
          ? msg.asset ?? (msg.type === 'image' ? media.photo[msg.content] ?? CONTACT_PHOTOS[msg.content] : (fromPlayer ? media.player : media.contact)[msg.content] ?? (fromPlayer ? PLAYER_EMOJIS : CONTACT_EMOJIS)[msg.content])
          : undefined
        const key = JSON.stringify([author, avatarUrl, grouped, msg.type, msg.content, msg.note, item && [item.file, item.name, item.description]])
        let cached = rows.get(msg)
        if (!cached || cached.key !== key) {
          const row = document.createElement('div'); row.className = `wt-message${player ? ' wt-message-player' : ''}`
          row.append(avatar(avatarUrl, author))
          const bubble = messageBubble(conv, msg, author, item)
          if (grouped) { const content = document.createElement('div'); content.className = 'wt-message-content'; const label = document.createElement('span'); label.className = 'wt-message-author'; label.textContent = author; content.append(label, bubble); row.append(content) } else row.append(bubble)
          cached = { key, row }; rows.set(msg, cached)
        }
        const photo = item ? cached.row.querySelector<HTMLElement>('.wt-media') : null
        if (photo) photo.dataset.wtPhoto = String(index)
        return cached.row
      }
      const nearBottom = () => scroll.scrollHeight - scroll.scrollTop - scroll.clientHeight < 48
      /** Whether the reader is at the newest end; rows that open below the log (status, voice, emoji) must not hide it. */
      let pinned = true
      function renderMessages() {
        const conv = active(); if (!conv) return
        pruneVoices()
        // Follow new messages only when the reader is already at the end; otherwise keep their place and offer a jump.
        const same = renderedKey === activeKey, stick = stickNext || !same || nearBottom()
        stickNext = false
        const media = mediaFor(conv), profile = profileFor(conv)
        const next: HTMLElement[] = conv.messages.map((msg, index) => messageRow(conv, msg, index, media, profile))
        if (!next.length) { const empty = document.createElement('p'); empty.className = 'wt-chat-empty'; empty.textContent = isGroup(conv) ? '在群里说点什么吧。' : `给 ${titleFor(conv)} 发条消息吧。`; next.push(empty) }
        const current = [...scroll.children]
        if (current.length <= next.length && current.every((node, index) => node === next[index])) scroll.append(...next.slice(current.length))
        else {
          // Structural change (switch, clear, edited labels): rebuild while keeping focus and reading position.
          const priorPhoto = (document.activeElement as HTMLElement | null)?.dataset.wtPhoto
          const priorControl = document.activeElement instanceof HTMLElement && scroll.contains(document.activeElement)
            && document.activeElement.closest('.wt-voice,.wt-media') ? document.activeElement : null
          const top = scroll.scrollTop
          scroll.replaceChildren(...next)
          if (!stick) scroll.scrollTop = top
          if (priorPhoto) scroll.querySelector<HTMLElement>(`[data-wt-photo="${priorPhoto}"]`)?.focus({ preventScroll: true })
          if (priorControl?.isConnected && scroll.contains(priorControl)) priorControl.focus({ preventScroll: true })
        }
        const added = same && conv.messages.length > renderedCount
        renderedKey = activeKey; renderedCount = conv.messages.length
        if (stick) { scroll.scrollTop = scroll.scrollHeight; jump.hidden = true }
        else if (added) jump.hidden = false
        pinned = nearBottom()
      }
      function renderDrawer() {
        const media = mediaFor(active()), entries = Object.entries(drawerTab === 'player' ? media.player : media.contact)
        el('wt-tab-player').setAttribute('aria-pressed', String(drawerTab === 'player')); el('wt-tab-contact').setAttribute('aria-pressed', String(drawerTab === 'contact'))
        const grid = el('wt-emoji-grid'); grid.replaceChildren()
        if (!entries.length) { const text = document.createElement('p'); text.className = 'wt-hint'; text.style.gridColumn = '1 / -1'; text.textContent = '此表情组未启用。点击“管理”预览并启用表情包，也可添加图库图片。'; grid.append(text) }
        for (const [id, item] of entries) {
          const btn = document.createElement('button'); btn.type = 'button'; btn.title = item.description; btn.setAttribute('aria-label', item.name)
          const img = document.createElement('img'); img.src = resolveWeChatAssetUrl(item.file); img.alt = ''; btn.append(img, document.createTextNode(item.name))
          btn.onclick = () => { closeDrawer(); void send(id, 'emoji', drawerTab) }; grid.append(btn)
        }
      }
      let profileSettings: ReturnType<typeof createProfileSettings> | undefined
      const settingsForm = () => profileSettings ??= createProfileSettings(el('wt-profile-container'), data, persist, {
        packs: () => ctx.getSettings().packs,
        preview: async (profile, signal) => {
          const conv = active(), scope = conv ? scopeFor(conv) : { scopeKey: '', characterName: '所选联系人', externalState: { source: 'none' as const } }
          const memory = await readStoryMemory(ctx, scope, profile, AbortSignal.any([signal, AbortSignal.timeout(15000)]))
          return new WeChatPipeline({ profile }, applyAssetProfile(PLAYER_EMOJIS, 'player', profile), applyAssetProfile(CONTACT_EMOJIS, 'contact', profile), applyAssetProfile(CONTACT_PHOTOS, 'photo', profile))
            .buildSystemPrompt(conv?.state ?? { mood: 0, interest: 0, money: 0, contactLocation: '', playerLocation: '' }, new Date().toLocaleTimeString(), memory) + (memory.memoryWarnings?.length ? '\n读取提示：' + memory.memoryWarnings.join(' ') : '')
        },
      })
      function syncConnection() {
        const model = data.config.model || 'deepseek-chat'
        el('wt-ai-summary').textContent = data.config.apiKey ? `AI 连接 · 已配置 ${model}` : 'AI 连接 · 未连接（本地演示）'
      }
      function openSettings(assets = false, connect = false) {
        showDialog('wt-settings-modal', assets ? el('wt-emoji-btn') : connect ? el('wt-connect-ai') : el('wt-settings-btn'))
        settingsForm().open(active() ? profileCharacterKey(scopeFor(active()!).card) : null, assets)
        social.settings()
        el<HTMLInputElement>('wt-cfg-key').value = data.config.apiKey || ''
        el<HTMLInputElement>('wt-cfg-url').value = data.config.apiUrl || 'https://api.deepseek.com/chat/completions'
        el<HTMLInputElement>('wt-cfg-model').value = data.config.model || 'deepseek-chat'
        el('wt-history-actions').hidden = !active(); el('wt-btn-clear-chat').textContent = '清空此会话记录'; feedback.textContent = ''
        // The connection decides whether anything is generated; show it first and open it until configured.
        syncConnection(); el<HTMLDetailsElement>('wt-ai-settings').open = connect || !data.config.apiKey
        if (connect) el('wt-cfg-key').focus()
      }
      const social = createSocialUI(container, data, ctx, { active, persist, showDialog, closeDialog, openConversation, avatar, input, beforeMention: voiceInput.textMode, beforeGroupEdit: conv => pending.cancel(conv) })
      const navigation = createWeChatNavigation(container, showPage)
      function syncMoments() {
        if (!alive) return
        data.moments = ctx.getAppData<WeChatAppData>()?.moments
        social.refresh()
        const state = background?.status()
        el('wt-moments-feedback').textContent = state?.busy ? '朋友们正在分享近况…' : state?.error || (data.config.apiKey ? '' : '在设置中连接 AI，即可随剧情更新。')
        el<HTMLButtonElement>('wt-refresh-moments').disabled = !!state?.busy
        el('wt-stop-auto-moments').hidden = !state?.busy
      }
      const offMoments = background?.subscribe(syncMoments)
      el('wt-refresh-moments').onclick = () => { if (data.config.autoMoments === false) { el('wt-moments-feedback').textContent = '自动动态已关闭，可在设置中开启或手动查看角色近况。'; return }; void background?.trigger(true) }
      el('wt-stop-auto-moments').onclick = () => background?.cancel()
      el('wt-cancel-reply').onclick = () => { const conv = active(); if (conv) pending.cancel(conv) }
      el('wt-retry-reply').onclick = () => { const conv = active(); if (conv) void pending.retry(conv) }
      async function send(content: string, type: ChatMessage['type'] = 'text', emojiSource: 'player' | 'contact' = 'player', note?: string) {
        const target = active(), key = activeKey
        if (!target || !key || !content.trim()) return
        if (pending.has(key)) { notice('此会话正在回复，可先切换到其他会话。'); return }
        const time = new Date(), media = mediaFor(target)
        const snapshot = type === 'emoji' ? (emojiSource === 'player' ? media.player : media.contact)[content] : undefined
        const player: ChatMessage = { id: safeRandomId(), sender: 'player', type, content: content.trim().slice(0, type === 'red_packet' ? 120 : 8000),
          time: { day: target.currentDay, hour: time.getHours(), minute: time.getMinutes() }, ...(type === 'emoji' ? { emojiSource, asset: snapshot } : {}), ...(note ? { note: note.slice(0, 300) } : {}) }
        const prior = { draft: target.draft, updatedAt: target.updatedAt, replyAttempt: target.replyAttempt }
        target.messages.push(player); target.updatedAt = Date.now(); delete target.replyAttempt
        if (type === 'text' || type === 'voice') { input.value = ''; target.draft = '' }
        try { persist() } catch {
          target.messages.pop(); Object.assign(target, prior)
          if (type === 'text' || type === 'voice') input.value = content
          notice('消息保存失败，请重试。'); return
        }
        if (type === 'voice') voiceInput.sent()
        // Your own message always brings the conversation back to its newest end.
        stickNext = true
        notice(); await pending.send(target, player)
      }

      el('wt-back').onclick = showList
      el('wt-settings-btn').onclick = () => openSettings()
      el('wt-connect-ai').onclick = () => openSettings(false, true)
      scroll.addEventListener('scroll', () => { pinned = nearBottom(); if (pinned) jump.hidden = true }, { passive: true })
      const resize = typeof ResizeObserver === 'function'
        ? new ResizeObserver(() => { if (pinned && activeKey && !el('wt-chat').hidden) scroll.scrollTop = scroll.scrollHeight })
        : undefined
      resize?.observe(scroll)
      jump.onclick = () => { scroll.scrollTop = scroll.scrollHeight; jump.hidden = true; pinned = true; scroll.focus({ preventScroll: true }) }
      el('wt-close-settings').onclick = () => closeDialog(); el('wt-cancel-settings').onclick = () => closeDialog()
      el('wt-close-lightbox').onclick = () => closeDialog(); el('wt-packet-close').onclick = () => closeDialog(); el('wt-close-contacts').onclick = () => closeDialog()
      el('wt-send-btn').onclick = () => { if (!input.hidden) void send(input.value, voiceInput.isVoice() ? 'voice' : 'text') }
      let composing = false
      input.addEventListener('compositionstart', () => { composing = true }); input.addEventListener('compositionend', () => { composing = false })
      input.oninput = () => saveDraft()
      input.onkeydown = event => { if (event.key === 'Enter' && !input.hidden && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) { event.preventDefault(); void send(input.value, voiceInput.isVoice() ? 'voice' : 'text') } }
      el('wt-emoji-btn').onclick = () => { voiceInput.interrupt(); if (!el('wt-emoji-drawer').hidden) { closeDrawer(); return }; closeDialog(false); el('wt-emoji-drawer').hidden = false; el('wt-emoji-btn').setAttribute('aria-expanded', 'true'); renderDrawer(); el(drawerTab === 'player' ? 'wt-tab-player' : 'wt-tab-contact').focus() }
      el('wt-emoji-drawer').onkeydown = event => { if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeDrawer() } }
      el('wt-tab-player').onclick = () => { drawerTab = 'player'; renderDrawer() }; el('wt-tab-contact').onclick = () => { drawerTab = 'contact'; renderDrawer() }
      el('wt-manage-emojis').onclick = () => openSettings(true)
      el('wt-packet-btn').onclick = () => { if (!active()) return; el('wt-packet-target').textContent = `发送给 ${titleFor(active()!)}`; el('wt-packet-feedback').textContent = ''; showDialog('wt-packet-modal', el('wt-packet-btn')); el('wt-custom-amt').focus() }
      el('wt-confirm-packet').onclick = () => {
        const content = el<HTMLInputElement>('wt-custom-amt').value.trim(), note = el<HTMLTextAreaElement>('wt-packet-note').value.trim()
        if (!content) { el('wt-packet-feedback').textContent = '请填写想发送的内容。'; el('wt-custom-amt').focus(); return }
        if (activeKey && pending.has(activeKey)) { el('wt-packet-feedback').textContent = '请等待此联系人回复后再发送。'; return }
        closeDialog(); el<HTMLInputElement>('wt-custom-amt').value = ''; el<HTMLTextAreaElement>('wt-packet-note').value = ''; void send(content, 'red_packet', 'player', note)
      }
      el('wt-btn-save-settings').onclick = () => {
        const previous = data.config, priorScopes = data.profileEditorScopes
        feedback.dataset.kind = ''
        try {
          const config = settingsForm().save(data.config)
          config.autoMoments = el<HTMLInputElement>('wt-auto-moments').checked; config.privateMoments = el<HTMLInputElement>('wt-private-moments').checked
          config.apiKey = el<HTMLInputElement>('wt-cfg-key').value.trim(); config.apiUrl = el<HTMLInputElement>('wt-cfg-url').value.trim(); config.model = el<HTMLInputElement>('wt-cfg-model').value.trim()
          if (config.apiKey) {
            const url = new URL(config.apiUrl || '')
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请输入有效的 HTTP(S) API 地址')
            if (!config.model) throw new Error('请填写模型名称')
          }
          data.config = config; persist(); feedback.textContent = '设置已保存 ✓ 下一条消息开始使用。'; ctx.toast('success', '微信设置已保存')
          syncConnection()
          if (config.autoMoments === false) background?.cancel()
          else void background?.trigger()
          if (active()) { syncState(); renderMessages() } else renderList()
          notice()
        } catch (error) { data.config = previous; data.profileEditorScopes = priorScopes; feedback.dataset.kind = 'error'; feedback.textContent = `未保存：${(error as Error).message}`; ctx.toast('error', feedback.textContent) }
      }
      el('wt-btn-clear-chat').onclick = () => {
        feedback.dataset.kind = ''
        const conv = active(); if (!conv || !activeKey) return
        if (el('wt-btn-clear-chat').textContent !== '再次点击确认清空') { el('wt-btn-clear-chat').textContent = '再次点击确认清空'; feedback.textContent = '将删除此微信会话的消息、草稿和角色状态。'; return }
        pending.cancel(conv); delete conv.replyAttempt
        if (isGroup(conv)) for (const state of Object.values(conv.memberStates)) { delete state.innerThought; delete state.currentStatus }
        conv.messages = []; conv.draft = ''; conv.unreadCount = 0; delete conv.state.innerThought; delete conv.state.currentStatus
        input.value = ''; persist(); renderMessages(); syncState(); feedback.textContent = '此会话记录已清空。'; el('wt-btn-clear-chat').textContent = '清空此会话记录'
      }
      function renderContacts() {
        const options = el('wt-contact-options'), search = el<HTMLInputElement>('wt-contact-search').value.trim().toLocaleLowerCase(); options.replaceChildren()
        const contacts = listContacts(ctx).filter(item => item.name.toLocaleLowerCase().includes(search))
        if (!contacts.length) { options.textContent = '没有匹配的角色卡。可先在酒馆导入角色，再回到这里。'; return }
        for (const item of contacts) {
          const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'wt-conversation'; btn.dataset.contact = item.id
          const label = document.createElement('span'); label.textContent = item.name
          const identity = document.createElement('small'); identity.className = 'wt-conversation-preview'; identity.textContent = item.avatar || ''; label.append(identity)
          btn.append(avatar(item.avatar), label); btn.onclick = async () => {
            const request = ++selecting; btn.disabled = true; el('wt-contact-feedback').textContent = '正在读取角色卡…'
            try {
              const loaded = await loadContact(ctx, item.id)
              if (!alive || request !== selecting || currentDialog?.id !== 'wt-contacts-modal') return
              const conv = addContactConversation(data, loaded); persist(); openConversation(conv.scopeKey!)
            } catch (error) { if (alive && request === selecting) el('wt-contact-feedback').textContent = (error as Error).message }
            finally { if (alive && btn.isConnected) btn.disabled = false }
          }; options.append(btn)
        }
      }
      el('wt-add-contact').onclick = () => { el<HTMLInputElement>('wt-contact-search').value = ''; el('wt-contact-feedback').textContent = ''; showDialog('wt-contacts-modal', el('wt-plus')); renderContacts() }
      el<HTMLInputElement>('wt-contact-search').oninput = renderContacts
      const unsubscribe = ctx.onCharacterChanged(() => {
        if (!alive) return
        social.cancelMoment()
        for (const conv of Object.values(conversations)) if (pending.has(conv.scopeKey!)) pending.cancel(conv)
        if (currentDialog?.id === 'wt-contacts-modal') renderContacts()
      })
      navigation.show('chats'); renderList(); renderAddressBook(); notice(); syncMoments(); void background?.trigger()
      // The shell's ‹ and Escape step back like a phone: close the open layer first, then leave the chat.
      stepBack = () => {
        if (!el('wt-plus-menu').hidden) { navigation.closeMenu(true); return true }
        if (currentDialog) { closeDialog(); return true }
        if (!el('wt-emoji-drawer').hidden) { closeDrawer(); return true }
        if (activeKey) { showList(); return true }
        return false
      }
      cleanup = () => {
        stepBack = undefined; resize?.disconnect()
        voiceInput.dispose(); saveDraft(); alive = false; selecting++; closeDialog(false); unsubscribe()
        pending.destroy(); social.destroy()
        navigation.destroy(); offMoments?.()
        for (const entries of voices.values()) for (const entry of entries.values()) entry.view.dispose()
        voices.clear()
      }
    },
    unmount() { cleanup?.(); cleanup = undefined },
    back() { return stepBack?.() ?? false },
  }
}
