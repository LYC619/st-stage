// @vitest-environment jsdom
/**
 * 可逆楼层渲染测试（五期）：
 * - 楼层内立绘替换后可完整恢复原始 DOM（快照机制，不依赖 ST 重渲染）
 * - 流式增长：ST 重写 innerHTML 后按新内容重新解析（指纹含内容 hash）
 * - 总开关/功能关闭时立即恢复原文
 * - 批量补渲染只处理最近 recentFloors 个候选 AI 楼层；最新楼层不受窗口限制
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  mountMessagePostprocess,
  processMessages,
  reprocessAllMessages,
  restoreAllMessages,
} from './message-postprocess'
import type { PluginSettings } from '../../core/types'
import { createDefaultSettings } from '../../core/types'
import { NEWVAR_APP_ID } from './apps/newvar/config'

interface MsgDef {
  text?: string
  isUser?: boolean
  name?: string
  html?: string
}

function buildChat(messages: MsgDef[]): void {
  document.body.innerHTML = ''
  const chat = document.createElement('div')
  chat.id = 'chat'
  messages.forEach((m, i) => {
    const mes = document.createElement('div')
    mes.className = 'mes'
    mes.setAttribute('mesid', String(i))
    mes.setAttribute('is_user', m.isUser ? 'true' : 'false')
    mes.setAttribute('ch_name', m.name ?? (m.isUser ? '用户' : '小雪'))
    const text = document.createElement('div')
    text.className = 'mes_text'
    if (m.html) text.innerHTML = m.html
    else text.textContent = m.text ?? ''
    mes.append(text)
    chat.append(mes)
  })
  document.body.append(chat)
}

function mesText(index: number): HTMLElement {
  return document.querySelector(`#chat .mes[mesid="${index}"] .mes_text`) as HTMLElement
}

function baseSettings(over: Partial<PluginSettings> = {}): PluginSettings {
  const s = createDefaultSettings()
  s.packs = [
    {
      id: 'p1',
      name: '测试包',
      sprites: [
        { tag: '微笑', url: 'https://img.example/smile.png' },
        { tag: '哭泣', url: 'https://img.example/cry.png' },
      ],
    },
  ]
  s.bindings = [{ characterName: '小雪', packIds: ['p1'], enabled: true }]
  return { ...s, ...over }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.useRealTimers()
  delete window.SillyTavern
})

describe('mountMessagePostprocess lifecycle', () => {
  it('重新处理 ST 编辑完成后发出的 MESSAGE_UPDATED 楼层', async () => {
    const handlers = new Map<string, (...args: unknown[]) => void>()
    const processMessage = vi.fn()
    const removeListener = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: {
          CHARACTER_MESSAGE_RENDERED: 'rendered',
          MESSAGE_UPDATED: 'updated',
        },
        eventSource: {
          on: (event: string, handler: (...args: unknown[]) => void) => handlers.set(event, handler),
          removeListener,
        },
      }),
    } as never
    buildChat([{ text: '编辑前' }])
    const cleanup = mountMessagePostprocess({
      getSettings: () => baseSettings(),
      processMessage,
    })

    mesText(0).textContent = '编辑后 [立绘:微笑]'
    handlers.get('updated')?.(0)
    await Promise.resolve()

    expect(handlers.get('updated')).toBeTypeOf('function')
    expect(processMessage).toHaveBeenCalledWith(mesText(0))
    cleanup()
    expect(removeListener).toHaveBeenCalledWith('updated', expect.any(Function))
  })

  it('把渲染后的消息交给通用 hook，并在销毁时清理 hook 资源', async () => {
    let handler: ((...args: unknown[]) => void) | undefined
    const processMessage = vi.fn()
    const cleanupMessages = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { CHARACTER_MESSAGE_RENDERED: 'rendered' },
        eventSource: {
          on: (_event: string, next: (...args: unknown[]) => void) => { handler = next },
          removeListener: vi.fn(),
        },
      }),
    } as never
    buildChat([{ text: 'AI 回复' }])
    const cleanup = mountMessagePostprocess({
      getSettings: () => baseSettings(),
      processMessage,
      cleanupMessages,
    })

    handler?.(0)
    await Promise.resolve()

    expect(processMessage).toHaveBeenCalledWith(mesText(0))
    cleanup()
    cleanup()
    expect(cleanupMessages).toHaveBeenCalledTimes(1)
  })

  it('decorates the rendered message and cleans image actions on disposal', async () => {
    let handler: ((...args: unknown[]) => void) | undefined
    const decorateImages = vi.fn()
    const cleanupImages = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { CHARACTER_MESSAGE_RENDERED: 'rendered' },
        eventSource: {
          on: (_event: string, next: (...args: unknown[]) => void) => { handler = next },
          removeListener: vi.fn(),
        },
      }),
    } as never
    buildChat([{ html: '<img src="https://img.test/generated.png">' }])
    const cleanup = mountMessagePostprocess({
      getSettings: () => baseSettings(),
      decorateImages,
      cleanupImages,
    })

    handler?.(0)
    await Promise.resolve()

    expect(decorateImages).toHaveBeenCalledWith(document.querySelector('.mes[mesid="0"]'))
    cleanup()
    expect(cleanupImages).toHaveBeenCalledTimes(1)
  })

  it('redecorates message images after a full settings reprocess', async () => {
    let handler: ((...args: unknown[]) => void) | undefined
    const decorateImages = vi.fn()
    const cleanupImages = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { CHARACTER_MESSAGE_RENDERED: 'rendered' },
        eventSource: {
          on: (_event: string, next: (...args: unknown[]) => void) => { handler = next },
          removeListener: vi.fn(),
        },
      }),
    } as never
    buildChat([{ text: '[立绘:微笑]' }])
    const settings = baseSettings({ hideTagInMessage: true })
    const dispose = mountMessagePostprocess({ getSettings: () => settings, decorateImages, cleanupImages })
    handler?.(0)
    await Promise.resolve()
    decorateImages.mockClear()

    reprocessAllMessages(settings)

    expect(cleanupImages).toHaveBeenCalledTimes(1)
    expect(decorateImages).toHaveBeenCalledWith(document)
    dispose()
  })

  it('ignores a rendered-event microtask queued before cleanup', async () => {
    let handler: ((...args: unknown[]) => void) | undefined
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { CHARACTER_MESSAGE_RENDERED: 'rendered' },
        eventSource: {
          on: (_event: string, next: (...args: unknown[]) => void) => { handler = next },
          removeListener: vi.fn(),
        },
      }),
    } as never
    buildChat([{ text: '[立绘:微笑]' }])
    const cleanup = mountMessagePostprocess({ getSettings: () => baseSettings({ hideTagInMessage: true }) })

    handler?.(0)
    cleanup()
    await Promise.resolve()

    expect(mesText(0).textContent).toContain('[立绘:微笑]')
  })

  it('clears fallback timers queued before cleanup', () => {
    vi.useFakeTimers()
    let handler: ((...args: unknown[]) => void) | undefined
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: {},
        eventSource: {
          on: (_event: string, next: (...args: unknown[]) => void) => { handler = next },
          removeListener: vi.fn(),
        },
      }),
    } as never
    buildChat([{ text: '[立绘:微笑]' }])
    const cleanup = mountMessagePostprocess({ getSettings: () => baseSettings({ hideTagInMessage: true }) })

    handler?.(0)
    cleanup()
    vi.runAllTimers()

    expect(mesText(0).textContent).toContain('[立绘:微笑]')
  })
})

describe('可逆楼层渲染', () => {
  it('楼层内立绘替换后 restoreAllMessages 恢复原始 DOM', () => {
    buildChat([{ html: '<p>你好呀 [立绘:微笑]</p><p>第二段</p>' }])
    const el = mesText(0)
    const originalHtml = el.innerHTML

    processMessages(baseSettings({ spriteDisplayMode: 'inline', hideTagInMessage: true }), 0)
    expect(el.querySelectorAll('img').length).toBe(1)
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('微笑')
    expect(el.textContent).not.toContain('[立绘:微笑]')

    restoreAllMessages()
    expect(el.innerHTML).toBe(originalHtml)
    expect(el.hasAttribute('data-so-fp')).toBe(false)
  })

  it('立绘不透明度只作用于悬浮窗，楼层立绘保持完全不透明', () => {
    buildChat([{ text: '[立绘:微笑]' }])

    processMessages(baseSettings({ spriteDisplayMode: 'inline', spriteOpacity: 35 }), 0)

    expect(mesText(0).querySelector<HTMLImageElement>('.so-inline-sprite img')?.style.opacity).toBe('')
  })

  it('只从可见 DOM 隐藏完整变量记录，并可按设置恢复原始结构', () => {
    const raw = '剧情正文\n<UpdateVariable><Analysis>检查</Analysis>\n[{"op":"replace","path":"/好感","value":1}]\n</UpdateVariable>\n结尾'
    buildChat([{ html: `<p>剧情正文</p><div>&lt;UpdateVariable&gt;<b>&lt;Analysis&gt;检查&lt;/Analysis&gt;</b><br>[{"op":"replace","path":"/好感","value":1}]<br>&lt;/UpdateVariable&gt;</div><p>结尾</p>` }])
    const settings = baseSettings({ enabled: false })
    settings.apps[NEWVAR_APP_ID] = { enabled: true, hideUpdateBlocks: true }

    processMessages(settings, 0)

    expect(mesText(0).textContent).toContain('剧情正文')
    expect(mesText(0).textContent).toContain('结尾')
    expect(mesText(0).textContent).not.toContain('UpdateVariable')
    expect(raw).toContain('<UpdateVariable>')

    settings.apps[NEWVAR_APP_ID] = { enabled: true, hideUpdateBlocks: false }
    reprocessAllMessages(settings)
    expect(mesText(0).textContent).toContain('<UpdateVariable>')
    expect(mesText(0).querySelector('b')).not.toBeNull()
  })

  it('隐藏标签开→关：reprocessAllMessages 立即恢复原文', () => {
    buildChat([{ text: '心情不错 [立绘:微笑]' }])
    const el = mesText(0)
    const original = el.textContent

    processMessages(baseSettings({ hideTagInMessage: true }), 0)
    expect(el.textContent).not.toContain('[立绘:微笑]')

    reprocessAllMessages(baseSettings({ hideTagInMessage: false }))
    expect(el.textContent).toBe(original)
  })

  it.each(['inline', 'both'] as const)(
    '%s 模式下隐藏开关关闭时保留标签并在原位插入立绘',
    (spriteDisplayMode) => {
      buildChat([{ text: '心情不错 [立绘:微笑]' }])

      processMessages(baseSettings({ spriteDisplayMode, hideTagInMessage: false }), 0)

      expect(mesText(0).textContent).toContain('[立绘:微笑]')
      expect(mesText(0).querySelectorAll('.so-inline-sprite')).toHaveLength(1)
    },
  )

  it('总开关关闭：reprocessAllMessages 只恢复不再加工', () => {
    buildChat([{ text: '你好 [立绘:微笑]' }])
    const el = mesText(0)
    const original = el.textContent

    processMessages(baseSettings({ spriteDisplayMode: 'inline', hideTagInMessage: true }), 0)
    expect(el.querySelector('img')).not.toBeNull()

    reprocessAllMessages(
      baseSettings({ enabled: false, spriteDisplayMode: 'inline', hideTagInMessage: true }),
    )
    expect(el.querySelector('img')).toBeNull()
    expect(el.textContent).toBe(original)
  })

  it('同一设置重复处理幂等（不重复插入图片）', () => {
    buildChat([{ text: '[立绘:微笑]' }])
    const s = baseSettings({ spriteDisplayMode: 'inline' })
    processMessages(s, 0)
    processMessages(s, 0)
    processMessages(s)
    expect(mesText(0).querySelectorAll('img').length).toBe(1)
  })

  it('流式增长：ST 重写 innerHTML 后按新内容重新解析', () => {
    buildChat([{ text: '开头 [立绘:微笑]' }])
    const s = baseSettings({ spriteDisplayMode: 'inline' })
    const el = mesText(0)
    processMessages(s, 0)
    expect(el.querySelector('img')?.getAttribute('alt')).toBe('微笑')

    // 模拟 ST 流式更新：整体重写 innerHTML（marker 消失），内容变长且标签变化
    el.innerHTML = ''
    el.textContent = '开头 一大段新增内容 [立绘:哭泣]'
    processMessages(s, 0)
    const imgs = el.querySelectorAll('img')
    expect(imgs.length).toBe(1)
    expect(imgs[0].getAttribute('alt')).toBe('哭泣')

    // 恢复应回到最新的原文（而不是最早那版）
    restoreAllMessages()
    expect(el.textContent).toBe('开头 一大段新增内容 [立绘:哭泣]')
  })
})

describe('recentFloors 窗口', () => {
  it('批量补渲染只处理最近 N 个候选 AI 楼层', () => {
    const msgs: MsgDef[] = []
    for (let i = 0; i < 12; i++) {
      msgs.push({ text: `用户消息 ${i}`, isUser: true })
      msgs.push({ text: `回复 ${i} [立绘:微笑]` })
    }
    buildChat(msgs)
    processMessages(baseSettings({ spriteDisplayMode: 'inline', recentFloors: 6 }))

    const processed = document.querySelectorAll('#chat .mes_text[data-so-fp]')
    expect(processed.length).toBe(6)
    // 应是最后 6 个 AI 楼层（mesid 13,15,17,19,21,23）
    const ids = Array.from(processed).map((el) =>
      el.closest('.mes')?.getAttribute('mesid'),
    )
    expect(ids).toEqual(['13', '15', '17', '19', '21', '23'])
  })

  it('窗口计数只统计含标签的 AI 楼层（无标签楼层不占名额）', () => {
    buildChat([
      { text: '有标签的老楼层 [立绘:微笑]' },
      { text: '闲聊无标签' },
      { text: '闲聊无标签 2' },
      { text: '新楼层 [立绘:哭泣]' },
    ])
    processMessages(baseSettings({ spriteDisplayMode: 'inline', recentFloors: 2 }))
    // 候选只有 0 和 3，都在窗口内
    expect(mesText(0).querySelector('img')).not.toBeNull()
    expect(mesText(3).querySelector('img')).not.toBeNull()
  })

  it('窗口外的旧楼层单事件不加工，最新楼层始终加工', () => {
    const msgs: MsgDef[] = []
    for (let i = 0; i < 10; i++) msgs.push({ text: `回复 ${i} [立绘:微笑]` })
    buildChat(msgs)
    const s = baseSettings({ spriteDisplayMode: 'inline', recentFloors: 3 })

    processMessages(s, 0) // 旧楼层：窗口外（候选 10 个，窗口只留 7/8/9）
    expect(mesText(0).querySelector('img')).toBeNull()

    processMessages(s, 9) // 最新楼层：始终加工
    expect(mesText(9).querySelector('img')).not.toBeNull()

    processMessages(s, 7) // 窗口内的历史楼层：加工
    expect(mesText(7).querySelector('img')).not.toBeNull()
  })
})
