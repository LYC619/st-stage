import { describe, expect, it } from 'vitest'
import type { SpritePack, SpritePackFile, SpritePackFileV3 } from './types'
import { exportPack, importPack } from './pack-io'

const V1_JSON = JSON.stringify({
  format: 'sprite-pack@1',
  name: '旧版包',
  author: '老作者',
  sprites: [
    { tag: '微笑', url: 'https://files.catbox.moe/ab12cd.png' },
    { tag: '害羞', data: 'data:image/png;base64,AAA' },
  ],
})

describe('importPack', () => {
  it('导入 @1 并自动升级（图床 URL 反推 code）', () => {
    const pack = importPack(V1_JSON)
    expect(pack.name).toBe('旧版包')
    expect(pack.sprites).toEqual([
      { tag: '微笑', url: 'https://files.catbox.moe/ab12cd.png', code: 'ab12cd.png' },
      { tag: '害羞', url: 'data:image/png;base64,AAA' },
    ])
    expect(pack.updatedAt).toBeTruthy()
  })

  it('导入 @2（保留 code 与 coverTag）', () => {
    const file: SpritePackFile = {
      format: 'sprite-pack@2',
      name: '新版包',
      coverTag: '害羞',
      sprites: [
        { tag: '微笑', url: 'https://x.com/a.png', code: 'a.png' },
        { tag: '害羞', data: 'data:image/png;base64,BBB' },
      ],
    }
    const pack = importPack(JSON.stringify(file))
    expect(pack.coverTag).toBe('害羞')
    expect(pack.sprites[0].code).toBe('a.png')
  })

  it('清洗恶意包名与 tag，跳过重复/空 tag', () => {
    const pack = importPack(
      JSON.stringify({
        format: 'sprite-pack@2',
        name: '<img src=x onerror=alert(1)>包',
        sprites: [
          { tag: '[微笑]', url: 'https://x.com/a.png' },
          { tag: '微笑', url: 'https://x.com/b.png' },
          { tag: '|||', url: 'https://x.com/c.png' },
        ],
      }),
    )
    expect(pack.name).not.toContain('<')
    // "[微笑]" 清洗后与 "微笑" 相同 → 第二条视为重复被跳过
    expect(pack.sprites).toHaveLength(1)
    expect(pack.sprites[0]).toEqual({ tag: '微笑', url: 'https://x.com/a.png', code: 'a.png' })
  })

  it('非法输入抛中文错误', () => {
    expect(() => importPack('not json')).toThrow('JSON')
    expect(() => importPack('{"format":"other"}')).toThrow('格式')
    expect(() => importPack('{"format":"sprite-pack@2","name":"","sprites":[]}')).toThrow('缺少')
  })
})

describe('exportPack', () => {
  it('导出 @3：图床 URL 保持轻量并带 code，data 图源内嵌', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '导出包',
      coverTag: '微笑',
      sprites: [
        { tag: '微笑', url: 'https://files.catbox.moe/ab12cd.png' },
        { tag: '害羞', url: 'data:image/png;base64,CCC' },
      ],
    }
    const file: SpritePackFileV3 = await exportPack(pack)
    expect(file.format).toBe('sprite-pack@3')
    expect(file.coverTag).toBe('微笑')
    expect(file.exportedAt).toBeTruthy()
    expect(file.sprites).toEqual([
      { tag: '微笑', url: 'https://files.catbox.moe/ab12cd.png', code: 'ab12cd.png' },
      { tag: '害羞', data: 'data:image/png;base64,CCC' },
    ])
  })

  it('本地路径图源尝试内嵌，fetch 失败时回退原路径（不丢条目）', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '本地包',
      sprites: [{ tag: '微笑', url: '/user/images/sprite-overlay/a.png' }],
    }
    // node 环境 fetch 相对路径必然失败 → 走回退分支
    const file = await exportPack(pack)
    expect(file.sprites).toEqual([{ tag: '微笑', url: '/user/images/sprite-overlay/a.png' }])
  })

  it('roundtrip：导出再导入内容一致', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '回环包',
      sprites: [{ tag: '微笑', url: 'https://x.com/a.png' }],
    }
    const reimported = importPack(JSON.stringify(await exportPack(pack)))
    expect(reimported.name).toBe('回环包')
    expect(reimported.sprites[0].tag).toBe('微笑')
    expect(reimported.sprites[0].url).toBe('https://x.com/a.png')
  })

  it('roundtrip：@3 保留图库提示与立绘标签', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '图库元数据包',
      promptNote: '角色提示',
      promptNotePlacement: 'after-list',
      outfitNotes: { 居家服: '居家提示' },
      sourceStoryKey: 'story-gallery-001',
      kind: 'illustration',
      customTags: ['剧情', 'CG'],
      sprites: [
        { tag: '微笑', url: 'https://x.com/a.png', labels: ['动作', '近景'] },
      ],
    }
    const exported: SpritePackFileV3 = await exportPack(pack)
    const reimported = importPack(JSON.stringify(exported))
    expect(exported.format).toBe('sprite-pack@3')
    expect(exported.sourceStoryKey).toBe('story-gallery-001')
    expect(reimported.promptNote).toBe('角色提示')
    expect(reimported.promptNotePlacement).toBe('after-list')
    expect(reimported.outfitNotes).toEqual({ 居家服: '居家提示' })
    expect(reimported.sourceStoryKey).toBe('story-gallery-001')
    expect(reimported.kind).toBe('illustration')
    expect(reimported.customTags).toEqual(['剧情', 'CG'])
    expect(reimported.sprites[0].labels).toEqual(['动作', '近景'])
  })

  it('@3 导出与导入共享元数据边界规范化并忽略无效值', async () => {
    const prefix = 'a'.repeat(32)
    const rawLabels: unknown[] = [
      `${prefix}x`,
      `${prefix}y`,
      `${'😀'.repeat(32)}x`,
      null,
      7,
      ...Array.from({ length: 30 }, (_, index) => ` label-${index} `),
    ]
    const rawOutfitNotes = JSON.parse(
      '{"__proto__":" prototype note ","toString":" method note ","empty":"   "}',
    ) as Record<string, string>
    const pack = {
      id: 'p1',
      name: '边界元数据包',
      promptNote: `${'😀'.repeat(500)}x`,
      promptNotePlacement: 'sideways',
      outfitNotes: rawOutfitNotes,
      sprites: [{ tag: '微笑', url: 'https://x.com/a.png', labels: rawLabels }],
    } as unknown as SpritePack

    const exported = await exportPack(pack)
    const imported = importPack(
      JSON.stringify({
        ...exported,
        promptNotePlacement: 'sideways',
        sprites: [{ ...exported.sprites[0], labels: rawLabels }],
      }),
    )

    expect(exported.promptNotePlacement).toBeUndefined()
    expect(imported.promptNotePlacement).toBeUndefined()
    expect(exported.promptNote).toBe('😀'.repeat(500))
    expect(imported.promptNote).toBe(exported.promptNote)
    expect(exported.sprites[0].labels).toHaveLength(24)
    expect(imported.sprites[0].labels).toEqual(exported.sprites[0].labels)
    expect(exported.sprites[0].labels?.slice(0, 2)).toEqual([prefix, '😀'.repeat(32)])
    expect(exported.sprites[0].labels?.every((label) => Array.from(label).length <= 32)).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(exported.outfitNotes, '__proto__')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(imported.outfitNotes, '__proto__')).toBe(true)
    expect(exported.outfitNotes?.['__proto__']).toBe('prototype note')
    expect(imported.outfitNotes?.toString).toBe('method note')
  })
})

