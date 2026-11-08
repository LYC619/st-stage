// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { WeChatPipeline } from './pipeline'
import { saveGroup } from './groups'
import type { LLMReplyPayload } from './types'

let f: ReturnType<typeof mountWeChat> | undefined
afterEach(() => { f?.app.unmount?.(); f = undefined; vi.restoreAllMocks(); vi.useRealTimers(); document.body.replaceChildren() })
function deferred() { let resolve!: (value: LLMReplyPayload) => void; return { promise: new Promise<LLMReplyPayload>(done => { resolve = done }), resolve } }
const reply = (text: string): LLMReplyPayload => ({ messages: [{ type: 'text', content: text }], currentStatus: text + ' status' })
const send = (text: string) => { f!.el<HTMLInputElement>('#wt-input-text').value = text; f!.el('#wt-send-btn').click() }
/** jsdom has no layout; give the log a fixed viewport (with browser-like clamping) so reading position can be asserted. */
function layout(scroll: HTMLElement, height = 1000, client = 300) {
  let top = 0
  Object.defineProperty(scroll, 'scrollHeight', { configurable: true, get: () => height })
  Object.defineProperty(scroll, 'clientHeight', { configurable: true, get: () => client })
  Object.defineProperty(scroll, 'scrollTop', { configurable: true, get: () => top, set: (value: number) => { top = Math.max(0, Math.min(value, height - client)) } })
  return { grow(by: number) { height += by } }
}

describe('chat status row', () => {
  it('stays hidden while idle, then shows typing and cancel in one row and a retry after failure', async () => {
    const work = deferred()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValueOnce(work.promise).mockRejectedValueOnce(new Error('offline'))
    f = mountWeChat(); f.open(f.a.scopeKey!)
    expect(f.el('#wt-chat-status').hidden).toBe(true)
    send('hello')
    expect(f.el('#wt-chat-status').hidden).toBe(false)
    expect(f.el('#wt-typing-badge').textContent).toBe('对方正在输入…')
    expect(f.el('#wt-cancel-reply').hidden).toBe(false); expect(f.el('#wt-cancel-reply').getAttribute('aria-label')).toBe('取消回复')
    work.resolve(reply('hi')); await vi.waitFor(() => expect(f!.el('#wt-chat-status').hidden).toBe(true))
    send('again'); await vi.waitFor(() => expect(f!.el('#wt-retry-reply').hidden).toBe(false))
    expect(f.el('#wt-chat-status').hidden).toBe(false); expect(f.el('#wt-typing-badge').hidden).toBe(true)
    expect(f.el('#wt-reply-error').textContent).toBe('offline')
  })

  it('names the member being asked in a group round and gives every member its own timeout window', async () => {
    vi.useFakeTimers()
    const first = deferred(), second = deferred()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise)
    f = mountWeChat(); const group = saveGroup(f.data(), 'Friends', Object.values(f.data().contacts!)); f.remount(); f.open(group.scopeKey!)
    send('everyone'); await vi.advanceTimersByTimeAsync(1)
    expect(f.el('#wt-typing-badge').textContent).toBe('A 正在输入…（1/2）')
    await vi.advanceTimersByTimeAsync(50000); first.resolve(reply('from A')); await vi.advanceTimersByTimeAsync(1)
    expect(f.el('#wt-typing-badge').textContent).toBe('B 正在输入…（2/2）')
    await vi.advanceTimersByTimeAsync(50000); second.resolve(reply('from B')); await vi.advanceTimersByTimeAsync(1)
    const saved = f.data().conversations![group.scopeKey!]
    expect(saved.messages.map(m => m.content)).toEqual(['everyone', 'from A', 'from B'])
    expect(saved.replyAttempt).toBeUndefined()
    expect(f.el('#wt-state-summary').textContent).toMatch(/^成员状态 · (A|B)：from (A|B) status$/)
  })

  it('keeps @ beside the status in groups and hides the whole row for an idle direct chat', () => {
    f = mountWeChat(); const group = saveGroup(f.data(), 'Friends', Object.values(f.data().contacts!)); f.remount(); f.open(group.scopeKey!)
    expect(f.el('#wt-chat-status').hidden).toBe(false); expect(f.el('#wt-chat-tools').hidden).toBe(false)
    expect(f.el('#wt-chat-status').contains(f.el('#wt-mention'))).toBe(true)
    f.open(f.b.scopeKey!); expect(f.el('#wt-chat-status').hidden).toBe(true)
  })
})

