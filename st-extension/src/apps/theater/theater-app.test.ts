// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import { createTheaterApp } from './theater-app'
import type { TheaterData } from './types'

let cleanup = () => {}
afterEach(() => { cleanup(); document.body.replaceChildren() })

function mount(connected: boolean, filled: boolean) {
  let stored: TheaterData = {
    autoGenerate: true,
    stories: filled ? {
      '角色::one': {
        square: [{ author: '<b>配角</b>', tag: '船长', time: '刚刚', text: '广场正文', topics: ['月港'], comments: [], stats: '赞 12' }],
        forum: [{ board: '闲聊', title: '论坛标题', text: '公开消息', tags: ['新闻'], user: '匿名', heat: '86', comments: [] }],
        live: { room: '直播间', title: '直播标题', cast: '阿青', summary: '抵达港口', stats: '100', danmaku: [{ fan: '青团', text: '来了' }] },
        diary: [{ date: '2026-01-01', role: '阿青', content: '我今天~~紧张~~很冷静。\nPS: 想见她。' }],
        updatedAt: 1,
        fingerprint: '',
      },
    } : {},
  }
  const ctx = {
    getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: connected ? 'test' : '' } } } }),
    getAppData: () => stored,
    setAppData: vi.fn((next: TheaterData) => { stored = next }),
    getCharacterName: () => '角色',
    getChatContext: () => ({ chatId: 'one' }),
    onMessageReceived: () => vi.fn(),
    onCharacterChanged: () => vi.fn(),
  } as unknown as PhoneAppContext
  const app = createTheaterApp(), dispose = app.setup!(ctx); app.mount(document.body, ctx)
  cleanup = () => { app.unmount!(); if (dispose) dispose() }
  return { tabs: Array.from(document.querySelectorAll<HTMLButtonElement>('[role=tab]')), stored: () => stored }
}

describe('theater app', () => {
  it('renders all channels, literal text, interactive actions and keyboard tabs', () => {
    const { tabs, stored } = mount(true, true)
    expect(document.body.textContent).toContain('广场正文')
    expect(document.querySelector('b')).toBeNull()

    // Like button persists state
    Array.from(document.querySelectorAll('button')).find(b => b.textContent?.includes('点赞'))!.click()
    expect(stored().stories['角色::one'].square[0].liked).toBe(true)

    tabs[1].click()
    expect(document.body.textContent).toContain('论坛标题')
    tabs[1].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
    expect(document.body.textContent).toContain('我今天')
    expect(document.activeElement).toBe(tabs[3])
    expect(document.querySelector('del')!.textContent).toBe('紧张')
    tabs[3].dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
    expect(document.activeElement).toBe(tabs[0])

    tabs[2].click()
    expect(document.body.textContent).toContain('直播标题')
    const pause = document.querySelector<HTMLInputElement>('.th-live input[type="checkbox"]')!
    pause.click()
    expect((document.querySelector('.th-danmaku-track') as HTMLElement).style.animationPlayState).toBe('paused')

    // Send live danmaku
    const dmInput = document.querySelector<HTMLInputElement>('.th-danmaku-send input')!
    dmInput.value = '前排打卡！'
    document.querySelector<HTMLButtonElement>('.th-danmaku-send button')!.click()
    expect(document.body.textContent).toContain('前排打卡！')
  })

  it('shows empty content and connection guidance', () => {
    mount(false, false)
    expect(document.body.textContent).toContain('这里还没有内容')
    expect(document.body.textContent).toContain('请先在微信设置里连接 AI')
    expect(document.querySelector<HTMLButtonElement>('.th-primary-btn')!.disabled).toBe(true)
  })
})
