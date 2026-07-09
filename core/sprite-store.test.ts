import { describe, expect, it } from 'vitest'
import type { SpritePack } from './types'
import { getPackCover, getSpriteSource } from './types'
import { matchSprite, matchSprites, moveSprite, removeSprite, renameSprite, upsertSprite } from './sprite-store'

function pack(): SpritePack {
  return {
    id: 'p1',
    name: '包',
    coverTag: '害羞',
    sprites: [
      { tag: '微笑', url: 'u1' },
      { tag: '害羞', url: 'u2' },
      { tag: '恼怒', url: 'u3' },
    ],
  }
}

describe('getSpriteSource / getPackCover', () => {
  it('按 url 推导图源', () => {
    expect(getSpriteSource({ tag: 'a', url: 'data:image/png;base64,x' })).toBe('embedded')
    expect(getSpriteSource({ tag: 'a', url: 'https://x.com/a.png' })).toBe('hosted')
    expect(getSpriteSource({ tag: 'a', url: '/user/images/a.png' })).toBe('local')
  })

  it('封面：coverTag 优先，缺省第一张，空包 null', () => {
    expect(getPackCover(pack())!.tag).toBe('害羞')
    expect(getPackCover({ ...pack(), coverTag: undefined })!.tag).toBe('微笑')
    expect(getPackCover({ ...pack(), coverTag: '不存在' })!.tag).toBe('微笑')
    expect(getPackCover({ id: 'e', name: 'e', sprites: [] })).toBeNull()
  })
})

describe('matchSprite 模糊回退', () => {
  it('精确 → 子串 → null', () => {
    expect(matchSprite(pack(), '微笑')!.url).toBe('u1')
    expect(matchSprite(pack(), '有点害羞')!.url).toBe('u2')
    expect(matchSprite(pack(), '开心')).toBeNull()
  })
})

describe('matchSprites 序列（功能③）', () => {
  it('多标签保序映射，跳过未命中', () => {
    expect(matchSprites(pack(), ['微笑', '恼怒', '开心']).map((s) => s.tag)).toEqual(['微笑', '恼怒'])
  })
  it('折叠相邻重复，但保留往返 A→B→A', () => {
    expect(matchSprites(pack(), ['微笑', '微笑', '害羞', '微笑']).map((s) => s.tag)).toEqual([
      '微笑',
      '害羞',
      '微笑',
    ])
  })
  it('全部未命中返回空数组', () => {
    expect(matchSprites(pack(), ['开心', '生气'])).toEqual([])
  })
})

describe('单张立绘操作', () => {
  it('upsertSprite：新 tag 追加，同 tag 覆盖', () => {
    const added = upsertSprite(pack(), { tag: '哭泣', url: 'u4' })
    expect(added.sprites).toHaveLength(4)
    expect(added.updatedAt).toBeTruthy()

    const replaced = upsertSprite(pack(), { tag: '微笑', url: 'new' })
    expect(replaced.sprites).toHaveLength(3)
    expect(replaced.sprites[0].url).toBe('new')
  })

  it('removeSprite：删除并清理指向它的 coverTag', () => {
    const removed = removeSprite(pack(), '害羞')
    expect(removed.sprites.map((s) => s.tag)).toEqual(['微笑', '恼怒'])
    expect(removed.coverTag).toBeUndefined()

    const keepCover = removeSprite(pack(), '微笑')
    expect(keepCover.coverTag).toBe('害羞')
  })

  it('renameSprite：改名并同步 coverTag；非法/重名抛错', () => {
    const renamed = renameSprite(pack(), '害羞', '娇羞')
    expect(renamed.sprites[1].tag).toBe('娇羞')
    expect(renamed.coverTag).toBe('娇羞')

    expect(() => renameSprite(pack(), '微笑', '害羞')).toThrow('已存在')
    expect(() => renameSprite(pack(), '微笑', '|||')).toThrow('表情名')
    expect(renameSprite(pack(), '微笑', '微笑')).toEqual(pack())
  })

  it('moveSprite：合法移动生效，越界原样返回', () => {
    expect(moveSprite(pack(), 0, 2).sprites.map((s) => s.tag)).toEqual(['害羞', '恼怒', '微笑'])
    expect(moveSprite(pack(), 2, 0).sprites.map((s) => s.tag)).toEqual(['恼怒', '微笑', '害羞'])
    expect(moveSprite(pack(), 0, 9)).toEqual(pack())
    expect(moveSprite(pack(), -1, 1)).toEqual(pack())
  })
})
