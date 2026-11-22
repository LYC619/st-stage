'use client'

/**
 * 仿 SillyTavern 聊天模拟器：
 * - 用户发送消息后自动生成含 [立绘:xxx] 标签的模拟 AI 回复
 * - 也可点击标签按钮直接触发指定表情的模拟回复
 * - 支持「隐藏标签文本」渲染开关
 */

import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { replaceTags, stripTags } from '@/core/tag-parser'
import { replaceInlineImages } from '@/core/inline-image'
import { matchAddress } from '@/core/sprite-store'
import type { SpriteDisplayMode, SpritePack } from '@/core/types'

export interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  text: string
}

interface ChatSimulatorProps {
  characterName: string
  availableTags: string[]
  hideTagInMessage: boolean
  /** 渲染消息内插图（[插图:编码] / <img>编码</img>） */
  renderInlineImages: boolean
  /** 图床前缀（编码拼接用） */
  imageHost: string
  /** 立绘显示位置（四期）：inline/both 时把 [立绘:xxx] 原位渲染成图片 */
  spriteDisplayMode: SpriteDisplayMode
  /** 当前角色绑定的立绘包（楼层内渲染解析标签用），无绑定为 null */
  activePack: SpritePack | null
  injectionPrompt: string
  onAiMessage: (text: string) => void
}

/** 每个标签对应的模拟回复模板 */
const REPLY_TEMPLATES: Record<string, string[]> = {
  微笑: ['嗯，今天也请多指教哦。', '能见到你真好。'],
  害羞: ['诶……突、突然这么说，人家会不好意思的啦……', '别、别一直盯着我看……'],
  恼怒: ['哼！我可是生气了哦！', '你这家伙……又在捉弄我！'],
  惊讶: ['诶诶诶？！真的假的？！', '什么？！我没听错吧！'],
  哭泣: ['呜呜……才、才没有哭呢……', '为什么会变成这样……'],
  得意: ['哼哼，本小姐早就料到了～', '怎么样？佩服了吧？'],
  无奈: ['哈啊……真拿你没办法呢。', '好吧好吧，就依你。'],
  开心: ['哇！太棒了！！', '今天真是最开心的一天！'],
  冷淡: ['……哦。', '与我无关。'],
  温柔: ['辛苦了，先歇一会儿吧。', '没事的，有我在。'],
}

function buildSimulatedReply(tag: string): string {
  const pool = REPLY_TEMPLATES[tag] ?? ['……（凝视着你）']
  const line = pool[Math.floor(Math.random() * pool.length)]
  return `${line} [立绘:${tag}]`
}

/** AI 气泡内容：楼层内立绘 / 隐藏标签 / 插图渲染（与 ST 端 message-postprocess 同逻辑） */
function renderAiText(
  text: string,
  hideTag: boolean,
  renderImages: boolean,
  imageHost: string,
  displayMode: SpriteDisplayMode,
  pack: SpritePack | null,
): ReactNode {
  // 带序号的 NUL 占位符：两类替换先后执行也能保持文本顺序（正文不可能含 NUL）
  const images: Array<{ src: string; alt: string; sprite: boolean }> = []
  const marker = (src: string, alt: string, sprite: boolean) =>
    `\0${images.push({ src, alt, sprite }) - 1}\0`

  let processed = text
  if (displayMode !== 'overlay' && pack) {
    processed = replaceTags(processed, (address) => {
      const sprite = matchAddress(pack, address)
      if (!sprite) return hideTag ? '' : null
      return marker(sprite.url, sprite.tag, true)
    })
  } else if (hideTag) {
    processed = stripTags(processed)
  }
  if (renderImages) {
    const host = imageHost.endsWith('/') ? imageHost : `${imageHost}/`
    processed = replaceInlineImages(processed, (m) => marker(host + m.code, m.code, false))
  }

  if (images.length === 0) return processed
  return processed.split('\0').map((part, i) => {
    if (i % 2 === 0) return part || null
    const img = images[Number(part)]
    return (
      <span key={`img-${i}`} className="my-2 block text-center">
        <img
          src={img.src}
          alt={img.alt}
          loading="lazy"
          className={`inline-block max-w-[85%] rounded-lg border border-border shadow-md ${img.sprite ? 'max-h-48' : 'max-h-64'}`}
        />
      </span>
    )
  })
}

