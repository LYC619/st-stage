// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { createCalendarController } from './calendar-controller'
import * as calendar from './calendar'
import * as dates from '../shared/story-date'

let cleanup = () => {}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
describe('calendar generation and manual notes', () => {
  it.each(['create', 'edit', 'delete'] as const)('preserves a concurrent note %s when generation finishes', async action => {
    const metadata = { [calendar.CALENDAR_KEY]: { v: 1, days: [], notes: action === 'create' ? {} : { '2026-11-23': 'Before' } } }
    vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId: 'A', chatMetadata: metadata, saveMetadata: async () => {} }) })
    const host = { getCharacterName: () => 'Role', getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: 'test' } } } }), getAppData: () => ({}) } as unknown as AppHost
    vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 10, 23))
    let finish!: (days: calendar.CalendarDay[]) => void
    const generate = vi.spyOn(calendar, 'generateCalendar').mockReturnValue(new Promise(resolve => { finish = resolve }))
    const controller = createCalendarController(host, () => {}); cleanup = controller.cancel
    const work = controller.trigger(true)
    await vi.waitFor(() => expect(generate).toHaveBeenCalledOnce())
    const note = action === 'delete' ? '' : 'Meet at the harbor'
    await calendar.saveCalendarNote(host, '2026-11-23', note)
    finish([{ date: '2026-11-23', festival: '', event: 'Market', status: '', weather: '', content: 'Open' }])
    await work
    expect(calendar.readCalendar().notes?.['2026-11-23']).toBe(note || undefined)
  })
})
