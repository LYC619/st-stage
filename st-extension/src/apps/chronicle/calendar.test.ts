// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { CALENDAR_KEY, calendarWindow, generateCalendar, normalizeCalendar, readCalendar } from './calendar'
import { createCalendarController } from './calendar-controller'
import * as ai from '../shared/story-ai'
import * as dates from '../shared/story-date'

let cancel = () => {}
afterEach(() => { cancel(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
const day = (date: string) => ({ date, festival: '', event: date + ' 公共检修', status: '上班/上学', weather: '晴', content: '公共场馆检修安排。' })
function fixture() {
  let chatId = 'one', settings = {}
  const metadata: Record<string, unknown> = {}, save = vi.fn(async () => {})
  vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId, chat: [], chatMetadata: metadata, saveMetadata: save }) })
  const host = { getCharacterName: () => '角色', getAppData: () => settings,
    getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test', profile: { includeWorldbook: false } } } } }),
  } as unknown as AppHost
  const controller = createCalendarController(host, vi.fn()); cancel = controller.cancel
  return { host, metadata, save, controller, change: () => { chatId = 'two'; controller.cancel() }, settings: (value: object) => { settings = value } }
}

describe('seven-day public calendar', () => {
  it('calculates a consecutive window across month and year boundaries', () => {
    expect(calendarWindow(new Date(2026, 0, 1))).toEqual(['2025-12-29', '2025-12-30', '2025-12-31', '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04'])
  })
  it('requests seven days, then only the new day, then seven after a distant jump', async () => {
    const today = vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 0, 1)), f = fixture()
    const request = vi.spyOn(ai, 'requestChat').mockImplementation(async (_config, messages) => {
      const missing = JSON.parse(messages[1].content.match(/只补这些日期：(\[[^\n]+\])/)![1]) as string[]
      return JSON.stringify({ days: missing.map(day) })
    })
    await f.controller.trigger(); expect(readCalendar().days).toHaveLength(7)
    const old = readCalendar().days.find(row => row.date === '2026-01-01')
    await f.controller.trigger(); expect(request).toHaveBeenCalledOnce()
    today.mockResolvedValue(new Date(2026, 0, 2)); await f.controller.trigger()
    expect(request.mock.calls[1][1][1].content).toContain('只补这些日期：["2026-01-05"]')
    expect(readCalendar().days.find(row => row.date === '2026-01-01')).toEqual(old)
    expect(readCalendar().days.map(row => row.date)).toEqual(calendarWindow(new Date(2026, 0, 2)))
    today.mockResolvedValue(new Date(2026, 1, 1)); await f.controller.trigger()
    expect(readCalendar().days.map(row => row.date)).toEqual(calendarWindow(new Date(2026, 1, 1)))
    expect(request).toHaveBeenCalledTimes(3)
  })
  it('drops invalid dates and empty events, blanks bad enums and excludes unrequested dates', async () => {
    expect(normalizeCalendar({ days: [day('2026-02-30'), { ...day('2026-01-01'), event: ' ' }, { ...day('2026-01-02'), status: '上班', weather: '暴雨' }] }).days)
      .toEqual([{ ...day('2026-01-02'), status: '', weather: '' }])
    const f = fixture(); vi.spyOn(ai, 'requestChat').mockResolvedValue(JSON.stringify({ days: [day('2026-01-01'), day('2026-01-02'), day('1999-01-01')] }))
    expect(await generateCalendar(f.host, new Date(2026, 0, 1), ['2026-01-02'], [day('2026-01-01')], new AbortController().signal)).toEqual([day('2026-01-02')])
  })
  it('does not request without a date or when auto is disabled, and discards a switched-chat result', async () => {
    const today = vi.spyOn(dates, 'storyToday').mockResolvedValue(null), request = vi.spyOn(ai, 'requestChat').mockResolvedValue('{"days":[]}'), f = fixture()
    await f.controller.trigger(true); expect(request).not.toHaveBeenCalled(); expect(f.controller.status().error).toContain('剧情里还没有日期')
    today.mockResolvedValue(new Date(2026, 0, 1)); f.settings({ autoCalendar: false }); await f.controller.trigger()
    expect(request).not.toHaveBeenCalled()
    let finish!: (value: string) => void
    request.mockReturnValue(new Promise(resolve => { finish = resolve }))
    const work = f.controller.trigger(true); await vi.waitFor(() => expect(finish).toBeDefined()); f.change()
    finish(JSON.stringify({ days: calendarWindow(new Date(2026, 0, 1)).map(day) })); await work
    expect(f.save).not.toHaveBeenCalled(); expect(f.metadata[CALENDAR_KEY]).toBeUndefined()
  })
})
