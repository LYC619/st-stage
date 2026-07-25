import { describe, expect, it } from 'vitest'
import type { PluginSettings, SpritePack } from './types'
import { createDefaultSettings, formatAddress, getPackCover, getSpriteSource } from './types'
import {
  bindCharacter,
  bindPack,
  getActiveAddresses,
  getActivePacks,
  getGroups,
  matchAddress,
  matchSprite,
  matchSprites,
  moveSprite,
  previewBindingAddressChanges,
  removeSprite,
  renameSprite,
  resolveSprite,
  setBinding,
  setSpriteGroup,
  toggleBinding,
  unbindPack,
  upsertPack,
  upsertSprite,
} from './sprite-store'

function pack(): SpritePack {
  return {
    id: 'p1',
    name: '包',
    coverTag: '害羞',
    sprites: [
      { tag: '微笑', url: 'u1' },
      { tag: '害羞', url: 'u2' },
      { tag: '恼怒', url: 'u3' },
    ],
  }
}

describe('getSpriteSource / getPackCover', () => {
  it('按 url 推导图源', () => {
    expect(getSpriteSource({ tag: 'a', url: 'data:image/png;base64,x' })).toBe('embedded')
    expect(getSpriteSource({ tag: 'a', url: 'https://x.com/a.png' })).toBe('hosted')
    expect(getSpriteSource({ tag: 'a', url: '/user/images/a.png' })).toBe('local')
  })

  it('封面：coverTag 优先，缺省第一张，空包 null', () => {
    expect(getPackCover(pack())!.tag).toBe('害羞')
    expect(getPackCover({ ...pack(), coverTag: undefined })!.tag).toBe('微笑')
    expect(getPackCover({ ...pack(), coverTag: '不存在' })!.tag).toBe('微笑')
    expect(getPackCover({ id: 'e', name: 'e', sprites: [] })).toBeNull()
  })
})

describe('matchSprite 模糊回退', () => {
  it('精确 → 子串 → null', () => {
    expect(matchSprite(pack(), '微笑')!.url).toBe('u1')
    expect(matchSprite(pack(), '有点害羞')!.url).toBe('u2')
    expect(matchSprite(pack(), '开心')).toBeNull()
  })
})

describe('matchSprites 序列（功能③）', () => {
  it('多标签保序映射，跳过未命中', () => {
    expect(matchSprites(pack(), ['微笑', '恼怒', '开心']).map((s) => s.tag)).toEqual(['微笑', '恼怒'])
  })
  it('折叠相邻重复，但保留往返 A→B→A', () => {
    expect(matchSprites(pack(), ['微笑', '微笑', '害羞', '微笑']).map((s) => s.tag)).toEqual([
      '微笑',
      '害羞',
      '微笑',
    ])
  })
  it('全部未命中返回空数组', () => {
    expect(matchSprites(pack(), ['开心', '生气'])).toEqual([])
  })
})

function groupedPack(): SpritePack {
  return {
    id: 'g1',
    name: '多角色',
    sprites: [
      { tag: '微笑', url: 'n1', group: '鸣人' },
      { tag: '生气', url: 'n2', group: '鸣人' },
      { tag: '微笑', url: 's1', group: '佐助' },
      { tag: '冷漠', url: 's2', group: '佐助' },
    ],
  }
}

describe('功能② 分组寻址', () => {
  it('getGroups：按首次出现去重', () => {
    expect(getGroups(groupedPack())).toEqual(['鸣人', '佐助'])
  })
  it('matchAddress：分组/图名 精确命中，跨组不串图', () => {
    expect(matchAddress(groupedPack(), '鸣人/微笑')!.url).toBe('n1')
    expect(matchAddress(groupedPack(), '佐助/微笑')!.url).toBe('s1')
  })
  it('matchAddress：分组内模糊命中；组内无该图名则 null（严格·不跨组回退）', () => {
    expect(matchAddress(groupedPack(), '佐助/有点冷漠')!.url).toBe('s2')
    // 鸣人无冷漠 → 严格锁定人名后 null，绝不回退到佐助的冷漠
    expect(matchAddress(groupedPack(), '鸣人/冷漠')).toBeNull()
  })
  it('matchAddress：无 / 时按图名全局匹配（兼容旧行为）', () => {
    expect(matchAddress(groupedPack(), '微笑')!.url).toBe('n1')
  })
  it('upsert/remove 按 分组+tag 定位，同 tag 跨组互不覆盖', () => {
    const p = upsertSprite(groupedPack(), { tag: '微笑', url: 'n1b', group: '鸣人' })
    expect(p.sprites).toHaveLength(4)
    expect(matchAddress(p, '鸣人/微笑')!.url).toBe('n1b')
    expect(matchAddress(p, '佐助/微笑')!.url).toBe('s1')

    const r = removeSprite(groupedPack(), '微笑', '鸣人')
    expect(r.sprites.map((s) => `${s.group}/${s.tag}`)).toEqual(['鸣人/生气', '佐助/微笑', '佐助/冷漠'])
  })
  it('setSpriteGroup：改组生效；目标组撞车抛错', () => {
    const moved = setSpriteGroup(groupedPack(), '冷漠', '佐助', '鸣人')
    expect(matchAddress(moved, '鸣人/冷漠')!.url).toBe('s2')
    expect(() => setSpriteGroup(groupedPack(), '微笑', '佐助', '鸣人')).toThrow('已存在')
  })
})

