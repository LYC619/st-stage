// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { requestOpenApp, resetStoryEvents } from '../shared/story-events'
import { mountWeChat } from './test-fixture'
import { conversationScope } from './conversations'
import { WeChatPipeline } from './pipeline'
import { defaultContactState } from './groups'
import { migrateWeChatData } from './migrations'

let mounted: ReturnType<typeof mountWeChat> | undefined
afterEach(() => { mounted?.app.unmount?.(); mounted = undefined; resetStoryEvents(); vi.unstubAllGlobals(); vi.restoreAllMocks(); document.body.replaceChildren() })
describe('story NPC contacts', () => {
  it('opens a cardless NPC, persists persona/history/draft and isolates the same name in another story', async () => {
    const legacy = { characterName: 'Innkeeper', scopeKey: 'legacy-name', currentDay: 1, state: defaultContactState(),
      messages: [{ sender: 'player' as const, type: 'text' as const, content: 'Legacy history', time: { day: 1, hour: 1, minute: 0 } }] }
    mounted = mountWeChat({ config: { autoMoments: false }, conversations: { 'legacy-name': legacy } })
    const f = mounted
    let chatId = 'story-one'
    f.ctx.getChatContext = () => ({ chatId, chat: [] })
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Innkeeper' }); f.remount()
    await vi.waitFor(() => expect(f.el('#wt-contact-name').textContent).toBe('Innkeeper'))
    const first = f.data().conversations![f.data().activeScopeKey!]
    const scope = conversationScope(f.data(), first)
    expect(scope.storyKey).toBe('avatar:a.png::story-one')
    expect(scope.contactId).toBe(first.contactId)
    expect(scope.card?.description).toContain('主线故事')
    const prompt = new WeChatPipeline({}, {}, {}, {}).buildSystemPrompt(defaultContactState(), 'now', scope)
    expect(prompt).toContain('Innkeeper')
    f.el<HTMLInputElement>('#wt-input-text').value = 'First story'; f.el('#wt-send-btn').click()
    await vi.waitFor(() => expect(first.messages.length).toBe(2))
    f.el<HTMLInputElement>('#wt-input-text').value = 'Unsent draft'
    f.el('#wt-input-text').dispatchEvent(new Event('input', { bubbles: true }))
    f.ctx.setAppData(JSON.parse(JSON.stringify(f.data()))); f.remount(); migrateWeChatData(f.data())
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Innkeeper' }); f.remount()
    await vi.waitFor(() => expect(f.data().activeScopeKey).toBe(first.scopeKey))
    expect(f.el<HTMLInputElement>('#wt-input-text').value).toBe('Unsent draft')
    expect(f.data().conversations![first.scopeKey!].messages[0].content).toBe('First story')
    expect(conversationScope(f.data(), f.data().conversations![first.scopeKey!])).toMatchObject({ contactId: scope.contactId, storyKey: scope.storyKey })
    expect(f.data().conversations!['legacy-name'].messages[0].content).toBe('Legacy history')
    chatId = 'story-two'; f.hostChange('A')
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Innkeeper' }); f.remount()
    await vi.waitFor(() => expect(f.el('#wt-contact-name').textContent).toBe('Innkeeper'))
    const second = f.data().conversations![f.data().activeScopeKey!]
    expect(second.scopeKey).not.toBe(first.scopeKey)
    expect(second.messages).toHaveLength(0)
    expect(second.draft).toBeUndefined()
    expect(conversationScope(f.data(), second).storyKey).toBe('avatar:a.png::story-two')
    expect(f.container.querySelector(`[data-conversation="${first.scopeKey}"]`)).toBeNull()
  })
  it('uses the matching real card and abandons a late card load after switching stories', async () => {
    let finish!: () => void
    const card = { name: 'Visitor', avatar: 'visitor.png', shallow: true, description: 'REAL_CARD' }
    const hydrate = vi.fn(() => new Promise<void>(resolve => { finish = () => { card.shallow = false; resolve() } }))
    vi.stubGlobal('SillyTavern', { getContext: () => ({ characters: [card], unshallowCharacter: hydrate }) })
    mounted = mountWeChat(); const f = mounted
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Visitor' }); f.remount()
    await vi.waitFor(() => expect(hydrate).toHaveBeenCalledOnce())
    f.hostChange('B'); finish()
    await Promise.resolve(); await Promise.resolve()
    expect(f.data().contacts?.['avatar:visitor.png']).toBeUndefined()
    requestOpenApp({ appId: 'wechat-sister', contactName: 'Visitor' }); f.remount()
    await vi.waitFor(() => expect(f.data().activeScopeKey).toBe('direct:avatar:visitor.png'))
    expect(conversationScope(f.data(), f.data().conversations!['direct:avatar:visitor.png']).card?.description).toBe('REAL_CARD')
  })
})
