import type { Sprite, SpritePack } from './types'

export interface PackResourceSummary {
  total: number
  local: number
  cloud: number
}

function isCloudUrl(value: string | undefined): boolean {
  return typeof value === 'string' && /^https?:\/\//i.test(value)
}

function hasLocalResource(sprite: Sprite): boolean {
  return !isCloudUrl(sprite.url)
}

function hasCloudResource(sprite: Sprite): boolean {
  return isCloudUrl(sprite.url) || isCloudUrl(sprite.remoteUrl)
}

/** 汇总包内每张图实际可用的本地与云端资源；同一张图可同时计入两端。 */
export function summarizePackResources(pack: Pick<SpritePack, 'sprites'>): PackResourceSummary {
  let local = 0
  let cloud = 0
  for (const sprite of pack.sprites) {
    if (hasLocalResource(sprite)) local += 1
    if (hasCloudResource(sprite)) cloud += 1
  }
  return { total: pack.sprites.length, local, cloud }
}
