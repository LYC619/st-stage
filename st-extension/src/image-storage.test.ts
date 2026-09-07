import { describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '../../core/types'
import { getPresetPacks } from '../../core/presets'
import { scanEmbeddedImages } from '../../core/image-storage'
import { prepareImportedPack, stageEmbeddedImages } from './image-storage'

const one = 'data:image/gif;base64,QUFB'
const two = 'data:image/png;base64,QkJC'
const pack = () => ({ id: 'p', name: '导入', inventoryPrompt: '保留', sprites: [{ tag: '一', url: one }, { tag: '二', url: two }, { tag: '三', url: one }] })
const candidates = () => scanEmbeddedImages({ ...createDefaultSettings(), packs: [pack()] }).candidates

describe('image staging', () => {
  it('passes original GIF bytes, serializes uploads and deduplicates per operation', async () => {
    let active = 0
    const save = vi.fn(async () => { active++; expect(active).toBe(1); await Promise.resolve(); active--; return '/user/images/a%23b.gif' })
    const result = await stageEmbeddedImages(candidates(), { save })
    expect(save).toHaveBeenCalledTimes(2)
    expect(save).toHaveBeenNthCalledWith(1, one, { signal: undefined })
    expect(result.ready).toHaveLength(3)
    expect(result.ready[0].nextUrl).toBe('/user/images/a%23b.gif')
    expect(result.failed).toHaveLength(0)
  })

  it('continues distinct images after failure but never returns a half-imported pack', async () => {
    const save = vi.fn().mockRejectedValueOnce(new Error('HTTP 413')).mockResolvedValue('/user/images/b.png')
    const result = await stageEmbeddedImages(candidates(), { save })
    expect(result.ready).toHaveLength(1)
    expect(result.failed).toHaveLength(2)
    expect(save).toHaveBeenCalledTimes(2)
    const source = pack()
    const fail = vi.fn().mockResolvedValueOnce('/user/images/a.gif').mockRejectedValue(new Error('HTTP 500'))
    await expect(prepareImportedPack(source, { save: fail })).rejects.toThrow('未安装')
    expect(source.sprites[0].url).toBe(one)
  })

  it.each(['data:image/png;base64,AA==', 'https://test/a.png', '', '/scripts/extensions/a.png'])('rejects false success path %s', async url => {
    await expect(prepareImportedPack(pack(), { save: vi.fn(async () => url) })).rejects.toThrow('未安装')
  })

  it('discards staged successes on cancellation and never starts the next upload', async () => {
    const controller = new AbortController()
    const save = vi.fn(async () => '/user/images/a.gif')
    const result = await stageEmbeddedImages(candidates(), { save }, {
      signal: controller.signal, onProgress: () => controller.abort(),
    })
    expect(result.cancelled).toBe(true)
    expect(result.ready).toHaveLength(0)
    expect(save).toHaveBeenCalledOnce()
  })

  it('does not return even a remote pack after cancellation', async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(prepareImportedPack({ ...pack(), sprites: [] }, { save: vi.fn() }, { signal: controller.signal }))
      .rejects.toThrow('未安装')
  })

  it('prepares a whole pack, skips remote uploads and rejects reserved preset IDs', async () => {
    const save = vi.fn(async () => '/user/images/saved.gif')
    const prepared = await prepareImportedPack(pack(), { save })
    expect(prepared.inventoryPrompt).toBe('保留')
    expect(prepared.sprites.every(s => s.url === '/user/images/saved.gif')).toBe(true)
    save.mockClear()
    const remote = { ...pack(), sprites: [{ tag: '远程', url: 'https://test/a.png' }] }
    expect(await prepareImportedPack(remote, { save })).toEqual(remote)
    expect(save).not.toHaveBeenCalled()
    await expect(prepareImportedPack({ ...pack(), id: getPresetPacks()[0].id }, { save })).rejects.toThrow('预设')
  })
})
