// @vitest-environment node

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
  it('enforces the decoded byte limit before POST', async () => {
    expect(ST_IMAGE_MAX_BYTES).toBe(20 * 1024 * 1024)
    const fetchMock = vi.fn(async () => new Response('', { status: 413 }))
    const exact = 'data:image/png;base64,' + Buffer.alloc(64).toString('base64')
    const over = 'data:image/png;base64,' + Buffer.alloc(65).toString('base64')

    await expect(persistSTImage(exact, { fetch: fetchMock, getRequestHeaders: headers }, { maxBytes: 64 }))
      .rejects.toThrow('HTTP 413')
    expect(fetchMock).toHaveBeenCalledTimes(1)

    await expect(persistSTImage(over, { fetch: fetchMock, getRequestHeaders: headers }, { maxBytes: 64 }))
      .rejects.toThrow('20 MiB')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('fails closed when secure random naming or CSRF headers are unavailable', async () => {
    const service = memoryService()
    for (const getRequestHeaders of [undefined, () => ({})]) {
      await expect(persistSTImage('data:image/png;base64,AA==', { fetch: service.fetchMock, getRequestHeaders }))
        .rejects.toThrow('请求头能力')
    }
    vi.stubGlobal('crypto', undefined)
    await expect(persistSTImage('data:image/png;base64,QQ==', { fetch: service.fetchMock, getRequestHeaders: headers }))
      .rejects.toThrow('安全随机')
    expect(service.fetchMock).not.toHaveBeenCalled()
  })

  it('uses unique physical paths, maps raster MIME extensions, and verifies uploaded bytes', async () => {
    const service = memoryService()
    const first = await persistSTImage('data:image/webp;base64,QUFB', { fetch: service.fetchMock, getRequestHeaders: headers })
    const second = await persistSTImage('data:image/webp;base64,QkJC', { fetch: service.fetchMock, getRequestHeaders: headers })
    expect(second).not.toBe(first)
    expect(new TextDecoder().decode(service.disk.get(first))).toBe('AAA')
    expect(new TextDecoder().decode(service.disk.get(second))).toBe('BBB')
    expect(first).toMatch(/^\/user\/images\/sprite_overlay\/sprite_[0-9a-f]{32}\.webp$/)

    for (const [ext, dataUri] of [['png', 'data:image/png;base64,AA=='], ['jpg', 'data:image/jpeg;base64,AA=='], ['gif', 'data:image/gif;base64,AA==']] as const) {
      const saved = await persistSTImage(dataUri, { fetch: service.fetchMock, getRequestHeaders: headers })
      expect(saved.endsWith(`.${ext}`)).toBe(true)
    }
  })

  it('rejects upload, path-traversal, readback, and format failures without falling back to the data URI', async () => {
    const cases = [
      { postStatus: 413 },
      { postStatus: 500 },
      { postError: new Error('offline') },
      { responsePath: () => 'https://example.test/a.png' },
      { responsePath: (name: string, format: string) => `/user/images/other/${name}.${format}` },
      { responsePath: (name: string, format: string) => `/user/images/sprite_overlay/../${name}.${format}` },
      { readStatus: 404 },
      { readError: new Error('read offline') },
      { readBytes: Uint8Array.from([9, 9]) },
    ]
    for (const options of cases) {
      const service = memoryService(options)
      await expect(persistSTImage('data:image/png;base64,QUJD', { fetch: service.fetchMock, getRequestHeaders: headers })).rejects.toBeTruthy()
    }

    const clean = memoryService()
    await expect(persistSTImage('data:image/tiff;base64,QQ==', { fetch: clean.fetchMock, getRequestHeaders: headers })).rejects.toThrow('不支持的图片格式')
    await expect(persistSTImage('data:image/svg+xml;base64,PHN2Zy8+', { fetch: clean.fetchMock, getRequestHeaders: headers })).rejects.toThrow('不支持的图片格式')
    await expect(persistSTImage('data:image/png;base64,not-base64', { fetch: clean.fetchMock, getRequestHeaders: headers })).rejects.toThrow('图片数据格式不正确')
    expect(clean.fetchMock).not.toHaveBeenCalled()
  })

  it('aborts hung requests at timeout and honors caller cancellation', async () => {
    vi.useFakeTimers()
    for (const hung of [{ neverResolvePost: true }, { neverResolveRead: true }]) {
      const service = memoryService(hung)
      const promise = persistSTImage('data:image/png;base64,AA==', { fetch: service.fetchMock, getRequestHeaders: headers })
      const rejected = expect(promise).rejects.toBeTruthy()
      await vi.advanceTimersByTimeAsync(ST_IMAGE_SAVE_TIMEOUT_MS)
      await rejected
    }

    vi.useRealTimers()
    const service = memoryService({ neverResolvePost: true })
    const controller = new AbortController()
    const promise = persistSTImage('data:image/png;base64,AA==', { fetch: service.fetchMock, getRequestHeaders: headers }, { signal: controller.signal })
    controller.abort(new DOMException('cancelled', 'AbortError'))
    await expect(promise).rejects.toBeTruthy()
  })
})
