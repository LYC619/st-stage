import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import { captureStory, formatStoryMemory, readStoryMemory, type StorySnapshot } from '../wechat/memory'
import { resolveProfile } from '../wechat/profile-library'
import type { WeChatConfig } from '../wechat/types'
import { getStoryAiConfig, requestChat } from '../shared/story-ai'
import type { TheaterChannel, TheaterData, TheaterFeeds, TheaterStory } from './types'
import { formatStoryDate, storyToday } from '../shared/story-date'
import { DIARY_PROMPT, mergeDiary } from './diary'

export const MAX_FEED_ITEMS = 15

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
    diary: list(raw.diary).flatMap(value => {
      const row = record(value), role = str(row.role).trim(), content = str(row.content).trim()
      return role && content
        ? [{ role, content, date: str(row.date), ...(row.pinned === true ? { pinned: true } : {}) }]
        : []
    }),
    square: list(raw.square).flatMap(value => {
      const p = record(value)
      if (!str(p.author) || !str(p.text)) return []
      return [{
        author: str(p.author),
        tag: str(p.tag),
        time: str(p.time),
        text: str(p.text),
        stats: str(p.stats),
        topics: strings(p.topics),
        comments: list(p.comments).flatMap(value => {
          const c = record(value)
          return str(c.name) && str(c.text) ? [{ name: str(c.name), text: str(c.text) }] : []
        }),
        ...(p.liked === true ? { liked: true } : {}),
        ...(p.pinned === true ? { pinned: true } : {}),
      }]
    }),
    forum: list(raw.forum).flatMap(value => {
      const p = record(value)
      if (!str(p.title) || !str(p.text)) return []
      return [{
        board: str(p.board),
        title: str(p.title),
        text: str(p.text),
        user: str(p.user),
        heat: str(p.heat),
        tags: strings(p.tags),
        comments: strings(p.comments),
        ...(p.pinned === true ? { pinned: true } : {}),
      }]
    }),
    live: str(live.title)
      ? {
          room: str(live.room),
          title: str(live.title),
          cast: str(live.cast),
          summary: str(live.summary),
          stats: str(live.stats),
          danmaku: list(live.danmaku).flatMap(value => {
            const d = record(value)
            return str(d.text) ? [{ fan: str(d.fan), text: str(d.text) }] : []
          }),
        }
      : null,
  }
}

export function parseFeeds(text: string): TheaterFeeds {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('幕后 AI 这次递来的稿子格式乱了（JSON 无法解析），再点一次刷新试试。') }
  const feeds = normalizeFeeds(raw)
  if (!feeds.square.length && !feeds.forum.length && !feeds.live && !feeds.diary.length) {
    throw new Error('幕后 AI 这次返回的内容格式不对，再点一次刷新试试。')
  }
  return feeds
}

export function readTheaterData(host: AppHost): TheaterData {
  const raw = record(host.getAppData()), stories = Object.entries(record(raw.stories)).map(([key, value]) => {
    const story = record(value)
    return [key, {
      ...normalizeFeeds(story),
      updatedAt: typeof story.updatedAt === 'number' ? story.updatedAt : 0,
      fingerprint: typeof story.fingerprint === 'string' ? story.fingerprint : '',
    }] as const
  }).sort((a, b) => b[1].updatedAt - a[1].updatedAt).slice(0, 20)
  return { autoGenerate: raw.autoGenerate !== false, stories: Object.fromEntries(stories) }
}

function capFeed<T extends { pinned?: boolean }>(items: T[], limit = MAX_FEED_ITEMS): T[] {
  if (items.length <= limit) return items
  const pinnedIdx: number[] = []
  const unpinnedIdx: number[] = []
  items.forEach((item, idx) => {
    if (item.pinned) pinnedIdx.push(idx)
    else unpinnedIdx.push(idx)
  })
  const keptPinned = pinnedIdx.slice(0, limit)
  const keptUnpinned = unpinnedIdx.slice(0, Math.max(0, limit - keptPinned.length))
  const keepIndices = new Set([...keptPinned, ...keptUnpinned])
  return items.filter((_, idx) => keepIndices.has(idx))
}

function mergePosts<T extends { pinned?: boolean; liked?: boolean }>(previous: T[], incoming: T[], key: (post: T) => string): T[] {
  const prior = new Map(previous.map(post => [key(post), post]))
  const added = new Map(incoming.map(post => {
    const id = key(post), old = prior.get(id)
    return [id, old ? { ...post, pinned: old.pinned, liked: old.liked } : post]
  }))
  return capFeed([...added.values(), ...previous.filter(post => !added.has(key(post)))])
}

export function mergeFeeds(previous: TheaterFeeds, incoming: TheaterFeeds, channel: TheaterChannel = 'all', started?: TheaterFeeds): TheaterFeeds {
  const include = (name: TheaterChannel) => channel === 'all' || channel === name
  let live = include('live') ? incoming.live ?? previous.live : previous.live
  if (live && live !== previous.live && previous.live) {
    const sameShow = previous.live.room === live.room && previous.live.title === live.title
    const oldComments = new Map<string, number>()
    for (const item of started?.live?.danmaku ?? []) {
      if (item.fan === '我') oldComments.set(item.text, (oldComments.get(item.text) ?? 0) + 1)
    }
    const own = previous.live.danmaku.filter(item => {
      if (item.fan !== '我') return false
      if (sameShow) return true
      const count = oldComments.get(item.text) ?? 0
      if (count) oldComments.set(item.text, count - 1)
      return count === 0
    })
    live = { ...live, danmaku: [...own, ...live.danmaku.filter(item => !own.some(saved => saved.fan === item.fan && saved.text === item.text))] }
  }
  return {
    square: include('square') ? mergePosts(previous.square, incoming.square, post => JSON.stringify([post.author, post.text])) : previous.square,
    forum: include('forum') ? mergePosts(previous.forum, incoming.forum, post => JSON.stringify([post.board, post.user, post.title])) : previous.forum,
    live,
    diary: include('diary') ? mergeDiary(previous.diary, incoming.diary) : previous.diary,
  }
}

