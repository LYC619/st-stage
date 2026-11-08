import { describe, expect, it } from 'vitest'
import { conversationPreview, listTime, momentTime } from './list-format'
import type { Conversation } from './types'

const now = new Date(2026, 10, 8, 15, 30)
const at = (...parts: [number, number, number, number, number]) => new Date(...parts).getTime()
const conversation = (patch: Partial<Conversation>): Conversation => ({ characterName: 'A', contactId: 'avatar:a.png', messages: [], state: { mood: 60, interest: 15, money: 0, contactLocation: '', playerLocation: '' }, currentDay: 1, ...patch })

describe('WeChat list formatting', () => {
  it('formats list times like WeChat, including across midnight and year boundaries', () => {
    expect(listTime(undefined, now)).toBe('')
    expect(listTime(at(2026, 10, 8, 9, 5), now)).toBe('09:05')
    expect(listTime(at(2026, 10, 7, 23, 59), now)).toBe('昨天')
    expect(listTime(at(2026, 0, 2, 8, 0), now)).toBe('1/2')
    expect(listTime(at(2025, 11, 31, 8, 0), now)).toBe('2025/12/31')
  })

  it('keeps Moments times absolute so they never go stale on an open feed', () => {
    expect(momentTime(at(2026, 10, 8, 9, 5), now)).toBe('09:05')
    expect(momentTime(at(2026, 10, 7, 21, 0), now)).toBe('昨天 21:00')
    expect(momentTime(at(2026, 4, 1, 7, 30), now)).toBe('5月1日 07:30')
    expect(momentTime(at(2024, 4, 1, 7, 30), now)).toBe('2024年5月1日')
  })

  it('previews replies, drafts, media and legacy sessions in priority order', () => {
    const time = { day: 1, hour: 1, minute: 0 }
    const group = conversation({ contactId: undefined, conversationType: 'group', messages: [{ sender: 'contact', authorName: 'B', type: 'text', content: 'hi', time }] })
    expect(conversationPreview(group, true, false)).toBe('B: hi')
    expect(conversationPreview(group, true, true)).toBe('正在回复…')
    expect(conversationPreview(conversation({ draft: '想说的话', messages: group.messages }), false, false)).toBe('[草稿] 想说的话')
    expect(conversationPreview(conversation({ messages: [{ sender: 'player', type: 'red_packet', content: '奶茶', time }] }), false, false)).toBe('[红包] 奶茶')
    expect(conversationPreview(conversation({}), false, false)).toBe('开始聊天')
    expect(conversationPreview(conversation({ contactId: undefined, chatId: 'old-chat' }), false, false)).toBe('旧会话 · old-chat · 开始聊天')
  })
})