export function ChatSimulator({
  characterName,
  availableTags,
  hideTagInMessage,
  renderInlineImages,
  imageHost,
  spriteDisplayMode,
  activePack,
  injectionPrompt,
  onAiMessage,
}: ChatSimulatorProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [showInjection, setShowInjection] = useState(false)
  const nextId = useRef(1)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages])

  const pushMessage = (role: 'user' | 'ai', text: string) => {
    setMessages((prev) => [...prev, { id: nextId.current++, role, text }])
  }

  const simulateAiReply = (tag?: string) => {
    if (availableTags.length === 0) {
      pushMessage('ai', '（当前角色没有绑定立绘包，请先在右侧配置面板绑定）')
      return
    }
    const chosen = tag ?? availableTags[Math.floor(Math.random() * availableTags.length)]
    const reply = buildSimulatedReply(chosen)
    pushMessage('ai', reply)
    onAiMessage(reply)
  }

  /** 功能③ 测试：拼一条含多个 [立绘:x] 的回复，验证悬浮窗序列播放 */
  const simulateMultiReply = () => {
    if (availableTags.length === 0) {
      pushMessage('ai', '（当前角色没有绑定立绘包，请先在右侧配置面板绑定）')
      return
    }
    const shuffled = [...availableTags].sort(() => Math.random() - 0.5)
    const picks = shuffled.slice(0, Math.min(3, shuffled.length))
    const reply = picks.map((t) => `${(REPLY_TEMPLATES[t] ?? ['……'])[0]} [立绘:${t}]`).join(' ')
    pushMessage('ai', reply)
    onAiMessage(reply)
  }

  const sendUserMessage = () => {
    const text = input.trim()
    if (!text) return
    pushMessage('user', text)
    setInput('')
    // 模拟 AI 思考后回复
    setTimeout(() => simulateAiReply(), 500)
  }

  return (
    <div className="flex h-full min-h-0 flex-col rounded-xl border border-border bg-card">
      {/* 头部 */}
      <header className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
            {characterName.slice(0, 1)}
          </div>
          <div>
            <h2 className="text-sm font-semibold text-foreground">{characterName}</h2>
            <p className="text-xs text-muted-foreground">酒馆初雪夜话 · 实时联动立绘与掌上小手机</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => setShowInjection((v) => !v)}
          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          {showInjection ? '隐藏注入预览' : '查看注入 Prompt'}
        </button>
      </header>

      {/* 注入 prompt 预览 */}
      {showInjection && (
        <div className="border-b border-border bg-secondary/50 px-4 py-3">
          <p className="mb-1 text-xs font-semibold text-muted-foreground">注入的 System Prompt（ST 端经 setExtensionPrompt 注入）：</p>
          <pre className="max-h-32 overflow-auto whitespace-pre-wrap font-mono text-xs leading-relaxed text-foreground">
            {injectionPrompt || '（当前无可用标签，不注入）'}
          </pre>
        </div>
      )}

      {/* 消息流 */}
      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 && (
          <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
            <p className="text-sm text-muted-foreground">发一句话聊聊看，角色会带着表情立绘回应你，同时联动右下角小手机</p>
            <p className="text-xs text-muted-foreground">也可以点下方表情按钮，直接试试立绘切换与多图轮播</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex gap-2.5 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
            <div
              className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                msg.role === 'user' ? 'bg-accent text-accent-foreground' : 'bg-primary text-primary-foreground'
              }`}
            >
              {msg.role === 'user' ? '我' : characterName.slice(0, 1)}
            </div>
            <div
              className={`max-w-[75%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-secondary text-secondary-foreground'
              }`}
            >
              {msg.role === 'ai'
                ? renderAiText(
                    msg.text,
                    hideTagInMessage,
                    renderInlineImages,
                    imageHost,
                    spriteDisplayMode,
                    activePack,
                  )
                : msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* 快捷表情触发 */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
          <button
            type="button"
            onClick={simulateMultiReply}
            className="rounded-full border border-primary/60 px-2.5 py-1 text-xs text-foreground transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            连发3个（测多立绘）
          </button>
          {availableTags.map((tag) => (
            <button
              key={tag}
              type="button"
              onClick={() => simulateAiReply(tag)}
              className="rounded-full border border-border px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
            >
              {tag}
            </button>
          ))}
        </div>
      )}

      {/* 输入区 */}
      <div className="flex gap-2 border-t border-border px-4 py-3">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) sendUserMessage()
          }}
          placeholder="输入消息…"
          className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
          aria-label="聊天输入框"
        />
        <button
          type="button"
          onClick={sendUserMessage}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
        >
          发送
        </button>
      </div>
    </div>
  )
}
