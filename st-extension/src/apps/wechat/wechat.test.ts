// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import {
  normalizeRagText,
  getRagTokens,
  getRagMessages,
  buildRagPrompt,
} from './rag'
import { resolveWeChatAssetUrl } from './assets'
import { WeChatPipeline } from './pipeline'
import {
  PLAYER_EMOJIS,
  CONTACT_EMOJIS,
  CONTACT_PHOTOS,
} from './manifest-data'
import type { ChatMessage, ContactState, WeChatConfig } from './types'

describe('WeChat RAG Algorithm', () => {
  it('normalizes text and extracts 1-char and 2-char tokens', () => {
    const norm = normalizeRagText('你好，世界！')
    expect(norm).toBe('你好世界')

    const tokens = getRagTokens('可乐')
    expect(tokens).toContain('可')
    expect(tokens).toContain('乐')
    expect(tokens).toContain('可乐')
  })

  it('calculates score and retrieves past day messages', () => {
    const history: ChatMessage[] = [
      {
        sender: 'player',
        content: '今天想喝冰可乐',
        type: 'text',
        time: { day: 1, hour: 12, minute: 0 },
      },
      {
        sender: 'contact',
        content: '我给你买了可乐放冰箱了',
        type: 'text',
        time: { day: 1, hour: 13, minute: 0 },
      },
      {
        sender: 'player',
        content: '今天吃什么',
        type: 'text',
        time: { day: 2, hour: 12, minute: 0 },
      },
    ]

    const matched = getRagMessages(
      '可乐',
      history,
      2, // 今天是第2天
      PLAYER_EMOJIS,
      CONTACT_EMOJIS,
      CONTACT_PHOTOS,
    )

    expect(matched.length).toBeGreaterThanOrEqual(1)
    expect(matched[0].content).toContain('可乐')

    const prompt = buildRagPrompt(
      '可乐',
      history,
      2,
      PLAYER_EMOJIS,
      CONTACT_EMOJIS,
      CONTACT_PHOTOS,
    )
    expect(prompt).toContain('相关历史')
    expect(prompt).toContain('可乐')
  })
})

describe('WeChat Pipeline & Fallback Engine', () => {
  const config: WeChatConfig = { apiKey: '', model: 'deepseek-chat' }
  const pipeline = new WeChatPipeline(
    config,
    PLAYER_EMOJIS,
    CONTACT_EMOJIS,
    CONTACT_PHOTOS,
  )

  const defaultState: ContactState = {
    mood: 60,
    interest: 20,
    contactLocation: 'SISTER_ROOM',
    playerLocation: 'COMPANY',
    money: 5000,
  }

  it('builds generic character prompts without fixed locations or numeric ladders', () => {
    const prompt = pipeline.buildSystemPrompt(defaultState, '18:30', 'Alice')
    expect(prompt).toContain('「Alice」')
    expect(prompt).toContain('inner_thought')
    expect(prompt).not.toContain('性趣阶梯')
    expect(prompt).not.toContain('玩家此时在公司')
  })

  it('returns offline fallback replies', async () => {
    const history: ChatMessage[] = [
      {
        sender: 'player',
        content: '今天想吃红烧肉',
        type: 'text',
        time: { day: 1, hour: 18, minute: 0 },
      },
    ]

    const reply = await pipeline.requestContactReply(history, defaultState, 1, '18:00')
    expect(reply.messages.length).toBeGreaterThanOrEqual(1)
    expect(reply.messages[0].content).toBe('收到你的消息了。')
  })

  it('returns offline red packet acknowledgement', async () => {
    const history: ChatMessage[] = [
      {
        sender: 'player',
        content: '100',
        type: 'red_packet',
        time: { day: 1, hour: 18, minute: 0 },
      },
    ]

    const reply = await pipeline.requestContactReply(history, defaultState, 1, '18:00')
    expect(reply.messages[0].content).toContain('礼物')
  })

  it('strictly validates and sanitizes emoji_id and pic_id in parseReplyJson (W3 / P1)', () => {
    const maliciousJson = JSON.stringify({
      messages: [
        { type: 'emoji', emoji_id: '"><img src=x onerror=alert(1)>' },
        { type: 'image', pic_id: '"><script>alert(2)</script>' },
        { type: 'emoji', emoji_id: 'happy' },
      ],
    })

    const payload = pipeline.parseReplyJson(maliciousJson)
    expect(payload.messages.length).toBe(3)
    expect(payload.messages[0]).toEqual({ type: 'text', content: '[表情]' })
    expect(payload.messages[1]).toEqual({ type: 'text', content: '[自拍]' })
    expect(payload.messages[2]).toEqual({ type: 'emoji', emoji_id: 'happy' })
  })
})

describe('WeChat Asset Resolution (W5 / P2)', () => {
  it('resolves asset paths for Next.js and preserves absolute/data URLs', () => {
    expect(resolveWeChatAssetUrl('photos/bedroom1.png')).toBe('/assets/wechat/photos/bedroom1.png')
    expect(resolveWeChatAssetUrl('/photos/bedroom1.png')).toBe('/assets/wechat/photos/bedroom1.png')
    expect(resolveWeChatAssetUrl('data:image/png;base64,123')).toBe('data:image/png;base64,123')
    expect(resolveWeChatAssetUrl('https://example.com/a.png')).toBe('https://example.com/a.png')
  })
})
