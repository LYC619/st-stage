// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Sprite, SpritePack } from '../../core/types'
import { createSpriteActions, type SpriteActionContext } from './sprite-actions'

function createContext(initialPack: SpritePack, index = 0) {
  let pack = initialPack
  const context: SpriteActionContext = {
    getPack: () => pack,
    getSprite: () => pack.sprites[index] ?? null,
    commit: vi.fn((next) => {
      pack = next
    }),
    pickReplacement: vi.fn(),
    localize: vi.fn(async () => {}),
    refresh: vi.fn(),
    close: vi.fn(),
  }
  return { context, getPack: () => pack, setPack: (next: SpritePack) => { pack = next } }
}

function sprite(tag: string, overrides: Partial<Sprite> = {}): Sprite {
  return { tag, url: `https://img.test/${tag}.png`, ...overrides }
}

describe('createSpriteActions', () => {
  afterEach(() => vi.restoreAllMocks())

  it('returns the shared Chinese descriptors and disables local save for non-hosted sources', () => {
    const hosted = createContext({ id: 'p', name: '包', sprites: [sprite('微笑')] })
    const local = createContext({ id: 'p', name: '包', sprites: [sprite('微笑', { url: '/user/a.png' })] })

    expect(createSpriteActions(hosted.context).map(({ id, label }) => [id, label])).toEqual([
      ['rename', '重命名'],
      ['labels', '标签'],
      ['group', '设分组'],
      ['replace', '重新上传 / 替换图片'],
      ['localize', '保存到本地'],
      ['remote', '远程地址'],
      ['cover', '设为封面'],
      ['delete', '删除'],
    ])
    expect(createSpriteActions(hosted.context).find((action) => action.id === 'localize')?.disabled).toBe(false)
    expect(createSpriteActions(local.context).find((action) => action.id === 'localize')?.disabled).toBe(true)
  })

  it('resolves the latest pack and sprite when renaming and normalizes comma-separated labels', () => {
    const state = createContext({ id: 'p', name: '包', sprites: [sprite('旧名')] })
    const actions = createSpriteActions(state.context)
    state.setPack({ id: 'p', name: '包', sprites: [sprite('新目标', { labels: ['旧标签'] })] })
    vi.spyOn(window, 'prompt')
      .mockReturnValueOnce('改名')
      .mockReturnValueOnce(' 动作,动作， ' + '长'.repeat(40))

    actions.find((action) => action.id === 'rename')!.run()
    actions.find((action) => action.id === 'labels')!.run()

    expect(state.getPack().sprites[0].tag).toBe('改名')
    expect(state.getPack().sprites[0].labels).toEqual(['动作', '长'.repeat(32)])
    expect(state.context.commit).toHaveBeenCalledTimes(2)
  })

  it('preserves core group errors and delegates replacement and hosted localization', async () => {
    const state = createContext({
      id: 'p',
      name: '包',
      sprites: [sprite('微笑'), sprite('微笑', { group: '目标组' })],
    })
    const actions = createSpriteActions(state.context)
    vi.spyOn(window, 'prompt').mockReturnValue('目标组')

    expect(() => actions.find((action) => action.id === 'group')!.run()).toThrow(
      '分组「目标组」中已存在表情「微笑」',
    )
    actions.find((action) => action.id === 'replace')!.run()
    await actions.find((action) => action.id === 'localize')!.run()

    expect(state.context.pickReplacement).toHaveBeenCalledTimes(1)
    expect(state.context.localize).toHaveBeenCalledTimes(1)
  })

  it('shows the current remote address, sets cover, and deletes from current state', () => {
    const state = createContext({
      id: 'p',
      name: '包',
      sprites: [sprite('微笑', { code: 'abc.png', remoteUrl: 'https://remote.test/a.png' })],
    })
    const actions = createSpriteActions(state.context)
    const prompt = vi.spyOn(window, 'prompt').mockReturnValue(null)
    vi.spyOn(window, 'confirm').mockReturnValue(true)

    actions.find((action) => action.id === 'remote')!.run()
    actions.find((action) => action.id === 'cover')!.run()
    expect(state.getPack().coverTag).toBe('微笑')
    actions.find((action) => action.id === 'delete')!.run()

    expect(prompt).toHaveBeenCalledWith(expect.stringContaining('abc.png'), 'https://remote.test/a.png')
    expect(state.getPack().sprites).toEqual([])
    expect(state.context.close).toHaveBeenCalledTimes(1)
  })
})
