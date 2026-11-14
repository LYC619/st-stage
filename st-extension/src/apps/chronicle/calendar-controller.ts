import type { AppHost } from '../../../../core/phone-registry'
import { abortable } from '../wechat/memory'
import { storyIdentity, writeChatMetadata } from '../shared/chat-metadata'
import { formatStoryDate, storyToday } from '../shared/story-date'
import { getStoryAiConfig } from '../shared/story-ai'
import { readChronicleSettings } from './store'
import { CALENDAR_KEY, NO_STORY_DATE, calendarGap, generateCalendar, readCalendar } from './calendar'

/** The chronicle controller owns lifecycle and calls this after organizing; no separate host subscription. */
export function createCalendarController(host: AppHost, notify: () => void, timeoutMs = 60000) {
  let job: AbortController | undefined, lastCheck = ''
  const status = { busy: false, error: '', today: null as Date | null }
  function cancel() { job?.abort(); job = undefined; status.busy = false; status.error = ''; status.today = null; notify() }
  async function trigger(manual = false) {
    if (job || !manual && !readChronicleSettings(host).autoCalendar) return
    const key = storyIdentity(host), current = new AbortController(); job = current; status.busy = true; status.error = ''; notify()
    const timeout = setTimeout(() => current.abort(new Error('日历生成超时，请重试。')), timeoutMs)
    try {
      const today = await abortable(storyToday(host), current.signal)
      if (job !== current || key !== storyIdentity(host)) return
      status.today = today
      if (!today) { status.error = NO_STORY_DATE; return }
      const mark = `${key}::${formatStoryDate(today)}`
      if (!manual && lastCheck === mark) return
      lastCheck = mark
      const { retained, missing } = calendarGap(today, readCalendar())
      if (!missing.length) return
      if (!getStoryAiConfig(host)) { status.error = '请先在微信设置里连接 AI。'; return }
      const incoming = await abortable(generateCalendar(host, today, missing, retained, current.signal), current.signal)
      if (job !== current || current.signal.aborted) return
      await writeChatMetadata(host, key, CALENDAR_KEY, { v: 1, days: [...retained, ...incoming].sort((a, b) => a.date.localeCompare(b.date)) })
    } catch (error) { if (job === current) status.error = (error as Error).message }
    finally { clearTimeout(timeout); if (job === current) { job = undefined; status.busy = false; notify() } }
  }
  return { trigger, cancel, status: () => status }
}
