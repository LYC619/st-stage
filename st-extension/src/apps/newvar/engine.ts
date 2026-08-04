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

import { getNested, setNested, deleteNested, isSafePath } from '../path-utils'
import { parseLegacySetCalls } from './legacy-set-parser'
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

/**
 * 用 schema 默认值补齐状态里缺失的路径（快照存在后新定义的变量不会凭空出现在旧快照里——
 * 不补齐会导致树上看不到、注入里出现 undefined）。已有值一律不动，返回新对象。
 */
export function fillDefaults(state: Record<string, unknown>, schema: VariableSchema): Record<string, unknown> {
  const next = clone(state)
  for (const def of schema.variables) {
    if (getNested(next, def.key) === undefined) setNested(next, def.key, clone(def.default))
  }
  return next
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

function exampleValue(def: VariableDefinition): unknown {
  if (def.type === 'number') return def.range?.[0] ?? 0
  if (def.type === 'boolean') return true
  if (def.type === 'enum') return def.enum?.[0] ?? ''
  return '新值'
}

function dottedToPointer(path: string): string {
  const segments = path.split('.').map((segment) => segment.replace(/~/g, '~0').replace(/\//g, '~1'))
  return `/${segments.join('/')}`
}

function serializeExampleValue(value: unknown): string {
  return JSON.stringify(value) ?? 'null'
}

// —— 解析 <UpdateVariable> —— //

const BLOCK_RE = /<UpdateVariable>([\s\S]*?)<\/UpdateVariable>/i
const ANALYSIS_RE = /<Analysis>[\s\S]*?<\/Analysis>/gi

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
  const rejected: NonNullable<ParsedBlock['rejected']> = []
  for (const [index, raw] of parsed.entries()) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
      rejected.push({ index, reason: '补丁条目必须是对象' })
      continue
    }
    const o = raw as Record<string, unknown>
    const op = o.op
    const pointer = o.path
    if (op !== 'replace' && op !== 'add' && op !== 'remove') {
      rejected.push({ index, reason: 'op 只允许 add、replace 或 remove' })
      continue
    }
    if (typeof pointer !== 'string') {
      rejected.push({ index, reason: 'path 必须是非空字符串' })
      continue
    }
    const path = pointerToDotted(pointer).trim()
    if (!path) {
      rejected.push({ index, reason: 'path 不能为空' })
      continue
    }
    if (!isSafePath(path)) {
      rejected.push({ index, reason: 'path 包含危险字段' })
      continue
    }
    if (op !== 'remove' && !Object.prototype.hasOwnProperty.call(o, 'value')) {
      rejected.push({ index, reason: `${op} 操作缺少 value` })
      continue
    }
    ops.push({ op, path, value: o.value })
  }
  return { found: true, ops, ...(rejected.length > 0 ? { rejected } : {}) }
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
  const parsed = parseLegacySetCalls(inner)
  const ops: PatchOp[] = parsed.calls.map((call) => ({ op: 'replace', path: call.path, value: call.newValue }))
  return {
    found: true,
    ops,
    ...(parsed.errors.length > 0 ? { error: parsed.errors.join('；') } : {}),
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
    if (!op.path.trim() || !isSafePath(op.path)) {
      log.push({ path: op.path, status: 'rejected', detail: '变量路径为空或包含危险字段' })
      continue
    }
    const def = defByKey.get(op.path)
    if (op.op === 'remove') {
      if (hasSchema && !def) {
        log.push({ path: op.path, status: 'rejected', detail: 'remove 只能删除 schema 中定义的叶子变量' })
        continue
      }
      deleteNested(next, op.path)
      log.push({ path: op.path, status: 'removed' })
      continue
    }
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

/**
 * 生成注入文本。三段式结构对齐 MVU 世界书的三个条目（当前变量列表 / 变量更新规则 / 变量输出格式）：
 * 逐变量 check 规则 + 先 <Analysis> 后命令，是参考卡里让 AI 稳定守规矩的关键写法。
 */
export function buildInjection(
  state: Record<string, unknown>,
  schema: VariableSchema,
  format: OutputFormat,
): string {
  const visible = schema.variables.filter((v) => !v.hidden)

  // ① 当前状态
  const stateLines = visible.map((v) => {
    const value = getNested(state, v.key)
    const desc = v.description ? `  // ${v.description}` : ''
    return `  ${v.key}: ${JSON.stringify(value)}${desc}`
  })

  // ② 逐变量更新规则：自动约束行（类型/范围/枚举）+ 用户自定义 check 行
  const ruleLines: string[] = []
  for (const v of visible) {
    const checks: string[] = []
    if (v.type === 'number') {
      checks.push(v.range ? `数字，范围 ${v.range[0]}~${v.range[1]}（超出会被裁剪）` : '数字')
      checks.push('输出更新后的完整数值（禁止输出 "+3" 这类增量表达式，自己算好结果）')
    } else if (v.type === 'enum') {
      checks.push(`只能取：${(v.enum ?? []).join(' / ')}`)
    } else if (v.type === 'boolean') {
      checks.push('布尔值 true / false')
    } else {
      checks.push('文本')
    }
    if (v.updateRule) {
      for (const line of v.updateRule.split('\n')) {
        const t = line.trim()
        if (t) checks.push(t)
      }
    }
    ruleLines.push(`  ${v.key}:`)
    for (const c of checks) ruleLines.push(`    - ${c}`)
  }

  // ③ 输出格式（含 <Analysis>：先逐条分析再输出命令，参考卡实测能显著减少乱填）
  const exampleDef = visible[0]
  const example = exampleDef?.key ?? '变量路径'
  const examplePatchValue = exampleDef ? exampleValue(exampleDef) : '新值'
  const currentExampleValue = exampleDef ? getNested(state, example) : '旧值'
  const examplePatch = JSON.stringify([
    { op: 'replace', path: dottedToPointer(example), value: examplePatchValue },
  ])
  const formatLines =
    format === 'lodash_set'
      ? [
          '- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块',
          '- 块内每行一条命令：_.set(\'变量路径\', 旧值, 新值);//变化原因',
          '格式示例：',
          '<UpdateVariable>',
          `_.set(${JSON.stringify(example)}, ${serializeExampleValue(currentExampleValue)}, ${serializeExampleValue(examplePatchValue)});//原因`,
          '</UpdateVariable>',
        ]
      : [
          '- 在回复正文全部结束后，若本轮有变量变化，追加一个 <UpdateVariable> 块；没有变化则不要输出该块',
          '- 块内先写 <Analysis>（中文，不超过 60 字）：逐条对照上面的更新规则，说明哪些变量该更新、更新到多少',
          '- 然后输出严格符合 JSON Patch (RFC 6902) 的 JSON 数组，只允许 replace / add / remove 三种操作',
          '- path 用斜杠分隔层级（如 /状态/体力）；value 是更新后的完整值',
          '格式示例：',
          '<UpdateVariable>',
          `<Analysis>${example} 按规则更新为 ${JSON.stringify(examplePatchValue)}。</Analysis>`,
          examplePatch,
          '</UpdateVariable>',
        ]

  return [
    '<status_current_variable>',
    '当前变量状态：',
    stateLines.join('\n'),
    '</status_current_variable>',
    '',
    '<variable_update_rule>',
    '各变量的更新规则（check 条件不满足时，不要更新对应变量）：',
    ruleLines.join('\n'),
    '</variable_update_rule>',
    '',
    '<variable_update_format>',
    formatLines.join('\n'),
    '</variable_update_format>',
  ].join('\n')
}
