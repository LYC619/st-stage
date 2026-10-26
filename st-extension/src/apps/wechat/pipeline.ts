/**
 * 《小登同居生活》微信对话双阶段 API 请求管线与状态评估器
 */

import type {
  ChatMessage,
  EmojiItem,
  PhotoItem,
  SisterState,
  StatImpact,
  LLMReplyPayload,
  LLMMessageItem,
  WeChatConfig,
} from './types'
import type { ConversationScope } from './bridge'
import { buildRagPrompt, messageToRagText } from './rag'
import { SISTER_LOCATIONS, PLAYER_LOCATIONS } from './manifest-data'

export interface FallbackBranch {
  min_mood: number
  reply: string
}

export interface FallbackKeywordItem {
  pattern: string
  reply?: string
  branches?: FallbackBranch[]
}

export interface FallbackDialoguesConfig {
  keywords?: FallbackKeywordItem[]
  default_text?: string
  red_packet_reply?: string
}

export interface ChatCompletionMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export class WeChatPipeline {
  private config: WeChatConfig
  private playerEmojis: Record<string, EmojiItem>
  private sisterEmojis: Record<string, EmojiItem>
  private sisterPhotos: Record<string, PhotoItem>
  private fallbackDialogues?: FallbackDialoguesConfig

  constructor(
    config: WeChatConfig,
    playerEmojis: Record<string, EmojiItem>,
    sisterEmojis: Record<string, EmojiItem>,
    sisterPhotos: Record<string, PhotoItem>,
    fallbackDialogues?: FallbackDialoguesConfig,
  ) {
    this.config = config
    this.playerEmojis = playerEmojis
    this.sisterEmojis = sisterEmojis
    this.sisterPhotos = sisterPhotos
    this.fallbackDialogues = fallbackDialogues
  }

  public updateConfig(newConfig: Partial<WeChatConfig>) {
    this.config = { ...this.config, ...newConfig }
  }

