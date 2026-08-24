// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import JSZip from 'jszip'
import { downloadSTBackup } from './zip'

describe('cloud export zip', () => {
  it('reports progress and downloads a zip blob', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:test')
    const revokeObjectURL = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const progress: number[] = []
    await downloadSTBackup([{ path: 'settings.json', data: '{"extensions":{}}' }], 'test.zip', ({ percent }) => progress.push(percent))
    expect(progress.length).toBeGreaterThan(0)
    expect(createObjectURL).toHaveBeenCalledOnce()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:test')
    expect(click).toHaveBeenCalledOnce()
    createObjectURL.mockRestore()
    revokeObjectURL.mockRestore()
    click.mockRestore()
  })

  it('creates a readable zip with the requested path', async () => {
    const createObjectURL = vi.spyOn(URL, 'createObjectURL').mockImplementation((blob) => {
      void blob
      return 'blob:test'
    })
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {})
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    await downloadSTBackup([{ path: 'characters/A.png', data: new Uint8Array([1, 2, 3]) }], 'test.zip', () => {})
    expect(createObjectURL).toHaveBeenCalledOnce()
    const blob = createObjectURL.mock.calls[0][0] as Blob
    const zip = await JSZip.loadAsync(blob)
    expect(await zip.file('characters/A.png')?.async('uint8array')).toEqual(new Uint8Array([1, 2, 3]))
    vi.restoreAllMocks()
  })
})
