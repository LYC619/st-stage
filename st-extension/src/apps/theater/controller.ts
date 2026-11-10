import type { AppHost } from '../../../../core/phone-registry'
import { abortable, captureStory, storyIdentity } from '../wechat/memory'
import { fingerprint } from '../wechat/moments-controller'
import { getStoryAiConfig } from '../shared/story-ai'
import { generateTheater, mergeFeeds, readTheaterData, saveTheaterStory } from './generate'

export function createTheaterController(host: AppHost, options: { cooldownMs?: number; timeoutMs?: number } = {}) {
  let alive = true, job: AbortController | undefined
  let status = { busy: false, error: '' }
  const listeners = new Set<() => void>(), attempted = new Map<string, number>()
  const notify = () => { for (const fn of listeners) fn() }
  function cancel() {
    job?.abort(); job = undefined; status = { busy: false, error: '' }; notify()
  }
  async function trigger(manual = false) {
    const data = readTheaterData(host)
    if (!alive || job || (!manual && !data.autoGenerate) || !getStoryAiConfig(host)) return
    const story = captureStory(host), mark = fingerprint(story), previous = data.stories[story.key]
    if (!manual && (previous?.fingerprint === mark || Date.now() - (attempted.get(story.key) ?? previous?.updatedAt ?? 0) < (options.cooldownMs ?? 300000))) return
    attempted.set(story.key, Date.now())
    const current = new AbortController(); job = current
    status = { busy: true, error: '' }; notify()
    const timeout = setTimeout(() => current.abort(new Error('小剧场生成超时，请重试。')), options.timeoutMs ?? 60000)
    const feeds = previous || { square: [], forum: [], live: null }
    try {
      const incoming = await abortable(generateTheater(host, feeds, current.signal, story), current.signal)
      if (!alive || job !== current || current.signal.aborted || storyIdentity(host) !== story.key) return
      host.setAppData(saveTheaterStory(readTheaterData(host), story.key, { ...mergeFeeds(feeds, incoming), fingerprint: mark, updatedAt: Date.now() }))
    } catch (error) {
      if (alive && job === current) status.error = (error as Error).message
    } finally {
      clearTimeout(timeout)
      if (job === current) { job = undefined; status.busy = false; notify() }
    }
  }
  const offMessage = host.onMessageReceived(() => { void trigger() })
  const offChange = host.onCharacterChanged(cancel)
  return { trigger, cancel, status: () => status,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    destroy() { alive = false; cancel(); offMessage(); offChange(); listeners.clear() },
  }
}
