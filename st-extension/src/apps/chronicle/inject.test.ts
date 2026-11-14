// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import { chronicleInjection, chronicleOverview } from './inject'
import type { ChronicleEntry } from './types'

describe('chronicle prompt text', () => {
  const entries: ChronicleEntry[] = Array.from({ length: 120 }, (_, i) => ({ code: `AM${String(i + 1).padStart(4, '0')}`,
    timeSpan: '2026-01-01', summary: `概要${i}` + '事'.repeat(50), text: `正文${i}`, keyDialogue: [`甲：原话${i}`], createdAt: i }))
  it('drops oldest overview rows to fit 6000 characters and includes only three complete entries', () => {
    const overview = chronicleOverview(entries, new Date(2026, 0, 2)), injection = chronicleInjection(entries, new Date(2026, 0, 2))
    expect(overview.length).toBeLessThanOrEqual(6000); expect(overview).not.toContain('AM0001'); expect(overview).toContain('AM0120 | 昨天')
    expect(injection).toContain('<已发生的事件概览>'); expect(injection).toContain('<记忆回溯>')
    expect(injection).toContain('正文117'); expect(injection).toContain('甲：原话119'); expect(injection).not.toContain('正文116')
  })
  it('omits relative dates without an anchor and clears an empty history', () => {
    expect(chronicleOverview(entries.slice(0, 1), null)).not.toContain('昨天')
    expect(chronicleInjection([], null)).toBe('')
  })
})
