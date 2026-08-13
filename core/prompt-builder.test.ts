import { describe, expect, it } from 'vitest'
import {
  BUILTIN_TEMPLATE,
  LEGACY_BUILTIN_TEMPLATES,
  buildInjectionPrompt,
  buildMultiRolePrompt,
  buildPrompt,
  buildPromptSceneNotes,
  chooseShorterPrompt,
  isKnownBuiltinTemplate,
} from './prompt-builder'
import type { SpriteAddress, SpritePack } from './types'
import { spriteAddress } from './types'
import { getPresetPacks } from './presets'

const addr = (role: string, outfit: string, tag: string): SpriteAddress => ({ role, outfit, tag })

describe('buildPrompt — 字符预算（阶段四·大图包稳定化）', () => {
  /** roles 个角色 × tags 个表情的全组合地址表 */
  const mkAddrs = (roles: number, tags: number): SpriteAddress[] => {
    const out: SpriteAddress[] = []
    for (let r = 0; r < roles; r++) {
      for (let t = 0; t < tags; t++) out.push(addr(`角色${r}`, '', `表情${t}项`))
    }
    return out
  }

  it('budget=0 或未超出时输出与不设预算完全一致', () => {
    const addrs = mkAddrs(3, 5)
    const base = buildPrompt(addrs, 'full', 1)
    expect(buildPrompt(addrs, 'full', 1, '', 0)).toBe(base)
    expect(buildPrompt(addrs, 'full', 1, '', base.length)).toBe(base)
    expect(buildPrompt(addrs, 'full', 1, '', 20000)).toBe(base)
  })

  it('超预算时输出 ≤ 预算；每个场景仍在场，保留排前的表情、截掉排后的', () => {
    const addrs = mkAddrs(4, 30)
    expect(buildPrompt(addrs, 'full', 1).length).toBeGreaterThan(600)
    const p = buildPrompt(addrs, 'full', 1, '', 600)
    expect(p.length).toBeLessThanOrEqual(600)
    for (let r = 0; r < 4; r++) expect(p).toContain(`角色${r}`)
    expect(p).toContain('表情0项')
    expect(p).not.toContain('表情29项')
  })

  it('repeat 模式同样受预算约束且确定性', () => {
    const addrs = mkAddrs(5, 40)
    const a = buildPrompt(addrs, 'repeat', 1, '', 800)
    const b = buildPrompt(addrs, 'repeat', 1, '', 800)
    expect(a.length).toBeLessThanOrEqual(800)
    expect(a).toBe(b)
  })

  it('自定义模板：预算作用于 {清单}，模板自身文字保留', () => {
    const addrs = mkAddrs(3, 50)
    const p = buildPrompt(addrs, 'full', 1, '开头说明\n{清单}\n结尾说明', 500)
    expect(p.length).toBeLessThanOrEqual(500)
    expect(p).toContain('开头说明')
    expect(p).toContain('结尾说明')
    expect(p).toContain('角色0')
  })

  it('模板不含 {清单} 时无从截取，超预算也原样输出（尽力而为）', () => {
    const long = '这段自定义提示词没有清单占位符'.repeat(20)
    const p = buildPrompt(mkAddrs(2, 3), 'full', 1, long, 50)
    expect(p).toBe(long)
  })

  it('每场景截到 1 个表情仍超预算：按 K=1 尽力而为，不硬切半行', () => {
    const addrs = mkAddrs(6, 10)
    const p = buildPrompt(addrs, 'full', 1, '', 10)
    expect(p.length).toBeGreaterThan(10)
    for (let r = 0; r < 6; r++) expect(p).toContain(`- 角色${r}：表情0项`)
    expect(p).not.toContain('表情1项')
  })
})

