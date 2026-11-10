// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { generateChronicle, parseChronicle, pendingStory } from './generate'
import { nextCode, readChronicleData, readChronicleSettings } from './store'
import * as ai from '../shared/story-ai'
import * as dates from '../shared/story-date'

const content = { summary: '找到船票', text: '众人找到船票后前往码头。', timeSpan: '2026-01-01', keyDialogue: ['甲：出发。'] }
afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('chronicle generation', () => {
  it('requires content and treats malformed dialogue as empty', () => {
    expect(parseChronicle(JSON.stringify(content))).toEqual(content)
    expect(parseChronicle(JSON.stringify({ ...content, keyDialogue: ['甲', 3] })).keyDialogue).toEqual([])
    expect(() => parseChronicle('{bad')).toThrow('JSON')
    expect(() => parseChronicle('{"summary":" ","text":"正文"}')).toThrow('格式不对')
  })
  it('reads the entire unsummarized chat, cleaning HTML and skipping system messages', () => {
    const chat = Array.from({ length: 65 }, (_, i) => ({ mes: `<p>第${i}条</p><think>private</think>`, is_user: i % 2 === 0, name: '甲' }))
    vi.stubGlobal('SillyTavern', { getContext: () => ({ chat: [...chat, { mes: '系统', is_system: true }] }) })
    const host = { getCharacterName: () => '角色' } as AppHost
    const pending = pendingStory(host, -1)
    expect(pending.messages).toHaveLength(65); expect(pending.messages[0]).toBe('甲：第0条')
    expect(pending.aiCount).toBe(32); expect(pending.endIndex).toBe(65)
    expect(pendingStory(host, 10).messages).toHaveLength(54)
    expect(pendingStory(host, 100)).toEqual({ lastMessageIndex: 65, endIndex: 65, messages: [], aiCount: 0 })
  })
  it('continues from the maximum code and normalizes stored settings', () => {
    const entries = [9, 3].map(n => ({ ...content, code: `AM000${n}`, createdAt: n }))
    vi.stubGlobal('SillyTavern', { getContext: () => ({ chatMetadata: { st_stage_chronicle: { entries, lastMessageIndex: 30 } } }) })
    const data = readChronicleData(); expect(nextCode(data)).toBe('AM0010'); expect(data.entries).toHaveLength(2)
    expect(readChronicleSettings({ getAppData: () => undefined } as AppHost)).toEqual({ autoGenerate: true, inject: true, interval: 4 })
    expect(readChronicleSettings({ getAppData: () => ({ interval: 50, inject: false }) } as AppHost).interval).toBe(20)
  })
  it('sends copied constraints and recent overviews, clearing an invented date when today is unknown', async () => {
    vi.spyOn(dates, 'storyToday').mockResolvedValue(null)
    const request = vi.spyOn(ai, 'requestChat').mockResolvedValue(JSON.stringify(content))
    const host = { getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test' } } } }) } as unknown as AppHost
    const entries = [1, 2, 3, 4].map(n => ({ ...content, code: `AM000${n}`, summary: `概要${n}`, createdAt: n }))
    const result = await generateChronicle(host, { lastMessageIndex: 0, endIndex: 1, aiCount: 1, messages: ['甲：走吧'] }, entries, new AbortController().signal)
    expect(result.timeSpan).toBe('')
    const messages = request.mock.calls[0][1]
    expect(messages[0].content).toContain('以第三方视角中立客观记录'); expect(messages[0].content).toContain('300–500字')
    expect(messages[1].content).toContain('未知'); expect(messages[1].content).toContain('甲：走吧')
    expect(messages[1].content).not.toContain('概要1'); expect(messages[1].content).toContain('概要2')
  })
})
