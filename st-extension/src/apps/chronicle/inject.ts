import { parseSpanEnd, relationToToday } from '../shared/story-date'
import type { ChronicleEntry } from './types'

export function entryRelation(entry: ChronicleEntry, today: Date | null): string {
  const date = parseSpanEnd(entry.timeSpan)
  return date && today ? relationToToday(date, today) : ''
}

export function chronicleOverview(entries: ChronicleEntry[], today: Date | null): string {
  const rows = entries.map(entry => [entry.code, entryRelation(entry, today), entry.summary].filter(Boolean).join(' | '))
  let size = rows.join('\n').length
  while (size > 6000 && rows.length) size -= rows.shift()!.length + 1
  return rows.join('\n')
}

export function chronicleInjection(entries: ChronicleEntry[], today: Date | null): string {
  if (!entries.length) return ''
  const recent = entries.slice(-3).map(entry => [entry.code, entry.timeSpan, entry.text, ...entry.keyDialogue].filter(Boolean).join('\n')).join('\n\n')
  return `<已发生的事件概览>\n${chronicleOverview(entries, today)}\n</已发生的事件概览>\n<记忆回溯>\n${recent}\n</记忆回溯>`
}