describe('buildPrompt — 全量', () => {
  it('空地址不注入', () => {
    expect(buildPrompt([], 'full', 1)).toBe('')
  })

  it('纯图名场景按默认场景分组', () => {
    const p = buildPrompt([addr('', '', '微笑'), addr('', '', '害羞')], 'full', 1)
    expect(p).toContain('- 默认：微笑、害羞')
    expect(p).toContain('[角色立绘系统]')
  })

  it('按 role/outfit 场景分组，空 outfit 与具体 outfit 分行', () => {
    const p = buildPrompt(
      [addr('鸣人', '居家服', '微笑'), addr('鸣人', '', '生气'), addr('佐助', '', '微笑')],
      'full',
      1,
    )
    expect(p).toContain('- 鸣人/居家服：微笑')
    expect(p).toContain('- 鸣人：生气')
    expect(p).toContain('- 佐助：微笑')
    expect(p).toContain('两段地址表示无服装')
  })
})

describe('buildPrompt — 智能精简', () => {
  const shared = Array.from({ length: 12 }, (_, index) => `共有_${index.toString().padStart(2, '0')}项`)
  const entries = ['鸣人', '佐助', '小樱'].flatMap((role) =>
    shared.map((tag) => addr(role, '', tag)),
  )
  entries.push(addr('鸣人', '', '联名'), addr('佐助', '', '联名'), addr('小樱', '', '治愈'))

  it('共有图名只列一次，簇内场景行写增量', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    expect(p).toContain('共有图名：共有_00项')
    expect(p.match(/共有_00项/g)).toHaveLength(1)
    expect(p).toMatch(/- 鸣人：共有图名，另有：联名/)
    expect(p).toMatch(/- 佐助：共有图名，另有：联名/)
    expect(p).toMatch(/- 小樱：共有图名，另有：治愈/)
  })

  it('每个场景保留自己的行，并说明共有图名的用法', () => {
    const p = buildPrompt(entries, 'repeat', 1)
    expect(p).toContain('可用立绘（按场景）：')
    expect(p).toContain('场景行写「共有图名」')
    expect(p).not.toContain('专属')
  })

  it('图名集互不重合或压缩不划算时使用分组精确格式', () => {
    const p = buildPrompt([addr('鸣人', '', '微笑'), addr('佐助', '', '冷漠')], 'repeat', 1)
    expect(p).toContain('可用立绘（按场景）')
    expect(p).not.toContain('共有图名')
  })

  it('部分场景图名集不同（编号前缀、缩水集）时仍能压缩重合的场景簇', () => {
    // 模拟实测数据形态：一套服装用编号图名、一套战损版图名缩水，其余高度重合
    const common = ['爱慕', '懊悔', '悲伤', '逗乐', '愤怒', '感激', '关怀', '害怕', '好奇', '惊讶', '困惑', '领悟', '期许', '失望', '释然', '喜悦']
    const entries2 = [
      ...['01_中性', '02_关怀', '03_感激'].map((tag) => addr('塞拉', '常服', tag)),
      ...common.map((tag) => addr('塞拉', '斗篷', tag)),
      addr('塞拉', '斗篷', '月光透视'),
      ...common.map((tag) => addr('塞拉', '白裙', tag)),
      addr('塞拉', '白裙', '治愈绽放'),
      ...common.map((tag) => addr('塞拉', '仪式袍', tag)),
      addr('塞拉', '仪式袍', '施法附身'),
      addr('塞拉', '仪式袍', '赐福觉醒'),
      ...common.map((tag) => addr('塞拉', '战斗服', tag)),
      ...['防备', '疲惫', '爱慕', '悲伤'].map((tag) => addr('塞拉', '战损', tag)),
    ]
    const p = buildPrompt(entries2, 'repeat', 1)
    expect(p).toContain('共有图名：爱慕、')
    expect(p.match(/懊悔/g)).toHaveLength(1)
    expect(p).toMatch(/- 塞拉\/斗篷：共有图名，另有：月光透视/)
    expect(p).toMatch(/- 塞拉\/白裙：共有图名，另有：治愈绽放/)
    expect(p).toMatch(/- 塞拉\/仪式袍：共有图名，另有：施法附身、赐福觉醒/)
    expect(p).toMatch(/- 塞拉\/战斗服：共有图名/)
    expect(p).toContain('- 塞拉/常服：01_中性、02_关怀、03_感激')
    expect(p).toContain('- 塞拉/战损：防备、疲惫、爱慕、悲伤')
  })

  it('带场景备注时同样可以精简，备注缩进挂在场景行下', () => {
    const p = buildPrompt(entries, 'repeat', 1, '', 0, [
      { role: '鸣人', outfit: '', note: '主角常服', placement: 'after-list' },
    ])
    expect(p).toContain('共有图名：共有_00项')
    expect(p).toContain('- 鸣人：共有图名，另有：联名\n  备注：主角常服')
  })

  it('真实图名与「共有图名」撞名时放弃精简防歧义', () => {
    const clash = [
      ...entries,
      addr('鸣人', '', '共有图名'),
      addr('佐助', '', '共有图名'),
      addr('小樱', '', '共有图名'),
    ]
    const p = buildPrompt(clash, 'repeat', 1)
    expect(p).toContain('可用立绘（按场景）：')
    expect(p).not.toContain('共有图名，另有')
  })

  it('长度相同选择分组精确格式', () => {
    expect(chooseShorterPrompt('分组', '共享')).toBe('分组')
    expect(chooseShorterPrompt('分组更长', '短')).toBe('短')
  })
})

