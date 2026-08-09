/**
 * 「新变量」配置（存 settings.apps.newvar，经 ctx.getAppData/setAppData 读写）。
 * normalize 对任意历史/损坏数据做归一化，保证 runtime 拿到的永远是合法结构。
 */

import type { OutputFormat, VariableSchema, VariableDefinition, VarType } from './types'
import { isSafePath } from '../path-utils'

/** 用户自定义模板（把当前变量系统存成模板，换卡复用/分享） */
export interface CustomTemplate {
  id: string
  name: string
  description: string
  variables: VariableDefinition[]
}

export const NEWVAR_APP_ID = 'newvar'
/** 命名注入通道 id（adapter.injectChannel 的 channel 参数） */
export const NEWVAR_CHANNEL = 'newvar'
/** 状态快照在 message.extra 里的字段名 */
export const NEWVAR_EXTRA_KEY = 'st_stage_newvar'

export interface NewvarData {
  /** 总开关：关闭时不注入、不解析（默认关，用户显式启用） */
  enabled: boolean
  /** 只从消息气泡中隐藏 AI 的变量更新记录；原始 chat 数据保持不变。 */
  hideUpdateBlocks: boolean
  /** AI 输出格式：json_patch（默认，新版 MVU 真卡同款）/ lodash_set（老版兼容） */
  format: OutputFormat
  /** 注入深度（IN_CHAT 距末尾楼层数） */
  injectionDepth: number
  schema: VariableSchema
  /** 用户自定义模板库 */
  customTemplates: CustomTemplate[]
}

export function defaultNewvarData(): NewvarData {
  return {
    enabled: false,
    hideUpdateBlocks: true,
    format: 'json_patch',
    injectionDepth: 4,
    schema: { id: 'default', name: '默认方案', version: 1, variables: [] },
    customTemplates: [],
  }
}

const VAR_TYPES: VarType[] = ['number', 'string', 'boolean', 'enum']

export function normalizeNewvarData(raw: unknown): NewvarData {
  const d = defaultNewvarData()
  if (!raw || typeof raw !== 'object') return d
  const r = raw as Record<string, unknown>
  if (typeof r.enabled === 'boolean') d.enabled = r.enabled
  if (typeof r.hideUpdateBlocks === 'boolean') d.hideUpdateBlocks = r.hideUpdateBlocks
  if (r.format === 'json_patch' || r.format === 'lodash_set') d.format = r.format
  if (typeof r.injectionDepth === 'number' && Number.isInteger(r.injectionDepth)) {
    d.injectionDepth = Math.min(100, Math.max(0, r.injectionDepth))
  }
  const schema = r.schema
  if (schema && typeof schema === 'object') {
    const s = schema as Record<string, unknown>
    if (typeof s.id === 'string' && s.id) d.schema.id = s.id
    if (typeof s.name === 'string' && s.name) d.schema.name = s.name
    if (typeof s.version === 'number') d.schema.version = s.version
    if (Array.isArray(s.variables)) {
      d.schema.variables = s.variables
        .map(normalizeDefinition)
        .filter((v): v is VariableDefinition => v !== null)
    }
  }
  if (Array.isArray(r.customTemplates)) {
    d.customTemplates = r.customTemplates
      .map(normalizeCustomTemplate)
      .filter((t): t is CustomTemplate => t !== null)
  }
  return d
}

function normalizeCustomTemplate(raw: unknown): CustomTemplate | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.id !== 'string' || r.id === '' || typeof r.name !== 'string' || r.name === '') return null
  const variables = Array.isArray(r.variables)
    ? r.variables.map(normalizeDefinition).filter((v): v is VariableDefinition => v !== null)
    : []
  if (variables.length === 0) return null // 空模板无意义
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === 'string' ? r.description : '',
    variables,
  }
}

function normalizeDefinition(raw: unknown): VariableDefinition | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  if (typeof r.key !== 'string' || r.key.trim() === '' || !isSafePath(r.key.trim())) return null
  const type: VarType = VAR_TYPES.includes(r.type as VarType) ? (r.type as VarType) : 'string'
  const def: VariableDefinition = {
    key: r.key.trim(),
    type,
    default: r.default,
    description: typeof r.description === 'string' ? r.description : '',
  }
  if (r.hidden === true) def.hidden = true
  if (typeof r.updateRule === 'string' && r.updateRule.trim() !== '') def.updateRule = r.updateRule
  if (
    type === 'number' &&
    Array.isArray(r.range) &&
    r.range.length === 2 &&
    typeof r.range[0] === 'number' &&
    typeof r.range[1] === 'number' &&
    Number.isFinite(r.range[0]) &&
    Number.isFinite(r.range[1]) &&
    r.range[0] <= r.range[1]
  ) {
    def.range = [r.range[0], r.range[1]]
  }
  if (type === 'enum') {
    const options = Array.isArray(r.enum) ? r.enum.filter((x): x is string => typeof x === 'string' && x !== '') : []
    if (options.length === 0) return null // 枚举没有选项无意义，丢弃该定义
    def.enum = options
  }
  // 默认值兜底：类型不匹配时给该类型的零值
  def.default = coerceDefault(def, def.default)
  return def
}

function coerceDefault(def: VariableDefinition, raw: unknown): unknown {
  switch (def.type) {
    case 'number': {
      const n = typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
      if (def.range) return Math.min(def.range[1], Math.max(def.range[0], n))
      return n
    }
    case 'boolean':
      return typeof raw === 'boolean' ? raw : false
    case 'enum': {
      const options = def.enum ?? []
      return typeof raw === 'string' && options.includes(raw) ? raw : options[0]
    }
    default:
      return typeof raw === 'string' ? raw : raw == null ? '' : String(raw)
  }
}
