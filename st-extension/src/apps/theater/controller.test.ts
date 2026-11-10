// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { createTheaterController } from './controller'
import * as generate from './generate'
import type { TheaterData, TheaterFeeds } from './types'

const feeds: TheaterFeeds = { square: [], forum: [], live: null, diary: [] }
let dispose = () => {}
afterEach(() => { dispose(); vi.restoreAllMocks(); vi.useRealTimers() })
function fixture() {
  let data: TheaterData = { autoGenerate: true, stories: {} }, chatId = 'one', message = '故事', receive = () => {}, change = () => {}
  const host = { getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test' } } } }),
    getAppData: () => data, setAppData: vi.fn((next: TheaterData) => { data = next }), getCharacterName: () => '角色',
    getChatContext: () => ({ chatId, chat: [{ is_user: false, mes: message }] }),
    onMessageReceived: (fn: () => void) => { receive = fn; return vi.fn() }, onCharacterChanged: (fn: () => void) => { change = fn; return vi.fn() },
  } as unknown as AppHost
  const controller = createTheaterController(host, { cooldownMs: 100, timeoutMs: 500 }); dispose = controller.destroy
  return { host, controller, data: () => data, change: () => { chatId = 'two'; change() }, receive: () => { message += '!'; receive() } }
}
describe('theater background lifecycle', () => {
  it('deduplicates fingerprints and limits automatic work to the cooldown', async () => {
    vi.useFakeTimers(); const generateSpy = vi.spyOn(generate, 'generateTheater').mockResolvedValue(feeds)
    const f = fixture(); await f.controller.trigger(); await f.controller.trigger(); f.receive()
    expect(generateSpy).toHaveBeenCalledOnce()
    await vi.advanceTimersByTimeAsync(101); f.receive(); await Promise.resolve(); await Promise.resolve()
    expect(generateSpy).toHaveBeenCalledTimes(2)
  })
  it.each(['switch', 'cancel'] as const)('discards a late result after %s', async action => {
    let finish!: (value: TheaterFeeds) => void
    vi.spyOn(generate, 'generateTheater').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture(), work = f.controller.trigger(true)
    if (action === 'switch') f.change(); else f.controller.cancel()
    finish(feeds); await work
    expect(f.host.setAppData).not.toHaveBeenCalled(); expect(f.controller.status().busy).toBe(false)
  })
  it('times out a provider that ignores cancellation and allows a manual retry', async () => {
    vi.useFakeTimers(); const spy = vi.spyOn(generate, 'generateTheater').mockReturnValue(new Promise(() => {}))
    const f = fixture(), work = f.controller.trigger(true); await vi.advanceTimersByTimeAsync(501); await work
    expect(f.controller.status().error).toContain('超时'); spy.mockResolvedValue(feeds); await f.controller.trigger(true)
    expect(Object.keys(f.data().stories)).toHaveLength(1)
  })
})
