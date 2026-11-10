import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import { captureStory, formatStoryMemory, readStoryMemory, type StorySnapshot } from '../wechat/memory'
import { resolveProfile } from '../wechat/profile-library'
import type { WeChatConfig } from '../wechat/types'
import { getStoryAiConfig, requestChat } from '../shared/story-ai'
import type { TheaterData, TheaterFeeds, TheaterStory } from './types'

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const list = (value: unknown): unknown[] => Array.isArray(value) ? value : []
const strings = (value: unknown): string[] => list(value).filter((item): item is string => typeof item === 'string')
const str = (value: unknown) => typeof value === 'string' ? value : ''

/**
 * AI replies and persisted settings share this single data boundary.
 * Only the content field is required; models often omit decorative ones (tag, stats, heat).
 */
export function normalizeFeeds(value: unknown): TheaterFeeds {
  const raw = record(value), live = record(raw.live)
  return {
    square: list(raw.square).flatMap(value => {
      const p = record(value)
      if (!str(p.author) || !str(p.text)) return []
      return [{ author: str(p.author), tag: str(p.tag), time: str(p.time), text: str(p.text), stats: str(p.stats),
        topics: strings(p.topics), comments: list(p.comments).flatMap(value => {
          const c = record(value); return str(c.name) && str(c.text) ? [{ name: str(c.name), text: str(c.text) }] : []
        }) }]
    }),
    forum: list(raw.forum).flatMap(value => {
      const p = record(value)
      if (!str(p.title) || !str(p.text)) return []
      return [{ board: str(p.board), title: str(p.title), text: str(p.text), user: str(p.user), heat: str(p.heat),
        tags: strings(p.tags), comments: strings(p.comments) }]
    }),
    live: str(live.title)
      ? { room: str(live.room), title: str(live.title), cast: str(live.cast), summary: str(live.summary), stats: str(live.stats),
        danmaku: list(live.danmaku).flatMap(value => { const d = record(value); return str(d.text) ? [{ fan: str(d.fan), text: str(d.text) }] : [] }) }
      : null,
  }
}

export function parseFeeds(text: string): TheaterFeeds {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('小剧场返回的 JSON 无法解析，请重试。') }
  const feeds = normalizeFeeds(raw)
  if (!feeds.square.length && !feeds.forum.length && !feeds.live) throw new Error('小剧场返回的内容格式不对，请重试。')
  return feeds
}

export function readTheaterData(host: AppHost): TheaterData {
  const raw = record(host.getAppData()), stories = Object.entries(record(raw.stories)).map(([key, value]) => {
    const story = record(value)
    return [key, { ...normalizeFeeds(story), updatedAt: typeof story.updatedAt === 'number' ? story.updatedAt : 0,
      fingerprint: typeof story.fingerprint === 'string' ? story.fingerprint : '' }] as const
  }).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 20)
  return { autoGenerate: raw.autoGenerate !== false, stories: Object.fromEntries(stories) }
}

export function mergeFeeds(previous: TheaterFeeds, incoming: TheaterFeeds): TheaterFeeds {
  return { square: [...incoming.square, ...previous.square].slice(0, 5), forum: [...incoming.forum, ...previous.forum].slice(0, 5), live: incoming.live ?? previous.live }
}

export function saveTheaterStory(data: TheaterData, key: string, story: TheaterStory): TheaterData {
  return { ...data, stories: Object.fromEntries(Object.entries({ ...data.stories, [key]: story })
    .sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 20)) }
}

const PROMPT = `为当前故事制作旁观视角的小剧场，只输出 JSON，不要 Markdown。
广场 square：新增 1–2 条，每位有名字的重要配角只发一条；主角和路人不发帖，路人可评论。每帖 4–8 条评论，各人只谈亲历、听闻或围观能知道的部分，禁止全知。
论坛 forum：新增 1–2 条，只讨论已经公开传播的剧情事件，不编造线下窥探主角的见闻。网友说话随意口语化，每帖 4–8 条一句话评论。
直播 live：只围绕眼前这一幕，12–20 条弹幕，分成 2–4 个粉丝团，每条写粉丝团名。
所有内容不推进主线、不替主角决定、不复述人设，避开最近已发布的内容。数组按最新在前排列。
结构（所有标量用字符串）：
{"square":[{"author":"","tag":"","time":"","text":"","topics":[""],"comments":[{"name":"","text":""}],"stats":""}],"forum":[{"board":"","title":"","text":"","tags":[""],"user":"","heat":"","comments":[""]}],"live":{"room":"","title":"","cast":"","summary":"","stats":"","danmaku":[{"fan":"","text":""}]}}`

export async function generateTheater(host: AppHost, previous: TheaterFeeds, signal: AbortSignal, story: StorySnapshot = captureStory(host)): Promise<TheaterFeeds> {
  const config = getStoryAiConfig(host)
  if (!config) throw new Error('请先在微信设置里连接 AI')
  const wechat = record(host.getSettings().apps['wechat-sister'])
  const profile = resolveProfile(record(wechat.config) as WeChatConfig, stableCharacterKey(story.card))
  const scope = await readStoryMemory(host, { scopeKey: 'theater', characterName: story.name, card: story.card, externalState: { source: 'none' } }, profile, signal, story)
  const recent = [...previous.square.map(p => p.text.slice(0, 30)), ...previous.forum.map(p => p.title + ' ' + p.text.slice(0, 30)), ...(previous.live ? [previous.live.title] : [])]
  return parseFeeds(await requestChat(config, [{ role: 'system', content: PROMPT },
    { role: 'user', content: `${formatStoryMemory(scope)}\n主角：${story.name}；玩家：${profile.playerName || '用户'}\n最近内容：${JSON.stringify(recent)}` }], signal))
}
