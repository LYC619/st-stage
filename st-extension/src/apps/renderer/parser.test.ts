import { describe, expect, it } from 'vitest'
import { parseRendererBlock } from './parser'

function wrap(value: unknown): string {
  return `<STStageRender>${JSON.stringify(value)}</STStageRender>`
}

function expectInvalid(value: unknown, message: RegExp): void {
  const result = parseRendererBlock(wrap(value))
  expect(result).toMatchObject({ ok: false, found: true })
  if (!result.ok) expect(result.error).toMatch(message)
}

const fighter = {
  id: 'hero',
  name: '旅行者',
  hp: 80,
  maxHp: 100,
  mp: 30,
  maxMp: 50,
  attack: 18,
  defense: 8,
  speed: 12,
  crit: 10,
  dodge: 5,
  skills: [{ id: 'slash', name: '斩击', type: 'damage', mpCost: 5, power: 20 }],
  items: [{ id: 'potion', name: '药水', effect: 'heal_hp', quantity: 2, power: 25 }],
  statuses: [{ id: 'focus', name: '专注', duration: 2, attackDelta: 3 }],
}

const bareBlocks = [
  {
    name: 'Galgame',
    value: { version: 1, mode: 'gal', scene: '月台', beats: [{ speaker: '小雪', text: '你好' }] },
  },
  {
    name: '卡片选择',
    value: {
      version: 1,
      mode: 'cards',
      title: '选择',
      cards: [
        { id: 'forward', title: '前进', description: '继续探索', action: '我选择前进' },
        { id: 'rest', title: '休息', description: '恢复体力', action: '我选择休息' },
      ],
    },
  },
  {
    name: '战斗',
    value: {
      version: 1,
      mode: 'battle',
      title: '遗迹守卫战',
      player: fighter,
      enemy: { ...fighter, id: 'guard', name: '遗迹守卫' },
    },
  },
] as const

