import { afterEach, describe, expect, it, vi } from 'vitest'
import { addContactConversation } from './conversations'
import { replyMembers, saveGroup } from './groups'
import { latestContactState } from './moments'
import { migrateWeChatData } from './migrations'
import { WeChatPipeline } from './pipeline'
import { createReplyController } from './replies'
import type { ChatMessage, Contact, Conversation, WeChatAppData } from './types'

const controllers: ReturnType<typeof createReplyController>[] = []
afterEach(() => { controllers.forEach(controller => controller.destroy()); controllers.length = 0; vi.restoreAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers() })
const contact = (name: string): Contact => ({ id: `avatar:${name}.png`, name, card: { name, avatar: `${name}.png`, description: `${name} ORIGINAL CARD` } })
function fixture() {
  const data: WeChatAppData = { config: { apiKey: 'fixture-old', apiUrl: 'https://old.example.test', profile: { preset: 'general', replyPrompt: 'OLD PROMPT {人设}' } } }
  const members = [contact('Alice'), contact('allison'), contact('Bob')]
  const direct = members.map(item => addContactConversation(data, item))
  const group = saveGroup(data, 'Friends', members)
  const controller = createReplyController(data, { persist() {}, changed() {}, activeKey: () => group.scopeKey!, report() {} })
  controllers.push(controller)
  const send = (conv: Conversation, content: string) => {
    const player: ChatMessage = { id: crypto.randomUUID(), sender: 'player', type: 'text', content, time: { day: 1, hour: 12, minute: 0 } }
    conv.messages.push(player); conv.updatedAt = Date.now()
    return controller.send(conv, player)
  }
  return { data, members, direct, group, send }
}
const completion = (state: Record<string, unknown> = {}) => new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ messages: [{ type: 'text', content: 'reply' }], ...state }) } }] }), { status: 200 })

describe('reply transaction snapshots', () => {
  it('keeps the endpoint, key, prompt and every persona fixed for a whole group round', async () => {
    const f = fixture()
    let release!: (response: Response) => void
    const held = new Promise<Response>(resolve => { release = resolve })
    const fetch = vi.fn().mockReturnValueOnce(held).mockImplementation(async () => completion())
    vi.stubGlobal('fetch', fetch)
    const sending = f.send(f.group, 'hello')
    expect(fetch).toHaveBeenCalledOnce()
    f.data.config = { apiKey: 'fixture-new', apiUrl: 'https://new.example.test', profile: { replyPrompt: 'NEW PROMPT {人设}' } }
    f.data.contacts![f.members[2].id].card!.description = 'CHANGED CARD'
    release(completion()); await sending
    for (const [url, init] of fetch.mock.calls) {
      expect(url).toBe('https://old.example.test')
      expect(init.headers.Authorization).toBe('Bearer fixture-old')
      expect(JSON.parse(init.body).messages[0].content).toContain('OLD PROMPT')
    }
    expect(JSON.parse(fetch.mock.calls[2][1].body).messages[0].content).toContain('Bob ORIGINAL CARD')
    await f.send(f.group, '@Bob next')
    expect(fetch.mock.calls[3][0]).toBe('https://new.example.test')
    expect(JSON.parse(fetch.mock.calls[3][1].body).messages[0].content).toContain('CHANGED CARD')
  })
})

describe('per-contact state recency', () => {
  it('does not let @Alice activity or an unanswered draft promote Bob’s stale group state', async () => {
    vi.useFakeTimers(); const f = fixture()
    vi.stubGlobal('fetch', vi.fn()
      .mockResolvedValueOnce(completion({ current_status: 'old group', mood: 35 }))
      .mockResolvedValueOnce(completion({ current_status: 'new direct', mood: 82 }))
      .mockImplementation(async () => completion({ current_status: 'latest reply', mood: 70 })))
    vi.setSystemTime(1000); await f.send(f.group, '@Bob hello')
    vi.setSystemTime(2000); await f.send(f.direct[2], 'hello')
    vi.setSystemTime(3000); await f.send(f.group, '@Alice hello')
    expect(latestContactState(f.data, f.members[2].id)).toMatchObject({ currentStatus: 'new direct', mood: 82 })
    f.group.updatedAt = 4000
    expect(latestContactState(f.data, f.members[2].id).currentStatus).toBe('new direct')
    const reloaded = JSON.parse(JSON.stringify(f.data)) as WeChatAppData
    migrateWeChatData(reloaded)
    expect(latestContactState(reloaded, f.members[2].id).currentStatus).toBe('new direct')
    vi.setSystemTime(5000); await f.send(f.group, '@Bob again')
    expect(latestContactState(f.data, f.members[2].id).currentStatus).toBe('latest reply')
  })
  it('freezes legacy state recency when migrating and preserves it across unrelated activity', () => {
    const f = fixture(), id = f.members[2].id
    delete f.direct[2].state.updatedAt; delete f.group.memberStates[id].updatedAt
    f.direct[2].state.currentStatus = 'saved direct'; f.direct[2].updatedAt = 100
    f.group.memberStates[id].currentStatus = 'unknown-age group'; f.group.updatedAt = 200
    migrateWeChatData(f.data)
    f.group.updatedAt = 300; f.direct[2].updatedAt = 400
    migrateWeChatData(f.data)
    expect(latestContactState(f.data, id).currentStatus).toBe('saved direct')
    expect(f.direct[2].state.updatedAt).toBe(100)
  })
  it('does not refresh a state clock for a reply without any state fields', async () => {
    vi.useFakeTimers(); const f = fixture()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValueOnce(completion({ current_status: 'park', mood: 0 })).mockResolvedValue(completion()))
    vi.setSystemTime(1000); await f.send(f.direct[2], 'hello')
    const savedState = { ...f.direct[2].state }
    vi.setSystemTime(2000); await f.send(f.direct[2], 'again')
    expect(f.direct[2].state).toEqual(savedState)
    expect(savedState).toMatchObject({ mood: 0, updatedAt: 1000 })
  })
})

describe('mention boundaries', () => {
  it.each([
    ['@allison hi', ['allison']],
    ['@[avatar:Alice.png] @Bob hi', ['Alice', 'Bob']],
    ['@Bob @[avatar:Bob.png] hi', ['Bob']],
    ['@all! hi', ['Alice', 'allison', 'Bob']],
    ['@所有人，hello', ['Alice', 'allison', 'Bob']],
    ['hello everyone', ['Alice', 'allison', 'Bob']],
  ])('%s selects only the intended members', (text, expected) => {
    const f = fixture()
    expect(replyMembers(f.data, f.group, text).map(item => item.name)).toEqual(expected)
  })
  it('still rejects an explicit identity that has left the group', () => {
    const f = fixture()
    expect(() => replyMembers(f.data, f.group, '@[avatar:removed.png] hi')).toThrow('已不在此群')
  })
})

describe('mood in the same structured reply', () => {
  it.each([0, 52.5, 100])('accepts mood %s without an additional request', mood => {
    const pipe = new WeChatPipeline({}, {}, {}, {})
    expect(pipe.parseReplyJson(JSON.stringify({ messages: [{ type: 'text', content: 'hello' }], mood }))).toMatchObject({ mood })
  })
  it.each([-1, 101, '82', null, {}, true])('ignores invalid mood %s while preserving the reply', mood => {
    const pipe = new WeChatPipeline({}, {}, {}, {})
    expect(pipe.parseReplyJson(JSON.stringify({ messages: [{ type: 'text', content: 'hello' }], mood }))).toEqual({ messages: [{ type: 'text', content: 'hello' }] })
  })
})
