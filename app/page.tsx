'use client'

/**
 * 立绘悬浮窗插件 · Web 测试环境
 * 全链路：prompt 注入预览 → 模拟 AI 回复 → 标签提取 → 悬浮窗切换
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { PluginSettings } from '@/core/types'
import { formatAddress } from '@/core/types'
import { extractTags } from '@/core/tag-parser'
import { buildPrompt } from '@/core/prompt-builder'
import {
  getActiveAddresses,
  getActivePacks,
  preloadPack,
  resolveSprites,
} from '@/core/sprite-store'
import { webAdapter } from '@/lib/web-adapter'
import { ChatSimulator } from '@/components/chat-simulator'
import { ConfigPanel } from '@/components/config-panel'
import { SpriteOverlay } from '@/components/sprite-overlay'
import { PhoneMount } from '@/components/phone-mount'

export default function Page() {
  const [settings, setSettings] = useState<PluginSettings | null>(null)
  const [characterName, setCharacterName] = useState('小雪')
  // 功能③：当前展示的立绘序列（单张即一个元素）
  const [sprites, setSprites] = useState<{ url: string; tag: string }[]>([])
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // 初始化：加载设置
  useEffect(() => {
    webAdapter.loadSettings().then(setSettings)
  }, [])

  // 设置变更：防抖持久化
  const updateSettings = useCallback((next: PluginSettings) => {
    setSettings(next)
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => webAdapter.saveSettings(next), 400)
  }, [])

  const activePacks = useMemo(
    () => (settings ? getActivePacks(settings, characterName) : []),
    [settings, characterName],
  )
  const activePack = activePacks[0] ?? null
  const addresses = useMemo(
    () => (settings ? getActiveAddresses(settings, characterName) : []),
    [settings, characterName],
  )
  const injectionPrompt = useMemo(
    () =>
      settings
        ? buildPrompt(addresses, settings.multiRolePromptMode, settings.spriteCount)
        : '',
    [settings, addresses],
  )

  // 聊天模拟器的快捷触发项：用完整三级地址（纯图名场景即图名）
  const chatChoices = useMemo(() => addresses.map(formatAddress), [addresses])

  // 角色/包切换：预加载全部立绘，重置为第一张（单张）
  useEffect(() => {
    if (!activePack || activePack.sprites.length === 0) {
      setSprites([])
      return
    }
    for (const p of activePacks) preloadPack(p)
    setSprites([{ url: activePack.sprites[0].url, tag: activePack.sprites[0].tag }])
  }, [activePack, activePacks])

  // 核心链路：收到 AI 消息 → 提取全部标签 → 多包严格匹配序列 → 悬浮窗排队展示（功能③）
  const handleAiMessage = useCallback(
    (text: string) => {
      if (!settings?.enabled || activePacks.length === 0) return
      const seq = resolveSprites(activePacks, extractTags(text))
      if (seq.length > 0) {
        setSprites(seq.map((s) => ({ url: s.url, tag: s.tag })))
      }
    },
    [settings?.enabled, activePacks],
  )

  if (!settings) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-background">
        <p className="text-sm text-muted-foreground">加载中…</p>
      </main>
    )
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-6xl flex-col gap-4 px-4 py-4">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-lg font-bold text-foreground">角色立绘悬浮窗 · 测试环境</h1>
          <p className="text-xs text-muted-foreground">
            SillyTavern 插件的网页模拟器 — 注入 → 回复 → 提取 → 悬浮窗切换
          </p>
        </div>
        <span className="rounded-full border border-border px-3 py-1 text-xs text-muted-foreground">
          ST 扩展产物见 st-extension/ 目录
        </span>
      </header>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-4 lg:grid-cols-[1fr_360px]">
        <div className="min-h-[60dvh] lg:min-h-0">
          <ChatSimulator
            characterName={characterName}
            availableTags={chatChoices}
            hideTagInMessage={settings.hideTagInMessage}
            renderInlineImages={settings.renderInlineImages}
            imageHost={settings.imageHost}
            spriteDisplayMode={settings.spriteDisplayMode}
            activePack={activePack}
            injectionPrompt={injectionPrompt}
            onAiMessage={handleAiMessage}
          />
        </div>
        <div className="min-h-0">
          <ConfigPanel
            settings={settings}
            characterName={characterName}
            onCharacterNameChange={setCharacterName}
            onSettingsChange={updateSettings}
          />
        </div>
      </div>

      <SpriteOverlay
        sprites={sprites}
        characterName={characterName}
        layout={settings.overlay}
        visible={settings.enabled && !!activePack && settings.spriteDisplayMode !== 'inline'}
        autoSwitch={settings.autoSwitch}
        autoSwitchSeconds={settings.autoSwitchSeconds}
        onLayoutChange={(overlay) => updateSettings({ ...settings, overlay })}
      />

      <PhoneMount
        settings={settings}
        characterName={characterName}
        onSettingsChange={updateSettings}
        onPreviewSprite={(url, tag) => setSprites([{ url, tag }])}
      />
    </main>
  )
}
