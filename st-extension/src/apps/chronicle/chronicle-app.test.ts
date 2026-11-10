// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import { createChronicleApp } from './chronicle-app'
import * as dates from '../shared/story-date'

let cleanup = () => {}
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.unstubAllGlobals(); document.body.replaceChildren() })
function mount(connected: boolean) {
  const entries = [1, 2].map(n => ({ code: `AM000${n}`, summary: `概览${n}`, text: `正文${n}<img src=x>`, timeSpan: '2026-01-01', keyDialogue: [`甲：原话${n}`], createdAt: n }))
  const metadata = { st_stage_chronicle: { v: 1, entries, lastMessageIndex: -1 } }
  let settings = {}
  vi.spyOn(dates, 'storyToday').mockResolvedValue(new Date(2026, 0, 2))
  vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId: 'one', chat: [], chatMetadata: metadata, saveMetadata: async () => {} }) })
  const ctx = { getSettings: () => ({ apps: { 'wechat-sister': { config: { apiKey: connected ? 'test' : '' } } } }),
    getAppData: () => settings, setAppData: (value: object) => { settings = value }, getCharacterName: () => '角色', injectPrompt: vi.fn(),
    onMessageReceived: () => vi.fn(), onCharacterChanged: () => vi.fn(),
  } as unknown as PhoneAppContext
  const app = createChronicleApp(), dispose = app.setup!(ctx), container = document.createElement('div')
  document.body.append(container); app.mount(container, ctx)
  cleanup = () => { app.unmount!(); if (dispose) dispose() }
  return { container, ctx, metadata }
}

describe('chronicle app', () => {
  it('shows newest first, expandable safe text, relations, settings and confirmed latest-only deletion', async () => {
    const f = mount(true)
    await vi.waitFor(() => expect(f.container.textContent).toContain('昨天'))
    const cards = f.container.querySelectorAll('details.ch-card')
    expect(cards[0].textContent).toContain('AM0002'); expect(cards[0].querySelector('summary')!.textContent).toContain('概览2')
    expect(cards[0].textContent).toContain('甲：原话2'); expect(f.container.querySelector('img')).toBeNull()
    const checkboxes = f.container.querySelectorAll<HTMLInputElement>('input[type=checkbox]')
    expect(checkboxes[0].checked).toBe(true); expect(checkboxes[1].checked).toBe(true)
    checkboxes[1].click(); expect(f.ctx.injectPrompt).toHaveBeenLastCalledWith('', 999)
    const interval = f.container.querySelector<HTMLInputElement>('input[type=number]')!
    expect(interval.value).toBe('4'); interval.value = '25'; interval.dispatchEvent(new Event('change'))
    expect(f.ctx.getAppData()).toMatchObject({ interval: 20, inject: false })
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
    const remove = Array.from(f.container.querySelectorAll('button')).find(button => button.textContent === '删除最后一条纪要')!
    remove.click(); expect(f.metadata.st_stage_chronicle.entries).toHaveLength(2)
    confirm.mockReturnValue(true); remove.click()
    await vi.waitFor(() => expect(f.container.querySelectorAll('details.ch-card')).toHaveLength(1))
    expect(f.metadata.st_stage_chronicle.entries[0].code).toBe('AM0001')
  })
  it('shows connection guidance and disables organize without AI', () => {
    const f = mount(false)
    expect(f.container.textContent).toContain('请先在微信设置里连接 AI')
    expect(f.container.querySelector<HTMLButtonElement>('.ch-header button')!.disabled).toBe(true)
  })
})
