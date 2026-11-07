// @vitest-environment jsdom
import { describe, expect, it, afterEach, vi } from 'vitest'
import { normalizeProfile, applyAssetOverrides, mappedValue, safeAssetUrl } from './profile'
import { createProfileEditor } from './profile-editor'
import { extractFieldsFromObject, extractRecentSTMessages } from './bridge'
import { getScopedConversation } from './wechat-app'
import { WeChatPipeline } from './pipeline'
import { PLAYER_EMOJIS } from './manifest-data'
import type { WeChatAppData } from './types'
import type { AppHost } from '../../../../core/phone-registry'

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren() })
describe('WeChat configurable scene', () => {
  it('preserves old scene and conversations and applies a new opening only to new chats', () => {
    expect(normalizeProfile().preset).toBe('cohabitation')
    const data: WeChatAppData = { config: {} }
    const old = getScopedConversation(data, 'Alice')
    const text = old.messages[0].content
    data.config.profile = { preset: 'general', openingMessage: '自定义开场' }
    expect(getScopedConversation(data, 'Alice')).toBe(old)
    expect(old.messages[0].content).toBe(text)
    const next = getScopedConversation(data, 'Bob')
    expect(next.messages[0].content).toBe('自定义开场')
    expect(next.state.money).toBe(0)
    expect(next.state.contactLocation).toBe('未设定')
  })
  it('uses explicit nested mappings without unrelated alias fallback and preserves tuples', () => {
    const raw = { stat_data: { mood: 99, Alice: { score: [42, 'description'], place: '图书馆' } } }
    const result = extractFieldsFromObject(raw, 'Alice', { mood: 'Alice.score', location: 'Alice.place', money: 'Alice.missing' })
    expect(result.mood).toBe(42); expect(result.location).toBe('图书馆'); expect(result.money).toBeUndefined()
    expect(extractFieldsFromObject(raw, 'Alice', { mood: 'missing.path' }).mood).toBeUndefined()
    expect(mappedValue(raw, 'constructor.prototype')).toBeUndefined()
    expect(raw.stat_data.Alice.score).toEqual([42, 'description'])
  })
  it('omits disabled main-chat context at both extraction and prompt boundaries', () => {
    const host = { getChatContext: () => ({ chat: [{ mes: 'PRIVATE_MAIN_CHAT', is_user: true }] }) } as AppHost
    expect(extractRecentSTMessages(host, 0)).toBeUndefined()
    const pipeline = new WeChatPipeline({ profile: { preset: 'general', contextMessageCount: 0, playerName: '小王' } }, {}, {}, {})
    const conv = getScopedConversation({ config: { profile: { preset: 'general' } } }, '妹妹')
    const prompt = pipeline.buildSystemPrompt(conv.state, '19:00', { scopeKey: 'a', characterName: '妹妹', externalState: { source: 'none' }, stRecentMessages: [{ sender: 'user', text: 'PRIVATE_MAIN_CHAT' }] })
    expect(prompt).not.toContain('PRIVATE_MAIN_CHAT')
    expect(prompt).not.toContain('玩家的妹妹')
    expect(prompt).not.toContain('半推半就')
    expect(prompt).toContain('用户称呼：小王')
    expect(pipeline.getLocalFallbackReply([]).messages).toEqual([{ type: 'text', content: '收到你的消息了。' }])
  })
  it('provides default emoji groups and respects explicit disabled groups', () => {
    const id = Object.keys(PLAYER_EMOJIS)[0]
    const profile = normalizeProfile({ profile: { preset: 'general', assetOverrides: { [`player.${id}`]: 'https://example.test/picture.png', 'player.bad': 'javascript:alert(1)' } } })
    const assets = applyAssetOverrides(PLAYER_EMOJIS, 'player', profile)
    expect(Object.keys(assets)).toEqual(Object.keys(PLAYER_EMOJIS))
    expect(applyAssetOverrides(PLAYER_EMOJIS, 'player', normalizeProfile({ profile: { useBuiltinAssets: false } }))).toEqual({})
    expect(profile.assetGroups.photo).toBe(false)
    expect(assets[id].file).toBe('https://example.test/picture.png')
    expect(profile.assetOverrides['player.bad']).toBeUndefined()
    expect(safeAssetUrl('https://user:secret@example.test/a')).toBe(false)
    expect(safeAssetUrl('/user/images/Alice/picture%20one.png')).toBe(true)
    expect(safeAssetUrl('/user/images/%2e%2e/settings.json')).toBe(false)
    expect(safeAssetUrl('/user/images/%252e%252e/settings.json')).toBe(false)
  })
  it('round-trips the real profile editor, preserving overrides and rejecting invalid paths', () => {
    const editor = createProfileEditor(document.body)
    const profile = normalizeProfile({ profile: { preset: 'general', contactName: '<img onerror=alert(1)>', contextMessageCount: 0, mappings: { mood: 'Alice.score' } } })
    editor.fill(profile)
    expect(editor.read()).toEqual(profile)
    expect(document.querySelector('img')?.getAttribute('src')).toContain('/assets/wechat/')
    const input = document.querySelector<HTMLInputElement>('input[aria-label^="素材图片地址"]')!
    input.value = 'javascript:alert(1)'
    expect(() => editor.read()).toThrow('素材地址')
  })
})
