// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { defaultRendererSettings, type RendererSettings } from '../config'
import type { GalRenderBlock } from '../types'
import { mountGalMode } from './gal'

function block(): GalRenderBlock {
  return {
    version: 1,
    mode: 'gal',
    title: '雨夜重逢',
    scene: '车站月台',
    background: '/user/backgrounds/station.webp',
    beats: [
      { speaker: '小雪', text: '你终于来了。', portrait: '/user/images/xiaoxue.png' },
      { speaker: '我', text: '抱歉，让你久等了。', background: 'assets/rain.webp' },
      { speaker: '小雪', text: '走吧。' },
    ],
  }
}

function settings(overrides: Partial<RendererSettings> = {}): RendererSettings {
  return { ...defaultRendererSettings(), enabled: true, typewriter: false, ...overrides }
}

function button(root: HTMLElement, label: string): HTMLButtonElement {
  const value = root.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`)
  if (!value) throw new Error(`找不到按钮: ${label}`)
  return value
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
})

describe('mountGalMode', () => {
  it('用文本节点和图片元素渲染标题、场景、背景、立绘与对白', () => {
    const root = document.createElement('div')
    document.body.append(root)
    mountGalMode(root, block(), { getSettings: () => settings() })

    expect(root.querySelector('.st-render-gal-title')?.textContent).toBe('雨夜重逢')
    expect(root.querySelector('.st-render-gal-scene')?.textContent).toBe('车站月台')
    expect(root.querySelector('.st-render-gal-speaker')?.textContent).toBe('小雪')
    expect(root.querySelector('.st-render-gal-dialogue')?.textContent).toBe('你终于来了。')
    expect(root.querySelector<HTMLImageElement>('.st-render-gal-background')?.src).toContain('/user/backgrounds/station.webp')
    expect(root.querySelector<HTMLImageElement>('.st-render-gal-portrait')?.src).toContain('/user/images/xiaoxue.png')
  })

  it('支持前后、跳过和键盘导航，并维护首尾禁用状态', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const mount = mountGalMode(root, block(), { getSettings: () => settings() })

    expect(button(root, '上一句').disabled).toBe(true)
    button(root, '下一句').click()
    expect(root.querySelector('.st-render-gal-speaker')?.textContent).toBe('我')
    expect(button(root, '上一句').disabled).toBe(false)
    expect(root.querySelector<HTMLImageElement>('.st-render-gal-background')?.src).toContain('/assets/rain.webp')

    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))
    expect(root.querySelector('.st-render-gal-speaker')?.textContent).toBe('小雪')
    button(root, '跳过').click()
    expect(root.querySelector('.st-render-gal-dialogue')?.textContent).toBe('走吧。')
    expect(button(root, '下一句').disabled).toBe(true)
    mount.destroy()
  })

  it('打字机可被导航取消，减少动态时立即显示全文', () => {
    vi.useFakeTimers()
    const animated = document.createElement('div')
    document.body.append(animated)
    const mount = mountGalMode(animated, block(), { getSettings: () => settings({ typewriter: true }) })
    const dialogue = animated.querySelector('.st-render-gal-dialogue')

    expect(dialogue?.textContent).toBe('')
    vi.advanceTimersByTime(48)
    expect(dialogue?.textContent?.length).toBeGreaterThan(0)
    button(animated, '下一句').click()
    expect(dialogue?.textContent).toBe('你终于来了。')
    button(animated, '下一句').click()
    expect(animated.querySelector('.st-render-gal-speaker')?.textContent).toBe('我')
    mount.destroy()
    const stopped = dialogue?.textContent
    vi.runAllTimers()
    expect(dialogue?.textContent).toBe(stopped)

    const reduced = document.createElement('div')
    document.body.append(reduced)
    mountGalMode(reduced, block(), { getSettings: () => settings({ typewriter: true, reducedMotion: true }) })
    expect(reduced.querySelector('.st-render-gal-dialogue')?.textContent).toBe('你终于来了。')
  })

  it('打字机按 Unicode 字符推进，最后一句仍可用跳过立即补全', () => {
    vi.useFakeTimers()
    const root = document.createElement('div')
    document.body.append(root)
    const data = block()
    data.beats = [{ speaker: '小雪', text: '🙂你好' }]
    mountGalMode(root, data, { getSettings: () => settings({ typewriter: true }) })

    vi.advanceTimersByTime(24)
    expect(root.querySelector('.st-render-gal-dialogue')?.textContent).toBe('🙂')
    expect(button(root, '跳过').disabled).toBe(false)
    button(root, '跳过').click()
    expect(root.querySelector('.st-render-gal-dialogue')?.textContent).toBe('🙂你好')
  })

  it('通过图库 resolver 解析 sprite 地址，未解析地址不生成破图', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const resolvePortrait = vi.fn((address: string) => address.includes('微笑') ? '/user/resolved/smile.webp' : null)
    const data = block()
    data.beats = [
      { speaker: '小雪', text: '你好', portrait: 'sprite:小雪/礼服/微笑' },
      { speaker: '小雪', text: '沉默', portrait: 'sprite:小雪/礼服/不存在' },
    ]
    mountGalMode(root, data, { getSettings: () => settings(), resolvePortrait })

    expect(resolvePortrait).toHaveBeenCalledWith('小雪/礼服/微笑')
    expect(root.querySelector<HTMLImageElement>('.st-render-gal-portrait')?.src).toContain('/user/resolved/smile.webp')
    button(root, '下一句').click()
    expect(root.querySelector('.st-render-gal-portrait')).toBeNull()
  })

  it('缺少显式 portrait 时按 beat speaker 解析图库封面', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const resolveSpeakerPortrait = vi.fn(() => '/user/resolved/xiaoxue-cover.webp')
    const data = block()
    data.beats = [{ speaker: '小雪', text: '你好' }]

    mountGalMode(root, data, { getSettings: () => settings(), resolveSpeakerPortrait })

    expect(resolveSpeakerPortrait).toHaveBeenCalledWith('小雪')
    expect(root.querySelector<HTMLImageElement>('.st-render-gal-portrait')?.src).toContain(
      '/user/resolved/xiaoxue-cover.webp',
    )
  })

  it('destroy 会移除键盘监听并停止后续状态变化', () => {
    const root = document.createElement('div')
    document.body.append(root)
    const remove = vi.spyOn(root, 'removeEventListener')
    const mount = mountGalMode(root, block(), { getSettings: () => settings() })
    mount.destroy()
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))

    expect(remove).toHaveBeenCalledWith('keydown', expect.any(Function))
    expect(root.querySelector('.st-render-gal-speaker')?.textContent).toBe('小雪')
  })
})
