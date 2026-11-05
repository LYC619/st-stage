// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings } from '../../../../core/types'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import { createWeChatApp } from './wechat-app'
import type { STCharacterCard } from './bridge'
import type { WeChatAppData } from './types'

const apps: ReturnType<typeof createWeChatApp>[] = []
afterEach(() => { for (const app of apps.splice(0)) app.unmount?.(); document.body.replaceChildren(); vi.restoreAllMocks() })

function fixture(initial?: WeChatAppData) {
  let data = initial, card: STCharacterCard | undefined
  const settings = createDefaultSettings(), app = createWeChatApp()
  const ctx: PhoneAppContext = {
    apiVersion: 2, getSettings: () => settings, getCharacterName: () => card?.name || '', getCharacterCard: () => card,
    getAppData: <T>() => data as T | undefined, setAppData: <T>(value: T) => { data = value as WeChatAppData },
    onCharacterChanged: () => () => {}, onMessageReceived: () => () => {},
    injectPrompt: vi.fn(), toast: vi.fn(), updateSettings: vi.fn(), goHome: vi.fn(), openModal: vi.fn(),
    setTimeout: window.setTimeout.bind(window), setInterval: window.setInterval.bind(window),
  }
  apps.push(app); app.setup?.(ctx)
  const container = document.createElement('div'); document.body.append(container)
  return { data: () => data!, select: (next?: STCharacterCard) => { card = next },
    enter: () => { app.mount(container, ctx) }, leave: () => app.unmount?.(), container,
    keys: () => [...container.querySelectorAll<HTMLElement>('[data-conversation]')].map(node => node.dataset.conversation),
  }
}

describe('entering WeChat from a character card', () => {
  it.each([undefined, { config: {} } satisfies WeChatAppData])('adds the current card after startup initialized %j, staying at the list', initial => {
    const f = fixture(initial)
    f.select({ name: 'A', avatar: 'a.png', description: 'A persona' }); f.enter()
    expect(f.keys()).toEqual(['direct:avatar:a.png'])
    expect(f.container.querySelector<HTMLElement>('#wt-chat')!.hidden).toBe(true)
    expect(f.data().contacts?.['avatar:a.png'].card?.description).toBe('A persona')
    f.leave(); f.select({ name: 'B', avatar: 'b.png' }); f.enter()
    expect(f.keys()).toEqual(['direct:avatar:a.png', 'direct:avatar:b.png'])
  })

  it('reuses an existing conversation without replacing history, drafts, state, unread or its saved card', () => {
    const f = fixture(); f.select({ name: 'A', avatar: 'a.png', description: 'Original persona' }); f.enter()
    const conversation = f.data().conversations?.['direct:avatar:a.png']
    expect(conversation).toBeDefined()
    conversation!.messages.push({ sender: 'player', type: 'text', content: 'Existing history', time: { day: 1, hour: 1, minute: 0 } })
    conversation!.draft = 'Unsent'; conversation!.unreadCount = 2; conversation!.state.currentStatus = 'Reading'
    f.leave(); f.select({ name: 'A', avatar: 'a.png' }); f.enter()
    expect(f.keys()).toEqual(['direct:avatar:a.png'])
    expect(f.data().conversations?.['direct:avatar:a.png']).toBe(conversation)
    expect(conversation).toMatchObject({ draft: 'Unsent', unreadCount: 2, state: { currentStatus: 'Reading' }, messages: [{ content: 'Existing history' }] })
    expect(f.data().contacts?.['avatar:a.png'].card?.description).toBe('Original persona')
  })

  it('does not invent a contact without a selected card and separates cards with the same name', () => {
    const f = fixture(); f.enter(); expect(f.keys()).toEqual([]); f.leave()
    f.select({ name: 'Same', avatar: 'one.png' }); f.enter(); f.leave()
    f.select({ name: 'Same', avatar: 'two.png' }); f.enter()
    expect(f.keys()).toEqual(['direct:avatar:one.png', 'direct:avatar:two.png'])
  })
})
