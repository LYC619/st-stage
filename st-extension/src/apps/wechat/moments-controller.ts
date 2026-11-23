import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import { listContacts, loadContact } from './conversations'
import { abortable, captureStory, readStoryMemory, storyIdentity, type StorySnapshot } from './memory'
import { addMoment, latestContactState } from './moments'
import { contactPipeline } from './replies'
import { resolveProfile } from './profile-library'
import type { Contact, WeChatAppData } from './types'

export async function generateMoment(host: AppHost, data: WeChatAppData, source: Contact, signal: AbortSignal, story = captureStory(host), books?: Map<string, Promise<unknown>>) {
  const config = structuredClone(data.config), state = structuredClone(latestContactState(data, source.id))
  const recent = (data.moments ?? []).filter(item => item.contactId === source.id).slice(0, 5).map(item => item.text)
  const contact = listContacts(host).some(item => item.id === source.id) ? await abortable(loadContact(host, source.id), signal) : structuredClone(source)
  signal.throwIfAborted()
  if (!contact.card?.description && source.card?.description) contact.card = structuredClone(source.card)
  const profile = resolveProfile(config, source.id)
  const scope = await readStoryMemory(host, { scopeKey: `moment:${contact.id}`, contactId: contact.id, characterName: contact.name, card: contact.card, externalState: { source: 'none' } }, profile, signal, story, '', undefined, books)
  const { pipe } = contactPipeline({ config }, contact)
  const result = await abortable(pipe.requestMoment(contact, state, signal, scope, recent), signal)
  signal.throwIfAborted()
  if (storyIdentity(host) !== story.key) throw new Error('主聊天已切换，本次动态已取消。')
  return { contact, state, result, storyKey: story.key, warnings: scope.memoryWarnings ?? [] }
}

export function fingerprint(story: StorySnapshot): string {
  let hash = 2166136261
  for (const char of JSON.stringify([story.key, story.messages.slice(-20)])) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619)
  return (hash >>> 0).toString(36)
}

/** Event-driven background work, inspired by WeiMeng's moments-updater. */
export function createMomentsController(host: AppHost, options: { cooldownMs?: number; timeoutMs?: number } = {}) {
  const cooldown = options.cooldownMs ?? 120000
  let alive = true, controller: AbortController | undefined, timer: ReturnType<typeof setTimeout> | undefined, queued = false
  let status = { busy: false, error: '' }
  const listeners = new Set<() => void>()
  const notify = () => { for (const listener of listeners) listener() }
  const current = () => host.getAppData<WeChatAppData>()
  function cancel() {
    controller?.abort(); controller = undefined
    clearTimeout(timer); timer = undefined; queued = false
    status = { busy: false, error: '' }; notify()
  }
  async function run(force = false) {
    const data = current()
    if (!alive || !data || data.config.autoMoments === false || !data.config.apiKey) return
    if (controller) { queued = true; return }
    const story = captureStory(host), mark = fingerprint(story), last = data.momentActivity?.[story.key]
    if (!force && last?.completed && last.fingerprint === mark) return
    if (!force && last && Date.now() - last.attemptedAt < cooldown) {
      clearTimeout(timer); timer = setTimeout(() => { timer = undefined; void run() }, cooldown - (Date.now() - last.attemptedAt)); return
    }
    const known = new Map(Object.values(data.contacts ?? {}).map(item => [item.id, item]))
    const active = stableCharacterKey(story.card)
    const candidates = [active ? known.get(active) ?? listContacts(host).find(item => item.id === active) : undefined,
      ...Object.values(data.conversations ?? {}).sort((a, b) => (b.updatedAt ?? 0) - (a.updatedAt ?? 0)).flatMap(conv => (conv.memberIds ?? (conv.contactId ? [conv.contactId] : [])).map(id => known.get(id)))]
    const contacts = [...new Map(candidates.filter((item): item is Contact => !!item && item.kind !== 'story').map(item => [item.id, item])).values()].slice(0, 2)
    if (!contacts.length) return
    const job = new AbortController(); controller = job; status = { busy: true, error: '' }; notify()
    const timeout = setTimeout(() => job.abort(new Error('动态生成超时，请重试。')), options.timeoutMs ?? 60000)
    const valid = () => alive && controller === job && !job.signal.aborted && storyIdentity(host) === story.key && current()?.config.autoMoments !== false
    try {
      const previous = data.momentActivity
      data.momentActivity = Object.fromEntries([...Object.entries(previous ?? {}).filter(([key]) => key !== story.key).slice(-19), [story.key, { fingerprint: mark, attemptedAt: Date.now() }]])
      try { host.setAppData(data) } catch (error) { data.momentActivity = previous; throw error }
      const generated: Awaited<ReturnType<typeof generateMoment>>[] = [], batch = structuredClone(data), books = new Map<string, Promise<unknown>>()
      for (const contact of contacts) {
        generated.push(await generateMoment(host, batch, contact, job.signal, story, books))
        if (!valid()) return
      }
      const latest = current()!, oldMoments = latest.moments, oldActivity = latest.momentActivity
      for (const item of generated) {
        if ((latest.moments ?? []).some(post => post.contactId === item.contact.id && post.storyKey === story.key && post.text === item.result.text)) continue
        addMoment(latest, item.contact, item.result.text, item.result.image, item.state, item.result.visibility, story.key)
      }
      latest.momentActivity = { ...latest.momentActivity, [story.key]: { fingerprint: mark, attemptedAt: Date.now(), completed: true } }
      try { host.setAppData(latest) } catch (error) { latest.moments = oldMoments; latest.momentActivity = oldActivity; throw error }
      status.error = [...new Set(generated.flatMap(item => item.warnings))].join(' ')
    } catch (error) {
      if (!job.signal.aborted) console.warn('[st-stage] 朋友圈后台动态生成失败', error)
      if (alive && controller === job) status.error = job.signal.aborted ? '动态生成超时或已取消，可重试。' : (error as Error).message || '动态未生成，请重试。'
    } finally {
      clearTimeout(timeout)
      if (controller === job) { controller = undefined; status.busy = false; notify(); if (queued) { queued = false; void run() } }
    }
  }
  const offMessage = host.onMessageReceived(() => { void run() })
  const offChange = host.onCharacterChanged(cancel)
  return { trigger: run, cancel, status: () => status,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener) } },
    destroy() { alive = false; cancel(); offMessage(); offChange(); listeners.clear() },
  }
}