describe('单张立绘操作', () => {
  it('upsertSprite：新 tag 追加，同 tag 覆盖', () => {
    const added = upsertSprite(pack(), { tag: '哭泣', url: 'u4' })
    expect(added.sprites).toHaveLength(4)
    expect(added.updatedAt).toBeTruthy()

    const replaced = upsertSprite(pack(), { tag: '微笑', url: 'new' })
    expect(replaced.sprites).toHaveLength(3)
    expect(replaced.sprites[0].url).toBe('new')
  })

  it('removeSprite：删除并清理指向它的 coverTag', () => {
    const removed = removeSprite(pack(), '害羞')
    expect(removed.sprites.map((s) => s.tag)).toEqual(['微笑', '恼怒'])
    expect(removed.coverTag).toBeUndefined()

    const keepCover = removeSprite(pack(), '微笑')
    expect(keepCover.coverTag).toBe('害羞')
  })

  it('renameSprite：改名并同步 coverTag；非法/重名抛错', () => {
    const renamed = renameSprite(pack(), '害羞', '娇羞')
    expect(renamed.sprites[1].tag).toBe('娇羞')
    expect(renamed.coverTag).toBe('娇羞')

    expect(() => renameSprite(pack(), '微笑', '害羞')).toThrow('已存在')
    expect(() => renameSprite(pack(), '微笑', '|||')).toThrow('表情名')
    expect(renameSprite(pack(), '微笑', '微笑')).toEqual(pack())
  })

  it('moveSprite：合法移动生效，越界原样返回', () => {
    expect(moveSprite(pack(), 0, 2).sprites.map((s) => s.tag)).toEqual(['害羞', '恼怒', '微笑'])
    expect(moveSprite(pack(), 2, 0).sprites.map((s) => s.tag)).toEqual(['恼怒', '微笑', '害羞'])
    expect(moveSprite(pack(), 0, 9)).toEqual(pack())
    expect(moveSprite(pack(), -1, 1)).toEqual(pack())
  })
})

/* ---------- 阶段7·三级图片身份：group + outfit + tag ---------- */

function outfitPack(): SpritePack {
  return {
    id: 'of1',
    name: '鸣人',
    roleName: '鸣人',
    sprites: [
      { tag: '微笑', url: 'home-smile', outfit: '居家服' },
      { tag: '微笑', url: 'work-smile', outfit: '工作服' },
      { tag: '生气', url: 'home-angry', outfit: '居家服' },
    ],
  }
}

