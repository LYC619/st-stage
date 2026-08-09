// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { applyProfile, fetchModels, readConnection } from './bridge'
import type { ApiProfile } from './core'

const profile = (over: Partial<ApiProfile> = {}): ApiProfile => ({ version: 2, id: 'p', name: '自定义', mainApi: 'openai', source: 'custom', url: 'https://example.com/v1', key: 'secret', secretId: 'sid', secretMode: 'stored', model: 'model-a', settings: { custom_include_body: 'top_k: 20' }, ...over })
const response = (ok: boolean, body: unknown = {}): Response => ({ ok, status: ok ? 200 : 401, json: async () => body }) as Response

function installST(settings: Record<string, unknown> = {}): Record<string, unknown> {
  const context = { mainApi: 'openai', onlineStatus: 'connected', chatCompletionSettings: { chat_completion_source: 'custom', custom_url: 'https://old/v1', custom_model: 'old', ...settings }, getRequestHeaders: () => ({ 'Content-Type': 'application/json' }), saveSettingsDebounced: vi.fn() }
  Object.defineProperty(window, 'SillyTavern', { configurable: true, value: { getContext: () => context } })
  return context.chatCompletionSettings
}

beforeEach(() => {
  document.body.innerHTML = '<select id="main_api"><option value="openai">openai</option></select><select id="chat_completion_source"><option value="custom">custom</option></select><input id="custom_api_url_text"><input id="custom_model_id"><input id="api_key_custom"><button id="api_button_openai"></button>'
})
afterEach(() => { vi.unstubAllGlobals(); document.body.textContent = ''; Reflect.deleteProperty(window, 'SillyTavern') })

describe('SillyTavern bridge', () => {
  it('imports URL, model and readable key through /api/secrets/find', async () => {
    installST(); vi.stubGlobal('fetch', vi.fn(async () => response(true, { value: 'readable-key' })))
    await expect(readConnection()).resolves.toMatchObject({ mainApi: 'openai', source: 'custom', url: 'https://old/v1', model: 'old', key: 'readable-key', secretMode: 'read' })
  })

  it('writes key, URL, model and settings before connecting', async () => {
    const settings = installST(); const clicked = vi.fn(); document.querySelector('#api_button_openai')?.addEventListener('click', clicked)
    const calls: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => { calls.push(`${input}:${String(init?.body)}`); return response(true) }))
    await applyProfile(profile())
    expect(calls[0]).toContain('/api/secrets/write')
    expect(calls[0]).toContain('"id":"sid"')
    expect(settings).toMatchObject({ custom_url: 'https://example.com/v1', custom_model: 'model-a', custom_include_body: 'top_k: 20' })
    expect((document.querySelector('#custom_api_url_text') as HTMLInputElement).value).toBe('https://example.com/v1')
    expect(clicked).toHaveBeenCalledOnce()
    await expect(readConnection()).resolves.toMatchObject({ model: 'model-a', online: true })
  })

  it.each([
    ['openai', 'openai_model', 'model_openai_select', 'api_key_openai'],
    ['claude', 'claude_model', 'model_claude_select', 'api_key_claude'],
    ['openrouter', 'openrouter_model', 'model_openrouter_select', 'api_key_openrouter'],
    ['makersuite', 'google_model', 'model_google_select', 'api_key_makersuite'],
  ])('writes the %s key and model through its native ST fields', async (source, modelField, modelSelector, secretKey) => {
    const settings = installST({ chat_completion_source: source, [modelField]: 'old' })
    document.body.innerHTML = [
      '<select id="main_api"><option value="openai">openai</option></select>',
      `<select id="chat_completion_source"><option value="${source}">${source}</option></select>`,
      `<select id="${modelSelector}"><option value="model-next">model-next</option></select>`,
      `<input id="${secretKey}">`,
      '<button id="api_button_openai"></button>',
    ].join('')
    const writes: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/write')) writes.push(String(init?.body))
      return response(true)
    }))

    await applyProfile(profile({ source, url: '', model: 'model-next', secretId: '' }))

    expect(settings).toMatchObject({ chat_completion_source: source, [modelField]: 'model-next' })
    expect(writes[0]).toContain(`"key":"${secretKey}"`)
    expect(writes[0]).toContain('"value":"secret"')
    expect((document.querySelector(`#${secretKey}`) as HTMLInputElement).value).toBe('secret')
  })

  it('connects once to load a delayed model option, then selects it and reconnects', async () => {
    const settings = installST({ chat_completion_source: 'openai', openai_model: 'none' })
    document.body.innerHTML = '<select id="main_api"><option value="openai">openai</option></select><select id="chat_completion_source"><option value="openai">openai</option></select><select id="model_openai_select"><option value="none">NONE</option></select><input id="api_key_openai"><button id="api_button_openai"></button>'
    vi.stubGlobal('fetch', vi.fn(async () => response(true)))
    const button = document.querySelector('#api_button_openai')!
    let clicks = 0
    button.addEventListener('click', () => {
      clicks += 1
      if (clicks === 1) setTimeout(() => {
        const select = document.querySelector<HTMLSelectElement>('#model_openai_select')!
        select.add(new Option('gpt-test', 'gpt-test'))
      }, 30)
    })
    const connected = await applyProfile(profile({ source: 'openai', url: '', model: 'gpt-test' }))
    expect(clicks).toBe(2)
    expect((document.querySelector('#model_openai_select') as HTMLSelectElement).value).toBe('gpt-test')
    expect(settings).toMatchObject({ openai_model: 'gpt-test' })
    expect(connected.model).toBe('gpt-test')
  })

  it('falls back to the legacy secret slot when secret-id write is rejected', async () => {
    installST(); const bodies: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => { bodies.push(String(init?.body)); return response(bodies.length > 1) }))
    await applyProfile(profile())
    expect(bodies.length).toBeGreaterThanOrEqual(2)
    expect(bodies[0]).toContain('"id":"sid"')
    expect(bodies[1]).not.toContain('"id":"sid"')
  })

  it('serializes custom model discovery and restores the current readable key', async () => {
    installST(); const events: string[] = []
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/find')) return response(true, { value: 'original' })
      const body = JSON.parse(String(init?.body)) as { value?: string; custom_url?: string }
      if (String(input).endsWith('/write')) { events.push(`key:${body.value}`); return response(true) }
      events.push(`status:${body.custom_url}`); return response(true, { data: [{ id: 'model-z' }] })
    }))
    await expect(fetchModels(profile({ key: 'temporary' }))).resolves.toEqual(['model-z'])
    expect(events).toEqual(['key:temporary', 'status:https://example.com/v1', 'key:original'])
  })

  it('rejects model discovery for providers without model enumeration', async () => {
    installST()
    await expect(fetchModels(profile({ source: 'openai', url: '' }))).rejects.toThrow('不支持自动获取模型')
  })
})
