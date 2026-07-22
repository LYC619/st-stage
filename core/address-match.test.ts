import { describe, expect, it } from 'vitest'
import type { PluginSettings, SpritePack } from './types'
import { createDefaultSettings, parseAddress, formatAddress } from './types'
import {
  bindPack,
  getActiveAddresses,
  getActivePacks,
  reorderBinding,
  resolveSprite,
  resolveSprites,
  setBinding,
  unbindPack,
} from './sprite-store'

/* ---------- 地址解析 ---------- */

describe('parseAddress / formatAddress', () => {
  it('一/二/三级解析', () => {
    expect(parseAddress('微笑')).toEqual({ role: '', outfit: '', tag: '微笑' })
    expect(parseAddress('鸣人/微笑')).toEqual({ role: '鸣人', outfit: '', tag: '微笑' })
    expect(parseAddress('鸣人/居家服/微笑')).toEqual({ role: '鸣人', outfit: '居家服', tag: '微笑' })
  })
  it('formatAddress 省略空前置层级', () => {
    expect(formatAddress({ role: '', outfit: '', tag: '微笑' })).toBe('微笑')
    expect(formatAddress({ role: '鸣人', outfit: '', tag: '微笑' })).toBe('鸣人/微笑')
    expect(formatAddress({ role: '鸣人', outfit: '居家服', tag: '微笑' })).toBe('鸣人/居家服/微笑')
  })
})

/* ---------- 三级严格匹配（禁止跨包回退） ---------- */

const narutoHome: SpritePack = {
  id: 'naruto-home',
  name: '鸣人居家',
  roleName: '鸣人',
  outfit: '居家服',
  sprites: [
    { tag: '微笑', url: 'n-home-smile' },
    { tag: '开心', url: 'n-home-happy' },
  ],
}
const narutoNinja: SpritePack = {
  id: 'naruto-ninja',
  name: '鸣人忍者',
  roleName: '鸣人',
  outfit: '忍者服',
  sprites: [{ tag: '微笑', url: 'n-ninja-smile' }],
}
const sasuke: SpritePack = {
  id: 'sasuke',
  name: '佐助',
  roleName: '佐助',
  sprites: [
    { tag: '微笑', url: 's-smile' },
    { tag: '冷漠', url: 's-cold' },
  ],
}

describe('resolveSprite — 三级严格寻址', () => {
  const packs = [narutoHome, narutoNinja, sasuke]

  it('人名/服装/图名精确命中对应包', () => {
    expect(resolveSprite(packs, '鸣人/居家服/微笑')!.url).toBe('n-home-smile')
    expect(resolveSprite(packs, '鸣人/忍者服/微笑')!.url).toBe('n-ninja-smile')
  })

  it('人名/图名锁定人名，在其名下匹配（服装不限）', () => {
    expect(resolveSprite(packs, '佐助/微笑')!.url).toBe('s-smile')
  })

  it('禁止跨包回退：鸣人/冷漠 匹配失败不落到佐助的冷漠', () => {
    expect(resolveSprite(packs, '鸣人/冷漠')).toBeNull()
  })

  it('禁止跨服装回退：鸣人/忍者服/开心 失败不落到居家服的开心', () => {
    expect(resolveSprite(packs, '鸣人/忍者服/开心')).toBeNull()
  })

  it('人名不存在直接 null（不跨角色）', () => {
    expect(resolveSprite(packs, '雏田/微笑')).toBeNull()
  })

  it('纯图名（简写）跨包取首个命中', () => {
    expect(resolveSprite(packs, '冷漠')!.url).toBe('s-cold')
  })

  it('legacy group 作人名同样严格', () => {
    const legacy: SpritePack = {
      id: 'legacy',
      name: '一包多角色',
      sprites: [
        { tag: '微笑', url: 'L-naruto', group: '鸣人' },
        { tag: '冷漠', url: 'L-sasuke', group: '佐助' },
      ],
    }
    expect(resolveSprite([legacy], '鸣人/微笑')!.url).toBe('L-naruto')
    expect(resolveSprite([legacy], '鸣人/冷漠')).toBeNull() // 不跨到佐助
  })
})

describe('resolveSprites — 序列', () => {
  it('多地址保序、跳过未命中、折叠相邻重复', () => {
    const packs = [narutoHome, sasuke]
    const seq = resolveSprites(packs, ['鸣人/居家服/微笑', '鸣人/居家服/微笑', '佐助/冷漠', '雏田/x'])
    expect(seq.map((s) => s.url)).toEqual(['n-home-smile', 's-cold'])
  })
})

/* ---------- 多包绑定 ---------- */

function baseSettings(): PluginSettings {
  const s = createDefaultSettings()
  s.packs = [narutoHome, narutoNinja, sasuke]
  return s
}

describe('多包绑定', () => {
  it('bindPack 追加多个包，getActivePacks 按顺序返回', () => {
    let s = baseSettings()
    s = bindPack(s, '小队', 'naruto-home')
    s = bindPack(s, '小队', 'sasuke')
    expect(getActivePacks(s, '小队').map((p) => p.id)).toEqual(['naruto-home', 'sasuke'])
  })

  it('bindPack 幂等（重复加不产生重复）', () => {
    let s = baseSettings()
    s = bindPack(s, '小队', 'naruto-home')
    s = bindPack(s, '小队', 'naruto-home')
    expect(s.bindings.find((b) => b.characterName === '小队')!.packIds).toEqual(['naruto-home'])
  })

  it('unbindPack 移除单包；移空则整条绑定消失', () => {
    let s = baseSettings()
    s = setBinding(s, '小队', ['naruto-home', 'sasuke'])
    s = unbindPack(s, '小队', 'naruto-home')
    expect(getActivePacks(s, '小队').map((p) => p.id)).toEqual(['sasuke'])
    s = unbindPack(s, '小队', 'sasuke')
    expect(s.bindings.find((b) => b.characterName === '小队')).toBeUndefined()
  })

  it('reorderBinding 调整包顺序', () => {
    let s = baseSettings()
    s = setBinding(s, '小队', ['naruto-home', 'naruto-ninja', 'sasuke'])
    s = reorderBinding(s, '小队', 2, 0)
    expect(getActivePacks(s, '小队').map((p) => p.id)).toEqual(['sasuke', 'naruto-home', 'naruto-ninja'])
  })

  it('未启用的绑定不返回包', () => {
    let s = baseSettings()
    s = setBinding(s, '小队', ['sasuke'])
    s.bindings = s.bindings.map((b) => ({ ...b, enabled: false }))
    expect(getActivePacks(s, '小队')).toEqual([])
  })

  it('getActiveAddresses 汇总所有启用包的三级坐标', () => {
    let s = baseSettings()
    s = setBinding(s, '小队', ['naruto-home', 'sasuke'])
    const addrs = getActiveAddresses(s, '小队').map(formatAddress)
    expect(addrs).toContain('鸣人/居家服/微笑')
    expect(addrs).toContain('佐助/微笑')
  })
})
