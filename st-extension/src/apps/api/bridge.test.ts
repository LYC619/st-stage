// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fetchModels } from './bridge'

interface Deferred<T> {
  promise: Promise<T>
  resolve(value: T): void
  reject(reason: unknown): void
}

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function response(ok: boolean, body: unknown = {}): Response {
  return { ok, status: ok ? 200 : 401, json: async () => body } as Response
}

function installST(): void {
  Object.defineProperty(window, 'SillyTavern', {
    configurable: true,
    value: {
      getContext: () => ({
        getRequestHeaders: () => ({ 'Content-Type': 'application/json' }),
      }),
    },
  })
}

function secretValue(init?: RequestInit): string {
  return (JSON.parse(String(init?.body)) as { value: string }).value
}

describe('fetchModels temporary API key transaction', () => {
  beforeEach(() => {
    document.body.innerHTML = '<input id="api_key_custom" />'
    installST()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    document.body.textContent = ''
    Reflect.deleteProperty(window, 'SillyTavern')
  })

  it('restores an empty previous key after a successful request', async () => {
    const writes: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/secrets/write') {
          writes.push(secretValue(init))
          return response(true)
        }
        return response(true, { data: [{ id: 'model-a' }] })
      }),
    )

    await expect(fetchModels('https://one.example/v1', 'temporary', '')).resolves.toEqual(['model-a'])
    expect(writes).toEqual(['temporary', ''])
  })

  it('does not resolve a successful request until restoration finishes', async () => {
    const restore = deferred<Response>()
    const writes: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/secrets/write') {
          const value = secretValue(init)
          writes.push(value)
          return value === 'original' ? restore.promise : Promise.resolve(response(true))
        }
        return Promise.resolve(response(true, { models: ['model-b'] }))
      }),
    )

    const result = fetchModels('https://two.example/v1', 'temporary', 'original')
    let settled = false
    void result.finally(() => {
      settled = true
    })
    await vi.waitFor(() => expect(writes).toEqual(['temporary', 'original']))
    expect(settled).toBe(false)

    restore.resolve(response(true))
    await expect(result).resolves.toEqual(['model-b'])
    expect(settled).toBe(true)
  })

  it('restores the previous key before rejecting a failed model request', async () => {
    const restore = deferred<Response>()
    const writes: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/secrets/write') {
          const value = secretValue(init)
          writes.push(value)
          return value === 'original' ? restore.promise : Promise.resolve(response(true))
        }
        return Promise.resolve(response(false))
      }),
    )

    const result = fetchModels('https://failed.example/v1', 'temporary', 'original')
    let rejected = false
    void result.catch(() => {
      rejected = true
    })
    await vi.waitFor(() => expect(writes).toEqual(['temporary', 'original']))
    expect(rejected).toBe(false)

    restore.resolve(response(true))
    await expect(result).rejects.toThrow('HTTP 401')
    expect(rejected).toBe(true)
  })

  it('serializes overlapping temporary-key transactions', async () => {
    const firstStatus = deferred<Response>()
    const events: string[] = []
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/secrets/write') {
          const value = secretValue(init)
          events.push(`secret:${value}`)
          return Promise.resolve(response(true))
        }
        const url = (JSON.parse(String(init?.body)) as { custom_url: string }).custom_url
        events.push(`status:${url}`)
        return url.includes('one.example')
          ? firstStatus.promise
          : Promise.resolve(response(true, { data: [{ id: 'model-two' }] }))
      }),
    )

    const first = fetchModels('https://one.example/v1', 'key-one', 'original')
    await vi.waitFor(() => expect(events).toEqual(['secret:key-one', 'status:https://one.example/v1']))

    const second = fetchModels('https://two.example/v1', 'key-two', 'original')
    await Promise.resolve()
    expect(events).toEqual(['secret:key-one', 'status:https://one.example/v1'])

    firstStatus.resolve(response(true, { data: [{ id: 'model-one' }] }))
    await expect(first).resolves.toEqual(['model-one'])
    await expect(second).resolves.toEqual(['model-two'])
    expect(events).toEqual([
      'secret:key-one',
      'status:https://one.example/v1',
      'secret:original',
      'secret:key-two',
      'status:https://two.example/v1',
      'secret:original',
    ])
  })

  it('preserves a falsy model-request rejection', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL) => {
        if (String(input) === '/api/secrets/write') return Promise.resolve(response(true))
        return Promise.reject(null)
      }),
    )

    await expect(fetchModels('https://falsy-request.example/v1', 'temporary', 'original')).rejects.toBeNull()
  })

  it('rejects on a falsy restoration failure and continues the queue', async () => {
    let rejectFirstRestore = true
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/secrets/write') {
          const value = secretValue(init)
          if (value === 'original' && rejectFirstRestore) {
            rejectFirstRestore = false
            return Promise.reject(undefined)
          }
          return Promise.resolve(response(true))
        }
        const url = (JSON.parse(String(init?.body)) as { custom_url: string }).custom_url
        return Promise.resolve(response(true, { models: [url.includes('first') ? 'first' : 'second'] }))
      }),
    )

    const first = fetchModels('https://first.example/v1', 'key-first', 'original')
    const second = fetchModels('https://second.example/v1', 'key-second', 'original')

    await expect(first).rejects.toBeUndefined()
    await expect(second).resolves.toEqual(['second'])
  })

  it('keeps the request error when request and restoration both fail', async () => {
    const requestError = new Error('request failed')
    const restoreError = new Error('restore failed')
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    vi.stubGlobal(
      'fetch',
      vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
        if (String(input) === '/api/secrets/write') {
          return secretValue(init) === 'original'
            ? Promise.reject(restoreError)
            : Promise.resolve(response(true))
        }
        return Promise.reject(requestError)
      }),
    )

    await expect(fetchModels('https://double-failure.example/v1', 'temporary', 'original')).rejects.toBe(
      requestError,
    )
    expect(warn).toHaveBeenCalledWith('[st-stage] API：请求失败后还原密钥也失败', restoreError)
    warn.mockRestore()
  })
})
