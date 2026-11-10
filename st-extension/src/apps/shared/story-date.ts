// Relative-date rules from 玉子手机 modules/phone-core/derived-fields/chronicle-today-relation-sql.js.
import type { AppHost } from '../../../../core/phone-registry'
import { readStoryState } from '../story-state/store'
import { readChronicleData } from '../chronicle/store'

export function formatStoryDate(date: Date): string {
  return `${String(date.getFullYear()).padStart(4, '0')}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
}

export function parseSpanEnd(timeSpan: string): Date | null {
  const value = (timeSpan.includes('~') ? timeSpan.split('~')[1] : timeSpan).trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [year, month, day] = value.split('-').map(Number), date = new Date(0)
  date.setFullYear(year, month - 1, day); date.setHours(0, 0, 0, 0)
  return formatStoryDate(date) === value ? date : null
}

export async function storyToday(host: AppHost): Promise<Date | null> {
  const { state } = await readStoryState(host), time = state.时间
  if (time.年 && time.月 && time.日) {
    const date = parseSpanEnd(`${String(time.年).padStart(4, '0')}-${String(time.月).padStart(2, '0')}-${String(time.日).padStart(2, '0')}`)
    if (date) return date
  }
  const latest = readChronicleData().entries.at(-1)
  return latest ? parseSpanEnd(latest.timeSpan) : null
}

function chinese(value: number): string {
  const digits = '零一二三四五六七八九'
  if (value < 10) return digits[value]
  if (value < 100) return `${value < 20 ? '' : digits[Math.floor(value / 10)]}十${value % 10 ? digits[value % 10] : ''}`
  return String(value)
}

export function relationToToday(target: Date, today: Date): string {
  const day = (date: Date) => Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000
  const diff = day(today) - day(target), abs = Math.abs(diff), direction = diff > 0 ? '前' : '后'
  if (!diff) return '今天'
  if (abs === 1) return diff > 0 ? '昨天' : '明天'
  if (abs === 2) return diff > 0 ? '前天' : '后天'
  if (abs === 7) return `一周${direction}`
  if (abs === 15) return `半个月${direction}`
  if (abs === 21) return `三周${direction}`
  if (abs < 30) return `${abs}天${direction}`
  if (abs < 180) {
    const steps = Math.floor(abs / 15), whole = Math.floor(steps / 2), count = whole === 2 ? '两' : chinese(whole)
    return `${count}${steps % 2 ? '个半月' : '个月'}${direction}`
  }
  if (abs < 360) return `半年${direction}`
  const steps = Math.floor(abs / 180), whole = Math.floor(steps / 2), count = whole === 2 ? '两' : chinese(whole)
  return `${count}年${steps % 2 ? '半' : ''}${direction}`
}
