import { describe, expect, it } from 'vitest'
import {
  clearPresetMetadata,
  setPresetLocalSprite,
  setPresetMetadata,
} from './preset-overrides'
import { getPresetPacks, presetSpriteKey } from './presets'
import { createDefaultSettings, type PluginSettings } from './types'

function makeSettings(): PluginSettings {
  const preset = getPresetPacks()[0]
  return {
    ...createDefaultSettings(),
    packs: [preset, { id: 'custom_pack', name: '自定义包', sprites: [] }],
    bindings: [{
      characterName: '塞拉菲娜',
      packIds: [preset.id, 'custom_pack'],
      enabled: true,
    }],
  }
}

describe('preset override state transitions', () => {
  it('materializes a safe local sprite under the same preset id without changing pack count or bindings', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]
    const sourceSprite = preset.sprites[0]
    const before = structuredClone(settings)
    const next = setPresetLocalSprite(
      settings,
      preset.id,
      sourceSprite,
      '/user/images/sprite-overlay/local.webp',
    )

    expect(next.presetOverrides[preset.id]).toEqual({
      localSprites: {
        [presetSpriteKey(sourceSprite)]: '/user/images/sprite-overlay/local.webp',
      },
    })
    expect(next.packs).toHaveLength(settings.packs.length)
    expect(next.packs.map((pack) => pack.id)).toEqual(settings.packs.map((pack) => pack.id))
    expect(next.packs[0].sprites[0]).toMatchObject({
      url: '/user/images/sprite-overlay/local.webp',
      remoteUrl: sourceSprite.url,
    })
    expect(next.bindings).toEqual(settings.bindings)
    expect(settings).toEqual(before)
  })

  it('returns the original settings for an unsafe URL, unknown preset, or unknown source sprite', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]

    expect(setPresetLocalSprite(settings, preset.id, preset.sprites[0], 'https://example.com/a.webp'))
      .toBe(settings)
    expect(setPresetLocalSprite(settings, 'custom_pack', preset.sprites[0], '/user/images/a.webp'))
      .toBe(settings)
    expect(setPresetLocalSprite(
      settings,
      preset.id,
      { ...preset.sprites[0], tag: '不存在' },
      '/user/images/a.webp',
    )).toBe(settings)
    expect(setPresetLocalSprite(settings, preset.id, preset.sprites[0], '/user/../secret.webp'))
      .toBe(settings)
  })

  it('sanitizes metadata edits, supports null clearing, and preserves local sprites', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]
    const sourceSprite = preset.sprites[0]
    const withLocal = setPresetLocalSprite(
      settings,
      preset.id,
      sourceSprite,
      '/user/images/sprite-overlay/local.webp',
    )
    const metadata = {
      name: '  我的常服  ',
      author: null,
      description: '  用户描述  ',
      roleName: '  新角色  ',
      outfit: null,
      promptNote: '  用户备注  ',
      promptNotePlacement: 'before-list' as const,
      ignored: 'drop me',
    }
    const metadataBefore = structuredClone(metadata)
    const next = setPresetMetadata(withLocal, preset.id, metadata)

    expect(next.presetOverrides[preset.id]).toEqual({
      metadata: {
        name: '我的常服',
        author: null,
        description: '用户描述',
        roleName: '新角色',
        outfit: null,
        promptNote: '用户备注',
        promptNotePlacement: 'before-list',
      },
      localSprites: {
        [presetSpriteKey(sourceSprite)]: '/user/images/sprite-overlay/local.webp',
      },
    })
    expect(next.packs[0]).toMatchObject({
      id: preset.id,
      name: '我的常服',
      description: '用户描述',
      roleName: '新角色',
      promptNote: '用户备注',
      promptNotePlacement: 'before-list',
    })
    expect(next.packs[0].author).toBeUndefined()
    expect(next.packs[0].outfit).toBeUndefined()
    expect(next.packs[0].sprites[0]).toMatchObject({
      url: '/user/images/sprite-overlay/local.webp',
      remoteUrl: sourceSprite.url,
    })
    expect(metadata).toEqual(metadataBefore)
    expect(withLocal.presetOverrides[preset.id].localSprites).toEqual(
      next.presetOverrides[preset.id].localSprites,
    )
  })

  it('clears only preset metadata and leaves local sprites intact', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]
    const sourceSprite = preset.sprites[0]
    const withLocal = setPresetLocalSprite(
      settings,
      preset.id,
      sourceSprite,
      '/user/images/sprite-overlay/local.webp',
    )
    const withMetadata = setPresetMetadata(withLocal, preset.id, {
      name: '我的包',
      outfitNotes: null,
    })
    const next = clearPresetMetadata(withMetadata, preset.id)

    expect(next.presetOverrides[preset.id]).toEqual({
      localSprites: {
        [presetSpriteKey(sourceSprite)]: '/user/images/sprite-overlay/local.webp',
      },
    })
    expect(next.packs).toHaveLength(settings.packs.length)
    expect(next.packs[0].name).toBe(preset.name)
    expect(next.packs[0].sprites[0]).toMatchObject({
      url: '/user/images/sprite-overlay/local.webp',
      remoteUrl: sourceSprite.url,
    })
    expect(next.bindings).toEqual(settings.bindings)
    expect(withMetadata.presetOverrides[preset.id].metadata).toEqual({
      name: '我的包',
      outfitNotes: null,
    })
  })

  it('records explicit null when existing user outfit notes are cleared', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]
    const withNotes = setPresetMetadata(settings, preset.id, {
      outfitNotes: { 常服: '用户备注' },
    })
    const cleared = setPresetMetadata(withNotes, preset.id, { outfitNotes: null })

    expect(withNotes.packs[0].outfitNotes).toEqual({ 常服: '用户备注' })
    expect(cleared.presetOverrides[preset.id]?.metadata?.outfitNotes).toBeNull()
    expect(cleared.packs[0].outfitNotes).toBeUndefined()
  })

  it('treats null metadata as clearing the metadata override', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]
    const withMetadata = setPresetMetadata(settings, preset.id, { name: '我的包' })
    const next = setPresetMetadata(withMetadata, preset.id, null)

    expect(next.presetOverrides[preset.id]).toBeUndefined()
    expect(withMetadata.presetOverrides[preset.id]).toEqual({ metadata: { name: '我的包' } })
  })

  it('does not mutate destructive metadata or settings inputs', () => {
    const settings = makeSettings()
    const preset = settings.packs[0]
    const metadata = { name: '新名称', outfitNotes: { 常服: '备注' } }
    const settingsBefore = structuredClone(settings)
    const metadataBefore = structuredClone(metadata)

    setPresetMetadata(settings, preset.id, metadata)

    expect(settings).toEqual(settingsBefore)
    expect(metadata).toEqual(metadataBefore)
  })
})