describe('大包 Prompt 压缩', () => {
  it('50 角色 × 20 共同表情可逆压缩，不重复逐图身份', () => {
    const roles = Array.from({ length: 50 }, (_, index) => `角色_${index.toString().padStart(2, '0')}`)
    const tags = Array.from({ length: 20 }, (_, index) => `表情_${index.toString().padStart(2, '0')}项`)
    const addresses = roles.flatMap((role) => tags.map((tag) => addr(role, '', tag)))
    const prompt = buildPrompt(addresses, 'repeat', 1)
    const naive = addresses.map((address) => `${address.role}/${address.tag}`).join('、')

    expect(addresses).toHaveLength(1000)
    expect(prompt.length).toBeLessThan(naive.length / 3)
    expect(prompt).not.toMatch(/@p=|@r=/)
    for (const role of roles) expect(prompt).toContain(role)
    for (const tag of tags) expect(prompt.match(new RegExp(tag, 'g'))).toHaveLength(1)
  })
})

describe('buildPrompt — N 张立绘', () => {
  it('N=1 用单标签语义', () => {
    const p = buildPrompt([addr('', '', '微笑')], 'full', 1)
    expect(p).toContain('选择一个')
    expect(p).not.toMatch(/依次输出/)
  })

  it('N>1 要求按情节顺序、分散插入正文', () => {
    const p = buildPrompt([addr('', '', '微笑'), addr('', '', '害羞')], 'full', 3)
    expect(p).toContain('3 张立绘')
    expect(p).toContain('不要集中堆在回复结尾')
  })

  it('N>1 带插入位置 few-shot，示例图名取实际存在的 tag', () => {
    const p = buildPrompt([addr('鸣人', '', '微笑'), addr('鸣人', '', '害羞')], 'full', 2)
    expect(p).toContain('插入位置示例')
    expect(p).toContain('[立绘:鸣人/微笑]')
    expect(p).toContain('[立绘:鸣人/害羞]')
  })

  it('N=1 不带 few-shot', () => {
    const p = buildPrompt([addr('', '', '微笑')], 'full', 1)
    expect(p).not.toContain('插入位置示例')
  })

  it('N 非法回退 1', () => {
    const p = buildPrompt([addr('', '', '微笑')], 'full', 0)
    expect(p).toContain('选择一个')
  })
})

