// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { WeChatPipeline } from './pipeline'
import { saveGroup, replyMembers, memberScope } from './groups'
import { speakWeChatText } from './bridge'
import type { LLMReplyPayload, WeChatAppData } from './types'

let fixture: ReturnType<typeof mountWeChat> | undefined
const setup = (data?: WeChatAppData) => (fixture = mountWeChat(data))
const response = (content: string): LLMReplyPayload => ({ messages: [{ type: 'text', content }], currentStatus: content + ' status' })
function deferred() { let resolve!: (value: LLMReplyPayload) => void; return { promise: new Promise<LLMReplyPayload>(done => { resolve = done }), resolve: (value: LLMReplyPayload) => resolve(value) } }
afterEach(() => { fixture?.app.unmount?.(); fixture = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren() })
const send = (f: ReturnType<typeof setup>, text: string) => { f.el<HTMLInputElement>('#wt-input-text').value = text; f.el('#wt-send-btn').click() }
const contacts = (f: ReturnType<typeof setup>) => Object.values(f.data().contacts!)
function group(f: ReturnType<typeof setup>) { const g = saveGroup(f.data(), 'Friends', contacts(f)); f.remount(); f.open(g.scopeKey!); return f.data().conversations![g.scopeKey!] }

describe('group chat and recovery', () => {
  it('creates a group through the UI, names every speaker and preserves the host and direct chats', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockImplementation(async (_history, _state, _day, _time, scope) => response(typeof scope === 'object' ? scope.characterName : 'unknown'))
    const f = setup(); f.el('#wt-new-group').click(); f.el<HTMLInputElement>('#wt-group-title').value = 'Friends'
    for (const check of f.container.querySelectorAll<HTMLInputElement>('#wt-group-options input')) check.click()
    f.el('#wt-save-group').click()
    await vi.waitFor(() => expect(f.el('#wt-contact-name').textContent).toBe('Friends'))
    send(f, 'hello everyone')
    await vi.waitFor(() => expect(request).toHaveBeenCalledTimes(2))
    await vi.waitFor(() => expect(f.container.querySelectorAll('.wt-message-author')).toHaveLength(2))
    const conv = Object.values(f.data().conversations!).find(c => c.conversationType === 'group')!
    expect(conv.messages.map(m => m.sender)).toEqual(['player', 'contact', 'contact'])
    expect(conv.messages.slice(1).map(m => m.contactId)).toEqual(contacts(f).map(c => c.id))
    expect(conv.memberStates?.['avatar:b.png'].currentStatus).toBe('B status')
    expect(f.a.messages).toHaveLength(0); expect(f.b.messages).toHaveLength(0)
    expect(f.ctx.getCharacterName()).toBe('A'); expect(f.getVariables).not.toHaveBeenCalled()
    f.remount(); f.open(conv.scopeKey!); expect(f.el('#wt-scroll').textContent).toContain('B')
  })
  it('directs @ identity and @ name to the intended members and caps the avatar mosaic at nine', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue(response('target'))
    const f = setup(), g = group(f)
    const select = f.el<HTMLSelectElement>('#wt-mention'); select.value = 'avatar:b.png'; select.dispatchEvent(new Event('change'))
    f.el('#wt-send-btn').click(); await vi.waitFor(() => expect(g.messages).toHaveLength(2))
    expect(request.mock.calls[0][4]).toMatchObject({ contactId: 'avatar:b.png' })
    expect(replyMembers(f.data(), g as Parameters<typeof replyMembers>[1], '@A hi').map(c => c.id)).toEqual(['avatar:a.png'])
    const many = Array.from({ length: 12 }, (_, i) => ({ id: 'avatar:x' + i + '.png', name: 'X' + i, card: { avatar: 'x' + i + '.png' } }))
    const large = saveGroup(f.data(), 'Large', many); f.remount()
    expect(f.container.querySelector('[data-conversation="' + large.scopeKey + '"] .wt-group-avatar')?.children).toHaveLength(9)
  })
  it('keeps partially generated group replies out of history and retries without duplicating the player turn', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValueOnce(response('partial')).mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('retry'))
    const f = setup(), g = group(f); send(f, 'hello')
    await vi.waitFor(() => expect(g.replyAttempt?.status).toBe('failed'))
    expect(g.messages).toHaveLength(1); expect(f.el('#wt-reply-error').textContent).toBe('offline')
    f.el('#wt-retry-reply').click(); await vi.waitFor(() => expect(g.messages).toHaveLength(3))
    expect(request).toHaveBeenCalledTimes(4); expect(g.messages.filter(m => m.sender === 'player')).toHaveLength(1)
    expect(g.messages.some(m => m.content === 'partial')).toBe(false)
  })
  it.each(['cancel', 'timeout'] as const)('rejects late completion after %s, then retries the original message', async mode => {
    vi.useFakeTimers(); const old = deferred()
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValueOnce(old.promise).mockResolvedValue(response('new'))
    const f = setup(); f.open(f.a.scopeKey!); send(f, 'once')
    if (mode === 'cancel') f.el('#wt-cancel-reply').click(); else await vi.advanceTimersByTimeAsync(60001)
    expect(request.mock.calls[0][5]?.aborted).toBe(true)
    f.el('#wt-retry-reply').click(); await vi.advanceTimersByTimeAsync(1)
    old.resolve(response('late')); await vi.advanceTimersByTimeAsync(1)
    expect(f.a.messages.map(m => m.content)).toEqual(['once', 'new'])
  })
  it('restores a failed attempt after reload and keeps new drafts while retrying', async () => {
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockRejectedValueOnce(new Error('offline')).mockResolvedValue(response('answer'))
    const f = setup(); f.open(f.a.scopeKey!); send(f, 'first')
    await vi.waitFor(() => expect(f.a.replyAttempt?.status).toBe('failed'))
    f.remount(); f.open(f.a.scopeKey!); f.el<HTMLInputElement>('#wt-input-text').value = 'next draft'
    f.el('#wt-input-text').dispatchEvent(new Event('input')); f.el('#wt-retry-reply').click()
    await vi.waitFor(() => expect(f.data().conversations![f.a.scopeKey!].messages).toHaveLength(2))
    expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('next draft')
  })
  it('labels other group members as conversation input, preserving each character persona', () => {
    const f = setup(), g = saveGroup(f.data(), 'Group', contacts(f)), b = contacts(f)[1]
    const pipe = new WeChatPipeline({}, {}, {}, {})
    const messages = pipe.buildContextMessages([{ sender: 'contact', contactId: contacts(f)[0].id, authorName: 'A', type: 'text', content: 'A said', time: { day: 1, hour: 1, minute: 0 } }], g.state, 1, 'now', memberScope(f.data(), g, b))
    expect(messages[0].content).toContain('PRIVATE_PERSONA_B'); expect(messages[0].content).not.toContain('PRIVATE_PERSONA_A')
    expect(messages.at(-1)).toEqual({ role: 'user', content: '[A] A said' })
  })
})

