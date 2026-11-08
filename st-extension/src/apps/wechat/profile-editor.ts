import { normalizeProfile, safeAssetUrl, type WeChatProfile } from './profile'
import { PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS } from './manifest-data'
import { resolveWeChatAssetUrl } from './assets'
import { DEFAULT_REPLY_PROMPT, DEFAULT_STATE_PROMPT, DEFAULT_FORMAT_PROMPT } from './prompts'
import type { SpritePack } from '../../../../core/types'
import type { EmojiItem } from './types'

export function createProfileEditor(parent: HTMLElement, packs: () => SpritePack[] = () => []) {
  const section = document.createElement('section'); section.className = 'wt-profile-editor'
  parent.insertBefore(section, parent.querySelector('#wt-settings-actions'))
  const field = <T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(label: string, input: T, target = section): T => {
    const wrap = document.createElement('label'); wrap.className = 'wt-field'; wrap.append(document.createTextNode(label), input)
    input.setAttribute('aria-label', label); target.append(wrap); return input
  }
  function details(title: string) {
    const el = document.createElement('details'), summary = document.createElement('summary')
    summary.textContent = title; el.append(summary); section.append(el); return el
  }
  function button(label: string, target: HTMLElement, run: () => void) {
    const el = document.createElement('button'); el.type = 'button'; el.textContent = label; el.onclick = run; target.append(el); return el
  }
  const player = field('用户称呼（可留空）', document.createElement('input')); player.maxLength = 60
  const contact = field('联系人显示名（留空跟随角色卡）', document.createElement('input')); contact.maxLength = 60
  const scene = field('场景补充（留空遵循角色卡）', document.createElement('textarea')); scene.rows = 3; scene.maxLength = 2000
  const opening = field('新会话开场白（不改已有记录）', document.createElement('textarea')); opening.maxLength = 500; opening.rows = 2
  const memoryPanel = details('主线记忆与世界书')
  const count = field('读取最近主聊天条数（0 为关闭，最多 20）', document.createElement('input'), memoryPanel)
  count.type = 'number'; count.min = '0'; count.max = '20'; count.step = '1'
  const lore = field('读取绑定及全局启用的世界书', document.createElement('input'), memoryPanel); lore.type = 'checkbox'
  const memoryNote = document.createElement('p'); memoryNote.className = 'wt-hint'; memoryNote.textContent = '主聊天作为故事背景供微信聊天和朋友圈使用。世界书按常驻或关键词筛选；微信消息和角色状态仍独立保存。'; memoryPanel.append(memoryNote)
  const promptPanel = details('提示词 · 查看、编辑与恢复默认')
  const promptNote = document.createElement('p'); promptNote.className = 'wt-hint'
  promptNote.textContent = '花括号填入联系人角色卡、称呼、场景、状态和素材。启用的主线背景与世界书会加入请求；保存后下一次发送生效。'
  promptPanel.append(promptNote)
  const prompts = [
    ['replyPrompt', '聊天提示词', DEFAULT_REPLY_PROMPT, 12000],
    ['statePrompt', '状态提示词', DEFAULT_STATE_PROMPT, 8000],
    ['formatPrompt', '输出格式提示词', DEFAULT_FORMAT_PROMPT, 4000],
  ] as const
  const promptInputs = {} as Record<'replyPrompt' | 'statePrompt' | 'formatPrompt', HTMLTextAreaElement>
  const feedback = document.createElement('p'); feedback.setAttribute('role', 'status'); feedback.className = 'wt-hint'
  section.append(feedback)
  for (const [key, label, fallback, max] of prompts) {
    const input = field(label, document.createElement('textarea'), promptPanel); input.rows = key === 'replyPrompt' ? 9 : 5; input.maxLength = max
    input.spellcheck = false; promptInputs[key] = input
    button(`恢复默认${label}`, promptPanel, () => { input.value = fallback; feedback.textContent = `${label}已恢复默认，保存设置后生效。` })
  }
  const assetsPanel = details('表情与图片 · 预览、分组与图库')
  assetsPanel.dataset.assetManager = ''
  const groups = {} as Record<'player' | 'contact' | 'photo', HTMLInputElement>
  for (const [key, label] of [['player', '我的表情包'], ['contact', '联系人表情包'], ['photo', '旧版角色照片（专属场景）']] as const) {
    const input = field(`启用${label}`, document.createElement('input'), assetsPanel); input.type = 'checkbox'; groups[key] = input
  }
  const grid = document.createElement('div'); grid.className = 'wt-asset-grid'; grid.setAttribute('role', 'group'); grid.setAttribute('aria-label', '素材预览列表'); assetsPanel.append(grid)
  const browseGroup = field('预览表情包组', document.createElement('select'), assetsPanel)
  for (const [key, label] of [['player', '我的表情包'], ['contact', '联系人表情包'], ['photo', '旧版角色照片（专属场景）']]) browseGroup.add(new Option(label, key))
  assetsPanel.insertBefore(browseGroup.parentElement!, grid)
  const assetName = field('素材显示名', document.createElement('input'), assetsPanel); assetName.maxLength = 60
  const assetDescription = field('素材含义说明', document.createElement('textarea'), assetsPanel); assetDescription.maxLength = 200; assetDescription.rows = 2
  const assetUrl = field('素材图片地址（留空恢复原图）', document.createElement('input'), assetsPanel)
  assetUrl.placeholder = 'HTTPS 或 /user/images/…'
  const preview = document.createElement('img'); preview.className = 'wt-asset-preview'; preview.alt = '选中素材预览'; assetsPanel.append(preview)
  let base = normalizeProfile(), selected = '', assetsDirty = true, custom: WeChatProfile['customAssets'] = {}, edits: WeChatProfile['assetEdits'] = {}, overrides: Record<string, string> = {}
  const catalog = (): Record<string, EmojiItem> => ({
    ...Object.fromEntries(Object.entries(PLAYER_EMOJIS).map(([id, item]) => [`player.${id}`, item])),
    ...Object.fromEntries(Object.entries(CONTACT_EMOJIS).map(([id, item]) => [`contact.${id}`, item])),
    ...Object.fromEntries(Object.entries(CONTACT_PHOTOS).map(([id, item]) => [`photo.${id}`, item])), ...custom,
  })
  function storeAsset() {
    const item = catalog()[selected]; if (!item) return
    const url = assetUrl.value.trim()
    if (url && !safeAssetUrl(url)) throw new Error('素材地址需要 HTTPS 或安全的酒馆用户图片路径')
    if (url && url !== item.file) overrides[selected] = url; else delete overrides[selected]
    const name = assetName.value.trim(), description = assetDescription.value.trim()
    const edit = { ...(name && name !== item.name ? { name } : {}), ...(description && description !== item.description ? { description } : {}) }
    if (Object.keys(edit).length) edits[selected] = edit; else delete edits[selected]
  }
  function selectAsset(key: string) {
    selected = key
    const item = catalog()[key]; if (!item) return
    assetName.value = edits[key]?.name ?? item.name; assetDescription.value = edits[key]?.description ?? item.description
    assetUrl.value = overrides[key] ?? ''; preview.src = resolveWeChatAssetUrl(overrides[key] ?? item.file)
    preview.alt = assetName.value
    grid.querySelectorAll<HTMLButtonElement>('button').forEach(btn => btn.setAttribute('aria-pressed', String(btn.dataset.asset === key)))
  }
  function drawAssets() {
    grid.replaceChildren()
    const visible = Object.entries(catalog()).filter(([key]) => key.startsWith(`${browseGroup.value}.`))
    for (const [key, item] of visible) {
      const btn = button(edits[key]?.name ?? item.name, grid, () => {
        try { storeAsset(); selectAsset(key); feedback.textContent = '' } catch (error) { feedback.textContent = (error as Error).message }
      }); btn.dataset.asset = key; btn.title = edits[key]?.description ?? item.description
      const img = document.createElement('img'); img.alt = ''; img.loading = 'lazy'; img.src = resolveWeChatAssetUrl(overrides[key] ?? item.file); btn.prepend(img)
    }
    selectAsset(visible.some(([key]) => key === selected) ? selected : visible[0]?.[0] || '')
  }
  button('恢复选中素材', assetsPanel, () => { delete edits[selected]; delete overrides[selected]; selectAsset(selected); drawAssets(); feedback.textContent = '已恢复原始素材，保存后生效。' })
  button('移除选中的图库图片', assetsPanel, () => {
    if (!custom[selected]) { feedback.textContent = '内置素材请通过上方分组开关停用。'; return }
    delete custom[selected]; delete edits[selected]; delete overrides[selected]; selected = ''; drawAssets(); feedback.textContent = '已从此配置移除，历史消息保留。'
  })
  const gallery = field('从图库选择图片', document.createElement('select'), assetsPanel)
  const destination = field('添加到', document.createElement('select'), assetsPanel)
  for (const [key, label] of [['player', '我的表情包'], ['contact', '联系人表情包'], ['photo', '联系人图片']]) destination.add(new Option(label, key))
  let galleryItems: { name: string; file: string }[] = []
  function ensureAssets() {
    if (!assetsDirty) return
    drawAssets()
    galleryItems = packs().flatMap(pack => pack.sprites.map(sprite => ({ name: `${pack.name} · ${sprite.tag}`, file: sprite.url })))
    gallery.replaceChildren(new Option('选择图库中的图片', ''), ...galleryItems.map((item, index) => new Option(item.name, String(index))))
    assetsDirty = false
  }
  assetsPanel.ontoggle = () => { if (assetsPanel.open) ensureAssets() }
  button('添加图库图片', assetsPanel, () => {
    const item = gallery.value === '' ? undefined : galleryItems[Number(gallery.value)]
    if (!item) { feedback.textContent = '请先在图库中保存图片，再回到这里选择。'; return }
    if (!safeAssetUrl(item.file)) { feedback.textContent = '请先在图库将此图片保存到酒馆图片存储，或使用 HTTPS 图片地址。'; return }
    try { storeAsset() } catch (error) { feedback.textContent = (error as Error).message; return }
    if (Object.keys(custom).length >= 100) { feedback.textContent = '最多添加 100 张图库图片。'; return }
    const key = `${destination.value}.custom-${globalThis.crypto.randomUUID()}`
    custom[key] = { name: item.name.slice(0, 60), description: item.name.slice(0, 200), file: item.file }
    groups[destination.value as keyof typeof groups].checked = true; browseGroup.value = destination.value; selected = key; drawAssets(); feedback.textContent = '图片已加入，保存设置后可发送。'
  })
  assetUrl.onchange = () => { try { storeAsset(); selectAsset(selected); feedback.textContent = '' } catch (error) { feedback.textContent = (error as Error).message } }
  browseGroup.onchange = () => { try { storeAsset(); drawAssets(); feedback.textContent = '' } catch (error) { browseGroup.value = selected.split('.')[0]; feedback.textContent = (error as Error).message } }
  return {
    element: section,
    showAssets() { assetsPanel.open = true; ensureAssets(); assetsPanel.scrollIntoView?.({ block: 'start' }) },
    setDisabled(disabled: boolean) { section.querySelectorAll<HTMLInputElement>('input,select,textarea,button').forEach(input => { input.disabled = disabled }) },
    fill(profile: WeChatProfile) {
      base = profile; player.value = profile.playerName; contact.value = profile.contactName; scene.value = profile.scene ?? ''; opening.value = profile.openingMessage
      count.value = String(profile.contextMessageCount); lore.checked = profile.includeWorldbook !== false
      for (const key of Object.keys(groups) as Array<keyof typeof groups>) groups[key].checked = profile.assetGroups[key]
      for (const [key, , fallback] of prompts) promptInputs[key].value = profile[key] || fallback
      custom = structuredClone(profile.customAssets); edits = structuredClone(profile.assetEdits); overrides = { ...profile.assetOverrides }
      selected = ''; assetsDirty = true; grid.replaceChildren(); gallery.replaceChildren(); preview.removeAttribute('src')
      if (assetsPanel.open) ensureAssets()
      feedback.textContent = ''
    },
    read(): WeChatProfile {
      storeAsset()
      if (!Number.isInteger(Number(count.value)) || Number(count.value) < 0 || Number(count.value) > 20) throw new Error('主聊天条数须为 0–20 的整数')
      return normalizeProfile({ profile: { ...base, playerName: player.value, contactName: contact.value, scene: scene.value, openingMessage: opening.value,
        contextMessageCount: Number(count.value), includeWorldbook: lore.checked,
        assetGroups: { player: groups.player.checked, contact: groups.contact.checked, photo: groups.photo.checked },
        assetOverrides: overrides, assetEdits: edits, customAssets: custom,
        ...Object.fromEntries(prompts.map(([key, , fallback]) => [key, promptInputs[key].value.trim() === fallback ? '' : promptInputs[key].value])),
      } })
    },
  }
}
