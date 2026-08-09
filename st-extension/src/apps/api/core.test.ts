import { describe, expect, it } from 'vitest'
import { API_SOURCES, COMMON_CHAT_SOURCES, emptyDraft, findActiveProfile, getSource, normalizeUrl, parseModelList, sanitizeAppData, upsertProfile, validateDraft } from './core'

describe('API profile v2', () => {
  it('migrates legacy custom profiles without losing connection fields', () => {
    const result = sanitizeAppData({ profiles: [{ id: 'old', name: '旧中转', url: 'https://a.com/v1/', key: 'secret', model: 'm', includeBody: 'top_k: 20', excludeBody: 'stop', includeHeaders: 'X-Test: yes' }] })
    expect(result.profiles[0]).toMatchObject({ version: 2, mainApi: 'openai', source: 'custom', url: 'https://a.com/v1', key: 'secret', model: 'm', settings: { custom_include_body: 'top_k: 20', custom_exclude_body: 'stop', custom_include_headers: 'X-Test: yes' } })
  })

  it('supports providers that do not require a URL', () => {
    const draft = { ...emptyDraft(), name: 'OpenAI', source: 'openai', url: '' }
    expect(validateDraft(draft)).toBeNull()
    const saved = upsertProfile([], draft, null)
    expect('profiles' in saved && saved.profiles[0].source).toBe('openai')
  })

  it('keeps plaintext keys in current profiles', () => {
    const result = sanitizeAppData({ profiles: [{
      version: 2,
      id: 'plain',
      name: '主力',
      mainApi: 'openai',
      source: 'openai',
      url: '',
      key: 'sk-plain',
      secretId: '',
      secretMode: 'stored',
      model: 'gpt-test',
      settings: {},
    }] })
    expect(result.profiles[0]).toMatchObject({ key: 'sk-plain', secretMode: 'stored' })
  })

  it('requires a valid URL only for URL-based sources', () => {
    expect(validateDraft({ ...emptyDraft(), name: '自定义', url: '' })).toContain('URL')
    expect(validateDraft({ ...emptyDraft(), name: '自定义', url: 'ftp://x' })).toContain('http')
  })

  it('matches current connection by API type, source, URL and model', () => {
    const profiles = sanitizeAppData({ profiles: [
      { version: 2, id: 'one', name: '快', mainApi: 'openai', source: 'custom', url: 'https://a/v1', model: 'fast', key: '', settings: {} },
      { version: 2, id: 'two', name: '强', mainApi: 'openai', source: 'custom', url: 'https://a/v1', model: 'smart', key: '', settings: {} },
    ] }).profiles
    expect(findActiveProfile(profiles, { mainApi: 'openai', source: 'custom', url: 'https://a/v1/', model: 'smart' })?.id).toBe('two')
    expect(findActiveProfile(profiles, { mainApi: 'openai', source: 'openrouter', url: '', model: 'smart' })).toBeUndefined()
  })

  it('describes chat and text completion sources', () => {
    expect(API_SOURCES.some((item) => item.mainApi === 'openai' && item.id === 'custom')).toBe(true)
    expect(getSource('textgenerationwebui').urlField).toBeTruthy()
  })


  it('offers only common native channels plus the OpenAI-compatible custom entry', () => {
    expect(COMMON_CHAT_SOURCES.map((item) => item.id)).toEqual([
      'openai',
      'claude',
      'openrouter',
      'makersuite',
      'custom',
    ])
    expect(COMMON_CHAT_SOURCES.every((item) => item.mainApi === 'openai')).toBe(true)
    expect(COMMON_CHAT_SOURCES.map((item) => [item.id, item.modelField, item.modelSelector, item.secretKey, item.keySelector])).toEqual([
      ['openai', 'openai_model', '#model_openai_select', 'api_key_openai', '#api_key_openai'],
      ['claude', 'claude_model', '#model_claude_select', 'api_key_claude', '#api_key_claude'],
      ['openrouter', 'openrouter_model', '#model_openrouter_select', 'api_key_openrouter', '#api_key_openrouter'],
      ['makersuite', 'google_model', '#model_google_select', 'api_key_makersuite', '#api_key_makersuite'],
      ['custom', 'custom_model', '#custom_model_id', 'api_key_custom', '#api_key_custom'],
    ])
  })
})

describe('shared parsing', () => {
  it('normalizes URLs and parses model response shapes', () => {
    expect(normalizeUrl(' https://a/v1/// ')).toBe('https://a/v1')
    expect(parseModelList({ data: [{ id: 'b' }, { model: 'a' }] })).toEqual(['a', 'b'])
    expect(parseModelList({ models: ['x'] })).toEqual(['x'])
  })

  it('preserves upstream model errors', () => {
    expect(() => parseModelList({ error: true, message: '密钥无效' })).toThrow('密钥无效')
  })
})
