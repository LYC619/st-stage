import { describe, expect, it } from 'vitest'
import type { SpritePack } from './types'
import { DEFAULT_IMAGE_HOST } from './types'
import {
  decodeShareString,
  encodeShareString,
  extractImageCode,
  isValidImageCode,
  SHARE_PREFIX,
} from './share-code'

function hostedPack(): SpritePack {
  return {
    id: 'p1',
    name: '测试包',
    author: '作者A',
    sprites: [
      { tag: '微笑', url: `${DEFAULT_IMAGE_HOST}ab12cd.png`, code: 'ab12cd.png' },
      { tag: '害羞', url: `${DEFAULT_IMAGE_HOST}xy34zw.webp`, code: 'xy34zw.webp' },
    ],
  }
}

describe('isValidImageCode / extractImageCode', () => {
  it('接受常见图床文件名', () => {
    expect(isValidImageCode('ab12cd.png')).toBe(true)
    expect(isValidImageCode('a_b-c.1.webp')).toBe(true)
  })

  it('拒绝路径与非法字符', () => {
    expect(isValidImageCode('../x.png')).toBe(false)
    expect(isValidImageCode('a/b.png')).toBe(false)
    expect(isValidImageCode('')).toBe(false)
    expect(isValidImageCode('.hidden')).toBe(false)
  })

  it('从 URL 提取最后一段（忽略 query/hash）', () => {
    expect(extractImageCode('https://files.catbox.moe/ab12cd.png')).toBe('ab12cd.png')
    expect(extractImageCode('https://x.com/a/b/c.webp?t=1#f')).toBe('c.webp')
    expect(extractImageCode('/user/images/local.png')).toBeNull()
    expect(extractImageCode('data:image/png;base64,xxx')).toBeNull()
  })
})

describe('encodeShareString', () => {
  it('默认图床省略 @host，含作者与全部条目', () => {
    const result = encodeShareString(hostedPack())
    expect(result).not.toBeNull()
    expect(result!.text).toBe(
      `${SHARE_PREFIX}测试包|@author=作者A|微笑=ab12cd.png|害羞=xy34zw.webp`,
    )
    expect(result!.included).toBe(2)
    expect(result!.skipped).toEqual([])
  })

  it('非默认图床写入 @host', () => {
    const pack = hostedPack()
    pack.sprites = pack.sprites.map((s) => ({
      ...s,
      url: `https://img.example.com/u/${s.code}`,
    }))
    const result = encodeShareString(pack)!
    expect(result.text).toContain('@host=https://img.example.com/u/')
  })

  it('本地/内嵌图源跳过并记录；全部不合格返回 null', () => {
    const pack = hostedPack()
    pack.sprites.push({ tag: '本地', url: '/user/images/a.png' })
    pack.sprites.push({ tag: '内嵌', url: 'data:image/png;base64,xxx' })
    const result = encodeShareString(pack)!
    expect(result.included).toBe(2)
    expect(result.skipped).toEqual(['本地', '内嵌'])

    const allLocal: SpritePack = {
      id: 'p2',
      name: 'x',
      sprites: [{ tag: 'a', url: '/user/a.png' }],
    }
    expect(encodeShareString(allLocal)).toBeNull()
  })

  it('混合图床时以第一个前缀为准，其余跳过', () => {
    const pack = hostedPack()
    pack.sprites.push({
      tag: '别家',
      url: 'https://other.host/qq99.png',
      code: 'qq99.png',
    })
    const result = encodeShareString(pack)!
    expect(result.included).toBe(2)
    expect(result.skipped).toEqual(['别家'])
  })
})

describe('decodeShareString', () => {
  it('roundtrip：编码后可解码回等价包', () => {
    const encoded = encodeShareString(hostedPack())!
    const decoded = decodeShareString(encoded.text)
    expect(decoded.name).toBe('测试包')
    expect(decoded.author).toBe('作者A')
    expect(decoded.sprites).toEqual([
      { tag: '微笑', url: `${DEFAULT_IMAGE_HOST}ab12cd.png`, code: 'ab12cd.png' },
      { tag: '害羞', url: `${DEFAULT_IMAGE_HOST}xy34zw.webp`, code: 'xy34zw.webp' },
    ])
    expect(decoded.id).not.toBe('p1')
  })

  it('容忍前后杂文（聊天里复制常带说明文字）', () => {
    const text = `来抄作业！ ${SHARE_PREFIX}我的包|微笑=ab12cd.png `
    const decoded = decodeShareString(text)
    expect(decoded.name).toBe('我的包')
    expect(decoded.sprites).toHaveLength(1)
  })

  it('@host 写在条目之后也生效', () => {
    const decoded = decodeShareString(
      `${SHARE_PREFIX}包|微笑=ab12cd.png|@host=https://img.example.com/`,
    )
    expect(decoded.sprites[0].url).toBe('https://img.example.com/ab12cd.png')
  })

  it('跳过非法条目与重复 tag，全空则报错', () => {
    const decoded = decodeShareString(
      `${SHARE_PREFIX}包|微笑=ab12cd.png|微笑=dup.png|坏条目|=nope.png|坏码=../x.png`,
    )
    expect(decoded.sprites).toEqual([
      { tag: '微笑', url: `${DEFAULT_IMAGE_HOST}ab12cd.png`, code: 'ab12cd.png' },
    ])

    expect(() => decodeShareString('随便一句话')).toThrow('分享串')
    expect(() => decodeShareString(`${SHARE_PREFIX}只有包名`)).toThrow('条目')
  })

  it('拒绝非 http 的 @host（防 javascript: 注入）', () => {
    const decoded = decodeShareString(
      `${SHARE_PREFIX}包|@host=javascript:alert(1)//|微笑=ab12cd.png`,
    )
    expect(decoded.sprites[0].url).toBe(`${DEFAULT_IMAGE_HOST}ab12cd.png`)
  })
})