describe('parseRendererBlock', () => {
  it('解析合法 Galgame 块', () => {
    const result = parseRendererBlock(
      wrap({
        version: 1,
        mode: 'gal',
        title: '雨夜重逢',
        scene: '车站月台',
        background: 'https://example.test/station.webp',
        beats: [
          { speaker: '小雪', text: '你终于来了。', portrait: '/user/images/xiaoxue.png' },
          { speaker: '我', text: '抱歉，让你久等了。' },
        ],
      }),
    )

    expect(result).toMatchObject({ ok: true, block: { version: 1, mode: 'gal', title: '雨夜重逢' } })
  })

  it('解析合法卡片选择块', () => {
    const result = parseRendererBlock(
      `before\n${wrap({
        version: 1,
        mode: 'cards',
        title: '选择',
        cards: [
          { id: 'forward', title: '前进', description: '继续探索', action: '我选择前进' },
          { id: 'rest', title: '休息', description: '恢复体力', consequence: '时间会推进', action: '我选择休息' },
        ],
      })}\nafter`,
    )

    expect(result).toMatchObject({ ok: true, block: { mode: 'cards', title: '选择' } })
  })

  it('解析合法战斗块', () => {
    const result = parseRendererBlock(
      wrap({
        version: 1,
        mode: 'battle',
        title: '遗迹守卫战',
        background: 'assets/ruins.webp',
        player: fighter,
        enemy: { ...fighter, id: 'guard', name: '遗迹守卫', items: [] },
        enemyIntent: '蓄力攻击',
        allowFlee: true,
      }),
    )

    expect(result).toMatchObject({ ok: true, block: { mode: 'battle', player: { id: 'hero' }, enemy: { id: 'guard' } } })
  })

  it('无块时返回 found=false', () => {
    expect(parseRendererBlock('普通回复')).toEqual({ ok: false, found: false })
  })

  it.each(bareBlocks)('保守恢复唯一裸 $name JSON', ({ value }) => {
    const raw = JSON.stringify(value)

    expect(parseRendererBlock(raw)).toMatchObject({ ok: true, raw, block: { mode: value.mode } })
  })

  it('裸 JSON 只返回候选切片并保留块外正文', () => {
    const raw = JSON.stringify(bareBlocks[0].value)

    expect(parseRendererBlock(`前文\n${raw}\n后文`)).toMatchObject({ ok: true, raw })
  })

  it('字符串内的大括号和转义引号不会截断裸 JSON', () => {
    const value = {
      version: 1,
      mode: 'gal',
      scene: '门上写着 {请进}',
      beats: [{ speaker: '小雪', text: '她说："别把 } 当作结尾。"' }],
    }
    const raw = JSON.stringify(value)

    expect(parseRendererBlock(`前文 ${raw} 后文`)).toMatchObject({
      ok: true,
      raw,
      block: { mode: 'gal', scene: '门上写着 {请进}', beats: [{ text: '她说："别把 } 当作结尾。"' }] },
    })
  })

  it('两个合法裸对象存在歧义时拒绝恢复', () => {
    const first = JSON.stringify(bareBlocks[0].value)
    const second = JSON.stringify(bareBlocks[1].value)

    expect(parseRendererBlock(`${first}\n${second}`)).toEqual({ ok: false, found: false })
  })

  it('合法裸对象与无关对象并存时只接受合法候选', () => {
    const raw = JSON.stringify(bareBlocks[0].value)

    expect(parseRendererBlock(`配置：{"theme":"dark"}\n${raw}`)).toMatchObject({ ok: true, raw })
  })

  it('数组中的嵌套对象不作为顶层裸候选', () => {
    expect(parseRendererBlock(JSON.stringify([bareBlocks[0].value]))).toEqual({ ok: false, found: false })
  })

  it('孤立闭标签作为协议残片处理且不尝试裸 JSON', () => {
    const raw = JSON.stringify(bareBlocks[0].value)

    expect(parseRendererBlock(`${raw}</STStageRender>`)).toMatchObject({
      ok: false,
      found: true,
      error: expect.stringMatching(/标签|协议/),
    })
  })

  it.each(['<STStageRender', '</STStageRender'])(
    '不完整标签前缀 %s 也阻止裸 JSON 兜底',
    (fragment) => {
      const raw = JSON.stringify(bareBlocks[0].value)

      expect(parseRendererBlock(`${fragment}\n${raw}`)).toMatchObject({
        ok: false,
        found: true,
        error: expect.stringMatching(/标签|协议|未闭合/),
      })
    },
  )

  it('忽略超长裸对象和非协议 JSON，且不虚报 found=true', () => {
    const oversized = JSON.stringify({
      ...bareBlocks[0].value,
      beats: Array.from({ length: 50 }, (_, index) => ({ speaker: `角色${index}`, text: '界'.repeat(500) })),
    })

    expect(new TextEncoder().encode(oversized).byteLength).toBeGreaterThan(64 * 1024)
    expect(parseRendererBlock(oversized)).toEqual({ ok: false, found: false })
    expect(parseRendererBlock('{"theme":"dark","items":[{"id":1}]}')).toEqual({ ok: false, found: false })
  })

  it('拒绝未闭合、非法 JSON 和重复块', () => {
    const partial = parseRendererBlock('<STStageRender>{"version":1')
    expect(partial).toMatchObject({ ok: false, found: true, error: expect.stringMatching(/未闭合/) })

    const malformed = parseRendererBlock('<STStageRender>{bad}</STStageRender>')
    expect(malformed).toMatchObject({ ok: false, found: true, error: expect.stringMatching(/JSON/) })

    const valid = wrap({ version: 1, mode: 'cards', title: '选择', cards: [] })
    const duplicate = parseRendererBlock(`${valid}\n${valid}`)
    expect(duplicate).toMatchObject({ ok: false, found: true, error: expect.stringMatching(/一个/) })
  })

  it('拒绝不支持的版本和模式', () => {
    expectInvalid({ version: 2, mode: 'gal', scene: '场景', beats: [{ speaker: 'A', text: 'B' }] }, /version/)
    expectInvalid({ version: 1, mode: 'html', content: '<b>x</b>' }, /mode/)
  })

  it('拒绝缺失必填字段和未知字段', () => {
    expectInvalid({ version: 1, mode: 'gal', scene: '场景' }, /beats/)
    expectInvalid(
      {
        version: 1,
        mode: 'cards',
        title: '选择',
        cards: [
          { id: 'a', title: 'A', description: 'A', action: 'A' },
          { id: 'b', title: 'B', description: 'B', action: 'B', html: '<b>B</b>' },
        ],
      },
      /未知字段/,
    )
  })

  it('拒绝超长文本和超过 64 KiB 的 JSON', () => {
    expectInvalid({ version: 1, mode: 'gal', scene: '场景', beats: [{ speaker: 'A', text: 'x'.repeat(2001) }] }, /text/)
    const result = parseRendererBlock(
      `<STStageRender>${JSON.stringify({ version: 1, mode: 'gal', scene: 'x'.repeat(70_000), beats: [] })}</STStageRender>`,
    )
    expect(result).toMatchObject({ ok: false, found: true, error: expect.stringMatching(/64 KiB/) })
  })

  it('拒绝过多 Gal 节拍、卡片、技能、物品和初始状态', () => {
    expectInvalid(
      { version: 1, mode: 'gal', scene: '场景', beats: Array.from({ length: 51 }, () => ({ speaker: 'A', text: 'B' })) },
      /1-50/,
    )
    expectInvalid(
      {
        version: 1,
        mode: 'cards',
        title: '选择',
        cards: Array.from({ length: 9 }, (_, index) => ({ id: `c${index}`, title: 'A', description: 'B', action: 'C' })),
      },
      /2-8/,
    )
    for (const field of ['skills', 'items', 'statuses'] as const) {
      const over = Array.from({ length: 13 }, (_, index) =>
        field === 'skills'
          ? { id: `s${index}`, name: '技能', type: 'damage', mpCost: 0, power: 1 }
          : field === 'items'
            ? { id: `i${index}`, name: '物品', effect: 'heal_hp', quantity: 1, power: 1 }
            : { id: `t${index}`, name: '状态', duration: 1 },
      )
      expectInvalid(
        { version: 1, mode: 'battle', title: '战斗', player: { ...fighter, [field]: over }, enemy: fighter },
        /最多 12/,
      )
    }
  })

  it('拒绝负数、过大属性和不一致生命值', () => {
    expectInvalid({ version: 1, mode: 'battle', title: '战斗', player: { ...fighter, attack: -1 }, enemy: fighter }, /attack/)
    expectInvalid({ version: 1, mode: 'battle', title: '战斗', player: { ...fighter, defense: 10_000 }, enemy: fighter }, /defense/)
    expectInvalid({ version: 1, mode: 'battle', title: '战斗', player: { ...fighter, crit: 101 }, enemy: fighter }, /crit/)
    expectInvalid({ version: 1, mode: 'battle', title: '战斗', player: { ...fighter, hp: 101 }, enemy: fighter }, /hp.*maxHp/)
  })

  it('仅接受安全图片 URL', () => {
    for (const url of [
      'https://example.test/a.png',
      'http://localhost/a.webp',
      'data:image/png;base64,AAAA',
      '/user/images/a.jpg',
      './assets/a.webp',
      'assets/a.webp',
      '/scripts/extensions/third-party/st-stage/a.webp',
    ]) {
      const result = parseRendererBlock(wrap({ version: 1, mode: 'gal', scene: '场景', background: url, beats: [{ speaker: 'A', text: 'B' }] }))
      expect(result.ok, url).toBe(true)
    }
    for (const url of ['javascript:alert(1)', 'data:text/html;base64,AAAA', 'file:///tmp/a.png', '//evil.test/a.png', '../secret.png']) {
      expectInvalid({ version: 1, mode: 'gal', scene: '场景', background: url, beats: [{ speaker: 'A', text: 'B' }] }, /background/)
    }
  })

  it('portrait 接受显式 sprite 地址，但背景不接受', () => {
    const result = parseRendererBlock(wrap({
      version: 1,
      mode: 'gal',
      scene: '场景',
      beats: [{ speaker: 'A', text: 'B', portrait: 'sprite:角色/礼服/微笑' }],
    }))
    expect(result).toMatchObject({ ok: true, block: { beats: [{ portrait: 'sprite:角色/礼服/微笑' }] } })
    expectInvalid(
      { version: 1, mode: 'gal', scene: '场景', background: 'sprite:场景/夜晚', beats: [{ speaker: 'A', text: 'B' }] },
      /background/,
    )
  })

  it('只返回原始渲染标签块，不吞掉块外叙事', () => {
    const block = wrap({
      version: 1,
      mode: 'cards',
      title: '选择',
      cards: [
        { id: 'a', title: '前进', description: '继续', action: '前进' },
        { id: 'b', title: '休息', description: '等待', action: '休息' },
      ],
    })
    const result = parseRendererBlock(`前文\n${block}\n后文`)

    expect(result).toMatchObject({ ok: true, raw: block })
  })

  it('拒绝本地路径穿越和格式错误的 HTTP URL', () => {
    for (const url of [
      'assets/../secret.png',
      './%2e%2e/secret.png',
      '/user/images/%2E%2E/secret.png',
      'assets/%252e%252e%252fsecret.png',
      './safe%2f..%2fsecret.png',
      'assets/safe%255c..%255csecret.png',
      'https://?',
    ]) {
      expectInvalid(
        { version: 1, mode: 'gal', scene: '场景', background: url, beats: [{ speaker: 'A', text: 'B' }] },
        /background/,
      )
    }
  })

  it('拒绝会导致交互定位歧义的重复 ID', () => {
    expectInvalid(
      {
        version: 1,
        mode: 'cards',
        title: '选择',
        cards: [
          { id: 'same', title: 'A', description: 'A', action: 'A' },
          { id: 'same', title: 'B', description: 'B', action: 'B' },
        ],
      },
      /重复 ID/,
    )
    expectInvalid(
      {
        version: 1,
        mode: 'battle',
        title: '战斗',
        player: { ...fighter, skills: [fighter.skills[0], { ...fighter.skills[0] }] },
        enemy: { ...fighter, id: 'enemy' },
      },
      /重复 ID/,
    )
  })

  it('允许状态使用负增减量表达减益', () => {
    const result = parseRendererBlock(
      wrap({
        version: 1,
        mode: 'battle',
        title: '战斗',
        player: { ...fighter, statuses: [{ id: 'weak', name: '虚弱', duration: 2, attackDelta: -3 }] },
        enemy: { ...fighter, id: 'enemy' },
      }),
    )

    expect(result).toMatchObject({ ok: true, block: { player: { statuses: [{ attackDelta: -3 }] } } })
  })
})