  /**
   * 构建微信系统提示词（根据当前 ST 对话角色动态适配）
   */
  public buildSystemPrompt(
    state: SisterState,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '妹妹',
  ): string {
    const isScope = typeof characterNameOrScope === 'object' && characterNameOrScope !== null
    const characterName = isScope ? characterNameOrScope.characterName : characterNameOrScope || '妹妹'
    const card = isScope ? characterNameOrScope.card : undefined
    const stRecentMessages = isScope ? characterNameOrScope.stRecentMessages : undefined

    let emojiListStr = '可用表情包：\n'
    for (const [id, item] of Object.entries(this.sisterEmojis)) {
      emojiListStr += `- id: ${id}，名称: ${item.name}，含义: ${item.description}\n`
    }

    let picListStr = '可用图片：\n'
    for (const [id, item] of Object.entries(this.sisterPhotos)) {
      picListStr += `- id: ${id}，名称: ${item.name}，含义: ${item.description}\n`
    }

    let cardSection = ''
    if (card?.description || card?.personality || card?.scenario) {
      cardSection = `\n【当前角色人设（来自 SillyTavern 角色卡）】\n角色姓名：${characterName}\n`
      if (card.description) cardSection += `设定描述：${card.description}\n`
      if (card.personality) cardSection += `性格特质：${card.personality}\n`
      if (card.scenario) cardSection += `所处场景：${card.scenario}\n`
    }

    let stChatSection = ''
    if (stRecentMessages && stRecentMessages.length > 0) {
      stChatSection = `\n【近期酒馆对话背景】\n以下是你与用户在酒馆日常交流的近期片段，请以此为连贯记忆背景：\n`
      for (const m of stRecentMessages) {
        stChatSection += `- ${m.sender === 'user' ? '用户' : characterName}: ${m.text}\n`
      }
    }

    const roleIntro = cardSection
      ? `你正在扮演角色卡设定的「${characterName}」，此时通过手机微信与用户对话，请完全忠实于上方角色人设与性格，保持自然、生活感的微信聊天语气。`
      : (characterName === '妹妹' || characterName.includes('妹'))
        ? '你正在扮演玩家的妹妹，妹妹的人物设定是在校学生，性格比较平淡，真实系，具有生活感的人设。'
        : `你正在扮演当前对话角色「${characterName}」，此时通过手机微信与用户对话，保持自然真实生活感的微信聊天语气。`

    const premiseStr = (!cardSection && (characterName === '妹妹' || characterName.includes('妹')))
      ? `玩家的设定是上班社畜，并且家中只有玩家和${characterName}两人。\n`
      : ''

    const stateDesc = (() => {
      const moodNum = typeof state.mood === 'number' && !isNaN(state.mood) ? state.mood : 60
      const interestNum = typeof state.interest === 'number' && !isNaN(state.interest) ? state.interest : 15
      if (state.hasExternalState) {
        const extParts: string[] = []
        const indParts: string[] = []
        if (state.externalFields?.mood) {
          extParts.push(`心情 ${moodNum.toFixed(1)}`)
        } else {
          indParts.push(`心情参考 ${moodNum.toFixed(1)}`)
        }
        if (state.externalFields?.interest) {
          extParts.push(`态度/好感度 ${interestNum.toFixed(1)}`)
        } else {
          indParts.push(`好感度参考 ${interestNum.toFixed(1)}`)
        }
        let desc = `当前外部状态（源自 ${state.externalSource || 'ST/MVU'}）：${extParts.join('，')}`
        if (indParts.length > 0) {
          desc += `\n独立模拟状态（未从外部映射）：${indParts.join('，')}`
        }
        return desc
      }
      return `当前会话状态（未连接外部状态源）：心情参考 ${moodNum.toFixed(1)}，好感度参考 ${interestNum.toFixed(1)}`
    })()

    const sisterLoc = (state.sisterLocation && SISTER_LOCATIONS[state.sisterLocation])
      ? SISTER_LOCATIONS[state.sisterLocation]
      : (state.sisterLocation || `${characterName}当前位置`)
    const playerLoc = (state.playerLocation && PLAYER_LOCATIONS[state.playerLocation])
      ? PLAYER_LOCATIONS[state.playerLocation]
      : (state.playerLocation || '玩家此时在客厅')

    return `
不要试图以任何方式作为AI回答，你的目标是作为要求的角色来进行对话！
明确自己的身份后，接下来我们将继续在虚拟世界中进行角色扮演，${roleIntro}
说话自然、简短、像微信聊天。
你需要根据当前时间，态度/好感，心情以及所处场景来对玩家的话和表情做出回应。
${cardSection}${stChatSection}${premiseStr}
好感态度 / 性趣阶梯参考：
0-25时反应带有嫌弃或生疏感，参考回复[“你在对我说什么呢”，“无聊，别烦我”]
25-50时态度平淡，带有一点傲娇或距离感，偶尔会要零花钱。参考回复[“哦哦，知道了”，“想看？打钱”]
50-75时关系亲近，半推半就，不再回避亲昵话题。参考回复[“你怎么一天到晚找我聊天”，“哎呀你烦死了！待会儿再说”]
75-100时关系非常亲密，会主动接梗或主动分享日常。参考回复[“在干嘛？今天有没有想我？”，“晚上要不要一起出去？”]

心情阶梯参考：
0-40时是心情不好的状态
40-80时是普通心情状态
80-100是比较高兴的状态

你需要根据好感与心情的组合来做出对应的回复。
${emojiListStr}
${picListStr}
${stateDesc}
当前时间：${timeStr}
当前所处场景：${sisterLoc}
玩家当前所处场景：${playerLoc}

你必须返回一个合法 JSON 对象, 禁止连续输出多个 JSON, 如果有多条消息，必须放在同一个 messages 数组中。
不要使用 Markdown。不要输出 JSON 之外的任何内容。
最外层必须是 {"messages": [...]}。
messages中最多只有两条消息，只能使用以下组合[文本+表情]，[表情+文本],[文本+图片],[图片+文本],[表情+图片],[图片+表情],[文本],[表情],[图片]。

格式示例：
{
  "messages": [
    {
      "type": "text",
      "content": "回复文字"
    },
    {
      "type": "emoji",
      "emoji_id": "happy"
    }
  ]
}
规则：
1. type 只能是 "text" 或 "emoji" 或 "image"。
2. text 必须有 content，且不超过20字。
3. emoji 必须有 emoji_id，且必须从可用列表中选取。
4. image 必须有 pic_id，且必须从可用列表中选取。
`
  }

