// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import { createStoryStateApp } from './story-state-app'
import { META_KEY } from './store'

let cleanup = () => {}
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
async function fixture() {
  let chatId = 'A'
  const listeners = new Set<() => void>()
  const chats: Record<string, Record<string, unknown>> = { A: { [META_KEY]: { v: 1, stat_data: { 背包: [{ id: 'potion', 名称: 'Potion', 数量: 1 }, { id: 'ticket', 名称: 'Ticket', 数量: 1 }], 任务: [{ id: 'quest', 标题: 'Find cat', 状态: '进行中' }] } } }, B: {} }
  const save = vi.fn(async () => {})
  vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId, chatMetadata: chats[chatId], saveMetadata: save }) })
  const ctx = { getSettings: () => ({ apps: {} }), getAppData: () => undefined, getCharacterName: () => 'Role',
    getChatContext: () => ({ chatId }), injectPrompt: vi.fn(), onMessageReceived: () => vi.fn(),
    onCharacterChanged: (fn: () => void) => { listeners.add(fn); return () => listeners.delete(fn) },
  } as unknown as PhoneAppContext
  const app = createStoryStateApp(), dispose = app.setup!(ctx), container = document.createElement('div')
  document.body.append(container); app.mount(container, ctx)
  cleanup = () => { app.unmount!(); dispose?.() }
  await vi.waitFor(() => expect(container.textContent).toContain('随身旅途手账'))
  container.querySelectorAll<HTMLButtonElement>('[role=tab]')[2].click()
  const click = () => container.querySelector<HTMLButtonElement>('button[title="增加 1 个"]')!.click()
  const quantity = () => (chats.A[META_KEY] as { stat_data: { 背包: { 数量: number }[] } }).stat_data.背包[0].数量
  return { container, save, click, quantity, chats, leave: () => app.unmount!(), change: () => { chatId = 'B'; listeners.forEach(fn => fn()) } }
}

describe('local state editing', () => {
  it('queues the submitted form values even if the user edits the form while waiting', async () => {
    const f = await fixture()
    let finish!: () => void
    f.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    f.click()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    const inputs = f.container.querySelectorAll<HTMLInputElement>('.ss-quick-edit input')
    inputs[0].value = 'Key'; inputs[2].value = 'Rare'; inputs[3].value = 'Old tower'
    Array.from(f.container.querySelectorAll('button')).find(button => button.textContent === '放入行囊')!.click()
    inputs[2].value = 'Unsubmitted rarity'; inputs[3].value = 'Unsubmitted description'
    finish()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(2))
    expect(f.chats.A[META_KEY]).toMatchObject({ stat_data: { 背包: [
      { 数量: 2 }, { 名称: 'Ticket', 数量: 1 }, { 名称: 'Key', 稀有度: 'Rare', 描述: 'Old tower' },
    ] } })
  })

  it('keeps the second item targeted after removing the first item in a queued edit', async () => {
    const f = await fixture()
    let finish!: () => void
    f.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    f.container.querySelector<HTMLButtonElement>('button[title="减少 1 个"]')!.click()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    f.container.querySelectorAll<HTMLButtonElement>('button[title="增加 1 个"]')[1].click()
    finish()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(2))
    expect(f.chats.A[META_KEY]).toMatchObject({ stat_data: { 背包: [{ id: 'ticket', 数量: 2 }] } })
  })

  it('continues an already queued edit after the earlier save rejects', async () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = await fixture()
    let fail!: (error: Error) => void
    f.save.mockImplementationOnce(() => new Promise((_resolve, reject) => { fail = reject }))
    f.click(); f.click()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    fail(new Error('Disk unavailable'))
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(2))
    expect(warning).toHaveBeenCalled()
    expect(f.quantity()).toBe(2)
  })

  it('preserves changes across different fields while an earlier save is pending', async () => {
    const f = await fixture()
    let finish!: () => void
    f.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    f.click()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    f.container.querySelectorAll<HTMLButtonElement>('[role=tab]')[1].click()
    Array.from(f.container.querySelectorAll('button')).find(button => button.textContent === '标为完成')!.click()
    finish()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledTimes(2))
    expect(f.quantity()).toBe(2)
    expect(f.chats.A[META_KEY]).toMatchObject({ stat_data: { 任务: [{ 状态: '完成' }] } })
  })

  it('serializes repeated clicks and re-reads persisted state for each edit', async () => {
    const f = await fixture()
    let finish!: () => void
    f.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    f.click(); f.click()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    finish()
    await vi.waitFor(() => expect(f.quantity()).toBe(3))
    expect(f.save).toHaveBeenCalledTimes(2)
  })
  it.each(['change', 'leave'] as const)('drops queued edits after %s', async action => {
    const f = await fixture()
    let finish!: () => void
    f.save.mockImplementationOnce(() => new Promise(resolve => { finish = resolve }))
    f.click()
    await vi.waitFor(() => expect(f.save).toHaveBeenCalledOnce())
    f.click(); f[action](); finish()
    await new Promise(resolve => setTimeout(resolve, 20))
    expect(f.save).toHaveBeenCalledOnce()
    expect(f.chats.B[META_KEY]).toBeUndefined()
  })
  it('reports a failed save and permits the next edit without keeping a failed mutation', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {})
    const f = await fixture()
    f.save.mockRejectedValueOnce(new Error('Disk unavailable'))
    f.click()
    await vi.waitFor(() => expect(f.container.textContent).toContain('Disk unavailable'))
    expect(f.quantity()).toBe(1)
    f.click()
    await vi.waitFor(() => expect(f.quantity()).toBe(2))
    expect(f.save).toHaveBeenCalledTimes(2)
  })
})
