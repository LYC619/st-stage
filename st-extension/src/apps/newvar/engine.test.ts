import { describe, it, expect } from 'vitest'
import {
  initStateFromSchema,
  validateValue,
  parseUpdateBlock,
  pointerToDotted,
  applyOps,
  buildInjection,
} from './engine'
import type { VariableSchema } from './types'

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

describe('buildInjection', () => {
  const state = initStateFromSchema(schema)
  it('含状态、描述与 JSON Patch 规则', () => {
    const out = buildInjection(state, schema, 'json_patch')
    expect(out).toContain('好感度: 0')
    expect(out).toContain('// 角色好感')
    expect(out).toContain('JSON Patch')
    expect(out).toContain('<variable_update_instruction>')
  })
  it('隐藏变量不注入', () => {
    const s2: VariableSchema = {
      ...schema,
      variables: [...schema.variables, { key: '内部计数', type: 'number', default: 0, description: '', hidden: true }],
    }
    expect(buildInjection(initStateFromSchema(s2), s2, 'json_patch')).not.toContain('内部计数')
  })
  it('lodash 格式给出 _.set 规则', () => {
    expect(buildInjection(state, schema, 'lodash_set')).toContain('_.set(')
  })
})
