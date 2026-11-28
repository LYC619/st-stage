// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { speakWeChatText } from './bridge'
import { addContactConversation } from './conversations'
import { saveGroup } from './groups'
import { addMoment } from './moments'
import { createMomentsController } from './moments-controller'
import { WeChatPipeline } from './pipeline'
import { mountWeChat } from './test-fixture'
import type { ChatMessage, LLMReplyPayload, WeChatAppData } from './types'

let fixture: ReturnType<typeof mountWeChat> | undefined
const activeControllers: Array<{ destroy(): void }> = []

afterEach(() => {
  fixture?.app.unmount?.()
  fixture = undefined
  for (const ctrl of activeControllers.splice(0)) ctrl.destroy()
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  document.body.replaceChildren()
})

function deferred<T>() {
  let resolve!: (value: T) => void
  return { promise: new Promise<T>((done) => { resolve = done }), resolve }
}

function pressKey(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  document.activeElement!.dispatchEvent(event)
  return event
}

describe('keyboard focus traps, media retry & Moments lifecycle', () => {
  it('traps focus in gift/emoji/lightbox overlays, restores focus across incoming replies, and cleans up on unmount', async () => {
    let finishReply!: (v: LLMReplyPayload) => void
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockImplementation(() => new Promise((r) => { finishReply = r }))
    const f = fixture = mountWeChat()
    f.a.messages.push({ sender: 'contact', type: 'image', content: 'bedroom1', time: { day: 1, hour: 19, minute: 0 } })
    f.open(f.a.scopeKey!)

    const packetBtn = f.el('#wt-packet-btn')
    packetBtn.focus()
    packetBtn.click()
    expect(document.activeElement).toBe(f.el('#wt-custom-amt'))
    f.el('#wt-packet-close').focus()
    pressKey('Tab', true)
    expect(document.activeElement).toBe(f.el('#wt-confirm-packet'))
    expect(pressKey('Escape').defaultPrevented).toBe(true)
    expect(document.activeElement).toBe(packetBtn)

    const emojiBtn = f.el('#wt-emoji-btn')
    emojiBtn.click()
    f.el('#wt-tab-contact').click()
    const choice = f.el('#wt-emoji-grid button')
    const chosenSrc = choice.querySelector('img')!.src
    choice.click()
    expect(f.el('#wt-emoji-drawer').hidden).toBe(true)
    expect(document.activeElement).toBe(emojiBtn)

    const photoBtn = f.el<HTMLButtonElement>('#wt-scroll button')
    photoBtn.click()
    finishReply({ messages: [{ type: 'text', content: 'new reply' }] })
    await vi.waitFor(() => expect(f.el('#wt-scroll').textContent).toContain('new reply'))
    pressKey('Escape')
    expect(document.activeElement).toBe(photoBtn)

    f.data().config.profile = { assetGroups: { player: true, contact: false, photo: false } }
    f.remount()
    f.open(f.a.scopeKey!)
    expect(f.el<HTMLImageElement>('#wt-scroll .wt-media:nth-of-type(1) img, #wt-scroll img') !== null).toBe(true)
    expect([...f.container.querySelectorAll<HTMLImageElement>('#wt-scroll img')].some((img) => img.src === chosenSrc)).toBe(true)

    f.el('#wt-settings-btn').click()
    f.app.unmount?.()
    f.container.remove()
    const outside = document.createElement('button')
    document.body.append(outside)
    outside.focus()
    expect(pressKey('Escape').defaultPrevented).toBe(false)
  })

  it('recovers failed chat/Moments images, freezes Moment state snapshot, cancels on Escape, and enforces 200-post cap', async () => {
    const photo = { name: '旅行照片', description: '湖边的树', file: 'https://example.test/lake.png' }
    const f = fixture = mountWeChat()
    f.b.messages.push({ sender: 'contact', type: 'image', content: 'lake', asset: { ...photo }, time: { day: 1, hour: 12, minute: 0 } })
    f.open(f.b.scopeKey!)

    const mediaBtn = f.el<HTMLButtonElement>('.wt-media')
    const mediaImg = mediaBtn.querySelector('img')!
    mediaImg.dispatchEvent(new Event('error'))
    expect(mediaBtn.textContent).toContain('图片加载失败')
    mediaBtn.click()
    mediaImg.dispatchEvent(new Event('load'))
    expect(mediaImg.hidden).toBe(false)
    mediaBtn.click()
    expect(f.el('#wt-photo-lightbox').hidden).toBe(false)
    f.el('#wt-close-lightbox').click()

    const contactB = f.data().contacts!['avatar:b.png']
    for (let i = 0; i < 200; i++) addMoment(f.data(), contactB, `old ${i}`)
    const momentWork = deferred<{ text: string }>()
    const reqMoment = vi.spyOn(WeChatPipeline.prototype, 'requestMoment')
      .mockReturnValueOnce(momentWork.promise)
      .mockReturnValueOnce(new Promise(() => {}))

    f.b.state.mood = 25
    f.b.state.currentStatus = 'at park'
    f.el('#wt-moments').click()
    f.el<HTMLSelectElement>('#wt-moments-author').value = 'avatar:b.png'
    f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(reqMoment).toHaveBeenCalledOnce())
    f.b.state.mood = 90
    momentWork.resolve({ text: 'At the park' })
    await vi.waitFor(() => expect(f.data().moments![0].text).toBe('At the park'))
    expect(f.data().moments![0]).toMatchObject({ mood: 25, status: 'at park' })
    expect(f.el('#wt-moments-feed').children).toHaveLength(200)

    f.el('#wt-settings-btn').click()
    f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(reqMoment).toHaveBeenCalledTimes(2))
    f.el('#wt-settings-modal').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(reqMoment.mock.calls[1][2]?.aborted).toBe(true)
  })

  it('deduplicates, coalesces, aborts on chat switch, times out, and rolls back failed saves in automatic Moments controller', async () => {
    function momentsFixture(options = { cooldownMs: 100, timeoutMs: 1000 }) {
      const data: WeChatAppData = { memoryVersion: 1, config: { apiKey: 'test', profile: { contextMessageCount: 12, includeWorldbook: false } } }
      for (const name of ['A', 'B', 'C']) addContactConversation(data, { id: `avatar:${name}.png`, name, card: { name, avatar: `${name}.png`, description: `${name} persona` } })
      let chatId = 'one', message = '雨后抵达月港', receive = () => {}, change = () => {}
      const host = {
        getAppData: () => data, setAppData: vi.fn(), getCharacterName: () => 'A', getCharacterCard: () => ({ name: 'A', avatar: 'A.png' }),
        getChatContext: () => ({ chatId, chat: [{ is_user: false, mes: message }] }),
        onMessageReceived: (fn: () => void) => { receive = fn; return vi.fn() },
        onCharacterChanged: (fn: () => void) => { change = fn; return vi.fn() },
      } as unknown as AppHost
      const controller = createMomentsController(host, options)
      activeControllers.push(controller)
      return { data, host, controller, story: (next: string) => { message = next; receive() }, switchChat: () => { chatId = 'two'; change() } }
    }

    vi.useFakeTimers()
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment')
      .mockImplementation(async (c) => ({ text: `${c.name} 近况`, visibility: 'private' }))
    const f = momentsFixture()
    await f.controller.trigger()
    expect(f.data.moments).toHaveLength(2)
    expect(f.data.moments![0].visibility).toBe('private')

    f.story('新剧情一')
    f.story('新剧情二')
    expect(request).toHaveBeenCalledTimes(2)
    await vi.advanceTimersByTimeAsync(101)
    expect(request).toHaveBeenCalledTimes(4)
    expect(request.mock.calls[2][3]?.stRecentMessages?.[0].text).toBe('新剧情二')

    let finishSwitch!: (v: { text: string }) => void
    request.mockReturnValueOnce(new Promise((r) => { finishSwitch = r }))
    const fSwitch = momentsFixture()
    const switchWork = fSwitch.controller.trigger()
    await vi.waitFor(() => expect(finishSwitch).toBeDefined())
    fSwitch.switchChat()
    finishSwitch({ text: 'STALE' })
    await switchWork
    expect(fSwitch.data.moments).toBeUndefined()

    request.mockReturnValueOnce(new Promise(() => {}))
    const fTimeout = momentsFixture({ cooldownMs: 100, timeoutMs: 20 })
    const timeoutWork = fTimeout.controller.trigger()
    await vi.advanceTimersByTimeAsync(21)
    await timeoutWork
    expect(fTimeout.controller.status().error).toContain('超时')

    request.mockResolvedValue({ text: 'hello' })
    const fSaveErr = momentsFixture()
    vi.mocked(fSaveErr.host.setAppData).mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw new Error('save failed') })
    await fSaveErr.controller.trigger()
    expect(fSaveErr.data.moments).toBeUndefined()
    expect(fSaveErr.controller.status().error).toBe('save failed')
  })
})

