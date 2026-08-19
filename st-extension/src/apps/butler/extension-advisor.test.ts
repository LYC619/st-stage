import { describe, expect, it } from 'vitest'
import {
  getSystemExtensionAdvice,
  type SystemExtensionRecommendation,
} from './extension-advisor'

describe('system extension advisor', () => {
  it('describes the common built-in extensions without claiming measured cost', () => {
    const names = [
      'expressions',
      'gallery',
      'memory',
      'quick-reply',
      'regex',
      'stable-diffusion',
      'translate',
      'tts',
      'vectors',
    ]
    const allowed: SystemExtensionRecommendation[] = [
      '保留',
      '不用时可临时关闭',
      '排障时可临时关闭观察',
    ]

    for (const name of names) {
      const advice = getSystemExtensionAdvice(name)
      expect(advice, name).not.toBeNull()
      expect(advice?.displayName.length).toBeGreaterThan(0)
      expect(advice?.purpose.length).toBeGreaterThan(8)
      expect(advice?.whenNeeded.length).toBeGreaterThan(8)
      expect(advice?.disabledImpact.length).toBeGreaterThan(8)
      expect(allowed).toContain(advice?.recommendation)
      expect(`${advice?.purpose}${advice?.whenNeeded}${advice?.disabledImpact}`).not.toMatch(/占用\s*\d|耗时\s*\d/)
    }
  })

  it('keeps unknown built-in extensions unclassified', () => {
    expect(getSystemExtensionAdvice('future-system-extension')).toBeNull()
  })
})
