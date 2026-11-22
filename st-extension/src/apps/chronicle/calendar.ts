// Rules copied from 玉子手机 tables/sources/小剧场2.1/05-小日历表.md; dates are supplied by shared/story-date.
import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import { readChatMetadata, storyIdentity, writeChatMetadata } from '../shared/chat-metadata'
import { formatStoryDate, parseSpanEnd } from '../shared/story-date'
import { getStoryAiConfig, requestChat } from '../shared/story-ai'
import { emitStoryEvent } from '../shared/story-events'
import { captureStory, formatStoryMemory, readStoryMemory } from '../wechat/memory'
import { resolveProfile } from '../wechat/profile-library'
import type { WeChatConfig } from '../wechat/types'

export const CALENDAR_KEY = 'st_stage_calendar'
export const NO_STORY_DATE = '剧情里还没有日期。在剧情状态里打开后台整理，或让 AI 在回复中写明日期'
export interface CalendarDay { date: string; festival: string; event: string; status: string; weather: string; content: string }
export interface CalendarData { v: 1; days: CalendarDay[]; notes?: Record<string, string> }

const WEATHER = ['晴', '阴', '多云', '小雨', '大雨', '雷雨', '小雪', '大雪', '雾', '风', '沙尘', '极端天气']
const WEATHER_EMOJI: Record<string, string> = {
  晴: '☀️',
  多云: '⛅',
  阴: '☁️',
  小雨: '🌦️',
  大雨: '🌧️',
  雷雨: '⛈️',
  小雪: '🌨️',
  大雪: '❄️',
  雾: '🌫️',
  风: '💨',
  沙尘: '🏜️',
  极端天气: '🌪️',
}

export function weatherIcon(weather: string): string {
  return WEATHER_EMOJI[weather] || '📅'
}

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''

export function calendarWindow(today: Date): string[] {
  return Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today)
    date.setDate(date.getDate() + i - 3)
    return formatStoryDate(date)
  })
}

export function normalizeCalendar(value: unknown): CalendarData {
  const raw = record(value), days = new Map<string, CalendarDay>()
  for (const value of Array.isArray(raw.days) ? raw.days : []) {
    const row = record(value), date = str(row.date), event = str(row.event)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !parseSpanEnd(date) || !event) continue
    const status = str(row.status), weather = str(row.weather)
    days.set(date, {
      date,
      event,
      festival: str(row.festival),
      content: str(row.content),
      status: ['上班/上学', '放假'].includes(status) ? status : '',
      weather: WEATHER.includes(weather) ? weather : '',
    })
  }
  const rawNotes = record(raw.notes)
  const notes: Record<string, string> = {}
  for (const [k, v] of Object.entries(rawNotes)) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(k) && typeof v === 'string' && v.trim()) {
      notes[k] = v.trim().slice(0, 200)
    }
  }
  return {
    v: 1,
    days: [...days.values()],
    ...(Object.keys(notes).length ? { notes } : {}),
  }
}

export function readCalendar(): CalendarData { return normalizeCalendar(readChatMetadata(CALENDAR_KEY)) }

export function readTodayCalendarSummary(today: Date | null): string {
  if (!today) return ''
  const date = formatStoryDate(today)
  const cal = readCalendar()
  const day = cal.days.find(item => item.date === date)
  const note = cal.notes?.[date]
  if (!day && !note) return ''
  const parts: string[] = []
  if (day) {
    parts.push(`${date} · ${[day.festival, day.weather, day.status, day.event].filter(Boolean).join(' · ')}`)
    if (day.content) parts.push(day.content.slice(0, 120))
  } else {
    parts.push(date)
  }
  if (note) parts.push(`当日约定：${note}`)
  return parts.join('\n')
}

export async function saveCalendarNote(host: AppHost, date: string, note: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return false
  const key = storyIdentity(host)
  const current = readCalendar()
  const notes = { ...(current.notes ?? {}) }
  const clean = note.trim().slice(0, 200)
  if (clean) notes[date] = clean
  else delete notes[date]
  const payload: CalendarData = {
    v: 1,
    days: current.days,
    ...(Object.keys(notes).length ? { notes } : {}),
  }
  const ok = await writeChatMetadata(host, key, CALENDAR_KEY, payload)
  if (ok) {
    emitStoryEvent({
      type: 'calendar-updated',
      summary: clean ? `已记下 ${date} 约定：${clean}` : `已清除 ${date} 约定`,
    })
  }
  return ok
}