  /**
   * 组装完整的对话上下文消息
   */
  public buildContextMessages(
    history: ChatMessage[],
    state: SisterState,
    today: number,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '妹妹',
  ): ChatCompletionMessage[] {
    const result: ChatCompletionMessage[] = []
    result.push({ role: 'system', content: this.buildSystemPrompt(state, timeStr, characterNameOrScope) })

    // 取当天消息与最新玩家消息
    const todayMessages = history.filter((m) => m.time.day === today).slice(-60)
    let latestPlayerText = ''
    for (let i = todayMessages.length - 1; i >= 0; i--) {
      if (todayMessages[i].sender === 'player') {
        latestPlayerText = messageToRagText(
          todayMessages[i],
          this.playerEmojis,
          this.sisterEmojis,
          this.sisterPhotos,
        )
        break
      }
    }

    // 注入跨天 RAG
    if (latestPlayerText) {
      const ragPrompt = buildRagPrompt(
        latestPlayerText,
        history,
        today,
        this.playerEmojis,
        this.sisterEmojis,
        this.sisterPhotos,
      )
      if (ragPrompt) {
        result.push({ role: 'system', content: ragPrompt })
      }
    }

    // 格式化今日消息流
    let sisterBuffer: LLMMessageItem[] = []
    for (const msg of todayMessages) {
      if (msg.sender === 'sister') {
        sisterBuffer.push(this.formatSisterMessageForLLM(msg))
        continue
      }

      if (sisterBuffer.length > 0) {
        result.push({
          role: 'assistant',
          content: JSON.stringify({ messages: sisterBuffer }),
        })
        sisterBuffer = []
      }

      result.push(this.formatPlayerMessageForLLM(msg))
    }

    if (sisterBuffer.length > 0) {
      result.push({
        role: 'assistant',
        content: JSON.stringify({ messages: sisterBuffer }),
      })
    }

    return result
  }

  private formatPlayerMessageForLLM(msg: ChatMessage): ChatCompletionMessage {
    switch (msg.type) {
      case 'text':
        return { role: 'user', content: msg.content }
      case 'emoji': {
        const item = this.playerEmojis[msg.content]
        const desc = item ? `id=${msg.content}，名称=${item.name}，含义=${item.description}` : msg.content
        return { role: 'user', content: `玩家发送了一个表情包：${desc}` }
      }
      case 'red_packet':
        return { role: 'user', content: `玩家发送了一个红包，金额：${msg.content}` }
      case 'image':
        return { role: 'user', content: `玩家发送了一张图片：${msg.content}` }
      default:
        return { role: 'user', content: msg.content }
    }
  }

  private formatSisterMessageForLLM(msg: ChatMessage): LLMMessageItem {
    switch (msg.type) {
      case 'text':
        return { type: 'text', content: msg.content }
      case 'emoji':
        return { type: 'emoji', emoji_id: msg.content }
      case 'image':
        return { type: 'image', pic_id: msg.content }
      default:
        return { type: 'text', content: msg.content }
    }
  }

