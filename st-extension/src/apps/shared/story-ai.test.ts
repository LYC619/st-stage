// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost, PhoneAppContext } from '../../../../core/phone-registry'
import { createDefaultSettings } from '../../../../core/types'
import { getStoryAiConfig, requestChat, saveStoryAiConfig, STORY_AI_APP_ID } from './story-ai'

afterEach(() => {
  delete window.__stStageMockStoryAi
  vi.restoreAllMocks()
})

describe('story-ai hub', () => {
  it('prioritizes direct story-ai config over wechat and api profiles', () => {
    const settings = {
      ...createDefaultSettings(),
      apps: {
        [STORY_AI_APP_ID]: { apiKey: 'direct-key', apiUrl: 'https://example.test/v1/chat/completions', model: 'm-direct' },
        'wechat-sister': { config: { apiKey: 'wx-key', apiUrl: 'https://wx.test/v1/chat/completions', model: 'm-wx' } },
      },
    }
    const host = { getSettings: () => settings } as unknown as AppHost
    expect(getStoryAiConfig(host)).toMatchObject({
      apiKey: 'direct-key',
      apiUrl: 'https://example.test/v1/chat/completions',
      model: 'm-direct',
    })
  })

  it('reuses stored OpenAI-compatible API app profiles when direct and wechat keys are absent', () => {
    const settings = {
      ...createDefaultSettings(),
      apps: {
        api: {
          profiles: [
            {
              version: 2,
              id: 'p1',
              name: '主力反代',
              mainApi: 'openai',
              source: 'custom',
              url: 'https://proxy.example.test/v1',
              key: 'proxy-secret',
              secretId: '',
              secretMode: 'stored',
              model: 'claude-3-7-sonnet',
              settings: {},
            },
          ],
        },
      },
    }
    const host = { getSettings: () => settings } as unknown as AppHost
    expect(getStoryAiConfig(host)).toEqual({
      apiKey: 'proxy-secret',
      apiUrl: 'https://proxy.example.test/v1/chat/completions',
      model: 'claude-3-7-sonnet',
      sourceLabel: 'API 档案「主力反代」',
    })
  })

  it('validates URL and persists via saveStoryAiConfig', () => {
    let settings = createDefaultSettings()
    const ctx = {
      getSettings: () => settings,
      updateSettings: (next: typeof settings) => {
        settings = next
      },
    } as unknown as PhoneAppContext

    expect(() => saveStoryAiConfig(ctx, { apiKey: 'k', apiUrl: 'ftp://bad.test' })).toThrow(/http/i)
    saveStoryAiConfig(ctx, { apiKey: 'k-ok', apiUrl: 'https://api.deepseek.com/chat/completions', model: 'deepseek-chat' })
    expect(getStoryAiConfig(ctx)?.apiKey).toBe('k-ok')

    saveStoryAiConfig(ctx, null)
    expect(getStoryAiConfig(ctx)).toBeNull()
  })

  it('supports simulator local mock responder when registered on window', async () => {
    window.__stStageMockStoryAi = vi.fn(async () => '{"ok":true}')
    const host = { getSettings: () => createDefaultSettings() } as unknown as AppHost
    const cfg = getStoryAiConfig(host)
    expect(cfg?.apiKey).toBe('__simulator_mock__')
    await expect(requestChat(cfg!, [{ role: 'user', content: 'hi' }])).resolves.toBe('{"ok":true}')
  })
})
