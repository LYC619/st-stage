// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { Sprite } from '../../core/types'
import { LOCALIZE_MAX_BYTES, localizeSprite } from './sprite-localize'

const remote: Sprite = {
  tag: '微笑',
  url: 'https://img.test/original.png',
  code: 'original.png',
  labels: ['表情'],
}

function response(
  body: Blob,
  headers: Record<string, string> = {},
  readBody = vi.fn(async () => body),
): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': body.type, ...headers }),
    blob: readBody,
  } as unknown as Response
}

describe('localizeSprite', () => {
  it('runs fetch, compression, and save in order before returning a localized copy', async () => {
    const order: string[] = []
    const fetchImage = vi.fn(async () => {
      order.push('fetch')
      return response(new Blob(['remote'], { type: 'image/png' }), { 'content-length': '6' })
    })
    const compress = vi.fn(async () => {
      order.push('compress')
      return { dataUri: 'data:image/webp;base64,AA==', compressed: true, bytes: 1 }
    })
    const saveImage = vi.fn(async (file: File, fileName: string) => {
      order.push('save')
      expect(file.type).toBe('image/webp')
      expect(fileName).toBe('微笑.webp')
      return '/user/images/smile.webp'
    })

    const result = await localizeSprite(remote, '微笑.webp', {
      fetch: fetchImage as typeof fetch,
      compress,
      saveImage,
    })

    expect(order).toEqual(['fetch', 'compress', 'save'])
    expect(result).toEqual({
      ...remote,
      url: '/user/images/smile.webp',
      remoteUrl: remote.url,
    })
    expect(remote).toEqual({
      tag: '微笑',
      url: 'https://img.test/original.png',
      code: 'original.png',
      labels: ['表情'],
    })
  })

  it.each([
    ['data URI', 'data:image/png;base64,AA=='],
    ['local path', '/user/images/local.png'],
  ])('rejects an already-local %s without fetching', async (_name, url) => {
    const fetchImage = vi.fn()

    await expect(localizeSprite({ ...remote, url }, 'image.webp', {
      fetch: fetchImage as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow('已经是本地图片')
    expect(fetchImage).not.toHaveBeenCalled()
  })

  it('rejects oversized response headers before reading the body', async () => {
    const readBody = vi.fn()
    const fetchImage = vi.fn(async () => response(
      new Blob(['small'], { type: 'image/png' }),
      { 'content-length': String(LOCALIZE_MAX_BYTES + 1) },
      readBody,
    ))

    await expect(localizeSprite(remote, 'image.webp', {
      fetch: fetchImage as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow('远程图片过大')
    expect(readBody).not.toHaveBeenCalled()
  })

  it('rejects oversized decoded blobs', async () => {
    const oversized = new Blob([new Uint8Array(LOCALIZE_MAX_BYTES + 1)], { type: 'image/png' })

    await expect(localizeSprite(remote, 'image.webp', {
      fetch: vi.fn(async () => response(oversized)) as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow('远程图片过大')
  })

  it('rejects a save result that is still remote', async () => {
    await expect(localizeSprite(remote, 'image.webp', {
      fetch: vi.fn(async () => response(new Blob(['remote'], { type: 'image/png' }))) as typeof fetch,
      compress: vi.fn(async () => ({
        dataUri: 'data:image/webp;base64,AA==',
        compressed: true,
        bytes: 1,
      })),
      saveImage: vi.fn(async () => 'https://img.test/not-local.webp'),
    })).rejects.toThrow('平台未返回本地地址')
  })

  it('reports response body read failures as download failures', async () => {
    const failedResponse = response(
      new Blob(['remote'], { type: 'image/png' }),
      {},
      vi.fn(async () => { throw new Error('stream interrupted') }),
    )

    await expect(localizeSprite(remote, 'image.webp', {
      fetch: vi.fn(async () => failedResponse) as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow('下载远程图片失败：stream interrupted')
  })

  it.each(['fetch', 'http', 'compress', 'save'] as const)(
    'leaves the source byte-for-byte unchanged when %s fails',
    async (failure) => {
      const original = structuredClone(remote)
      const fetchImage = vi.fn(async () => {
        if (failure === 'fetch') throw new TypeError('CORS blocked')
        if (failure === 'http') {
          return {
            ok: false,
            status: 503,
            headers: new Headers(),
          } as Response
        }
        return response(new Blob(['remote'], { type: 'image/png' }))
      })
      const compress = vi.fn(async () => {
        if (failure === 'compress') throw new Error('decode failed')
        return { dataUri: 'data:image/webp;base64,AA==', compressed: true, bytes: 1 }
      })
      const saveImage = vi.fn(async () => {
        if (failure === 'save') throw new Error('disk full')
        return '/user/images/smile.webp'
      })

      await expect(localizeSprite(original, 'image.webp', {
        fetch: fetchImage as typeof fetch,
        compress,
        saveImage,
      })).rejects.toThrow()
      expect(original).toEqual(remote)
    },
  )
})
