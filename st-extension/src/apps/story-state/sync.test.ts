// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { createStorySync } from './sync'
import { META_KEY } from './store'
import * as ai from '../shared/story-ai'
import * as mvu from '../mvu/bridge'
import * as store from './store'

let cleanup = () => {}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function fixture() {
  let chatId = 'A', change = () => {}, receive = () => {}
  const metadata: Record<string, unknown> = {}, settings = { autoSync: true, contextMessages: 12 }
  const save = vi.fn(async () => {})
  vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId, chatMetadata: metadata, saveMetadata: save,
    updateChatMetadata: (entry: Record<string, unknown>) => Object.assign(metadata, entry) }) })
  const host = { getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test' } } } }), getAppData: () => settings,
    getCharacterName: () => '角色', getChatContext: () => ({ chatId, chat: [{ is_user: false, mes: '来到港口' }] }),
    onMessageReceived: (fn: () => void) => { receive = fn; return vi.fn() }, onCharacterChanged: (fn: () => void) => { change = fn; return vi.fn() },
  } as unknown as AppHost
  const sync = createStorySync(host); cleanup = sync.destroy
  return { sync, save, settings, metadata, receive: () => receive(), switch: () => { chatId = 'B'; change() } }
}
describe('background story sync', () => {
  it.each(['disable', 'switch', 'destroy'] as const)('rechecks lifecycle/settings after a pending injection read: %s', async action => {
    let chatId = 'A', finish!: (snapshot: store.StoryStateSnapshot) => void
    const settings = { injectToChat: true }
    const raw = { 位置: { 地点: 'Old place' } }
    const snapshot = { key: 'Role::A', backend: 'local' as const, raw, state: store.normalize(raw) }
    vi.spyOn(store, 'readStoryState').mockReturnValueOnce(new Promise(resolve => { finish = resolve }))
      .mockResolvedValue({ ...snapshot, key: 'Role::B', state: store.normalize({ 位置: { 地点: 'New place' } }) })
    const injectPrompt = vi.fn()
    const host = { getAppData: () => settings, getCharacterName: () => 'Role', getChatContext: () => ({ chatId }), injectPrompt,
      onMessageReceived: () => vi.fn(), onCharacterChanged: () => vi.fn() } as unknown as AppHost
    const sync = createStorySync(host); cleanup = sync.destroy
    if (action === 'switch') chatId = 'B'
    else if (action === 'disable') settings.injectToChat = false
    else sync.destroy()
    const calls = injectPrompt.mock.calls.slice()
    finish(snapshot); await Promise.resolve(); await Promise.resolve()
    if (action === 'disable') expect(injectPrompt).toHaveBeenLastCalledWith('')
    else expect(injectPrompt.mock.calls).toEqual(calls)
  })

  it.each(['resolve', 'reject'] as const)('ignores a stale injection read that will %s after a newer refresh', async action => {
    let finish!: (value: store.StoryStateSnapshot) => void, fail!: (error: Error) => void
    const pending = new Promise<store.StoryStateSnapshot>((resolve, reject) => { finish = resolve; fail = reject })
    const raw = { 位置: { 地点: 'New place' } }
    const snapshot = { key: 'Role::A', backend: 'local' as const, raw, state: store.normalize(raw) }
    vi.spyOn(store, 'readStoryState').mockReturnValueOnce(pending).mockResolvedValue(snapshot)
    const settings = { injectToChat: true }, injectPrompt = vi.fn()
    const host = { getAppData: () => settings, getCharacterName: () => 'Role', getChatContext: () => ({ chatId: 'A' }), injectPrompt,
      onMessageReceived: () => vi.fn(), onCharacterChanged: () => vi.fn() } as unknown as AppHost
    const sync = createStorySync(host); cleanup = sync.destroy
    if (action === 'resolve') settings.injectToChat = false
    await sync.refreshInjection()
    const lastCall = injectPrompt.mock.calls.at(-1)
    if (action === 'resolve') finish(snapshot)
    else fail(new Error('stale failure'))
    await Promise.resolve(); await Promise.resolve()
    expect(injectPrompt.mock.calls.at(-1)).toEqual(lastCall)
  })

  it('coalesces concurrent replies and accumulates instructions without JSON mode', async () => {
    let finish!: (reply: string) => void
    const request = vi.spyOn(ai, 'requestChat').mockImplementationOnce(() => new Promise(resolve => { finish = resolve })).mockResolvedValue("_.add('计数', 1);")
    const f = fixture(), work = f.sync.trigger(); await vi.waitFor(() => expect(request).toHaveBeenCalledOnce())
    f.receive(); f.receive(); finish("_.set('计数', 1);"); await work
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(2))
    expect(request).toHaveBeenCalledTimes(2); expect(request.mock.calls[0][3]).toBe(false)
    expect(f.metadata[META_KEY]).toMatchObject({ stat_data: { 计数: 2 } })
  })
  it('discards late output on chat change', async () => {
    let finish!: (reply: string) => void
    const request = vi.spyOn(ai, 'requestChat').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture(), work = f.sync.trigger(); await vi.waitFor(() => expect(request).toHaveBeenCalledOnce()); f.switch()
    finish("_.set('地点', '旧聊天');"); await work; expect(f.save).not.toHaveBeenCalled()
  })
  it('skips MVU and disabled sync, and exposes malformed output errors in status', async () => {
    const request = vi.spyOn(ai, 'requestChat').mockResolvedValue('无法整理'), f = fixture()
    f.settings.autoSync = false; await f.sync.trigger(); expect(request).not.toHaveBeenCalled()
    f.settings.autoSync = true; await f.sync.trigger(); expect(f.sync.status().error).toContain('有效指令')
    vi.spyOn(mvu, 'readVariables').mockResolvedValue({ status: 'ready', isMvu: true, data: { HP: 88 }, wrapped: true, messageId: 1, meta: { source: 'mvu', waitedMvu: false } })
    await f.sync.trigger(); expect(request).toHaveBeenCalledOnce(); expect(f.save).not.toHaveBeenCalled()
  })
})
