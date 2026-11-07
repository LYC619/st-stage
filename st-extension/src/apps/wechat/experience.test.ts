// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { WeChatPipeline } from './pipeline'
import { getScopedConversation } from './legacy-conversation'
import { extractFieldsFromObject } from './bridge'
import type { LLMReplyPayload, WeChatAppData } from './types'

let fixture: ReturnType<typeof mountWeChat> | undefined
afterEach(() => { fixture?.app.unmount?.(); fixture = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren() })
const setup = (data?: WeChatAppData) => (fixture = mountWeChat(data))
function deferred() { let resolve!: (value: LLMReplyPayload) => void; const promise = new Promise<LLMReplyPayload>(done => { resolve = done }); return { promise, resolve } }
const reply = (text: string): LLMReplyPayload => ({ messages: [{ type: 'text', content: text }], innerThought: `${text} thought`, currentStatus: `${text} status` })

describe('WeChat independent conversation experience', () => {
  it('starts with the list, sends to B while host A stays active and never reads host variables/history', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue(reply('B reply'))
    const f = setup(); expect(f.el('#wt-chat').hidden).toBe(true)
    expect(f.el('#wt-conversations').hidden).toBe(false)
    f.open(f.b.scopeKey!)
    f.el<HTMLInputElement>('#wt-input-text').value = 'hello B'; f.el('#wt-send-btn').click()
    await vi.waitFor(() => expect(f.b.messages).toHaveLength(2))
    expect(request).toHaveBeenCalledOnce()
    const scope = request.mock.calls[0][4]
    expect(scope).toMatchObject({ characterName: 'B', card: { description: 'PRIVATE_PERSONA_B' } })
    expect(JSON.stringify(scope)).not.toContain('PRIVATE_MAIN_CHAT_A')
    expect(f.getVariables).not.toHaveBeenCalled()
    expect(f.ctx.getCharacterName()).toBe('A'); expect(f.a.messages).toHaveLength(0)
    expect(f.b.state.innerThought).toBe('B reply thought')
    expect(f.el('#wt-current-status').textContent).toBe('B reply status')
    f.hostChange('C'); expect(f.el('#wt-contact-name').textContent).toBe('B')
    f.remount(); f.open(f.b.scopeKey!); expect(f.el('#wt-inner-thought').textContent).toBe('B reply thought')
  })
  it('routes simultaneous pending replies to their originating conversations, with unread counts and separate drafts', async () => {
    const a = deferred(), b = deferred()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise)
    const f = setup(); f.open(f.a.scopeKey!); f.el<HTMLInputElement>('#wt-input-text').value = 'to A'; f.el('#wt-send-btn').click()
    f.el<HTMLInputElement>('#wt-input-text').value = 'A draft'
    f.open(f.b.scopeKey!); expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('')
    f.el<HTMLInputElement>('#wt-input-text').value = 'to B'; f.el('#wt-send-btn').click(); f.el<HTMLInputElement>('#wt-input-text').value = 'B draft'
    a.resolve(reply('A answer')); await vi.waitFor(() => expect(f.a.unreadCount).toBe(1))
    expect(f.el('#wt-scroll').textContent).not.toContain('A answer')
    b.resolve(reply('B answer')); await vi.waitFor(() => expect(f.el('#wt-scroll').textContent).toContain('B answer'))
    f.open(f.a.scopeKey!); expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('A draft'); expect(f.a.unreadCount).toBe(0)
    f.open(f.b.scopeKey!); expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('B draft')
  })
  it.each(['unmount', 'clear'] as const)('rejects late reply after %s and aborts the request', async mode => {
    const work = deferred(), request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValue(work.promise)
    const f = setup(); f.open(f.a.scopeKey!); f.el<HTMLInputElement>('#wt-input-text').value = 'hello'; f.el('#wt-send-btn').click()
    if (mode === 'unmount') f.app.unmount?.()
    else { f.el('#wt-settings-btn').click(); f.el('#wt-btn-clear-chat').click(); f.el('#wt-btn-clear-chat').click() }
    expect(request.mock.calls[0][5]?.aborted).toBe(true)
    work.resolve(reply('LATE')); await Promise.resolve(); await Promise.resolve()
    expect(f.a.messages.some(item => item.content === 'LATE')).toBe(false)
    expect(f.a.state.currentStatus).toBeUndefined()
    if (mode === 'clear') expect(f.a.messages).toHaveLength(0)
  })
  it('protects IME input and blocks duplicate sends while preserving the next draft', async () => {
    const work = deferred(), request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValue(work.promise)
    const f = setup(); f.open(f.a.scopeKey!); const input = f.el<HTMLInputElement>('#wt-input-text'); input.value = '你好'
    input.dispatchEvent(new CompositionEvent('compositionstart'))
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(request).not.toHaveBeenCalled()
    input.dispatchEvent(new CompositionEvent('compositionend')); input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    input.value = 'next draft'; input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(request).toHaveBeenCalledOnce(); expect(input.value).toBe('next draft')
    work.resolve(reply('hello')); await Promise.resolve()
  })
  it('sends arbitrary gift content and note without mutating legacy wallet or external state', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue(reply('Thanks'))
    const f = setup(); f.a.state.money = 1000; f.a.state.hasExternalState = true; f.a.state.externalFields = { money: true }
    f.open(f.a.scopeKey!); f.el('#wt-packet-btn').click()
    f.el<HTMLInputElement>('#wt-custom-amt').value = '一张去火星的船票'; f.el<HTMLTextAreaElement>('#wt-packet-note').value = '一起出发'
    f.el('#wt-confirm-packet').click(); await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    expect(f.a.messages[0]).toMatchObject({ type: 'red_packet', content: '一张去火星的船票', note: '一起出发' })
    expect(f.el('#wt-scroll').textContent).toContain('一起出发'); expect(f.a.state.money).toBe(1000)
    expect(f.el('#wt-scroll').textContent).not.toContain('已存入钱包')
    const prompt = new WeChatPipeline({}, {}, {}, {}).buildContextMessages(f.a.messages, f.a.state, 1, '12:00', 'A')
    expect(JSON.stringify(prompt)).toContain('一起出发')
  })
  it('performs only one real fetch for reply and state, preserving absent state fields', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify({ messages: [{ type: 'text', content: 'Reply' }], current_status: 'reading' }) } }] }) })
    vi.stubGlobal('fetch', fetcher)
    const f = setup({ config: { apiKey: 'test-only', apiUrl: 'https://example.test/chat/completions' } }); f.a.state.innerThought = 'previous'
    f.open(f.a.scopeKey!); f.el<HTMLInputElement>('#wt-input-text').value = 'hello'; f.el('#wt-send-btn').click()
    await vi.waitFor(() => expect(f.a.state.currentStatus).toBe('reading'))
    expect(fetcher).toHaveBeenCalledOnce(); expect(f.a.state.innerThought).toBe('previous')
    expect(JSON.stringify(fetcher.mock.calls)).not.toContain('PRIVATE_MAIN_CHAT_A')
  })
  it('saves visible prompts, previews actual card substitution, restores defaults and reports invalid saves', async () => {
    const f = setup(); f.open(f.b.scopeKey!); f.el('#wt-settings-btn').click()
    const prompt = f.el<HTMLTextAreaElement>('textarea[aria-label="聊天提示词"]')
    expect(prompt.value).toContain('{角色}')
    prompt.value = 'CUSTOM {角色} {人设}'
    const button = (text: string) => [...f.container.querySelectorAll<HTMLButtonElement>('button')].find(btn => btn.textContent === text)!
    button('预览实际发送的提示词').click()
    expect(f.el<HTMLTextAreaElement>('textarea[aria-label="实际提示词预览"]').value).toContain('CUSTOM B PRIVATE_PERSONA_B')
    f.el('#wt-btn-save-settings').click(); expect(f.el('#wt-settings-feedback').textContent).toContain('已保存')
    f.el('#wt-close-settings').click(); f.remount(); f.open(f.b.scopeKey!); f.el('#wt-settings-btn').click()
    expect(f.el<HTMLTextAreaElement>('textarea[aria-label="聊天提示词"]').value).toBe('CUSTOM {角色} {人设}')
    button('恢复默认聊天提示词').click(); f.el('#wt-btn-save-settings').click()
    expect(f.data().config.profile?.replyPrompt).toBe('')
    f.el<HTMLInputElement>('#wt-cfg-key').value = 'test'; f.el<HTMLInputElement>('#wt-cfg-url').value = 'javascript:bad'
    f.el('#wt-btn-save-settings').click(); expect(f.el('#wt-settings-feedback').textContent).toContain('未保存')
    expect(f.data().config.apiKey).toBe('')
  })
  it('imports a selected gallery image as a usable emoji and retains its sent snapshot', async () => {
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue(reply('Hi'))
    const f = setup(); f.settings.packs.push({ id: 'gallery', name: '旅行', sprites: [{ tag: '船票', url: 'https://example.test/ticket.png' }] })
    f.open(f.b.scopeKey!); f.el('#wt-settings-btn').click()
    const gallery = f.el<HTMLSelectElement>('select[aria-label="从图库选择图片"]'); gallery.value = '0'
    const add = [...f.container.querySelectorAll<HTMLButtonElement>('button')].find(btn => btn.textContent === '添加图库图片')!
    add.click(); f.el<HTMLInputElement>('input[aria-label="素材显示名"]').value = '一起旅行'
    f.el('#wt-btn-save-settings').click(); f.el('#wt-close-settings').click(); f.el('#wt-emoji-btn').click()
    const choice = [...f.container.querySelectorAll<HTMLButtonElement>('#wt-emoji-grid button')].find(btn => btn.getAttribute('aria-label') === '一起旅行')!
    expect(choice).toBeDefined(); choice.click()
    await vi.waitFor(() => expect(f.b.messages[0].asset?.file).toBe('https://example.test/ticket.png'))
    expect(f.b.messages[0].asset?.name).toBe('一起旅行')
    f.data().config.profile = { assetGroups: { player: false, contact: false, photo: false } }
    f.remount(); f.open(f.b.scopeKey!); expect(f.el<HTMLImageElement>('#wt-scroll .wt-media img').src).toBe('https://example.test/ticket.png')
  })
  it('times out safely and allows another send without accepting the old completion', async () => {
    vi.useFakeTimers(); const work = deferred()
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValueOnce(work.promise).mockResolvedValue(reply('new'))
    const f = setup(); f.open(f.a.scopeKey!); f.el<HTMLInputElement>('#wt-input-text').value = 'first'; f.el('#wt-send-btn').click()
    await vi.advanceTimersByTimeAsync(60001)
    expect(request.mock.calls[0][5]?.aborted).toBe(true)
    expect(f.el<HTMLButtonElement>('#wt-send-btn').disabled).toBe(false)
    f.el<HTMLInputElement>('#wt-input-text').value = 'retry'; f.el('#wt-send-btn').click(); await Promise.resolve()
    work.resolve(reply('OLD')); await Promise.resolve()
    expect(f.a.messages.some(msg => msg.content === 'OLD')).toBe(false)
  })
  it('keeps old name-key and scope-key histories intact alongside new direct contacts', () => {
    const data: WeChatAppData = { config: {} }
    const old = getScopedConversation(data, 'Same'); old.messages[0].content = 'OLD_HISTORY'
    const f = setup(data)
    expect(f.data().conversations?.Same).toBe(old); expect(Object.keys(f.data().conversations!)).toHaveLength(3)
    f.open('Same'); expect(f.el('#wt-scroll').textContent).toContain('OLD_HISTORY')
    f.open(f.a.scopeKey!); expect(f.el('#wt-scroll').textContent).not.toContain('OLD_HISTORY')
  })
  it('migrates flat legacy history to its recorded owner and preserves tuple bridge behavior', () => {
    const data: WeChatAppData = { config: {}, activeCharacter: 'Previous', messages: [{ sender: 'player', type: 'text', content: 'PRIVATE_OLD', time: { day: 2, hour: 1, minute: 0 } }], currentDay: 2 }
    const f = setup(data)
    expect(f.data().messages).toBeUndefined(); expect(f.data().conversations?.Previous.messages[0].content).toBe('PRIVATE_OLD')
    expect(f.a.messages).toHaveLength(0)
    const fields = extractFieldsFromObject({ Alice: { mood: 'calm', happiness: [82, 'description'] }, mood: 12 }, 'Alice')
    expect(fields.mood).toBe(82); expect(fields.mappedFields.mood).toBe(true)
  })
})
