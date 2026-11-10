// @vitest-environment jsdom
// Local-store cases adapted from WeiMeng (MIT); see commands.ts.
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { applyCommands, extractCommands } from './commands'
import { META_KEY, normalize, readStoryState, writeLocalState } from './store'
import * as bridge from '../mvu/bridge'

afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks() })
function fixture() {
  let chatId = 'A'
  const chats: Record<string, Record<string, unknown>> = { A: {}, B: {} }, save = vi.fn(async () => {})
  vi.stubGlobal('SillyTavern', { getContext: () => ({ chat: [], getCurrentChatId: () => chatId, chatMetadata: chats[chatId],
    updateChatMetadata: (entry: Record<string, unknown>) => { chats[chatId] = { ...chats[chatId], ...entry } }, saveMetadata: save }) })
  const host = { getCharacterName: () => '角色', getChatContext: () => ({ chatId }) } as AppHost
  return { host, chats, save, switch: () => { chatId = chatId === 'A' ? 'B' : 'A' } }
}
describe('story state storage', () => {
  it('reads and accumulates local metadata while preserving unknown fields', async () => {
    const f = fixture(); let snapshot = await readStoryState(f.host)
    expect(snapshot.backend).toBe('local'); expect(snapshot.state.任务).toEqual([])
    await writeLocalState(f.host, snapshot, { HP: 88, 背包: [] })
    for (const name of ['钥匙', '船票']) {
      snapshot = await readStoryState(f.host); applyCommands(snapshot.raw, extractCommands(`_.insert('背包', {"名称":"${name}"});`))
      await writeLocalState(f.host, snapshot, snapshot.raw)
    }
    const result = await readStoryState(f.host)
    expect(result.state.背包.map(item => item.名称)).toEqual(['钥匙', '船票']); expect(result.raw.HP).toBe(88)
    expect(f.save).toHaveBeenCalledTimes(3); expect(f.chats.A[META_KEY]).toMatchObject({ v: 1 })
  })
  it('rejects stale-chat writes and keeps chats independent', async () => {
    const f = fixture(), a = await readStoryState(f.host); f.switch()
    expect(await writeLocalState(f.host, a, { HP: 1 })).toBe(false)
    const b = await readStoryState(f.host); await writeLocalState(f.host, b, { HP: 2 }); f.switch()
    expect((await readStoryState(f.host)).raw).toEqual({}); f.switch(); expect((await readStoryState(f.host)).raw.HP).toBe(2)
  })
  it('selects only populated MVU and never writes it', async () => {
    const f = fixture()
    vi.spyOn(bridge, 'readVariables').mockResolvedValue({ status: 'ready', isMvu: true, data: { 时间: { 显示: '午后' } }, wrapped: true, messageId: 1, meta: { source: 'mvu', waitedMvu: false } })
    const snapshot = await readStoryState(f.host); expect(snapshot.backend).toBe('mvu')
    expect(await writeLocalState(f.host, snapshot, {})).toBe(false); expect(f.save).not.toHaveBeenCalled()
  })
  it('normalizes whitelisted fields, object inventory and quest name alias', () => {
    const state = normalize({ 时间: { 显示: '晚上', extra: 1 }, 任务: [{ 名称: '找猫' }], 背包: { key: { 名称: '钥匙', 数量: 2 } }, HP: 88 })
    expect(state.任务[0].标题).toBe('找猫'); expect(state.背包[0].数量).toBe(2); expect(state).not.toHaveProperty('HP'); expect(state.时间).not.toHaveProperty('extra')
  })
})