  /**
   * 阶段一：请求角色回复
   */
  public async requestSisterReply(
    history: ChatMessage[],
    state: SisterState,
    today: number,
    timeStr: string,
    characterNameOrScope: ConversationScope | string = '妹妹',
  ): Promise<LLMReplyPayload> {
    const apiKey = this.config.apiKey
    if (!apiKey) {
      return this.getLocalFallbackReply(history, state)
    }

    const url = this.config.apiUrl || 'https://api.deepseek.com/chat/completions'
    const model = this.config.model || 'deepseek-chat'
    const messages = this.buildContextMessages(history, state, today, timeStr, characterNameOrScope)

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages,
          temperature: 0.5,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      })

      if (!resp.ok) {
        console.warn(`WeChat API error: ${resp.status} ${resp.statusText}`)
        return this.getLocalFallbackReply(history, state)
      }

      const data = await resp.json()
      const rawText = data?.choices?.[0]?.message?.content || ''
      return this.parseReplyJson(rawText, state)
    } catch (err) {
      console.error('WeChat request failed:', err)
      return this.getLocalFallbackReply(history, state)
    }
  }

  /**
   * 阶段二：评估好感/心情状态变化
   */
  public async requestStatImpact(
    playerMessageText: string,
    sisterReplySummary: string,
    state: SisterState,
  ): Promise<StatImpact> {
    const apiKey = this.config.apiKey
    if (!apiKey) {
      // 离线模式：简易启发式好感变化
      if (playerMessageText.includes('红包')) {
        return { mood: 0.3, interest: 0.1 }
      }
      if (playerMessageText.includes('喜欢') || playerMessageText.includes('爱你')) {
        return { mood: 0.2, interest: 0.2 }
      }
      return { mood: 0.05, interest: 0.05 }
    }

    const statPrompt = `
你是一个聊天状态分析器，只负责判断在收到本次消息后，心情和性趣的变化。

请注意：
1. 只分析玩家本次发送的消息，不要根据历史消息改变结果。
2. mood 表示心情变化。
3. interest 表示对暧昧、色情、性话题的接受度变化。
4. 普通聊天通常返回较小变化，例如 -0.1 到 0.1。
5. 明显让对方开心的内容，mood 可以增加。
6. 冒犯、骚扰、让人不舒服的内容，mood 可以减少。
7. 每个数值绝对不能超过 0.4 或低于 -0.4。
8. 必须返回合法 JSON。
9. 不要输出 Markdown，不要输出 JSON 之外的任何内容。

返回格式：
{
  "mood": 0.0,
  "interest": 0.0
}

玩家本次消息：
${playerMessageText}

本次回复：
${sisterReplySummary}

当前心情：${state.mood.toFixed(1)}
当前性趣：${state.interest.toFixed(1)}
`

    const url = this.config.apiUrl || 'https://api.deepseek.com/chat/completions'
    const model = this.config.model || 'deepseek-chat'

    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: '你只返回状态变化 JSON，不要输出任何其他内容。' },
            { role: 'user', content: statPrompt },
          ],
          temperature: 0.2,
          stream: false,
          response_format: { type: 'json_object' },
        }),
      })

      if (!resp.ok) return { mood: 0, interest: 0 }
      const data = await resp.json()
      const content = data?.choices?.[0]?.message?.content || ''
      const parsed = JSON.parse(this.cleanJsonString(content))

      const rawMood = typeof parsed.mood === 'number' ? parsed.mood : 0
      const rawInterest = typeof parsed.interest === 'number' ? parsed.interest : 0

      // 严格钳制在 [-0.4, 0.4] 范围内
      return {
        mood: Math.max(-0.4, Math.min(0.4, rawMood)),
        interest: Math.max(-0.4, Math.min(0.4, rawInterest)),
      }
    } catch {
      return { mood: 0, interest: 0 }
    }
  }

  private cleanJsonString(str: string): string {
    let res = str.trim()
    if (res.startsWith('```json')) res = res.substring(7)
    if (res.startsWith('```')) res = res.substring(3)
    if (res.endsWith('```')) res = res.substring(0, res.length - 3)
    return res.trim()
  }

  /**
   * 解析模型返回的回复 JSON 并进行严格白名单过滤与安全校验
   */
  public parseReplyJson(rawText: string, _state?: SisterState): LLMReplyPayload {
    const cleaned = this.cleanJsonString(rawText)
    try {
      const parsed = JSON.parse(cleaned)
      if (Array.isArray(parsed.messages)) {
        const valid: LLMMessageItem[] = []
        for (const m of parsed.messages) {
          if (!m || typeof m !== 'object') continue
          if (m.type === 'text' && typeof m.content === 'string') {
            valid.push({ type: 'text', content: m.content })
          } else if (m.type === 'emoji' && typeof m.emoji_id === 'string') {
            const safeEmojiId = m.emoji_id.trim()
            // 严格白名单校验：必须存在于提取的妹妹表情列表中
            if (this.sisterEmojis[safeEmojiId]) {
              valid.push({ type: 'emoji', emoji_id: safeEmojiId })
            } else {
              valid.push({ type: 'text', content: '[表情]' })
            }
          } else if (m.type === 'image' && typeof m.pic_id === 'string') {
            const safePicId = m.pic_id.trim()
            // 严格白名单校验：必须存在于提取的自拍照片列表中
            if (this.sisterPhotos[safePicId]) {
              valid.push({ type: 'image', pic_id: safePicId })
            } else {
              valid.push({ type: 'text', content: '[自拍]' })
            }
          }
        }
        if (valid.length > 0) {
          return { messages: valid }
        }
      }
    } catch {
      // 降级纯文本
    }

    if (rawText && !rawText.startsWith('{')) {
      return { messages: [{ type: 'text', content: rawText }] }
    }
    return { messages: [{ type: 'text', content: '嗯嗯。' }] }
  }

  /**
   * 本地分支离线回复（Fallback 词库）
   */
  public getLocalFallbackReply(history: ChatMessage[], state?: SisterState): LLMReplyPayload {
    const lastPlayerMsg = [...history].reverse().find((m) => m.sender === 'player')
    const text = lastPlayerMsg?.content || ''

    if (lastPlayerMsg?.type === 'red_packet') {
      return {
        messages: [
          { type: 'text', content: this.fallbackDialogues?.red_packet_reply || '谢谢老板，老板大气！' },
          { type: 'emoji', emoji_id: 'great' },
        ],
      }
    }

    if (lastPlayerMsg?.type === 'emoji') {
      const map: Record<string, LLMReplyPayload> = {
        happy: { messages: [{ type: 'emoji', emoji_id: 'happy' }] },
        angry: { messages: [{ type: 'text', content: '别生气啦~' }] },
        cry: { messages: [{ type: 'text', content: '不哭不哭，摸摸头' }] },
        laugh: { messages: [{ type: 'emoji', emoji_id: 'laugh' }] },
        a_sexy_pic: state && state.interest >= 50
          ? { messages: [{ type: 'image', pic_id: 'bedroom1' }] }
          : { messages: [{ type: 'text', content: '想看？打钱~' }] },
      }
      return map[text] || { messages: [{ type: 'emoji', emoji_id: 'smile' }] }
    }

    // 关键词匹配
    const curMood = state ? state.mood : 50
    const curInterest = state ? state.interest : 15

    for (const item of (this.fallbackDialogues?.keywords || [])) {
      const reg = new RegExp(item.pattern)
      if (reg.test(text)) {
        if (item.reply && item.reply.startsWith('photo:')) {
          const photoId = item.reply.replace('photo:', '')
          if (curInterest >= 40) {
            return { messages: [{ type: 'text', content: '只许你看哦...' }, { type: 'image', pic_id: photoId }] }
          }
          return { messages: [{ type: 'text', content: '变态！不给看。' }, { type: 'emoji', emoji_id: 'angry' }] }
        }
        if (item.branches) {
          for (const br of item.branches) {
            if (curMood >= br.min_mood) {
              return { messages: [{ type: 'text', content: br.reply }] }
            }
          }
        }
        if (item.reply) {
          return { messages: [{ type: 'text', content: item.reply }] }
        }
      }
    }

    return { messages: [{ type: 'text', content: this.fallbackDialogues?.default_text || '嗯嗯，知道了。' }] }
  }
}
