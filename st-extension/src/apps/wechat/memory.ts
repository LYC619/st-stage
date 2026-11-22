import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import { getWeChatHostContext, type ConversationScope } from './bridge'
import type { WeChatProfile } from './profile'
import { storyIdentity } from '../shared/chat-metadata'
import { storyToday } from '../shared/story-date'
import { readChronicleData } from '../chronicle/store'
import { chronicleOverview } from '../chronicle/inject'
import { readCalendar, readTodayCalendarSummary } from '../chronicle/calendar'
export { storyIdentity } from '../shared/chat-metadata'

type RecordValue = Record<string, unknown>
const record = (value: unknown): RecordValue => value && typeof value === 'object' && !Array.isArray(value) ? value as RecordValue : {}
const strings = (value: unknown): string[] => Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string' && !!v.trim()) : []
const text = (value: unknown) => typeof value === 'string' ? value : ''
export interface StorySnapshot {
  key: string
  name: string
  messages: Array<{ sender: 'user' | 'character'; name: string; text: string }>
  card: RecordValue
  chatBook: string
}
interface WorldSettings { selected_world_info?: string[]; world_info?: { globalSelect?: string[]; charLore?: Array<{ name: string; extraBooks?: string[] }> } }

export function abortable<T>(work: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason ?? new DOMException('已取消', 'AbortError'))
    if (signal.aborted) { work.catch(() => {}); abort(); return }
    signal.addEventListener('abort', abort, { once: true })
    work.then(resolve, reject).finally(() => signal.removeEventListener('abort', abort))
  })
}

