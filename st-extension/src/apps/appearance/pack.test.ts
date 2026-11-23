import { describe, expect, it } from 'vitest'
import { exportAppearance, fontUrl, imageUrl, importAppearance, readAppearance, resolveEffectiveAppearance, type AppearanceData } from './pack'

describe('appearance packs', () => {
  it('preserves explicit default character wallpaper across reload and import while missing wallpaper inherits', () => {
    const stored = { wallpaper: '/global.webp', characterSkins: { Alice: { wallpaper: '' }, Bob: { theme: 'tavern' } } }
    const normalized = readAppearance(stored)
    const reloaded = importAppearance(exportAppearance(normalized), [])
    expect(reloaded.characterSkins?.Alice).toEqual({ wallpaper: '' })
    expect(resolveEffectiveAppearance(reloaded, 'Alice').wallpaper).toBe('')
    expect(resolveEffectiveAppearance(reloaded, 'Bob').wallpaper).toBe('/global.webp')
  })
  it('round-trips explicit zero dim separately from an absent dim setting', () => {
    expect(readAppearance({}).wallpaperDim).toBeUndefined()
    expect(readAppearance({ wallpaperDim: NaN }).wallpaperDim).toBeUndefined()
    expect(importAppearance(exportAppearance(readAppearance({ wallpaperDim: 0 })), []).wallpaperDim).toBe(0)
  })
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
