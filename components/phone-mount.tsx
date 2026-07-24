'use client'

/**
 * Web 端手机壳挂载：把平台无关的 createPhoneShell（原生 DOM）挂进 Next 页面，
 * 与 ST 端共用同一套壳与样式，验证手机框架全链路。
 * 内置 App 分工与 ST 端一致：立绘 = 立绘设置 + 预览；图库 = 图包/图床概览（管理在右侧配置面板）。
 * 不再保留旧的独立「设置」App。
 */

import { useEffect, useRef } from 'react'
import type { PluginSettings, PhoneState } from '@/core/types'
import { DEFAULT_IMAGE_HOST } from '@/core/types'
import {
  PhoneAppRegistry,
  createPhoneAppContext,
  type PhoneApp,
  type PhoneAppContext,
} from '@/core/phone-registry'
import { createPhoneShell, type PhoneShellController } from '@/core/phone-shell'
import { getActivePacks } from '@/core/sprite-store'

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

    const createAppContext = (appId: string, goHome: () => void): PhoneAppContext =>
      createPhoneAppContext({
        appId,
        getSettings: () => latest.current.settings,
        updateSettings: (next) => latest.current.onSettingsChange(next),
        // Web 端无独立立绘刷新副作用（注入预览由 page 的 useMemo 派生），仅保存路径复用同一提交
        saveSettingsOnly: (next) => latest.current.onSettingsChange(next),
        getCharacterName: () => latest.current.characterName,
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
  // 立绘 App：当前角色多包概览 + 预览 + 立绘设置（与 ST 端「立绘」App 对齐）
  const spritesApp: PhoneApp = {
    id: 'sprites',
    name: '立绘',
    icon: '🎭',
    order: 1,
    mount(container, ctx) {
      const { characterName, onPreviewSprite } = getLatest()
      const settings = ctx.getSettings()
      const packs = getActivePacks(settings, characterName)
      const total = packs.reduce((n, p) => n + p.sprites.length, 0)

      const info = section()
      info.append(
        title(characterName ? `当前角色：${characterName}` : '尚未设置角色'),
        desc(
          packs.length === 0
            ? '未绑定立绘包 — 在右侧配置面板绑定'
            : packs.length > 1
              ? `已启用 ${packs.length} 个包（${total} 个表情）：${packs.map((p) => p.name).join('、')}`
              : `已绑定「${packs[0].name}」（${total} 个表情）`,
        ),
      )
      container.append(info)

      // 预览：跨全部启用包（点击回传预览）
      if (total > 0) {
        const strip = document.createElement('div')
        strip.className = 'so-app-sprite-strip'
        for (const pack of packs) {
          for (const sprite of pack.sprites) {
            const img = document.createElement('img')
            img.src = sprite.url
            img.alt = sprite.tag
            img.title = `点击预览「${sprite.tag}」`
            img.loading = 'lazy'
            img.addEventListener('click', () => onPreviewSprite(sprite.url, sprite.tag))
            strip.append(img)
          }
        }
        container.append(strip, desc('点缩略图可直接预览表情。'))
      }

      // 立绘设置
      const settingsSec = section()
      settingsSec.append(
        title('设置'),
        toggle('启用立绘悬浮窗', settings.enabled, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), enabled: v }),
        ),
        selectRow(
          '显示位置',
          settings.spriteDisplayMode,
          [
            { value: 'overlay', label: '悬浮窗' },
            { value: 'inline', label: '仅楼层' },
            { value: 'both', label: '两者' },
          ],
          (v) =>
            ctx.updateSettings({
              ...ctx.getSettings(),
              spriteDisplayMode: v === 'inline' || v === 'both' ? v : 'overlay',
            }),
        ),
        toggle('隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v }),
        ),
        toggle('渲染消息内插图', settings.renderInlineImages, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v }),
        ),
      )
      container.append(settingsSec)
    },
  }

  // 图库 App：图包/图床概览（新建/上传/导入导出/分享在右侧配置面板）
  const galleryApp: PhoneApp = {
    id: 'gallery',
    name: '图库',
    icon: '🗂',
    order: 2,
    mount(container, ctx) {
      const settings = ctx.getSettings()

      const list = section()
      list.append(title(`共 ${settings.packs.length} 个立绘包`))
      for (const pack of settings.packs) {
        list.append(desc(`· ${pack.name}（${pack.sprites.length} 张）`))
      }
      list.append(desc('新建 / 上传 / 导入导出 / 分享串 / 角色绑定：在右侧配置面板操作。'))
      container.append(list)

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
      container.append(hostSec)
    },
  }

  return [spritesApp, galleryApp]
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

function selectRow(
  label: string,
  value: string,
  options: { value: string; label: string }[],
  onChange: (v: string) => void,
): HTMLElement {
  const row = document.createElement('label')
  row.className = 'so-app-toggle'
  const span = document.createElement('span')
  span.textContent = label
  const select = document.createElement('select')
  select.className = 'text_pole'
  for (const opt of options) {
    const o = document.createElement('option')
    o.value = opt.value
    o.textContent = opt.label
    if (opt.value === value) o.selected = true
    select.append(o)
  }
  select.addEventListener('change', () => onChange(select.value))
  row.append(span, select)
  return row
}