/** Inert parsing follows WeiMeng's formatRecentChat approach; never put model HTML in the live DOM. */
export function storyText(value: string): string {
  const clean = value.replace(/<(think|thinking|analysis|script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
  return (clean.includes('<') ? new DOMParser().parseFromString(clean, 'text/html').body.textContent ?? '' : clean).trim()
}

export function captureStory(host: AppHost): StorySnapshot {
  const native = record(getWeChatHostContext()), context = host.getChatContext?.()
  const card = record(host.getCharacterCard?.()), name = host.getCharacterName()
  const raw = Array.isArray(native.chat) ? native.chat : context?.chat ?? []
  const messages = raw.slice(-60).flatMap(value => {
    const msg = record(value)
    if (msg.is_system || typeof msg.mes !== 'string') return []
    const content = storyText(msg.mes).slice(-4000)
    return content ? [{ sender: msg.is_user ? 'user' as const : 'character' as const, name: text(msg.name) || (msg.is_user ? text(native.name1) || '用户' : name), text: content }] : []
  })
  return { key: storyIdentity(host), name, messages, card: structuredClone(card), chatBook: text(record(native.chatMetadata).world_info) }
}

/** Read the host's exported live selection without invoking its prompt scanner or mutating WI timers. */
async function worldSettings(): Promise<WorldSettings> {
  const url = new URL('/scripts/world-info.js', window.location.origin).href
  return import(/* webpackIgnore: true */ /* @vite-ignore */ url) as Promise<WorldSettings>
}

function entries(book: unknown): RecordValue[] {
  const source = record(book).entries
  return (Array.isArray(source) ? source : Object.values(record(source))).map(record)
}
function activeEntry(entry: RecordValue, search: string, filename: string, tags: string[]): boolean {
  const ext = record(entry.extensions)
  if (entry.disable === true || entry.enabled === false) return false
  const filter = record(entry.characterFilter)
  const names = strings(filter.names)
  if (names.length && (filter.isExclude ? names.includes(filename) : !names.includes(filename))) return false
  const filterTags = strings(filter.tags), matchesTag = tags.some(tag => filterTags.includes(tag))
  if (filterTags.length && (filter.isExclude ? matchesTag : !matchesTag)) return false
  if (entry.constant === true) return true
  const key = strings(entry.key ?? entry.keys), secondary = strings(entry.keysecondary ?? entry.secondary_keys)
  const match = (needle: string) => search.toLocaleLowerCase().includes(needle.toLocaleLowerCase())
  if (!key.some(match)) return false
  if (!(entry.selective ?? ext.selective) || !secondary.length) return true
  switch (entry.selectiveLogic ?? ext.selectiveLogic ?? 0) {
    case 1: return !secondary.every(match)
    case 2: return !secondary.some(match)
    case 3: return secondary.every(match)
    default: return secondary.some(match)
  }
}

/**
 * `bookCache` lets the participants of one group round (or one Moments batch) share a single read per worldbook.
 * Callers create it per task, so later sends always see current worldbook edits.
 */
export async function readStoryMemory(host: AppHost, scope: ConversationScope, profile: WeChatProfile, signal: AbortSignal,
  snapshot = captureStory(host), query = '', loadSettings: () => Promise<WorldSettings> = worldSettings,
  bookCache?: Map<string, Promise<unknown>>): Promise<ConversationScope> {
  const check = () => {
    signal.throwIfAborted()
    if (storyIdentity(host) !== snapshot.key) throw new Error('主聊天已切换，请在当前剧情中重试。')
  }
  check()
  const memory: ConversationScope = { ...scope, storySource: snapshot.name,
    stRecentMessages: profile.contextMessageCount > 0 ? snapshot.messages.slice(-profile.contextMessageCount) : [], loreText: '', memoryWarnings: [] }
  const chronicles = readChronicleData().entries
  const cal = readCalendar()
  const hasCalendar = cal.days.length > 0 || Boolean(cal.notes && Object.keys(cal.notes).length > 0)
  if (chronicles.length || hasCalendar) {
    let today: Date | null
    try {
      today = await abortable(storyToday(host), signal)
    } catch (err) {
      check()
      throw err
    }
    memory.chronicleText = chronicles.length ? chronicleOverview(chronicles, today) : ''
    const todayCalendar = readTodayCalendarSummary(today)
    if (todayCalendar) memory.calendarText = todayCalendar
  } else {
    memory.chronicleText = ''
  }
  check()
  if (!profile.includeWorldbook) return memory
  const native = record(getWeChatHostContext())
  const key = stableCharacterKey(scope.card)
  let target = (Array.isArray(native.characters) ? native.characters.map(record).find(card => key && stableCharacterKey(card) === key) : undefined) ?? record(scope.card)
  if (target.shallow && typeof native.unshallowCharacter === 'function' && Array.isArray(native.characters)) {
    const index = native.characters.indexOf(target)
    try {
      await abortable(Promise.resolve(native.unshallowCharacter(String(index))), signal); check()
      target = getWeChatHostContext()?.characters?.map(record).find(card => stableCharacterKey(card) === key) ?? target
    } catch { check(); memory.memoryWarnings!.push('联系人世界书绑定读取失败。') }
  }
  const cards = [structuredClone(target), snapshot.card]
  const filename = text(target.avatar).replace(/\.[^.]+$/, ''), tags = strings(record(native.tagMap)[text(target.avatar)])
  const names = new Set<string>(snapshot.chatBook ? [snapshot.chatBook] : [])
  const books: Array<{ name: string; data: unknown }> = []
  for (const card of cards) {
    const data = record(card.data), extensions = record(data.extensions ?? card.extensions)
    if (text(extensions.world)) names.add(text(extensions.world))
    const embedded = data.character_book ?? card.character_book
    if (embedded) books.push({ name: text(card.name) || scope.characterName, data: structuredClone(embedded) })
  }
  if (typeof native.loadWorldInfo === 'function') {
    try {
      const settings = await abortable(loadSettings(), signal); check()
      for (const name of settings.selected_world_info ?? settings.world_info?.globalSelect ?? []) names.add(name)
      for (const binding of settings.world_info?.charLore ?? []) {
        if (cards.some(card => text(card.avatar).replace(/\.[^.]+$/, '') === binding.name)) for (const name of binding.extraBooks ?? []) names.add(name)
      }
    } catch (error) {
      check(); memory.memoryWarnings!.push('全局世界书选择读取失败。')
      if (error instanceof DOMException && error.name === 'AbortError') throw error
    }
  }
  const headers = typeof native.getRequestHeaders === 'function' ? native.getRequestHeaders() : {}
  const read = (name: string) => {
    let work = bookCache?.get(name)
    if (!work) {
      work = fetch('/api/worldinfo/get', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify({ name }), signal })
        .then(response => { if (!response.ok) throw new Error('worldbook unavailable'); return response.json() as Promise<unknown> })
      bookCache?.set(name, work)
    }
    return abortable(work, signal)
  }
  // Books are independent; read them together instead of one round trip after another.
  const wanted = [...names].slice(0, 12)
  check()
  const results = await Promise.allSettled(wanted.map(read))
  check()
  results.forEach((result, index) => {
    if (result.status === 'fulfilled') books.push({ name: wanted[index], data: result.value })
    else memory.memoryWarnings!.push(`世界书「${wanted[index]}」读取失败。`)
  })
  const search = [scope.characterName, query, ...memory.stRecentMessages!.map(item => item.text)].join('\n')
  const selected = books.flatMap(book => entries(book.data).filter(entry => activeEntry(entry, search, filename, tags)).map(entry => ({ name: book.name, entry })))
    .sort((a, b) => Number(!!b.entry.constant) - Number(!!a.entry.constant) || Number(b.entry.order ?? 0) - Number(a.entry.order ?? 0))
  const seen = new Set<string>(), content: string[] = []; let budget = 10000
  for (const { name, entry } of selected) {
    const value = storyText(text(entry.content)).replace(/\{\{char\}\}/gi, scope.characterName).replace(/\{\{user\}\}/gi, profile.playerName || '用户')
    if (!value || seen.has(value)) continue
    seen.add(value)
    const line = `[${name}${entry.comment || entry.name ? ' / ' + text(entry.comment || entry.name) : ''}]\n${value}`.slice(0, Math.min(budget, 4000))
    content.push(line); budget -= line.length
    if (budget <= 0) break
  }
  memory.loreText = content.join('\n\n'); check()
  return memory
}

export function formatStoryMemory(scope: ConversationScope): string {
  const history = scope.stRecentMessages?.map(msg => `${'name' in msg ? msg.name : msg.sender}: ${msg.text}`).join('\n').slice(-16000)
  return [
    scope.calendarText ? `【今日风物与日程】\n${scope.calendarText}` : '',
    scope.chronicleText ? `【过去的剧情纪要】\n${scope.chronicleText}` : '',
    history ? `【酒馆主线背景 · ${scope.storySource || '当前主聊天'}】\n${history}\n以上是故事背景，区分人物身份与亲历；不要把其他角色的行为当成自己的经历。` : '',
    scope.loreText ? `【世界书设定】\n${scope.loreText}` : '',
  ].filter(Boolean).join('\n\n')
}
