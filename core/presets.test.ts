import { describe, expect, it } from 'vitest'
import { getPresetPacks, isPresetPack } from './presets'

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
  })
})
