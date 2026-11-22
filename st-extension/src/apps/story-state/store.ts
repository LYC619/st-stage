import type { AppHost } from '../../../../core/phone-registry'
import { readChatMetadata, writeChatMetadata, storyIdentity } from '../shared/chat-metadata'
export { metadataContext } from '../shared/chat-metadata'
import { getLastMessageId, readVariables } from '../mvu/bridge'

export const META_KEY = 'st_stage_story_state'
export interface Quest { id: string; 标题: string; 描述: string; 状态: string; 时间: string; 奖励: string }
export interface Item { id: string; 名称: string; 数量: number; 描述: string; 稀有度: string }
export interface Skill { id: string; 名称: string; 等级: number; 熟练度: number; 类型: string; 描述: string }
export interface StoryState {
  时间: { 显示: string; 年: number; 月: number; 日: number; 时: number; 分: number; 星期: string }
  位置: { 区域: string; 地点: string; 细节: string; 座标: string }
  任务: Quest[]; 背包: Item[]; 技能: Skill[]
}
export interface StoryStateSnapshot { key: string; backend: 'mvu' | 'local'; raw: Record<string, unknown>; state: StoryState }
export interface StoryStateSettings { autoSync: boolean; contextMessages: number; injectToChat: boolean }

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const text = (value: unknown, fallback = '') => typeof value === 'string' ? value : fallback
const number = (value: unknown, fallback = 0) => typeof value === 'number' && Number.isFinite(value) ? value : fallback
const rows = (value: unknown): Record<string, unknown>[] => Array.isArray(value) ? value.map(record) : []

/** Whitelisted display fields; persist the separate raw object to retain card-specific fields. */
export function normalize(value: unknown): StoryState {
  const raw = record(value), time = record(raw.时间), location = record(raw.位置)
  return {
    时间: { 显示: text(time.显示), 年: number(time.年), 月: number(time.月), 日: number(time.日), 时: number(time.时), 分: number(time.分), 星期: text(time.星期) },
    位置: { 区域: text(location.区域), 地点: text(location.地点), 细节: text(location.细节), 座标: text(location.座标) },
    任务: rows(raw.任务).map(row => ({ id: text(row.id), 标题: text(row.标题 ?? row.名称), 描述: text(row.描述), 状态: text(row.状态, '进行中'), 时间: text(row.时间), 奖励: text(row.奖励) })),
    背包: rows(Array.isArray(raw.背包) ? raw.背包 : Object.values(record(raw.背包))).map(row => ({ id: text(row.id), 名称: text(row.名称, '未知道具'), 数量: number(row.数量, 1), 描述: text(row.描述), 稀有度: text(row.稀有度, '普通') })),
    技能: rows(raw.技能).map(row => ({ id: text(row.id), 名称: text(row.名称, '未知能力'), 等级: number(row.等级, 1), 熟练度: Math.max(0, Math.min(100, number(row.熟练度))), 类型: text(row.类型), 描述: text(row.描述) })),
  }
}

export function readSyncSettings(host: AppHost): StoryStateSettings {
  const raw = record(host.getAppData())
  return {
    autoSync: raw.autoSync === true,
    contextMessages: Math.max(1, Math.min(60, Math.round(number(raw.contextMessages, 12)))),
    injectToChat: raw.injectToChat === true,
  }
}

export async function readStoryState(host: AppHost): Promise<StoryStateSnapshot> {
  const key = storyIdentity(host), id = getLastMessageId()
  const result = await readVariables({ type: 'message', message_id: id < 0 ? 'latest' : id }, id)
  if (key !== storyIdentity(host)) throw new Error('聊天已切换。')
  const backend = result.isMvu && result.status === 'ready' ? 'mvu' : 'local'
  const raw = structuredClone(backend === 'mvu' ? result.data : record(record(readChatMetadata(META_KEY)).stat_data))
  return { key, backend, raw, state: normalize(raw) }
}

export async function writeLocalState(host: AppHost, snapshot: StoryStateSnapshot, stat: Record<string, unknown>): Promise<boolean> {
  if (snapshot.backend !== 'local') return false
  return writeChatMetadata(host, snapshot.key, META_KEY, { stat_data: stat, v: 1 })
}

export function formatTime(time: StoryState['时间']): string {
  if (time.显示) return time.显示
  if (!time.年 && !time.月 && !time.日) return '尚未记录'
  return `${time.年}年${time.月}月${time.日}日 ${String(time.时).padStart(2, '0')}:${String(time.分).padStart(2, '0')}${time.星期 ? ' 周' + time.星期 : ''}`
}

export function formatIsoDateFromTime(time: StoryState['时间']): string {
  if (!time.年 || !time.月 || !time.日) return ''
  return `${String(time.年).padStart(4, '0')}-${String(time.月).padStart(2, '0')}-${String(time.日).padStart(2, '0')}`
}

export function formatStoryStateInjection(state: StoryState): string {
  const timeText = formatTime(state.时间)
  const locText = [state.位置.区域, state.位置.地点, state.位置.细节].filter(Boolean).join(' · ')
  const activeQuests = state.任务.filter(q => q.状态 === '进行中').slice(0, 4).map(q => q.标题)
  const items = state.背包.filter(i => i.数量 > 0).slice(0, 6).map(i => `${i.名称}×${i.数量}`)
  const lines: string[] = []
  if (timeText !== '尚未记录') lines.push(`时间：${timeText}`)
  if (locText) lines.push(`地点：${locText}`)
  if (activeQuests.length) lines.push(`进行中事项：${activeQuests.join('、')}`)
  if (items.length) lines.push(`随身行囊：${items.join('、')}`)
  if (!lines.length) return ''
  return `<当前剧情状态>\n${lines.join('\n')}\n</当前剧情状态>`
}

export function summarizeStoryStateForHud(snapshot: StoryStateSnapshot): Record<string, unknown> | null {
  if (snapshot.backend !== 'local') return null
  const { state } = snapshot
  const timeText = formatTime(state.时间)
  const locText = [state.位置.区域, state.位置.地点].filter(Boolean).join(' · ')
  const activeQuests = state.任务.filter(q => q.状态 === '进行中').map(q => q.标题)
  const bag = Object.fromEntries(state.背包.filter(i => i.数量 > 0).map(i => [i.名称, i.数量]))
  if (timeText === '尚未记录' && !locText && !activeQuests.length && !Object.keys(bag).length) return null
  return {
    ...(timeText !== '尚未记录' ? { 时空: timeText } : {}),
    ...(locText ? { 地点: locText } : {}),
    ...(activeQuests.length ? { 委托: activeQuests.join(' / ') } : {}),
    ...(Object.keys(bag).length ? { 行囊: bag } : {}),
  }
}