describe('三级图片身份 group+outfit+tag', () => {
  it('同 group 同 tag、不同 outfit 可共存，upsert 只覆盖指定 outfit', () => {
    const p = upsertSprite(outfitPack(), { tag: '微笑', url: 'home-smile-v2', outfit: '居家服' })
    expect(p.sprites).toHaveLength(3) // 不新增
    expect(matchAddress(p, '鸣人/居家服/微笑')!.url).toBe('home-smile-v2')
    expect(matchAddress(p, '鸣人/工作服/微笑')!.url).toBe('work-smile') // 另一套服装不动
  })

  it('remove 只删指定 outfit，另一套服装保留', () => {
    const r = removeSprite(outfitPack(), '微笑', '', '居家服')
    expect(r.sprites.map((s) => `${s.outfit}/${s.tag}`)).toEqual(['工作服/微笑', '居家服/生气'])
  })

  it('rename 只改指定 outfit；同 outfit 重名抛错、跨 outfit 同名不算重名', () => {
    const renamed = renameSprite(outfitPack(), '微笑', '浅笑', '', '居家服')
    expect(matchAddress(renamed, '鸣人/居家服/浅笑')!.url).toBe('home-smile')
    expect(matchAddress(renamed, '鸣人/工作服/微笑')!.url).toBe('work-smile') // 工作服微笑未受影响
    // 居家服里把「生气」改成「微笑」→ 与居家服已有微笑撞车
    expect(() => renameSprite(outfitPack(), '生气', '微笑', '', '居家服')).toThrow('已存在')
    // 把「生气」在工作服内改名——工作服无「生气」，outfit 参与定位故无匹配、不抛错、不改动内容
    const noop = renameSprite(outfitPack(), '生气', '暴怒', '', '工作服')
    expect(noop.sprites.map((s) => `${s.outfit}/${s.tag}`)).toEqual(outfitPack().sprites.map((s) => `${s.outfit}/${s.tag}`))
  })

  it('imgbb 补传按 group+outfit+tag 定位，不绑错另一套服装', () => {
    // 模拟 retryPendingUploads：只给「工作服/微笑」补 remoteUrl
    const target = outfitPack().sprites.find(
      (s) => s.tag === '微笑' && (s.group ?? '') === '' && (s.outfit ?? '') === '工作服',
    )!
    const p = upsertSprite(outfitPack(), { ...target, code: 'x.png', remoteUrl: 'https://i.ibb.co/x.png' })
    expect(matchAddress(p, '鸣人/工作服/微笑')!.remoteUrl).toBe('https://i.ibb.co/x.png')
    expect(matchAddress(p, '鸣人/居家服/微笑')!.remoteUrl).toBeUndefined() // 居家服未被误绑
  })
})

/* ---------- 阶段7·多包用包名兜底区分 ---------- */

function plainPack(id: string, name: string): SpritePack {
  return {
    id,
    name,
    sprites: [
      { tag: '微笑', url: `${id}-smile` },
      { tag: '生气', url: `${id}-angry` },
    ],
  }
}

function settingsWith(packIds: string[]): PluginSettings {
  const naruto = plainPack('p_naruto', '鸣人包')
  const sasuke = plainPack('p_sasuke', '佐助包')
  return {
    ...createDefaultSettings(),
    packs: [naruto, sasuke],
    bindings: [{ characterName: '阿珍', packIds, enabled: true }],
  }
}

describe('多包无 roleName 时用包名兜底', () => {
  it('两个无 roleName 旧包同时启用：地址含包名前缀', () => {
    const s = settingsWith(['p_naruto', 'p_sasuke'])
    const addrs = getActiveAddresses(s, '阿珍').map(formatAddress)
    expect(addrs).toEqual([
      '鸣人包/微笑',
      '鸣人包/生气',
      '佐助包/微笑',
      '佐助包/生气',
    ])
    expect(addrs.every((address) => !address.includes('@p=') && !address.includes('@r='))).toBe(true)
  })

  it('同名图片能按包名解析到对应包（Prompt 与解析同一套规则）', () => {
    const s = settingsWith(['p_naruto', 'p_sasuke'])
    const packs = getActivePacks(s, '阿珍')
    expect(resolveSprite(packs, '鸣人包/微笑')!.url).toBe('p_naruto-smile')
    expect(resolveSprite(packs, '佐助包/微笑')!.url).toBe('p_sasuke-smile')
  })

  it('单包场景仍用纯图名（无包名前缀）', () => {
    const s = settingsWith(['p_naruto'])
    expect(getActiveAddresses(s, '阿珍').map(formatAddress)).toEqual(['微笑', '生气'])
    const packs = getActivePacks(s, '阿珍')
    expect(resolveSprite(packs, '微笑')!.url).toBe('p_naruto-smile')
  })

  it('有 roleName 的包不受包名兜底影响（三级寻址不破坏）', () => {
    const naruto: SpritePack = { ...plainPack('p_a', 'A 包'), roleName: '鸣人' }
    const sasuke: SpritePack = { ...plainPack('p_b', 'B 包'), roleName: '佐助' }
    const s: PluginSettings = {
      ...createDefaultSettings(),
      packs: [naruto, sasuke],
      bindings: [{ characterName: '阿珍', packIds: ['p_a', 'p_b'], enabled: true }],
    }
    expect(getActiveAddresses(s, '阿珍').map(formatAddress)).toEqual([
      '鸣人/微笑',
      '鸣人/生气',
      '佐助/微笑',
      '佐助/生气',
    ])
    const packs = getActivePacks(s, '阿珍')
    expect(resolveSprite(packs, '佐助/微笑')!.url).toBe('p_b-smile')
  })

  it('从多包停用回单包后，唯一裸包名仍作为短地址兼容', () => {
    const s = settingsWith(['p_naruto'])
    const packs = getActivePacks(s, '阿珍')
    expect(resolveSprite(packs, '鸣人包/微笑')!.url).toBe('p_naruto-smile')
    expect(resolveSprite(packs, '微笑')!.url).toBe('p_naruto-smile')
    expect(resolveSprite(packs, '佐助包/微笑')).toBeNull()
  })
})

