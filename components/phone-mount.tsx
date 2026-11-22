'use client'

/**
 * Web 端手机壳挂载：把平台无关的 createPhoneShell（原生 DOM）与全部交互式叙事 App 挂进 Next 页面，
 * 与 ST 端共用同一套壳、主题、手势与样式，支持在网页模拟器中实机体验完整 Mini-OS 闭环。
 */

import { useEffect, useRef } from 'react'
import type { PluginSettings, PhoneState } from '@/core/types'
import { DEFAULT_IMAGE_HOST, getPackCover } from '@/core/types'
import {
  PhoneAppRegistry,
  createPhoneAppContext,
  runAppSetup,
  type AppHostDeps,
  type PhoneApp,
  type ToastKind,
} from '@/core/phone-registry'
import { createCapabilityTracker } from '@/core/capabilities'
import { openAppModal } from '@/core/app-modal'
import { webAppEvents } from '@/lib/web-app-events'
import { installWebStorySandbox, createInitialTheaterSeed } from '@/lib/web-story-sandbox'
import { createPhoneShell, type PhoneShellController, type PhoneWorldWidget } from '@/core/phone-shell'
import { getActivePacks } from '@/core/sprite-store'
import { createWeChatApp } from '@/st-extension/src/apps/wechat/wechat-app'
import { createTheaterApp } from '@/st-extension/src/apps/theater/theater-app'
import { createStoryStateApp } from '@/st-extension/src/apps/story-state/story-state-app'
import { createChronicleApp } from '@/st-extension/src/apps/chronicle/chronicle-app'
import { createAppearanceApp } from '@/st-extension/src/apps/appearance/appearance-app'
import { readAppearance, resolveEffectiveAppearance } from '@/st-extension/src/apps/appearance/pack'
import { formatTime, readStoryState } from '@/st-extension/src/apps/story-state/store'
import { readCalendar, weatherIcon } from '@/st-extension/src/apps/chronicle/calendar'
import { formatStoryDate, storyToday } from '@/st-extension/src/apps/shared/story-date'
import {
  consumeAppDeepLink,
  getAppBadge,
  onOpenAppRequest,
  onStoryEvent,
} from '@/st-extension/src/apps/shared/story-events'
import { buildRoleSummary } from '@/st-extension/src/role-summary'

interface PhoneMountProps {
  settings: PluginSettings
  characterName: string
  onSettingsChange: (next: PluginSettings) => void
  onPreviewSprite?: (url: string, tag: string) => void
}

