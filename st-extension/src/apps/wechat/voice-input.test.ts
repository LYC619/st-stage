// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { WeChatPipeline } from './pipeline'
import { saveGroup } from './groups'

class Recognition {
  static latest: Recognition
  lang = ''; continuous = true; interimResults = false
  onresult: ((event: { results: { isFinal: boolean; 0: { transcript: string } }[] }) => void) | null = null
  onerror: ((event: { error: string }) => void) | null = null
  onend: (() => void) | null = null
  constructor() { Recognition.latest = this }
  start = vi.fn()
  stop = vi.fn(() => this.onend?.())
  abort = vi.fn()
  result(text: string, isFinal = true) { this.onresult?.({ results: [{ isFinal, 0: { transcript: text } }] }) }
}
let f: ReturnType<typeof mountWeChat>
afterEach(() => { f?.app.unmount?.(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren() })
function setup(supported = true) {
  vi.stubGlobal('SpeechRecognition', supported ? Recognition : undefined); vi.stubGlobal('webkitSpeechRecognition', undefined)
  vi.stubGlobal('isSecureContext', true)
  vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue({ messages: [{ type: 'text', content: '收到' }] })
  f = mountWeChat(); f.open(f.b.scopeKey!); return f
}
it('records into a draft, preserves interim text as unsent, and sends only after confirmation', async () => {
  setup(); f.el('#wt-voice-mode').click(); expect(f.el('#wt-input-text').hidden).toBe(true)
  expect(f.el('#wt-voice-mode').parentElement!.firstElementChild).toBe(f.el('#wt-voice-mode'))
  f.el('#wt-record').focus(); f.el('#wt-record').click()
  const recognition = Recognition.latest
  recognition.result('识别中', false)
  expect(f.b.messages).toHaveLength(0); expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('')
  recognition.result('去湖边走走'); f.el('#wt-record').click()
  expect(f.b.messages).toHaveLength(0); expect(f.b.draft).toBe('去湖边走走')
  expect(document.activeElement).toBe(f.el('#wt-input-text'))
  f.el<HTMLInputElement>('#wt-input-text').value += '。'; f.el('#wt-send-btn').click()
  await vi.waitFor(() => expect(f.b.messages).toHaveLength(2))
  expect(f.b.messages[0]).toMatchObject({ type: 'voice', content: '去湖边走走。' })
  expect(f.el('#wt-record').hidden).toBe(false)
})
it.each(['unsupported','not-allowed','no-speech','network'])('keeps a usable typed voice fallback for %s', async reason => {
  setup(reason !== 'unsupported'); f.el<HTMLInputElement>('#wt-input-text').value = '原草稿'
  f.el('#wt-voice-mode').click()
  if (reason !== 'unsupported') { f.el('#wt-voice-edit').click(); f.el('#wt-record').click(); Recognition.latest.onerror?.({ error: reason }) }
  expect(f.el('#wt-input-text').hidden).toBe(false); expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('原草稿')
  expect(f.el('#wt-voice-status').textContent).toMatch(/手动输入|语音文字/)
  f.el('#wt-send-btn').click(); await vi.waitFor(() => expect(f.b.messages).toHaveLength(2))
  expect(f.b.messages[0]).toMatchObject({ type: 'voice', content: '原草稿' })
})
it.each(['navigate','toggle','dialog','unmount'])('aborts capture on %s and ignores late recognition without overwriting a draft', action => {
  setup(); f.el('#wt-voice-mode').click(); f.el('#wt-record').click()
  const old = Recognition.latest, result = old.onresult!, end = old.onend!
  if (action === 'navigate') f.open(f.a.scopeKey!)
  if (action === 'toggle') f.el('#wt-voice-mode').click()
  if (action === 'dialog') f.el('#wt-settings-btn').click()
  if (action === 'unmount') f.app.unmount?.()
  expect(old.abort).toHaveBeenCalledOnce()
  f.el<HTMLInputElement>('#wt-input-text').value = '新的文字'
  result({ results: [{ isFinal: true, 0: { transcript: '迟到语音' } }] }); end()
  expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('新的文字'); expect(f.b.messages).toHaveLength(0)
})
it('times out stalled recognition and permits another attempt', () => {
  vi.useFakeTimers(); setup(); f.el('#wt-voice-mode').click(); f.el('#wt-record').click()
  const old = Recognition.latest; vi.advanceTimersByTime(60001)
  expect(old.abort).toHaveBeenCalledOnce(); expect(f.el('#wt-voice-status').textContent).toContain('超时')
  f.el('#wt-voice-edit').click(); f.el('#wt-record').click(); expect(Recognition.latest).not.toBe(old)
})
it('keeps @ keyboard selection in groups and switches from recognition to an editable mention draft', () => {
  setup(); expect(f.el('#wt-chat-tools').hidden).toBe(true)
  const group = saveGroup(f.data(), '好友', Object.values(f.data().contacts!)); f.remount(); f.open(group.scopeKey!)
  expect(f.el('#wt-chat-tools').hidden).toBe(false)
  f.el('#wt-voice-mode').click(); f.el('#wt-record').click(); const old = Recognition.latest
  const select = f.el<HTMLSelectElement>('#wt-mention'); select.value = 'avatar:b.png'; select.dispatchEvent(new Event('change'))
  expect(old.abort).toHaveBeenCalledOnce(); expect(document.activeElement).toBe(f.el('#wt-input-text'))
  expect(f.el('#wt-voice-mode').getAttribute('aria-pressed')).toBe('false')
  expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('@[avatar:b.png] ')
  f.open(f.b.scopeKey!); expect(f.el('#wt-chat-tools').hidden).toBe(true)
})
it('selects a four- or nine-cell avatar without changing group membership or labels', () => {
  setup()
  for (const count of [2,4,5,9,12]) {
    const members = Array.from({ length: count }, (_, i) => ({ id: `avatar:m${i}.png`, name: `Member ${i}`, card: { avatar: `m${i}.png` } }))
    saveGroup(f.data(), `Group ${count}`, members)
  }
  f.remount()
  for (const count of [2,4,5,9,12]) {
    const row = [...f.container.querySelectorAll<HTMLElement>('[data-conversation]')].find(node => node.textContent?.includes(`Group ${count}`))!
    const picture = row.querySelector<HTMLElement>('.wt-group-avatar')!
    expect(picture.children).toHaveLength(Math.min(count,9)); expect(picture.dataset.columns).toBe(count <= 4 ? '2' : '3')
    expect(row.querySelector('.wt-conversation-title')!.textContent).toBe(`Group ${count}`)
  }
})
