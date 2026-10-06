import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadTranslations, resetI18n, setLocale } from '../../core/i18n'
import { validatePackMergeChoices } from '../../core/pack-merge'
import { localizeSprite } from './sprite-localize'
import { uploadToImgbb } from '../../core/imgbb'
import en from '../locales/en-US.json'

beforeEach(() => { loadTranslations('en-US', en); setLocale('en-US') })
afterEach(resetI18n)

describe('gallery failures in English', () => {
  it('keeps the conflicting user tag in a translated message and does not modify the packs', () => {
    const packs = ['a', 'b'].map(id => ({ id, name: id, roleName: '角色', sprites: [{ tag: '微笑', url: id }] }))
    const before = structuredClone(packs)
    expect(() => validatePackMergeChoices(packs, [])).toThrow('No conflicting image selected for "微笑"')
    expect(packs).toEqual(before)
  })

  it('reports a remote download timeout without saving or mutating the sprite', async () => {
    const sprite = { tag: '微笑', url: 'https://example.test/image.png' }
    const saveImage = vi.fn()
    await expect(localizeSprite(sprite, 'image.png', {
      fetch: vi.fn().mockRejectedValue(new DOMException('timeout', 'TimeoutError')), saveImage,
    })).rejects.toThrow('Could not download remote image: No response within 30 seconds')
    expect(saveImage).not.toHaveBeenCalled()
    expect(sprite.url).toBe('https://example.test/image.png')
  })

  it('preserves server error detail in translated imgbb feedback', async () => {
    const fetcher = vi.fn().mockResolvedValue({ status: 429, json: async () => ({ success: false, error: { message: 'Rate limited' } }) })
    await expect(uploadToImgbb('test-key', 'data:image/png;base64,QUFB', fetcher)).rejects.toThrow('imgbb upload failed: Rate limited')
  })
})
