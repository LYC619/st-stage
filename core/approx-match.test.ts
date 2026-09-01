import { describe, expect, it } from 'vitest'
import type { Sprite, SpritePack } from './types'
import {
  approxMatchSprite,
  buildApproxCandidates,
  resolveWithApprox,
} from './approx-match'
import { resolveSprite } from './sprite-store'

const sprite = (tag: string, extra: Partial<Sprite> = {}): Sprite => ({
  tag,
  url: `${tag}.png`,
  ...extra,
})

function pack(over: Partial<SpritePack> = {}): SpritePack {
  return {
    id: 'p1',
    name: '丽丽的图包',
    roleName: '丽丽',
    sprites: [
      sprite('逛街', { outfit: '连衣裙' }),
      sprite('生气', { outfit: '连衣裙' }),
      sprite('逛街', { outfit: '运动服' }),
      sprite('睡觉', { outfit: '睡衣' }),
    ],
    ...over,
  }
}

describe('buildApproxCandidates', () => {
  it('候选词取有效地址三段（含包级人名继承）', () => {
    const candidates = buildApproxCandidates([pack()])
    expect(candidates).toHaveLength(4)
    expect(candidates[0].terms).toEqual(expect.arrayContaining(['丽丽', '连衣裙', '逛街']))
  })

  it('图名内部的分隔符会拆开，纯数字片段丢掉', () => {
    const p = pack({ sprites: [sprite('微笑_侧身'), sprite('站姿_01')] })
    const [smile, stand] = buildApproxCandidates([p])
    expect(smile.terms).toEqual(expect.arrayContaining(['微笑_侧身', '微笑', '侧身']))
    expect(stand.terms).toContain('站姿')
    expect(stand.terms).not.toContain('01')
  })

  it('空包不产出候选', () => {
    expect(buildApproxCandidates([])).toEqual([])
    expect(buildApproxCandidates([pack({ sprites: [] })])).toEqual([])
  })
})

describe('approxMatchSprite', () => {
  const candidates = buildApproxCandidates([pack()])

  // 维护者给的原始例子
  it('自然语言描述命中服装＋图名', () => {
    const hit = approxMatchSprite(candidates, '丽丽穿着连衣裙和XX逛街')
    expect(hit?.sprite.tag).toBe('逛街')
    expect(hit?.sprite.outfit).toBe('连衣裙')
  })

  it('只命中一个词也算，只要它够长', () => {
    expect(approxMatchSprite(candidates, '她穿着睡衣')?.sprite.tag).toBe('睡觉')
  })

  it('同分打平返回 null——猜错比不显示更糟', () => {
    // 「丽丽逛街」同时完全命中 连衣裙/逛街 与 运动服/逛街 的「丽丽」+「逛街」
    expect(approxMatchSprite(candidates, '丽丽去逛街')).toBeNull()
  })

  it('分数不够阈值返回 null（只命中一个单字符词不算）', () => {
    const single = buildApproxCandidates([pack({ roleName: '', sprites: [sprite('笑')] })])
    expect(approxMatchSprite(single, '他笑了')).toBeNull()
  })

  it('空描述、空候选一律 null', () => {
    expect(approxMatchSprite(candidates, '   ')).toBeNull()
    expect(approxMatchSprite([], '丽丽穿着连衣裙逛街')).toBeNull()
  })

  it('不做反向包含：描述比地址长，反向包含会让短地址命中一切', () => {
    const p = buildApproxCandidates([pack({ roleName: '', sprites: [sprite('连衣裙下摆的细节')] })])
    // 描述里只有「连衣裙」，候选是更长的「连衣裙下摆的细节」——不应因被描述包含而命中
    expect(approxMatchSprite(p, '连衣裙')).toBeNull()
  })
})

describe('resolveWithApprox', () => {
  const packs = [pack()]

  it('关闭时逐字等价于严格解析', () => {
    expect(resolveWithApprox(packs, '连衣裙/逛街', resolveSprite, false)?.tag).toBe('逛街')
    expect(resolveWithApprox(packs, '完全无关的一句话', resolveSprite, false)).toBeNull()
  })

  /**
   * 既有行为，不是本功能引入的：单段地址会走 matchUniqueTagInPool 的模糊层，
   * 它对 sprite.tag 做双向子串并取**首个**命中。所以「描述里含某个图名」这种
   * 情况在近似匹配关闭时就已经能解析了——而且取的是包内顺序第一个，不是最像的。
   * 记在这里防止有人以为这是近似匹配的功劳，或反过来把它当 bug「修掉」。
   */
  it('描述里含图名时，严格层自己就会命中（首个，非最优）', () => {
    const off = resolveWithApprox(packs, '丽丽穿着连衣裙和XX逛街', resolveSprite, false)
    expect(off?.tag).toBe('逛街')
    expect(off?.outfit).toBe('连衣裙') // 包内第一个「逛街」，并非因为描述里有「连衣裙」
  })

  /** 近似匹配真正补上的缺口：描述只提到人名/服装，严格层单段只看 tag，看不见这两段。 */
  it('描述只提服装时，严格层看不见、近似层能命中', () => {
    expect(resolveWithApprox(packs, '她穿着睡衣', resolveSprite, false)).toBeNull()
    expect(resolveWithApprox(packs, '她穿着睡衣', resolveSprite, true)?.tag).toBe('睡觉')
  })

  it('精确命中时不走近似，即使开启', () => {
    const exact = resolveWithApprox(packs, '连衣裙/生气', resolveSprite, true)
    expect(exact?.tag).toBe('生气')
    expect(exact?.outfit).toBe('连衣裙')
  })

  it('开启后严格失败才兜底', () => {
    // 严格层对这句返回 null（「睡衣」是服装不是图名，单段只看图名）
    expect(resolveSprite(packs, '她今晚换上了睡衣')).toBeNull()
    expect(resolveWithApprox(packs, '她今晚换上了睡衣', resolveSprite, true)?.tag).toBe('睡觉')
  })

  it('候选表缓存只建一次，且结果与不带缓存一致', () => {
    const cache = { current: null as ReturnType<typeof buildApproxCandidates> | null }
    const first = resolveWithApprox(packs, '她穿着睡衣', resolveSprite, true, cache)
    expect(cache.current).not.toBeNull()
    const built = cache.current
    const second = resolveWithApprox(packs, '她穿着睡衣', resolveSprite, true, cache)
    expect(cache.current).toBe(built) // 没有重建
    expect(second).toBe(first)
    expect(resolveWithApprox(packs, '她穿着睡衣', resolveSprite, true)).toBe(first)
  })
})
