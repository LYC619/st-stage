/**
 * 命名规范（sprite-pack@2 起）：表情 tag、立绘包名、路径片段的统一清洗/校验。
 * 所有入口（上传文件名、导入 JSON、分享串、UI 改名）都必须过这里，
 * 保证 tag 可安全用于：[立绘:xxx] 标签语法、分享串 tag=code 键值对、HTML 文本节点。
 */

export const TAG_MAX_LENGTH = 20
export const PACK_NAME_MAX_LENGTH = 30
export const DESCRIPTION_MAX_LENGTH = 200

// 控制字符（U+0000–U+001F、U+007F）一律剔除
// eslint-disable-next-line no-control-regex -- 有意匹配控制字符以剔除
const CONTROL_CHARS = new RegExp('[\\u0000-\\u001f\\u007f]', 'g')
// tag 禁止字符：标签语法冲突（[]【】与冒号）、分享串分隔符（|=,，@）、路径/HTML 风险（/\<>"'`）
const TAG_FORBIDDEN = /[[\]【】|=,，:：@/\\<>"'`]/g
// 包名禁止字符：分享串分隔符（|=@）与 HTML 风险字符
const PACK_NAME_FORBIDDEN = /[|=@<>"'`]/g
// 路径片段：只保留字母、数字、CJK、空格、点、横线、下划线
const PATH_SEGMENT_ALLOWED = /[^0-9A-Za-z一-鿿぀-ヿ .\-_]/g

/** 清洗表情 tag：剔除禁止/控制字符、压缩空白、截断。结果可能为空串。 */
export function normalizeTag(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(TAG_FORBIDDEN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, TAG_MAX_LENGTH)
    .trim()
}

/** tag 是否已是规范形式（非空且无需清洗） */
export function isValidTag(tag: string): boolean {
  return tag.length > 0 && tag === normalizeTag(tag)
}

/** 上传文件名 → tag：去掉扩展名后按 tag 规则清洗 */
export function fileNameToTag(fileName: string): string {
  return normalizeTag(fileName.replace(/\.[^.]+$/, ''))
}

/** 批量文件名支持的分隔符：下划线、半角横杠、en dash、em dash、连续空白 */
const NAME_SEPARATOR = /[_\-–—\s]+/

/** 去扩展名 */
function stripExt(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, '')
}

/** 文件名解析结果（三级） */
export interface ParsedFileName {
  /** 人名（可空） */
  role: string
  /** 服装（可空） */
  outfit: string
  /** 图名（去扩展名后剩余部分，清洗但保留内部分隔符） */
  tag: string
}

/**
 * 上传文件名 → { 分组, 图名 }（功能②，旧签名保留给 Web 端）。
 * 按**首个**分隔符（_ - – — 空白）拆「分组/图名」，其余全部保留为图名；
 * 拆不出两段时退回 fallbackGroup + 整名为图名。
 */
export function parseUploadName(
  fileName: string,
  fallbackGroup = '',
): { group: string; tag: string } {
  const base = stripExt(fileName)
  const m = base.match(NAME_SEPARATOR)
  if (m && m.index !== undefined && m.index > 0) {
    const group = normalizeTag(base.slice(0, m.index))
    const tag = normalizeTag(base.slice(m.index + m[0].length))
    if (group && tag) return { group, tag }
  }
  return { group: normalizeTag(fallbackGroup), tag: fileNameToTag(fileName) }
}

/**
 * 三级文件名解析（八期）：按 _ - – — 空白 分隔，最多拆前两个分隔位置，其余全部保留为图名。
 * - "鸣人-居家服-开心-闭眼.png" → role=鸣人, outfit=居家服, tag=「开心-闭眼」
 * - "鸣人_微笑.png" → role=鸣人, outfit='', tag=微笑
 * - "微笑.png" → role='', outfit='', tag=微笑
 * 图名保留内部分隔符（normalizeTag 不剔除 - _，只清洗禁止字符）。
 * 拆出的人名/服装清洗后为空则相应降级。
 */
export function parseSpriteFileName(fileName: string): ParsedFileName {
  const base = stripExt(fileName).trim()
  // 最多切成 3 段：前两个分隔符切开，第三段（含其内部分隔符）整体保留为图名
  const parts = splitAtMost(base, NAME_SEPARATOR, 3)

  if (parts.length >= 3) {
    const role = normalizeTag(parts[0])
    const outfit = normalizeTag(parts[1])
    const tag = normalizeTag(parts[2])
    if (role && outfit && tag) return { role, outfit, tag }
    if (role && tag) return { role, outfit: '', tag } // 服装段清洗后为空 → 降为两级
    return { role: '', outfit: '', tag: fileNameToTag(base) }
  }
  if (parts.length === 2) {
    const role = normalizeTag(parts[0])
    const tag = normalizeTag(parts[1])
    if (role && tag) return { role, outfit: '', tag }
    return { role: '', outfit: '', tag: fileNameToTag(base) }
  }
  return { role: '', outfit: '', tag: fileNameToTag(base) }
}

/** 按分隔符正则最多切 n 段：前 n-1 个分隔符切开，剩余整体作最后一段 */
function splitAtMost(text: string, sep: RegExp, n: number): string[] {
  const out: string[] = []
  let rest = text
  const single = new RegExp(sep.source)
  while (out.length < n - 1) {
    const m = single.exec(rest)
    if (!m || m.index < 0) break
    out.push(rest.slice(0, m.index))
    rest = rest.slice(m.index + m[0].length)
  }
  out.push(rest)
  return out
}

/** 清洗立绘包名/作者名。结果可能为空串，调用方需给默认值。 */
export function sanitizePackName(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(PACK_NAME_FORBIDDEN, '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, PACK_NAME_MAX_LENGTH)
    .trim()
}

/** 清洗描述文本：只剔除控制字符与 HTML 风险字符，保留较长内容 */
export function sanitizeDescription(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, DESCRIPTION_MAX_LENGTH)
    .trim()
}

/** 清洗文件路径片段（如按角色名建的图片子目录），结果可能为空串 */
export function sanitizePathSegment(raw: string): string {
  return raw
    .replace(CONTROL_CHARS, '')
    .replace(PATH_SEGMENT_ALLOWED, '')
    .replace(/\.{2,}/g, '.') // 折叠连续点，杜绝 ".." 路径穿越
    .replace(/^[. ]+|[. ]+$/g, '') // 首尾的点/空格（Windows 目录名也不允许结尾点）
    .slice(0, 40)
    .trim()
}