describe('多包短语义地址的冲突防线', () => {
  function oneSprite(id: string, name: string): SpritePack {
    return { id, name, sprites: [{ tag: '微笑', url: `${id}-smile` }] }
  }
  function twoSameName(idA: string, idB: string): PluginSettings {
    return {
      ...createDefaultSettings(),
      packs: [oneSprite(idA, '同名包'), oneSprite(idB, '同名包')],
      bindings: [{ characterName: '阿珍', packIds: [idA, idB], enabled: true }],
    }
  }

  it('有效 role 与另一包裸包名相撞时仍按 role 解析 Prompt 地址', () => {
    const packs: SpritePack[] = [
      { id: 'a', name: 'A包', roleName: '鸣人', sprites: [{ tag: '微笑', url: 'a' }] },
      { id: 'b', name: '鸣人', roleName: '佐助', sprites: [{ tag: '微笑', url: 'b' }] },
    ]

    expect(resolveSprite(packs, '鸣人/微笑')?.url).toBe('a')
    expect(resolveSprite(packs, '佐助/微笑')?.url).toBe('b')
  })

  it('脏设置中的同名同址不注入 Prompt，解析也不猜第一个包', () => {
    const s = twoSameName('p_a', 'p_b')
    const addrs = getActiveAddresses(s, '阿珍').map(formatAddress)
    expect(addrs).toEqual([])
    const packs = getActivePacks(s, '阿珍')
    expect(resolveSprite(packs, '同名包/微笑')).toBeNull()
    expect(resolveSprite(packs, '微笑')).toBeNull()
  })

  it('冲突地址被排除时，两个包中的非冲突地址仍保留', () => {
    const a: SpritePack = {
      id: 'p_a',
      name: '鸣人',
      sprites: [
        { tag: '微笑', url: 'a-smile' },
        { tag: '生气', url: 'a-angry' },
      ],
    }
    const b: SpritePack = {
      id: 'p_b',
      name: '佐助包',
      roleName: '鸣人',
      sprites: [
        { tag: '微笑', url: 'b-smile' },
        { tag: '冷漠', url: 'b-cold' },
      ],
    }
    const s: PluginSettings = {
      ...createDefaultSettings(),
      packs: [a, b],
      bindings: [{ characterName: '阿珍', packIds: ['p_a', 'p_b'], enabled: true }],
    }
    const packs = getActivePacks(s, '阿珍')
    expect(getActiveAddresses(s, '阿珍').map(formatAddress)).toEqual(['鸣人/生气', '鸣人/冷漠'])
    expect(resolveSprite(packs, '鸣人/微笑')).toBeNull()
  })

  it('含 @ 的实验 canonical 文本不再进入正常短地址解析', () => {
    const s = twoSameName('p_a', 'p_b')
    expect(resolveSprite(getActivePacks(s, '阿珍'), '同名包@p=p_a/微笑')).toBeNull()
  })
})

describe('服装地址可逆性', () => {
  it('role/tag 只表示空 outfit，不会落到同角色的服装变体', () => {
    const p: SpritePack = {
      id: 'p',
      name: '鸣人包',
      roleName: '鸣人',
      sprites: [
        { tag: '微笑', url: 'plain' },
        { tag: '微笑', outfit: '居家服', url: 'home' },
      ],
    }
    expect(resolveSprite([p], '鸣人/微笑')?.url).toBe('plain')
    expect(resolveSprite([p], '鸣人/居家服/微笑')?.url).toBe('home')
  })

  it('只有服装变体时 role/tag 返回 null', () => {
    const p: SpritePack = {
      id: 'p',
      name: '鸣人包',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', outfit: '居家服', url: 'home' }],
    }
    expect(resolveSprite([p], '鸣人/微笑')).toBeNull()
  })

  it('单包无人名但有 outfit 时用包名生成可逆三级地址', () => {
    const p: SpritePack = {
      id: 'p',
      name: '鸣人包',
      outfit: '居家服',
      sprites: [{ tag: '微笑', url: 'home' }],
    }
    const s: PluginSettings = {
      ...createDefaultSettings(),
      packs: [p],
      bindings: [{ characterName: '阿珍', packIds: ['p'], enabled: true }],
    }
    expect(getActiveAddresses(s, '阿珍').map(formatAddress)).toEqual(['鸣人包/居家服/微笑'])
    expect(resolveSprite([p], '鸣人包/居家服/微笑')?.url).toBe('home')
  })
})

