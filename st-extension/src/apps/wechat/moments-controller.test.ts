// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import type { WeChatAppData } from './types'
import { addContactConversation } from './conversations'
import { createMomentsController } from './moments-controller'
import { WeChatPipeline } from './pipeline'

let dispose: (() => void) | undefined
afterEach(() => { dispose?.(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function fixture(options = { cooldownMs: 100, timeoutMs: 1000 }) {
  const data: WeChatAppData = { memoryVersion: 1, config: { apiKey: 'test', profile: { contextMessageCount: 12, includeWorldbook: false } } }
  for (const name of ['A', 'B', 'C']) addContactConversation(data, { id: `avatar:${name}.png`, name, card: { name, avatar: `${name}.png`, description: name + ' persona' } })
  let chatId = 'one', message = '雨后抵达月港', receive = () => {}, change = () => {}
  const host = { getAppData: () => data, setAppData: vi.fn(), getCharacterName: () => 'A', getCharacterCard: () => ({ name: 'A', avatar: 'A.png' }),
    getChatContext: () => ({ chatId, chat: [{ is_user: false, mes: message }] }),
    onMessageReceived: (fn: () => void) => { receive = fn; return vi.fn() }, onCharacterChanged: (fn: () => void) => { change = fn; return vi.fn() },
  } as unknown as AppHost
  const controller = createMomentsController(host, options); dispose = controller.destroy
  return { data, host, controller, story: (next: string) => { message = next; receive() }, switch: () => { chatId = 'two'; change() } }
}
describe('automatic Moments lifecycle', () => {
  it('creates at most two state-aware posts, persists private visibility, and deduplicates repeated entry/events', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockImplementation(async contact => ({ text: contact.name + ' 的近况', visibility: 'private' }))
    const f = fixture(); await f.controller.trigger()
    expect(f.data.moments).toHaveLength(2); expect(request).toHaveBeenCalledTimes(2)
    expect(f.data.moments![0].visibility).toBe('private'); expect(request.mock.calls[0][3]?.stRecentMessages?.[0].text).toContain('月港')
    await f.controller.trigger(); f.story('雨后抵达月港'); await Promise.resolve(); expect(request).toHaveBeenCalledTimes(2)
  })
  it('coalesces rapid new story events during persistent cooldown', async () => {
    vi.useFakeTimers()
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockImplementation(async contact => ({ text: contact.name + String(Date.now()) }))
    const f = fixture(); await f.controller.trigger(); f.story('新剧情一'); f.story('新剧情二')
    expect(request).toHaveBeenCalledTimes(2); await vi.advanceTimersByTimeAsync(101)
    expect(request).toHaveBeenCalledTimes(4); expect(request.mock.calls[2][3]?.stRecentMessages?.[0].text).toBe('新剧情二')
  })
  it('cancels late work on a main-chat switch and leaves posts unchanged', async () => {
    let finish!: (value: { text: string }) => void
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture(), work = f.controller.trigger()
    await vi.waitFor(() => expect(request).toHaveBeenCalledOnce()); f.switch(); finish({ text: 'STALE' }); await work
    expect(request.mock.calls[0][2]?.aborted).toBe(true); expect(f.data.moments).toBeUndefined(); expect(f.controller.status().busy).toBe(false)
  })
  it('times out even when the underlying provider ignores abort, then allows an explicit retry', async () => {
    vi.useFakeTimers(); const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockReturnValue(new Promise(() => {}))
    const f = fixture({ cooldownMs: 100, timeoutMs: 20 }), work = f.controller.trigger()
    await vi.advanceTimersByTimeAsync(21); await work
    expect(f.controller.status()).toMatchObject({ busy: false }); expect(f.controller.status().error).toContain('超时'); expect(f.data.moments).toBeUndefined()
    request.mockImplementation(async contact => ({ text: contact.name + ' retry' })); await f.controller.trigger(true)
    expect(f.data.moments).toHaveLength(2)
  })
  it('does no background work when disabled or disconnected', async () => {
    const request = vi.spyOn(WeChatPipeline.prototype, 'requestMoment')
    const f = fixture(); f.data.config.autoMoments = false; await f.controller.trigger()
    f.data.config.autoMoments = true; f.data.config.apiKey = ''; await f.controller.trigger()
    expect(request).not.toHaveBeenCalled()
  })
  it('rolls back posts on save failure and retains a recoverable error', async () => {
    vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockResolvedValue({ text: 'hello' })
    const f = fixture(); vi.mocked(f.host.setAppData).mockImplementationOnce(() => {}).mockImplementationOnce(() => { throw Error('save failed') })
    await f.controller.trigger(); expect(f.data.moments).toBeUndefined(); expect(f.controller.status().error).toBe('save failed')
    expect(Object.values(f.data.momentActivity!)[0].completed).toBeUndefined()
  })
})