describe('remoteUrl 导入导出（阶段7）', () => {
  it('导出保留合法 HTTPS remoteUrl，本地 data 与 remoteUrl 并存', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '远程包',
      sprites: [
        // 本地 data URI（显示保底）+ 远程直链（分享用）
        { tag: '微笑', url: 'data:image/webp;base64,AAA', remoteUrl: 'https://i.ibb.co/x/a.png', code: 'a.png' },
      ],
    }
    const file = await exportPack(pack)
    expect(file.sprites[0]).toEqual({
      tag: '微笑',
      data: 'data:image/webp;base64,AAA',
      remoteUrl: 'https://i.ibb.co/x/a.png',
    })
  })

  it('导出丢弃非 HTTPS remoteUrl', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '包',
      sprites: [{ tag: '微笑', url: 'https://x.com/a.png', remoteUrl: 'http://i.ibb.co/x/a.png' }],
    }
    const file = await exportPack(pack)
    expect(file.sprites[0].remoteUrl).toBeUndefined()
  })

  it('导入校验 remoteUrl：接受 http/https，丢弃非法值', () => {
    const file = {
      format: 'sprite-pack@2',
      name: '包',
      sprites: [
        { tag: 'a', data: 'data:image/png;base64,AAA', remoteUrl: 'https://i.ibb.co/a.png' },
        { tag: 'b', data: 'data:image/png;base64,BBB', remoteUrl: 'http://i.ibb.co/b.png' },
        { tag: 'c', data: 'data:image/png;base64,CCC', remoteUrl: 'javascript:alert(1)' },
        { tag: 'd', data: 'data:image/png;base64,DDD', remoteUrl: 42 },
      ],
    }
    const pack = importPack(JSON.stringify(file))
    const byTag = Object.fromEntries(pack.sprites.map((s) => [s.tag, s.remoteUrl]))
    expect(byTag.a).toBe('https://i.ibb.co/a.png')
    expect(byTag.b).toBe('http://i.ibb.co/b.png')
    expect(byTag.c).toBeUndefined() // 非法协议丢弃
    expect(byTag.d).toBeUndefined() // 非字符串丢弃
  })

  it('JSON round-trip 不丢 remoteUrl（本地 url + remoteUrl 都保留）', async () => {
    const pack: SpritePack = {
      id: 'p1',
      name: '回环远程包',
      sprites: [
        { tag: '微笑', url: 'data:image/webp;base64,ZZZ', remoteUrl: 'https://i.ibb.co/x/z.png', code: 'z.png' },
      ],
    }
    const reimported = importPack(JSON.stringify(await exportPack(pack)))
    expect(reimported.sprites[0].url).toBe('data:image/webp;base64,ZZZ') // 本地保底显示
    expect(reimported.sprites[0].remoteUrl).toBe('https://i.ibb.co/x/z.png') // 分享用
  })

  it('@1 无 remoteUrl 字段仍可导入', () => {
    const pack = importPack(V1_JSON)
    expect(pack.sprites.every((s) => s.remoteUrl === undefined)).toBe(true)
  })
})