describe('冲突检查的原子设置变更契约', () => {
  const conflictPacks = (): SpritePack[] => [
    {
      id: 'a',
      name: 'A',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'a-smile' }],
    },
    {
      id: 'b',
      name: 'B',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'b-smile' }],
    },
  ]

  it('bindPack 成功返回 ok/settings，冲突返回完整报告且原设置不变', () => {
    const initial: PluginSettings = { ...createDefaultSettings(), packs: conflictPacks() }
    const first = bindPack(initial, '阿珍', 'a')
    expect(first.ok).toBe(true)
    if (!first.ok) throw new Error('first bind should succeed')

    const beforeBindings = first.settings.bindings
    const second = bindPack(first.settings, '阿珍', 'b')
    expect(second.ok).toBe(false)
    if (second.ok) throw new Error('second bind should conflict')
    expect(second.conflicts).toEqual([
      expect.objectContaining({
        characterName: '阿珍',
        formattedAddress: '鸣人/微笑',
        owners: [
          { packId: 'a', packName: 'A', spriteUrl: 'a-smile' },
          { packId: 'b', packName: 'B', spriteUrl: 'b-smile' },
        ],
      }),
    ])
    expect(first.settings.bindings).toBe(beforeBindings)
    expect(first.settings.bindings[0].packIds).toEqual(['a'])
  })

  it('setBinding 在最终 multiPack 文脉重算两个包的 fallback', () => {
    const sameName: PluginSettings = {
      ...createDefaultSettings(),
      packs: [
        { id: 'a', name: '同名', sprites: [{ tag: '微笑', url: 'a' }] },
        { id: 'b', name: '同名', sprites: [{ tag: '微笑', url: 'b' }] },
      ],
    }
    const result = setBinding(sameName, '阿珍', ['a', 'b'])
    expect(result.ok).toBe(false)
    if (!result.ok) expect(result.conflicts[0].formattedAddress).toBe('同名/微笑')
    expect(sameName.bindings).toEqual([])
  })

  it('toggle 关闭永远成功；脏集合重新开启失败，解绑冲突包后可恢复', () => {
    const dirty: PluginSettings = {
      ...createDefaultSettings(),
      packs: conflictPacks(),
      bindings: [{ characterName: '阿珍', packIds: ['a', 'b'], enabled: true }],
    }
    const off = toggleBinding(dirty, '阿珍', false)
    expect(off.ok).toBe(true)
    if (!off.ok) throw new Error('disable should always succeed')
    expect(off.settings.bindings[0].enabled).toBe(false)

    const blocked = toggleBinding(off.settings, '阿珍', true)
    expect(blocked.ok).toBe(false)
    if (!blocked.ok) expect(blocked.conflicts[0].formattedAddress).toBe('鸣人/微笑')

    const repaired = unbindPack(off.settings, '阿珍', 'b')
    const enabled = toggleBinding(repaired, '阿珍', true)
    expect(enabled.ok).toBe(true)
    if (enabled.ok) expect(enabled.settings.bindings[0]).toMatchObject({ packIds: ['a'], enabled: true })
  })

  it('bindCharacter 使用相同判别联合契约', () => {
    const settings: PluginSettings = { ...createDefaultSettings(), packs: conflictPacks() }
    const result = bindCharacter(settings, '阿珍', 'a')
    expect(result.ok).toBe(true)
    if (result.ok) expect(result.settings.bindings[0].packIds).toEqual(['a'])
  })

  it('upsertPack 拒绝让活动包内容制造冲突，并报告所有受影响角色', () => {
    const [a, b] = conflictPacks()
    b.sprites = [{ tag: '生气', url: 'b-angry' }]
    const settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [a, b],
      bindings: [
        { characterName: '阿珍', packIds: ['a', 'b'], enabled: true },
        { characterName: '阿强', packIds: ['a', 'b'], enabled: true },
      ],
    }
    const changed: SpritePack = { ...b, sprites: [{ tag: '微笑', url: 'b-smile' }] }
    const result = upsertPack(settings, changed)
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.conflicts.map((conflict) => conflict.characterName)).toEqual(['阿珍', '阿强'])
    }
    expect(settings.packs[1].sprites[0].tag).toBe('生气')
  })

  it('upsertPack 允许安装未绑定新包，也允许不产生冲突的活动包更新', () => {
    const [a, b] = conflictPacks()
    b.sprites = [{ tag: '生气', url: 'b-angry' }]
    const settings: PluginSettings = {
      ...createDefaultSettings(),
      packs: [a, b],
      bindings: [{ characterName: '阿珍', packIds: ['a', 'b'], enabled: true }],
    }
    const installed = upsertPack(settings, {
      id: 'c',
      name: '未绑定',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'c-smile' }],
    })
    expect(installed.ok).toBe(true)
    if (!installed.ok) throw new Error('unbound install should succeed')

    const safe = upsertPack(installed.settings, {
      ...b,
      sprites: [{ tag: '生气', url: 'b-angry-v2' }],
    })
    expect(safe.ok).toBe(true)
    if (safe.ok) expect(safe.settings.packs.find((pack) => pack.id === 'b')?.sprites[0].url).toBe('b-angry-v2')
  })

  it('预览单包追加第二包造成的短地址变化', () => {
    const settings = settingsWith(['p_naruto'])
    const result = bindPack(settings, '阿珍', 'p_sasuke')
    expect(result.ok).toBe(true)
    if (!result.ok) throw new Error('second distinct pack should bind')
    expect(previewBindingAddressChanges(settings, result.settings, '阿珍')).toEqual({
      removed: ['微笑', '生气'],
      added: ['鸣人包/微笑', '鸣人包/生气', '佐助包/微笑', '佐助包/生气'],
    })
  })
})

