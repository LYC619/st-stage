/**
 * 紧凑分享串（stpack1）：把「图床编码型立绘包」压成一行文本，方便聊天窗口粘贴分享。
 *
 * 格式：stpack1:包名|@host=https://files.catbox.moe/|@author=作者|微笑=ab12cd.png|害羞=xy34zw.png
 * - 以 | 分段；首段为包名；@ 开头的段是元数据（host / author）；其余段为 tag=编码
 * - @host 省略时使用默认图床（DEFAULT_IMAGE_HOST）
 * - tag 与包名的字符约束由 core/naming.ts 保证（不含 | = @ 等分隔符）
 * - 仅「图床编码型」立绘（有 code 字段）可参与分享；本地/内嵌图会被跳过并提示
 */

import type { Sprite, SpritePack } from './types'
import { DEFAULT_IMAGE_HOST, formatAddress, parseAddress, spriteAddress } from './types'
import { genId } from './sprite-store'
import { normalizeTag, sanitizePackName } from './naming'

export const SHARE_PREFIX = 'stpack1:'
export const SHARE_PREFIX_V2 = 'stpack2:'

/** 图床编码：URL 最后一段文件名，如 "ab12cd.png" */
const CODE_REGEX = /^[0-9A-Za-z][0-9A-Za-z._-]{0,63}$/

export function isValidImageCode(code: string): boolean {
  return CODE_REGEX.test(code) && !code.includes('..')
}

