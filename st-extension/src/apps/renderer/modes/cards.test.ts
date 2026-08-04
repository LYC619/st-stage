// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRendererSettings } from '../config'
import type { CardsRenderBlock } from '../types'
import { mountCardsMode } from './cards'

function block(): CardsRenderBlock {
  return {
    version: 1,
    mode: 'cards',
    title: '下一步行动',
    cards: [
      { id: 'advance', title: '继续前进', description: '沿山路调查灯光', consequence: '可能遭遇守卫', action: '我选择沿山路继续前进。' },
      { id: 'rest', title: '原地休整', description: '恢复体力并整理物资', action: '我选择原地休整。' },
    ],
  }
}

function selectButtons(root: HTMLElement): HTMLButtonElement[] {
  return Array.from(root.querySelectorAll<HTMLButtonElement>('.st-render-card-select'))
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('mountCardsMode', () => {
  it('以文本节点渲染 2-8 张卡片及图标加文字选择命令', () => {
    const root = document.createElement('div')
    document.body.append(root)
    mountCardsMode(root, block(), { getSettings: () => defaultRendererSettings() })

    expect(root.querySelector('.st-render-cards-title')?.textContent).toBe('下一步行动')
    expect(root.querySelectorAll('.st-render-card')).toHaveLength(2)
    expect(root.textContent).toContain('沿山路调查灯光')
    expect(root.textContent).toContain('可能遭遇守卫')
    expect(selectButtons(root).every((button) => button.textContent?.includes('选择'))).toBe(true)
    expect(root.querySelector('script, style')).toBeNull()
  })

  it('选择成功后只标记一张卡并把 action 交给 composer', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const insertDraft = vi.fn(() => ({ ok: true as const }))
    mountCardsMode(root, block(), { getSettings: () => defaultRendererSettings(), insertDraft })

    selectButtons(root)[0].click()
    expect(insertDraft).toHaveBeenLastCalledWith('我选择沿山路继续前进。')
    expect(root.querySelectorAll('.st-render-card-selected')).toHaveLength(1)
    expect(root.querySelector('.st-render-cards-status')?.textContent).toMatch(/已填入.*继续前进/)

    selectButtons(root)[1].click()
    expect(insertDraft).toHaveBeenLastCalledWith('我选择原地休整。')
    expect(root.querySelectorAll('.st-render-card-selected')).toHaveLength(1)
    expect(root.querySelectorAll('.st-render-card')[1].classList).toContain('st-render-card-selected')
  })

  it('composer 不可用或用户已修改草稿时保持卡片未选中并播报错误', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const insertDraft = vi.fn(() => ({ ok: false as const, error: '输入草稿已修改' }))
    mountCardsMode(root, block(), { getSettings: () => defaultRendererSettings(), insertDraft })

    selectButtons(root)[0].click()

    expect(root.querySelector('.st-render-card-selected')).toBeNull()
    expect(root.querySelector('.st-render-cards-status')?.textContent).toBe('输入草稿已修改')
  })

  it('已有成功选择后写入失败会清除过期选中态', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const insertDraft = vi.fn()
      .mockReturnValueOnce({ ok: true as const })
      .mockReturnValueOnce({ ok: false as const, error: '输入草稿已修改' })
    mountCardsMode(root, block(), { getSettings: () => defaultRendererSettings(), insertDraft })

    selectButtons(root)[0].click()
    expect(root.querySelector('.st-render-card-selected')).not.toBeNull()
    selectButtons(root)[1].click()

    expect(root.querySelector('.st-render-card-selected')).toBeNull()
    expect(selectButtons(root).every((button) => button.getAttribute('aria-pressed') === 'false')).toBe(true)
  })

  it('destroy 后移除卡片点击监听', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const insertDraft = vi.fn(() => ({ ok: true as const }))
    const remove = vi.spyOn(root, 'removeEventListener')
    const mount = mountCardsMode(root, block(), { getSettings: () => defaultRendererSettings(), insertDraft })
    mount.destroy()
    selectButtons(root)[0].click()

    expect(remove).toHaveBeenCalledWith('click', expect.any(Function))
    expect(insertDraft).not.toHaveBeenCalled()
  })
})