describe('buildPrompt — 自定义模板', () => {
  it('非空模板整体替换内置 prompt，{清单}/{数量} 被替换', () => {
    const p = buildPrompt(
      [addr('鸣人', '', '微笑'), addr('', '', '哭泣')],
      'full',
      3,
      '可用：\n{清单}\n请输出 {数量} 个标签。',
    )
    expect(p).toBe('可用：\n- 鸣人：微笑\n- 默认：哭泣\n请输出 3 个标签。')
    expect(p).not.toContain('[角色立绘系统]')
  })

  it('空白模板回退内置 prompt；空地址仍不注入', () => {
    expect(buildPrompt([addr('', '', '微笑')], 'full', 1, '  ')).toContain('[角色立绘系统]')
    expect(buildPrompt([], 'full', 1, '自定义 {清单}')).toBe('')
  })

  it('未修改的 BUILTIN_TEMPLATE 仍走内置压缩逻辑', () => {
    const addrs = [addr('鸣人', '', '微笑'), addr('鸣人', '', '害羞')]
    expect(buildPrompt(addrs, 'repeat', 3, BUILTIN_TEMPLATE)).toBe(buildPrompt(addrs, 'repeat', 3))
  })

  it('历史内置“表情”底稿仍走当前自动压缩逻辑', () => {
    const legacy = LEGACY_BUILTIN_TEMPLATES[0]
    const addrs = [
      addr('角色', '常服', '中性'),
      addr('角色', '常服', '喜悦'),
      addr('角色', '礼服', '中性'),
      addr('角色', '礼服', '喜悦'),
    ]

    expect(isKnownBuiltinTemplate(legacy)).toBe(true)
    expect(buildPrompt(addrs, 'repeat', 3, legacy)).toBe(buildPrompt(addrs, 'repeat', 3))
    expect(buildPrompt(addrs, 'repeat', 3, legacy)).not.toContain('表情')
  })

  it('历史底稿只按精确内容识别，用户改动一个字符后保持自定义语义', () => {
    const legacy = LEGACY_BUILTIN_TEMPLATES[0]
    const customized = legacy.replace('[角色立绘系统]', '[我的角色立绘系统]')
    const addrs = [addr('角色', '常服', '中性')]

    expect(isKnownBuiltinTemplate(customized)).toBe(false)
    expect(buildPrompt(addrs, 'repeat', 3, customized)).toContain('[我的角色立绘系统]')
    expect(buildPrompt(addrs, 'repeat', 3, customized)).toContain('表情')
  })

  it('历史底稿只归一 CRLF，首尾空白也属于用户改动', () => {
    const legacy = LEGACY_BUILTIN_TEMPLATES[0]
    const addrs = [addr('角色', '常服', '中性')]

    expect(isKnownBuiltinTemplate(legacy.replace(/\n/g, '\r\n'))).toBe(true)
    expect(isKnownBuiltinTemplate(` ${legacy}`)).toBe(false)
    expect(isKnownBuiltinTemplate(`${legacy}\n`)).toBe(false)
    expect(buildPrompt(addrs, 'repeat', 3, ` ${legacy}`)).toContain('表情')
    expect(buildPrompt(addrs, 'repeat', 3, `${legacy}\n`)).toContain('表情')
  })
})

