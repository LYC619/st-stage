import { describe, expect, it } from 'vitest'
import { exportAppearance, fontUrl, imageUrl, importAppearance, readAppearance, type AppearanceData } from './pack'

describe('appearance packs', () => {
  const data: AppearanceData = { wallpaper: '/user/images/wall.webp', icons: { chronicle: { emoji: '📘' }, theater: { image: 'https://example.test/icon.png' } },
    fonts: [{ name: '手写', family: 'Handwriting', cssUrl: 'https://example.test/font.css' }], activeFont: '手写' }
  it('round-trips wallpaper, icons and fonts and ignores unknown app IDs', () => {
    expect(importAppearance(exportAppearance(data), ['chronicle', 'theater'])).toEqual(data)
    expect(importAppearance(exportAppearance(data), ['chronicle']).icons).toEqual({ chronicle: { emoji: '📘' } })
  })
  it('rejects non-HTTPS font CSS and embedded image data at import boundaries', () => {
    expect(() => importAppearance(exportAppearance({ ...data, fonts: [{ ...data.fonts[0], cssUrl: 'http://example.test/font.css' }] }), ['chronicle'])).toThrow('https://')
    expect(() => fontUrl('javascript:alert(1)')).toThrow('https://')
    expect(() => importAppearance(exportAppearance({ ...data, wallpaper: 'data:image/png;base64,AAAA' }), ['chronicle'])).toThrow('图片必须是网址')
    expect(() => imageUrl('data:image/png;base64,AAAA')).toThrow('上传图片')
  })
  it('normalizes stored settings and keeps safe image URLs without serializing uploads', () => {
    expect(readAppearance(undefined)).toEqual({ wallpaper: '', icons: {}, fonts: [], activeFont: '' })
    expect(imageUrl(' /user/images/image.webp ')).toBe('/user/images/image.webp')
    expect(readAppearance({ ...data, wallpaper: 'data:image/png;base64,AAAA', activeFont: 'missing' })).toMatchObject({ wallpaper: '', activeFont: '' })
  })
})
