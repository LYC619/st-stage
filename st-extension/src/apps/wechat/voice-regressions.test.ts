// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { WeChatPipeline } from './pipeline'
import type { ChatMessage, LLMReplyPayload } from './types'

let fixture: ReturnType<typeof mountWeChat> | undefined
afterEach(() => {
  fixture?.app.unmount?.(); fixture = undefined
  vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); document.body.replaceChildren()
})
function deferred<T>() {
  let resolve!: (value: T) => void
  return { promise: new Promise<T>(done => { resolve = done }), resolve: (value: T) => resolve(value) }
}
const voice = (content = 'Readable voice', id = 'voice-1'): ChatMessage => ({ id, sender: 'contact', type: 'voice', content, time: { day: 1, hour: 19, minute: 0 } })
function mount() {
  const f = fixture = mountWeChat()
  f.a.messages.push(voice()); f.open(f.a.scopeKey!)
  return f
}
function host(callback?: (args: { voice: string }, text: string) => Promise<unknown>, enabled = true) {
  vi.stubGlobal('SillyTavern', { getContext: () => ({ extensionSettings: { tts: { enabled } }, SlashCommandParser: { commands: { speak: { callback } } } }) })
}
const play = (f: ReturnType<typeof mount>) => f.el<HTMLButtonElement>('.wt-voice button')
const toggle = (f: ReturnType<typeof mount>) => f.el<HTMLButtonElement>('.wt-voice button:nth-child(2)')
const transcript = (f: ReturnType<typeof mount>) => f.el<HTMLParagraphElement>('.wt-voice p')
const status = (f: ReturnType<typeof mount>) => f.el('.wt-voice [role="status"]')

describe('voice host handoff feedback', () => {
  it.each(['missing', 'disabled'])('keeps text readable when ST accepts speak but the voice is %s', async mode => {
    const queued = vi.fn()
    // ST 1.18 onNarrateText returns early for absent/disabled voiceMap entries;
    // its registered speak callback still fulfills with ''. Neither is a playback receipt.
    const voiceMap: Record<string, string | undefined> = { A: mode === 'disabled' ? '[Disabled]' : undefined }
    const onNarrateText = async ({ voice: name }: { voice: string }, text: string) => {
      const entry = voiceMap[name]
      if (entry === '[Disabled]' || !entry) return
      queued(text)
    }
    const callback = vi.fn(async (args: { voice: string }, text: string) => { await onNarrateText(args, text); return '' })
    host(callback); const f = mount(); play(f).click()
    await vi.waitFor(() => expect(play(f).disabled).toBe(false))
    expect(queued).not.toHaveBeenCalled(); expect(callback).toHaveBeenCalledOnce()
    expect(transcript(f).hidden).toBe(false)
    expect(status(f).textContent).toContain('无法确认')
    expect(status(f).textContent).not.toContain('已交给酒馆 TTS 播放')
  })

  it.each(['disabled', 'missing-callback'])('retains readable text with %s and does not invoke TTS', async mode => {
    const callback = vi.fn().mockResolvedValue('')
    host(mode === 'missing-callback' ? undefined : callback, mode !== 'disabled')
    const f = mount(); play(f).click()
    await vi.waitFor(() => expect(play(f).disabled).toBe(false))
    expect(callback).not.toHaveBeenCalled(); expect(transcript(f).hidden).toBe(false)
    expect(status(f).textContent).toContain('TTS 未启用')
  })

  it('leaves rejected requests readable and retryable', async () => {
    const callback = vi.fn().mockRejectedValueOnce(new Error('provider failed')).mockResolvedValue('')
    host(callback); const f = mount(); play(f).click()
    await vi.waitFor(() => expect(status(f).textContent).toContain('失败'))
    expect(transcript(f).hidden).toBe(false); expect(play(f).disabled).toBe(false)
    play(f).click()
    await vi.waitFor(() => expect(status(f).textContent).toContain('无法确认'))
    expect(callback).toHaveBeenCalledTimes(2)
  })

  it('shows readable text immediately while a host callback is pending', () => {
    host(() => new Promise(() => {})); const f = mount(); play(f).click()
    expect(play(f).disabled).toBe(true); expect(transcript(f).hidden).toBe(false)
  })

  it('unlocks a timed-out handoff and ignores its late result after a retry', async () => {
    vi.useFakeTimers()
    const old = deferred<string>()
    const callback = vi.fn().mockReturnValueOnce(old.promise).mockRejectedValueOnce(new Error('retry failed'))
    host(callback); const f = mount(); play(f).click()
    await vi.advanceTimersByTimeAsync(15001)
    expect(play(f).disabled).toBe(false); expect(transcript(f).hidden).toBe(false)
    expect(status(f).textContent).toContain('超时')
    play(f).click(); await vi.advanceTimersByTimeAsync(1)
    expect(status(f).textContent).toContain('失败')
    old.resolve(''); await vi.advanceTimersByTimeAsync(1)
    expect(status(f).textContent).toContain('失败'); expect(play(f).disabled).toBe(false)
  })
})