describe('buildPrompt — 同角色服装级压缩', () => {
  const packs = getPresetPacks()
  const addresses = packs.flatMap((pack) => pack.sprites.map((sprite) => spriteAddress(pack, sprite)))
  const notes = buildPromptSceneNotes(packs, addresses)

  it('只写一次角色和基础池，并按服装列增量、后缀变体和缩水集合', () => {
    const compact = buildPrompt(addresses, 'repeat', 3, '', 0, notes)
    const full = buildPrompt(addresses, 'full', 3, '', 0, notes)

    expect(compact.match(/角色：塞拉菲娜/g)).toHaveLength(1)
    expect(compact.match(/基础图名池：/g)).toHaveLength(1)
    expect(compact).toContain('- 常服（默认）：基础图名池，另有：翻白眼吐舌')
    expect(compact).toContain('- 暗影斗篷：基础图名池，另有：妩媚、月光透视')
    expect(compact).toContain('- 治愈白裙：基础图名池，另有：治愈绽放')
    expect(compact).toContain('可用“_变”后缀：启仪、施法、爱慕、感激、关怀、好奇、领悟、期许、释然、妩媚、喜悦、中性')
    expect(compact).toContain('- 战斗服（仅限）：懊悔、悲伤、逗乐、愤怒')
    expect(compact).not.toContain('- 战斗服（仅限）：爱慕')
    expect(compact).toContain('[立绘:图名]（默认服装）或 [立绘:服装/图名]')
    expect(compact.length).toBeLessThan(full.length)
  })

  it('填入未修改的内置底稿不会绕过同角色压缩', () => {
    expect(buildPrompt(addresses, 'repeat', 3, BUILTIN_TEMPLATE, 0, notes)).toBe(
      buildPrompt(addresses, 'repeat', 3, '', 0, notes),
    )
  })
})

describe('向后兼容旧签名', () => {
  it('buildInjectionPrompt 空/列表', () => {
    expect(buildInjectionPrompt([])).toBe('')
    expect(buildInjectionPrompt(['微笑', '害羞'])).toContain('微笑、害羞')
  })

  it('buildMultiRolePrompt full 枚举地址', () => {
    const p = buildMultiRolePrompt(
      [
        { group: '鸣人', tag: '微笑' },
        { group: '佐助', tag: '微笑' },
      ],
      'full',
    )
    expect(p).toContain('- 鸣人：微笑')
    expect(p).toContain('- 佐助：微笑')
  })

  it('buildMultiRolePrompt 空不注入', () => {
    expect(buildMultiRolePrompt([], 'full')).toBe('')
  })
})

