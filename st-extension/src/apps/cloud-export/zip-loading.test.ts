// @vitest-environment jsdom

import { afterEach, expect, it, vi } from 'vitest'

afterEach(() => {
  vi.doUnmock('jszip')
  vi.resetModules()
  vi.restoreAllMocks()
})

it('cancels a pending JSZip import promptly, ignores its late result, and permits a retry', async () => {
  vi.resetModules()
  const actual = await vi.importActual<typeof import('jszip')>('jszip')
  let releaseModule!: () => void
  const heldModule = new Promise<void>(resolve => { releaseModule = resolve })
  let started!: () => void
  const importing = new Promise<void>(resolve => { started = resolve })
  vi.doMock('jszip', async () => { started(); await heldModule; return actual })
  const { downloadSTBackup } = await import('./zip')
  const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:retry')
  vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
  const cancelledProgress = vi.fn()
  const controller = new AbortController()
  const schedulers = { scheduleRevoke: (revoke: () => void) => revoke() }
  const files = [{ path: 'settings.json', data: '{}' }]
  let outcome: unknown
  const cancelled = downloadSTBackup(files, 'cancelled', cancelledProgress, { ...schedulers, signal: controller.signal })
    .catch(error => { outcome = error })
  try {
    await importing
    controller.abort()
    await vi.waitFor(() => expect(outcome).toMatchObject({ name: 'AbortError' }), { timeout: 250 })
    expect(create).not.toHaveBeenCalled()
    // A retry can begin before the first, non-abortable network import arrives.
    const retry = downloadSTBackup(files, 'retry', () => {}, schedulers)
    releaseModule()
    await Promise.all([cancelled, retry])
    expect(cancelledProgress).not.toHaveBeenCalled()
    expect(create).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
  } finally {
    releaseModule()
    await cancelled
  }
})
