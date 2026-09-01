/**
 * 变量悬浮窗（Finding 7）的纯逻辑：把嵌套变量树压成一串可直接渲染的行。
 *
 * 定位：**只读速查**。编辑仍然走「MVU」/「新变量」App 的变量面板——
 * 悬浮窗要省掉的是「开手机 → 开 App → 滑动找变量」这三步，不是取代面板。
 * 因此这里没有任何写入路径，连 path 都只用于展示与去重。
 *
 * 为什么放 core：DOM 侧要拖动、要贴边、要记位置，逻辑混在一起就没法测；
 * 压平和取值格式化是纯函数，单测能覆盖全部分支。
 */

/** 一行展示：缩进深度 + 键名 + 值文本；分组行没有值。 */
export interface HudRow {
  /** 完整路径，如 "角色.好感度"；用作 key，不展示 */
  path: string
  /** 该层的键名 */
  key: string
  /** 缩进层级，0 起 */
  depth: number
  /** 叶子的值文本；分组行为 null */
  value: string | null
  /** MVU 的 [值,"描述"] 二元组里的描述，没有则为空串 */
  description: string
}

export interface HudSection {
  /** 来源标签，如 "MVU" / "新变量" */
  source: string
  rows: HudRow[]
  /** 该来源当前不可用时的说明；非空时 rows 为空 */
  notice: string
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v)
}

/** 与 variable-tree.isTupleLeaf 同一判据：长度 2、第二项字符串、第一项非数组。 */
function isTupleLeaf(v: unknown): v is [unknown, string] {
  return Array.isArray(v) && v.length === 2 && typeof v[1] === 'string' && !Array.isArray(v[0])
}

/** 叶子值 → 单行文本。对象/数组压成一行 JSON：悬浮窗是速查，不做多行展开。 */
export function formatHudValue(v: unknown): string {
  if (typeof v === 'string') return v
  if (v === null) return 'null'
  if (v === undefined) return ''
  if (typeof v === 'object') {
    try {
      return JSON.stringify(v)
    } catch {
      return String(v)
    }
  }
  return String(v)
}

/** 超长值截断：悬浮窗宽度有限，整段 JSON 挤进来会把面板撑爆。 */
export function clipHudValue(text: string, max = 80): string {
  const oneLine = text.replace(/\s+/g, ' ').trim()
  return oneLine.length > max ? `${oneLine.slice(0, max - 1)}…` : oneLine
}

/**
 * 变量根 → 展示行。深度优先，保持对象自身的键序（作者定义顺序通常有意义）。
 * maxDepth 之下的子树压成一行 JSON，避免深树把面板刷满。
 */
export function flattenVariables(
  root: unknown,
  maxDepth = 3,
): HudRow[] {
  const rows: HudRow[] = []
  if (!isPlainObject(root)) return rows

  const walk = (node: Record<string, unknown>, prefix: string, depth: number): void => {
    for (const [key, raw] of Object.entries(node)) {
      const path = prefix ? `${prefix}.${key}` : key

      if (isTupleLeaf(raw)) {
        rows.push({
          path,
          key,
          depth,
          value: clipHudValue(formatHudValue(raw[0])),
          description: raw[1],
        })
        continue
      }

      if (isPlainObject(raw)) {
        // 到深度上限就不再展开：压成一行 JSON 仍然「能看见」，只是不分行
        if (depth + 1 > maxDepth) {
          rows.push({
            path,
            key,
            depth,
            value: clipHudValue(formatHudValue(raw)),
            description: '',
          })
          continue
        }
        // 空对象作为叶子展示，否则会出现一个什么都没有的分组标题
        if (Object.keys(raw).length === 0) {
          rows.push({ path, key, depth, value: '{}', description: '' })
          continue
        }
        rows.push({ path, key, depth, value: null, description: '' })
        walk(raw, path, depth + 1)
        continue
      }

      rows.push({ path, key, depth, value: clipHudValue(formatHudValue(raw)), description: '' })
    }
  }

  walk(root, '', 0)
  return rows
}

/** 行数统计（不含分组行）：面板标题上显示「N 个变量」。 */
export function countLeafRows(rows: HudRow[]): number {
  return rows.filter((row) => row.value !== null).length
}