describe('voice recognition input, group avatar mosaic & SillyTavern TTS handoff', () => {
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

  it('captures speech into unsent draft, falls back to typed voice on error, aborts on navigation/mention, and sizes group mosaics', async () => {
    vi.stubGlobal('SpeechRecognition', Recognition)
    vi.stubGlobal('webkitSpeechRecognition', undefined)
    vi.stubGlobal('isSecureContext', true)
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue({ messages: [{ type: 'text', content: '收到' }] })

    const f = fixture = mountWeChat()
    for (const count of [4, 12]) {
      saveGroup(f.data(), `Group ${count}`, Array.from({ length: count }, (_, i) => ({ id: `avatar:m${i}.png`, name: `M${i}`, card: { avatar: `m${i}.png` } })))
    }
    f.remount()
    for (const [count, cols, cells] of [[4, '2', 4], [12, '3', 9]] as const) {
      const pic = [...f.container.querySelectorAll<HTMLElement>('[data-conversation]')].find((n) => n.textContent?.includes(`Group ${count}`))!.querySelector<HTMLElement>('.wt-group-avatar')!
      expect(pic.dataset.columns).toBe(cols)
      expect(pic.children).toHaveLength(cells)
    }

    f.open(f.b.scopeKey!)
    const liveB = f.data().conversations![f.b.scopeKey!]
    f.el('#wt-voice-mode').click()
    f.el('#wt-record').click()
    Recognition.latest.result('识别中', false)
    expect(liveB.messages).toHaveLength(0)
    Recognition.latest.result('去湖边走走')
    f.el('#wt-record').click()
    expect(liveB.draft).toBe('去湖边走走')
    f.el('#wt-send-btn').click()
    await vi.waitFor(() => expect(liveB.messages).toHaveLength(2))
    expect(liveB.messages[0]).toMatchObject({ type: 'voice', content: '去湖边走走' })

    f.el('#wt-record').click()
    const abortedOnNav = Recognition.latest
    const staleResult = abortedOnNav.onresult!
    f.open(f.a.scopeKey!)
    expect(abortedOnNav.abort).toHaveBeenCalledOnce()
    f.el<HTMLInputElement>('#wt-input-text').value = '新草稿'
    staleResult({ results: [{ isFinal: true, 0: { transcript: '迟到语音' } }] })
    expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('新草稿')

    f.el('#wt-voice-mode').click()
    f.el('#wt-voice-edit').click()
    f.el('#wt-record').click()
    Recognition.latest.onerror?.({ error: 'not-allowed' })
    expect(f.el('#wt-input-text').hidden).toBe(false)
    expect(f.el('#wt-voice-status').textContent).toMatch(/手动输入|语音文字/)
  })

  it('passes raw text safely to ST speak, keeps transcripts readable across failures/timeouts, and disposes handoffs on clear/unmount', async () => {
    vi.useFakeTimers()
    const voiceMsg = (content = 'Readable voice', id = 'voice-1'): ChatMessage => ({
      id, sender: 'contact', type: 'voice', content, time: { day: 1, hour: 19, minute: 0 },
    })
    const installHost = (callback?: (args: { voice: string }, text: string) => Promise<unknown>, enabled = true) => {
      vi.stubGlobal('SillyTavern', {
        getContext: () => ({ extensionSettings: { tts: { enabled } }, SlashCommandParser: { commands: { speak: { callback } } } }),
      })
    }

    const literalCb = vi.fn().mockResolvedValue('')
    installHost(literalCb)
    await expect(speakWeChatText('/delete | {{user}} "literal"', 'B')).resolves.toBe(true)
    expect(literalCb).toHaveBeenCalledWith({ voice: 'B' }, '/delete | {{user}} "literal"')

    const hungHandoff = deferred<string>()
    const cb = vi.fn().mockReturnValueOnce(hungHandoff.promise).mockRejectedValueOnce(new Error('provider failed')).mockResolvedValue('')
    installHost(cb)

    const f = fixture = mountWeChat()
    f.a.messages.push(voiceMsg())
    f.open(f.a.scopeKey!)
    const play = () => f.el<HTMLButtonElement>('.wt-voice button')
    const transcript = () => f.el<HTMLParagraphElement>('.wt-voice p')
    const status = () => f.el('.wt-voice [role="status"]')

    play().click()
    expect(play().disabled).toBe(true)
    expect(transcript().hidden).toBe(false)

    await vi.advanceTimersByTimeAsync(15001)
    expect(play().disabled).toBe(false)
    expect(status().textContent).toContain('超时')

    play().click()
    await vi.advanceTimersByTimeAsync(1)
    expect(status().textContent).toContain('失败')
    hungHandoff.resolve('')
    await vi.advanceTimersByTimeAsync(1)
    expect(status().textContent).toContain('失败')

    play().click()
    await vi.advanceTimersByTimeAsync(1)
    expect(status().textContent).toContain('无法确认')

    const clearHandoff = deferred<string>()
    installHost(() => clearHandoff.promise)
    play().click()
    const oldStatus = status()
    f.el('#wt-settings-btn').click()
    f.el('#wt-btn-clear-chat').click()
    f.el('#wt-btn-clear-chat').click()
    f.el('#wt-close-settings').click()
    const textBeforeLate = oldStatus.textContent
    clearHandoff.resolve('')
    await Promise.resolve()
    expect(oldStatus.textContent).toBe(textBeforeLate)
  })
})
