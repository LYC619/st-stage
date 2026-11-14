import type { AppHost } from '../../../../core/phone-registry'
import { abortable } from '../wechat/memory'
import { storyIdentity, writeChatMetadata } from '../shared/chat-metadata'
import { getStoryAiConfig } from '../shared/story-ai'
import { storyToday } from '../shared/story-date'
import { CHRONICLE_KEY, nextCode, readChronicleData, readChronicleSettings } from './store'
import { generateChronicle, pendingStory } from './generate'
import { chronicleInjection } from './inject'
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
    if (!readChronicleSettings(host).inject || !readChronicleData().entries.length) host.injectPrompt('', 999)
    try {
      const today = await storyToday(host)
      if (!alive || revision !== token || key !== storyIdentity(host)) return
      status.today = today
      host.injectPrompt(readChronicleSettings(host).inject ? chronicleInjection(readChronicleData().entries, today) : '', 999)
    } catch (error) {
      if (alive && revision === token) status.error = (error as Error).message
    }
    if (alive && revision === token) notify()
  }

  async function trigger(manual = false) {
    if (!alive || job) return
    const data = readChronicleData(), settings = readChronicleSettings(host), key = storyIdentity(host)
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
      if (generate) {
        const content = await abortable(generateChronicle(host, pending, data.entries, current.signal), current.signal)
        data.entries.push({ ...content, code: nextCode(data), createdAt: Date.now() }); data.lastMessageIndex = pending.endIndex
      }
      if (!alive || job !== current || current.signal.aborted) return
      if (await writeChatMetadata(host, key, CHRONICLE_KEY, data)) {
        await refresh()
        if (generate && alive && job === current && !current.signal.aborted && key === storyIdentity(host)) void calendar.trigger()
      }
    } catch (error) {
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
    data.entries.pop()
    try { if (await writeChatMetadata(host, key, CHRONICLE_KEY, data)) await refresh() }
    catch (error) { status.error = (error as Error).message; notify() }
  }

  const offMessage = host.onMessageReceived(() => { void trigger() })
  const offChange = host.onCharacterChanged(() => { cancel(); calendar.cancel(); status.today = null; host.injectPrompt('', 999); void refresh() })
  void refresh()
  return { trigger, cancel, refresh, deleteLatest, calendar, status: () => status,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    destroy() { alive = false; revision++; cancel(); calendar.cancel(); offMessage(); offChange(); host.injectPrompt('', 999); listeners.clear() },
  }
}