export function calendarGap(today: Date, data: CalendarData) {
  const window = calendarWindow(today), retained = data.days.filter(day => window.includes(day.date))
  return { retained, missing: window.filter(date => !retained.some(day => day.date === date)) }
}

const PROMPT = `为当前剧情补齐公共日历，只输出 JSON：{"days":[{"date":"YYYY-MM-DD","festival":"","event":"","status":"上班/上学|放假","weather":"","content":""}]}。
日期只从用户给出的缺失日期中选择，今天只取用户给出的剧情日期，禁止改用现实日期、系统日期或自行推断日期。保留已有日历内容，7天内的大事件不得重复。星期几和与今天的关系由前端计算，AI不填写。
- 节日：节庆、纪念日、校历/职场/城镇/宗教/世界观节日；没有可留空，不要为了填满而每天硬造节日。
- 大事件：每天必须填入一个具体的、有明确名称的公共事件或可见变化，不能使用任何表示“一切照旧”的抽象短语。严格禁止出现“常态教学”“照常上课”“正常上班”“秩序正常”“普通通勤”“日常运转”“新周开始”等直接表示无事的词汇。当天若校历/职场/城镇无已知安排，必须根据天气、环境、社会动态、设施状况等合理生成一个影响公众的触发点（如突发检修、临时检查、意外天气影响、社区活动调整、交通变动等），使其成为当天独有的背景。7天内的大事件不得雷同，不得用不同措辞描述同一类无事状态。
- 状态：只能逐字填写完整字面值 上班/上学 或 放假；禁止填 上学、上班、放学、近义词、简称、拆分词或自造状态。
- 天气：只能逐字填写 晴、阴、多云、小雨、大雨、雷雨、小雪、大雪、雾、风、沙尘、极端天气。
- 内容：约 200 字，只介绍当天公共触发点的背景、含义、公共安排、参与方式、环境变化和可见影响；禁止写主角计划、NPC计划、私人行程、约会安排、秘密事件、角色心理或剧情推进。
每天都必须有可被感知的世界变化或公共触发点，决不允许出现没有事件的日子。常态运转本身不是事件，只有制度、环境、公共活动、天气影响、资源安排或世界观状态发生可见变化时才构成大事件。日历只提供世界层面的公共日程，不提供主角行程表。可以写群体性参与方式，不能写具体角色如何参与。事件必须贴合世界观、季节、地点、组织和生活圈；7天内必须呈现多样性，避免同类公共事件重复出现。节日、大事件、天气、状态和内容要互相支撑，不得出现逻辑冲突（例如雷雨天写露天活动正常举行且无人受影响）。当某天确实缺乏天然事件时，必须主动从天气变化、设施状况、外部通知、社会动态等角度创造一个微小但合理的公共触发点，使每一天都具有独一无二的叙事背景。`

export async function generateCalendar(host: AppHost, today: Date, missing: string[], retained: CalendarDay[], signal: AbortSignal): Promise<CalendarDay[]> {
  const config = getStoryAiConfig(host)
  if (!config) throw new Error('请先在微信设置里连接 AI。')
  const story = captureStory(host), profile = resolveProfile(record(record(host.getSettings().apps['wechat-sister']).config) as WeChatConfig, stableCharacterKey(story.card))
  const scope = await readStoryMemory(host, { scopeKey: 'calendar', characterName: story.name, card: story.card, externalState: { source: 'none' } }, profile, signal, story)
  const reply = await requestChat(config, [{ role: 'system', content: PROMPT }, { role: 'user', content:
    `${formatStoryMemory(scope)}\n剧情今天：${formatStoryDate(today)}\n只补这些日期：${JSON.stringify(missing)}\n保留的日历：${JSON.stringify(retained)}` }], signal)
  let raw: unknown
  try { raw = JSON.parse(reply) } catch { throw new Error('日历返回的 JSON 无法解析，请重试。') }
  return normalizeCalendar(raw).days.filter(day => missing.includes(day.date))
}
