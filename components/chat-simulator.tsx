'use client'

/**
 * 仿 SillyTavern 聊天模拟器：
 * - 用户发送消息后自动生成含 [立绘:xxx] 标签的模拟 AI 回复
 * - 也可点击标签按钮直接触发指定表情的模拟回复
 * - 支持「隐藏标签文本」渲染开关
 */

import { useEffect, useRef, useState } from 'react'
import { stripTags } from '@/core/tag-parser'

export interface ChatMessage {
  id: number
  role: 'user' | 'ai'
  text: string
}

interface ChatSimulatorProps {
  characterName: string
  availableTags: string[]
  hideTagInMessage: boolean
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

export function ChatSimulator({
  characterName,
  availableTags,
  hideTagInMessage,
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
            <p className="text-xs text-muted-foreground">模拟聊天 · 测试立绘链路</p>
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
            <p className="text-sm text-muted-foreground">发送一条消息，AI 将模拟带 [立绘:xxx] 标签的回复</p>
            <p className="text-xs text-muted-foreground">也可以点击下方表情按钮直接触发指定立绘</p>
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
              {msg.role === 'ai' && hideTagInMessage ? stripTags(msg.text) : msg.text}
            </div>
          </div>
        ))}
      </div>

      {/* 快捷表情触发 */}
      {availableTags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 border-t border-border px-4 py-2.5">
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
