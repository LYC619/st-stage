import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import {
  PRELOAD_MATCH_MAX,
  PRELOAD_ON_ACTIVATE_MAX,
  preloadMatchedSprites,
  preloadOnActivate,
} from './sprite-preload'
import type { Sprite, SpritePack } from './types'

class FakeImage {
  static created: FakeImage[] = []
  crossOrigin = ''
  src = ''

  constructor() {
    FakeImage.created.push(this)
  }
}

const originalImage = globalThis.Image

const sprite = (index: number, url = `https://img/${index}.webp`): Sprite => ({
  tag: `图_${index}`,
  url,
})

const pack = (index: number, spriteCount = 3): SpritePack => ({
  id: `p_${index}`,
  name: `包_${index}`,
  sprites: Array.from({ length: spriteCount }, (_, spriteIndex) =>
    sprite(index * 100 + spriteIndex),
  ),
})

beforeEach(() => {
  FakeImage.created = []
  globalThis.Image = FakeImage as unknown as typeof Image
})

afterEach(() => {
  if (originalImage) globalThis.Image = originalImage
  else Reflect.deleteProperty(globalThis, 'Image')
})

describe('sprite preload budgets', () => {
  it('固定激活 4 / 命中 10 的全局上限', () => {
    expect(PRELOAD_ON_ACTIVATE_MAX).toBe(4)
    expect(PRELOAD_MATCH_MAX).toBe(10)
  })

  it('激活时只按绑定顺序预加载每包首图，最多 4 张', () => {
    const packs = Array.from({ length: 7 }, (_, index) => pack(index))
    preloadOnActivate(packs)

    expect(FakeImage.created).toHaveLength(4)
    expect(FakeImage.created.map((image) => image.src)).toEqual([
      packs[0].sprites[0].url,
      packs[1].sprites[0].url,
      packs[2].sprites[0].url,
      packs[3].sprites[0].url,
    ])
    expect(FakeImage.created.every((image) => image.crossOrigin === 'anonymous')).toBe(true)
  })

  it('命中序列最多预加载前 10 个唯一 URL', () => {
    const sprites = Array.from({ length: 12 }, (_, index) => sprite(index))
    preloadMatchedSprites(sprites)
    expect(FakeImage.created).toHaveLength(10)
    expect(FakeImage.created.at(-1)?.src).toBe(sprites[9].url)
  })

  it('相同 URL 去重，空包与不足上限输入自然缩短', () => {
    const packs: SpritePack[] = [
      { id: 'empty', name: '空包', sprites: [] },
      { id: 'a', name: 'A', sprites: [sprite(1, 'same')] },
      { id: 'b', name: 'B', sprites: [sprite(2, 'same')] },
      { id: 'c', name: 'C', sprites: [sprite(3, 'other')] },
    ]
    preloadOnActivate(packs)
    expect(FakeImage.created.map((image) => image.src)).toEqual(['same', 'other'])
  })

  it('SSR / 非浏览器环境没有 Image 时安全 no-op', () => {
    Reflect.deleteProperty(globalThis, 'Image')
    expect(() => preloadMatchedSprites([sprite(1)])).not.toThrow()
    expect(FakeImage.created).toEqual([])
  })
})
