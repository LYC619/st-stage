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
import { isGroup, groupContacts } from './groups'
import { createReplyController } from './replies'
import { createSocialUI } from './social-ui'
import { createVoiceBubble, type VoiceBubbleController } from './voice'
import { WECHAT_VIEW } from './view'
import type { Conversation, ChatMessage, WeChatAppData } from './types'
export { getScopedConversation } from './legacy-conversation'

function initialize(host: AppHost, entering = false): WeChatAppData {
  const existing = host.getAppData<WeChatAppData>()
  const data: WeChatAppData = existing ?? { config: { profile: { preset: 'general', contextMessageCount: 0 } } }
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
  return {
    id: 'wechat-sister', name: '微信', icon: '💬', order: 25, fullbleed: true,
    setup(host) { initialize(host) },
    mount(container: HTMLElement, ctx: PhoneAppContext) {
      cleanup?.()
      const data = initialize(ctx, true), conversations = data.conversations!
      let alive = true, activeKey: string | null = null, drawerTab: 'player' | 'contact' = 'player', selecting = 0
      let voiceMode = false
      let dialogFocus: ReturnType<typeof manageDialogFocus> | null = null
      let currentDialog: HTMLElement | null = null
      let photoMessage: ChatMessage | undefined, photoScopeKey: string | null = null
      container.classList.add('so-phone-app-fullbleed'); container.innerHTML = WECHAT_VIEW
      const el = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>(`#${id}`)!
      const input = el<HTMLInputElement>('wt-input-text'), list = el('wt-conversations'), scroll = el('wt-scroll')
      // Scope by the actual conversation/message, including legacy messages without IDs.
      const voices = new Map<Conversation, Map<ChatMessage, { text: string; author: string; view: VoiceBubbleController }>>()
      function pruneVoices() {
        const retained = new Set(Object.values(conversations))
        for (const [conv, entries] of voices) {
          const messages = new Set(retained.has(conv) ? conv.messages.filter(message => message.type === 'voice') : [])
          for (const [message, entry] of entries) if (!messages.has(message)) { entry.view.dispose(); entries.delete(message) }
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
      const pending = createReplyController(data, { persist, activeKey: () => activeKey, report: message => ctx.toast('error', message),
        changed: key => { if (!alive) return; if (activeKey === key) { renderMessages(); syncState() } else renderList() } })
      function saveDraft() { const conv = active(); if (conv) { conv.draft = input.value; persist() } }
      function closeDialog(restore = true) {
        if (currentDialog) social.dialogClosed(currentDialog.id)
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
        el('wt-notice').textContent = message ?? (data.config.apiKey ? '平行世界 · 独立微信会话' : '本地演示模式 · 可在右上角设置中连接 AI')
      }
      function renderList() {
        pruneVoices()
        list.replaceChildren()
        const entries = Object.entries(conversations).sort(([, a], [, b]) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0))
        if (!entries.length) { const empty = document.createElement('p'); empty.className = 'wt-empty'; empty.textContent = '还没有会话。点击右上角“新会话”，选择想联系的角色。'; list.append(empty) }
        for (const [key, conv] of entries) {
          const btn = document.createElement('button'); btn.type = 'button'; btn.className = 'wt-conversation'; btn.dataset.conversation = key
          const copy = document.createElement('span'); copy.className = 'wt-conversation-copy'
          const title = document.createElement('span'); title.className = 'wt-conversation-title'; title.textContent = titleFor(conv)
          const preview = document.createElement('span'); preview.className = 'wt-conversation-preview'
          const last = conv.messages.at(-1)
          preview.textContent = pending.has(key) ? '正在回复…' : conv.draft ? `[草稿] ${conv.draft}` : last ? (last.type === 'voice' ? '[语音]' : last.type === 'emoji' ? '[表情]' : last.type === 'image' ? '[图片]' : last.type === 'red_packet' ? `[红包] ${last.content}` : last.content) : '开始聊天'
          if (!conv.contactId && !isGroup(conv)) preview.textContent = `旧会话${conv.chatId ? ` · ${conv.chatId}` : ''} · ${preview.textContent}`
          copy.append(title, preview)
          let picture: HTMLElement = avatar(scopeFor(conv).card?.avatar)
          if (isGroup(conv)) { picture = document.createElement('span'); picture.className = 'wt-avatar wt-group-avatar'; picture.setAttribute('aria-label', '群头像'); for (const member of groupContacts(data, conv).slice(0,9)) picture.append(avatar(member.avatar ?? member.card?.avatar)) }
          btn.append(picture, copy)
          if (conv.unreadCount) { const badge = document.createElement('span'); badge.className = 'wt-unread'; badge.textContent = String(conv.unreadCount); badge.setAttribute('aria-label', `${conv.unreadCount} 条未读`); btn.append(badge) }
          btn.onclick = () => openConversation(key); list.append(btn)
        }
      }
      function syncState() {
        const conv = active(); if (!conv) return
        el('wt-contact-name').textContent = titleFor(conv)
        const states = isGroup(conv) ? groupContacts(data, conv).map(member => ({ name: member.name, state: conv.memberStates[member.id] })) : []
        el('wt-inner-thought').textContent = states.length ? states.map(item => item.name + '：' + (item.state?.innerThought || '等待回复')).join('\n') : conv.state.innerThought || '等待角色回复'
        el('wt-current-status').textContent = states.length ? states.map(item => item.name + '：' + (item.state?.currentStatus || '等待回复')).join('\n') : conv.state.currentStatus || '等待角色回复'
        el('wt-state-summary').textContent = `角色状态 · ${conv.state.currentStatus || '等待更新'}`
        el('wt-typing-badge').hidden = !pending.has(activeKey!)
        const busy = pending.has(activeKey!)
        el<HTMLButtonElement>('wt-send-btn').disabled = busy
        el('wt-recovery').hidden = !busy && !conv.replyAttempt
        el('wt-cancel-reply').hidden = !busy
        el('wt-retry-reply').hidden = busy || !conv.replyAttempt
        el('wt-reply-error').textContent = conv.replyAttempt?.error ?? ''
        social.sync()
      }
      function openConversation(key: string) {
        if (!conversations[key]) return
        saveDraft(); closeDialog(false); closeDrawer(false)
        activeKey = key; data.activeScopeKey = key; conversations[key].unreadCount = 0
        list.hidden = true; el('wt-chat').hidden = false; el('wt-back').hidden = false; el('wt-add-contact').hidden = true
        input.value = conversations[key].draft || ''; persist(); renderMessages(); syncState(); notice()
        input.focus({ preventScroll: true })
      }
      function showList() {
        saveDraft(); closeDialog(false); closeDrawer(false); activeKey = null
        list.hidden = false; el('wt-chat').hidden = true; el('wt-back').hidden = true; el('wt-add-contact').hidden = false
        el('wt-contact-name').textContent = '微信'; social.sync(); renderList(); notice()
        list.querySelector<HTMLButtonElement>('button')?.focus({ preventScroll: true })
      }
      function renderMessages() {
        const conv = active(); if (!conv) return
        pruneVoices()
        const priorPhoto = (document.activeElement as HTMLElement | null)?.dataset.wtPhoto
        const priorVoice = document.activeElement instanceof HTMLElement && scroll.contains(document.activeElement)
          && document.activeElement.closest('.wt-voice') ? document.activeElement : null
        scroll.replaceChildren(); const media = mediaFor(conv), profile = profileFor(conv)
        for (const [index, msg] of conv.messages.entries()) {
          const player = msg.sender === 'player', row = document.createElement('div'); row.className = `wt-message${player ? ' wt-message-player' : ''}`
          const author = player ? profile.playerName || '用户' : msg.authorName || titleFor(conv)
          const card = msg.contactId ? data.contacts?.[msg.contactId]?.card : scopeFor(conv).card
          row.append(avatar(player ? DEFAULT_PLAYER_AVATAR : card?.avatar, author))
          let bubble: HTMLElement = document.createElement('div'); bubble.className = 'wt-bubble'
          if (msg.type === 'text') bubble.textContent = msg.content
          else if (msg.type === 'voice') bubble = voiceFor(conv, msg, author)
          else if (msg.type === 'red_packet') {
            bubble.classList.add('wt-gift'); bubble.textContent = `🧧 ${msg.content}`
            const sub = document.createElement('small'); sub.textContent = msg.note || '微信红包 / 礼物'; bubble.append(sub)
          } else {
            const fromPlayer = msg.emojiSource ? msg.emojiSource === 'player' : player
            const item = msg.asset ?? (msg.type === 'image' ? media.photo[msg.content] ?? CONTACT_PHOTOS[msg.content] : (fromPlayer ? media.player : media.contact)[msg.content] ?? (fromPlayer ? PLAYER_EMOJIS : CONTACT_EMOJIS)[msg.content])
            if (item) {
              bubble = document.createElement('button'); bubble.className = 'wt-bubble wt-media'; bubble.dataset.wtPhoto = String(index); bubble.setAttribute('aria-label', `查看图片：${item.name}`)
              const img = document.createElement('img'); img.src = resolveWeChatAssetUrl(item.file); img.alt = item.name; bubble.append(img)
              bubble.onclick = () => { el<HTMLImageElement>('wt-lightbox-img').src = img.src; el<HTMLImageElement>('wt-lightbox-img').alt = item.name; el('wt-lightbox-desc').textContent = item.description; showDialog('wt-photo-lightbox', bubble); photoMessage = msg; photoScopeKey = activeKey }
            } else bubble.textContent = msg.type === 'image' ? `[图片：${msg.content}]` : `[表情：${msg.content}]`
          }
          if (isGroup(conv) && !player) { const content = document.createElement('div'); content.className = 'wt-message-content'; const label = document.createElement('span'); label.className = 'wt-message-author'; label.textContent = author; content.append(label, bubble); row.append(content) } else row.append(bubble)
          scroll.append(row)
        }
        scroll.scrollTop = scroll.scrollHeight
        if (priorPhoto) scroll.querySelector<HTMLElement>(`[data-wt-photo="${priorPhoto}"]`)?.focus({ preventScroll: true })
        if (priorVoice?.isConnected && scroll.contains(priorVoice)) priorVoice.focus({ preventScroll: true })
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
      const profileSettings = createProfileSettings(el('wt-profile-container'), data, persist, {
        packs: () => ctx.getSettings().packs,
        preview: profile => {
          const conv = active(), scope = conv ? scopeFor(conv) : { scopeKey: '', characterName: '所选联系人', externalState: { source: 'none' as const } }
          return new WeChatPipeline({ profile }, applyAssetProfile(PLAYER_EMOJIS, 'player', profile), applyAssetProfile(CONTACT_EMOJIS, 'contact', profile), applyAssetProfile(CONTACT_PHOTOS, 'photo', profile))
            .buildSystemPrompt(conv?.state ?? { mood: 0, interest: 0, money: 0, contactLocation: '', playerLocation: '' }, new Date().toLocaleTimeString(), scope)
        },
      })
      function openSettings(assets = false) {
        showDialog('wt-settings-modal', assets ? el('wt-emoji-btn') : el('wt-settings-btn'))
        profileSettings.open(active() ? profileCharacterKey(scopeFor(active()!).card) : null, assets)
        el<HTMLInputElement>('wt-cfg-key').value = data.config.apiKey || ''
        el<HTMLInputElement>('wt-cfg-url').value = data.config.apiUrl || 'https://api.deepseek.com/chat/completions'
        el<HTMLInputElement>('wt-cfg-model').value = data.config.model || 'deepseek-chat'
        el('wt-history-actions').hidden = !active(); el('wt-btn-clear-chat').textContent = '清空此会话记录'; feedback.textContent = ''
      }
      const social = createSocialUI(container, data, ctx, { active, persist, showDialog, closeDialog, openConversation, avatar, input, beforeGroupEdit: conv => pending.cancel(conv) })
      el('wt-cancel-reply').onclick = () => { const conv = active(); if (conv) pending.cancel(conv) }
      el('wt-retry-reply').onclick = () => { const conv = active(); if (conv) void pending.retry(conv) }
      el('wt-voice-mode').onclick = () => {
        voiceMode = !voiceMode; el('wt-voice-mode').setAttribute('aria-pressed', String(voiceMode))
        input.placeholder = voiceMode ? '输入语音文字…' : '发消息…'
        input.setAttribute('aria-label', voiceMode ? '语音文字' : '消息'); input.focus()
      }
      async function send(content: string, type: ChatMessage['type'] = 'text', emojiSource: 'player' | 'contact' = 'player', note?: string) {
        const target = active(), key = activeKey
        if (!target || !key || !content.trim()) return
        if (pending.has(key)) { notice('此会话正在回复，可先切换到其他会话。'); return }
        const time = new Date(), media = mediaFor(target)
        const snapshot = type === 'emoji' ? (emojiSource === 'player' ? media.player : media.contact)[content] : undefined
        const player: ChatMessage = { id: crypto.randomUUID(), sender: 'player', type, content: content.trim().slice(0, type === 'red_packet' ? 120 : 8000),
          time: { day: target.currentDay, hour: time.getHours(), minute: time.getMinutes() }, ...(type === 'emoji' ? { emojiSource, asset: snapshot } : {}), ...(note ? { note: note.slice(0, 300) } : {}) }
        const prior = { draft: target.draft, updatedAt: target.updatedAt, replyAttempt: target.replyAttempt }
        target.messages.push(player); target.updatedAt = Date.now(); delete target.replyAttempt
        if (type === 'text' || type === 'voice') { input.value = ''; target.draft = '' }
        try { persist() } catch {
          target.messages.pop(); Object.assign(target, prior)
          if (type === 'text' || type === 'voice') input.value = content
          notice('消息保存失败，请重试。'); return
        }
        notice(); await pending.send(target, player)
      }

      el('wt-back').onclick = showList
      el('wt-settings-btn').onclick = () => openSettings()
      el('wt-close-settings').onclick = () => closeDialog(); el('wt-cancel-settings').onclick = () => closeDialog()
      el('wt-close-lightbox').onclick = () => closeDialog(); el('wt-packet-close').onclick = () => closeDialog(); el('wt-close-contacts').onclick = () => closeDialog()
      el('wt-send-btn').onclick = () => { void send(input.value, voiceMode ? 'voice' : 'text') }
      let composing = false
      input.addEventListener('compositionstart', () => { composing = true }); input.addEventListener('compositionend', () => { composing = false })
      input.oninput = () => saveDraft()
      input.onkeydown = event => { if (event.key === 'Enter' && !event.shiftKey && !event.isComposing && !composing && event.keyCode !== 229) { event.preventDefault(); void send(input.value, voiceMode ? 'voice' : 'text') } }
      el('wt-emoji-btn').onclick = () => { if (!el('wt-emoji-drawer').hidden) { closeDrawer(); return }; closeDialog(false); el('wt-emoji-drawer').hidden = false; el('wt-emoji-btn').setAttribute('aria-expanded', 'true'); renderDrawer(); el(drawerTab === 'player' ? 'wt-tab-player' : 'wt-tab-contact').focus() }
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
          const config = profileSettings.save(data.config)
          config.apiKey = el<HTMLInputElement>('wt-cfg-key').value.trim(); config.apiUrl = el<HTMLInputElement>('wt-cfg-url').value.trim(); config.model = el<HTMLInputElement>('wt-cfg-model').value.trim()
          if (config.apiKey) {
            const url = new URL(config.apiUrl || '')
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error('请输入有效的 HTTP(S) API 地址')
            if (!config.model) throw new Error('请填写模型名称')
          }
          data.config = config; persist(); feedback.textContent = '设置已保存 ✓ 下一条消息开始使用。'; ctx.toast('success', '微信设置已保存')
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
      el('wt-add-contact').onclick = () => { el<HTMLInputElement>('wt-contact-search').value = ''; el('wt-contact-feedback').textContent = ''; showDialog('wt-contacts-modal', el('wt-add-contact')); renderContacts() }
      el<HTMLInputElement>('wt-contact-search').oninput = renderContacts
      const unsubscribe = ctx.onCharacterChanged(() => { if (alive && currentDialog?.id === 'wt-contacts-modal') renderContacts() })
      renderList(); notice()
      cleanup = () => {
        saveDraft(); alive = false; selecting++; closeDialog(false); unsubscribe()
        pending.destroy(); social.destroy()
        for (const entries of voices.values()) for (const entry of entries.values()) entry.view.dispose()
        voices.clear()
      }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