/* ---------- 阶段7·CRUD 身份按「有效地址」（含包级继承） ---------- */

describe('三级身份按有效地址（含包级 roleName/outfit 继承）', () => {
  it('显式 group/outfit 与包级默认值相同 → 视为同一张覆盖，不重复，并清冗余字段', () => {
    const base: SpritePack = {
      id: 'p1',
      name: '鸣人',
      roleName: '鸣人',
      outfit: '居家服',
      sprites: [{ tag: '微笑', url: 'v1' }], // 靠包级继承的一张
    }
    // Web 上传路径可能显式写入与包级相同的 group/outfit
    const p = upsertSprite(base, { tag: '微笑', url: 'v2', group: '鸣人', outfit: '居家服' })
    expect(p.sprites).toHaveLength(1) // 覆盖而非新增（同一有效地址）
    expect(p.sprites[0].url).toBe('v2')
    expect(p.sprites[0].group).toBeUndefined() // 冗余字段被规范化清除
    expect(p.sprites[0].outfit).toBeUndefined()
    expect(matchAddress(p, '鸣人/居家服/微笑')!.url).toBe('v2')
  })

  it('删除/改名用有效地址定位：传入与包级相同的显式 group 也能命中', () => {
    const base: SpritePack = {
      id: 'p1',
      name: '鸣人',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'v1' }],
    }
    expect(removeSprite(base, '微笑', '鸣人', '').sprites).toHaveLength(0)
    const renamed = renameSprite(base, '微笑', '浅笑', '鸣人', '')
    expect(renamed.sprites[0].tag).toBe('浅笑')
  })

  it('设置为包级继承人名时规范化为未分组，不与自己冲突', () => {
    const base: SpritePack = {
      id: 'p1',
      name: '鸣人包',
      roleName: '鸣人',
      sprites: [{ tag: '微笑', url: 'v1' }],
    }
    const next = setSpriteGroup(base, '微笑', '', '鸣人')
    expect(next.sprites[0].group).toBeUndefined()
    expect(getGroups(next)).toEqual([])
  })

  it('upsert 清理历史遗留的相同有效地址重复项', () => {
    const base: SpritePack = {
      id: 'p1',
      name: '鸣人包',
      roleName: '鸣人',
      sprites: [
        { tag: '微笑', url: 'old-a' },
        { tag: '微笑', url: 'old-b', group: '鸣人' },
      ],
    }
    const next = upsertSprite(base, { tag: '微笑', url: 'new', group: '鸣人' })
    expect(next.sprites).toEqual([{ tag: '微笑', url: 'new' }])
  })
})
