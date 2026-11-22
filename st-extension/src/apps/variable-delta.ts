/**
 * 变量树纯逻辑：类型判定、格式化/解析与相邻快照差异高亮（绿涨红跌）。
 */

import { t } from '../../../core/i18n'
import { getNested } from './path-utils'

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/**
 * 描述二元组叶子 [值, "描述"]（MVU 的 ValueWithDescription）。
 * 判据对齐 MVU 源码 + 降误判规则：长度 2、第二项字符串、第一项不是数组。
 */
export function isTupleLeaf(v: unknown): v is [unknown, string] {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' && !Array.isArray(v[0])
}

/** 把 message 变量包归一化到「变量根」：有 stat_data 子树就用它（MVU 结构），否则视为扁平 */
export function extractStatRootFrom(wrapper: Record<string, unknown>): {
  root: Record<string, unknown>
  wrapped: boolean
} {
  if (isPlainObject(wrapper.stat_data)) return { root: wrapper.stat_data, wrapped: true }
  return { root: wrapper, wrapped: false }
}

/** 供叶子展示与 JSON 编辑预填：字符串原样，对象/数组 JSON 化，其余 String() */
export function formatValue(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v, null, 2)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

/** 解析文本输入为实际值：null/true/false/数字/JSON 数组或对象，其余按字符串 */
export function parseInputValue(raw: string): unknown {
  const trimmed = raw.trim()
  if (trimmed === 'null') return null
  if (trimmed === 'true') return true
  if (trimmed === 'false') return false
  if (/^-?\d+(\.\d+)?$/.test(trimmed)) return Number(trimmed)
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      return JSON.parse(trimmed)
    } catch {
      // 非法 JSON → 当普通字符串
    }
  }
  return raw
}

export interface VariableEditDefinition {
  key: string
  type: 'number' | 'string' | 'boolean' | 'enum'
  range?: [number, number]
  enum?: string[]
}

export type VariableTreeCommitResult = { ok: true; value: unknown } | { ok: false; error: string }

export type EditKind = 'boolean' | 'number' | 'enum' | 'json' | 'text'

export function editKind(v: unknown, definition?: VariableEditDefinition): EditKind {
  if (definition?.type === 'number') return 'number'
  if (definition?.type === 'enum') return 'enum'
  if (definition?.type === 'boolean') return 'boolean'
  if (definition?.type === 'string') return 'text'
  if (typeof v === 'boolean') return 'boolean'
  if (v !== null && typeof v === 'object') return 'json'
  return 'text'
}

export function valueTypeLabel(v: unknown, tuple: boolean): string {
  const inner = tuple ? (v as [unknown, string])[0] : v
  if (inner === null) return 'null'
  if (Array.isArray(inner)) return t('variableTree.array', '数组[{{count}}]', { count: inner.length })
  if (typeof inner === 'object') return t('variableTree.object', '对象')
  return typeof inner === 'number'
    ? t('variableTree.number', '数字')
    : typeof inner === 'boolean'
      ? t('variableTree.boolean', '开关（是/否）')
      : t('variableTree.text', '文本')
}

export interface DeltaInfo {
  kind: 'inc' | 'dec' | 'changed' | 'added'
  diff?: number
}

function jsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/**
 * 对比 current 与 prev 两份变量对象，产出「路径 → 变化」映射，供叶子徽标显示。
 */
export function computeDelta(
  current: Record<string, unknown>,
  prev: Record<string, unknown> | null,
  isMvu: boolean,
): Map<string, DeltaInfo> {
  const delta = new Map<string, DeltaInfo>()
  if (!prev) return delta
  const walk = (obj: Record<string, unknown>, prefix: string): void => {
    for (const key of Object.keys(obj)) {
      const val = obj[key]
      const path = prefix ? `${prefix}.${key}` : key
      const tuple = isMvu && isTupleLeaf(val)
      if (!tuple && isPlainObject(val) && Object.keys(val).length > 0) {
        walk(val, path)
        continue
      }
      const curLeaf = tuple ? (val as [unknown, string])[0] : val
      const prevRaw = getNested(prev, path)
      if (prevRaw === undefined) {
        delta.set(path, { kind: 'added' })
        continue
      }
      const prevLeaf = isMvu && isTupleLeaf(prevRaw) ? prevRaw[0] : prevRaw
      if (typeof curLeaf === 'number' && typeof prevLeaf === 'number') {
        if (curLeaf !== prevLeaf) delta.set(path, { kind: curLeaf > prevLeaf ? 'inc' : 'dec', diff: curLeaf - prevLeaf })
      } else if (!jsonEqual(curLeaf, prevLeaf)) {
        delta.set(path, { kind: 'changed' })
      }
    }
  }
  walk(current, '')
  return delta
}
