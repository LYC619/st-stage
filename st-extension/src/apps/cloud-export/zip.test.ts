// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { downloadSTBackup, REVOKE_DELAY_MS } from './zip'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 立即回收，避免测试留下 60 秒的悬挂定时器。 */
const immediateRevoke = { scheduleRevoke: (revoke: () => void) => { revoke() } }

describe('cloud export zip', () => {
  it('reports progress and downloads a zip blob', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const progress: number[] = []
    await downloadSTBackup([{ path: 'settings.json', data: '{"extensions":{}}' }], 'test.zip', ({ percent }) => progress.push(percent), immediateRevoke)
    expect(progress.length).toBeGreaterThan(0)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(click).toHaveBeenCalledOnce()
  })

  it('keeps the blob URL alive past the click so a large download is not aborted', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    let urlAtClick: string | null = null
    let attachedAtClick = false
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
      urlAtClick = this.getAttribute('href')
      attachedAtClick = this.isConnected
    })
    const deferred: Array<{ revoke: () => void; delayMs: number }> = []

    await downloadSTBackup([{ path: 'settings.json', data: '{}' }], 'test.zip', () => {}, {
      scheduleRevoke: (revoke, delayMs) => { deferred.push({ revoke, delayMs }) },
    })

    // 点击时链接必须已在文档内且 blob 未被回收（旧实现在 finally 里同步 revoke）
    expect(urlAtClick).toBe('blob:test')
    expect(attachedAtClick).toBe(true)
    expect(revokeObjectURL).not.toHaveBeenCalled()
    expect(document.querySelector('a[download]')).toBeNull()

    expect(deferred).toHaveLength(1)
    expect(deferred[0].delayMs).toBe(REVOKE_DELAY_MS)
    deferred[0].revoke()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
  })

  it('creates a readable zip with the requested path', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      void blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await downloadSTBackup([{ path: 'characters/A.png', data: new Uint8Array([1, 2, 3]) }], 'test.zip', () => {}, immediateRevoke)
    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const zip = await JSZip.loadAsync(blob)
    expect(await zip.file('characters/A.png')?.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]))
  })
})
