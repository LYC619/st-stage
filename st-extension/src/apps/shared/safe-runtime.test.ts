// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { safeCopyText, safeRandomId } from './safe-runtime'

afterEach(() => {
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('safe-runtime HTTP LAN fallbacks', () => {
  it('generates unique prefixed IDs even when crypto.randomUUID is unavailable', () => {
    vi.stubGlobal('crypto', {})
    const a = safeRandomId('msg:')
    const b = safeRandomId('msg:')
    expect(a.startsWith('msg:')).toBe(true)
    expect(b.startsWith('msg:')).toBe(true)
    expect(a).not.toBe(b)
  })

  it('returns false gracefully instead of throwing when clipboard and execCommand fail', async () => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('NotAllowedError')) },
    })
    document.execCommand = vi.fn(() => false)
    await expect(safeCopyText('hello')).resolves.toBe(false)
  })
})
