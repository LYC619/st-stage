import { describe, expect, it } from 'vitest'
import { MAX_FEED_ITEMS, mergeFeeds, parseFeeds, saveTheaterStory } from './generate'
import type { TheaterFeeds } from './types'

export const feeds: TheaterFeeds = {
  diary: [],
  square: [{ author: '配角', tag: '船长', time: '刚刚', text: '月港见闻', topics: ['月港'], comments: [{ name: '路人', text: '听说过' }], stats: '赞 12' }],
  forum: [{ board: '闲聊', title: '月港开幕', text: '公开消息', tags: ['新闻'], user: '匿名', heat: '热度 86', comments: ['来看看'] }],
  live: { room: '直播间', title: '雨中月港', cast: '阿青', summary: '抵达港口', stats: '观看 100', danmaku: [{ fan: '青团', text: '来了' }] },
}
describe('theater generation data', () => {
  it('rejects bad JSON and drops entries without content', () => {
    expect(() => parseFeeds('```json\n{}')).toThrow('JSON')
    expect(() => parseFeeds(JSON.stringify({ square: [{ author: '坏条目' }], forum: [null] }))).toThrow('格式不对')
    expect(parseFeeds(JSON.stringify({ ...feeds, square: [feeds.square[0], { author: '坏条目' }], forum: [null], live: { title: 5 } })))
      .toEqual({ square: feeds.square, forum: [], live: null, diary: [] })
  })
  it('keeps posts whose decorative fields are missing', () => {
    const result = parseFeeds(JSON.stringify({ square: [{ author: '配角', text: '只有正文' }], forum: [{ title: '标题', text: '正文' }], live: { title: '直播', danmaku: [{ text: '来了' }] } }))
    expect(result.square[0]).toEqual({ author: '配角', tag: '', time: '', text: '只有正文', stats: '', topics: [], comments: [] })
    expect(result.forum[0].comments).toEqual([])
    expect(result.live?.danmaku).toEqual([{ fan: '', text: '来了' }])
  })
  it('retains up to 15 newest posts while protecting pinned posts and replacing the live show', () => {
    const previous = {
      ...feeds,
      square: Array.from({ length: MAX_FEED_ITEMS }, (_, i) => ({
        ...feeds.square[0],
        text: String(i),
        ...(i === MAX_FEED_ITEMS - 1 ? { pinned: true } : {}),
      })),
    }
    const result = mergeFeeds(previous, { ...feeds, live: { ...feeds.live!, title: '新直播' } })
    expect(result.square).toHaveLength(MAX_FEED_ITEMS)
    expect(result.square[0].text).toBe('月港见闻')
    expect(result.square.at(-1)?.text).toBe(String(MAX_FEED_ITEMS - 1))
    expect(result.live?.title).toBe('新直播')
    expect(mergeFeeds(feeds, { ...feeds, live: null }).live?.title).toBe('雨中月港')
    expect(mergeFeeds({ ...feeds, forum: Array.from({ length: MAX_FEED_ITEMS }, (_, i) => ({ ...feeds.forum[0], title: String(i) })) }, feeds).forum).toHaveLength(MAX_FEED_ITEMS)
  })
  it('evicts the oldest chat after twenty stored stories', () => {
    const stories = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i), { ...feeds, fingerprint: '', updatedAt: i }]))
    const result = saveTheaterStory({ autoGenerate: true, stories }, 'new', { ...feeds, fingerprint: 'a', updatedAt: 30 })
    expect(Object.keys(result.stories)).toHaveLength(20); expect(result.stories['0']).toBeUndefined()
  })
})
