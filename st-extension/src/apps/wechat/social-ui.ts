import type { AppHost } from '../../../../core/phone-registry'
import { listContacts, loadContact } from './conversations'
import { groupContacts, isGroup, saveGroup, mentionToken } from './groups'
import { addMoment, DEFAULT_MOMENTS_PROMPT } from './moments'
import { generateMoment } from './moments-controller'
import { resolveWeChatAssetUrl } from './assets'
import { createImageMedia } from './image-media'
import { momentTime } from './list-format'
import type { Contact, Conversation, Group, Moment, WeChatAppData } from './types'

export function createSocialUI(container: HTMLElement, data: WeChatAppData, host: AppHost, options: {
  active: () => Conversation | undefined
  persist: () => void
  showDialog: (id: string, opener: HTMLElement) => void
  closeDialog: () => void
  openConversation: (key: string) => void
  avatar: (url?: string, name?: string) => HTMLElement
  beforeGroupEdit: (conv: Conversation) => void
  input: HTMLInputElement
  beforeMention: () => void
}) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) => container.querySelector<T>('#' + id)!
  let alive = true, generation = 0, editing: Group | undefined, momentController: AbortController | undefined
  const selected = new Set<string>()
  const catalogue = () => [...new Map([...Object.values(data.contacts ?? {}).filter(item => item.kind !== 'story'), ...listContacts(host)].map(item => [item.id, item])).values()]
  function members() {
    const list = el('wt-group-options'); list.replaceChildren()
    for (const item of catalogue()) {
      const label = document.createElement('label'); label.className = 'wt-member-choice'
      const check = document.createElement('input'); check.type = 'checkbox'; check.checked = selected.has(item.id); check.value = item.id
      check.onchange = () => { if (check.checked) selected.add(item.id); else selected.delete(item.id) }
      label.append(check, options.avatar(item.avatar ?? item.card?.avatar), document.createTextNode(item.name)); list.append(label)
    }
    if (!list.childElementCount) list.textContent = '请先在酒馆导入角色卡。'
  }
  function openGroup(existing?: Group) {
    generation++; editing = existing; selected.clear()
    for (const id of existing?.memberIds ?? []) selected.add(id)
    el<HTMLInputElement>('wt-group-title').value = existing?.title ?? ''
    el('wt-group-feedback').textContent = ''
    el<HTMLButtonElement>('wt-save-group').disabled = false
    members(); options.showDialog('wt-group-modal', el(existing ? 'wt-group-edit' : 'wt-plus'))
  }
  el('wt-new-group').onclick = () => openGroup()
  el('wt-group-edit').onclick = () => { const conv = options.active(); if (conv && isGroup(conv)) openGroup(conv) }
  el('wt-close-group').onclick = () => { generation++; options.closeDialog() }
  el('wt-save-group').onclick = async () => {
    const request = ++generation, existing = editing, title = el<HTMLInputElement>('wt-group-title').value
    const ids = [...selected], button = el<HTMLButtonElement>('wt-save-group'); button.disabled = true
    try {
      if (ids.length < 2) throw new Error('请选择至少两位群成员')
      const available = new Map(catalogue().map(item => [item.id, item]))
      const loaded = await Promise.all(ids.map(id => listContacts(host).some(item => item.id === id) ? loadContact(host, id) : Promise.resolve(available.get(id)!)))
      if (!alive || request !== generation || el('wt-group-modal').hidden) return
      if (existing) options.beforeGroupEdit(existing)
      const oldContacts = { ...data.contacts }, oldGroup = existing ? structuredClone(existing) : undefined
      const group = saveGroup(data, title, loaded, existing)
      try { options.persist() } catch (error) {
        data.contacts = oldContacts
        if (existing && oldGroup) Object.assign(existing, oldGroup)
        else delete data.conversations![group.scopeKey!]
        throw error
      }
      options.closeDialog(); options.openConversation(group.scopeKey!)
    } catch (error) { if (alive && request === generation) el('wt-group-feedback').textContent = (error as Error).message }
    finally { if (alive && request === generation) button.disabled = false }
  }
  el<HTMLSelectElement>('wt-mention').onchange = event => {
    const select = event.currentTarget as HTMLSelectElement, conv = options.active()
    if (!conv || !select.value) return
    options.beforeMention()
    const item = data.contacts?.[select.value]
    options.input.value += (options.input.value ? ' ' : '') + (item ? mentionToken(item) : '@所有人') + ' '
    conv.draft = options.input.value; options.persist(); select.value = ''; options.input.focus()
  }
  function momentArticle(moment: Moment) {
      // WeChat layout: avatar column, then name, text, media and a footer with time and the like action.
      const article = document.createElement('article'); article.className = 'wt-moment'; article.dataset.moment = moment.id
      const body = document.createElement('div'); body.className = 'wt-moment-body'
      const name = document.createElement('strong'); name.className = 'wt-moment-name'; name.textContent = moment.authorName
      const text = document.createElement('p'); text.textContent = moment.text
      const time = document.createElement('time'); time.dateTime = new Date(moment.createdAt).toISOString(); time.textContent = momentTime(moment.createdAt)
      article.append(options.avatar(moment.avatar, ''), body)
      body.append(name, text)
      if (moment.image) {
        const media = createImageMedia(resolveWeChatAssetUrl(moment.image.file), moment.image.description || moment.image.name)
        media.element.classList.add('wt-moment-media'); media.image.className = 'wt-moment-image'; body.append(media.element)
      }
      if (moment.visibility === 'private') { const badge = document.createElement('span'); badge.className = 'wt-moment-private'; badge.textContent = '🔒 仅你可见'; body.append(badge) }
      const like = document.createElement('button'); like.type = 'button'; like.className = 'wt-moment-like'
      const updateLike = () => {
        const label = moment.likedByPlayer ? '已赞' : '点赞'
        like.textContent = (moment.likedByPlayer ? '♥ ' : '♡ ') + label
        like.setAttribute('aria-pressed', String(moment.likedByPlayer))
        like.setAttribute('aria-label', like.textContent + '：' + moment.authorName + '的动态')
      }
      updateLike()
      like.onclick = () => {
        moment.likedByPlayer = !moment.likedByPlayer
        try { options.persist(); updateLike() }
        catch { moment.likedByPlayer = !moment.likedByPlayer; el('wt-moments-feedback').textContent = '点赞未保存，请重试。' }
      }
      const footer = document.createElement('div'); footer.className = 'wt-moment-footer'; footer.append(time, like)
      body.append(footer); return article
  }
  function renderMoments() {
    const feed = el('wt-moments-feed')
    const present = new Set([...feed.querySelectorAll<HTMLElement>('[data-moment]')].map(node => node.dataset.moment))
    if (!data.moments?.length && !feed.childElementCount) { const empty = document.createElement('p'); empty.className = 'wt-empty'; empty.dataset.momentsEmpty = ''; empty.textContent = data.config.apiKey ? '朋友圈还静悄悄的，点右上角「刷新近况」看看大家都在忙什么吧。' : '在设置里连上 AI 后，朋友们就会随着故事推进在这里晒日常啦。'; feed.append(empty) }
    for (const moment of [...(data.moments ?? [])].reverse()) if (!present.has(moment.id)) prependMoment(moment)
  }
  function prependMoment(moment: Moment) {
    const feed = el('wt-moments-feed'), top = feed.getBoundingClientRect().top
    const retained = new Set(data.moments?.map(item => item.id))
    const surviving = [...feed.querySelectorAll<HTMLElement>('[data-moment]')].filter(node => retained.has(node.dataset.moment!))
    const anchor = feed.scrollTop > 0 ? surviving.find(node => node.getBoundingClientRect().bottom > top) ?? surviving.at(-1) : undefined
    const offset = anchor ? anchor.getBoundingClientRect().top - top : undefined
    feed.querySelector('[data-moments-empty]')?.remove()
    feed.prepend(momentArticle(moment))
    for (const node of feed.querySelectorAll<HTMLElement>('[data-moment]')) if (!retained.has(node.dataset.moment!)) {
      if (node.contains(document.activeElement)) feed.focus({ preventScroll: true })
      node.remove()
    }
    // Image slots reserve their height, including error/retry, so late loads cannot move this anchor.
    if (anchor && offset !== undefined) feed.scrollTop += anchor.getBoundingClientRect().top - feed.getBoundingClientRect().top - offset
    else feed.scrollTop = 0
  }
  function settings() {
    const select = el<HTMLSelectElement>('wt-moments-author'); select.replaceChildren()
    for (const item of catalogue()) select.add(new Option(item.name, item.id))
    el<HTMLTextAreaElement>('wt-moments-prompt').value = data.config.momentsPrompt || DEFAULT_MOMENTS_PROMPT
    el<HTMLDetailsElement>('wt-moments-composer').open = false
    el<HTMLInputElement>('wt-auto-moments').checked = data.config.autoMoments !== false
    el<HTMLInputElement>('wt-private-moments').checked = data.config.privateMoments !== false
  }
  function report(message: string) { el('wt-moments-feedback').textContent = message; el('wt-manual-moment-feedback').textContent = message }
  function cancelMoment() {
    momentController?.abort(); momentController = undefined
    el<HTMLButtonElement>('wt-generate-moment').disabled = false; el('wt-cancel-moment').hidden = true
  }
  el('wt-cancel-moment').onclick = () => { cancelMoment(); report('已取消，可重新生成。') }
  el('wt-reset-moments-prompt').onclick = () => { el<HTMLTextAreaElement>('wt-moments-prompt').value = DEFAULT_MOMENTS_PROMPT }
  el('wt-save-moments-prompt').onclick = () => {
    const prior = data.config.momentsPrompt
    data.config.momentsPrompt = el<HTMLTextAreaElement>('wt-moments-prompt').value.trim().slice(0, 8000)
    try { options.persist(); report('动态提示词已保存。') }
    catch { data.config.momentsPrompt = prior; report('提示词未保存，请重试。') }
  }
  el('wt-generate-moment').onclick = async () => {
    if (momentController) return
    const id = el<HTMLSelectElement>('wt-moments-author').value
    if (!id) { report('请先添加联系人。'); return }
    const controller = new AbortController(); momentController = controller
    el<HTMLButtonElement>('wt-generate-moment').disabled = true; el('wt-cancel-moment').hidden = false
    report('正在生成动态…')
    const timeout = setTimeout(() => { if (momentController === controller) { cancelMoment(); report('生成超时，请重试。') } }, 60000)
    try {
      const item: Contact | undefined = catalogue().find(contact => contact.id === id)
      if (!item) throw new Error('联系人已不存在，请重新选择。')
      if (!alive || controller.signal.aborted) return
      const { result: moment, state, contact, storyKey, warnings } = await generateMoment(host, data, item, controller.signal)
      if (!alive || controller.signal.aborted || momentController !== controller) return
      const previous = data.moments
      const added = addMoment(data, contact, moment.text, moment.image, state, moment.visibility, storyKey)
      try { options.persist() } catch (error) { data.moments = previous; throw error }
      prependMoment(added)
      report(warnings.length ? '新动态已发布。' + warnings.join(' ') : '新动态已发布。')
    } catch (error) { if (alive && momentController === controller) report((error as Error).message) }
    finally { clearTimeout(timeout); if (momentController === controller) cancelMoment() }
  }
  settings(); renderMoments()
  return {
    settings, cancelMoment, refresh: renderMoments,
    dialogClosed(id: string) {
      if (id === 'wt-group-modal') generation++
      if (id === 'wt-settings-modal') cancelMoment()
    },
    sync() {
      const conv = options.active(), group = conv && isGroup(conv) ? conv : undefined
      el('wt-group-edit').hidden = !group
      el('wt-chat-tools').hidden = !group
      const select = el<HTMLSelectElement>('wt-mention'); select.hidden = !group; select.replaceChildren(new Option('@ 提及成员', ''), new Option('所有人', '*'))
      if (group) for (const item of groupContacts(data, group)) select.add(new Option(item.name, item.id))
    },
    destroy() { alive = false; generation++; cancelMoment() },
  }
}
