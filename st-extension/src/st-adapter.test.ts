// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { STAdapter } from './st-adapter'
import { createDefaultSettings } from '../../core/types'
import { getPresetPacks, presetSpriteKey } from '../../core/presets'

afterEach(() => {
  delete window.SillyTavern
  vi.unstubAllGlobals()
})

describe('STAdapter story context', () => {
  it('uses chatId as the direct-chat title when chat metadata has no filename', () => {
    window.SillyTavern = {
      getContext: () => ({
        characterId: '3',
        chatId: '第一章',
        name2: '小雪',
        characters: [],
      }),
    } as never

    expect(new STAdapter().getStoryContext()).toEqual({
      key: '3::第一章',
      title: '第一章',
      characterName: '小雪',
    })
  })
})

describe('STAdapter settings persistence', () => {
  it('loads merged preset overrides beside custom packs', async () => {
    const preset = getPresetPacks()[0]
    const sprite = preset.sprites[0]
    const saved = {
      ...createDefaultSettings(),
      packs: [{ id: 'custom', name: '自定义', sprites: [] }],
      presetOverrides: {
        [preset.id]: {
          metadata: { name: '本地常服' },
          localSprites: { [presetSpriteKey(sprite)]: '/user/images/sprite-overlay/local.webp' },
        },
      },
    }
    window.SillyTavern = {
      getContext: () => ({ extensionSettings: { sprite_overlay: saved } }),
    } as never

    const loaded = await new STAdapter().loadSettings()
    const mergedPreset = loaded.packs.find((pack) => pack.id === preset.id)!

    expect(mergedPreset.name).toBe('本地常服')
    expect(mergedPreset.sprites[0]).toMatchObject({
      url: '/user/images/sprite-overlay/local.webp',
      remoteUrl: sprite.url,
    })
    expect(loaded.packs.some((pack) => pack.id === 'custom')).toBe(true)
  })

  it('persists only custom packs and preset overrides', async () => {
    const saveSettingsDebounced = vi.fn()
    const context = { extensionSettings: {} as Record<string, unknown>, saveSettingsDebounced }
    window.SillyTavern = { getContext: () => context } as never
    const settings = createDefaultSettings()
    settings.packs = [
      ...getPresetPacks(),
      { id: 'preset_custom_story', name: '前缀只是巧合', sprites: [] },
      { id: 'custom', name: '自定义', sprites: [] },
    ]
    settings.presetOverrides[getPresetPacks()[0].id] = { metadata: { name: '覆盖名' } }

    await new STAdapter().saveSettings(settings)

    expect(context.extensionSettings.sprite_overlay).toMatchObject({
      presetOverrides: settings.presetOverrides,
      packs: [
        { id: 'preset_custom_story', name: '前缀只是巧合', sprites: [] },
        { id: 'custom', name: '自定义', sprites: [] },
      ],
    })
    expect(saveSettingsDebounced).toHaveBeenCalledOnce()
  })
})

describe('STAdapter runtime events', () => {
  it('reads one raw chat message by its exact numeric id without exposing the chat array', () => {
    window.SillyTavern = {
      getContext: () => ({
        chat: [
          { mes: '用户消息', is_user: true },
          { mes: '正文\n<UpdateVariable>变更</UpdateVariable>', is_user: false },
        ],
      }),
    } as never

    const adapter = new STAdapter()

    expect(adapter.getRawMessage(1)).toBe('正文\n<UpdateVariable>变更</UpdateVariable>')
    expect(adapter.getRawMessage('1')).toBe('正文\n<UpdateVariable>变更</UpdateVariable>')
    expect(adapter.getRawMessage('')).toBeNull()
    expect(adapter.getRawMessage('1x')).toBeNull()
    expect(adapter.getRawMessage(9)).toBeNull()
  })

  it.each([
    ['onChatCreated', 'CHAT_CREATED', 'chat_created'],
    ['onGenerationEnded', 'GENERATION_ENDED', 'generation_ended'],
  ] as const)('subscribes %s and removes the exact handler', (method, key, fallback) => {
    const on = vi.fn()
    const removeListener = vi.fn()
    const handler = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { [key]: fallback },
        eventSource: { on, removeListener },
      }),
    } as never

    const off = new STAdapter()[method](handler)

    expect(on).toHaveBeenCalledWith(fallback, handler)
    off()
    expect(removeListener).toHaveBeenCalledWith(fallback, handler)
  })

  it('forwards cumulative streaming text and ignores non-string payloads', () => {
    let wrapped: ((value: unknown) => void) | undefined
    const handler = vi.fn()
    const removeListener = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { STREAM_TOKEN_RECEIVED: 'stream_token_received' },
        eventSource: {
          on: (_event: string, next: (value: unknown) => void) => { wrapped = next },
          removeListener,
        },
      }),
    } as never

    const off = new STAdapter().onStreamText(handler)
    wrapped?.('正文 [立绘:微笑]')
    wrapped?.({ text: '不是事件约定的字符串' })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('正文 [立绘:微笑]')
    off()
    expect(removeListener).toHaveBeenCalledWith('stream_token_received', wrapped)
  })
})

describe('STAdapter local image deletion', () => {
  it('posts a validated user-image path with SillyTavern request headers', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    vi.stubGlobal('fetch', request)
    window.SillyTavern = {
      getContext: () => ({
        getRequestHeaders: () => ({ 'Content-Type': 'application/json', 'X-CSRF-Token': 'token' }),
      }),
    } as never

    await new STAdapter().deleteImage('/user/images/sprite-overlay/小雪/微笑.webp?cache=1')

    expect(request).toHaveBeenCalledWith('/api/images/delete', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': 'token' },
      body: JSON.stringify({ path: 'user/images/sprite-overlay/小雪/微笑.webp' }),
    })
  })

  it('does not decode an already validated path again and treats missing files as deleted', async () => {
    const request = vi.fn().mockResolvedValue(new Response(null, { status: 404 }))
    vi.stubGlobal('fetch', request)
    window.SillyTavern = {
      getContext: () => ({ getRequestHeaders: () => ({ 'Content-Type': 'application/json' }) }),
    } as never

    await new STAdapter().deleteImage('/user/images/100%.webp')

    expect(request).toHaveBeenCalledWith('/api/images/delete', expect.objectContaining({
      body: JSON.stringify({ path: 'user/images/100%.webp' }),
    }))
  })

  it.each([
    'https://example.com/a.webp',
    '/scripts/extensions/a.webp',
    '/user/images/../secrets.txt',
    '/user/images/%2e%2e/secrets.txt',
    '/user/images/..%5C..%5Csecrets.txt',
  ])('rejects a path outside /user/images/: %s', async (path) => {
    window.SillyTavern = { getContext: () => ({}) } as never
    await expect(new STAdapter().deleteImage(path)).rejects.toThrow('用户图片目录')
  })
})
