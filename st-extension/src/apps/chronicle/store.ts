import type { AppHost } from '../../../../core/phone-registry'
import { readChatMetadata } from '../shared/chat-metadata'
import type { ChronicleContent, ChronicleData, ChronicleSettings } from './types'

export const CHRONICLE_KEY = 'st_stage_chronicle'
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}

/** AI JSON and chat metadata enter through the same content boundary. */
export function normalizeContent(value: unknown): ChronicleContent | null {
  const raw = record(value)
  if (typeof raw.summary !== 'string' || !raw.summary.trim() || typeof raw.text !== 'string' || !raw.text.trim()) return null
  return { summary: raw.summary.trim(), text: raw.text.trim(), timeSpan: typeof raw.timeSpan === 'string' ? raw.timeSpan.trim() : '',
    keyDialogue: Array.isArray(raw.keyDialogue) && raw.keyDialogue.every(item => typeof item === 'string') ? raw.keyDialogue : [] }
}

export function readChronicleData(): ChronicleData {
  const raw = record(readChatMetadata(CHRONICLE_KEY))
  const entries = (Array.isArray(raw.entries) ? raw.entries : []).flatMap(value => {
    const row = record(value), content = normalizeContent(row)
    if (!content || typeof row.code !== 'string' || !/^AM\d+$/.test(row.code)) return []
    return [{ ...content, code: row.code, createdAt: typeof row.createdAt === 'number' && Number.isFinite(row.createdAt) ? row.createdAt : 0 }]
  })
  return { v: 1, entries, lastMessageIndex: typeof raw.lastMessageIndex === 'number' && Number.isInteger(raw.lastMessageIndex) ? Math.max(-1, raw.lastMessageIndex) : -1 }
}

export function nextCode(data: ChronicleData): string {
  return `AM${String(data.entries.reduce((max, entry) => Math.max(max, Number(entry.code.slice(2))), 0) + 1).padStart(4, '0')}`
}

export function readChronicleSettings(host: AppHost): ChronicleSettings {
  const raw = record(host.getAppData())
  return { autoGenerate: raw.autoGenerate !== false, inject: raw.inject !== false, autoCalendar: raw.autoCalendar !== false,
    interval: typeof raw.interval === 'number' && Number.isFinite(raw.interval) ? Math.max(2, Math.min(20, Math.round(raw.interval))) : 4 }
}