describe('message list rendering', () => {
  it('appends replies without rebuilding earlier rows and follows the conversation at its end', async () => {
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue(reply('answer'))
    f = mountWeChat(); f.a.messages.push({ sender: 'contact', type: 'text', content: 'earlier', time: { day: 1, hour: 1, minute: 0 } }); f.open(f.a.scopeKey!)
    const scroll = f.el('#wt-scroll'), size = layout(scroll); scroll.scrollTop = 700
    const earlier = scroll.firstElementChild
    size.grow(200); send('question'); await vi.waitFor(() => expect(f!.a.messages).toHaveLength(3))
    expect(scroll.firstElementChild).toBe(earlier)
    expect(scroll.children).toHaveLength(3)
    expect(scroll.scrollTop).toBe(900); expect(f.el('#wt-jump-latest').hidden).toBe(true)
  })

  it('keeps the reading position when a reply arrives above the fold and offers a jump to it', async () => {
    const work = deferred()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValue(work.promise)
    f = mountWeChat(); f.open(f.a.scopeKey!)
    const scroll = f.el('#wt-scroll'), size = layout(scroll); send('question')
    scroll.scrollTop = 100
    size.grow(150); work.resolve(reply('late answer')); await vi.waitFor(() => expect(f!.a.messages).toHaveLength(2))
    expect(scroll.scrollTop).toBe(100)
    const jump = f.el<HTMLButtonElement>('#wt-jump-latest'); expect(jump.hidden).toBe(false)
    jump.click(); expect(scroll.scrollTop).toBe(850); expect(jump.hidden).toBe(true); expect(document.activeElement).toBe(scroll)
  })

  it('shows a prompt in an empty conversation and the speaker in group list previews', async () => {
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue(reply('group hello'))
    f = mountWeChat(); f.open(f.b.scopeKey!)
    expect(f.el('#wt-scroll .wt-chat-empty').textContent).toBe('给 B 发条消息吧。')
    const group = saveGroup(f.data(), 'Friends', [f.data().contacts!['avatar:b.png'], f.data().contacts!['avatar:a.png']]); f.remount(); f.open(group.scopeKey!)
    send('hi'); await vi.waitFor(() => expect(f!.data().conversations![group.scopeKey!].messages).toHaveLength(3))
    f.el('#wt-back').click()
    const row = f.el(`[data-conversation="${group.scopeKey}"]`)
    expect(row.querySelector('.wt-conversation-preview')!.textContent).toMatch(/^(A|B): group hello$/)
    expect(row.querySelector('.wt-conversation-time')!.textContent).toMatch(/^\d{2}:\d{2}$/)
  })
})

describe('phone back and settings entry', () => {
  it('steps back through the emoji drawer and chat before letting the shell go home', () => {
    f = mountWeChat(); f.open(f.a.scopeKey!)
    f.el('#wt-emoji-btn').click(); expect(f.el('#wt-emoji-drawer').hidden).toBe(false)
    expect(f.app.back?.()).toBe(true); expect(f.el('#wt-emoji-drawer').hidden).toBe(true)
    expect(f.app.back?.()).toBe(true); expect(f.el('#wt-chat').hidden).toBe(true); expect(f.el('#wt-conversations').hidden).toBe(false)
    f.el('#wt-plus').click(); expect(f.app.back?.()).toBe(true); expect(f.el('#wt-plus-menu').hidden).toBe(true)
    expect(f.app.back?.()).toBe(false)
    f.app.unmount?.(); expect(f.app.back?.()).toBe(false)
  })

  it('offers the AI connection from demo mode and opens it first in settings', () => {
    f = mountWeChat()
    expect(f.el('#wt-notice-bar').hidden).toBe(false); expect(f.el('#wt-connect-ai').hidden).toBe(false)
    f.el('#wt-connect-ai').click()
    const ai = f.el<HTMLDetailsElement>('#wt-ai-settings')
    expect(ai.open).toBe(true); expect(document.activeElement).toBe(f.el('#wt-cfg-key'))
    expect(f.el('#wt-ai-summary').textContent).toBe('AI 连接 · 未连接（本地演示）')
    expect(ai.compareDocumentPosition(f.el('#wt-profile-container')) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    f.el<HTMLInputElement>('#wt-cfg-key').value = 'test-only'; f.el<HTMLInputElement>('#wt-cfg-model').value = 'fixture-model'
    f.el('#wt-btn-save-settings').click()
    expect(f.el('#wt-ai-summary').textContent).toBe('AI 连接 · 已配置 fixture-model')
    expect(f.el('#wt-notice-bar').hidden).toBe(true)
    f.el('#wt-close-settings').click(); f.el('#wt-settings-btn').click(); expect(ai.open).toBe(false)
  })

  it('lists groups with their mosaic and member count and friends with their latest status', () => {
    f = mountWeChat(); f.b.state.currentStatus = '在码头散步'; f.b.state.updatedAt = Date.now()
    const group = saveGroup(f.data(), 'Friends', Object.values(f.data().contacts!)); f.remount()
    f.el('#wt-tab-contacts').click()
    const groupRow = [...f.container.querySelectorAll<HTMLElement>('#wt-address-book .wt-conversation')].find(node => node.textContent?.includes(group.title))!
    expect(groupRow.querySelector('.wt-group-avatar')?.children).toHaveLength(2)
    expect(groupRow.textContent).toContain('2 位成员')
    expect(f.el('[data-friend="avatar:b.png"]').textContent).toContain('在码头散步')
  })
})
