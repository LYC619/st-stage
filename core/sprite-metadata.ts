const MAX_LABELS = 24
const MAX_LABEL_CODE_POINTS = 32
const MAX_NOTE_CODE_POINTS = 500

export type CompactNumberedTagEntry =
  | { kind: 'range'; label: string; values: string[] }
  | { kind: 'tag'; label: string; values: string[] }

interface NumberedTag {
  prefix: string
  suffix: string
  value: bigint
}

function parseNumberedTag(tag: string): NumberedTag | null {
  const match = /^(.+?)(\d+)$/u.exec(tag)
  if (!match) return null
  return { prefix: match[1], suffix: match[2], value: BigInt(match[2]) }
}

function hasCoherentSuffixFormatting(tags: NumberedTag[]): boolean {
  const canonical = tags.every((tag) => tag.suffix === tag.value.toString())
  const width = tags[0]?.suffix.length
  const fixedWidth = width !== undefined && tags.every((tag) => tag.suffix.length === width)
  return canonical || fixedWidth
}

/** 按输入顺序压缩同前缀、连续递增的数字后缀；短段与断段保持真实图名原样。 */
export function compactNumberedTags(
  tags: string[],
  reservedTags: Iterable<string> = tags,
): CompactNumberedTagEntry[] {
  const uniqueTags = [...new Set(tags)]
  const reserved = new Set(tags)
  for (const tag of reservedTags) reserved.add(tag)
  const entries: CompactNumberedTagEntry[] = []
  let index = 0
  while (index < uniqueTags.length) {
    const first = parseNumberedTag(uniqueTags[index])
    if (!first) {
      entries.push({ kind: 'tag', label: uniqueTags[index], values: [uniqueTags[index]] })
      index++
      continue
    }

    let end = index + 1
    let previous = first.value
    while (end < uniqueTags.length) {
      const next = parseNumberedTag(uniqueTags[end])
      if (!next || next.prefix !== first.prefix || next.value !== previous + 1n) break
      previous = next.value
      end++
    }

    const values = uniqueTags.slice(index, end)
    const numbered = values.map((tag) => parseNumberedTag(tag)!)
    const last = numbered[numbered.length - 1]
    const label = `${first.prefix}${first.suffix}-${last.suffix}`
    if (values.length >= 3 && hasCoherentSuffixFormatting(numbered) && !reserved.has(label)) {
      entries.push({
        kind: 'range',
        label,
        values,
      })
    } else {
      entries.push(...values.map((tag) => ({ kind: 'tag' as const, label: tag, values: [tag] })))
    }
    index = end
  }
  return entries
}

function clipCodePoints(value: string, limit: number): string {
  return Array.from(value).slice(0, limit).join('').trim()
}

export function normalizeLabels(raw: unknown): string[] {
  if (!Array.isArray(raw)) return []

  const labels: string[] = []
  const seen = new Set<string>()
  for (const value of raw) {
    if (typeof value !== 'string') continue

    const label = clipCodePoints(value.trim(), MAX_LABEL_CODE_POINTS)
    if (!label || seen.has(label)) continue

    seen.add(label)
    labels.push(label)
    if (labels.length === MAX_LABELS) break
  }
  return labels
}

export function normalizeNote(raw: unknown): string {
  return typeof raw === 'string'
    ? clipCodePoints(raw.trim(), MAX_NOTE_CODE_POINTS)
    : ''
}

export function normalizeOutfitNotes(raw: unknown): Record<string, string> {
  const notes = Object.create(null) as Record<string, string>
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return notes

  for (const [rawOutfit, rawNote] of Object.entries(raw)) {
    const outfit = rawOutfit.trim()
    const note = normalizeNote(rawNote)
    if (outfit && note) notes[outfit] = note
  }
  return notes
}
