import { describe, expect, it } from 'vitest'
import { createDefaultSettings, type PluginSettings } from './types'
import { getPresetPacks } from './presets'
import { applyImageChanges, imageRefKey, scanEmbeddedImages } from './image-storage'

const data = 'data:image/png;base64,QUFB'
function fixture(): PluginSettings {
  return { ...createDefaultSettings(), packs: [{ id: 'p', name: '原名', inventoryPrompt: '保留',
    sprites: [{ tag: '微笑', url: data }, { tag: '微笑', outfit: '礼服', url: data }] }] }
}

describe('embedded image references', () => {
  it('counts unique URI text bytes and ignores opaque App data', () => {
    const settings = { ...fixture(), apps: { private: { url: data } } }
    const scan = scanEmbeddedImages(settings)
    expect(scan.candidates).toHaveLength(2)
    expect(scan.embeddedReferenceCount).toBe(2)
    expect(scan.uniqueEmbeddedCount).toBe(1)
    expect(scan.embeddedTextBytes).toBe(new TextEncoder().encode(data).length)
    expect(imageRefKey({ packId: 'a|b', group: '', outfit: '', tag: 'c' }))
      .not.toBe(imageRefKey({ packId: 'a', group: 'b|', outfit: '', tag: 'c' }))
  })

  it('applies against reordered latest settings without mutating or losing metadata', () => {
    const settings = fixture()
    const before = JSON.stringify(settings)
    const changes = scanEmbeddedImages(settings).candidates.map(c => ({ ref: c.ref, expectedUrl: c.sourceUrl, nextUrl: '/user/images/a.png' }))
    const apps = { private: { url: data } }
    const latest = { ...settings, apps, packs: [{ ...settings.packs[0], name: '改名', sprites: [...settings.packs[0].sprites].reverse() }] }
    Object.freeze(latest)
    Object.freeze(latest.packs[0])
    latest.packs[0].sprites.forEach(Object.freeze)
    const result = applyImageChanges(latest, changes)
    expect(result.applied).toHaveLength(2)
    expect(result.conflicts).toHaveLength(0)
    expect(result.settings.packs[0]).toMatchObject({ name: '改名', inventoryPrompt: '保留' })
    expect(result.settings.apps).toBe(apps)
    expect(JSON.stringify(settings)).toBe(before)
    expect(applyImageChanges(result.settings, changes).conflicts).toHaveLength(2)
  })

  it.each(['delete', 'url', 'tag', 'group', 'outfit', 'duplicate-pack', 'duplicate-sprite', 'duplicate-change'])('does not guess changed identity: %s', mode => {
    const settings = fixture()
    const candidate = scanEmbeddedImages(settings).candidates[0]
    const change = { ref: candidate.ref, expectedUrl: data, nextUrl: '/user/images/a.png' }
    if (mode === 'delete') settings.packs = []
    else if (mode === 'duplicate-pack') settings.packs.push(structuredClone(settings.packs[0]))
    else if (mode === 'duplicate-sprite') settings.packs[0].sprites.push({ ...settings.packs[0].sprites[0] })
    else if (mode !== 'duplicate-change') Object.assign(settings.packs[0].sprites[0], { [mode]: 'changed' })
    const result = applyImageChanges(settings, mode === 'duplicate-change' ? [change, change] : [change])
    expect(result.applied).toHaveLength(0)
    expect(result.conflicts.length).toBeGreaterThan(0)
    expect(result.settings).toBe(settings)
    if (mode.startsWith('duplicate-') && mode !== 'duplicate-change') expect(scanEmbeddedImages(settings).ambiguous.length).toBeGreaterThan(0)
  })

  it('detects a duplicate identity even if the other sprite is not embedded', () => {
    const settings = fixture()
    settings.packs[0].sprites.push({ tag: '微笑', url: '/user/images/new.png' })
    expect(scanEmbeddedImages(settings).ambiguous).toHaveLength(1)
  })

  it('excludes reserved presets but not custom IDs sharing their prefix', () => {
    const preset = { ...getPresetPacks()[0], sprites: [{ tag: 'a', url: data }] }
    const settings = { ...fixture(), packs: [preset, { ...preset, id: 'preset_custom' }] }
    expect(scanEmbeddedImages(settings).candidates.map(c => c.ref.packId)).toEqual(['preset_custom'])
  })
})
