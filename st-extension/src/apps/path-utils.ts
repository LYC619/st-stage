/**
 * 点号路径的嵌套读写工具（纯函数，无 DOM 依赖）。
 * 变量树视图、MVU 数据层、新变量引擎共用；抽出以便核心逻辑不依赖视图模块。
 */

export function splitPath(path: string): string[] {
  return path.split('.').filter((seg) => seg.length > 0)
}

export function getNested(obj: Record<string, unknown>, path: string): unknown {
  let cur: unknown = obj
  for (const seg of splitPath(path)) {
    if (cur == null || typeof cur !== 'object') return undefined
    cur = (cur as Record<string, unknown>)[seg]
  }
  return cur
}

export function setNested(obj: Record<string, unknown>, path: string, value: unknown): void {
  const segs = splitPath(path)
  if (segs.length === 0) return
  let cur: Record<string, unknown> = obj
  for (let i = 0; i < segs.length - 1; i++) {
    const seg = segs[i]
    const next = cur[seg]
    if (next == null || typeof next !== 'object' || Array.isArray(next)) cur[seg] = {}
    cur = cur[seg] as Record<string, unknown>
  }
  cur[segs[segs.length - 1]] = value
}

export function deleteNested(obj: Record<string, unknown>, path: string): void {
  const segs = splitPath(path)
  if (segs.length === 0) return
  let cur: unknown = obj
  for (let i = 0; i < segs.length - 1; i++) {
    if (cur == null || typeof cur !== 'object') return
    cur = (cur as Record<string, unknown>)[segs[i]]
  }
  if (cur != null && typeof cur === 'object') delete (cur as Record<string, unknown>)[segs[segs.length - 1]]
}
