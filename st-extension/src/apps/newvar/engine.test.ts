import { describe, it, expect } from 'vitest'
import {
  initStateFromSchema,
  validateValue,
  parseUpdateBlock,
  pointerToDotted,
  applyOps,
  buildInjection,
  fillDefaults,
} from './engine'
import type { VariableDefinition, VariableSchema } from './types'

const schema: VariableSchema = {
  id: 'test',
  name: '测试',
  version: 1,
  variables: [
    { key: '好感度', type: 'number', default: 0, description: '角色好感', range: [-100, 100] },
    { key: '状态.体力', type: 'number', default: 100, description: '体力', range: [0, 100] },
    { key: '状态.心情', type: 'enum', default: '平静', description: '心情', enum: ['开心', '平静', '烦躁'] },
    { key: '场景', type: 'string', default: '教室', description: '当前地点' },
    { key: '在场', type: 'boolean', default: true, description: '是否在场' },
  ],
}

describe('initStateFromSchema', () => {
  it('按默认值构建嵌套状态', () => {
    expect(initStateFromSchema(schema)).toEqual({
      好感度: 0,
      状态: { 体力: 100, 心情: '平静' },
      场景: '教室',
      在场: true,
    })
  })
})

describe('validateValue', () => {
  it('数值越界 clip 并标记 corrected', () => {
    const def = schema.variables[0]
    expect(validateValue(def, 150)).toEqual({ ok: true, value: 100, corrected: true })
    expect(validateValue(def, -999)).toEqual({ ok: true, value: -100, corrected: true })
    expect(validateValue(def, 50)).toEqual({ ok: true, value: 50 })
  })
  it('类型不符拒绝', () => {
    expect(validateValue(schema.variables[0], '高').ok).toBe(false)
    expect(validateValue(schema.variables[3], 5).ok).toBe(false)
  })
  it('枚举外的值拒绝', () => {
    const mood = schema.variables[2]
    expect(validateValue(mood, '愤怒').ok).toBe(false)
    expect(validateValue(mood, '开心')).toEqual({ ok: true, value: '开心' })
  })
})

describe('pointerToDotted', () => {
  it('斜杠转点号，处理转义', () => {
    expect(pointerToDotted('/状态/体力')).toBe('状态.体力')
    expect(pointerToDotted('/好感度')).toBe('好感度')
    expect(pointerToDotted('/a~1b/c~0d')).toBe('a/b.c~d')
  })
})

describe('parseUpdateBlock — JSON Patch', () => {
  it('提取带 Analysis 前缀的补丁数组', () => {
    const text = `一些正文。
<UpdateVariable>
<Analysis>时间推进，好感上升</Analysis>
[{"op":"replace","path":"/好感度","value":10},{"op":"replace","path":"/状态/心情","value":"开心"}]
</UpdateVariable>`
    const r = parseUpdateBlock(text, 'json_patch')
    expect(r.found).toBe(true)
    expect(r.ops).toEqual([
      { op: 'replace', path: '好感度', value: 10 },
      { op: 'replace', path: '状态.心情', value: '开心' },
    ])
  })
  it('没有块时 found=false', () => {
    expect(parseUpdateBlock('普通回复没有变量', 'json_patch')).toEqual({ found: false, ops: [] })
  })
  it('块里 JSON 非法时报错但 found=true', () => {
    const r = parseUpdateBlock('<UpdateVariable>[not json]</UpdateVariable>', 'json_patch')
    expect(r.found).toBe(true)
    expect(r.error).toBeTruthy()
  })
  it('逐条报告结构非法的补丁，同时保留后续合法操作', () => {
    const text = `<UpdateVariable>${JSON.stringify([
      null,
      ['replace'],
      { op: 'move', path: '/好感度' },
      { op: 'replace' },
      { op: 'replace', path: '' },
      { op: 'replace', path: 7, value: 1 },
      { op: 'replace', path: '/好感度' },
      { op: 'replace', path: '/好感度', value: 12 },
    ])}</UpdateVariable>`

    const r = parseUpdateBlock(text, 'json_patch')

    expect(r.ops).toEqual([{ op: 'replace', path: '好感度', value: 12 }])
    expect(r.rejected).toEqual([
      expect.objectContaining({ index: 0, reason: expect.stringContaining('对象') }),
      expect.objectContaining({ index: 1, reason: expect.stringContaining('对象') }),
      expect.objectContaining({ index: 2, reason: expect.stringContaining('op') }),
      expect.objectContaining({ index: 3, reason: expect.stringContaining('path') }),
      expect.objectContaining({ index: 4, reason: expect.stringContaining('path') }),
      expect.objectContaining({ index: 5, reason: expect.stringContaining('path') }),
      expect.objectContaining({ index: 6, reason: expect.stringContaining('value') }),
    ])
  })
  it('拒绝包含原型污染字段的路径', () => {
    const r = parseUpdateBlock(
      '<UpdateVariable>[{"op":"replace","path":"/__proto__/polluted","value":true}]</UpdateVariable>',
      'json_patch',
    )

    expect(r.ops).toEqual([])
    expect(r.rejected).toEqual([
      expect.objectContaining({ index: 0, reason: expect.stringContaining('危险') }),
    ])
  })
})

