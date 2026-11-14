// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { formatStoryDate, parseSpanEnd, relationToToday, storyToday } from './story-date'

afterEach(() => vi.unstubAllGlobals())
describe('story dates', () => {
  it('parses the end of a span and rejects impossible dates', () => {
    expect(formatStoryDate(parseSpanEnd('2026-01-02 10:00 ~ 2026-01-03 01:00')!)).toBe('2026-01-03')
    expect(formatStoryDate(parseSpanEnd('2024-02-29')!)).toBe('2024-02-29')
    expect(parseSpanEnd('2026-02-30')).toBeNull(); expect(parseSpanEnd('昨天')).toBeNull()
  })
  it.each([
    [0, '今天'], [1, '昨天'], [2, '前天'], [3, '3天前'], [6, '6天前'], [7, '一周前'], [8, '8天前'],
    [14, '14天前'], [15, '半个月前'], [16, '16天前'], [20, '20天前'], [21, '三周前'], [22, '22天前'],
    [29, '29天前'], [30, '一个月前'], [44, '一个月前'], [45, '一个半月前'], [60, '两个月前'],
    [179, '五个半月前'], [180, '半年前'], [359, '半年前'], [360, '一年前'], [539, '一年前'], [540, '一年半前'], [720, '两年前'],
  ] as const)('matches Yuzi buckets at %i days in both directions', (days, expected) => {
    const today = new Date(2026, 5, 10, 14), target = new Date(2026, 5, 10 - days, 2)
    expect(relationToToday(target, today)).toBe(expected)
    expect(relationToToday(today, target)).toBe(days === 0 ? '今天' : days === 1 ? '明天' : days === 2 ? '后天' : expected.replace(/前$/, '后'))
  })
  it('uses story-state first, then the latest chronicle, and never the real date', async () => {
    const entry = { code: 'AM0001', timeSpan: '2026-03-02 ~ 2026-03-03', summary: '概要', text: '正文', keyDialogue: [], createdAt: 1 }
    const meta: Record<string, unknown> = { st_stage_story_state: { stat_data: { 时间: { 年: 2026, 月: 4, 日: 5 } } }, st_stage_chronicle: { entries: [entry], lastMessageIndex: 0 } }
    vi.stubGlobal('SillyTavern', { getContext: () => ({ chat: [], chatMetadata: meta }) })
    const host = { getCharacterName: () => '角色' } as AppHost
    expect(formatStoryDate((await storyToday(host))!)).toBe('2026-04-05')
    delete meta.st_stage_story_state
    expect(formatStoryDate((await storyToday(host))!)).toBe('2026-03-03')
    entry.timeSpan = ''; expect(await storyToday(host)).toBeNull()
  })
})
