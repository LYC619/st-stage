/**
 * 「新变量」核心引擎（纯逻辑，无 DOM / 无 ST 依赖，可离线单测）：
 * - initStateFromSchema：按 schema 默认值生成初始状态
 * - validateValue：类型/范围/枚举校验，数值越界给出 clip 修正
 * - parseUpdateBlock：从 AI 输出提取 <UpdateVariable> 块并归一化成 PatchOp[]
 *     · JSON Patch（RFC6902，新版 MVU 真卡格式，默认）
 *     · lodash set（老版 _.set('path', old, new) 兼容）
 * - applyOps：把 PatchOp[] 施加到状态，逐条走 schema 门禁（拒绝未定义路径/非法值，数值越界 clip）
 * - buildInjection：据当前状态 + schema 生成注入给 AI 的提示词
 */

import { getNested, setNested, deleteNested } from '../path-utils'
import type {
  VariableSchema,
  VariableDefinition,
  OutputFormat,
  PatchOp,
  ParsedBlock,
  ApplyResult,
  ApplyLogEntry,
} from './types'

// —— 初始化 —— //

export function initStateFromSchema(schema: VariableSchema): Record<string, unknown> {
  const state: Record<string, unknown> = {}
  for (const def of schema.variables) {
    setNested(state, def.key, clone(def.default))
  }
  return state
}

function clone<T>(v: T): T {
  if (v == null || typeof v !== 'object') return v
  try {
    return JSON.parse(JSON.stringify(v)) as T
  } catch {
    return v
  }
}

// —— 校验 —— //

export interface ValidateOutcome {
  ok: boolean
  /** 校验/修正后的值（ok 时用它写入） */
  value?: unknown
  /** 是否发生了自动修正（如 clip 到范围） */
  corrected?: boolean
  error?: string
}

export function validateValue(def: VariableDefinition, raw: unknown): ValidateOutcome {
  switch (def.type) {
    case 'number': {
      if (typeof raw !== 'number' || !Number.isFinite(raw)) {
        return { ok: false, error: `期望数字，得到 ${describe(raw)}` }
      }
      if (def.range) {
        const [min, max] = def.range
        if (raw < min || raw > max) {
          const clipped = Math.max(min, Math.min(max, raw))
          return { ok: true, value: clipped, corrected: true }
        }
      }
      return { ok: true, value: raw }
    }
    case 'string':
      if (typeof raw !== 'string') return { ok: false, error: `期望文本，得到 ${describe(raw)}` }
      return { ok: true, value: raw }
    case 'boolean':
      if (typeof raw !== 'boolean') return { ok: false, error: `期望布尔，得到 ${describe(raw)}` }
      return { ok: true, value: raw }
    case 'enum': {
      const options = def.enum ?? []
      if (typeof raw !== 'string' || !options.includes(raw)) {
        return { ok: false, error: `值 ${describe(raw)} 不在枚举 [${options.join(', ')}] 中` }
      }
      return { ok: true, value: raw }
    }
    default:
      return { ok: true, value: raw }
  }
}

function describe(v: unknown): string {
  if (v === null) return 'null'
  if (typeof v === 'string') return `"${v}"`
  if (typeof v === 'object') return Array.isArray(v) ? '数组' : '对象'
  return String(v)
}

// —— 解析 <UpdateVariable> —— //

const BLOCK_RE = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i
const ANALYSIS_RE = /<Analysis>[\s\S]*?<\/Analysis>/gi
// _.set('path', old, new)  或  _.set("path", old, new)（old 可省略）
const LODASH_RE = /_\.set\(\s*['"]([^'"]+)['"]\s*,\s*(?:[^,]*?,\s*)?([\s\S]*?)\)\s*;?/gi

export function parseUpdateBlock(text: string, format: OutputFormat): ParsedBlock {
  if (typeof text !== 'string') return { found: false, ops: [] }
  const m = BLOCK_RE.exec(text)
  if (!m) return { found: false, ops: [] }
  const inner = m[1].replace(ANALYSIS_RE, '').trim()
  if (!inner) return { found: true, ops: [] }

  if (format === 'lodash_set') {
    return parseLodash(inner)
  }
  return parseJsonPatch(inner)
}

function parseJsonPatch(inner: string): ParsedBlock {
  const arrText = extractJsonArray(inner)
  if (arrText === null) return { found: true, ops: [], error: '未找到 JSON Patch 数组' }
  let parsed: unknown
  try {
    parsed = JSON.parse(arrText)
  } catch (e) {
    return { found: true, ops: [], error: `JSON 解析失败：${e instanceof Error ? e.message : String(e)}` }
  }
  if (!Array.isArray(parsed)) return { found: true, ops: [], error: 'JSON Patch 应为数组' }

  const ops: PatchOp[] = []
  for (const raw of parsed) {
    if (!raw || typeof raw !== 'object') continue
    const o = raw as Record<string, unknown>
    const op = o.op
    const pointer = o.path
    if ((op !== 'replace' && op !== 'add' && op !== 'remove') || typeof pointer !== 'string') continue
    ops.push({ op, path: pointerToDotted(pointer), value: o.value })
  }
  return { found: true, ops }
}