describe('buildPrompt — Gallery 场景备注与编号范围', () => {
  it('从各包实际贡献的有效场景生成备注并保持包、场景、备注顺序', () => {
    const packs: SpritePack[] = [
      {
        id: 'first',
        name: '匿名@包',
        promptNote: '第一包备注',
        promptNotePlacement: 'before-list',
        outfitNotes: { 战斗服: '战斗服备注', 不存在: '不得出现' },
        sprites: [
          { tag: '挥手', url: '/wave.png', group: '覆盖角色', outfit: '战斗服' },
          { tag: '微笑', url: '/smile.png', group: '覆盖角色', outfit: '战斗服' },
          { tag: '默认', url: '/default.png' },
        ],
      },
      {
        id: 'second',
        name: '第二包',
        roleName: '第二角色',
        outfit: '常服',
        promptNote: '第二包备注',
        outfitNotes: { 礼服: '礼服备注' },
        sprites: [
          { tag: '常服图', url: '/casual.png' },
          { tag: '礼服图', url: '/formal.png', outfit: '礼服' },
        ],
      },
    ]

    const addresses = [
      addr('覆盖角色', '战斗服', '挥手'),
      addr('覆盖角色', '战斗服', '微笑'),
      addr('匿名包', '', '默认'),
      addr('第二角色', '常服', '常服图'),
      addr('第二角色', '礼服', '礼服图'),
    ]

    expect(buildPromptSceneNotes(packs, addresses)).toEqual([
      { role: '覆盖角色', outfit: '战斗服', note: '第一包备注', placement: 'before-list' },
      { role: '覆盖角色', outfit: '战斗服', note: '战斗服备注', placement: 'before-list' },
      { role: '第二角色', outfit: '礼服', note: '礼服备注', placement: 'after-list' },
      { role: '第二角色', outfit: '礼服', note: '第二包备注', placement: 'after-list' },
    ])
  })

  it('omits notes from a pack whose only effective address was conflict-filtered out', () => {
    const packs: SpritePack[] = [
      {
        id: 'conflicted',
        name: '冲突包',
        roleName: '共享角色',
        promptNote: '冲突包备注不得出现',
        sprites: [{ tag: '冲突图', url: '/conflicted.png' }],
      },
      {
        id: 'valid',
        name: '有效包',
        roleName: '共享角色',
        promptNote: '有效包备注',
        sprites: [
          { tag: '冲突图', url: '/duplicate.png' },
          { tag: '保留图', url: '/valid.png' },
        ],
      },
    ]

    expect(buildPromptSceneNotes(packs, [addr('共享角色', '', '保留图')])).toEqual([
      { role: '共享角色', outfit: '', note: '有效包备注', placement: 'after-list' },
    ])
  })

  it('在精确场景清单前后插入备注，同位置备注保持输入顺序', () => {
    const prompt = buildPrompt(
      [addr('鸣人', '居家服', '微笑'), addr('佐助', '战斗服', '冷漠')],
      'full',
      1,
      '',
      0,
      [
        { role: '鸣人', outfit: '居家服', note: '鸣人前置一', placement: 'before-list' },
        { role: '佐助', outfit: '战斗服', note: '佐助后置', placement: 'after-list' },
        { role: '鸣人', outfit: '居家服', note: '鸣人前置二', placement: 'before-list' },
      ],
    )

    expect(prompt.indexOf('鸣人前置一')).toBeLessThan(prompt.indexOf('鸣人前置二'))
    expect(prompt.indexOf('鸣人前置二')).toBeLessThan(prompt.indexOf('- 鸣人/居家服：微笑'))
    expect(prompt.indexOf('- 佐助/战斗服：冷漠')).toBeLessThan(prompt.indexOf('佐助后置'))
  })

  it('只渲染 role 和 outfit 都精确匹配的场景备注', () => {
    const prompt = buildPrompt(
      [addr('鸣人', '居家服', '微笑'), addr('鸣人', '战斗服', '生气')],
      'full',
      1,
      '',
      0,
      [
        { role: '鸣人', outfit: '居家服', note: '精确备注', placement: 'after-list' },
        { role: '鸣人', outfit: '', note: '错误服装', placement: 'after-list' },
        { role: '佐助', outfit: '居家服', note: '错误角色', placement: 'before-list' },
      ],
    )

    expect(prompt).toContain('精确备注')
    expect(prompt).not.toContain('错误服装')
    expect(prompt).not.toContain('错误角色')
  })

  it('压缩编号图名并要求输出一个真实完整图名，明确禁止范围标签', () => {
    const prompt = buildPrompt(
      ['挥手1', '挥手2', '挥手3', '挥手4'].map((tag) => addr('鸣人', '', tag)),
      'full',
      2,
    )

    expect(prompt).toContain('挥手1-4（输出时从挥手1至挥手4中随机选择一个完整图名）')
    expect(prompt).toContain('一个实际存在的完整图名')
    expect(prompt).toMatch(/(?:禁止|严禁).*挥手1-4/)
    expect(prompt).toContain('[立绘:鸣人/挥手1]')
    expect(prompt).not.toContain('[立绘:鸣人/挥手1-4]')
  })

  it('在预算拟合前压缩编号范围，能保留本可整体放入预算的完整范围', () => {
    const addresses = Array.from({ length: 40 }, (_, index) => addr('鸣人', '', `挥手${index + 1}`))
    const compact = buildPrompt(addresses, 'full', 1)

    expect(compact).toContain('挥手1-40')
    expect(buildPrompt(addresses, 'full', 1, '', compact.length)).toBe(compact)
  })

  it('自定义模板的清单同样包含压缩范围和禁止输出范围的说明', () => {
    const prompt = buildPrompt(
      ['动作01', '动作02', '动作03'].map((tag) => addr('', '', tag)),
      'full',
      1,
      '自定义清单：\n{清单}',
    )

    expect(prompt).toContain('动作01-03（输出时从动作01至动作03中随机选择一个完整图名）')
    expect(prompt).toMatch(/(?:禁止|严禁).*动作01-03/)
  })

  it('跨场景存在真实同名标签时不生成碰撞的范围标签', () => {
    const prompt = buildPrompt(
      [
        addr('角色A', '', 'act1'),
        addr('角色A', '', 'act2'),
        addr('角色A', '', 'act3'),
        addr('角色B', '', 'act1-3'),
      ],
      'full',
      1,
    )

    expect(prompt).toContain('- 角色A：act1、act2、act3')
    expect(prompt).toContain('- 角色B：act1-3')
    expect(prompt).not.toContain('act1-3（输出时')
  })
})

