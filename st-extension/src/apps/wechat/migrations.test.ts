import { describe, expect, it } from 'vitest'
import { migrateWeChatData } from './migrations'
import type { WeChatAppData } from './types'

describe('historical contact migration', () => {
  it('retains identity, content, media snapshots and state while converting legacy names', () => {
    const raw = {
      config: {}, contacts: { a: { id: 'a', name: 'Alice' } },
      conversations: { 'old::chat': {
        characterName: 'Alice', contactId: 'a', scopeKey: 'old::chat', draft: 'draft', unreadCount: 3,
        currentDay: 8, state: { mood: 76, interest: 28, money: 520, sisterLocation: 'on the train', playerLocation: '' },
        messages: [
          { id: 'old1', sender: 'sister', type: 'text', content: 'old reply', time: { day: 8, hour: 12, minute: 3 } },
          { sender: 'player', type: 'emoji', emojiSource: 'sister', content: 'shared-id', asset: { name: 'snapshot', file: '/saved.png', description: 'meaning' }, time: { day: 8, hour: 12, minute: 4 } },
        ],
      } },
    }
    const data = raw as unknown as WeChatAppData
    migrateWeChatData(data)
    const conv = data.conversations!['old::chat']
    expect(Object.keys(data.conversations!)).toEqual(['old::chat'])
    expect(conv.state).toMatchObject({ contactLocation: 'on the train', mood: 76, money: 520 })
    expect(conv.state).not.toHaveProperty('sisterLocation')
    expect(conv.messages[0]).toMatchObject({ id: 'old1', sender: 'contact', content: 'old reply', contactId: 'a', authorName: 'Alice' })
    expect(conv.messages[1]).toMatchObject({ sender: 'player', emojiSource: 'contact', asset: raw.conversations['old::chat'].messages[1].asset })
    expect(conv).toMatchObject({ draft: 'draft', unreadCount: 3, currentDay: 8 })
    const once = JSON.stringify(data)
    migrateWeChatData(data)
    expect(JSON.stringify(data)).toBe(once)
  })
  it('prefers modern values and never assigns a direct identity to historical group speakers', () => {
    const data = { config: {}, conversations: { g: {
      characterName: 'Group', conversationType: 'group', memberIds: ['a','b'], currentDay: 1,
      state: { contactLocation: 'park', sisterLocation: 'old', mood: 60, interest: 1, money: 0, playerLocation: '' },
      messages: [{ sender: 'contact', contactId: 'b', authorName: 'Bob', type: 'text', content: 'hi', time: { day: 1, hour: 1, minute: 0 } }],
    } } } as unknown as WeChatAppData
    migrateWeChatData(data)
    expect(data.conversations!.g.state.contactLocation).toBe('park')
    expect(data.conversations!.g.messages[0]).toMatchObject({ contactId: 'b', authorName: 'Bob' })
  })
})