/** 从图床 URL 提取编码（最后一段路径）；非 http(s) 或格式不符返回 null */
export function extractImageCode(url: string): string | null {
  if (!/^https?:\/\//.test(url)) return null
  const withoutQuery = url.split(/[?#]/)[0]
  const seg = withoutQuery.split('/').pop() ?? ''
  return isValidImageCode(seg) ? seg : null
}

export interface ShareEncodeResult {
  /** 一行分享串 */
  text: string
  /** 参与分享的立绘数量 */
  included: number
  /** 因非图床图源（本地/内嵌）或编码缺失而跳过的 tag */
  skipped: string[]
}

/**
 * 编码分享串。规则：
 * - 只收录「url 以 code 结尾」的图床立绘；其余进 skipped
 * - 图床前缀取第一张合格立绘的前缀；前缀不同的立绘也进 skipped（一串一图床）
 * - 没有任何合格立绘时返回 null
 */
export function encodeShareString(pack: SpritePack): ShareEncodeResult | null {
  const entries: Array<{ tag: string; code: string }> = []
  const skipped: string[] = []
  let host: string | null = null

  for (const sprite of pack.sprites) {
    const code = sprite.code ?? extractImageCode(sprite.url)
    if (!code || !sprite.url.startsWith('http') || !sprite.url.endsWith(code)) {
      skipped.push(sprite.tag)
      continue
    }
    const prefix = sprite.url.slice(0, sprite.url.length - code.length)
    if (host === null) host = prefix
    if (prefix !== host) {
      skipped.push(sprite.tag)
      continue
    }
    entries.push({ tag: sprite.tag, code })
  }

  if (entries.length === 0 || host === null) return null

  const segments: string[] = [sanitizePackName(pack.name) || '分享立绘包']
  if (host !== DEFAULT_IMAGE_HOST) segments.push(`@host=${host}`)
  if (pack.author) segments.push(`@author=${sanitizePackName(pack.author)}`)
  for (const e of entries) segments.push(`${e.tag}=${e.code}`)

  return { text: SHARE_PREFIX + segments.join('|'), included: entries.length, skipped }
}

/**
 * 解码分享串为新立绘包（自动识别 stpack1 / stpack2；生成新 id）。
 * 输入不可信（聊天粘贴），非法格式抛出带中文说明的 Error。
 */
export function decodeShareString(raw: string): SpritePack {
  const text = raw.trim()
  if (text.indexOf(SHARE_PREFIX_V2) !== -1) return decodeShareStringV2(text)
  return decodeShareStringV1(text)
}

/**
 * 解码 stpack1（共享图床前缀 + tag=编码）。
 */
export function decodeShareStringV1(raw: string): SpritePack {
  const text = raw.trim()
  const prefixIndex = text.indexOf(SHARE_PREFIX)
  if (prefixIndex === -1) {
    throw new Error(`导入失败：没有找到 ${SHARE_PREFIX} 开头的分享串`)
  }
  const body = text.slice(prefixIndex + SHARE_PREFIX.length).trim()
  const segments = body.split('|')

  const name = sanitizePackName(segments[0] ?? '') || '分享立绘包'
  let host = DEFAULT_IMAGE_HOST
  let author: string | undefined
  const sprites: Array<{ tag: string; url: string; code: string }> = []
  const seenTags = new Set<string>()

  for (const segment of segments.slice(1)) {
    const part = segment.trim()
    if (!part) continue

    if (part.startsWith('@')) {
      const eq = part.indexOf('=')
      if (eq === -1) continue
      const key = part.slice(1, eq).trim().toLowerCase()
      const value = part.slice(eq + 1).trim()
      if (key === 'host' && /^https?:\/\/.+/.test(value)) {
        host = value.endsWith('/') ? value : `${value}/`
      } else if (key === 'author') {
        author = sanitizePackName(value) || undefined
      }
      continue
    }

    const eq = part.indexOf('=')
    if (eq === -1) continue
    const tag = normalizeTag(part.slice(0, eq))
    const code = part.slice(eq + 1).trim()
    if (!tag || !isValidImageCode(code) || seenTags.has(tag)) continue
    seenTags.add(tag)
    sprites.push({ tag, url: host + code, code })
  }

  if (sprites.length === 0) {
    throw new Error('导入失败：分享串中没有可用的「表情=编码」条目')
  }

  // host 出现在 tag=code 之后也要生效：统一按最终 host 重建 URL
  const finalSprites = sprites.map((s) => ({ ...s, url: host + s.code }))

  return { id: genId(), name, author, sprites: finalSprites, updatedAt: new Date().toISOString() }
}

/* ==================== stpack2（九期：三级地址 + 每图独立完整 URL） ==================== */

/**
 * stpack2 格式（一行）：每张图片带完整独立 URL（支持 imgbb 不同路径），地址支持三级。
 *   stpack2:包名|@author=作者|微笑=https://i.ibb.co/aa/smile.png|鸣人/居家服/生气=https://i.ibb.co/bb/x.png
 * - 首段包名；@author 元数据；其余段为 `地址=完整URL`
 * - 地址 = 图名 / 人名/图名 / 人名/服装/图名（人名服装图名各自不含 / = |）
 * - 按**首个** = 拆地址与 URL（地址不含 =，URL 的 query 中的 = 归入 URL）
 */

/** 取立绘用于分享的远程地址：remoteUrl 优先，其次 http(s) 的 url；无则 null（本地/内嵌） */
function shareableUrl(sprite: Sprite): string | null {
  if (sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl)) return sprite.remoteUrl
  if (/^https?:\/\//.test(sprite.url)) return sprite.url
  return null
}

export interface ShareEncodeResultV2 {
  text: string
  /** 参与分享的立绘数 */
  included: number
  /** 立绘总数（含无法分享的） */
  total: number
  /** 缺少远程地址、无法分享的立绘地址标签 */
  missing: string[]
}

/**
 * 编码 stpack2。完整性预检：无远程地址的立绘计入 missing（不静默丢弃）。
 * 没有任何可分享立绘时返回 null。
 */
export function encodeShareStringV2(pack: SpritePack): ShareEncodeResultV2 | null {
  const entries: string[] = []
  const missing: string[] = []
  for (const sprite of pack.sprites) {
    const addr = formatAddress(spriteAddress(pack, sprite))
    const url = shareableUrl(sprite)
    if (!url) {
      missing.push(addr)
      continue
    }
    entries.push(`${addr}=${url}`)
  }
  if (entries.length === 0) return null

  const segments: string[] = [sanitizePackName(pack.name) || '分享立绘包']
  if (pack.author) segments.push(`@author=${sanitizePackName(pack.author)}`)
  segments.push(...entries)

  return {
    text: SHARE_PREFIX_V2 + segments.join('|'),
    included: entries.length,
    total: pack.sprites.length,
    missing,
  }
}

/** 解码 stpack2 为新立绘包（每图独立 URL；生成新 id）。 */
export function decodeShareStringV2(raw: string): SpritePack {
  const text = raw.trim()
  const prefixIndex = text.indexOf(SHARE_PREFIX_V2)
  if (prefixIndex === -1) {
    throw new Error(`导入失败：没有找到 ${SHARE_PREFIX_V2} 开头的分享串`)
  }
  const body = text.slice(prefixIndex + SHARE_PREFIX_V2.length).trim()
  const segments = body.split('|')

  const name = sanitizePackName(segments[0] ?? '') || '分享立绘包'
  let author: string | undefined
  const sprites: Sprite[] = []
  const seen = new Set<string>()

  for (const segment of segments.slice(1)) {
    const part = segment.trim()
    if (!part) continue
    if (part.startsWith('@')) {
      const eq = part.indexOf('=')
      if (eq === -1) continue
      const key = part.slice(1, eq).trim().toLowerCase()
      const value = part.slice(eq + 1).trim()
      if (key === 'author') author = sanitizePackName(value) || undefined
      continue
    }
    const eq = part.indexOf('=')
    if (eq === -1) continue
    const addr = part.slice(0, eq).trim()
    const url = part.slice(eq + 1).trim()
    if (!/^https?:\/\//.test(url)) continue // 防 javascript: 等注入
    const { role, outfit, tag: rawTag } = parseAddress(addr)
    const tag = normalizeTag(rawTag)
    const cleanRole = normalizeTag(role)
    const cleanOutfit = normalizeTag(outfit)
    if (!tag) continue
    const key = `${cleanRole}|${cleanOutfit}|${tag}`
    if (seen.has(key)) continue
    seen.add(key)
    const code = extractImageCode(url) ?? undefined
    sprites.push({
      tag,
      url,
      remoteUrl: url,
      ...(code ? { code } : {}),
      ...(cleanRole ? { group: cleanRole } : {}),
      ...(cleanOutfit ? { outfit: cleanOutfit } : {}),
    })
  }

  if (sprites.length === 0) {
    throw new Error('导入失败：分享串中没有可用的「地址=URL」条目')
  }

  return { id: genId(), name, author, sprites, updatedAt: new Date().toISOString() }
}