describe('buildPrompt — Gallery 兼容基线', () => {
  it('无备注且无可压缩范围时 full 输出逐字节保持不变', () => {
    expect(buildPrompt([addr('鸣人', '', '微笑'), addr('鸣人', '', '害羞')], 'full', 1)).toBe([
      '[角色立绘系统]',
      '可用立绘（按场景）：',
      '- 鸣人：微笑、害羞',
      '输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。',
      '请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。',
      '只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。',
    ].join('\n'))
  })

  it('压缩不划算时 repeat 输出与 full 逐字节一致', () => {
    const tags = ['微笑', '害羞', '冷漠', '惊讶', '叹气', '点头', '摇头', '沉思']
    const addresses = ['鸣人', '佐助'].flatMap((role) => tags.map((tag) => addr(role, '', tag)))

    expect(buildPrompt(addresses, 'repeat', 1)).toBe([
      '[角色立绘系统]',
      '可用立绘（按场景）：',
      `- 鸣人：${tags.join('、')}`,
      `- 佐助：${tags.join('、')}`,
      '输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。',
      '请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。',
      '只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。',
    ].join('\n'))
  })

  it('压缩划算时 repeat 输出逐字节保持不变', () => {
    const shared = Array.from({ length: 12 }, (_, index) => `共有_${index.toString().padStart(2, '0')}项`)
    const addresses = ['鸣人', '佐助', '小樱'].flatMap((role) =>
      shared.map((tag) => addr(role, '', tag)),
    )
    addresses.push(addr('鸣人', '', '联名'), addr('小樱', '', '治愈'))

    expect(buildPrompt(addresses, 'repeat', 1)).toBe([
      '[角色立绘系统]',
      `共有图名：${shared.join('、')}`,
      '可用立绘（按场景）：',
      '- 鸣人：共有图名，另有：联名',
      '- 佐助：共有图名',
      '- 小樱：共有图名，另有：治愈',
      '场景行写「共有图名」表示最上方共有清单里的图名整组可用；「另有」及直接列出的图名只属于所在场景。',
      '输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。',
      '请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。',
      '只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。',
    ].join('\n'))
  })

  it('全部场景均为角色/服装时输出格式行收窄为三级地址', () => {
    const p = buildPrompt(
      [addr('鸣人', '居家服', '微笑'), addr('佐助', '战斗服', '冷漠')],
      'full',
      1,
    )
    expect(p).toContain('输出格式：[立绘:角色/服装/图名]，角色、服装、图名均须与上方清单完全一致。')
    expect(p).not.toContain('两段地址')
  })

  it('备注含换行时续行缩进，不打散清单结构', () => {
    const p = buildPrompt(
      [addr('鸣人', '战斗服', '微笑')],
      'full',
      1,
      '',
      0,
      [{ role: '鸣人', outfit: '战斗服', note: '第一行说明\n第二行细节', placement: 'after-list' }],
    )
    expect(p).toContain('- 鸣人/战斗服：微笑\n  备注：第一行说明\n    第二行细节')
  })

  it('无备注且无可压缩范围时自定义模板输出逐字节保持不变', () => {
    expect(buildPrompt(
      [addr('鸣人', '', '微笑'), addr('', '', '哭泣')],
      'repeat',
      3,
      '可用：\n{清单}\n请输出 {数量} 个标签。',
    )).toBe('可用：\n- 鸣人：微笑\n- 默认：哭泣\n请输出 3 个标签。')
  })
})
