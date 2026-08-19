// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { Sprite } from '../../core/types'
import {
  LOCALIZE_MAX_BYTES,
  LOCALIZE_TIMEOUT_MS,
  cleanAndLocalizeSprite,
  localizeSprite,
} from './sprite-localize'

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

  it('passes an abort signal so a hung image host cannot wedge the caller forever', async () => {
    const fetchImage = vi.fn(async (_url: string, init?: RequestInit) => {
      expect(init?.signal).toBeInstanceOf(AbortSignal)
      const timeout = new DOMException('The operation timed out.', 'TimeoutError')
      throw timeout
    })

    await expect(localizeSprite(remote, 'image.webp', {
      fetch: fetchImage as unknown as typeof fetch,
      saveImage: vi.fn(),
    })).rejects.toThrow(`下载远程图片失败：超过 ${LOCALIZE_TIMEOUT_MS / 1000} 秒没有响应`)
    expect(fetchImage).toHaveBeenCalledTimes(1)
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

describe('cleanAndLocalizeSprite', () => {
  it('远程图片按下载、清理、保存顺序处理并保留远程回退地址', async () => {
    const order: string[] = []
    const cleaned = new Blob(['cleaned'], { type: 'image/png' })
    const result = await cleanAndLocalizeSprite(remote, '微笑-clean.png', {
      fetch: vi.fn(async () => {
        order.push('fetch')
        return response(new Blob(['remote'], { type: 'image/png' }))
      }) as typeof fetch,
      clean: vi.fn(async () => {
        order.push('clean')
        return { blob: cleaned, removedPixels: 12 }
      }),
      saveImage: vi.fn(async (file, fileName) => {
        order.push('save')
        expect(file.type).toBe('image/png')
        expect(fileName).toBe('微笑-clean.png')
        return '/user/images/smile-clean.png'
      }),
    })

    expect(order).toEqual(['fetch', 'clean', 'save'])
    expect(result.sprite).toEqual({
      ...remote,
      url: '/user/images/smile-clean.png',
      remoteUrl: remote.url,
    })
    expect(result.removedPixels).toBe(12)
  })

  it('本地图片可清理为新的本地文件且保留既有远程地址', async () => {
    const local: Sprite = {
      tag: '本地',
      url: '/user/images/original.png',
      remoteUrl: 'https://img.test/backup.png',
    }
    const result = await cleanAndLocalizeSprite(local, '本地-clean.png', {
      fetch: vi.fn(async () => response(new Blob(['local'], { type: 'image/png' }))) as typeof fetch,
      clean: vi.fn(async () => ({
        blob: new Blob(['cleaned'], { type: 'image/png' }),
        removedPixels: 8,
      })),
      saveImage: vi.fn(async () => '/user/images/local-clean.png'),
    })

    expect(result.sprite).toEqual({
      ...local,
      url: '/user/images/local-clean.png',
    })
  })

  it('清理失败时不保存文件也不修改输入对象', async () => {
    const original = structuredClone(remote)
    const saveImage = vi.fn()
    await expect(cleanAndLocalizeSprite(original, 'clean.png', {
      fetch: vi.fn(async () => response(new Blob(['remote'], { type: 'image/png' }))) as typeof fetch,
      clean: vi.fn(async () => { throw new Error('没有确认到可安全去除的棋盘格背景') }),
      saveImage,
    })).rejects.toThrow('没有确认到可安全去除的棋盘格背景')
    expect(saveImage).not.toHaveBeenCalled()
    expect(original).toEqual(remote)
  })

  it('确认棋盘格后才询问是否保存，用户取消时不写文件', async () => {
    const order: string[] = []
    const saveImage = vi.fn()

    await expect(cleanAndLocalizeSprite(remote, 'clean.png', {
      fetch: vi.fn(async () => {
        order.push('fetch')
        return response(new Blob(['remote'], { type: 'image/png' }))
      }) as typeof fetch,
      clean: vi.fn(async () => {
        order.push('clean')
        return {
          blob: new Blob(['cleaned'], { type: 'image/png' }),
          removedPixels: 24,
        }
      }),
      confirmSave: vi.fn((removedPixels) => {
        order.push(`confirm:${removedPixels}`)
        return false
      }),
      saveImage,
    })).rejects.toThrow('已取消保存透明图片')

    expect(order).toEqual(['fetch', 'clean', 'confirm:24'])
    expect(saveImage).not.toHaveBeenCalled()
  })
})
