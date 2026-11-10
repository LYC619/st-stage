// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { createChronicleController } from './controller'
import { CHRONICLE_KEY } from './store'
import type { ChronicleContent, ChronicleData } from './types'
import * as generate from './generate'
import * as dates from '../shared/story-date'
import * as calendar from './calendar'

const content: ChronicleContent = { summary: '概要', text: '正文', timeSpan: '2026-01-01', keyDialogue: [] }
let dispose = () => {}
beforeEach(() => {
  vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 0, 2))
  vi.spyOn(calendar, 'generateCalendar').mockResolvedValue([])
})
afterEach(() => { dispose(); vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
function fixture(initial?: ChronicleData) {
  let chatId = 'one', receive = () => {}, change = () => {}, settings = {}
  const chats: Record<string, Array<{ is_user: boolean; mes: string }>> = { one: [], two: [] }
  const metadata: Record<string, Record<string, unknown>> = { one: initial ? { [CHRONICLE_KEY]: initial } : {}, two: {} }
  const save = vi.fn(async () => {})
  vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId, chat: chats[chatId], chatMetadata: metadata[chatId], saveMetadata: save }) })
  const host = { getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test' } } } }),
    getAppData: () => settings, setAppData: (value: object) => { settings = value }, getCharacterName: () => '角色', injectPrompt: vi.fn(),
    onMessageReceived: (fn: () => void) => { receive = fn; return vi.fn() }, onCharacterChanged: (fn: () => void) => { change = fn; return vi.fn() },
  } as unknown as AppHost
  const controller = createChronicleController(host, { timeoutMs: 100 }); dispose = controller.destroy
  return { host, controller, metadata, chats, save,
    receive(user = false) { chats[chatId].push({ is_user: user, mes: '新消息' }); receive() },
    change() { chatId = chatId === 'one' ? 'two' : 'one'; change() },
    data: () => metadata[chatId][CHRONICLE_KEY] as ChronicleData,
  }
}

describe('chronicle lifecycle', () => {
  it('counts only pending AI replies, runs one job, persists the cursor and refreshes injection', async () => {
    let finish!: (value: ChronicleContent) => void
    const spy = vi.spyOn(generate, 'generateChronicle').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture()
    f.receive(true); f.receive(); f.receive(); f.receive(); expect(spy).not.toHaveBeenCalled()
    f.receive(); f.receive(); expect(spy).toHaveBeenCalledOnce()
    finish(content)
    await vi.waitFor(() => expect(f.controller.status().busy).toBe(false))
    expect(f.data()).toMatchObject({ v: 1, lastMessageIndex: 4, entries: [{ code: 'AM0001' }] })
    expect(f.host.injectPrompt).toHaveBeenLastCalledWith(expect.stringContaining('AM0001 | 昨天 | 概要'), 999)
    await vi.waitFor(() => expect(calendar.generateCalendar).toHaveBeenCalledOnce())
    await f.controller.trigger(); expect(spy).toHaveBeenCalledOnce()
  })
  it.each(['switch', 'cancel'] as const)('discards late completion on %s and immediately clears the old injection on switch', async action => {
    let finish!: (value: ChronicleContent) => void
    vi.spyOn(generate, 'generateChronicle').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const f = fixture(); f.receive(); const work = f.controller.trigger(true)
    if (action === 'switch') { f.change(); expect(f.host.injectPrompt).toHaveBeenLastCalledWith('', 999) }
    else f.controller.cancel()
    finish(content); await work
    expect(f.save).not.toHaveBeenCalled(); expect(f.controller.status().busy).toBe(false)
  })
  it('times out and allows a new attempt without advancing the cursor', async () => {
    vi.useFakeTimers(); const spy = vi.spyOn(generate, 'generateChronicle').mockReturnValue(new Promise(() => {}))
    const f = fixture(); f.receive(); const work = f.controller.trigger(true)
    await vi.advanceTimersByTimeAsync(101); await work
    expect(f.controller.status().error).toContain('超时'); expect(f.save).not.toHaveBeenCalled()
    spy.mockResolvedValue(content); await f.controller.trigger(true); expect(f.data().lastMessageIndex).toBe(0)
  })
  it('repairs a cursor after messages are deleted without removing existing entries', async () => {
    const entry = { ...content, code: 'AM0001', createdAt: 1 }, f = fixture({ v: 1, entries: [entry], lastMessageIndex: 30 })
    const spy = vi.spyOn(generate, 'generateChronicle')
    await f.controller.trigger()
    expect(f.data()).toEqual({ v: 1, entries: [entry], lastMessageIndex: -1 }); expect(spy).not.toHaveBeenCalled()
  })
  it('loads existing injection at setup, honors opt-outs and deletes only the latest entry', async () => {
    const entries = [1, 2].map(n => ({ ...content, code: `AM000${n}`, createdAt: n }))
    const f = fixture({ v: 1, entries, lastMessageIndex: -1 })
    await f.controller.refresh(); expect(f.host.injectPrompt).toHaveBeenLastCalledWith(expect.stringContaining('AM0002'), 999)
    f.host.setAppData({ autoGenerate: false, inject: false }); await f.controller.refresh()
    expect(f.host.injectPrompt).toHaveBeenLastCalledWith('', 999)
    const spy = vi.spyOn(generate, 'generateChronicle').mockResolvedValue(content)
    for (let i = 0; i < 5; i++) f.receive()
    expect(spy).not.toHaveBeenCalled()
    await f.controller.deleteLatest(); expect(f.data().entries.map(entry => entry.code)).toEqual(['AM0001'])
    expect(f.data().lastMessageIndex).toBe(-1)
    await f.controller.trigger(true); expect(spy).toHaveBeenCalledOnce()
  })
})
