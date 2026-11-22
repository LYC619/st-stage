import type { AppHost } from '../../../../core/phone-registry'
import { abortable } from '../wechat/memory'
import { storyIdentity, writeChatMetadata } from '../shared/chat-metadata'
import { getStoryAiConfig } from '../shared/story-ai'
import { storyToday } from '../shared/story-date'
import { emitStoryEvent, onStoryEvent } from '../shared/story-events'
import { CHRONICLE_KEY, nextCode, readChronicleData, readChronicleSettings } from './store'
import { generateChronicle, pendingStory } from './generate'
import { chronicleInjection } from './inject'
import { readTodayCalendarSummary } from './calendar'
import { createCalendarController } from './calendar-controller'

export function createChronicleController(host: AppHost, options: { timeoutMs?: number } = {}) {
  let alive = true, job: AbortController | undefined, revision = 0
  const status = { busy: false, error: '', today: null as Date | null }
  const listeners = new Set<() => void>()
  const notify = () => { for (const listener of listeners) listener() }
  const calendar = createCalendarController(host, notify, options.timeoutMs)

  function cancel() { job?.abort(); job = undefined; status.busy = false; status.error = ''; notify() }

  async function refresh() {
    const token = ++revision, key = storyIdentity(host)
    const settings = readChronicleSettings(host)
    if (!settings.inject || (!readChronicleData().entries.length && !settings.injectCalendar)) {
      host.injectPrompt('', 999)
    }
    try {
      const today = await storyToday(host)
      if (!alive || revision !== token || key !== storyIdentity(host)) return
      status.today = today
      const latestSettings = readChronicleSettings(host)
      const entries = readChronicleData().entries
      const calendarText = latestSettings.injectCalendar ? readTodayCalendarSummary(today) : ''
      const injected = latestSettings.inject ? chronicleInjection(entries, today, calendarText) : ''
      host.injectPrompt(injected, 999)
    } catch (error) {
      console.warn('[st-stage] 纪要刷新失败', error)
      if (alive && revision === token) status.error = (error as Error).message
    }
    if (alive && revision === token) notify()
  }

  async function trigger(manual = false) {
    if (!alive || job) return
    const data = readChronicleData(), settings = readChronicleSettings(host), key = storyIdentity(host)
    const cursorBefore = data.lastMessageIndex
    const pending = pendingStory(host, data.lastMessageIndex)
    const generate = !!getStoryAiConfig(host) && pending.messages.length > 0 && (manual || settings.autoGenerate && pending.aiCount >= settings.interval)
    if (!generate && pending.lastMessageIndex === data.lastMessageIndex) {
      if (manual) { status.error = pending.messages.length ? '请先在微信设置里连接 AI。' : '没有待整理的消息。'; notify() }
      return
    }
    const current = new AbortController(); job = current; status.busy = true; status.error = ''; notify()
    const timeout = setTimeout(() => current.abort(new Error('纪要整理超时，请重试。')), options.timeoutMs ?? 60000)
    try {
      data.lastMessageIndex = pending.lastMessageIndex
      let newSummary = ''
      if (generate) {
        const content = await abortable(generateChronicle(host, pending, data.entries, current.signal), current.signal)
        newSummary = content.summary
        data.entries.push({ ...content, code: nextCode(data), createdAt: Date.now(), startIndex: cursorBefore })
        data.lastMessageIndex = pending.endIndex
      }
      if (!alive || job !== current || current.signal.aborted) return
      if (await writeChatMetadata(host, key, CHRONICLE_KEY, data)) {
        await refresh()
        if (newSummary) emitStoryEvent({ type: 'chronicle-updated', summary: newSummary })
        if (generate && alive && job === current && !current.signal.aborted && key === storyIdentity(host)) void calendar.trigger()
      }
    } catch (error) {
      if (!current.signal.aborted) console.warn('[st-stage] 纪要整理失败', error)
      if (alive && job === current) status.error = (error as Error).message
    } finally {
      clearTimeout(timeout)
      if (job === current) { job = undefined; status.busy = false; notify() }
    }
  }

  async function deleteLatest() {
    if (job) return
    const key = storyIdentity(host), data = readChronicleData()
    if (!data.entries.length) return
    const removed = data.entries.pop()
    if (removed && typeof removed.startIndex === 'number') {
      data.lastMessageIndex = removed.startIndex
    }
    try {
      if (await writeChatMetadata(host, key, CHRONICLE_KEY, data)) await refresh()
    } catch (error) {
      status.error = (error as Error).message
      notify()
    }
  }

  async function updateEntry(code: string, patch: { summary: string; timeSpan: string; text: string }): Promise<boolean> {
    if (job) return false
    const key = storyIdentity(host), data = readChronicleData()
    const target = data.entries.find(e => e.code === code)
    if (!target) return false
    const summary = patch.summary.trim()
    const body = patch.text.trim()
    if (!summary || !body) {
      status.error = '纪要概览与正文不能为空。'
      notify()
      return false
    }
    target.summary = summary
    target.timeSpan = patch.timeSpan.trim()
    target.text = body
    try {
      const saved = await writeChatMetadata(host, key, CHRONICLE_KEY, data)
      if (saved) await refresh()
      return saved
    } catch (error) {
      status.error = (error as Error).message
      notify()
      return false
    }
  }

  const offMessage = host.onMessageReceived(() => { void trigger() })
  const offChange = host.onCharacterChanged(() => {
    cancel()
    calendar.cancel()
    status.today = null
    host.injectPrompt('', 999)
    void refresh()
  })
  const offStoryEvent = onStoryEvent((event) => {
    if (!alive) return
    if (event.type === 'story-date-changed') {
      void refresh().then(() => {
        if (alive && readChronicleSettings(host).autoCalendar) void calendar.trigger(false)
      })
    } else if (event.type === 'calendar-updated') {
      void refresh()
    }
  })

  void refresh()
  return {
    trigger,
    cancel,
    refresh,
    deleteLatest,
    updateEntry,
    calendar,
    status: () => status,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    destroy() {
      alive = false
      revision++
      cancel()
      calendar.cancel()
      offMessage()
      offChange()
      offStoryEvent()
      host.injectPrompt('', 999)
      listeners.clear()
    },
  }
}
