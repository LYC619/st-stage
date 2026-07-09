'use client'

/**
 * Web 端手机壳挂载：把平台无关的 createPhoneShell（原生 DOM）挂进 Next 页面，
 * 与 ST 端共用同一套壳与样式，验证手机框架全链路。
 * 内置 App 的 Web 版：立绘（预览）、设置（开关）。图库入口指向右侧配置面板。
 */

import { useEffect, useRef } from 'react'
import type { PluginSettings, PhoneState } from '@/core/types'
import { DEFAULT_IMAGE_HOST } from '@/core/types'
import { PhoneAppRegistry, type PhoneApp, type PhoneAppContext } from '@/core/phone-registry'
import { createPhoneShell, type PhoneShellController } from '@/core/phone-shell'
import { getActivePack } from '@/core/sprite-store'

interface PhoneMountProps {
  settings: PluginSettings
  characterName: string
  onSettingsChange: (next: PluginSettings) => void
  /** 立绘 App 点缩略图时预览表情 */
  onPreviewSprite: (url: string, tag: string) => void
}

export function PhoneMount({ settings, characterName, onSettingsChange, onPreviewSprite }: PhoneMountProps) {
  const shellRef = useRef<PhoneShellController | null>(null)
  // React 状态进 ref，让原生 DOM 回调永远读到最新值
  const latest = useRef({ settings, characterName, onSettingsChange, onPreviewSprite })
  latest.current = { settings, characterName, onSettingsChange, onPreviewSprite }

  useEffect(() => {
    const registry = new PhoneAppRegistry()

    const createAppContext = (appId: string, goHome: () => void): PhoneAppContext => ({
      getSettings: () => latest.current.settings,
      updateSettings: (next) => latest.current.onSettingsChange(next),
      getCharacterName: () => latest.current.characterName,
      getAppData: <T,>() => latest.current.settings.apps[appId] as T | undefined,
      setAppData: <T,>(data: T) =>
        latest.current.onSettingsChange({
          ...latest.current.settings,
          apps: { ...latest.current.settings.apps, [appId]: data },
        }),
      goHome,
    })

    const shell = createPhoneShell(latest.current.settings.phone, {
      registry,
      createAppContext,
      onStateChange: (state: PhoneState) =>
        latest.current.onSettingsChange({ ...latest.current.settings, phone: state }),
    })
    shellRef.current = shell
    shell.setVisible(latest.current.settings.showPhone)

    for (const app of createWebApps(() => latest.current)) registry.register(app)

    return () => {
      shell.destroy()
      shellRef.current = null
    }
    // 仅挂载一次；设置变化经 latest ref 透传，不需要依赖
  }, [])

  // phone.open 状态被外部改变时同步壳
  useEffect(() => {
    shellRef.current?.setState(settings.phone)
  }, [settings.phone])

  // 显示手机框开关（功能④）：即时显隐，不重建壳
  useEffect(() => {
    shellRef.current?.setVisible(settings.showPhone)
  }, [settings.showPhone])

  return null
}

function createWebApps(
  getLatest: () => {
    settings: PluginSettings
    characterName: string
    onSettingsChange: (next: PluginSettings) => void
    onPreviewSprite: (url: string, tag: string) => void
  },
): PhoneApp[] {
  const spritesApp: PhoneApp = {
    id: 'sprites',
    name: '立绘',
    icon: '🎭',
    order: 1,
    mount(container, ctx) {
      const { characterName, onPreviewSprite } = getLatest()
      const settings = ctx.getSettings()
      const pack = getActivePack(settings, characterName)

      const info = section()
      info.append(
        title(characterName ? `当前角色：${characterName}` : '尚未设置角色'),
        desc(
          pack
            ? `已绑定「${pack.name}」（${pack.sprites.length} 个表情）`
            : '未绑定立绘包 — 在右侧配置面板绑定',
        ),
      )
      container.append(info)

      if (pack && pack.sprites.length > 0) {
        const strip = document.createElement('div')
        strip.className = 'so-app-sprite-strip'
        for (const sprite of pack.sprites) {
          const img = document.createElement('img')
          img.src = sprite.url
          img.alt = sprite.tag
          img.title = `点击预览「${sprite.tag}」`
          img.loading = 'lazy'
          img.addEventListener('click', () => onPreviewSprite(sprite.url, sprite.tag))
          strip.append(img)
        }
        container.append(strip, desc('点缩略图可直接预览表情。'))
      }
    },
  }

  const settingsApp: PhoneApp = {
    id: 'settings',
    name: '设置',
    icon: '⚙️',
    order: 90,
    mount(container, ctx) {
      const settings = ctx.getSettings()
      const sec = section()
      sec.append(
        toggle('启用立绘悬浮窗', settings.enabled, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), enabled: v }),
        ),
        toggle('隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v }),
        ),
        toggle('渲染消息内插图', settings.renderInlineImages, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v }),
        ),
      )

      const hostSec = section()
      const input = document.createElement('input')
      input.type = 'text'
      input.className = 'so-app-input'
      input.value = settings.imageHost
      input.placeholder = DEFAULT_IMAGE_HOST
      input.addEventListener('blur', () => {
        const raw = input.value.trim() || DEFAULT_IMAGE_HOST
        const value = /^https?:\/\/.+/.test(raw) ? (raw.endsWith('/') ? raw : `${raw}/`) : DEFAULT_IMAGE_HOST
        input.value = value
        ctx.updateSettings({ ...ctx.getSettings(), imageHost: value })
      })
      hostSec.append(title('图床前缀'), input)

      container.append(sec, hostSec)
    },
  }

  return [spritesApp, settingsApp]
}

/* ---- 小构件（原生 DOM，类名与 ST 端共用样式） ---- */

function section(): HTMLElement {
  const n = document.createElement('div')
  n.className = 'so-app-section'
  return n
}

function title(text: string): HTMLElement {
  const n = document.createElement('div')
  n.className = 'so-app-title'
  n.textContent = text
  return n
}

function desc(text: string): HTMLElement {
  const n = document.createElement('div')
  n.className = 'so-app-desc'
  n.textContent = text
  return n
}

function toggle(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = document.createElement('label')
  row.className = 'so-app-toggle'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  row.append(input, span)
  return row
}
