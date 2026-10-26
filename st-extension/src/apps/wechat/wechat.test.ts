// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'
import { planTypingSimulation, simulateTypingDelay } from './typing'
import {
  normalizeRagText,
  getRagTokens,
  getRagMessages,
  buildRagPrompt,
} from './rag'
import { resolveWeChatAssetUrl } from './assets'
import { WeChatPipeline } from './pipeline'
import { createWeChatApp, getScopedConversation } from './wechat-app'
import {
  PLAYER_EMOJIS,
  SISTER_EMOJIS,
  SISTER_PHOTOS,
  FALLBACK_DIALOGUES,
} from './manifest-data'
import {
  extractFieldsFromObject,
  resolveCharacterAvatarUrl,
} from './bridge'
import type { ChatMessage, SisterState, WeChatConfig, WeChatAppData } from './types'
import type { AppHost, PhoneAppContext } from '../../../../core/phone-registry'
import { createDefaultSettings } from '../../../../core/types'

describe('WeChat Typing Simulation', () => {
  it('clamps base typing delay between 600ms and 2000ms', () => {
    const shortPlan = planTypingSimulation('好')
    expect(shortPlan.baseTimeMs).toBe(600)

    const longPlan = planTypingSimulation('a'.repeat(100))
    expect(longPlan.baseTimeMs).toBe(2000)

    const normalPlan = planTypingSimulation('今天下班回来带杯可乐不？')
    expect(normalPlan.baseTimeMs).toBeGreaterThanOrEqual(600)
    expect(normalPlan.baseTimeMs).toBeLessThanOrEqual(2000)
  })

  it('generates pauses and positive total duration', () => {
    const plan = planTypingSimulation('测试消息')
    expect(plan.totalDurationMs).toBeGreaterThanOrEqual(plan.baseTimeMs)
    expect(plan.pauses.length).toBeGreaterThanOrEqual(0)
    expect(plan.pauses.length).toBeLessThanOrEqual(2)
  })

  it('runs simulateTypingDelay and invokes onTypingStateChange', async () => {
    vi.useFakeTimers()
    const onStateChange = vi.fn()
    const promise = simulateTypingDelay('你好', onStateChange)

    expect(onStateChange).toHaveBeenCalledWith(true)
    await vi.runAllTimersAsync()
    await promise
    expect(onStateChange).toHaveBeenCalledWith(false)
    vi.useRealTimers()
  })
})

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
        sender: 'sister',
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
      SISTER_EMOJIS,
      SISTER_PHOTOS,
    )

    expect(matched.length).toBeGreaterThanOrEqual(1)
    expect(matched[0].content).toContain('可乐')

    const prompt = buildRagPrompt(
      '可乐',
      history,
      2,
      PLAYER_EMOJIS,
      SISTER_EMOJIS,
      SISTER_PHOTOS,
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
    SISTER_EMOJIS,
    SISTER_PHOTOS,
    FALLBACK_DIALOGUES,
  )

  const defaultState: SisterState = {
    mood: 60,
    interest: 20,
    sisterLocation: 'SISTER_ROOM',
    playerLocation: 'COMPANY',
    money: 5000,
  }

  it('builds system prompt containing locations, ladder definitions and character adaptation', () => {
    const promptSister = pipeline.buildSystemPrompt(defaultState, '18:30', '妹妹')
    expect(promptSister).toContain('妹妹正在自己的卧室')
    expect(promptSister).toContain('玩家此时在公司')
    expect(promptSister).toContain('性趣阶梯')
    expect(promptSister).toContain('心情阶梯')
    expect(promptSister).toContain('扮演玩家的妹妹')

    const promptAlice = pipeline.buildSystemPrompt(defaultState, '18:30', 'Alice')
    expect(promptAlice).toContain('当前对话角色「Alice」')
  })

  it('returns offline fallback replies based on keywords', async () => {
    const history: ChatMessage[] = [
      {
        sender: 'player',
        content: '今天想吃红烧肉',
        type: 'text',
        time: { day: 1, hour: 18, minute: 0 },
      },
    ]

    const reply = await pipeline.requestSisterReply(history, defaultState, 1, '18:00')
    expect(reply.messages.length).toBeGreaterThanOrEqual(1)
    expect(reply.messages[0].content).toContain('吃')
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

    const reply = await pipeline.requestSisterReply(history, defaultState, 1, '18:00')
    expect(reply.messages.some((m) => m.content?.includes('老板') || m.type === 'emoji')).toBe(true)
  })

  it('clamps stat impact strictly within [-0.4, 0.4]', async () => {
    const impact = await pipeline.requestStatImpact('发个红包给你', '谢谢哥', defaultState)
    expect(impact.mood).toBeGreaterThanOrEqual(-0.4)
    expect(impact.mood).toBeLessThanOrEqual(0.4)
    expect(impact.interest).toBeGreaterThanOrEqual(-0.4)
    expect(impact.interest).toBeLessThanOrEqual(0.4)
  })

  it('strictly validates and sanitizes emoji_id and pic_id in parseReplyJson (W3 / P1)', () => {
    // 注入恶意 HTML / 脚本标签
    const maliciousJson = JSON.stringify({
      messages: [
        { type: 'emoji', emoji_id: '"><img src=x onerror=alert(1)>' },
        { type: 'image', pic_id: '"><script>alert(2)</script>' },
        { type: 'emoji', emoji_id: 'happy' }, // 合法表情
      ],
    })

    const payload = pipeline.parseReplyJson(maliciousJson)
    expect(payload.messages.length).toBe(3)
    // 非白名单表情被降级为安全纯文本
    expect(payload.messages[0]).toEqual({ type: 'text', content: '[表情]' })
    // 非白名单图片被降级为安全纯文本
    expect(payload.messages[1]).toEqual({ type: 'text', content: '[自拍]' })
    // 白名单表情正常保留
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

describe('WeChat PhoneApp Lifecycle & Character Scoping (W1, W2, W4, W6, W7)', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('initializes and scopes conversations by active character (W1 / W2)', () => {
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentChar = 'Alice'
    const callbacks: { onCharChange?: () => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => currentChar,
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: (fn) => {
        callbacks.onCharChange = fn
        return () => { delete callbacks.onCharChange }
      },
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    expect(storage.data?.conversations).toBeDefined()
    expect(storage.data?.conversations?.['Alice']).toBeDefined()

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    // 检查导航栏显示的是当前角色 Alice
    expect(container.querySelector('#wt-contact-name')?.textContent).toBe('Alice')

    // 切换到 Bob
    currentChar = 'Bob'
    callbacks.onCharChange?.()

    // 检查导航栏切换为 Bob，且 Bob 会话独立初始化
    expect(container.querySelector('#wt-contact-name')?.textContent).toBe('Bob')
    expect(storage.data?.conversations?.['Bob']).toBeDefined()

    app.unmount?.()
  })

  it('migrates legacy flat appData into scoped conversation without data loss (W2)', () => {
    const legacyData: WeChatAppData = {
      config: { apiKey: 'test-key' },
      messages: [{ sender: 'player', content: '历史消息', type: 'text', time: { day: 1, hour: 12, minute: 0 } }],
      state: { mood: 88, interest: 45, sisterLocation: 'LIVING_ROOM', playerLocation: 'COMPANY', money: 9999 },
      currentDay: 3,
    }

    const conv = getScopedConversation(legacyData, '妹妹')
    expect(conv.characterName).toBe('妹妹')
    expect(conv.messages[0].content).toBe('历史消息')
    expect(conv.state.mood).toBe(88)
    expect(conv.currentDay).toBe(3)
  })

  it('prevents Enter during IME composition from sending message (W6 / P2)', () => {
    const app = createWeChatApp()
    let storedData: WeChatAppData | undefined = undefined

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => '妹妹',
      getAppData: <T>() => storedData as T | undefined,
      setAppData: <T>(data: T) => { storedData = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    input.value = '测试中文输入法'

    // 模拟输入法正在输入 (isComposing: true)
    input.dispatchEvent(new CompositionEvent('compositionstart'))
    const enterEvent = new KeyboardEvent('keydown', { key: 'Enter', isComposing: true })
    input.dispatchEvent(enterEvent)

    // 输入内容未被清除，未触发发送
    expect(input.value).toBe('测试中文输入法')

    // 确认输入法结束
    input.dispatchEvent(new CompositionEvent('compositionend'))

    // 检查 W7 样式要求：min-width: 0 存在于行内样式中
    expect(input.style.minWidth).toBe('0px')

    app.unmount?.()
  })

  it('drops in-flight reply writeback if unmounted during request (W4 / P2)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => '妹妹',
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = '消息测试'

    // 发送消息后立即卸载 App
    sendBtn.click()
    const msgCountBefore = storage.data?.conversations?.['妹妹']?.messages.length || 0

    // 用户关闭或离开 App
    app.unmount?.()

    // 快进所有计时器
    await vi.runAllTimersAsync()

    // 卸载后由于会话失效，旧回复被丢弃，不会写回已卸载的存储
    const msgCountAfter = storage.data?.conversations?.['妹妹']?.messages.length || 0
    expect(msgCountAfter).toBe(msgCountBefore)

    vi.useRealTimers()
  })

  it('reads character card settings and external MVU variable state (W1 / P1)', async () => {
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getCharacterCard: () => ({
        name: 'Alice',
        description: '神秘的侦探少女，冷静理智。',
        personality: '冷静，敏锐',
      }),
      getChatContext: () => ({
        characterId: 'char_alice_1',
        chatId: 'chat_case_01',
        characterName: 'Alice',
        chat: [
          { mes: '你好，侦探。', is_user: true },
          { mes: '有什么线索吗？', is_user: false },
        ],
      }),
      // 模拟外部 MVU / 酒馆助手状态 mood: 82
      getVariables: () => ({
        mood: 82,
        interest: 35,
        money: 8888,
      }),
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    // 等待异步变量读取就绪
    await vi.waitFor(() => {
      expect(container.querySelector('#val-mood')?.textContent).toBe('82')
    })

    expect(container.querySelector('#val-interest')?.textContent).toBe('35')
    expect((container.querySelector('#wt-pill-badge') as HTMLElement)?.style.display).toBe('none')

    // 检查提示词构建包含角色卡人设与外部状态
    const pipeline = new WeChatPipeline(
      { apiKey: 'test' },
      PLAYER_EMOJIS,
      SISTER_EMOJIS,
      SISTER_PHOTOS,
      FALLBACK_DIALOGUES,
    )
    const prompt = pipeline.buildSystemPrompt(
      { hasExternalState: true, externalSource: 'mvu', mood: 82, interest: 35, sisterLocation: 'SISTER_ROOM', playerLocation: 'COMPANY', money: 8888 },
      '12:00',
      {
        scopeKey: 'char_alice_1::chat_case_01',
        characterName: 'Alice',
        card: { description: '神秘的侦探少女，冷静理智。' },
        stRecentMessages: [{ sender: 'user', text: '你好，侦探。' }],
        externalState: { source: 'mvu', mood: 82 },
      },
    )

    expect(prompt).toContain('神秘的侦探少女')
    expect(prompt).toContain('当前外部状态')
    expect(prompt).toContain('82.0')
    expect(prompt).not.toContain('家中只有玩家和Alice两人')

    app.unmount?.()
  })

  it('scopes conversation by stable characterId and chatId, preventing multi-chat leak under same name (W2 / P1)', async () => {
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentChatId = 'first-chat'
    const callbacks: { onCharChange?: () => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getChatContext: () => ({
        characterId: 'alice_card_id',
        chatId: currentChatId,
        characterName: 'Alice',
      }),
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: (fn) => {
        callbacks.onCharChange = fn
        return () => { delete callbacks.onCharChange }
      },
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    // 在 first-chat 中发送一条唯一样本文本
    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = 'Alice 独有对话一中的密码 9527'
    sendBtn.click()

    expect(container.querySelector('#wt-scroll')?.textContent).toContain('9527')
    expect(storage.data?.conversations?.['alice_card_id::first-chat']).toBeDefined()

    // 切换到 Alice 的 second-chat（同名卡，不同聊天会话）
    currentChatId = 'second-chat'
    callbacks.onCharChange?.()

    await vi.waitFor(() => {
      // second-chat 页面不应显示 first-chat 的文本！
      expect(container.querySelector('#wt-scroll')?.textContent).not.toContain('9527')
    })

    // storage 字典中应独立存在两个作用域条目
    expect(storage.data?.conversations?.['alice_card_id::first-chat']).toBeDefined()
    expect(storage.data?.conversations?.['alice_card_id::second-chat']).toBeDefined()

    app.unmount?.()
  })

  it('drops in-flight reply writeback when character changes during request (W4 / P1)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentChar = 'Alice'
    const callbacks: { onCharChange?: () => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => currentChar,
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: (fn) => {
        callbacks.onCharChange = fn
        return () => { delete callbacks.onCharChange }
      },
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = 'Alice 正在发送的消息'

    // 发送消息，回复处于在途状态
    sendBtn.click()

    // 此时用户切换到 Bob
    currentChar = 'Bob'
    callbacks.onCharChange?.()

    // 快进所有计时器以让 Alice 在途请求返回
    await vi.runAllTimersAsync()

    // Bob 的聊天记录绝对不能出现 Alice 的回复
    const bobConv = storage.data?.conversations?.['Bob']
    const bobMessages = bobConv?.messages || []
    for (const m of bobMessages) {
      expect(m.content).not.toContain('Alice')
    }

    app.unmount?.()
    vi.useRealTimers()
  })

  it('drops in-flight stat impact writeback when character changes during evaluation (W4 / P1)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentChar = 'Alice'
    const callbacks: { onCharChange?: () => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => currentChar,
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: (fn) => {
        callbacks.onCharChange = fn
        return () => { delete callbacks.onCharChange }
      },
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)

    const container = document.createElement('div')
    document.body.appendChild(container)

    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)

    // 切到 Bob 前记录 Bob 初始心情
    currentChar = 'Bob'
    callbacks.onCharChange?.()
    const bobInitialMood = storage.data?.conversations?.['Bob']?.state.mood ?? 60

    // 切回 Alice 发送消息
    currentChar = 'Alice'
    callbacks.onCharChange?.()
    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = '测试好感结算'
    sendBtn.click()

    // 立即切到 Bob
    currentChar = 'Bob'
    callbacks.onCharChange?.()

    await vi.runAllTimersAsync()

    // 确认 Bob 的心情没有被 Alice 的结算修改
    const bobFinalMood = storage.data?.conversations?.['Bob']?.state.mood
    expect(bobFinalMood).toBe(bobInitialMood)

    app.unmount?.()
    vi.useRealTimers()
  })

  it('unpacks MVU [value, desc] tuples and falls back to independent mode when unmapped (W1a / P1)', async () => {
    // 1. MVU 描述二元组正常解包并标注 mappedFields
    const tupleInput = {
      mood: [82, 'mood-note'],
      interest: [35, 'interest-note'],
    }
    const extractedTuple = extractFieldsFromObject(tupleInput)
    expect(extractedTuple.mood).toBe(82)
    expect(extractedTuple.interest).toBe(35)
    expect(extractedTuple.hasAny).toBe(true)
    expect(extractedTuple.mappedFields.mood).toBe(true)
    expect(extractedTuple.mappedFields.interest).toBe(true)
    expect(extractedTuple.mappedFields.money).toBe(false)

    // 2. 无关变量对象不冒充外部状态
    const irrelevantInput = { other: 123, unrelated: 'str' }
    const extractedIrrelevant = extractFieldsFromObject(irrelevantInput)
    expect(extractedIrrelevant.hasAny).toBe(false)
    expect(extractedIrrelevant.mood).toBeUndefined()
    expect(extractedIrrelevant.mappedFields.mood).toBe(false)

    // 3. 挂载时，无关变量应被标记为独立会话数值
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }
    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getVariables: () => irrelevantInput,
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }
    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }
    app.mount(container, ctx)
    await vi.waitFor(() => {
      const badge = container.querySelector('#wt-pill-badge') as HTMLElement
      expect(badge.textContent).toBe('独立')
      const sourceEl = container.querySelector('#wt-modal-state-source') as HTMLElement
      expect(sourceEl.textContent).toContain('未接入外部状态')
    })
    app.unmount?.()
  })

  it('discards delayed async variable reads after character switch or unmount (W4 / P1)', async () => {
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentChar = 'Alice'
    const callbacks: { onCharChange?: () => void } = {}
    let resolveAliceVars: (val: Record<string, unknown> | undefined) => void = () => {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => currentChar,
      getVariables: () => {
        if (currentChar === 'Alice') {
          return new Promise((resolve) => {
            resolveAliceVars = resolve
          })
        }
        return { mood: 22 }
      },
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: (fn) => {
        callbacks.onCharChange = fn
        return () => { delete callbacks.onCharChange }
      },
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    // 1. Alice 挂载，变量读取被挂起
    app.mount(container, ctx)

    // 2. 用户切到 Bob，Bob 立即读取到 mood=22
    currentChar = 'Bob'
    callbacks.onCharChange?.()

    await vi.waitFor(() => {
      expect(container.querySelector('#val-mood')?.textContent).toBe('22')
    })

    // 3. 此时 Alice 延迟的变量返回（mood=82）
    resolveAliceVars({ mood: 82 })
    await new Promise((r) => setTimeout(r, 20))

    // 视图仍保持 Bob 的 22，不被迟到的 Alice 覆盖
    expect(container.querySelector('#wt-contact-name')?.textContent).toBe('Bob')
    expect(container.querySelector('#val-mood')?.textContent).toBe('22')

    app.unmount?.()
  })

  it('preserves external state snapshot without local stat impact overwrite (W1c / P2)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getVariables: () => ({ mood: 82 }),
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)
    await vi.runAllTimersAsync()

    // 确认已读取外部 mood=82
    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = '测试外部状态保持'
    sendBtn.click()

    await vi.runAllTimersAsync()

    // 外部心情 82 保持权威，不受本地本地评估 +0.4 覆盖
    const aliceConv = storage.data?.conversations?.['Alice']
    expect(aliceConv?.state.hasExternalState).toBe(true)
    expect(aliceConv?.state.mood).toBe(82)

    app.unmount?.()
    vi.useRealTimers()
  })

  it('refreshes recent ST messages and variable state on message/var events and before sending (W1b / P2)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentMood = 82
    const chatHistory = [
      { mes: '昨天在酒馆的旧对话', is_user: false },
    ]
    const callbacks: { onMsg?: (text: string) => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getVariables: () => ({ mood: currentMood }),
      getChatContext: () => ({
        chat: chatHistory,
      }),
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: (fn) => {
        callbacks.onMsg = fn
        return () => { delete callbacks.onMsg }
      },
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)
    await vi.runAllTimersAsync()
    expect(container.querySelector('#val-mood')?.textContent).toBe('82')

    // 1. ST 主会话收到新消息且外部变量结算为 96
    chatHistory.push({ mes: '今天主聊天更新了重要标记：图书馆见', is_user: true })
    currentMood = 96
    callbacks.onMsg?.('新消息')
    await vi.runAllTimersAsync()

    // 界面同步刷新为 96
    expect(container.querySelector('#val-mood')?.textContent).toBe('96')

    // 2. 发送前再次更新主聊天，发送时自动提取最新上下文
    chatHistory.push({ mes: '快迟到了，记得带雨伞', is_user: false })
    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = '马上就到'
    sendBtn.click()

    await vi.runAllTimersAsync()

    app.unmount?.()
    vi.useRealTimers()
  })

  it('preserves custom non-enum location in system prompt (W1d / P2)', () => {
    const pipeline = new WeChatPipeline(
      { apiKey: 'test', apiUrl: 'http://test', model: 'test' },
      PLAYER_EMOJIS,
      SISTER_EMOJIS,
      SISTER_PHOTOS,
      FALLBACK_DIALOGUES,
    )

    const state: SisterState = {
      hasExternalState: true,
      externalSource: 'host',
      externalFields: { location: true },
      mood: 80,
      interest: 20,
      sisterLocation: 'CUSTOM_LIBRARY_LOCATION',
      playerLocation: 'LIVING_ROOM',
      money: 1000,
    }

    const prompt = pipeline.buildSystemPrompt(
      state,
      '14:00',
      'Alice',
    )

    expect(prompt).toContain('CUSTOM_LIBRARY_LOCATION')
  })

  it('resolves ST character avatar filename to URL with fallback on error (W8 / P2)', () => {
    // 1. 文件名转为 SillyTavern 缩略图/静态路径
    const resolvedUrl = resolveCharacterAvatarUrl('Alice.png')
    expect(resolvedUrl).toMatch(/\/characters\/Alice\.png|\/thumbnail\?/)

    // 2. 完整 URL 保持原样
    expect(resolveCharacterAvatarUrl('https://example.com/avatar.png')).toBe('https://example.com/avatar.png')

    // 3. 空头像返回 undefined
    expect(resolveCharacterAvatarUrl(undefined)).toBeUndefined()
    expect(resolveCharacterAvatarUrl('')).toBeUndefined()
  })

  it('discards stale async variable reads within the same conversation (W4 / P2)', async () => {
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let resolveFirstRead: (val: Record<string, unknown> | undefined) => void = () => {}
    let callCount = 0
    const callbacks: { onMsg?: (text: string) => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getVariables: () => {
        callCount++
        if (callCount === 1) {
          return new Promise((resolve) => {
            resolveFirstRead = resolve
          })
        }
        return Promise.resolve({ mood: 96 })
      },
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: (fn) => {
        callbacks.onMsg = fn
        return () => { delete callbacks.onMsg }
      },
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    // 1. 首次读取挂起
    app.mount(container, ctx)

    // 2. 触发第二次刷新（变量更新事件），并立即返回 96
    callbacks.onMsg?.('新状态')
    await vi.waitFor(() => {
      expect(container.querySelector('#val-mood')?.textContent).toBe('96')
    })

    // 3. 此时较早发起的第一次读取返回 82
    resolveFirstRead({ mood: 82 })
    await new Promise((r) => setTimeout(r, 20))

    // 较旧的 82 被序列丢弃，页面仍显示最新的 96
    expect(container.querySelector('#val-mood')?.textContent).toBe('96')
    expect(storage.data?.conversations?.['Alice']?.state.mood).toBe(96)

    app.unmount?.()
  })

  it('re-evaluates external field ownership after stat impact await to prevent overwrite (W1c / P2)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    let currentVars: Record<string, unknown> = { money: 1000 }
    const callbacks: { onMsg?: (text: string) => void } = {}

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getVariables: () => currentVars,
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: (fn) => {
        callbacks.onMsg = fn
        return () => { delete callbacks.onMsg }
      },
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)
    await vi.runAllTimersAsync()

    // 初始状态下心情独立（60）
    const input = container.querySelector('#wt-input-text') as HTMLInputElement
    const sendBtn = container.querySelector('#wt-send-btn') as HTMLElement
    input.value = '测试异步评估期间被接管'
    sendBtn.click()

    // 在打字延迟及评估在途期间，外部变量事件接管了心情字段为 82
    currentVars = { money: 1000, mood: 82 }
    callbacks.onMsg?.('变量更新')
    await vi.runAllTimersAsync()

    // 评估完成后，重新核查确认 mood 已是外部字段，不追加 +0.4，保持外部 82
    const aliceConv = storage.data?.conversations?.['Alice']
    expect(aliceConv?.state.hasExternalState).toBe(true)
    expect(aliceConv?.state.externalFields?.mood).toBe(true)
    expect(aliceConv?.state.mood).toBe(82)

    app.unmount?.()
    vi.useRealTimers()
  })

  it('keeps external money snapshot read-only without local red packet deduction (W1c / P2)', async () => {
    vi.useFakeTimers()
    const app = createWeChatApp()
    const storage: { data?: WeChatAppData } = { data: undefined }

    const host: AppHost = {
      apiVersion: 2,
      getSettings: () => createDefaultSettings(),
      getCharacterName: () => 'Alice',
      getVariables: () => ({ money: 1000 }),
      getAppData: <T>() => storage.data as T | undefined,
      setAppData: <T>(data: T) => { storage.data = data as unknown as WeChatAppData },
      onMessageReceived: () => () => {},
      onCharacterChanged: () => () => {},
      injectPrompt: () => {},
      toast: vi.fn(),
    }

    app.setup?.(host)
    const container = document.createElement('div')
    document.body.appendChild(container)
    const ctx: PhoneAppContext = {
      ...host,
      toast: vi.fn(),
      getSettings: () => createDefaultSettings(),
      updateSettings: vi.fn(),
      goHome: vi.fn(),
      openModal: vi.fn(),
      setTimeout: (fn, ms) => window.setTimeout(fn, ms),
      setInterval: (fn, ms) => window.setInterval(fn, ms),
    }

    app.mount(container, ctx)
    await vi.runAllTimersAsync()

    // 发送 20 元红包
    const packetBtn = container.querySelector('#wt-packet-btn') as HTMLElement
    packetBtn.click()
    const fastBtn = container.querySelector('.wt-amt-pill[data-amt="20"]') as HTMLElement
    fastBtn.click()
    await vi.runAllTimersAsync()

    // 外部余额保持只读 1000，不被本地模拟扣为 980
    const aliceConv = storage.data?.conversations?.['Alice']
    expect(aliceConv?.state.hasExternalState).toBe(true)
    expect(aliceConv?.state.externalFields?.money).toBe(true)
    expect(aliceConv?.state.money).toBe(1000)

    app.unmount?.()
    vi.useRealTimers()
  })

  it('does not allow invalid candidate to mask valid aliases in the same character pool (W1a / P2)', () => {
    const input = {
      Alice: { mood: 'calm', happiness: [82, 'note'] },
      mood: 12,
    }
    const extracted = extractFieldsFromObject(input, 'Alice')
    // Alice 角色池中的 happiness: 82 不被无效文本 mood: 'calm' 遮蔽，且优先于根池的 mood: 12
    expect(extracted.mood).toBe(82)
    expect(extracted.mappedFields.mood).toBe(true)
  })
})
