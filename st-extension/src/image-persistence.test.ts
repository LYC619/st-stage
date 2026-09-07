// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  persistSTImage,
  ST_IMAGE_MAX_BYTES,
  ST_IMAGE_SAVE_TIMEOUT_MS,
} from './image-persistence'

const headers = () => ({ 'X-CSRF-Token': 'test' })

function memoryService(options: {
  responsePath?: (filename: string, format: string) => string
  postStatus?: number
  postError?: Error
  readStatus?: number
  readBytes?: Uint8Array
  readError?: Error
  neverResolvePost?: boolean
  neverResolveRead?: boolean
} = {}) {
  const disk = new Map<string, Uint8Array>()
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input)
    if (url === '/api/images/upload') {
      if (options.neverResolvePost) {
        await new Promise<void>((resolve, reject) => {
          init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('aborted', 'AbortError')), { once: true })
          void resolve
        })
      }
      if (options.postError) throw options.postError
      if (options.postStatus && options.postStatus !== 200) return new Response('', { status: options.postStatus })
      const payload = JSON.parse(String(init?.body)) as { filename: string; format: string; image: string }
      const path = options.responsePath?.(payload.filename, payload.format)
        ?? `/user/images/sprite_overlay/${payload.filename}.${payload.format}`
      disk.set(path, Uint8Array.from(atob(payload.image), (char) => char.charCodeAt(0)))
      return new Response(JSON.stringify({ path }), { status: 200 })
    }
    if (options.neverResolveRead) {
      await new Promise<void>((resolve, reject) => {
        init?.signal?.addEventListener('abort', () => reject(init.signal?.reason ?? new DOMException('aborted', 'AbortError')), { once: true })
        void resolve
      })
    }
    if (options.readError) throw options.readError
    if (options.readStatus && options.readStatus !== 200) return new Response('', { status: options.readStatus })
    const bytes = options.readBytes ?? disk.get(url)
    return bytes ? new Response(bytes as BodyInit, { status: 200 }) : new Response('', { status: 404 })
  }) as typeof fetch
  return { disk, fetchMock }
}

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('persistSTImage', () => {
  it.each([0, 1])('enforces the 20 MiB decoded limit (extra byte=%s)', async (extra) => {
    const fetchMock = vi.fn(async () => new Response('', { status: 413 }))
    const dataUri = 'data:image/png;base64,' + Buffer.alloc(ST_IMAGE_MAX_BYTES + extra).toString('base64')
    await expect(persistSTImage(dataUri, { fetch: fetchMock, getRequestHeaders: headers }))
      .rejects.toThrow(extra ? '20 MiB' : 'HTTP 413')
    expect(fetchMock).toHaveBeenCalledTimes(extra ? 0 : 1)
  }, 20_000)

  it('fails closed when secure random naming is unavailable', async () => {
    const service = memoryService()
    vi.stubGlobal('crypto', undefined)
    await expect(persistSTImage('data:image/png;base64,QQ==', { fetch: service.fetchMock, getRequestHeaders: headers }))
      .rejects.toThrow('安全随机')
    expect(service.fetchMock).not.toHaveBeenCalled()
  })

  it('uses a unique physical path and verifies the exact uploaded bytes', async () => {
    const service = memoryService()
    const first = await persistSTImage('data:image/webp;base64,QUFB', {
      fetch: service.fetchMock,
      getRequestHeaders: headers,
    })
    const second = await persistSTImage('data:image/webp;base64,QkJC', {
      fetch: service.fetchMock,
      getRequestHeaders: headers,
    })

    expect(second).not.toBe(first)
    expect(new TextDecoder().decode(service.disk.get(first))).toBe('AAA')
    expect(new TextDecoder().decode(service.disk.get(second))).toBe('BBB')
    expect(first).toMatch(/^\/user\/images\/sprite_overlay\/sprite_[0-9a-f]{32}\.webp$/)
  })

  it.each([
    ['png', 'data:image/png;base64,AA=='],
    ['jpeg', 'data:image/jpeg;base64,AA=='],
    ['gif', 'data:image/gif;base64,AA=='],
  ])('derives the extension from the %s MIME type', async (_name, dataUri) => {
    const service = memoryService()
    const path = await persistSTImage(dataUri, { fetch: service.fetchMock, getRequestHeaders: headers })
    expect(path.endsWith(`.${_name === 'jpeg' ? 'jpg' : _name}`)).toBe(true)
  })

  it.each([
    ['missing headers', { getRequestHeaders: undefined }],
    ['empty headers', { getRequestHeaders: () => ({}) }],
  ])('rejects before POST when %s', async (_name, deps) => {
    const service = memoryService()
    await expect(persistSTImage('data:image/png;base64,AA==', {
      fetch: service.fetchMock,
      getRequestHeaders: deps.getRequestHeaders,
    })).rejects.toThrow('请求头能力')
    expect(service.fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['413', { postStatus: 413 }],
    ['500', { postStatus: 500 }],
    ['network error', { postError: new Error('offline') }],
    ['invalid response object', { responsePath: () => 'https://example.test/a.png' }],
    ['wrong directory', { responsePath: (name: string, format: string) => `/user/images/other/${name}.${format}` }],
    ['path traversal', { responsePath: (name: string, format: string) => `/user/images/sprite_overlay/../${name}.${format}` }],
    ['read 404', { readStatus: 404 }],
    ['read network error', { readError: new Error('read offline') }],
    ['read mismatch', { readBytes: Uint8Array.from([9, 9]) }],
  ] as const)('rejects %s and never returns the data URI', async (_name, options) => {
    const service = memoryService(options)
    const result = persistSTImage('data:image/png;base64,QUJD', { fetch: service.fetchMock, getRequestHeaders: headers })
    await expect(result).rejects.toBeTruthy()
  })

  it('rejects malformed and unsupported image data without a fallback', async () => {
    const service = memoryService()
    await expect(persistSTImage('data:image/tiff;base64,QQ==', { fetch: service.fetchMock, getRequestHeaders: headers }))
      .rejects.toThrow('不支持的图片格式')
    await expect(persistSTImage('data:image/png;base64,not-base64', { fetch: service.fetchMock, getRequestHeaders: headers }))
      .rejects.toThrow('图片数据格式不正确')
    expect(service.fetchMock).not.toHaveBeenCalled()
  })

  it('aborts a hung POST and a hung read at the save timeout', async () => {
    vi.useFakeTimers()
    const post = memoryService({ neverResolvePost: true })
    const postPromise = persistSTImage('data:image/png;base64,AA==', { fetch: post.fetchMock, getRequestHeaders: headers })
    const postRejected = expect(postPromise).rejects.toBeTruthy()
    await vi.advanceTimersByTimeAsync(ST_IMAGE_SAVE_TIMEOUT_MS)
    await postRejected

    const read = memoryService({ neverResolveRead: true })
    const readPromise = persistSTImage('data:image/png;base64,AA==', { fetch: read.fetchMock, getRequestHeaders: headers })
    const readRejected = expect(readPromise).rejects.toBeTruthy()
    await vi.advanceTimersByTimeAsync(ST_IMAGE_SAVE_TIMEOUT_MS)
    await readRejected
  })

  it('honors caller cancellation', async () => {
    const service = memoryService({ neverResolvePost: true })
    const controller = new AbortController()
    const promise = persistSTImage('data:image/png;base64,AA==', {
      fetch: service.fetchMock,
      getRequestHeaders: headers,
    }, { signal: controller.signal })
    controller.abort()
    await expect(promise).rejects.toBeTruthy()
  })
})
