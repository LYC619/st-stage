import { describe, expect, it } from 'vitest'
import type { SpritePack } from './types'
import { DEFAULT_IMAGE_HOST } from './types'
import {
  decodeShareString,
  decodeShareStringV2,
  encodeShareString,
  encodeShareStringV2,
  extractImageCode,
  isValidImageCode,
  SHARE_PREFIX,
  SHARE_PREFIX_V2,
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

/* ==================== stpack2 ==================== */

function v2Pack(): SpritePack {
  return {
    id: 'p1',
    name: '多角色包',
    author: '作者A',
    sprites: [
      { tag: '微笑', url: 'https://i.ibb.co/aa1/smile.png', remoteUrl: 'https://i.ibb.co/aa1/smile.png', group: '鸣人', outfit: '居家服' },
      { tag: '生气', url: '/user/local/angry.png', remoteUrl: 'https://i.ibb.co/bb2/angry.png', group: '鸣人' },
      { tag: '冷漠', url: 'https://i.ibb.co/cc3/cold.png' },
    ],
  }
}

describe('encodeShareStringV2', () => {
  it('每图独立完整 URL，含三级地址', () => {
    const r = encodeShareStringV2(v2Pack())!
    expect(r.text.startsWith(SHARE_PREFIX_V2)).toBe(true)
    expect(r.text).toContain('鸣人/居家服/微笑=https://i.ibb.co/aa1/smile.png')
    expect(r.text).toContain('鸣人/生气=https://i.ibb.co/bb2/angry.png') // remoteUrl 优先于本地 url
    expect(r.text).toContain('冷漠=https://i.ibb.co/cc3/cold.png')
    expect(r.included).toBe(3)
    expect(r.total).toBe(3)
    expect(r.missing).toEqual([])
  })

  it('完整性预检：无远程地址的图计入 missing，不静默丢弃', () => {
    const pack = v2Pack()
    pack.sprites.push({ tag: '本地', url: '/user/local/x.png', group: '鸣人' })
    pack.sprites.push({ tag: '内嵌', url: 'data:image/png;base64,xxx' })
    const r = encodeShareStringV2(pack)!
    expect(r.included).toBe(3)
    expect(r.total).toBe(5)
    expect(r.missing).toEqual(['鸣人/本地', '内嵌'])
  })

  it('全部无远程地址返回 null', () => {
    expect(
      encodeShareStringV2({ id: 'x', name: 'x', sprites: [{ tag: 'a', url: '/user/a.png' }] }),
    ).toBeNull()
  })
})

describe('decodeShareStringV2 roundtrip', () => {
  it('编码后解码回等价（三级地址、独立 URL、remoteUrl）', () => {
    const encoded = encodeShareStringV2(v2Pack())!
    const decoded = decodeShareStringV2(encoded.text)
    expect(decoded.name).toBe('多角色包')
    expect(decoded.author).toBe('作者A')
    expect(decoded.id).not.toBe('p1')
    // 鸣人/居家服/微笑
    const smile = decoded.sprites.find((s) => s.tag === '微笑')!
    expect(smile).toMatchObject({
      tag: '微笑',
      group: '鸣人',
      outfit: '居家服',
      url: 'https://i.ibb.co/aa1/smile.png',
      remoteUrl: 'https://i.ibb.co/aa1/smile.png',
    })
    // 无人名/服装的 冷漠
    const cold = decoded.sprites.find((s) => s.tag === '冷漠')!
    expect(cold.group).toBeUndefined()
    expect(cold.outfit).toBeUndefined()
  })

  it('URL 含 query（=）时按首个 = 拆分，URL 完整保留', () => {
    const decoded = decodeShareStringV2(`${SHARE_PREFIX_V2}包|微笑=https://h.com/a.png?w=1&h=2`)
    expect(decoded.sprites[0].url).toBe('https://h.com/a.png?w=1&h=2')
  })

  it('拒绝非 http(s) URL（防注入），去重同地址', () => {
    const decoded = decodeShareStringV2(
      `${SHARE_PREFIX_V2}包|微笑=javascript:alert(1)|害羞=https://h.com/b.png|害羞=https://h.com/dup.png`,
    )
    expect(decoded.sprites).toHaveLength(1)
    expect(decoded.sprites[0].tag).toBe('害羞')
    expect(decoded.sprites[0].url).toBe('https://h.com/b.png')
  })

  it('decodeShareString 自动识别 stpack2', () => {
    const encoded = encodeShareStringV2(v2Pack())!
    const decoded = decodeShareString(`抄作业 ${encoded.text}`)
    expect(decoded.name).toBe('多角色包')
    expect(decoded.sprites.length).toBe(3)
  })

  it('decodeShareString 仍兼容 stpack1', () => {
    const decoded = decodeShareString(`${SHARE_PREFIX}老包|微笑=ab12cd.png`)
    expect(decoded.sprites[0].code).toBe('ab12cd.png')
  })
})
