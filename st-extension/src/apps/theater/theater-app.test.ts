// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import { createTheaterApp } from './theater-app'
import type { TheaterData } from './types'

let cleanup = () => {}
afterEach(() => { cleanup(); document.body.replaceChildren() })
function mount(connected: boolean, filled: boolean) {
  const data: TheaterData = { autoGenerate: true, stories: filled ? { '角色::one': { square: [{ author: '<b>配角</b>', tag: '船长', time: '刚刚', text: '广场正文', topics: ['月港'], comments: [], stats: '赞 12' }],
    forum: [{ board: '闲聊', title: '论坛标题', text: '公开消息', tags: ['新闻'], user: '匿名', heat: '86', comments: [] }],
    live: { room: '直播间', title: '直播标题', cast: '阿青', summary: '抵达港口', stats: '100', danmaku: [{ fan: '青团', text: '来了' }] },
    diary: [{ date: '2026-01-01', role: '阿青', content: '我今天~~紧张~~很冷静。\nPS: 想见她。' }], updatedAt: 1, fingerprint: '' } } : {} }
  const ctx = { getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: connected ? 'test' : '' } } } }), getAppData: () => data,
    setAppData: vi.fn(), getCharacterName: () => '角色', getChatContext: () => ({ chatId: 'one' }),
    onMessageReceived: () => vi.fn(), onCharacterChanged: () => vi.fn(),
  } as unknown as PhoneAppContext
  const app = createTheaterApp(), dispose = app.setup!(ctx); app.mount(document.body, ctx)
  cleanup = () => { app.unmount!(); if (dispose) dispose() }
  return Array.from(document.querySelectorAll<HTMLButtonElement>('[role=tab]'))
}
describe('theater app', () => {
  it('renders all channels, literal text and keyboard tabs', () => {
    const tabs = mount(true, true)
    expect(document.body.textContent).toContain('广场正文'); expect(document.querySelector('b')).toBeNull()
    tabs[1].click(); expect(document.body.textContent).toContain('论坛标题')
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.body.textContent).toContain('我今天'); expect(document.activeElement).toBe(tabs[3])
    expect(document.querySelector('del')!.textContent).toBe('紧张')
    tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(tabs[0]); tabs[2].click()
    expect(document.body.textContent).toContain('直播标题')
    const pause = document.querySelector<HTMLInputElement>('.th-live input')!; pause.click()
    expect((document.querySelector('.th-danmaku-track') as HTMLElement).style.animationPlayState).toBe('paused')
  })
  it('shows empty content and connection guidance', () => {
    mount(false, false)
    expect(document.body.textContent).toContain('这里还没有内容'); expect(document.body.textContent).toContain('请先在微信设置里连接 AI')
    expect(document.querySelector<HTMLButtonElement>('.th-header button')!.disabled).toBe(true)
  })
})
