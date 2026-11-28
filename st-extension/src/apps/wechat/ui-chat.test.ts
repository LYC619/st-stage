// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost, PhoneAppContext } from '../../../../core/phone-registry'
import { createDefaultSettings } from '../../../../core/types'
import { requestOpenApp, resetStoryEvents } from '../shared/story-events'
import * as storyDates from '../shared/story-date'
import { getWeChatHostContext, type STCharacterCard } from './bridge'
import { conversationScope } from './conversations'
import { saveGroup } from './groups'
import { PLAYER_EMOJIS } from './manifest-data'
import { captureStory, formatStoryMemory, readStoryMemory, storyText } from './memory'
import { addMoment } from './moments'
import { WeChatPipeline } from './pipeline'
import { normalizeProfile } from './profile'
import { createProfileEditor } from './profile-editor'
import { resolveProfile } from './profile-library'
import { createProfileSettings } from './profile-settings'
import { mountWeChat } from './test-fixture'
import type { LLMReplyPayload, WeChatAppData } from './types'
import { createWeChatApp, getScopedConversation } from './wechat-app'

let mounted: ReturnType<typeof mountWeChat> | undefined
const standaloneApps: Array<ReturnType<typeof createWeChatApp>> = []

afterEach(() => {
  mounted?.app.unmount?.()
  mounted = undefined
  for (const app of standaloneApps.splice(0)) app.unmount?.()
  resetStoryEvents()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function deferred<T = LLMReplyPayload>() {
  let resolve!: (value: T) => void
  return { promise: new Promise<T>((done) => { resolve = done }), resolve }
}

const mkReply = (text: string): LLMReplyPayload => ({
  messages: [{ type: 'text', content: text }],
  innerThought: `${text} thought`,
  currentStatus: `${text} status`,
})

describe('entry, navigation & scoped settings', () => {
  it('adds current character card without overwriting existing history/drafts and separates same-name cards', () => {
    let data: WeChatAppData | undefined
    let card: STCharacterCard | undefined = { name: 'A', avatar: 'a.png', description: 'Original persona' }
    const settings = createDefaultSettings()
    const app = createWeChatApp()
    standaloneApps.push(app)
    const ctx: PhoneAppContext = {
      apiVersion: 2, getSettings: () => settings, getCharacterName: () => card?.name || '', getCharacterCard: () => card,
      getAppData: <T>() => data as T | undefined, setAppData: <T>(v: T) => { data = v as WeChatAppData },
      onCharacterChanged: () => () => {}, onMessageReceived: () => () => {},
      injectPrompt: vi.fn(), toast: vi.fn(), updateSettings: vi.fn(), goHome: vi.fn(), openModal: vi.fn(),
      setTimeout: window.setTimeout.bind(window), setInterval: window.setInterval.bind(window),
    }
    app.setup?.(ctx)
    const container = document.createElement('div')
    document.body.append(container)
    app.mount(container, ctx)

    const conv = data!.conversations!['direct:avatar:a.png']
    conv.messages.push({ sender: 'player', type: 'text', content: 'Existing', time: { day: 1, hour: 1, minute: 0 } })
    conv.draft = 'Unsent'
    app.unmount?.()

    card = { name: 'A', avatar: 'a.png', description: 'Changed' }
    app.mount(container, ctx)
    expect(data!.conversations!['direct:avatar:a.png']).toBe(conv)
    expect(conv.draft).toBe('Unsent')
    expect(data!.contacts!['avatar:a.png'].card?.description).toBe('Original persona')
    app.unmount?.()

    card = { name: 'A', avatar: 'second.png' }
    app.mount(container, ctx)
    expect([...container.querySelectorAll<HTMLElement>('[data-conversation]')].map((n) => n.dataset.conversation))
      .toEqual(['direct:avatar:a.png', 'direct:avatar:second.png'])
  })

  it('navigates 3 bottom tabs by keyboard, retains drafts/private Moments likes, and steps back in order', () => {
    const f = mounted = mountWeChat()
    addMoment(f.data(), f.data().contacts!['avatar:b.png'], '只想告诉你', undefined, f.b.state, 'private')

    f.el('#wt-plus').click()
    f.el('#wt-plus-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.activeElement).toBe(f.el('#wt-plus'))

    f.el('#wt-tab-chats').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    f.el('[data-friend="avatar:b.png"]').click()
    f.el<HTMLInputElement>('#wt-input-text').value = '保留草稿'

    f.el('#wt-emoji-btn').click()
    expect(f.app.back?.()).toBe(true)
    expect(f.el('#wt-emoji-drawer').hidden).toBe(true)
    expect(f.app.back?.()).toBe(true)
    expect(f.b.draft).toBe('保留草稿')

    f.el('#wt-moments').click()
    const card = f.el('.wt-moment')
    expect(card.textContent).toContain('🔒 仅你可见')
    f.el('.wt-moment [aria-pressed]').click()
    f.el('#wt-tab-chats').click()
    f.el('#wt-moments').click()
    expect(f.el('.wt-moment [aria-pressed]').getAttribute('aria-pressed')).toBe('true')
  })

  it('validates profile editor asset URLs, manages scoped templates/lazy gallery, and drops stale prompt previews', async () => {
    const packs = vi.fn(() => [{ id: 'one', name: '图库', sprites: [{ tag: '船票', url: 'https://example.test/ticket.png' }] }])
    const editor = createProfileEditor(document.body, packs)
    const id = Object.keys(PLAYER_EMOJIS)[0]
    const profile = normalizeProfile({ profile: { preset: 'general', contactName: '<b>A</b>', assetOverrides: { [`player.${id}`]: 'https://example.test/c.png' } } })
    editor.fill(profile)
    expect(packs).not.toHaveBeenCalled()
    expect(editor.read()).toEqual(profile)
    editor.showAssets()
    expect(packs).toHaveBeenCalledOnce()
    document.querySelector<HTMLInputElement>('input[aria-label^="素材图片地址"]')!.value = 'javascript:alert(1)'
    expect(() => editor.read()).toThrow('素材地址')

    document.body.replaceChildren()
    let finishStale!: (v: string) => void
    const preview = vi.fn().mockReturnValueOnce(new Promise<string>((r) => { finishStale = r })).mockResolvedValueOnce('B preview')
    const data: WeChatAppData = { config: { apiKey: 'PRIVATE', profile: { contactName: 'Default' } } }
    const form = createProfileSettings(document.body, data, vi.fn(), { preview })
    form.open('avatar:a.png')
    const scopeSel = document.querySelector<HTMLSelectElement>('[data-profile-scope]')!
    scopeSel.value = 'character'
    scopeSel.dispatchEvent(new Event('change'))
    document.querySelector<HTMLInputElement>('input[aria-label^="联系人"]')!.value = 'Role'
    data.config = form.save(data.config)
    expect(resolveProfile(data.config, 'avatar:a.png').contactName).toBe('Role')
    expect(resolveProfile(data.config, 'avatar:b.png').contactName).toBe('Default')

    const previewBtn = [...document.querySelectorAll('button')].find((b) => b.textContent === '预览实际发送的提示词')!
    previewBtn.click()
    form.open('avatar:b.png')
    previewBtn.click()
    await vi.waitFor(() => expect(document.querySelector<HTMLTextAreaElement>('[aria-label="实际提示词预览"]')!.value).toBe('B preview'))
    finishStale('A stale preview')
    await Promise.resolve()
    expect(document.querySelector<HTMLTextAreaElement>('[aria-label="实际提示词预览"]')!.value).toBe('B preview')
  })
})

describe('story memory, worldbook filtering & cardless NPC contacts', () => {
  function memoryFixture() {
    let chatId = 'story-1'
    const a = { name: 'A', avatar: 'a.png', data: { extensions: { world: 'Main' } } }
    const b = { name: 'B', avatar: 'b.png', data: { extensions: { world: 'Bound' } } }
    const chat = [
      { is_user: true, mes: '我们在月港取得了船票。', name: '旅行者' },
      { is_user: false, mes: '<p>明天从月港出发。</p><think>hidden reasoning</think>', name: 'A' },
      { is_system: true, mes: 'SYSTEM_SECRET' },
    ]
    const native = {
      characters: [a, b], tagMap: { 'b.png': ['space'] }, chat, name1: '旅行者',
      getCurrentChatId: () => chatId, loadWorldInfo: vi.fn(),
      getRequestHeaders: () => ({ 'X-CSRF-Token': 'test' }), chatMetadata: { world_info: 'Chat' } as Record<string, unknown>,
    }
    vi.stubGlobal('SillyTavern', { getContext: () => native })
    const host = { getCharacterName: () => 'A', getCharacterCard: () => a, getChatContext: () => ({ chatId, chat }) } as unknown as AppHost
    return {
      host, native,
      scope: { scopeKey: 'direct:b', characterName: 'B', card: b, externalState: { source: 'none' as const } },
      switchChat: () => { chatId = 'story-2' },
    }
  }

  it('injects chronicle overviews, filters worldbooks by avatar/tag, deduplicates shared reads, and rejects switched chats', async () => {
    const f = memoryFixture()
    vi.spyOn(storyDates, 'storyToday').mockResolvedValue(new Date(2026, 0, 2))
    f.native.chatMetadata.st_stage_chronicle = {
      v: 1, lastMessageIndex: 0,
      entries: [{ code: 'AM0001', timeSpan: '2026-01-01', summary: '拿到通行证', text: '完整正文不发', keyDialogue: [], createdAt: 1 }],
    }
    const noWbScope = await readStoryMemory(f.host, f.scope, normalizeProfile({ profile: { includeWorldbook: false } }), new AbortController().signal)
    const noWbPrompt = formatStoryMemory(noWbScope)
    expect(noWbPrompt).toContain('AM0001 | 昨天 | 拿到通行证')
    expect(noWbPrompt).not.toContain('完整正文不发')

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        entries: [
          { constant: true, characterFilter: { names: ['b'] }, content: 'BOUND_ID' },
          { constant: true, characterFilter: { names: ['B'] }, content: 'WRONG_DISPLAY_NAME' },
          { constant: true, characterFilter: { tags: ['space'] }, content: 'MATCHED_TAG' },
          { constant: true, disable: true, content: 'DISABLED_SECRET' },
        ],
      }),
    }))
    const books = new Map<string, Promise<unknown>>()
    const story = captureStory(f.host)
    const [first, second] = await Promise.all([
      readStoryMemory(f.host, f.scope, normalizeProfile(), new AbortController().signal, story, '', async () => ({}), books),
      readStoryMemory(f.host, f.scope, normalizeProfile(), new AbortController().signal, story, '', async () => ({}), books),
    ])
    expect(first.loreText).toContain('BOUND_ID')
    expect(first.loreText).toContain('MATCHED_TAG')
    expect(first.loreText).not.toMatch(/WRONG_DISPLAY_NAME|DISABLED_SECRET/)
    expect(second.loreText).toBe(first.loreText)

    let finishPending!: (v: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise((r) => { finishPending = r })))
    const pendingWork = readStoryMemory(f.host, f.scope, normalizeProfile(), new AbortController().signal, captureStory(f.host), '', async () => ({}))
    await vi.waitFor(() => expect(finishPending).toBeDefined())
    f.switchChat()
    finishPending({ ok: true, json: async () => ({ entries: {} }) })
    await expect(pendingWork).rejects.toThrow('主聊天已切换')

    expect(storyText('<img src=x onerror="alert(1)"><p>安全故事</p><script>bad()</script>')).toBe('安全故事')
    expect(document.querySelector('img,script')).toBeNull()
  })

  it('opens cardless story NPCs with per-story isolation and abandons late shallow card hydration after switching', async () => {
    const f = mounted = mountWeChat({ config: { autoMoments: false } })
    let chatId = 'story-one'
    f.ctx.getChatContext = () => ({ chatId, chat: [] })

    requestOpenApp({ appId: 'wechat-sister', contactName: 'Innkeeper' })
    f.remount()
    await vi.waitFor(() => expect(f.el('#wt-contact-name').textContent).toBe('Innkeeper'))
    const first = f.data().conversations![f.data().activeScopeKey!]
    f.el<HTMLInputElement>('#wt-input-text').value = 'Unsent draft'
    f.el('#wt-input-text').dispatchEvent(new Event('input', { bubbles: true }))

    chatId = 'story-two'
    f.hostChange('A')
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Innkeeper' })
    f.remount()
    await vi.waitFor(() => expect(f.data().activeScopeKey).not.toBe(first.scopeKey))
    const second = f.data().conversations![f.data().activeScopeKey!]
    expect(second.draft).toBeUndefined()
    expect(conversationScope(f.data(), second).storyKey).toBe('avatar:a.png::story-two')

    let finishHydrate!: () => void
    const visitor = { name: 'Visitor', avatar: 'visitor.png', shallow: true, description: 'REAL_CARD' }
    vi.stubGlobal('SillyTavern', { getContext: () => ({ characters: [visitor], unshallowCharacter: vi.fn(() => new Promise<void>((r) => { finishHydrate = () => { visitor.shallow = false; r() } })) }) })
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Visitor' })
    f.remount()
    await vi.waitFor(() => expect(finishHydrate).toBeDefined())
    f.hostChange('B')
    finishHydrate()
    await Promise.resolve()
    expect(f.data().contacts?.['avatar:visitor.png']).toBeUndefined()
  })
})