export function PhoneMount({ settings, characterName, onSettingsChange, onPreviewSprite }: PhoneMountProps) {
  const shellRef = useRef<PhoneShellController | null>(null)
  const latest = useRef({ settings, characterName, onSettingsChange, onPreviewSprite })
  latest.current = { settings, characterName, onSettingsChange, onPreviewSprite }

  useEffect(() => {
    const sandbox = installWebStorySandbox(() => latest.current.characterName)
    const registry = new PhoneAppRegistry()

    // 若模拟器首次启动尚无小剧场演示数据，注入一份鲜活的酒馆初雪样例
    if (!latest.current.settings.apps.theater) {
      latest.current.settings = {
        ...latest.current.settings,
        apps: {
          ...latest.current.settings.apps,
          theater: createInitialTheaterSeed(latest.current.characterName || '小雪'),
        },
      }
    }

    const capabilityDeps = {
      onMessageReceived: (h: (text: string) => void) =>
        webAppEvents.message.subscribe((text) => {
          sandbox.pushAiMessage(text)
          h(text)
        }),
      onCharacterChanged: (h: () => void) => webAppEvents.character.subscribe(() => h()),
      injectPrompt: () => {},
      toast: (kind: ToastKind, message: string) => {
        if (kind === 'error' || kind === 'warning') {
          shellRef.current?.notifyPill({ icon: '⚠️', text: message })
        }
        console.info(`[toast:${kind}] ${message}`)
      },
    }

    const hostDeps = (appId: string): AppHostDeps => ({
      appId,
      getSettings: () => latest.current.settings,
      saveSettingsOnly: (next) => {
        latest.current.settings = next
        latest.current.onSettingsChange(next)
      },
      getCharacterName: () => latest.current.characterName,
      getChatContext: () => ({
        characterId: 0,
        chatId: 'sim-chat-1',
        characterName: latest.current.characterName,
      }),
      ...capabilityDeps,
    })

    const createAppContext = (appId: string, goHome: () => void) =>
      createPhoneAppContext({
        ...hostDeps(appId),
        updateSettings: (next) => {
          latest.current.settings = next
          latest.current.onSettingsChange(next)
          shellRef.current?.refreshApp(appId)
        },
        goHome,
        openModal: (id, build) => {
          openAppModal(build, {
            onOpen: () =>
              latest.current.onSettingsChange({
                ...latest.current.settings,
                phone: { ...latest.current.settings.phone, open: false },
              }),
            onClose: () => shellRef.current?.openApp(id),
          })
        },
      })

    const readWidget = async (): Promise<PhoneWorldWidget | null> => {
      const charName = latest.current.characterName
      const packs = getActivePacks(latest.current.settings, charName)
      const avatarUrl = packs[0] ? getPackCover(packs[0])?.url : undefined
      try {
        const dummyHost = {
          ...hostDeps('story-state'),
          apiVersion: 2,
          getAppData: () => latest.current.settings.apps['story-state'] as never,
          setAppData: () => {},
          injectPrompt: () => {},
        }
        const snap = await readStoryState(dummyHost)
        const today = await storyToday(dummyHost)
        const cal = readCalendar()
        const todayEntry = today ? cal.days.find(d => d.date === formatStoryDate(today)) : undefined
        const activeQuest = snap.state.任务.find(q => q.状态 === '进行中')
        return {
          characterName: charName,
          avatarUrl,
          dateText: formatTime(snap.state.时间) === '尚未记录' ? undefined : formatTime(snap.state.时间),
          weatherText: todayEntry?.weather ? `${weatherIcon(todayEntry.weather)} ${todayEntry.weather}` : undefined,
          locationText: [snap.state.位置.区域, snap.state.位置.地点].filter(Boolean).join(' · ') || undefined,
          eventText: todayEntry?.event ? `今日风物：${todayEntry.event}` : undefined,
          questText: activeQuest ? `当前委托：${activeQuest.标题}` : undefined,
        }
      } catch {
        return { characterName: charName, avatarUrl }
      }
    }

    const shell = createPhoneShell(latest.current.settings.phone, {
      registry,
      createAppContext,
      getHomeSummary: () => buildRoleSummary(latest.current.settings, latest.current.characterName, '白鸥港·初雪夜话', 'preview'),
      readWorldWidget: readWidget,
      onStateChange: (state: PhoneState) =>
        latest.current.onSettingsChange({ ...latest.current.settings, phone: state }),
    })
    shellRef.current = shell
    shell.setAppearance(resolveEffectiveAppearance(readAppearance(latest.current.settings.apps.appearance), latest.current.characterName))
    shell.setVisible(latest.current.settings.showPhone)

    const hostTracker = createCapabilityTracker()
    const apps = createWebApps(
      () => latest.current,
      () => registry.list(),
      (look) => shell.setAppearance(resolveEffectiveAppearance(look, latest.current.characterName)),
    )
    for (const app of apps) {
      registry.register(app)
      runAppSetup(app, hostDeps(app.id), hostTracker)
    }

    const offOpenReq = onOpenAppRequest((link) => {
      if (registry.get(link.appId)) {
        shell.openApp(link.appId)
      } else {
        consumeAppDeepLink(link.appId)
      }
    })

    const syncAllBadges = () => {
      const next: Record<string, number> = {}
      for (const app of registry.list()) {
        const c = getAppBadge(app.id)
        if (c > 0) next[app.id] = c
      }
      shell.setBadges(next)
    }

    const offStoryEv = onStoryEvent((ev) => {
      if (ev.type === 'badge-changed') {
        syncAllBadges()
        return
      }
      shell.refreshHome()
      if (ev.type === 'theater-updated') {
        shell.notifyPill({ icon: '🎪', text: ev.summary, appId: 'theater' })
      } else if (ev.type === 'story-state-updated' && ev.summary) {
        shell.notifyPill({ icon: '🎒', text: ev.summary, appId: 'story-state' })
      } else if (ev.type === 'chronicle-updated' && ev.summary) {
        shell.notifyPill({ icon: '📜', text: `新纪要：${ev.summary}`, appId: 'chronicle' })
      } else if (ev.type === 'calendar-updated' && ev.summary) {
        shell.notifyPill({ icon: '📅', text: ev.summary, appId: 'chronicle' })
      }
    })

    return () => {
      offOpenReq()
      offStoryEv()
      hostTracker.dispose()
      shell.destroy()
      sandbox.dispose()
      shellRef.current = null
    }
  }, [])

  useEffect(() => {
    shellRef.current?.setState(settings.phone)
  }, [settings.phone])

  useEffect(() => {
    shellRef.current?.setAppearance(resolveEffectiveAppearance(readAppearance(settings.apps.appearance), characterName))
    shellRef.current?.refreshHome()
  }, [settings, characterName])

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
    onPreviewSprite?: (url: string, tag: string) => void
  },
  listApps: () => PhoneApp[],
  applyAppearance: (look: ReturnType<typeof readAppearance>) => void,
): PhoneApp[] {
  const spritesApp: PhoneApp = {
    id: 'sprites',
    name: '立绘',
    icon: '🎭',
    order: 1,
    mount(container, ctx) {
      let selectedTag = ''
      const render = () => {
        container.replaceChildren()
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

        if (packs[0] && packs[0].sprites.length > 0) {
          const sprites = packs.flatMap(p => p.sprites)
          const active = sprites.find(s => s.tag === selectedTag) ?? sprites[0]
          const stage = document.createElement('div')
          stage.className = 'so-sprite-stage'
          const main = document.createElement('div')
          main.className = 'so-sprite-stage-main'
          const prev = document.createElement('div')
          prev.className = 'so-sprite-stage-preview'
          const img = document.createElement('img')
          img.src = active.url
          img.alt = active.tag
          prev.append(img)
          const chips = document.createElement('div')
          chips.className = 'so-sprite-chips'
          for (const sp of sprites.slice(0, 12)) {
            const chip = document.createElement('button')
            chip.type = 'button'
            chip.className = `so-sprite-chip${sp.tag === active.tag ? ' is-active' : ''}`
            chip.textContent = sp.tag
            chip.onclick = () => {
              selectedTag = sp.tag
              onPreviewSprite?.(sp.url, sp.tag)
              render()
            }
            chips.append(chip)
          }
          main.append(prev, chips)
          stage.append(main)
          info.append(stage)
        }
        container.append(info)

        // 保留「启用立绘悬浮窗」精确标签以兼容移动端 E2E 回归用例
        const settingsSec = section()
        settingsSec.append(
          title('显示与标签设置'),
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
      }
      render()
    },
  }

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
      list.append(desc('新建 / 上传 / 导入导出 / 分享串 / 角色绑定：可在右侧配置面板直接操作。'))
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

  return [
    spritesApp,
    galleryApp,
    createWeChatApp(),
    createTheaterApp(),
    createStoryStateApp(),
    createChronicleApp(),
    createAppearanceApp({
      applyAppearance,
      saveImage: async (dataUri) => dataUri,
      listApps,
    }),
  ]
}

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
