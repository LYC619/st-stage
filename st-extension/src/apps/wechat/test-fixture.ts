import { vi } from 'vitest'
import { createDefaultSettings } from '../../../../core/types'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import type { WeChatAppData } from './types'
import { createWeChatApp } from './wechat-app'
import { addContactConversation } from './conversations'

export function mountWeChat(initial?: WeChatAppData) {
  let data = initial ?? { config: { profile: { preset: 'general' as const } } }
  let changed = () => {}, hostName = 'A'
  const settings = createDefaultSettings()
  const a = addContactConversation(data, { id: 'avatar:a.png', name: 'A', card: { name: 'A', avatar: 'a.png', description: 'PRIVATE_PERSONA_A' } })
  const b = addContactConversation(data, { id: 'avatar:b.png', name: 'B', card: { name: 'B', avatar: 'b.png', description: 'PRIVATE_PERSONA_B' } })
  const getVariables = vi.fn(() => ({ mood: 99, money: 90000 }))
  const toast = vi.fn()
  const ctx: PhoneAppContext = {
    apiVersion: 2, getSettings: () => settings, getCharacterName: () => hostName,
    getCharacterCard: () => ({ name: hostName, avatar: `${hostName.toLowerCase()}.png` }),
    getChatContext: () => ({ characterId: '0', chatId: 'main-chat', chat: [{ is_user: true, mes: 'PRIVATE_MAIN_CHAT_A' }] }),
    getVariables, getAppData: <T>() => data as T, setAppData: <T>(value: T) => { data = value as WeChatAppData },
    onCharacterChanged: callback => { changed = callback; return () => {} }, onMessageReceived: () => () => {},
    injectPrompt: vi.fn(), toast, updateSettings: vi.fn(), goHome: vi.fn(), openModal: vi.fn(),
    setTimeout: window.setTimeout.bind(window), setInterval: window.setInterval.bind(window),
  }
  const app = createWeChatApp(), container = document.createElement('div'); document.body.append(container)
  app.setup?.(ctx); app.mount(container, ctx)
  const el = <T extends HTMLElement = HTMLElement>(selector: string) => container.querySelector<T>(selector)!
  const open = (key: string) => {
    if (el('input#wt-input-text').closest<HTMLElement>('#wt-chat')?.hidden === false) el('#wt-back').click()
    const button = [...container.querySelectorAll<HTMLButtonElement>('[data-conversation]')].find(btn => btn.dataset.conversation === key)!
    button.click()
  }
  return { app, ctx, settings, el, container, a, b, open, getVariables, toast, data: () => data,
    hostChange: (name: string) => { hostName = name; changed() },
    remount: () => { app.unmount?.(); data = JSON.parse(JSON.stringify(data)); app.mount(container, ctx) },
  }
}
