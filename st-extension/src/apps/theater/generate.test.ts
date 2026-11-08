import { describe, expect, it } from 'vitest'
import { mergeFeeds, parseFeeds, saveTheaterStory } from './generate'
import type { TheaterFeeds } from './types'

export const feeds: TheaterFeeds = {
  square: [{ author: '配角', tag: '船长', time: '刚刚', text: '月港见闻', topics: ['月港'], comments: [{ name: '路人', text: '听说过' }], stats: '赞 12' }],
  forum: [{ board: '闲聊', title: '月港开幕', text: '公开消息', tags: ['新闻'], user: '匿名', heat: '热度 86', comments: ['来看看'] }],
  live: { room: '直播间', title: '雨中月港', cast: '阿青', summary: '抵达港口', stats: '观看 100', danmaku: [{ fan: '青团', text: '来了' }] },
}
describe('theater generation data', () => {
  it('rejects bad JSON and drops malformed entries without repairing them', () => {
    expect(() => parseFeeds('```json\n{}')).toThrow('JSON')
    expect(parseFeeds(JSON.stringify({ ...feeds, square: [feeds.square[0], { author: '坏条目' }], forum: [null], live: { title: 5 } })))
      .toEqual({ square: feeds.square, forum: [], live: null })
  })
  it('keeps the newest five posts and replaces the live show', () => {
    const previous = { ...feeds, square: Array.from({ length: 5 }, (_, i) => ({ ...feeds.square[0], text: String(i) })) }
    const result = mergeFeeds(previous, { ...feeds, live: { ...feeds.live!, title: '新直播' } })
    expect(result.square.map(p => p.text)).toEqual(['月港见闻', '0', '1', '2', '3'])
    expect(result.live?.title).toBe('新直播')
    expect(mergeFeeds({ ...feeds, forum: Array(5).fill(feeds.forum[0]) }, feeds).forum).toHaveLength(5)
  })
  it('evicts the oldest chat after twenty stored stories', () => {
    const stories = Object.fromEntries(Array.from({ length: 20 }, (_, i) => [String(i), { ...feeds, fingerprint: '', updatedAt: i }]))
    const result = saveTheaterStory({ autoGenerate: true, stories }, 'new', { ...feeds, fingerprint: 'a', updatedAt: 30 })
    expect(Object.keys(result.stories)).toHaveLength(20); expect(result.stories['0']).toBeUndefined()
  })
})
