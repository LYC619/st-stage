// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost, PhoneAppContext } from '../../../../core/phone-registry'
import { createDefaultSettings } from '../../../../core/types'
import { readChatMetadata, storyIdentity, writeChatMetadata } from './chat-metadata'
import { getStoryAiConfig, requestChat, saveStoryAiConfig, STORY_AI_APP_ID } from './story-ai'
import { formatStoryDate, parseSpanEnd, relationToToday, storyToday } from './story-date'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function installST(getCtx: () => Record<string, unknown>) {
  const st = { getContext: getCtx }
  vi.stubGlobal('SillyTavern', st)
  vi.stubGlobal('window', { SillyTavern: st })
}

describe('shared chat metadata', () => {
  it('merges one key safely, supports direct mutation fallback, and rejects writes after a chat switch', async () => {
    let chatId = 'one'
    const chatMetadata: Record<string, unknown> = { unrelated: { keep: true } }
    const saveMetadata = vi.fn(async () => {})
    const updateChatMetadata = vi.fn((value: Record<string, unknown>) => Object.assign(chatMetadata, value))
    installST(() => ({ chatId, chatMetadata, saveMetadata, updateChatMetadata }))

    const host = { getCharacterName: () => '角色' } as AppHost
    const key = storyIdentity(host)
    expect(await writeChatMetadata(host, key, 'chronicle', { entries: [] })).toBe(true)
    expect(readChatMetadata('chronicle')).toEqual({ entries: [] })
    expect(chatMetadata.unrelated).toEqual({ keep: true })
    expect(updateChatMetadata).toHaveBeenCalledWith({ chronicle: { entries: [] } }, false)

    chatId = 'two'
    expect(await writeChatMetadata(host, key, 'chronicle', {})).toBe(false)
    expect(saveMetadata).toHaveBeenCalledOnce()

    const plainMeta: Record<string, unknown> = {}
    installST(() => ({ chatId: 'one', chatMetadata: plainMeta, saveMetadata: vi.fn(async () => {}) }))
    await writeChatMetadata(host, storyIdentity(host), 'test', { v: 1 })
    expect(plainMeta).toEqual({ test: { v: 1 } })
  })
})

describe('story dates', () => {
  it('parses span ends, formats bidirectional relative buckets, and resolves storyToday priority', async () => {
    expect(formatStoryDate(parseSpanEnd('2026-01-02 10:00 ~ 2026-01-03 01:00')!)).toBe('2026-01-03')
    expect(formatStoryDate(parseSpanEnd('2024-02-29')!)).toBe('2024-02-29')
    expect(parseSpanEnd('2026-02-30')).toBeNull()
    expect(parseSpanEnd('昨天')).toBeNull()

    const today = new Date(2026, 5, 10, 14)
    for (const [days, expected] of [
      [0, '今天'], [1, '昨天'], [2, '前天'], [3, '3天前'], [7, '一周前'], [14, '14天前'],
      [15, '半个月前'], [21, '三周前'], [30, '一个月前'], [45, '一个半月前'], [60, '两个月前'],
      [180, '半年前'], [360, '一年前'], [540, '一年半前'], [720, '两年前'],
    ] as const) {
      const target = new Date(2026, 5, 10 - days, 2)
      expect(relationToToday(target, today)).toBe(expected)
      expect(relationToToday(today, target)).toBe(days === 0 ? '今天' : days === 1 ? '明天' : days === 2 ? '后天' : expected.replace(/前$/, '后'))
    }

    const entry = { code: 'AM0001', timeSpan: '2026-03-02 ~ 2026-03-03', summary: '概要', text: '正文', keyDialogue: [], createdAt: 1 }
    const meta: Record<string, unknown> = {
      st_stage_story_state: { stat_data: { 时间: { 年: 2026, 月: 4, 日: 5 } } },
      st_stage_chronicle: { entries: [entry], lastMessageIndex: 0 },
    }
    installST(() => ({ chat: [], chatMetadata: meta }))
    const host = { getCharacterName: () => '角色' } as AppHost
    expect(formatStoryDate((await storyToday(host))!)).toBe('2026-04-05')
    delete meta.st_stage_story_state
    expect(formatStoryDate((await storyToday(host))!)).toBe('2026-03-03')
    entry.timeSpan = ''
    expect(await storyToday(host)).toBeNull()
  })
})

describe('story-ai hub', () => {
  it('resolves direct/wechat/API-profile fallback order, normalizes bare host URLs, and reports upstream errors', async () => {
    vi.stubGlobal('window', {})
    const directSettings = {
      ...createDefaultSettings(),
      apps: {
        [STORY_AI_APP_ID]: { apiKey: 'direct-key', apiUrl: 'https://example.test/v1/chat/completions', model: 'm-direct' },
        'wechat-sister': { config: { apiKey: 'wx-key', apiUrl: 'https://wx.test/v1/chat/completions', model: 'm-wx' } },
      },
    }
    expect(getStoryAiConfig({ getSettings: () => directSettings } as unknown as AppHost)?.apiKey).toBe('direct-key')

    const profileSettings = {
      ...createDefaultSettings(),
      apps: {
        api: {
          profiles: [{
            version: 2, id: 'p1', name: '主力反代', mainApi: 'openai', source: 'custom',
            url: 'https://proxy.example.test/v1', key: 'proxy-secret', secretId: '', secretMode: 'stored', model: 'claude-3-7', settings: {},
          }],
        },
      },
    }
    expect(getStoryAiConfig({ getSettings: () => profileSettings } as unknown as AppHost)).toMatchObject({
      apiKey: 'proxy-secret',
      apiUrl: 'https://proxy.example.test/v1/chat/completions',
      sourceLabel: 'API 档案「主力反代」',
    })

    let saved = createDefaultSettings()
    const ctx = { getSettings: () => saved, updateSettings: (next: typeof saved) => { saved = next } } as unknown as PhoneAppContext
    expect(() => saveStoryAiConfig(ctx, { apiKey: 'k', apiUrl: 'ftp://bad.test' })).toThrow(/http/i)
    saveStoryAiConfig(ctx, { apiKey: 'sk-ds', apiUrl: 'https://api.deepseek.com', model: 'deepseek-chat' })
    expect(getStoryAiConfig(ctx)?.apiUrl).toBe('https://api.deepseek.com/chat/completions')
    saveStoryAiConfig(ctx, null)
    expect(getStoryAiConfig(ctx)).toBeNull()

    vi.stubGlobal('window', { __stStageMockStoryAi: vi.fn(async () => '{"ok":true}') })
    const mockCfg = getStoryAiConfig({ getSettings: () => createDefaultSettings() } as unknown as AppHost)!
    expect(mockCfg.apiKey).toBe('__simulator_mock__')
    await expect(requestChat(mockCfg, [{ role: 'user', content: 'hi' }])).resolves.toBe('{"ok":true}')

    vi.stubGlobal('window', {})
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: false, status: 401, json: async () => ({ error: { message: 'Authentication Fails' } }),
    }) as Response))
    await expect(
      requestChat({ apiKey: 'bad', apiUrl: 'https://api.deepseek.com', model: 'deepseek-chat' }, [{ role: 'user', content: 'hi' }]),
    ).rejects.toThrow('AI 连接失败（401：Authentication Fails）')
  })
})
