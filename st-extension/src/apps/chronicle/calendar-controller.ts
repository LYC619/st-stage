import type { AppHost } from '../../../../core/phone-registry'
import { abortable } from '../wechat/memory'
import { isStorySwitchedError, storyIdentity, writeChatMetadata } from '../shared/chat-metadata'
import { formatStoryDate, storyToday } from '../shared/story-date'
import { getStoryAiConfig } from '../shared/story-ai'
import { emitStoryEvent } from '../shared/story-events'
import { readChronicleSettings } from './store'
import { CALENDAR_KEY, NO_STORY_DATE, calendarGap, calendarWindow, generateCalendar, readCalendar } from './calendar'

/** The chronicle controller owns lifecycle and calls this after organizing; no separate host subscription. */
export function createCalendarController(host: AppHost, notify: () => void, timeoutMs = 60000) {
  let job: AbortController | undefined, lastCheck = ''
  const status = { busy: false, error: '', today: null as Date | null }
  function cancel() { job?.abort(); job = undefined; status.busy = false; status.error = ''; status.today = null; notify() }
  async function trigger(manual = false, forceRewrite = false) {
    if (job || (!manual && (!readChronicleSettings(host).autoCalendar || !getStoryAiConfig(host)))) return
    const key = storyIdentity(host), current = new AbortController(); job = current; status.busy = true; status.error = ''; notify()
    const timeout = setTimeout(() => current.abort(new Error('日历生成超时，请重试。')), timeoutMs)
    try {
      const today = await abortable(storyToday(host), current.signal)
      if (job !== current || key !== storyIdentity(host)) return
      status.today = today
      if (!today) { if (manual) status.error = NO_STORY_DATE; return }
      const mark = `${key}::${formatStoryDate(today)}`
      if (!manual && lastCheck === mark) return
      const existing = readCalendar()
      const windowDates = calendarWindow(today)
      const { retained, missing } = forceRewrite
        ? { retained: [], missing: windowDates }
        : calendarGap(today, existing)
      if (!missing.length) { lastCheck = mark; return }
      if (!getStoryAiConfig(host)) {
        if (manual) status.error = '请先在下方设置或微信里连上幕后 AI。'
        return
      }
      const incoming = await abortable(generateCalendar(host, today, missing, retained, current.signal), current.signal)
      if (job !== current || current.signal.aborted || key !== storyIdentity(host)) return
      const latest = readCalendar()
      const incomingDates = new Set(incoming.map((day) => day.date))
      const windowSet = new Set(windowDates)
      const keptDays = latest.days.filter((day) => windowSet.has(day.date) && !incomingDates.has(day.date))
      const notes = latest.notes
      const saved = await writeChatMetadata(host, key, CALENDAR_KEY, {
        v: 1,
        days: [...keptDays, ...incoming].sort((a, b) => a.date.localeCompare(b.date)),
        ...(notes && Object.keys(notes).length ? { notes } : {}),
      })
      if (saved) {
        lastCheck = mark
        emitStoryEvent({ type: 'calendar-updated', summary: '七天风物日历已更新' })
      }
    } catch (error) {
      if (job !== current || key !== storyIdentity(host) || isStorySwitchedError(error)) return
      if (!current.signal.aborted) console.warn('[st-stage] 日历生成失败', error)
      status.error = (error as Error).message
    } finally {
      clearTimeout(timeout)
      if (job === current) { job = undefined; status.busy = false; notify() }
    }
  }
  return { trigger, cancel, status: () => status }
}