/** 从可能夹带说明文字的内容里，截取首个 '[' 到末个 ']' 之间作为 JSON 数组 */
function extractJsonArray(inner: string): string | null {
  const start = inner.indexOf('[')
  const end = inner.lastIndexOf(']')
  if (start < 0 || end <= start) return null
  return inner.slice(start, end + 1)
}

/** JSON Pointer（RFC6901，斜杠分隔，~1=/、~0=~）→ 内部点号路径 */
export function pointerToDotted(pointer: string): string {
  const p = pointer.startsWith('/') ? pointer.slice(1) : pointer
  if (p === '') return ''
  return p
    .split('/')
    .map((seg) => seg.replace(/~1/g, '/').replace(/~0/g, '~'))
    .join('.')
}

function parseLodash(inner: string): ParsedBlock {
  const ops: PatchOp[] = []
  let m: RegExpExecArray | null
  LODASH_RE.lastIndex = 0
  while ((m = LODASH_RE.exec(inner)) !== null) {
    const path = m[1]
    const valueText = stripTrailingComment(m[2]).trim()
    ops.push({ op: 'replace', path, value: coerceScalar(valueText) })
  }
  return { found: true, ops }
}

function stripTrailingComment(s: string): string {
  const idx = s.indexOf('//')
  return idx >= 0 ? s.slice(0, idx) : s
}

/** 把 lodash 参数文本解析为值：JSON 优先，失败去引号当字符串 */
function coerceScalar(t: string): unknown {
  if (t === '') return ''
  try {
    return JSON.parse(t)
  } catch {
    return t.replace(/^['"]|['"]$/g, '')
  }
}

// —— 施加更新（带 schema 门禁） —— //

export function applyOps(
  state: Record<string, unknown>,
  ops: PatchOp[],
  schema: VariableSchema,
): ApplyResult {
  const next = clone(state)
  const log: ApplyLogEntry[] = []
  const defByKey = new Map(schema.variables.map((v) => [v.key, v]))
  const hasSchema = schema.variables.length > 0

  for (const op of ops) {
    if (op.op === 'remove') {
      deleteNested(next, op.path)
      log.push({ path: op.path, status: 'removed' })
      continue
    }
    const def = defByKey.get(op.path)
    if (!def) {
      if (hasSchema) {
        log.push({ path: op.path, status: 'rejected', detail: '未定义的变量路径' })
        continue
      }
      // 无 schema（自由模式）：不设门禁，直接写
      setNested(next, op.path, op.value)
      log.push({ path: op.path, status: 'accepted' })
      continue
    }
    const outcome = validateValue(def, op.value)
    if (!outcome.ok) {
      log.push({ path: op.path, status: 'rejected', detail: outcome.error })
      continue
    }
    setNested(next, op.path, outcome.value)
    log.push({
      path: op.path,
      status: outcome.corrected ? 'corrected' : 'accepted',
      detail: outcome.corrected ? `已修正为 ${JSON.stringify(outcome.value)}` : undefined,
    })
  }
  return { state: next, log }
}

// —— 注入提示词 —— //

export function buildInjection(
  state: Record<string, unknown>,
  schema: VariableSchema,
  format: OutputFormat,
): string {
  const visible = schema.variables.filter((v) => !v.hidden)
  const lines = visible.map((v) => {
    const value = getNested(state, v.key)
    const desc = v.description ? `  // ${v.description}` : ''
    return `  ${v.key}: ${JSON.stringify(value)}${desc}`
  })

  const rule =
    format === 'lodash_set'
      ? [
          '在回复的最末尾，用以下格式输出所有发生变化的变量（仅输出有变化的）：',
          '<UpdateVariable>',
          "_.set('变量路径', 旧值, 新值);//变化原因",
          '</UpdateVariable>',
        ].join('\n')
      : [
          '在回复的最末尾，用 JSON Patch (RFC6902) 输出所有发生变化的变量（仅输出有变化的）：',
          '<UpdateVariable>',
          '[{"op":"replace","path":"/变量路径","value":新值}]',
          '</UpdateVariable>',
          '只能用 replace / add / remove 三种操作；path 用斜杠分隔层级；本轮无变化则不要输出该块。',
        ].join('\n')

  return [
    '<variable_state>',
    '当前追踪变量状态：',
    lines.join('\n'),
    '</variable_state>',
    '',
    '<variable_update_instruction>',
    rule,
    '</variable_update_instruction>',
  ].join('\n')
}
