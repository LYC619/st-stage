/** 有界立绘预加载：安装/Prompt 规模不再决定主动创建的 Image 数量。 */

import type { Sprite, SpritePack } from './types'

export const PRELOAD_ON_ACTIVATE_MAX = 4
export const PRELOAD_MATCH_MAX = 10

function preloadSprites(sprites: Sprite[], max: number): void {
  if (typeof Image === 'undefined' || max <= 0) return
  const seen = new Set<string>()
  let loaded = 0
  for (const sprite of sprites) {
    const url = sprite.url
    if (!url || seen.has(url)) continue
    seen.add(url)
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.src = url
    loaded++
    if (loaded >= max) break
  }
}

/** 激活集合只取每个包的首图，按绑定顺序共享 4 张预算。 */
export function preloadOnActivate(packs: SpritePack[]): void {
  const firstSprites: Sprite[] = []
  for (const pack of packs) {
    const first = pack.sprites[0]
    if (first) firstSprites.push(first)
  }
  preloadSprites(firstSprites, PRELOAD_ON_ACTIVATE_MAX)
}

/** AI 本次实际命中的轮播序列共享 10 张预算；之后的图片由浏览器按需加载。 */
export function preloadMatchedSprites(sprites: Sprite[]): void {
  preloadSprites(sprites, PRELOAD_MATCH_MAX)
}