describe('chat status, scroll follow, concurrent replies & group recovery', () => {
  it('routes concurrent replies with unread counts/drafts, protects IME composition, and preserves scroll reading position', async () => {
    const aReply = deferred()
    const bReply = deferred()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply')
      .mockReturnValueOnce(aReply.promise)
      .mockReturnValueOnce(bReply.promise)

    const f = mounted = mountWeChat()
    f.open(f.a.scopeKey!)
    const scroll = f.el('#wt-scroll')
    let height = 1000, top = 0
    Object.defineProperty(scroll, 'scrollHeight', { configurable: true, get: () => height })
    Object.defineProperty(scroll, 'clientHeight', { configurable: true, get: () => 300 })
    Object.defineProperty(scroll, 'scrollTop', { configurable: true, get: () => top, set: (v: number) => { top = Math.max(0, Math.min(v, height - 300)) } })

    const input = f.el<HTMLInputElement>('#wt-input-text')
    input.value = 'to A'
    input.dispatchEvent(new CompositionEvent('compositionstart'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(f.a.messages).toHaveLength(0)
    input.dispatchEvent(new CompositionEvent('compositionend'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(f.el('#wt-chat-status').hidden).toBe(false)
    input.value = 'A draft'

    f.open(f.b.scopeKey!)
    f.el<HTMLInputElement>('#wt-input-text').value = 'to B'
    f.el('#wt-send-btn').click()
    scroll.scrollTop = 100
    height += 150

    aReply.resolve(mkReply('A answer'))
    await vi.waitFor(() => expect(f.a.unreadCount).toBe(1))
    bReply.resolve(mkReply('B answer'))
    await vi.waitFor(() => expect(f.b.messages).toHaveLength(2))
    expect(scroll.scrollTop).toBe(100)
    expect(f.el('#wt-jump-latest').hidden).toBe(false)
    f.el('#wt-jump-latest').click()
    expect(scroll.scrollTop).toBe(850)

    f.open(f.a.scopeKey!)
    expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('A draft')
    expect(f.a.unreadCount).toBe(0)
  })

  it('handles cancel/timeout/clear aborts, rolls back partial group failures on retry, and sends gifts without mutating external wallet', async () => {
    vi.useFakeTimers()
    const hung = deferred()
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply')
      .mockReturnValueOnce(hung.promise)
      .mockResolvedValueOnce(mkReply('partial'))
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(mkReply('ok'))

    const f = mounted = mountWeChat()
    f.a.state.money = 1000
    f.a.state.hasExternalState = true
    f.a.state.externalFields = { money: true }
    f.open(f.a.scopeKey!)
    f.el<HTMLInputElement>('#wt-input-text').value = 'first'
    f.el('#wt-send-btn').click()
    f.el('#wt-cancel-reply').click()
    expect(request.mock.calls[0][5]?.aborted).toBe(true)
    hung.resolve(mkReply('LATE'))
    await vi.advanceTimersByTimeAsync(1)
    expect(f.a.messages.some((m) => m.content === 'LATE')).toBe(false)

    const group = saveGroup(f.data(), 'Friends', Object.values(f.data().contacts!))
    f.remount()
    f.open(group.scopeKey!)
    f.el<HTMLInputElement>('#wt-input-text').value = 'everyone'
    f.el('#wt-send-btn').click()
    await vi.waitFor(() => expect(f.data().conversations![group.scopeKey!].replyAttempt?.status).toBe('failed'))
    const gConv = f.data().conversations![group.scopeKey!]
    expect(gConv.messages).toHaveLength(1)
    f.el('#wt-retry-reply').click()
    await vi.waitFor(() => expect(gConv.messages).toHaveLength(3))
    expect(gConv.messages.some((m) => m.content === 'partial')).toBe(false)

    f.open(f.a.scopeKey!)
    const liveA = f.data().conversations![f.a.scopeKey!]
    f.el('#wt-packet-btn').click()
    f.el<HTMLInputElement>('#wt-custom-amt').value = '一张船票'
    f.el<HTMLTextAreaElement>('#wt-packet-note').value = '一起出发'
    f.el('#wt-confirm-packet').click()
    await vi.waitFor(() => expect(liveA.messages.some((m) => m.type === 'red_packet')).toBe(true))
    expect(liveA.state.money).toBe(1000)
    expect(getScopedConversation({ config: {} }, 'LegacyCheck').characterName).toBe('LegacyCheck')
    expect(getWeChatHostContext()).toBeUndefined()
  })
})
