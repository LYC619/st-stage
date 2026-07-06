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
