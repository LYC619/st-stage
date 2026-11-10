// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { captureStory, formatStoryMemory, readStoryMemory, storyText } from './memory'
import { getWeChatHostContext } from './bridge'
import * as storyDates from '../shared/story-date'
import { normalizeProfile } from './profile'
import { WeChatPipeline } from './pipeline'
import { migrateWeChatData } from './migrations'
import { defaultContactState } from './groups'
import { mountWeChat } from './test-fixture'
import type { WeChatAppData } from './types'

let mounted: ReturnType<typeof mountWeChat> | undefined
afterEach(() => { mounted?.app.unmount?.(); mounted = undefined; vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
function fixture() {
  let chatId = 'story-1'
  const a = { name: 'A', avatar: 'a.png', data: { extensions: { world: 'Main' } } }
  const b = { name: 'B', avatar: 'b.png', data: { extensions: { world: 'Bound' } } }
  const chat = [{ is_user: true, mes: '我们在月港取得了船票。', name: '旅行者' }, { is_user: false, mes: '<p>明天从月港出发。</p><think>hidden reasoning</think>', name: 'A' }, { is_system: true, mes: 'SYSTEM_SECRET' }]
  const native = { characters: [a, b], tagMap: { 'b.png': ['space'] }, chat, name1: '旅行者', getCurrentChatId: () => chatId, loadWorldInfo: vi.fn(), getRequestHeaders: () => ({ 'X-CSRF-Token': 'test' }), chatMetadata: { world_info: 'Chat' } }
  vi.stubGlobal('SillyTavern', { getContext: () => native })
  const host = { getCharacterName: () => 'A', getCharacterCard: () => a, getChatContext: () => ({ chatId, chat }) } as unknown as AppHost
  return { host, scope: { scopeKey: 'direct:b', characterName: 'B', card: b, externalState: { source: 'none' as const } }, change: () => { chatId = 'story-2' } }
}
describe('main-story and worldbook memory', () => {
  it('prepends chronicle overviews even when worldbook reading is disabled', async () => {
    const f = fixture(), native = getWeChatHostContext() as { chatMetadata: Record<string, unknown> }
    vi.spyOn(storyDates, 'storyToday').mockResolvedValue(new Date(2026, 0, 2))
    native.chatMetadata.st_stage_chronicle = { v: 1, lastMessageIndex: 0, entries: [{ code: 'AM0001', timeSpan: '2026-01-01', summary: '很早以前拿到通行证', text: '完整正文不发给微信', keyDialogue: [], createdAt: 1 }] }
    const scope = await readStoryMemory(f.host, f.scope, normalizeProfile({ profile: { includeWorldbook: false } }), new AbortController().signal)
    const prompt = formatStoryMemory(scope)
    expect(prompt).toContain('AM0001 | 昨天 | 很早以前拿到通行证'); expect(prompt).not.toContain('完整正文不发给微信')
    expect(prompt.indexOf('【过去的剧情纪要】')).toBeLessThan(prompt.indexOf('【酒馆主线背景'))
  })
  it('filters by stable avatar filename and tag IDs, independently of the display name', async () => {
    const f = fixture()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, json: async () => ({ entries: [
      { constant: true, characterFilter: { names: ['b'] }, content: 'BOUND_ID' },
      { constant: true, characterFilter: { names: ['B'] }, content: 'WRONG_DISPLAY_NAME' },
      { constant: true, characterFilter: { names: ['b'], isExclude: true }, content: 'EXCLUDED_ID' },
      { constant: true, characterFilter: { tags: ['space'] }, content: 'MATCHED_TAG' },
      { constant: true, characterFilter: { tags: ['earth'] }, content: 'UNMATCHED_TAG' },
      { constant: true, characterFilter: { tags: ['space'], isExclude: true }, content: 'EXCLUDED_TAG' },
    ] }) }))
    const scope = await readStoryMemory(f.host, f.scope, normalizeProfile(), new AbortController().signal, captureStory(f.host), '', async () => ({}))
    expect(scope.loreText).toContain('BOUND_ID'); expect(scope.loreText).toContain('MATCHED_TAG')
    for (const value of ['WRONG_DISPLAY_NAME', 'EXCLUDED_ID', 'UNMATCHED_TAG', 'EXCLUDED_TAG']) expect(scope.loreText).not.toContain(value)
  })
  it('loads only bound/global/chat books, filters disabled/unmatched entries and injects source-labelled memory even into a custom prompt', async () => {
    const f = fixture(), calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_url, init) => {
      const name = JSON.parse(init.body).name; calls.push(name)
      return { ok: true, json: async () => ({ entries: {
        0: { constant: true, content: name + ' constant' }, 1: { key: ['月港'], content: name + ' harbor' },
        2: { constant: true, disable: true, content: 'DISABLED_SECRET' }, 3: { key: ['沙漠'], content: 'UNMATCHED_SECRET' },
        4: { key: ['月港'], selective: true, keysecondary: ['船票'], selectiveLogic: 0, content: name + ' ticket' },
      } }) }
    }))
    const profile = normalizeProfile({ profile: { replyPrompt: 'CUSTOM {角色}', contextMessageCount: 2 } })
    const scope = await readStoryMemory(f.host, f.scope, profile, new AbortController().signal, captureStory(f.host), '', async () => ({ selected_world_info: ['Global'] }))
    expect(calls.sort()).toEqual(['Bound', 'Chat', 'Global', 'Main'])
    const prompt = new WeChatPipeline({ profile }, {}, {}, {}).buildSystemPrompt(defaultContactState(), 'now', scope)
    expect(prompt).toContain('CUSTOM B'); expect(prompt).toContain('旅行者: 我们在月港取得了船票。')
    expect(prompt).toContain('【酒馆主线背景 · A】'); expect(prompt).toContain('Global constant'); expect(prompt).toContain('Bound ticket')
    for (const forbidden of ['SYSTEM_SECRET', 'hidden reasoning', 'DISABLED_SECRET', 'UNMATCHED_SECRET', '<p>']) expect(prompt).not.toContain(forbidden)
  })
  it('honors a deliberate zero and disabled worldbooks without making a worldbook request', async () => {
    const f = fixture(), fetcher = vi.fn(); vi.stubGlobal('fetch', fetcher)
    const profile = normalizeProfile({ profile: { contextMessageCount: 0, includeWorldbook: false } })
    const scope = await readStoryMemory(f.host, f.scope, profile, new AbortController().signal)
    expect(scope.stRecentMessages).toEqual([]); expect(scope.loreText).toBe(''); expect(fetcher).not.toHaveBeenCalled()
  })
  it('rejects memory from a switched main chat while a book read is pending', async () => {
    const f = fixture(); let finish!: (value: unknown) => void
    vi.stubGlobal('fetch', vi.fn().mockReturnValue(new Promise(resolve => { finish = resolve })))
    const work = readStoryMemory(f.host, f.scope, normalizeProfile(), new AbortController().signal, captureStory(f.host), '', async () => ({}))
    await vi.waitFor(() => expect(finish).toBeDefined()); f.change()
    finish({ ok: true, json: async () => ({ entries: { 0: { constant: true, content: 'STALE' } } }) })
    await expect(work).rejects.toThrow('主聊天已切换')
  })
  it('keeps usable main memory and reports unreadable worldbooks instead of inventing a success', async () => {
    const f = fixture(); vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }))
    const scope = await readStoryMemory(f.host, f.scope, normalizeProfile(), new AbortController().signal, captureStory(f.host), '', async () => ({}))
    expect(scope.memoryWarnings).toHaveLength(3); expect(scope.loreText).toBe(''); expect(scope.stRecentMessages).toHaveLength(2)
  })
  it('reads each worldbook once when one round shares a cache, and concurrently', async () => {
    const f = fixture(), started: string[] = [], finish: Array<() => void> = []
    vi.stubGlobal('fetch', vi.fn((_url, init) => {
      const name = JSON.parse(init.body).name; started.push(name)
      return new Promise(resolve => finish.push(() => resolve({ ok: true, json: async () => ({ entries: { 0: { constant: true, content: name + ' lore' } } }) })))
    }))
    const books = new Map<string, Promise<unknown>>(), story = captureStory(f.host), signal = new AbortController().signal
    const work = Promise.all([0, 1].map(() => readStoryMemory(f.host, f.scope, normalizeProfile(), signal, story, '', async () => ({}), books)))
    await vi.waitFor(() => expect(started.sort()).toEqual(['Bound', 'Chat', 'Main']))
    for (const done of finish) done()
    const [first, second] = await work
    expect(started).toHaveLength(3)
    expect(first.loreText).toContain('Bound lore'); expect(second.loreText).toBe(first.loreText)
  })
  it('upgrades the old implicit zero once and preserves later explicit opt-outs', () => {
    const data: WeChatAppData = { config: { profile: { contextMessageCount: 0 }, characterProfiles: { 'avatar:a.png': { contextMessageCount: 0 } } } }
    migrateWeChatData(data); expect(data.config.profile?.contextMessageCount).toBe(12); expect(data.config.characterProfiles?.['avatar:a.png'].contextMessageCount).toBe(12)
    data.config.profile!.contextMessageCount = 0; migrateWeChatData(data); expect(data.config.profile?.contextMessageCount).toBe(0)
  })
  it('sends actual host memory through the mounted reply path without replacing the selected contact persona', async () => {
    const fetcher = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [{ message: { content: '{"messages":[{"type":"text","content":"记得船票"}]}' } }] }) })
    vi.stubGlobal('fetch', fetcher)
    mounted = mountWeChat({ memoryVersion: 1, config: { apiKey: 'test-only', autoMoments: false, profile: { contextMessageCount: 12, includeWorldbook: false } } })
    mounted.open(mounted.b.scopeKey!); mounted.el<HTMLInputElement>('#wt-input-text').value = '还记得吗'; mounted.el('#wt-send-btn').click()
    await vi.waitFor(() => expect(mounted!.b.messages).toHaveLength(2))
    const payload = JSON.parse(fetcher.mock.calls[0][1].body)
    expect(payload.messages[0].content).toContain('PRIVATE_MAIN_CHAT_A'); expect(payload.messages[0].content).toContain('PRIVATE_PERSONA_B')
    expect(mounted.getVariables).not.toHaveBeenCalled()
  })
  it('parses narrative markup inertly and never creates live image/script nodes', () => {
    expect(storyText('<img src=x onerror="alert(1)"><p>安全故事</p><script>bad()</script>')).toBe('安全故事')
    expect(document.querySelector('img,script')).toBeNull()
  })
})
