import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLocale, loadTranslations, resetI18n, setLocale, t } from '../../core/i18n'
import { initI18n } from './st-adapter'

const bundleUrl = 'https://example.test/proxy/st/scripts/extensions/third-party/renamed-install/bundle.js?v=123'
const dictionaries = {
  'zh-CN': { common: { confirm: '确认', fallback: '中文后备' } },
  'en-US': { common: { confirm: 'Confirm' } },
}

function responseFor(url: string | URL | Request): Response {
  const locale = String(url).includes('en-US') ? 'en-US' : 'zh-CN'
  return new Response(JSON.stringify(dictionaries[locale]))
}

beforeEach(() => {
  resetI18n()
  vi.stubGlobal('navigator', { language: 'zh-CN' })
  vi.stubGlobal('localStorage', { getItem: vi.fn(() => null) })
  vi.stubGlobal('fetch', vi.fn(responseFor))
  vi.spyOn(console, 'warn').mockImplementation(() => {})
  vi.spyOn(console, 'log').mockImplementation(() => {})
})

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
  resetI18n()
})

describe('initI18n', () => {
  it('loads locales beside the running bundle, retaining proxy prefix and renamed directory', async () => {
    await initI18n(bundleUrl)

    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      'https://example.test/proxy/st/scripts/extensions/third-party/renamed-install/locales/zh-CN.json',
      'https://example.test/proxy/st/scripts/extensions/third-party/renamed-install/locales/en-US.json',
    ])
  })

  it('defaults to the executing module URL and releases successful request timers', async () => {
    vi.useFakeTimers()
    await initI18n()

    const moduleUrl = new URL('./st-adapter.ts', import.meta.url)
    expect(vi.mocked(fetch).mock.calls.map(([url]) => String(url))).toEqual([
      new URL('./locales/zh-CN.json', moduleUrl).href,
      new URL('./locales/en-US.json', moduleUrl).href,
    ])
    expect(vi.getTimerCount()).toBe(0)
  })

  it.each([
    ['EN-us', 'zh-CN', 'en-US'],
    ['zh-cn', 'en-US', 'zh-CN'],
    ['fr-FR', 'en-US', 'zh-CN'],
    [null, 'EN-gb', 'en-US'],
    ['', 'en-US', 'en-US'],
    [null, 'ja-JP', 'zh-CN'],
  ] as const)('selects saved host preference %s before browser %s', async (saved, browser, expected) => {
    const getItem = vi.fn(() => saved)
    vi.stubGlobal('localStorage', { getItem })
    vi.stubGlobal('navigator', { language: browser })

    await initI18n(bundleUrl)

    expect(getLocale()).toBe(expected)
    expect(getItem).toHaveBeenCalledWith('language')
  })

  it('uses the browser locale when storage access throws', async () => {
    vi.stubGlobal('localStorage', { getItem: () => { throw new Error('storage denied') } })
    vi.stubGlobal('navigator', { language: 'en-US' })

    await expect(initI18n(bundleUrl)).resolves.toBeUndefined()
    expect(getLocale()).toBe('en-US')
  })

  it('uses legacy navigator language and the host English default', async () => {
    vi.stubGlobal('navigator', { userLanguage: 'en-AU' })
    await initI18n(bundleUrl)
    expect(getLocale()).toBe('en-US')

    vi.stubGlobal('navigator', {})
    await initI18n(bundleUrl)
    expect(getLocale()).toBe('en-US')
  })

  it('falls back to Chinese and logs the selected locale after an HTTP error', async () => {
    vi.stubGlobal('navigator', { language: 'en-US' })
    vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('en-US')
      ? new Response('', { status: 404 })
      : responseFor(url)))

    await initI18n(bundleUrl)

    expect(getLocale()).toBe('zh-CN')
    expect(t('common.confirm', '确认')).toBe('确认')
    expect(console.log).toHaveBeenLastCalledWith('[sprite-overlay] i18n 已初始化: zh-CN')
  })

  it.each(['{broken json', JSON.stringify({ common: { confirm: 42 } }), JSON.stringify(['wrong'])])(
    'ignores malformed English dictionaries: %s',
    async (body) => {
      vi.stubGlobal('navigator', { language: 'en-US' })
      vi.stubGlobal('fetch', vi.fn((url: string) => url.includes('en-US')
        ? new Response(body)
        : responseFor(url)))

      await expect(initI18n(bundleUrl)).resolves.toBeUndefined()
      expect(getLocale()).toBe('zh-CN')
      expect(t('common.confirm', '确认')).toBe('确认')
    },
  )

  it('keeps inline Chinese fallbacks usable when both files fail, even after English was selected', async () => {
    loadTranslations('en-US', dictionaries['en-US'])
    setLocale('en-US')
    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new Error('offline'))))

    await expect(initI18n(bundleUrl)).resolves.toBeUndefined()

    expect(getLocale()).toBe('zh-CN')
    expect(t('common.confirm', '确认')).toBe('确认')
  })

  it.each(['request', 'body'])('bounds a hanging %s at three seconds and aborts the requests', async (phase) => {
    vi.useFakeTimers()
    const signals: AbortSignal[] = []
    vi.stubGlobal('fetch', vi.fn((_url: string, options?: RequestInit) => {
      if (options?.signal) signals.push(options.signal)
      return phase === 'request'
        ? new Promise<Response>(() => {})
        : Promise.resolve({ ok: true, json: () => new Promise(() => {}) })
    }))
    let completed = false
    const initialized = initI18n(bundleUrl).then(() => { completed = true })

    await vi.advanceTimersByTimeAsync(2999)
    expect(completed).toBe(false)
    await vi.advanceTimersByTimeAsync(1)
    expect(completed).toBe(true)
    await initialized
    expect(signals).toHaveLength(2)
    expect(signals.every(signal => signal.aborted)).toBe(true)
    expect(t('common.confirm', '确认')).toBe('确认')
    expect(vi.getTimerCount()).toBe(0)
  })
})
