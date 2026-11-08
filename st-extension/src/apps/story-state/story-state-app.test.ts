// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import { createStoryStateApp } from './story-state-app'
import { META_KEY } from './store'

let cleanup = () => {}
afterEach(() => { cleanup(); document.body.replaceChildren(); vi.unstubAllGlobals() })
async function mount(raw: Record<string, unknown>) {
  vi.stubGlobal('SillyTavern', { getContext: () => ({ name1: '玩家', chatMetadata: { [META_KEY]: { stat_data: raw, v: 1 } }, chatId: 'one' }) })
  const ctx = { getSettings: () => ({ apps: {} }), getAppData: () => undefined, setAppData: vi.fn(), getCharacterName: () => '角色',
    getChatContext: () => ({ chatId: 'one' }), onMessageReceived: () => vi.fn(), onCharacterChanged: () => vi.fn(),
  } as unknown as PhoneAppContext
  const app = createStoryStateApp(), dispose = app.setup!(ctx), container = document.createElement('div')
  const input = document.createElement('textarea'); input.id = 'send_textarea'; document.body.append(container, input)
  app.mount(container, ctx); cleanup = () => { app.unmount!(); if (dispose) dispose() }
  await vi.waitFor(() => expect(container.textContent).toContain('本聊天的状态'))
  return { container, input, tabs: Array.from(container.querySelectorAll<HTMLButtonElement>('[role=tab]')) }
}
describe('story-state app', () => {
  it('renders four tabs and inserts item/skill drafts without sending or consuming', async () => {
    const f = await mount({ 时间: { 显示: '傍晚' }, 位置: { 地点: '月港' }, 任务: [{ 标题: '找猫', 状态: '进行中', 奖励: '银币' }],
      背包: [{ 名称: '药水', 数量: 3, 描述: '恢复生命', 稀有度: '稀有' }], 技能: [{ 名称: '火球', 等级: 2, 类型: '法术', 熟练度: 35, 描述: '燃烧' }] })
    expect(f.container.textContent).toContain('傍晚'); expect(f.container.textContent).toContain('月港')
    f.tabs[1].click(); expect(f.container.textContent).toContain('找猫'); expect(f.container.textContent).toContain('🎁 银币')
    f.tabs[2].click(); f.container.querySelector<HTMLButtonElement>('.ss-item button')!.click()
    expect(f.input.value).toBe('玩家使用了"药水"（剩余 ×3）。（道具效果：恢复生命）'); expect(f.container.textContent).toContain('已填入')
    f.tabs[2].dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true })); expect(document.activeElement).toBe(f.tabs[3])
    expect(f.container.querySelector('progress')!.value).toBe(35)
    f.container.querySelector<HTMLButtonElement>('.ss-card button')!.click()
    expect(f.input.value).toBe('玩家发动了能力"火球"（Lv.2），法术。（效果：燃烧）')
    f.input.value = '自己的草稿'; f.container.querySelector<HTMLButtonElement>('.ss-card button')!.click()
    expect(f.input.value).toBe('自己的草稿'); expect(f.container.textContent).toContain('未覆盖')
    f.tabs[2].click(); expect(f.container.textContent).toContain('×3')
  })
  it('shows empty state and connection guidance', async () => {
    const f = await mount({}); expect(f.container.textContent).toContain('后台自动整理'); expect(f.container.textContent).toContain('请先在微信设置里连接 AI')
    f.tabs[1].click(); expect(f.container.textContent).toContain('还没有这类状态')
  })
})
