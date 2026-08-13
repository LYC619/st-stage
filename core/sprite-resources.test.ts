import { describe, expect, it } from 'vitest'
import { summarizePackResources } from './sprite-resources'
import type { SpritePack } from './types'

function pack(sprites: SpritePack['sprites']): SpritePack {
  return { id: 'pack', name: '测试包', sprites }
}

describe('summarizePackResources', () => {
  it('distinguishes cloud-only, local-only, and dual sprites', () => {
    expect(summarizePackResources(pack([
      { tag: '云端', url: 'https://cdn.example/cloud.webp' },
    ]))).toEqual({ total: 1, local: 0, cloud: 1 })

    expect(summarizePackResources(pack([
      { tag: '本地路径', url: '/user/images/local.webp' },
      { tag: '内嵌', url: 'data:image/webp;base64,AA==' },
    ]))).toEqual({ total: 2, local: 2, cloud: 0 })

    expect(summarizePackResources(pack([
      {
        tag: '双端',
        url: '/user/images/local.webp',
        remoteUrl: 'https://cdn.example/cloud.webp',
      },
    ]))).toEqual({ total: 1, local: 1, cloud: 1 })
  })

  it('reports partial localization without promoting the whole pack to local', () => {
    expect(summarizePackResources(pack([
      {
        tag: '已下载',
        url: '/user/images/local.webp',
        remoteUrl: 'https://cdn.example/cloud.webp',
      },
      { tag: '仍在云端', url: 'https://cdn.example/remote.webp' },
      { tag: '本地独有', url: '/user/images/only-local.webp' },
    ]))).toEqual({ total: 3, local: 2, cloud: 2 })
  })

  it('ignores invalid remoteUrl values and handles an empty pack', () => {
    expect(summarizePackResources(pack([
      { tag: '本地', url: '/user/images/local.webp', remoteUrl: '/not/cloud.webp' },
    ]))).toEqual({ total: 1, local: 1, cloud: 0 })
    expect(summarizePackResources(pack([]))).toEqual({ total: 0, local: 0, cloud: 0 })
  })
})
