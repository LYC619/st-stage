// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createSTCloudExportBridge } from './bridge'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('cloud export ST bridge', () => {
  it('reads the release endpoints and preserves selected asset content', async () => {
    const calls: Array<{ url: string; method: string; body?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, method: init?.method ?? 'GET', body: typeof init?.body === 'string' ? init.body : undefined })
      if (url === '/api/characters/all') {
        return new Response(JSON.stringify([{ name: 'Alice', avatar: 'Alice.png' }]), { status: 200 })
      }
      if (url === '/api/characters/chats') {
        return new Response(JSON.stringify([{ file_name: 'first-chat.jsonl', last_mes: 1234 }]), { status: 200 })
      }
      if (url === '/api/worldinfo/list') {
        return new Response(JSON.stringify([{ file_id: 'World', name: '世界' }]), { status: 200 })
      }
      if (url === '/api/worldinfo/get') {
        return new Response(JSON.stringify({ entries: { '1': { content: 'hello' } } }), { status: 200 })
      }
      if (url === '/api/settings/get') {
        return new Response(JSON.stringify({
          settings: JSON.stringify({ extension_settings: { regex: [{ find: 'secret?' }] } }),
          openai_setting_names: ['creative'],
          openai_settings: [JSON.stringify({ temperature: 0.7 })],
        }), { status: 200 })
      }
      throw new Error(`unexpected request: ${url}`)
    }))

    const bridge = createSTCloudExportBridge()
    const snapshot = await bridge.loadSnapshot()

    expect(snapshot.characters[0]).toMatchObject({ name: 'Alice', avatar: 'Alice.png' })
    expect(snapshot.characters[0].chats[0]).toMatchObject({ name: 'first-chat', path: 'first-chat.jsonl', updatedAt: 1234 })
    expect(snapshot.worldbooks[0]).toMatchObject({ name: '世界', fileName: 'World.json', content: { entries: { '1': { content: 'hello' } } } })
    expect(snapshot.presets[0]).toMatchObject({ name: 'creative', fileName: 'creative.json', content: { temperature: 0.7 } })
    expect(snapshot.regex?.rules).toEqual([{ find: 'secret?' }])
    expect(calls.map((call) => call.url)).toEqual(expect.arrayContaining([
      '/api/characters/all',
      '/api/characters/chats',
      '/api/worldinfo/list',
      '/api/worldinfo/get',
      '/api/settings/get',
    ]))
  })

  it('uses the release export and chat endpoints for binary and JSONL content', async () => {
    const calls: Array<{ url: string; body?: string }> = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push({ url, body: typeof init?.body === 'string' ? init.body : undefined })
      if (url === '/api/characters/export') return new Response(new Uint8Array([1, 2, 3]), { status: 200 })
      if (url === '/api/chats/get') {
        return new Response(JSON.stringify([{ mes: 'one' }, { mes: 'two' }]), { status: 200 })
      }
      throw new Error(`unexpected request: ${url}`)
    }))

    const bridge = createSTCloudExportBridge()
    const character = { id: 'Alice.png', name: 'Alice', avatar: 'Alice.png', chats: [] }
    const chat = { id: 'first-chat', name: 'first-chat', path: 'first-chat.jsonl' }
    expect(new Uint8Array(await bridge.readCharacterCard(character))).toEqual(new Uint8Array([1, 2, 3]))
    expect(await bridge.readChat(character, chat)).toBe('{"mes":"one"}\n{"mes":"two"}\n')
    expect(calls).toEqual([
      { url: '/api/characters/export', body: '{"format":"png","avatar_url":"Alice.png"}' },
      { url: '/api/chats/get', body: '{"ch_name":"Alice","avatar_url":"Alice.png","file_name":"first-chat"}' },
    ])
  })
})
