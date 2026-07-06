/**
 * 消息内插图：AI 回复中的插图标记 → 图床图片。
 *
 * 支持两种标记语法：
 * 1. [插图:编码] / [图:编码] —— 首选。纯文本方括号能原样穿过 ST 的 markdown 渲染与
 *    HTML 消毒（与 [立绘:xxx] 同族），本插件 prompt 注入使用该格式。
 * 2. <img>编码</img> / <illustration>编码</illustration> —— 兼容社区「catbox 正则」惯例；
 *    注意 <img> 是 HTML void 元素，经 ST 渲染后可能已被解析器拆掉，只在其以文本形式
 *    存活时能被识别（尽力而为）。
 *
 * 纯函数，DOM 操作由调用方（st 端 message-postprocess）执行。
 */

import { isValidImageCode } from './share-code'

// <img>ab12cd.png</img>：开闭标签一致，编码在捕获组 2
const HTML_STYLE_SOURCE = '<\\s*(img|illustration)\\s*>\\s*([^<]+?)\\s*<\\/\\s*\\1\\s*>'
// [插图:ab12cd.png]：全角/半角冒号与括号均容错，编码在捕获组 2（组 1 占位保持两种语法组号一致）
const BRACKET_STYLE_SOURCE = '[\\[【]\\s*(插图|图)\\s*[:：]\\s*([^\\]】]+?)\\s*[\\]】]'
const COMBINED_SOURCE = `${HTML_STYLE_SOURCE}|${BRACKET_STYLE_SOURCE}`

export interface InlineImageMatch {
  /** 原始完整匹配文本（用于替换） */
  raw: string
  /** 图床编码（已校验格式） */
  code: string
}

function codeOf(match: RegExpExecArray | string[]): string {
  // 组 2 = HTML 形编码，组 4 = 方括号形编码
  return (match[2] ?? match[4] ?? '').trim()
}

/** 提取文本中全部合法的插图标记（两种语法，按出现顺序） */
export function extractInlineImages(text: string): InlineImageMatch[] {
  const result: InlineImageMatch[] = []
  const regex = new RegExp(COMBINED_SOURCE, 'gi')
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    const code = codeOf(match)
    if (isValidImageCode(code)) result.push({ raw: match[0], code })
  }
  return result
}

/** 文本是否含插图标记（含非法编码的也算，用于快速判断是否需要处理） */
export function hasInlineImageMarkup(text: string): boolean {
  return new RegExp(COMBINED_SOURCE, 'i').test(text)
}

/**
 * 把插图标记替换为目标字符串。
 * replacer 返回 null 表示该处保持原文（编码非法的标记始终保持原文）。
 */
export function replaceInlineImages(
  text: string,
  replacer: (m: InlineImageMatch) => string | null,
): string {
  const regex = new RegExp(COMBINED_SOURCE, 'gi')
  return text.replace(regex, (raw, ...groups) => {
    // replace 回调参数：raw, p1, p2, p3, p4, offset, string
    const code = ((groups[1] as string | undefined) ?? (groups[3] as string | undefined) ?? '').trim()
    if (!isValidImageCode(code)) return raw
    const out = replacer({ raw, code })
    return out === null ? raw : out
  })
}
