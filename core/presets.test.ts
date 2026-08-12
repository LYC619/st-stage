import { describe, expect, it } from 'vitest'
import { getPresetPacks, isPresetPack, mergePresetPacks, presetSpriteKey } from './presets'

describe('remote built-in presets', () => {
  it('ships five stable Seraphina outfit packs with only valid HTTPS images', () => {
    const packs = getPresetPacks()

    expect(packs.map((pack) => pack.id)).toEqual([
      'preset_seraphina_casual',
      'preset_seraphina_shadow',
      'preset_seraphina_healing',
      'preset_seraphina_priest',
      'preset_seraphina_battle',
    ])
    expect(packs.flatMap((pack) => pack.sprites)).toHaveLength(102)
    for (const pack of packs) {
      expect(pack.roleName).toBe('塞拉菲娜')
      expect(pack.sprites.length).toBeGreaterThan(0)
      expect(pack.sprites.every((sprite) => /^https:\/\/i\.ibb\.co\/.+\.webp$/.test(sprite.url))).toBe(true)
      expect(pack.sprites.every((sprite) => sprite.remoteUrl === sprite.url)).toBe(true)
    }
  })

  it('removes casual numeric prefixes and omits malformed or unavailable packs', () => {
    const packs = getPresetPacks()
    const casual = packs.find((pack) => pack.id === 'preset_seraphina_casual')!
    const battle = packs.find((pack) => pack.id === 'preset_seraphina_battle')!

    expect(casual.sprites.map((sprite) => sprite.tag)).toContain('中性')
    expect(casual.sprites.some((sprite) => /^\d+_/.test(sprite.tag))).toBe(false)
    expect(battle.sprites.some((sprite) => sprite.tag === '爱慕')).toBe(false)
    expect(packs.some((pack) => pack.outfit?.includes('战损'))).toBe(false)
  })

  it('continues recognizing removed demo IDs so they are not persisted as user packs', () => {
    expect(isPresetPack('preset_silver_loli')).toBe(true)
    expect(isPresetPack('preset_raven_onee')).toBe(true)
    expect(isPresetPack('preset_seraphina_casual')).toBe(true)
    expect(isPresetPack('preset_custom_story')).toBe(false)
  })

  it('uses only original sprite coordinates for stable override keys', () => {
    const sprite = { tag: '微笑', url: 'https://example.com/a.webp', group: '角色', outfit: '常服' }

    expect(presetSpriteKey(sprite)).toBe(JSON.stringify(['角色', '常服', '微笑']))
    expect(presetSpriteKey({ tag: '微笑' })).toBe(JSON.stringify(['', '', '微笑']))
  })

  it('merges metadata null semantics and safe local sprites without changing preset identity or inventory', () => {
    const original = getPresetPacks()[0]
    const first = original.sprites[0]
    const localPath = '/user/images/sprite-overlay/seraphina/local.webp'
    const [merged] = mergePresetPacks({
      [original.id]: {
        metadata: {
          name: '我的常服',
          author: null,
          description: null,
          roleName: null,
          outfit: null,
          promptNote: null,
          promptNotePlacement: null,
          outfitNotes: { 常服: '用户备注' },
        },
        localSprites: { [presetSpriteKey(first)]: localPath },
      },
    })

    expect(merged.id).toBe(original.id)
    expect(merged.name).toBe('我的常服')
    expect(merged.author).toBeUndefined()
    expect(merged.description).toBeUndefined()
    expect(merged.roleName).toBeUndefined()
    expect(merged.outfit).toBeUndefined()
    expect(merged.promptNote).toBeUndefined()
    expect(merged.promptNotePlacement).toBeUndefined()
    expect(merged.outfitNotes).toEqual({ 常服: '用户备注' })
    expect(merged.sprites).toHaveLength(original.sprites.length)
    expect(merged.sprites[0]).toEqual({ ...first, url: localPath, remoteUrl: first.url })
    expect(merged.sprites.slice(1)).toEqual(original.sprites.slice(1))
  })

  it('ignores unknown presets, malformed metadata, missing sprites, and unsafe local URLs', () => {
    const original = getPresetPacks()[0]
    const first = original.sprites[0]
    const merged = mergePresetPacks({
      unknown: { metadata: { name: '未知' }, localSprites: {} },
      [original.id]: {
        metadata: { name: null, author: 42, promptNotePlacement: 'middle' },
        localSprites: {
          [presetSpriteKey(first)]: 'https://example.com/not-local.webp',
          [JSON.stringify(['', '', '已删除立绘'])]: '/user/images/orphan.webp',
        },
      },
    } as never)

    expect(merged).toHaveLength(getPresetPacks().length)
    expect(merged[0]).toEqual(original)
  })
})
