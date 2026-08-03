const MAX_LABELS = 24
const MAX_LABEL_CODE_POINTS = 32
const MAX_NOTE_CODE_POINTS = 500

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
