import { describe, expect, it } from 'vitest'
import { migrateLegacyLocalPresetCopies, migrateSettings, needsMigration } from './migrate'
import { BUILTIN_TEMPLATE, LEGACY_BUILTIN_TEMPLATES } from './prompt-builder'
import { getPresetPacks, presetSpriteKey } from './presets'
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

  it('promptTemplate 缺失/非字符串回退空串，已有值保留', () => {
    expect(migrateSettings(V1_SAVED).promptTemplate).toBe('')
    expect(migrateSettings({ ...V1_SAVED, promptTemplate: '自定义 {清单}' }).promptTemplate).toBe('自定义 {清单}')
    expect(migrateSettings({ ...V1_SAVED, promptTemplate: 42 }).promptTemplate).toBe('')
  })

  it('精确迁移历史内置底稿为空值，用户改动过的模板保持原样', () => {
    const legacy = LEGACY_BUILTIN_TEMPLATES[0]
    const customized = legacy.replace('[角色立绘系统]', '[我的角色立绘系统]')

    expect(migrateSettings({ settingsVersion: 5, packs: [], promptTemplate: legacy }).promptTemplate).toBe('')
    expect(migrateSettings({ settingsVersion: 6, packs: [], promptTemplate: legacy }).promptTemplate).toBe('')
    expect(migrateSettings({ settingsVersion: 6, packs: [], promptTemplate: BUILTIN_TEMPLATE }).promptTemplate).toBe('')
    expect(migrateSettings({ settingsVersion: 6, packs: [], promptTemplate: legacy.replace(/\n/g, '\r\n') }).promptTemplate).toBe('')
    expect(migrateSettings({ settingsVersion: 6, packs: [], promptTemplate: `${legacy}\n` }).promptTemplate)
      .toBe(`${legacy}\n`)
    expect(migrateSettings({ settingsVersion: 5, packs: [], promptTemplate: customized }).promptTemplate)
      .toBe(customized)
  })

  it('promptBudget 缺省 0（不限），取整夹到 [0,20000]（阶段四）', () => {
    expect(migrateSettings(V1_SAVED).promptBudget).toBe(0)
    expect(migrateSettings({ ...V1_SAVED, promptBudget: 1500 }).promptBudget).toBe(1500)
    expect(migrateSettings({ ...V1_SAVED, promptBudget: -5 }).promptBudget).toBe(0)
    expect(migrateSettings({ ...V1_SAVED, promptBudget: 999999 }).promptBudget).toBe(20000)
    expect(migrateSettings({ ...V1_SAVED, promptBudget: 'x' }).promptBudget).toBe(0)
  })

  it('injectionDepth 缺失/非法回退 4，合法值钳位保留', () => {
    expect(migrateSettings(V1_SAVED).injectionDepth).toBe(4)
    expect(migrateSettings({ ...V1_SAVED, injectionDepth: 7 }).injectionDepth).toBe(7)
    expect(migrateSettings({ ...V1_SAVED, injectionDepth: -3 }).injectionDepth).toBe(0) // 钳位下限
    expect(migrateSettings({ ...V1_SAVED, injectionDepth: '4' }).injectionDepth).toBe(4) // 类型不对回退默认
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

  it('v5 → v6：旧 false 和缺失值迁为 true，v6 起显式 false 保留', () => {
    expect(createDefaultSettings().galleryFoldByRole).toBe(true)
    expect(migrateSettings({ settingsVersion: 5, packs: [], galleryFoldByRole: false }).galleryFoldByRole).toBe(true)
    expect(migrateSettings({ packs: [], galleryFoldByRole: false }).galleryFoldByRole).toBe(true)
    expect(migrateSettings({ settingsVersion: 6, packs: [], galleryFoldByRole: false }).galleryFoldByRole).toBe(false)
    expect(migrateSettings({ settingsVersion: 6, packs: [], galleryFoldByRole: true }).galleryFoldByRole).toBe(true)
  })

  it('v6 presetOverrides 缺失时补空对象，并逐字段清洗', () => {
    const preset = getPresetPacks()[0]
    const key = presetSpriteKey(preset.sprites[0])
    const migrated = migrateSettings({
      settingsVersion: 6,
      packs: [],
      presetOverrides: {
        [preset.id]: {
          metadata: {
            name: '自定义名', author: null, description: 1, roleName: null,
            outfit: null, promptNote: null, promptNotePlacement: null,
            outfitNotes: { 常服: ' 备注 ', bad: 3 },
          },
          localSprites: {
            [key]: '/user/images/sprite-overlay/local.webp',
            badHttp: 'https://example.com/a.webp',
            badData: 'data:image/png;base64,abc',
            badExtension: '/scripts/extensions/a.webp',
          },
          updatedAt: '2026-08-12T12:00:00.000Z',
        },
        unknown: { metadata: { name: '未知预设应忽略' } },
        broken: 'nope',
      },
    } as never)

    expect(migrateSettings({ settingsVersion: 6, packs: [] }).presetOverrides).toEqual({})
    expect(migrated.presetOverrides).toEqual({
      [preset.id]: {
        metadata: {
          name: '自定义名', author: null, roleName: null, outfit: null,
          promptNote: null, promptNotePlacement: null, outfitNotes: { 常服: '备注' },
        },
        localSprites: { [key]: '/user/images/sprite-overlay/local.webp' },
        updatedAt: '2026-08-12T12:00:00.000Z',
      },
    })
  })

  it('precisely migrates one legacy local preset copy and rewrites bindings without duplicates', () => {
    const preset = getPresetPacks()[0]
    const copy = {
      ...preset,
      id: 'pack_local_copy',
      name: `${preset.name}（本地）`,
      sprites: preset.sprites.map((sprite, index) => ({
        ...sprite,
        url: `/user/images/sprite-overlay/local/${index}.webp`,
        remoteUrl: sprite.url,
      })),
    }

    const result = migrateLegacyLocalPresetCopies(
      [copy, { id: 'custom', name: '自定义', sprites: [] }],
      [{ characterName: '塞拉菲娜', packIds: [copy.id, preset.id, 'custom'], enabled: true }],
      {},
      [preset],
    )

    expect(result.packs.map((pack) => pack.id)).toEqual(['custom'])
    expect(result.bindings[0].packIds).toEqual([preset.id, 'custom'])
    expect(result.presetOverrides[preset.id].localSprites).toEqual(Object.fromEntries(
      preset.sprites.map((sprite, index) => [presetSpriteKey(sprite), `/user/images/sprite-overlay/local/${index}.webp`]),
    ))
  })

  it('keeps approximate, ambiguous, and unsafe legacy copies as custom packs', () => {
    const preset = getPresetPacks()[0]
    const makeCopy = (id: string) => ({
      ...preset,
      id,
      name: `${preset.name}（本地）`,
      sprites: preset.sprites.map((sprite, index) => ({
        ...sprite,
        url: `/user/images/sprite-overlay/local/${index}.webp`,
        remoteUrl: sprite.url,
      })),
    })
    const near = { ...makeCopy('near'), roleName: '近似角色' }
    const unsafe = makeCopy('unsafe')
    unsafe.sprites[0].url = 'data:image/webp;base64,abc'
    const duplicateA = makeCopy('duplicate-a')
    const duplicateB = makeCopy('duplicate-b')

    const result = migrateLegacyLocalPresetCopies(
      [near, unsafe, duplicateA, duplicateB],
      [{ characterName: '塞拉菲娜', packIds: ['near', 'unsafe', 'duplicate-a'], enabled: true }],
      {},
      [preset],
    )

    expect(result.packs.map((pack) => pack.id)).toEqual(['near', 'unsafe', 'duplicate-a', 'duplicate-b'])
    expect(result.bindings[0].packIds).toEqual(['near', 'unsafe', 'duplicate-a'])
    expect(result.presetOverrides).toEqual({})
  })

  it('does not migrate a safe copy when a second exact candidate has an unsafe local path', () => {
    const preset = getPresetPacks()[0]
    const makeCopy = (id: string) => ({
      ...preset,
      id,
      name: `${preset.name}（本地）`,
      sprites: preset.sprites.map((sprite, index) => ({
        ...sprite,
        url: `/user/images/sprite-overlay/local/${index}.webp`,
        remoteUrl: sprite.url,
      })),
    })
    const safe = makeCopy('safe')
    const unsafe = makeCopy('unsafe')
    unsafe.sprites[0].url = 'https://example.com/not-local.webp'

    const result = migrateLegacyLocalPresetCopies([safe, unsafe], [], {}, [preset])

    expect(result.packs.map((pack) => pack.id)).toEqual(['safe', 'unsafe'])
    expect(result.presetOverrides).toEqual({})
  })

  it('runs precise legacy-copy migration from migrateSettings', () => {
    const preset = getPresetPacks()[0]
    const copy = {
      ...preset,
      id: 'legacy-local',
      name: `${preset.name}（本地）`,
      sprites: preset.sprites.map((sprite, index) => ({
        ...sprite,
        url: `/user/images/sprite-overlay/local/${index}.webp`,
        remoteUrl: sprite.url,
      })),
    }
    const migrated = migrateSettings({
      settingsVersion: 5,
      packs: [copy],
      bindings: [{ characterName: '塞拉菲娜', packIds: [copy.id], enabled: true }],
    })

    expect(migrated.packs).toEqual([])
    expect(migrated.bindings[0].packIds).toEqual([preset.id])
    expect(Object.keys(migrated.presetOverrides[preset.id].localSprites ?? {})).toHaveLength(preset.sprites.length)
  })

  it('does not re-run legacy-copy migration for v6 settings', () => {
    const preset = getPresetPacks()[0]
    const copy = {
      ...preset,
      id: 'v6-custom-copy',
      name: `${preset.name}（本地）`,
      sprites: preset.sprites.map((sprite, index) => ({
        ...sprite,
        url: `/user/images/sprite-overlay/v6/${index}.webp`,
        remoteUrl: sprite.url,
      })),
    }
    const migrated = migrateSettings({
      ...createDefaultSettings(),
      packs: [copy],
      bindings: [{ characterName: '塞拉菲娜', packIds: [copy.id], enabled: true }],
    })

    expect(migrated.packs.map((pack) => pack.id)).toEqual([copy.id])
    expect(migrated.bindings[0].packIds).toEqual([copy.id])
    expect(migrated.presetOverrides).toEqual({})
  })

  it('v4 → v5：旧存档的 full 是旧默认值，迁为自动精简；v5 起的 full 保留', () => {
    expect(migrateSettings({ settingsVersion: 4, packs: [], multiRolePromptMode: 'full' }).multiRolePromptMode).toBe('repeat')
    expect(migrateSettings({ packs: [] }).multiRolePromptMode).toBe('repeat')
    expect(migrateSettings({ settingsVersion: 4, packs: [], multiRolePromptMode: 'repeat' }).multiRolePromptMode).toBe('repeat')
    expect(migrateSettings({ settingsVersion: 5, packs: [], multiRolePromptMode: 'full' }).multiRolePromptMode).toBe('full')
    expect(migrateSettings({ settingsVersion: 6, packs: [], multiRolePromptMode: 'full' }).multiRolePromptMode).toBe('full')
  })

  it('v4 图库元数据去除空白并去重立绘标签', () => {
    const migrated = migrateSettings({
      settingsVersion: 4,
      packs: [
        {
          id: 'p',
          name: '包',
          promptNote: ' note ',
          promptNotePlacement: 'after-list',
          outfitNotes: { 居家服: ' home ' },
          sourceStoryKey: ' story ',
          sprites: [
            { tag: '微笑', url: 'https://x.com/a.png', labels: [' 动作 ', '动作', ''] },
          ],
        },
      ],
    })
    const pack = migrated.packs[0]
    expect(pack.promptNote).toBe('note')
    expect(pack.promptNotePlacement).toBe('after-list')
    expect(pack.outfitNotes).toEqual({ 居家服: 'home' })
    expect(pack.sourceStoryKey).toBe('story')
    expect(pack.sprites[0].labels).toEqual(['动作'])
  })

  it('v4 图库元数据限制标签数量和文本长度', () => {
    const labels = [
      ` ${'长'.repeat(40)} `,
      ...Array.from({ length: 30 }, (_, index) => ` 标签${index} `),
    ]
    const migrated = migrateSettings({
      settingsVersion: 4,
      packs: [
        {
          id: 'p',
          name: '包',
          promptNote: ` ${'注'.repeat(510)} `,
          outfitNotes: { 居家服: ` ${'家'.repeat(510)} ` },
          sprites: [{ tag: '微笑', url: 'https://x.com/a.png', labels }],
        },
      ],
    })
    const pack = migrated.packs[0]
    expect(pack.promptNote).toHaveLength(500)
    expect(pack.outfitNotes?.居家服).toHaveLength(500)
    expect(pack.sprites[0].labels).toHaveLength(24)
    expect(pack.sprites[0].labels?.[0]).toBe('长'.repeat(32))
    expect(new Set(pack.sprites[0].labels).size).toBe(24)
    expect(pack.sprites[0].labels?.every((label) => label.length <= 32)).toBe(true)
  })

  it('绑定 packId → packIds 形状迁移（六期），幂等且不丢包', () => {
    // 旧单包绑定
    const old = migrateSettings(V1_SAVED)
    expect(old.bindings[0].packIds).toEqual(['pack_abc'])
    // 已是 packIds 的新形状原样保留（去重）
    const neo = migrateSettings({
      ...V1_SAVED,
      bindings: [{ characterName: '小雪', packIds: ['a', 'b', 'a'], enabled: false }],
    })
    expect(neo.bindings[0].packIds).toEqual(['a', 'b'])
    expect(neo.bindings[0].enabled).toBe(false)
    // 幂等：二次迁移不变
    expect(migrateSettings(neo).bindings).toEqual(neo.bindings)
    // 无任何包 id 的绑定被丢弃
    expect(
      migrateSettings({ ...V1_SAVED, bindings: [{ characterName: 'x', enabled: true }] }).bindings,
    ).toEqual([])
  })

  it('spriteCount 缺省 1，取整夹到 [1,10]（七期）', () => {
    expect(migrateSettings(V1_SAVED).spriteCount).toBe(1)
    expect(migrateSettings({ ...V1_SAVED, spriteCount: 5 }).spriteCount).toBe(5)
    expect(migrateSettings({ ...V1_SAVED, spriteCount: 0 }).spriteCount).toBe(1)
    expect(migrateSettings({ ...V1_SAVED, spriteCount: 99 }).spriteCount).toBe(10)
  })

  it('包 roleName/outfit 与立绘 outfit 迁移保留（六期）', () => {
    const m = migrateSettings({
      ...V1_SAVED,
      packs: [
        {
          id: 'p',
          name: '鸣人居家',
          roleName: '鸣人',
          outfit: '居家服',
          sprites: [{ tag: '微笑', url: 'https://x.com/a.png', outfit: '战斗服' }],
        },
      ],
    })
    expect(m.packs[0].roleName).toBe('鸣人')
    expect(m.packs[0].outfit).toBe('居家服')
    expect(m.packs[0].sprites[0].outfit).toBe('战斗服')
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