describe('parseUpdateBlock — lodash 兼容', () => {
  it('解析 _.set 行', () => {
    const text = `<UpdateVariable>
_.set('好感度', 0, 15);//初次好感
_.set('场景', '教室', '天台');//换场景
</UpdateVariable>`
    const r = parseUpdateBlock(text, 'lodash_set')
    expect(r.ops).toEqual([
      { op: 'replace', path: '好感度', value: 15 },
      { op: 'replace', path: '场景', value: '天台' },
    ])
  })
})

describe('applyOps — schema 门禁', () => {
  const base = initStateFromSchema(schema)

  it('合法更新被接受并写入', () => {
    const r = applyOps(base, [{ op: 'replace', path: '好感度', value: 30 }], schema)
    expect(r.state.好感度).toBe(30)
    expect(r.log[0]).toMatchObject({ path: '好感度', status: 'accepted' })
  })
  it('数值越界自动 clip 并标 corrected', () => {
    const r = applyOps(base, [{ op: 'replace', path: '状态.体力', value: 200 }], schema)
    expect((r.state.状态 as Record<string, unknown>).体力).toBe(100)
    expect(r.log[0].status).toBe('corrected')
  })
  it('未定义路径被拒绝，状态不变', () => {
    const r = applyOps(base, [{ op: 'replace', path: '不存在的变量', value: 1 }], schema)
    expect(r.log[0]).toMatchObject({ status: 'rejected' })
    expect(r.state).toEqual(base)
  })
  it('类型/枚举非法被拒绝', () => {
    const r = applyOps(base, [{ op: 'replace', path: '状态.心情', value: '暴怒' }], schema)
    expect(r.log[0].status).toBe('rejected')
  })
  it('remove 删除路径', () => {
    const r = applyOps(base, [{ op: 'remove', path: '场景' }], schema)
    expect('场景' in r.state).toBe(false)
    expect(r.log[0].status).toBe('removed')
  })
  it('remove 拒绝父对象和未定义叶子，只删除 schema 中的精确叶子', () => {
    const r = applyOps(
      base,
      [
        { op: 'remove', path: '状态' },
        { op: 'remove', path: '状态.魔力' },
        { op: 'remove', path: '状态.体力' },
      ],
      schema,
    )

    expect(r.log).toEqual([
      expect.objectContaining({ path: '状态', status: 'rejected', detail: expect.stringContaining('叶子') }),
      expect.objectContaining({ path: '状态.魔力', status: 'rejected', detail: expect.stringContaining('叶子') }),
      expect.objectContaining({ path: '状态.体力', status: 'removed' }),
    ])
    expect(r.state.状态).toEqual({ 心情: '平静' })
  })
  it('remove 后可由快照默认值归一化恢复该叶子', () => {
    const removed = applyOps(base, [{ op: 'remove', path: '状态.体力' }], schema).state
    const normalized = fillDefaults(removed, schema)

    expect(normalized.状态).toEqual({ 体力: 100, 心情: '平静' })
  })
  it('直接传入危险路径时拒绝操作', () => {
    const r = applyOps(base, [{ op: 'remove', path: '__proto__.polluted' }], schema)

    expect(r.state).toEqual(base)
    expect(r.log[0]).toMatchObject({ status: 'rejected', detail: expect.stringContaining('危险') })
  })
  it('不改动原状态（纯函数）', () => {
    applyOps(base, [{ op: 'replace', path: '好感度', value: 99 }], schema)
    expect(base.好感度).toBe(0)
  })
})