export function saveTheaterStory(data: TheaterData, key: string, story: TheaterStory): TheaterData {
  return {
    ...data,
    stories: Object.fromEntries(
      Object.entries({ ...data.stories, [key]: story })
        .sort((a, b) => b[1].updatedAt - a[1].updatedAt)
        .slice(0, 20),
    ),
  }
}

const SQUARE_RULE = `广场 square：新增 1–2 条，每位有名字的重要配角只发一条；主角和路人不发帖，路人可评论。每帖 4–8 条评论，各人只谈亲历、听闻或围观能知道的部分，禁止全知。`
const FORUM_RULE = `论坛 forum：新增 1–2 条，只讨论已经公开传播的剧情事件，不编造线下窥探主角的见闻。网友说话随意口语化，每帖 4–8 条一句话评论。`
const LIVE_RULE = `直播 live：只围绕眼前这一幕，12–20 条弹幕，分成 2–4 个粉丝团，每条写粉丝团名。`

const PROMPT_ALL = `为当前故事制作旁观视角的小剧场，只输出 JSON，不要 Markdown。
${SQUARE_RULE}
${FORUM_RULE}
${LIVE_RULE}
${DIARY_PROMPT}
所有内容不推进主线、不替主角决定、不复述人设，避开最近已发布的内容。数组按最新在前排列。
结构（所有标量用字符串）：
{"square":[{"author":"","tag":"","time":"","text":"","topics":[""],"comments":[{"name":"","text":""}],"stats":""}],"forum":[{"board":"","title":"","text":"","tags":[""],"user":"","heat":"","comments":[""]}],"live":{"room":"","title":"","cast":"","summary":"","stats":"","danmaku":[{"fan":"","text":""}]},"diary":[{"role":"","content":""}]}`

function buildPromptForChannel(channel: TheaterChannel): string {
  if (channel === 'all') return PROMPT_ALL
  const spec: Record<Exclude<TheaterChannel, 'all'>, { rule: string; shape: string }> = {
    square: {
      rule: SQUARE_RULE,
      shape: '{"square":[{"author":"","tag":"","time":"","text":"","topics":[""],"comments":[{"name":"","text":""}],"stats":""}]}',
    },
    forum: {
      rule: FORUM_RULE,
      shape: '{"forum":[{"board":"","title":"","text":"","tags":[""],"user":"","heat":"","comments":[""]}]}',
    },
    live: {
      rule: LIVE_RULE,
      shape: '{"live":{"room":"","title":"","cast":"","summary":"","stats":"","danmaku":[{"fan":"","text":""}]}}',
    },
    diary: {
      rule: DIARY_PROMPT,
      shape: '{"diary":[{"role":"","content":""}]}',
    },
  }
  const picked = spec[channel]
  return `为当前故事制作旁观视角的小剧场单频道内容，只输出 JSON，不要 Markdown。\n${picked.rule}\n所有内容不推进主线、不替主角决定、不复述人设，避开最近已发布的内容。\n结构（所有标量用字符串）：\n${picked.shape}`
}

export async function generateTheater(
  host: AppHost,
  previous: TheaterFeeds,
  signal: AbortSignal,
  story: StorySnapshot = captureStory(host),
  channel: TheaterChannel = 'all',
): Promise<TheaterFeeds> {
  const config = getStoryAiConfig(host)
  if (!config) throw new Error('请先在下方设置或微信里连上幕后 AI')
  const wechat = record(host.getSettings().apps['wechat-sister'])
  const profile = resolveProfile(record(wechat.config) as WeChatConfig, stableCharacterKey(story.card))
  const scope = await readStoryMemory(
    host,
    { scopeKey: 'theater', characterName: story.name, card: story.card, externalState: { source: 'none' } },
    profile,
    signal,
    story,
  )
  const recent = [
    ...previous.square.slice(0, 6).map(p => p.text.slice(0, 30)),
    ...previous.forum.slice(0, 6).map(p => p.title + ' ' + p.text.slice(0, 30)),
    ...(previous.live ? [previous.live.title] : []),
  ]
  const today = await storyToday(host), date = today ? formatStoryDate(today) : ''
  signal.throwIfAborted()
  const feeds = parseFeeds(
    await requestChat(
      config,
      [
        { role: 'system', content: buildPromptForChannel(channel) },
        {
          role: 'user',
          content: `${formatStoryMemory(scope)}\n主角：${story.name}；玩家：${profile.playerName || '用户'}\n剧情日期：${date || '未知'}\n最近内容：${JSON.stringify(recent)}${channel === 'all' || channel === 'diary' ? `\n上一批日记：${JSON.stringify(previous.diary.slice(-5))}` : ''}`,
        },
      ],
      signal,
    ),
  )
  return { ...feeds, diary: feeds.diary.map(entry => ({ ...entry, date })) }
}
