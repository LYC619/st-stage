// @vitest-environment node

import { describe, expect, it, vi } from 'vitest'
import type { Sprite } from '../../core/types'
import { LOCALIZE_MAX_BYTES, LOCALIZE_TIMEOUT_MS, localizeSprite } from './sprite-localize'

const remote: Sprite = {
  tag: '微笑',
  url: 'https://img.test/original.png',
  code: 'original.png',
  labels: ['表情'],
}

function response(body: Blob, headers: Record<string, string> = {}, readBody = vi.fn(async () => body)): Response {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': body.type, ...headers }),
    blob: readBody,
  } as unknown as Response
}

describe('localizeSprite', () => {
  it('fetches, compresses, saves, and validates encoded user-image paths without mutating input', async () => {
    const order: string[] = []
    const result = await localizeSprite(remote, '微笑.webp', {
      fetch: (async () => { order.push('fetch'); return response(new Blob(['remote'], { type: 'image/png' }), { 'content-length': '6' }) }) as unknown as typeof fetch,
      compress: async () => { order.push('compress'); return { dataUri: 'data:image/webp;base64,AA==', compressed: true, bytes: 1 } },
      saveImage: async (file, fileName) => {
        order.push('save')
        expect(file.type).toBe('image/webp')
        expect(fileName).toBe('微笑.webp')
        return '/user/images/a%23b.webp'
      },
    })
    expect(order).toEqual(['fetch', 'compress', 'save'])
    expect(result).toEqual({ ...remote, url: '/user/images/a%23b.webp', remoteUrl: remote.url })
    expect(remote.url).toBe('https://img.test/original.png')
  })

  it('rejects already-local URLs, timeouts, oversized headers/blobs, SVG payloads, and unsafe save paths', async () => {
    for (const localUrl of ['data:image/png;base64,AA==', '/user/images/local.png']) {
      const fetchImage = vi.fn()
      await expect(localizeSprite({ ...remote, url: localUrl }, 'image.webp', { fetch: fetchImage as typeof fetch, saveImage: vi.fn() }))
        .rejects.toThrow('已经是本地图片')
      expect(fetchImage).not.toHaveBeenCalled()
    }

    await expect(localizeSprite(remote, 'image.webp', {
      fetch: vi.fn(async (_u, init?: RequestInit) => {
        expect(init?.signal).toBeInstanceOf(AbortSignal)
        throw new DOMException('Timed out', 'TimeoutError')
      }) as unknown as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow(`超过 ${LOCALIZE_TIMEOUT_MS / 1000} 秒`)

    const readBody = vi.fn()
    await expect(localizeSprite(remote, 'image.webp', {
      fetch: vi.fn(async () => response(new Blob(['x'], { type: 'image/png' }), { 'content-length': String(LOCALIZE_MAX_BYTES + 1) }, readBody)) as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow('远程图片过大')
    expect(readBody).not.toHaveBeenCalled()

    const svgBlob = new Blob(['<svg><script>alert(1)</script></svg>'], { type: 'image/svg+xml; charset=utf-8' })
    const saveSvg = vi.fn()
    await expect(localizeSprite(remote, 'evil.svg', { fetch: vi.fn(async () => response(svgBlob)) as typeof fetch, saveImage: saveSvg }))
      .rejects.toThrow('不支持的图片格式')
    expect(saveSvg).not.toHaveBeenCalled()

    for (const unsafeSaved of ['https://img.test/not-local.webp', 'data:image/webp;base64,AA==', 'blob:https://img.test/id', '/scripts/extension/image.webp', '/user/images/../secret.webp']) {
      await expect(localizeSprite(remote, 'image.webp', {
        fetch: vi.fn(async () => response(new Blob(['remote'], { type: 'image/png' }))) as typeof fetch,
        compress: async () => ({ dataUri: 'data:image/webp;base64,AA==', compressed: true, bytes: 1 }),
        saveImage: async () => unsafeSaved,
      })).rejects.toThrow('安全的本地用户图片地址')
    }
  })

  it('leaves source sprite untouched across fetch/HTTP/compress/save failures', async () => {
    for (const failure of ['fetch', 'http', 'compress', 'save'] as const) {
      const original = structuredClone(remote)
      await expect(localizeSprite(original, 'image.webp', {
        fetch: (async () => {
          if (failure === 'fetch') throw new TypeError('CORS')
          if (failure === 'http') return { ok: false, status: 503, headers: new Headers() } as Response
          return response(new Blob(['remote'], { type: 'image/png' }))
        }) as unknown as typeof fetch,
        compress: async () => {
          if (failure === 'compress') throw new Error('decode failed')
          return { dataUri: 'data:image/webp;base64,AA==', compressed: true, bytes: 1 }
        },
        saveImage: async () => {
          if (failure === 'save') throw new Error('disk full')
          return '/user/images/smile.webp'
        },
      })).rejects.toThrow()
      expect(original).toEqual(remote)
    }
  })
})
