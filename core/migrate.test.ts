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
    expect(migrated.showPhone).toBe(true) // 旧数据无此字段 → 默认显示手机框
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

  it('showPhone 显式 false 时保留（功能④手机显隐开关）', () => {
    expect(migrateSettings({ ...V1_SAVED, showPhone: false }).showPhone).toBe(false)
    expect(migrateSettings({ ...V1_SAVED, showPhone: 'nope' }).showPhone).toBe(true)
  })

  it('autoSwitchSeconds 取整并夹到 [1,60]（功能③轮播间隔）', () => {
    expect(migrateSettings({ ...V1_SAVED, autoSwitchSeconds: 8 }).autoSwitchSeconds).toBe(8)
    expect(migrateSettings({ ...V1_SAVED, autoSwitchSeconds: 0 }).autoSwitchSeconds).toBe(1)
    expect(migrateSettings({ ...V1_SAVED, autoSwitchSeconds: 999 }).autoSwitchSeconds).toBe(60)
    expect(migrateSettings({ ...V1_SAVED, autoSwitchSeconds: 3.7 }).autoSwitchSeconds).toBe(4)
    expect(migrateSettings({ ...V1_SAVED }).autoSwitchSeconds).toBe(3) // 缺失 → 默认 3
  })

  it('imgbb 字段缺失回退空串/false，已配置的 Key 保留（功能①）', () => {
    // 旧数据（V1_SAVED 无 imgbb 字段）→ 默认空串 / false
    const missing = migrateSettings(V1_SAVED)
    expect(missing.imgbbApiKey).toBe('')
    expect(missing.autoUpload).toBe(false)
    // 已配置的 Key 与开关原样保留
    const provided = migrateSettings({ ...V1_SAVED, imgbbApiKey: 'abc123', autoUpload: true })
    expect(provided.imgbbApiKey).toBe('abc123')
    expect(provided.autoUpload).toBe(true)
    // 类型不对时回退默认
    expect(migrateSettings({ ...V1_SAVED, imgbbApiKey: 123 }).imgbbApiKey).toBe('')
    expect(migrateSettings({ ...V1_SAVED, autoUpload: 'yes' }).autoUpload).toBe(false)
  })

  it('spriteDisplayMode 缺失/非法回退 overlay，合法值保留（四期）', () => {
    expect(migrateSettings(V1_SAVED).spriteDisplayMode).toBe('overlay')
    expect(migrateSettings({ ...V1_SAVED, spriteDisplayMode: 'inline' }).spriteDisplayMode).toBe('inline')
    expect(migrateSettings({ ...V1_SAVED, spriteDisplayMode: 'both' }).spriteDisplayMode).toBe('both')
    expect(migrateSettings({ ...V1_SAVED, spriteDisplayMode: 'xxx' }).spriteDisplayMode).toBe('overlay')
  })

  it('v3 新字段：overlayHidden / recentFloors 缺失补默认，非法值夹回范围（五期）', () => {
    const missing = migrateSettings(V1_SAVED)
    expect(missing.overlayHidden).toBe(false)
    expect(missing.recentFloors).toBe(6)
    expect(migrateSettings({ ...V1_SAVED, overlayHidden: true }).overlayHidden).toBe(true)
    expect(migrateSettings({ ...V1_SAVED, recentFloors: 20 }).recentFloors).toBe(20)
    expect(migrateSettings({ ...V1_SAVED, recentFloors: 0 }).recentFloors).toBe(1)
    expect(migrateSettings({ ...V1_SAVED, recentFloors: 999 }).recentFloors).toBe(50)
    expect(migrateSettings({ ...V1_SAVED, recentFloors: 'many' }).recentFloors).toBe(6)
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