describe('applyOps — 自由模式（无 schema）', () => {
  it('无变量定义时不设门禁，直接写', () => {
    const free: VariableSchema = { id: 'f', name: 'f', version: 1, variables: [] }
    const r = applyOps({}, [{ op: 'replace', path: '任意.路径', value: 7 }], free)
    expect((r.state.任意 as Record<string, unknown>).路径).toBe(7)
    expect(r.log[0].status).toBe('accepted')
  })
})

describe('buildInjection（三段式，对齐参考世界书）', () => {
  const state = initStateFromSchema(schema)
  it('含状态段、逐变量规则段、输出格式段与 Analysis 示例', () => {
    const out = buildInjection(state, schema, 'json_patch')
    expect(out).toContain('<status_current_variable>')
    expect(out).toContain('好感度: 0')
    expect(out).toContain('// 角色好感')
    expect(out).toContain('<variable_update_rule>')
    expect(out).toContain('范围 -100~100')
    expect(out).toContain('只能取：开心 / 平静 / 烦躁')
    expect(out).toContain('<variable_update_format>')
    expect(out).toContain('<Analysis>')
    expect(out).toContain('JSON Patch')
  })
  it('用户自定义 updateRule 逐行注入', () => {
    const s2: VariableSchema = {
      ...schema,
      variables: [
        {
          key: '好感度',
          type: 'number',
          default: 0,
          description: '',
          range: [0, 100],
          updateRule: '正面互动 +1~3\n重大事件 ±5',
        },
      ],
    }
    const out = buildInjection(initStateFromSchema(s2), s2, 'json_patch')
    expect(out).toContain('- 正面互动 +1~3')
    expect(out).toContain('- 重大事件 ±5')
  })
  it('隐藏变量既不进状态也不进规则', () => {
    const s2: VariableSchema = {
      ...schema,
      variables: [...schema.variables, { key: '内部计数', type: 'number', default: 0, description: '', hidden: true }],
    }
    expect(buildInjection(initStateFromSchema(s2), s2, 'json_patch')).not.toContain('内部计数')
  })
  it('lodash 格式给出 _.set 规则', () => {
    expect(buildInjection(state, schema, 'lodash_set')).toContain('_.set(')
  })
  it.each<VariableDefinition>([
    { key: '体力', type: 'number', default: 50, description: '', range: [0, 100] },
    { key: '在场', type: 'boolean', default: false, description: '' },
    { key: '心情', type: 'enum', default: '平静', description: '', enum: ['开心', '平静'] },
    { key: '场景/名称~值', type: 'string', default: '教室', description: '' },
  ])('为 $type 变量生成可解析且能通过门禁的 JSON Patch 示例', (def) => {
    const exampleSchema: VariableSchema = { id: def.type, name: def.type, version: 1, variables: [def] }
    const injection = buildInjection(initStateFromSchema(exampleSchema), exampleSchema, 'json_patch')
    expect(injection).toContain(`<Analysis>${def.key}`)
    const json = injection.match(/<Analysis>[\s\S]*?<\/Analysis>\r?\n(\[[^\r\n]+\])\r?\n<\/UpdateVariable>/)?.[1]

    expect(json).toBeTruthy()
    const patch = JSON.parse(json!) as Array<{ op: string; path: string; value: unknown }>
    expect(patch).toHaveLength(1)
    expect(validateValue(def, patch[0].value).ok).toBe(true)

    const parsed = parseUpdateBlock(`<UpdateVariable>${json}</UpdateVariable>`, 'json_patch')
    expect(parsed.rejected).toBeUndefined()
    const applied = applyOps(initStateFromSchema(exampleSchema), parsed.ops, exampleSchema)
    expect(applied.log).toEqual([expect.objectContaining({ path: def.key, status: 'accepted' })])
  })
})

describe('fillDefaults', () => {
  it('补齐快照里缺失的新定义变量，已有值不动', () => {
    const snap = { 好感度: 42 }
    const merged = fillDefaults(snap, schema)
    expect(merged.好感度).toBe(42)
    expect((merged.状态 as Record<string, unknown>).体力).toBe(100)
    expect(merged.场景).toBe('教室')
    expect(snap).toEqual({ 好感度: 42 }) // 纯函数
  })
})