describe('voice message lifecycle', () => {
  it('preserves expanded text and keyboard focus when a pending reply finishes', async () => {
    const reply = deferred<LLMReplyPayload>()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValue(reply.promise)
    const f = mount(); f.el<HTMLInputElement>('#wt-input-text').value = 'reply please'; f.el('#wt-send-btn').click()
    const original = toggle(f); original.click(); original.focus()
    reply.resolve({ messages: [{ type: 'text', content: 'new reply' }] })
    await vi.waitFor(() => expect(f.a.messages.at(-1)?.content).toBe('new reply'))
    expect(transcript(f).hidden).toBe(false)
    expect(document.activeElement).toBe(toggle(f)); expect(toggle(f)).toBe(original)
  })

  it('keeps pending handoff state through reply updates without making a second call', async () => {
    const reply = deferred<LLMReplyPayload>(), handoff = deferred<string>()
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockReturnValue(reply.promise)
    const callback = vi.fn(() => handoff.promise); host(callback)
    const f = mount(); f.el<HTMLInputElement>('#wt-input-text').value = 'reply'; f.el('#wt-send-btn').click()
    const original = play(f); original.click()
    reply.resolve({ messages: [{ type: 'text', content: 'done' }] })
    await vi.waitFor(() => expect(f.a.messages.at(-1)?.content).toBe('done'))
    expect(play(f)).toBe(original); expect(play(f).disabled).toBe(true)
    play(f).click(); expect(callback).toHaveBeenCalledOnce()
    handoff.resolve(''); await vi.waitFor(() => expect(play(f).disabled).toBe(false))
    expect(transcript(f).hidden).toBe(false)
  })

  it('isolates equal message IDs across conversations and settles hidden handoffs', async () => {
    const handoff = deferred<string>(); host(() => handoff.promise)
    const f = mount(); f.b.messages.push(voice('B voice'))
    const aButton = play(f); aButton.click(); f.open(f.b.scopeKey!)
    expect(transcript(f).textContent).toBe('B voice'); expect(transcript(f).hidden).toBe(true)
    expect(play(f).disabled).toBe(false)
    handoff.resolve(''); await vi.waitFor(() => expect(aButton.disabled).toBe(false))
    expect(status(f).textContent).toBe('')
    f.open(f.a.scopeKey!)
    expect(play(f)).toBe(aButton); expect(transcript(f).hidden).toBe(false)
    expect(status(f).textContent).toContain('无法确认')
  })

  it.each(['clear', 'unmount'])('disposes an unfinished voice handoff on %s without late UI updates', async action => {
    const handoff = deferred<string>(); host(() => handoff.promise)
    const f = mount(), removed = f.a.messages[0], button = play(f), oldStatus = status(f)
    button.click()
    if (action === 'clear') {
      f.el('#wt-settings-btn').click(); f.el('#wt-btn-clear-chat').click(); f.el('#wt-btn-clear-chat').click()
      f.el('#wt-close-settings').click()
    } else f.app.unmount?.()
    expect(button.disabled).toBe(false)
    const text = oldStatus.textContent
    handoff.resolve(''); await Promise.resolve(); await Promise.resolve(); await Promise.resolve()
    expect(oldStatus.textContent).toBe(text)
    if (action === 'clear') {
      f.a.messages.push(removed); f.open(f.a.scopeKey!)
      expect(play(f)).not.toBe(button); expect(status(f).textContent).toBe('')
    }
  })
})
