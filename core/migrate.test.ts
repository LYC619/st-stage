import { describe, expect, it } from 'vitest'
import { migrateSettings, needsMigration } from './migrate'
import { createDefaultSettings, SETTINGS_VERSION } from './types'

/** 模拟 v1 时代持久化的 settings（无 settingsVersion 等新字段） */
const V1_SAVED = {
  enabled: true,
  hideTagInMessage: true,
  overlay: { x: 10, y: 20, width: 300 },
  packs: [
    {
      id: 'pack_abc',
      name: '我的包',
      author: '我',
      sprites: [
        { tag: '微笑', url: 'https://files.catbox.moe/ab12cd.png' },
        { tag: '害羞', url: '/user/images/sprite-overlay/小雪/害羞.png' },
      ],
    },
  ],
  bindings: [{ characterName: '小雪', packId: 'pack_abc', enabled: true }],
}

describe('needsMigration', () => {
  it('v1（无版本号）需要迁移，当前版本不需要', () => {
    expect(needsMigration(V1_SAVED)).toBe(true)
    expect(needsMigration(createDefaultSettings())).toBe(false)
    expect(needsMigration(null)).toBe(false)
  })
})

describe('migrateSettings', () => {
  it('v1 → v2：保留用户数据，补新字段，图床 URL 反推 code', () => {
    const migrated = migrateSettings(V1_SAVED)
    expect(migrated.settingsVersion).toBe(SETTINGS_VERSION)
    expect(migrated.hideTagInMessage).toBe(true)
    expect(migrated.renderInlineImages).toBe(false)
    expect(migrated.imageHost).toBeTruthy()
    expect(migrated.overlay).toEqual({ x: 10, y: 20, width: 300 })
    expect(migrated.bindings).toHaveLength(1)

    const pack = migrated.packs[0]
    expect(pack.sprites[0]).toEqual({
      tag: '微笑',
      url: 'https://files.catbox.moe/ab12cd.png',
      code: 'ab12cd.png',
    })
    // 本地路径不生成 code
    expect(pack.sprites[1].code).toBeUndefined()
  })

  it('损坏输入逐字段回退默认值，不抛异常', () => {
    expect(migrateSettings(null)).toEqual(createDefaultSettings())
    expect(migrateSettings('garbage')).toEqual(createDefaultSettings())

    const broken = migrateSettings({
      enabled: 'yes',
      overlay: { x: NaN, y: 0, width: 100 },
      packs: [null, { id: '', sprites: [] }, { id: 'ok', name: 1, sprites: 'nope' }],
      bindings: [null, { characterName: 'a' }],
    })
    const defaults = createDefaultSettings()
    expect(broken.enabled).toBe(defaults.enabled)
    expect(broken.overlay).toEqual(defaults.overlay)
    expect(broken.packs).toEqual([])
    expect(broken.bindings).toEqual([])
  })

  it('不规范旧 tag 清洗后为空时保留原样（不丢图）', () => {
    const migrated = migrateSettings({
      ...V1_SAVED,
      packs: [
        {
          id: 'p',
          name: 'x',
          sprites: [{ tag: '|||', url: 'https://x.com/a.png' }],
        },
      ],
    })
    expect(migrated.packs[0].sprites).toHaveLength(1)
    expect(migrated.packs[0].sprites[0].tag).toBe('|||')
  })

  it('当前版本数据迁移后语义不变', () => {
    const current = createDefaultSettings()
    current.packs = [
      { id: 'p', name: '包', sprites: [{ tag: '微笑', url: 'https://x.com/a.png', code: 'a.png' }] },
    ]
    const migrated = migrateSettings(current)
    expect(migrated.packs).toEqual(current.packs)
    expect(migrated.imageHost).toBe(current.imageHost)
  })
})
