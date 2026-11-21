/**
 * 新变量 `<UpdateVariable>` 更新块在消息气泡 DOM 中的偏移定位与摘除。
 * 独立于立绘/插图后处理，兼容 ST 折叠思考/摘要块后的可见文本偏移。
 */

export function updateBlockRanges(text: string): Array<{ start: number; end: number }> {
  const pattern = /<UpdateVariable(?:\s[^>]*)?>[\s\S]*?<\/UpdateVariable\s*>/gi
  return Array.from(text.matchAll(pattern), (match) => ({
    start: match.index,
    end: match.index + match[0].length,
  }))
}

export function hasUpdateBlock(text: string): boolean {
  return updateBlockRanges(text).length > 0
}

function stripMarkdownFence(text: string): string | null {
  const match = /^\s*```(?:json)?\s*\r?\n?([\s\S]*?)\r?\n?```\s*$/i.exec(text)
  return match ? match[1] : null
}

function normalizeWhitespace(text: string): string {
  return text.replace(/\s+/g, ' ').trim()
}

function visibleUpdateVariants(inner: string): string[] {
  const withAnalysis = inner
    .replace(/<Analysis(?:\s[^>]*)?>/gi, '')
    .replace(/<\/Analysis\s*>/gi, '')
  const withoutAnalysis = inner.replace(/<Analysis(?:\s[^>]*)?>[\s\S]*?<\/Analysis\s*>/gi, '')
  const variants = [withAnalysis, withoutAnalysis]
  const normalized = new Set<string>()
  for (const variant of variants) {
    const fenced = stripMarkdownFence(variant)
    for (const candidate of fenced === null ? [variant] : [variant, fenced]) {
      const value = normalizeWhitespace(candidate)
      if (value) normalized.add(value)
    }
  }
  return [...normalized]
}

function compactVisibleProjection(text: string): string {
  return text
    .replace(/<(?:thinking|reasoning|summary|history)(?:\s[^>]*)?>[\s\S]*?<\/(?:thinking|reasoning|summary|history)\s*>/gi, '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<[^>]*>/g, '')
    .replace(/```(?:json)?/gi, '')
    .replace(/\s+/g, '')
}

function edgeAnchors(text: string, edge: 'start' | 'end'): string[] {
  const lengths = [48, 24, 12, 8, 6, 4]
  const anchors: string[] = []
  for (const length of lengths) {
    if (text.length < length) continue
    const anchor = edge === 'start' ? text.slice(0, length) : text.slice(-length)
    if (!anchors.includes(anchor)) anchors.push(anchor)
  }
  if (anchors.length === 0 && text) anchors.push(text)
  return anchors
}

function rawContextMatches(
  rawPrefix: string,
  rawSuffix: string,
  visibleText: string,
  start: number,
  end: number,
): boolean {
  const prefix = compactVisibleProjection(rawPrefix)
  const suffix = compactVisibleProjection(rawSuffix)
  const before = visibleText.slice(0, start).replace(/\s+/g, '')
  const after = visibleText.slice(end).replace(/\s+/g, '')
  const prefixMatches = !prefix || edgeAnchors(prefix, 'end').some((anchor) => before.includes(anchor))
  const suffixMatches = !suffix || edgeAnchors(suffix, 'start').some((anchor) => after.includes(anchor))
  return prefixMatches && suffixMatches
}

function normalizeWhitespaceWithOffsets(text: string): { text: string; starts: number[]; ends: number[] } {
  let normalized = ''
  const starts: number[] = []
  const ends: number[] = []
  let index = 0

  while (index < text.length) {
    const start = index
    if (/\s/.test(text[index])) {
      while (index < text.length && /\s/.test(text[index])) index += 1
      normalized += ' '
    } else {
      index += 1
      normalized += text[start]
    }
    starts.push(start)
    ends.push(index)
  }

  let first = 0
  let last = normalized.length
  while (first < last && normalized[first] === ' ') first += 1
  while (last > first && normalized[last - 1] === ' ') last -= 1
  return {
    text: normalized.slice(first, last),
    starts: starts.slice(first, last),
    ends: ends.slice(first, last),
  }
}

export function sanitizedUpdateRange(rawMessage: string | null, visibleText: string): { start: number; end: number } | null {
  if (rawMessage === null) return null

  const openings = rawMessage.match(/<UpdateVariable(?:\s[^>]*)?>/gi) ?? []
  const closings = rawMessage.match(/<\/UpdateVariable\s*>/gi) ?? []
  if (openings.length !== 1 || closings.length !== 1) return null

  const block = /<UpdateVariable(?:\s[^>]*)?>([\s\S]*?)<\/UpdateVariable\s*>/i.exec(rawMessage)
  if (!block) return null
  const visible = normalizeWhitespaceWithOffsets(visibleText)
  const rawStart = block.index
  const rawEnd = rawStart + block[0].length
  for (const candidate of visibleUpdateVariants(block[1])) {
    const matches: number[] = []
    let from = 0
    while (from <= visible.text.length - candidate.length) {
      const index = visible.text.indexOf(candidate, from)
      if (index < 0) break
      matches.push(index)
      if (matches.length > 1) break
      from = index + 1
    }
    if (matches.length !== 1) continue

    const startIndex = matches[0]
    const start = visible.starts[startIndex]
    const end = visible.ends[startIndex + candidate.length - 1]
    if (!rawContextMatches(rawMessage.slice(0, rawStart), rawMessage.slice(rawEnd), visibleText, start, end)) {
      continue
    }
    return { start, end }
  }
  return null
}

/** 按 root.textContent 的全局偏移摘除文本，保留区块外已有的 DOM 结构。 */
export function removeTextRanges(root: HTMLElement, ranges: Array<{ start: number; end: number }>): void {
  if (ranges.length === 0) return
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let offset = 0
  let current: Node | null
  while ((current = walker.nextNode())) {
    const node = current as Text
    const value = node.nodeValue ?? ''
    const nodeStart = offset
    const nodeEnd = nodeStart + value.length
    offset = nodeEnd
    const cuts = ranges
      .filter((range) => range.start < nodeEnd && range.end > nodeStart)
      .map((range) => ({
        start: Math.max(0, range.start - nodeStart),
        end: Math.min(value.length, range.end - nodeStart),
      }))
    if (cuts.length === 0) continue
    let kept = ''
    let cursor = 0
    for (const cut of cuts) {
      kept += value.slice(cursor, cut.start)
      cursor = Math.max(cursor, cut.end)
    }
    node.nodeValue = kept + value.slice(cursor)
  }
}
