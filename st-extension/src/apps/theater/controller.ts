import type { AppHost } from '../../../../core/phone-registry'
import { abortable, captureStory, storyIdentity } from '../wechat/memory'
import { fingerprint } from '../wechat/moments-controller'
import { getStoryAiConfig } from '../shared/story-ai'
import { emitStoryEvent, incrementAppBadge } from '../shared/story-events'
import { generateTheater, mergeFeeds, readTheaterData, saveTheaterStory } from './generate'
import type { TheaterChannel } from './types'

export function createTheaterController(host: AppHost, options: { cooldownMs?: number; timeoutMs?: number } = {}) {
  let alive = true, job: AbortController | undefined, queuedAuto = false
  let cooldownTimer: ReturnType<typeof setTimeout> | undefined
  let status = { busy: false, error: '', channel: 'all' as TheaterChannel }
  const listeners = new Set<() => void>(), attempted = new Map<string, number>()
  const notify = () => { for (const fn of listeners) fn() }

  function clearCooldownTimer() {
    if (cooldownTimer !== undefined) {
      clearTimeout(cooldownTimer)
      cooldownTimer = undefined
    }
  }

  function cancel() {
    queuedAuto = false
    clearCooldownTimer()
    job?.abort()
    job = undefined
    status = { busy: false, error: '', channel: 'all' }
    notify()
  }

  async function trigger(manual = false, channel: TheaterChannel = 'all') {
    const data = readTheaterData(host)
    if (!alive || (!manual && !data.autoGenerate) || !getStoryAiConfig(host)) return
    if (job) { if (!manual) queuedAuto = true; return }
    const story = captureStory(host), mark = fingerprint(story), previous = data.stories[story.key]
    if (!manual) {
      if (previous?.fingerprint === mark) return
      const cooldown = options.cooldownMs ?? 300000
      const elapsed = Date.now() - (attempted.get(story.key) ?? previous?.updatedAt ?? 0)
      if (elapsed < cooldown) {
        if (cooldownTimer === undefined) {
          cooldownTimer = setTimeout(() => {
            cooldownTimer = undefined
            void trigger(false)
          }, Math.max(250, cooldown - elapsed))
        }
        return
      }
    }
    clearCooldownTimer()
    attempted.set(story.key, Date.now())
    const current = new AbortController()
    job = current
    status = { busy: true, error: '', channel }
    notify()
    const timeout = setTimeout(() => current.abort(new Error('小剧场生成超时，请重试。')), options.timeoutMs ?? 60000)
    const feeds = previous || { square: [], forum: [], live: null, diary: [] }
    try {
      const incoming = await abortable(generateTheater(host, feeds, current.signal, story, channel), current.signal)
      if (!alive || job !== current || current.signal.aborted || storyIdentity(host) !== story.key) return
      const merged = mergeFeeds(feeds, incoming)
      host.setAppData(saveTheaterStory(readTheaterData(host), story.key, { ...merged, fingerprint: mark, updatedAt: Date.now() }))
      const summary = incoming.diary[0]?.role
        ? `${incoming.diary[0].role} 写下了私密日记`
        : incoming.square[0]?.author
          ? `${incoming.square[0].author} 发了新动态`
          : incoming.forum[0]?.title
            ? `热帖：${incoming.forum[0].title}`
            : '小剧场有了新热闹'
      if (!manual) incrementAppBadge('theater', 1)
      emitStoryEvent({
        type: 'theater-updated',
        summary,
        tab: channel === 'all' ? undefined : channel,
      })
    } catch (error) {
      if (!current.signal.aborted) console.warn('[st-stage] 小剧场生成失败', error)
      if (alive && job === current) status.error = (error as Error).message
    } finally {
      clearTimeout(timeout)
      if (job === current) {
        job = undefined
        status = { ...status, busy: false }
        notify()
        if (queuedAuto) { queuedAuto = false; void trigger(false) }
      }
    }
  }

  const offMessage = host.onMessageReceived(() => { void trigger() })
  const offChange = host.onCharacterChanged(cancel)
  return {
    trigger,
    cancel,
    status: () => status,
    subscribe(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn) } },
    destroy() { alive = false; cancel(); offMessage(); offChange(); listeners.clear() },
  }
}
