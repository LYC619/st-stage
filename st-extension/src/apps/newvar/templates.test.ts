import { describe, expect, it } from 'vitest'
import { applyOps, buildInjection, initStateFromSchema, parseUpdateBlock, validateValue } from './engine'
import { NEWVAR_TEMPLATES } from './templates'
import type { VariableDefinition, VariableSchema } from './types'

function schemaFor(id: string, variables: VariableDefinition[]): VariableSchema {
  return { id, name: id, version: 1, variables }
}

describe('built-in newvar template contracts', () => {
  it('模板 ID 唯一，每套变量路径唯一', () => {
    expect(new Set(NEWVAR_TEMPLATES.map((template) => template.id)).size).toBe(NEWVAR_TEMPLATES.length)
    for (const template of NEWVAR_TEMPLATES) {
      const paths = template.variables.map((definition) => definition.key)
      expect(new Set(paths).size, template.id).toBe(paths.length)
    }
  })

  it('所有默认值和约束完整有效，每条都有描述与更新规则', () => {
    for (const template of NEWVAR_TEMPLATES) {
      for (const definition of template.variables) {
        const validated = validateValue(definition, definition.default)
        expect(validated.ok, `${template.id}:${definition.key}`).toBe(true)
        expect(validated.corrected, `${template.id}:${definition.key}`).not.toBe(true)
        if (definition.type === 'number') {
          expect(definition.range, `${template.id}:${definition.key}`).toBeDefined()
          expect(definition.range?.every(Number.isFinite), `${template.id}:${definition.key}`).toBe(true)
          expect(definition.range![0], `${template.id}:${definition.key}`).toBeLessThanOrEqual(definition.range![1])
        }
        if (definition.type === 'enum') {
          expect(definition.enum?.length, `${template.id}:${definition.key}`).toBeGreaterThan(0)
          expect(new Set(definition.enum).size, `${template.id}:${definition.key}`).toBe(definition.enum?.length)
          expect(definition.enum?.every((option) => option.trim() !== ''), `${template.id}:${definition.key}`).toBe(true)
        }
        expect(definition.description.trim(), `${template.id}:${definition.key}`).not.toBe('')
        expect(definition.updateRule?.trim() ?? '', `${template.id}:${definition.key}`).not.toBe('')
      }
    }
  })

  it('每套生成的 JSON Patch 示例都可解析并通过自身 schema', () => {
    for (const template of NEWVAR_TEMPLATES) {
      const schema = schemaFor(template.id, template.variables)
      const state = initStateFromSchema(schema)
      const parsed = parseUpdateBlock(buildInjection(state, schema, 'json_patch'), 'json_patch')
      expect(parsed.error, template.id).toBeUndefined()
      expect(parsed.rejected, template.id).toBeUndefined()
      expect(parsed.ops, template.id).toHaveLength(1)
      expect(applyOps(state, parsed.ops, schema).log[0], template.id).toMatchObject({ status: 'accepted' })
    }
  })

  it('多角色模板通过参数实例化，改名后提示词不残留占位身份', () => {
    const template = NEWVAR_TEMPLATES.find((item) => item.id === 'romance-multi')!
    expect(template.parameters?.map((parameter) => parameter.key)).toEqual(['roleA', 'roleB'])
    expect(template.instantiate).toBeTypeOf('function')

    const variables = template.instantiate!({ roleA: '小雪', roleB: '小雨' })
    const schema = schemaFor('renamed', variables)
    const prompt = buildInjection(initStateFromSchema(schema), schema, 'json_patch')
    expect(prompt).toContain('角色.小雪.好感度')
    expect(prompt).toContain('角色.小雨.好感度')
    expect(prompt).not.toMatch(/角色A|角色B/)
  })

  it('多角色每个依赖在场状态的变量都重复写明在场门禁', () => {
    const template = NEWVAR_TEMPLATES.find((item) => item.id === 'romance-multi')!
    const variables = template.instantiate!({ roleA: '小雪', roleB: '小雨' })
    for (const role of ['小雪', '小雨']) {
      const gated = variables.filter(
        (definition) => definition.key.startsWith(`角色.${role}.`) && !definition.key.endsWith('是否在场') && !definition.key.endsWith('所在位置'),
      )
      expect(gated.length).toBeGreaterThan(0)
      for (const definition of gated) {
        expect(definition.updateRule, definition.key).toContain(`角色.${role}.是否在场为 true`)
      }
    }
  })

  it('多角色实例化拒绝重复和危险角色名', () => {
    const template = NEWVAR_TEMPLATES.find((item) => item.id === 'romance-multi')!
    expect(() => template.instantiate!({ roleA: '小雪', roleB: '小雪' })).toThrow(/重复/)
    expect(() => template.instantiate!({ roleA: '小.雪', roleB: '小雨' })).toThrow(/点号/)
    expect(() => template.instantiate!({ roleA: 'constructor', roleB: '小雨' })).toThrow(/危险/)
  })

  it('恋爱阶段使用具体阈值，RPG 法力有消耗与恢复规则', () => {
    const romance = NEWVAR_TEMPLATES.find((item) => item.id === 'romance-single')!
    const stage = romance.variables.find((definition) => definition.key === '关系阶段')!
    expect(stage.enum).toEqual(['陌生', '熟悉', '信任', '亲密', '挚爱'])
    expect(stage.updateRule).toContain('陌生 0-19')
    expect(stage.updateRule).toContain('熟悉 20-39')
    expect(stage.updateRule).toContain('信任 40-59')
    expect(stage.updateRule).toContain('亲密 60-79')
    expect(stage.updateRule).toContain('挚爱 80-100')

    const rpg = NEWVAR_TEMPLATES.find((item) => item.id === 'rpg')!
    const mana = rpg.variables.find((definition) => definition.key === '法力值')!
    expect(mana.updateRule).toMatch(/施法.*消耗/)
    expect(mana.updateRule).toMatch(/休息.*恢复/)
  })

  it('每套模板都显式维护日期、当前时间和时段', () => {
    for (const template of NEWVAR_TEMPLATES) {
      const paths = new Set(template.variables.map((definition) => definition.key))
      expect(paths.has('时间.日期'), template.id).toBe(true)
      expect(paths.has('时间.当前时间'), template.id).toBe(true)
      expect(paths.has('时间.当前时段'), template.id).toBe(true)
    }
  })
})
