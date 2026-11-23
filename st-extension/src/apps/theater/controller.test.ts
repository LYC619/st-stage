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
  it('preserves canceled likes/pins and live comments sent during a replacement stream', async () => {
    let finish!: (value: TheaterFeeds) => void
    vi.spyOn(generate, 'generateTheater').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture()
    const post = { author: 'A', tag: '', time: '', text: 'Post', topics: [], comments: [], stats: '', liked: true, pinned: true }
    const diary = { role: 'A', date: '2026-11-23', content: 'Diary', pinned: true }
    const live = { room: 'Room', title: 'Old', cast: '', summary: '', stats: '', danmaku: [{ fan: '我', text: 'Before' }] }
    f.host.setAppData({ autoGenerate: true, stories: { '角色::one': { ...feeds, square: [post], diary: [diary], live, updatedAt: 1, fingerprint: '' } } })
    const work = f.controller.trigger(true)
    const latest = structuredClone(f.data())
    latest.stories['角色::one'].square[0].liked = false
    latest.stories['角色::one'].square[0].pinned = false
    latest.stories['角色::one'].diary[0].pinned = false
    latest.stories['角色::one'].live!.danmaku.unshift({ fan: '我', text: 'During' })
    f.host.setAppData(latest)
    finish({ ...feeds, square: [post], diary: [{ ...diary, content: 'Updated' }], live: { ...live, title: 'New', danmaku: [] } })
    await work
    const saved = f.data().stories['角色::one']
    expect(saved.square[0].liked).toBeFalsy()
    expect(saved.square[0].pinned).toBeFalsy()
    expect(saved.diary[0].pinned).toBeFalsy()
    expect(saved.diary[0].content).toBe('Updated')
    expect(saved.live?.danmaku).toEqual([{ fan: '我', text: 'During' }])
  })

  it('merges into the latest story and ignores unsolicited changes to other channels', async () => {
    let finish!: (value: TheaterFeeds) => void
    vi.spyOn(generate, 'generateTheater').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture()
    const post = { author: 'A', tag: '', time: '', text: 'Post', topics: [], comments: [], stats: '' }
    f.host.setAppData({ autoGenerate: true, stories: { '角色::one': { ...feeds, square: [post], diary: [{ role: 'A', date: '2026-11-23', content: 'Diary' }], updatedAt: 1, fingerprint: '' } } })
    const work = f.controller.trigger(true, 'square')
    const latest = structuredClone(f.data())
    latest.stories['角色::one'].square[0].liked = true
    latest.stories['角色::one'].square[0].pinned = true
    latest.stories['角色::one'].diary[0].pinned = true
    latest.stories['角色::one'].live = { room: 'Room', title: 'Live', cast: '', summary: '', stats: '', danmaku: [{ fan: '我', text: 'Hello' }] }
    f.host.setAppData(latest)
    finish({ ...feeds, square: [{ ...post, liked: false, pinned: false }], diary: [{ role: 'A', date: '2026-11-23', content: 'Wrong channel' }] })
    await work
    const saved = f.data().stories['角色::one']
    expect(saved.square).toHaveLength(1)
    expect(saved.square[0]).toMatchObject({ liked: true, pinned: true })
    expect(saved.diary[0]).toMatchObject({ content: 'Diary', pinned: true })
    expect(saved.live?.danmaku).toEqual([{ fan: '我', text: 'Hello' }])
  })

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
