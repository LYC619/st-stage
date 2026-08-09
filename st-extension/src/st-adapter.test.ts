// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { STAdapter } from './st-adapter'

afterEach(() => {
  delete window.SillyTavern
})

describe('STAdapter story context', () => {
  it('uses chatId as the direct-chat title when chat metadata has no filename', () => {
    window.SillyTavern = {
      getContext: () => ({
        characterId: '3',
        chatId: '第一章',
        name2: '小雪',
        characters: [],
      }),
    } as never

    expect(new STAdapter().getStoryContext()).toEqual({
      key: '3::第一章',
      title: '第一章',
      characterName: '小雪',
    })
  })
})

describe('STAdapter runtime events', () => {
  it.each([
    ['onChatCreated', 'CHAT_CREATED', 'chat_created'],
    ['onGenerationEnded', 'GENERATION_ENDED', 'generation_ended'],
  ] as const)('subscribes %s and removes the exact handler', (method, key, fallback) => {
    const on = vi.fn()
    const removeListener = vi.fn()
    const handler = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { [key]: fallback },
        eventSource: { on, removeListener },
      }),
    } as never

    const off = new STAdapter()[method](handler)

    expect(on).toHaveBeenCalledWith(fallback, handler)
    off()
    expect(removeListener).toHaveBeenCalledWith(fallback, handler)
  })

  it('forwards cumulative streaming text and ignores non-string payloads', () => {
    let wrapped: ((value: unknown) => void) | undefined
    const handler = vi.fn()
    const removeListener = vi.fn()
    window.SillyTavern = {
      getContext: () => ({
        eventTypes: { STREAM_TOKEN_RECEIVED: 'stream_token_received' },
        eventSource: {
          on: (_event: string, next: (value: unknown) => void) => { wrapped = next },
          removeListener,
        },
      }),
    } as never

    const off = new STAdapter().onStreamText(handler)
    wrapped?.('正文 [立绘:微笑]')
    wrapped?.({ text: '不是事件约定的字符串' })

    expect(handler).toHaveBeenCalledOnce()
    expect(handler).toHaveBeenCalledWith('正文 [立绘:微笑]')
    off()
    expect(removeListener).toHaveBeenCalledWith('stream_token_received', wrapped)
  })
})
