// @vitest-environment node

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import * as ai from '../shared/story-ai'
import * as dates from '../shared/story-date'
import * as calendar from './calendar'
import { CALENDAR_KEY, calendarWindow, generateCalendar, normalizeCalendar, readCalendar } from './calendar'
import { createCalendarController } from './calendar-controller'
import { chronicleInjection, chronicleOverview } from './inject'
import type { ChronicleEntry } from './types'

let cancel = () => {}

afterEach(() => {
  cancel()
  cancel = () => {}
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

const mkDay = (date: string) => ({
  date,
  festival: '',
  event: `${date} 公共检修`,
  status: '上班/上学',
  weather: '晴',
  content: '公共场馆检修安排。',
})

function installSTHost(getCtx: () => Record<string, unknown>) {
  const st = { getContext: getCtx }
  vi.stubGlobal('SillyTavern', st)
  vi.stubGlobal('window', { SillyTavern: st })
}

describe('chronicle prompt injection & 7-day public calendar', () => {
  it('caps chronicle overview at 6000 chars and injects only the latest 3 complete entries', () => {
    const entries: ChronicleEntry[] = Array.from({ length: 120 }, (_, i) => ({
      code: `AM${String(i + 1).padStart(4, '0')}`,
      timeSpan: '2026-01-01',
      summary: `概要${i}` + '事'.repeat(50),
      text: `正文${i}`,
      keyDialogue: [`甲：原话${i}`],
      createdAt: i,
    }))
    const overview = chronicleOverview(entries, new Date(2026, 0, 2))
    const injection = chronicleInjection(entries, new Date(2026, 0, 2))
    expect(overview.length).toBeLessThanOrEqual(6000)
    expect(overview).not.toContain('AM0001')
    expect(overview).toContain('AM0120 | 昨天')
    expect(injection).toContain('正文117')
    expect(injection).not.toContain('正文116')
    expect(chronicleInjection([], null)).toBe('')
  })

  it('fills missing calendar days incrementally, validates AI output, and discards switched-chat results', async () => {
    expect(calendarWindow(new Date(2026, 0, 1))).toEqual([
      '2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04',
    ])
    expect(normalizeCalendar({ days: [mkDay('2026-02-30'), { ...mkDay('2026-01-01'), event: ' ' }, { ...mkDay('2026-01-02'), status: '上班', weather: '暴雨' }] }).days)
      .toEqual([{ ...mkDay('2026-01-02'), status: '', weather: '' }])

    let chatId = 'one', settings: Record<string, unknown> = {}
    const metadata: Record<string, unknown> = {}
    const save = vi.fn(async () => {})
    installSTHost(() => ({ chatId, chat: [], chatMetadata: metadata, saveMetadata: save }))
    const host = {
      getCharacterName: () => '角色',
      getAppData: () => settings,
      getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test', profile: { includeWorldbook: false } } } } }),
    } as unknown as AppHost
    const controller = createCalendarController(host, vi.fn())
    cancel = controller.cancel

    const today = vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 0, 1))
    const request = vi.spyOn(ai, 'requestChat').mockImplementation(async (_cfg, messages) => {
      const missing = JSON.parse(messages[1].content.match(/只补这些日期：(\[[^\n]+\])/)![1]) as string[]
      return JSON.stringify({ days: missing.map(mkDay) })
    })

    await controller.trigger()
    expect(readCalendar().days).toHaveLength(7)
    today.mockResolvedValue(new Date(2026, 0, 2))
    await controller.trigger()
    expect(request.mock.calls[1][1][1].content).toContain('只补这些日期：["2026-01-05"]')

    vi.spyOn(ai, 'requestChat').mockResolvedValueOnce(JSON.stringify({ days: [mkDay('2026-01-01'), mkDay('2026-01-02'), mkDay('1999-01-01')] }))
    expect(await generateCalendar(host, new Date(2026, 0, 1), ['2026-01-02'], [mkDay('2026-01-01')], new AbortController().signal))
      .toEqual([mkDay('2026-01-02')])

    settings = { autoCalendar: false }
    const callsBefore = request.mock.calls.length
    await controller.trigger()
    expect(request.mock.calls.length).toBe(callsBefore)

    delete metadata[CALENDAR_KEY]
    save.mockClear()
    let finishSwitch!: (v: string) => void
    request.mockReturnValueOnce(new Promise((r) => { finishSwitch = r }))
    const switchedWork = controller.trigger(true)
    await vi.waitFor(() => expect(finishSwitch).toBeDefined())
    chatId = 'two'
    controller.cancel()
    finishSwitch(JSON.stringify({ days: calendarWindow(new Date(2026, 0, 1)).map(mkDay) }))
    await switchedWork
    expect(save).not.toHaveBeenCalled()
    expect(metadata[CALENDAR_KEY]).toBeUndefined()
  })

  it('preserves concurrent manual notes, rejects empty/mismatched forceRewrite, and defers autoCalendar until AI connects', async () => {
    for (const action of ['create', 'edit', 'delete'] as const) {
      const metadata = { [CALENDAR_KEY]: { v: 1, days: [], notes: action === 'create' ? {} : { '2026-11-23': 'Before' } } }
      installSTHost(() => ({ chatId: 'A', chatMetadata: metadata, saveMetadata: async () => {} }))
      const host = { getCharacterName: () => 'Role', getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test' } } } }), getAppData: () => ({}) } as unknown as AppHost
      vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 10, 23))
      let finishGen!: (days: calendar.CalendarDay[]) => void
      vi.spyOn(calendar, 'generateCalendar').mockReturnValueOnce(new Promise((r) => { finishGen = r }))
      const ctrl = createCalendarController(host, () => {})
      cancel = ctrl.cancel
      const work = ctrl.trigger(true)
      await vi.waitFor(() => expect(finishGen).toBeDefined())
      const note = action === 'delete' ? '' : 'Meet at the harbor'
      await calendar.saveCalendarNote(host, '2026-11-23', note)
      finishGen([{ date: '2026-11-23', festival: '', event: 'Market', status: '', weather: '', content: 'Open' }])
      await work
      expect(readCalendar().notes?.['2026-11-23']).toBe(note || undefined)
      vi.restoreAllMocks()
    }

    const existingDays = calendarWindow(new Date(2026, 10, 23)).map((d) => ({ ...mkDay(d), event: `既有-${d}` }))
    const meta2: Record<string, unknown> = { [CALENDAR_KEY]: { v: 1, days: existingDays } }
    installSTHost(() => ({ chatId: 'A', chatMetadata: meta2, saveMetadata: async () => {} }))
    vi.stubGlobal('fetch', vi.fn(async () => ({
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: JSON.stringify({ days: [{ date: '1999-01-01', event: '错年' }] }) } }] }),
    }) as Response))
    let aiConnected = false
    const host2 = {
      getCharacterName: () => 'Role',
      getChatMessages: () => [],
      getSettings: () => ({ apps: aiConnected ? { 'wechat-sister': { config: { apiKey: 'test', apiUrl: 'https://api.deepseek.com/chat/completions' } } } : {} }),
      getAppData: () => ({ autoCalendar: true }),
    } as unknown as AppHost
    vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 10, 23))

    const ctrl2 = createCalendarController(host2, () => {})
    cancel = ctrl2.cancel
    await ctrl2.trigger(false)
    expect(ctrl2.status().error).toBe('')

    aiConnected = true
    await ctrl2.trigger(true, true)
    expect(readCalendar().days).toHaveLength(7)
    expect(readCalendar().days[0].event).toContain('既有-')
    expect(ctrl2.status().error).toContain('为空或日期不匹配')
  })
})
