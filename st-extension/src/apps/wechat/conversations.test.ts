// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { addContactConversation, conversationScope, listContacts, loadContact } from './conversations'
import type { WeChatAppData } from './types'
import type { AppHost } from '../../../../core/phone-registry'

describe('independent WeChat contacts', () => {
  it('isolates same-name cards, retains legacy history and never reads the main chat', () => {
    const data: WeChatAppData = { config: {}, conversations: {} }
    const a = addContactConversation(data, { id: 'avatar:a.png', name: 'Same', card: { name: 'Same', avatar: 'a.png', description: 'A' } })
    const b = addContactConversation(data, { id: 'avatar:b.png', name: 'Same', card: { name: 'Same', avatar: 'b.png', description: 'B' } })
    a.messages.push({ sender: 'player', type: 'text', content: 'PRIVATE_A', time: { day: 1, hour: 1, minute: 0 } })
    expect(a).not.toBe(b)
    expect(conversationScope(data, b).card?.description).toBe('B')
    expect(conversationScope(data, b).stRecentMessages).toBeUndefined()
    expect(addContactConversation(data, data.contacts!['avatar:a.png'])).toBe(a)
    expect(a.messages.at(-1)?.content).toBe('PRIVATE_A')
  })
  it('hydrates the selected card by avatar without switching the host character', async () => {
    const context = { characterId: 0, characters: [{ name: 'A', avatar: 'a.png' }, { name: 'B', avatar: 'b.png', shallow: true }], unshallowCharacter: vi.fn(async () => {
      context.characters.reverse()
      Object.assign(context.characters[0], { shallow: false, description: 'B persona' })
    }) }
    Object.assign(window, { SillyTavern: { getContext: () => context } })
    const host = { getCharacterCard: () => context.characters.find(c => c.avatar === 'a.png') } as AppHost
    expect(listContacts(host)).toHaveLength(2)
    const b = await loadContact(host, 'avatar:b.png')
    expect(b.card?.description).toBe('B persona')
    expect(context.characterId).toBe(0)
    Reflect.deleteProperty(window, 'SillyTavern')
  })
})
