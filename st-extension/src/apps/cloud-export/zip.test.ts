// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { buildCharacterFiles } from './manifest'
import { downloadSTBackup, REVOKE_DELAY_MS } from './zip'

afterEach(() => {
  vi.restoreAllMocks()
})

/** 立即回收，避免测试留下 60 秒的悬挂定时器。 */
const immediateRevoke = { scheduleRevoke: (revoke: () => void) => { revoke() } }

describe('cloud export zip', () => {
  it('cancels during compression without creating a blob download', async () => {
    const create = vi.spyOn(URL, 'createObjectURL')
    const controller = new AbortController()
    await expect(downloadSTBackup([{ path: 'large.json', data: 'hello'.repeat(20000) }], 'cancelled.zip', () => controller.abort(), {
      ...immediateRevoke, signal: controller.signal,
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(create).not.toHaveBeenCalled()
  })

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


describe('archive collision guard', () => {
  it.each([
    ['characters/A.png', 'characters/A.png'], ['chats/A/a.jsonl', 'chats/A/a.jsonl'],
    ['worlds/a.json', 'worlds/a.json'], ['OpenAI Settings/a.json', 'OpenAI Settings/a.json'],
    ['settings.json', 'settings.json'], ['worlds/World.json', 'worlds/world.json'],
    ['worlds/é.json', 'worlds/e\u0301.json'], ['a', 'a/x'], ['a/x', 'A'],
  ])('rejects conflicting paths %s and %s before download', async (a, b) => {
    const create = vi.spyOn(URL, 'createObjectURL')
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await expect(downloadSTBackup([{ path: a, data: 'a' }, { path: b, data: 'b' }], 'backup', vi.fn(), immediateRevoke)).rejects.toThrow('备份路径冲突')
    expect(create).not.toHaveBeenCalled()
    expect(click).not.toHaveBeenCalled()
  })

  it.each(['/a', '../a', 'a//b', 'a/./b', 'a/../b', 'a\\b', 'a/b.', 'a/b ', 'a/CON.json', 'a/LPT1', 'a/x:y', 'a/x?y', 'a/\u007f'])('rejects unsafe path %s before download', async path => {
    const create = vi.spyOn(URL, 'createObjectURL')
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await expect(downloadSTBackup([{ path, data: 'x' }], 'backup', vi.fn(), immediateRevoke)).rejects.toThrow('备份路径不合法')
    expect(create).not.toHaveBeenCalled()
  })

  it('round trips both same-display-name characters and their distinct chat bytes through real JSZip', async () => {
    const files = [1, 2].flatMap(n => buildCharacterFiles({ id: 'c' + n, name: 'Alice', avatar: 'Alice' + n + '.png',
      chats: [{ id: 'h' + n, name: 'display', path: 'first.jsonl' }] }, new Uint8Array([n]), new Map([['h' + n, String(n)]]), {
      characterIds: new Set(['c1', 'c2']), chatIds: new Set(['h1', 'h2']), worldbookIds: new Set(), presetIds: new Set(), regex: false,
    }))
    const create = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await downloadSTBackup(files, 'backup', vi.fn(), immediateRevoke)
    const zip = await JSZip.loadAsync(create.mock.calls[0][0] as Blob)
    expect(Object.values(zip.files).filter(file => !file.dir)).toHaveLength(4)
    expect(await zip.file('chats/Alice1/first.jsonl')?.async('string')).toBe('1')
    expect(await zip.file('chats/Alice2/first.jsonl')?.async('string')).toBe('2')
  })
})
