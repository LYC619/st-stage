// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { resolveWeChatAssetUrl } from './assets'
import { extractFieldsFromObject, extractRecentSTMessages } from './bridge'
import { addContactConversation, conversationScope, listContacts, loadContact } from './conversations'
import { memberScope, replyMembers, saveGroup } from './groups'
import { getScopedConversation } from './legacy-conversation'
import { conversationPreview, listTime, momentTime } from './list-format'
import { CONTACT_EMOJIS, CONTACT_PHOTOS, PLAYER_EMOJIS } from './manifest-data'
import { migrateWeChatData } from './migrations'
import { latestContactState } from './moments'
import { WeChatPipeline } from './pipeline'
import { applyAssetProfile, mappedValue, normalizeProfile, safeAssetUrl } from './profile'
import * as library from './profile-library'
import { DEFAULT_REPLY_PROMPT, DEFAULT_STATE_PROMPT } from './prompts'
import { buildRagPrompt, getRagMessages, getRagTokens, messageToRagText, normalizeRagText } from './rag'
import { createReplyController } from './replies'
import type { ChatMessage, Contact, ContactState, Conversation, WeChatAppData, WeChatConfig } from './types'

const activeControllers: Array<{ destroy(): void }> = []

afterEach(() => {
  for (const ctrl of activeControllers.splice(0)) ctrl.destroy()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('prompts, pipeline parsing, RAG & asset URLs', () => {
  const defaultState: ContactState = {
    mood: 60,
    interest: 20,
    contactLocation: 'SISTER_ROOM',
    playerLocation: 'COMPANY',
    money: 5000,
    currentStatus: 'reading',
  }

  it('renders custom/default prompts, omits disabled main-chat context, and sanitizes structured replies', async () => {
    expect(DEFAULT_REPLY_PROMPT).toContain('{角色}')
    expect(DEFAULT_STATE_PROMPT).toContain('inner_thought')

    const customPipe = new WeChatPipeline(
      { profile: { preset: 'general', contextMessageCount: 0, playerName: '小王', replyPrompt: 'Custom {角色} {人设} {用户}', statePrompt: 'State {状态}' } },
      PLAYER_EMOJIS,
      CONTACT_EMOJIS,
      CONTACT_PHOTOS,
    )
    const prompt = customPipe.buildSystemPrompt(defaultState, '20:00', {
      scopeKey: 'b',
      characterName: 'B',
      card: { description: 'B persona' },
      externalState: { source: 'none' },
      stRecentMessages: [{ sender: 'user', text: 'PRIVATE_MAIN_CHAT' }],
    })
    expect(prompt).toContain('Custom B B persona 小王')
    expect(prompt).toContain('reading')
    expect(prompt).not.toContain('PRIVATE_MAIN_CHAT')

    const defaultPipe = new WeChatPipeline({ apiKey: '', model: 'deepseek-chat', profile: { preset: 'general', playerName: '小王' } }, PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS)
    const alicePrompt = defaultPipe.buildSystemPrompt(defaultState, '18:30', 'Alice')
    expect(alicePrompt).toContain('「Alice」')
    expect(alicePrompt).toContain('用户称呼：小王')
    expect(alicePrompt).not.toMatch(/性趣阶梯|玩家此时在公司/)

    const textFallback = await defaultPipe.requestContactReply(
      [{ sender: 'player', content: '吃什么', type: 'text', time: { day: 1, hour: 18, minute: 0 } }],
      defaultState,
      1,
      '18:00',
    )
    expect(textFallback.messages[0].content).toBe('收到你的消息了。')
    const packetFallback = await defaultPipe.requestContactReply(
      [{ sender: 'player', content: '100', type: 'red_packet', time: { day: 1, hour: 18, minute: 0 } }],
      defaultState,
      1,
      '18:00',
    )
    expect(packetFallback.messages[0].content).toContain('礼物')

    const parsed = customPipe.parseReplyJson(JSON.stringify({
      messages: [
        { type: 'emoji', emoji_id: '"><img src=x onerror=alert(1)>' },
        { type: 'image', pic_id: '"><script>alert(2)</script>' },
        { type: 'emoji', emoji_id: 'happy' },
        { type: 'voice', content: 'spoken' },
      ],
      inner_thought: 'thinking',
      current_status: 'busy',
    }))
    expect(parsed).toEqual({
      messages: [
        { type: 'text', content: '[表情]' },
        { type: 'text', content: '[自拍]' },
        { type: 'emoji', emoji_id: 'happy' },
        { type: 'voice', content: 'spoken' },
      ],
      innerThought: 'thinking',
      currentStatus: 'busy',
    })

    const overlong = customPipe.parseReplyJson(JSON.stringify({
      messages: [{ type: 'text', content: 'Hi' }],
      inner_thought: {},
      current_status: 'x'.repeat(501),
    }))
    expect(overlong.innerThought).toBeUndefined()
    expect(overlong.currentStatus).toBeUndefined()
    expect(() => customPipe.parseReplyJson('{"messages":[]}')).toThrow('格式')

    for (const validMood of [0, 52.5, 100]) {
      expect(customPipe.parseReplyJson(JSON.stringify({ messages: [{ type: 'text', content: 'ok' }], mood: validMood }))).toMatchObject({ mood: validMood })
    }
    for (const invalidMood of [-1, 101, '82', null, {}, true]) {
      expect(customPipe.parseReplyJson(JSON.stringify({ messages: [{ type: 'text', content: 'ok' }], mood: invalidMood }))).toEqual({
        messages: [{ type: 'text', content: 'ok' }],
      })
    }

    const remotePipe = new WeChatPipeline({ apiKey: 'test-only' }, {}, {}, {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    await expect(remotePipe.requestContactReply([], defaultState, 1, 'now')).rejects.toThrow('503')
  })

  it('retrieves past-day RAG messages, preserves emoji source meanings, and resolves asset URLs safely', () => {
    expect(normalizeRagText('你好，世界！')).toBe('你好世界')
    expect(getRagTokens('可乐')).toEqual(expect.arrayContaining(['可', '乐', '可乐']))

    const history: ChatMessage[] = [
      { sender: 'player', content: '今天想喝冰可乐', type: 'text', time: { day: 1, hour: 12, minute: 0 } },
      { sender: 'contact', content: '我给你买了可乐放冰箱了', type: 'text', time: { day: 1, hour: 13, minute: 0 } },
      { sender: 'player', content: '今天吃什么', type: 'text', time: { day: 2, hour: 12, minute: 0 } },
    ]
    expect(getRagMessages('可乐', history, 2, PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS)[0]?.content).toContain('可乐')
    expect(buildRagPrompt('可乐', history, 2, PLAYER_EMOJIS, CONTACT_EMOJIS, CONTACT_PHOTOS)).toContain('相关历史')

    const emojiMsg = { sender: 'player', type: 'emoji', content: 'angry', emojiSource: 'contact', time: { day: 1, hour: 19, minute: 0 } } as const
    expect(messageToRagText(emojiMsg, PLAYER_EMOJIS, CONTACT_EMOJIS, {})).toContain(CONTACT_EMOJIS.angry.description)
    expect(messageToRagText({ ...emojiMsg, emojiSource: undefined }, PLAYER_EMOJIS, CONTACT_EMOJIS, {})).toContain(PLAYER_EMOJIS.angry.description)

    expect(resolveWeChatAssetUrl('photos/bedroom1.png')).toBe('/assets/wechat/photos/bedroom1.png')
    expect(resolveWeChatAssetUrl('/photos/bedroom1.png')).toBe('/assets/wechat/photos/bedroom1.png')
    expect(resolveWeChatAssetUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123')
    expect(resolveWeChatAssetUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })
})

describe('migrations, formatting, contacts & profile library', () => {
  it('migrates legacy sister/flat conversations idempotently and upgrades implicit contextMessageCount=0 once', () => {
    const raw = {
      config: { profile: { contextMessageCount: 0 }, characterProfiles: { 'avatar:a.png': { contextMessageCount: 0 } } },
      contacts: { a: { id: 'a', name: 'Alice' } },
      conversations: {
        'old::chat': {
          characterName: 'Alice', contactId: 'a', scopeKey: 'old::chat', draft: 'draft', unreadCount: 3, currentDay: 8,
          state: { mood: 76, interest: 28, money: 520, sisterLocation: 'on the train', playerLocation: '' },
          messages: [
            { id: 'old1', sender: 'sister', type: 'text', content: 'old reply', time: { day: 8, hour: 12, minute: 3 } },
            { sender: 'player', type: 'emoji', emojiSource: 'sister', content: 'shared-id', asset: { name: 'snapshot', file: '/saved.png', description: 'meaning' }, time: { day: 8, hour: 12, minute: 4 } },
          ],
        },
        g: {
          characterName: 'Group', conversationType: 'group', memberIds: ['a', 'b'], currentDay: 1,
          state: { contactLocation: 'park', sisterLocation: 'old', mood: 60, interest: 1, money: 0, playerLocation: '' },
          messages: [{ sender: 'contact', contactId: 'b', authorName: 'Bob', type: 'text', content: 'hi', time: { day: 1, hour: 1, minute: 0 } }],
        },
      },
    } as unknown as WeChatAppData

    migrateWeChatData(raw)
    expect(raw.config.profile?.contextMessageCount).toBe(12)
    expect(raw.conversations!['old::chat'].state).toMatchObject({ contactLocation: 'on the train', mood: 76 })
    expect(raw.conversations!['old::chat'].state).not.toHaveProperty('sisterLocation')
    expect(raw.conversations!['old::chat'].messages[0]).toMatchObject({ sender: 'contact', contactId: 'a', authorName: 'Alice' })
    expect(raw.conversations!['old::chat'].messages[1]).toMatchObject({ emojiSource: 'contact' })
    expect(raw.conversations!.g.state.contactLocation).toBe('park')
    expect(raw.conversations!.g.messages[0]).toMatchObject({ contactId: 'b', authorName: 'Bob' })

    raw.config.profile!.contextMessageCount = 0
    migrateWeChatData(raw)
    expect(raw.config.profile?.contextMessageCount).toBe(0)
  })

  it('formats WeChat list/Moments timestamps and conversation previews in priority order', () => {
    const now = new Date(2026, 10, 8, 15, 30)
    const at = (...parts: [number, number, number, number, number]) => new Date(...parts).getTime()
    expect(listTime(undefined, now)).toBe('')
    expect(listTime(at(2026, 10, 8, 9, 5), now)).toBe('09:05')
    expect(listTime(at(2026, 10, 7, 23, 59), now)).toBe('昨天')
    expect(listTime(at(2025, 11, 31, 8, 0), now)).toBe('2025/12/31')
    expect(momentTime(at(2026, 4, 1, 7, 30), now)).toBe('5月1日 07:30')
    expect(momentTime(at(2024, 4, 1, 7, 30), now)).toBe('2024年5月1日')

    const base = (patch: Partial<Conversation>): Conversation => ({
      characterName: 'A', contactId: 'avatar:a.png', messages: [], currentDay: 1,
      state: { mood: 60, interest: 15, money: 0, contactLocation: '', playerLocation: '' }, ...patch,
    })
    const time = { day: 1, hour: 1, minute: 0 }
    const group = base({ contactId: undefined, conversationType: 'group', messages: [{ sender: 'contact', authorName: 'B', type: 'text', content: 'hi', time }] })
    expect(conversationPreview(group, true, false)).toBe('B: hi')
    expect(conversationPreview(group, true, true)).toBe('正在回复…')
    expect(conversationPreview(base({ draft: '想说的话', messages: group.messages }), false, false)).toBe('[草稿] 想说的话')
    expect(conversationPreview(base({ messages: [{ sender: 'player', type: 'red_packet', content: '奶茶', time }] }), false, false)).toBe('[红包] 奶茶')
    expect(conversationPreview(base({ contactId: undefined, chatId: 'old-chat' }), false, false)).toBe('旧会话 · old-chat · 开始聊天')
  })

  it('isolates same-name contacts, hydrates shallow ST cards without switching host character, and validates profiles/templates', async () => {
    const data: WeChatAppData = { config: {}, conversations: {} }
    const a = addContactConversation(data, { id: 'avatar:a.png', name: 'Same', card: { name: 'Same', avatar: 'a.png', description: 'A' } })
    const b = addContactConversation(data, { id: 'avatar:b.png', name: 'Same', card: { name: 'Same', avatar: 'b.png', description: 'B' } })
    expect(a).not.toBe(b)
    expect(conversationScope(data, b).card?.description).toBe('B')

    const context = {
      characterId: 0,
      characters: [{ name: 'A', avatar: 'a.png' }, { name: 'B', avatar: 'b.png', shallow: true }],
      unshallowCharacter: vi.fn(async () => {
        context.characters.reverse()
        Object.assign(context.characters[0], { shallow: false, description: 'B persona' })
      }),
    }
    vi.stubGlobal('window', { SillyTavern: { getContext: () => context } })
    const host = { getCharacterCard: () => context.characters.find((c) => c.avatar === 'a.png') } as AppHost
    expect(listContacts(host)).toHaveLength(2)
    expect((await loadContact(host, 'avatar:b.png')).card?.description).toBe('B persona')
    expect(context.characterId).toBe(0)

    const raw = { stat_data: { mood: 99, Alice: { score: [42, 'description'], place: '图书馆' } } }
    expect(extractFieldsFromObject(raw, 'Alice', { mood: 'Alice.score', location: 'Alice.place' })).toMatchObject({ mood: 42, location: '图书馆' })
    expect(mappedValue(raw, 'constructor.prototype')).toBeUndefined()
    expect(extractRecentSTMessages({ getChatContext: () => ({ chat: [{ mes: 'PRIVATE', is_user: true }] }) } as AppHost, 0)).toBeUndefined()

    const firstEmoji = Object.keys(PLAYER_EMOJIS)[0]
    const prof = normalizeProfile({ profile: { preset: 'general', assetOverrides: { [`player.${firstEmoji}`]: 'https://example.test/p.png', 'player.bad': 'javascript:alert(1)' } } })
    expect(applyAssetProfile(PLAYER_EMOJIS, 'player', prof)[firstEmoji].file).toBe('https://example.test/p.png')
    expect(prof.assetOverrides['player.bad']).toBeUndefined()
    expect(safeAssetUrl('/user/images/%2e%2e/settings.json')).toBe(false)
    expect(safeAssetUrl('https://user:secret@example.test/a')).toBe(false)
    expect(safeAssetUrl('/user/images/Alice/picture%20one.png')).toBe(true)

    expect(library.profileCharacterKey({ avatar: 'Alice.png' })).toBe('avatar:Alice.png')
    expect(library.profileCharacterKey({ avatar: '../Alice.png' })).toBeNull()

    const savedCfg = library.saveScopedProfile({ apiKey: 'PRIVATE', profile: { contactName: 'Default' } }, 'avatar:one.png', normalizeProfile({ profile: { contactName: 'One' } }))
    expect(library.resolveProfile(savedCfg, 'avatar:one.png').contactName).toBe('One')
    expect(library.resolveProfile(library.inheritProfile(savedCfg, 'avatar:one.png'), 'avatar:one.png').contactName).toBe('Default')
    expect(library.resolveProfile({ profile: { contactName: 'Default' }, characterProfiles: Object.create({ 'avatar:one.png': { contactName: 'Wrong' } }) } as WeChatConfig, 'avatar:one.png').contactName).toBe('Default')

    const encoded = library.encodeProfileTemplate('My template', { ...normalizeProfile({ profile: { contactName: 'Alice' } }), apiKey: 'PRIVATE' } as never)
    expect(encoded).not.toContain('PRIVATE')
    expect(library.decodeProfileTemplate(encoded).name).toBe('My template')
    const good = JSON.parse(encoded)
    for (const bad of [
      { ...good, format: 'other' },
      { ...good, profile: { ...good.profile, apiKey: 'secret' } },
      { ...good, profile: { ...good.profile, mappings: { mood: '__proto__.score' } } },
      { ...good, profile: { ...good.profile, assetOverrides: { 'player.angry': 'javascript:alert(1)' } } },
    ]) {
      expect(() => library.decodeProfileTemplate(JSON.stringify(bad))).toThrow()
    }
    const tplList = library.addProfileTemplate([], 'General', normalizeProfile())
    expect(() => library.addProfileTemplate(tplList, 'General', normalizeProfile())).toThrow()
    expect(getScopedConversation({ config: {} }, 'LegacyAlice').characterName).toBe('LegacyAlice')
  })
})

describe('group reply transactions & contact state recency', () => {
  const mkContact = (name: string): Contact => ({
    id: `avatar:${name}.png`,
    name,
    card: { name, avatar: `${name}.png`, description: `${name} ORIGINAL CARD` },
  })
  const completion = (state: Record<string, unknown> = {}) => new Response(
    JSON.stringify({ choices: [{ message: { content: JSON.stringify({ messages: [{ type: 'text', content: 'reply' }], ...state }) } }] }),
    { status: 200 },
  )

  function groupFixture() {
    const data: WeChatAppData = { config: { apiKey: 'fixture-old', apiUrl: 'https://old.example.test', profile: { preset: 'general', replyPrompt: 'OLD PROMPT {人设}' } } }
    const members = [mkContact('Alice'), mkContact('allison'), mkContact('Bob')]
    const direct = members.map((m) => addContactConversation(data, m))
    const group = saveGroup(data, 'Friends', members)
    const controller = createReplyController(data, { persist() {}, changed() {}, activeKey: () => group.scopeKey!, report() {} })
    activeControllers.push(controller)
    const send = (conv: Conversation, content: string) => {
      const player: ChatMessage = { id: crypto.randomUUID(), sender: 'player', type: 'text', content, time: { day: 1, hour: 12, minute: 0 } }
      conv.messages.push(player)
      conv.updatedAt = Date.now()
      return controller.send(conv, player)
    }
    return { data, members, direct, group, send }
  }

  it('freezes endpoint, key, prompt and persona across an in-flight group round and selects @mentions accurately', async () => {
    const f = groupFixture()
    let release!: (r: Response) => void
    const held = new Promise<Response>((resolve) => { release = resolve })
    const fetchMock = vi.fn().mockReturnValueOnce(held).mockImplementation(async () => completion())
    vi.stubGlobal('fetch', fetchMock)

    const sending = f.send(f.group, 'hello')
    f.data.config = { apiKey: 'fixture-new', apiUrl: 'https://new.example.test', profile: { replyPrompt: 'NEW PROMPT {人设}' } }
    f.data.contacts![f.members[2].id].card!.description = 'CHANGED CARD'
    release(completion())
    await sending

    for (const [url, init] of fetchMock.mock.calls) {
      expect(url).toBe('https://old.example.test')
      expect(init.headers.Authorization).toBe('Bearer fixture-old')
      expect(JSON.parse(init.body).messages[0].content).toContain('OLD PROMPT')
    }
    expect(JSON.parse(fetchMock.mock.calls[2][1].body).messages[0].content).toContain('Bob ORIGINAL CARD')

    for (const [text, expected] of [
      ['@allison hi', ['allison']],
      ['@[avatar:Alice.png] @Bob hi', ['Alice', 'Bob']],
      ['@Bob @[avatar:Bob.png] hi', ['Bob']],
      ['@所有人，hello', ['Alice', 'allison', 'Bob']],
    ] as const) {
      expect(replyMembers(f.data, f.group, text).map((m) => m.name)).toEqual(expected)
    }
    expect(() => replyMembers(f.data, f.group, '@[avatar:removed.png] hi')).toThrow('已不在此群')

    const ctxMsgs = new WeChatPipeline({}, {}, {}, {}).buildContextMessages(
      [{ sender: 'contact', contactId: f.members[0].id, authorName: 'Alice', type: 'text', content: 'A said', time: { day: 1, hour: 1, minute: 0 } }],
      f.group.state,
      1,
      'now',
      memberScope(f.data, f.group, f.members[2]),
    )
    expect(ctxMsgs.at(-1)).toEqual({ role: 'user', content: '[Alice] A said' })
  })

  it('tracks per-contact state recency across group/direct chats without promoting stale states', async () => {
    vi.useFakeTimers()
    const f = groupFixture()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(completion({ current_status: 'old group', mood: 35 }))
      .mockResolvedValueOnce(completion({ current_status: 'new direct', mood: 82 }))
      .mockImplementation(async () => completion()))
    vi.setSystemTime(1000); await f.send(f.group, '@Bob hello')
    vi.setSystemTime(2000); await f.send(f.direct[2], 'hello')
    vi.setSystemTime(3000); await f.send(f.group, '@Alice hello')
    f.group.updatedAt = 4000
    expect(latestContactState(f.data, f.members[2].id)).toMatchObject({ currentStatus: 'new direct', mood: 82, updatedAt: 2000 })

    vi.setSystemTime(5000); await f.send(f.direct[2], 'no state fields')
    expect(f.direct[2].state.updatedAt).toBe(2000)
  })
})