describe('Moments and voice', () => {
  it('saves the generation state snapshot when a chat updates during a pending Moment', async () => {
    let resolve!: (value: { text: string }) => void
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockReturnValue(new Promise(done => { resolve = done }))
    const f = setup(); f.b.state.mood = 25; f.b.state.currentStatus = 'at park'
    f.el('#wt-moments').click(); f.el<HTMLSelectElement>('#wt-moments-author').value = 'avatar:b.png'; f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    f.b.state.mood = 90; f.b.state.currentStatus = 'back home'; f.b.state.updatedAt = Date.now()
    resolve({ text: 'At the park' })
    await vi.waitFor(() => expect(f.data().moments).toHaveLength(1))
    expect(request.mock.calls[0][1]).toMatchObject({ mood: 25, currentStatus: 'at park' })
    expect(f.data().moments![0]).toMatchObject({ mood: 25, status: 'at park' })
  })
  it('generates a state-aware image post, persists likes and retains the image snapshot', async () => {
    const generate = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockResolvedValue({ text: 'At the park', image: { name: 'Park', description: 'A tree', file: 'https://example.test/park.png' } })
    const f = setup(); f.b.state.currentStatus = 'walking'; f.b.state.mood = 82
    f.el('#wt-moments').click(); f.el<HTMLSelectElement>('#wt-moments-author').value = 'avatar:b.png'; f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(f.data().moments).toHaveLength(1))
    expect(generate.mock.calls[0][1]).toMatchObject({ mood: 82, currentStatus: 'walking' })
    f.el<HTMLButtonElement>('.wt-moment button[aria-pressed]').click(); expect(f.data().moments![0].likedByPlayer).toBe(true)
    f.remount(); f.el('#wt-moments').click()
    expect(f.el('.wt-moment button[aria-pressed]').getAttribute('aria-pressed')).toBe('true')
    expect(f.el<HTMLImageElement>('.wt-moment-image').src).toBe('https://example.test/park.png')
  })
  it('cancels manual Moments when settings closes and ignores a late generated post', async () => {
    let resolve!: (value: { text: string }) => void
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockReturnValue(new Promise(done => { resolve = done }))
    const f = setup(); f.el('#wt-settings-btn').click(); f.el<HTMLSelectElement>('#wt-moments-author').value = 'avatar:b.png'; f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    f.el('#wt-settings-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(request.mock.calls[0][2]?.aborted).toBe(true)
    resolve({ text: 'late' }); await Promise.resolve(); await Promise.resolve()
    expect(f.data().moments ?? []).toHaveLength(0)
  })
  it('renders structured voice replies and expands their text when TTS is unavailable', async () => {
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue({ messages: [{ type: 'voice', content: 'Hello by voice' }] })
    const f = setup(); f.open(f.a.scopeKey!); send(f, 'hello')
    await vi.waitFor(() => expect(f.container.querySelector('.wt-voice')).not.toBeNull())
    f.el<HTMLButtonElement>('.wt-voice button').click()
    await vi.waitFor(() => expect(f.el<HTMLParagraphElement>('.wt-voice p').hidden).toBe(false))
    expect(f.el('.wt-voice p').textContent).toBe('Hello by voice')
  })
  it('passes raw text to the real host speak callback without parsing commands or macros', async () => {
    const callback = vi.fn().mockResolvedValue('')
    vi.stubGlobal('SillyTavern', { getContext: () => ({ extensionSettings: { tts: { enabled: true } }, SlashCommandParser: { commands: { speak: { callback } } } }) })
    const text = '/delete | {{user}} "literal"'
    await expect(speakWeChatText(text, 'B')).resolves.toBe(true)
    expect(callback).toHaveBeenCalledWith({ voice: 'B' }, text)
  })
  it('rejects network and malformed replies instead of silently creating an offline answer', async () => {
    const pipe = new WeChatPipeline({ apiKey: 'test-only' }, {}, {}, {})
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 503 }))
    const f = setup()
    await expect(pipe.requestContactReply([], f.a.state, 1, 'now')).rejects.toThrow('503')
    expect(() => pipe.parseReplyJson('{"messages":[]}')).toThrow('格式')
    expect(pipe.parseReplyJson('{"messages":[{"type":"voice","content":"spoken"}]}').messages[0]).toEqual({ type: 'voice', content: 'spoken' })
  })
})
