/**
 * 内置手机 App（ST 端）：
 * - sprites  立绘：聚焦立绘悬浮窗（把悬浮窗拉回视口/置顶提示）+ 当前绑定概览
 * - gallery  图库：打开立绘包管理弹窗（复用 sprite-manager）
 * - settings 设置：总开关/隐藏标签/插图渲染/图床前缀（与扩展设置面板同源字段）
 *
 * 第三方 App 参照 docs/APP-SPEC.md 用同样的结构注册。
 */

import type { PhoneApp, PhoneAppContext } from '../../core/phone-registry'
import { DEFAULT_IMAGE_HOST } from '../../core/types'
import { getActivePack } from '../../core/sprite-store'
import type { OverlayController } from './overlay-dom'
import type { ManagerController } from './sprite-manager'

export interface BuiltinAppDeps {
  overlay: OverlayController
  manager: ManagerController
}

export function createBuiltinApps(deps: BuiltinAppDeps): PhoneApp[] {
  return [spritesApp(deps), galleryApp(deps), settingsApp()]
}

/* ---------------- 立绘 App ---------------- */

function spritesApp(deps: BuiltinAppDeps): PhoneApp {
  return {
    id: 'sprites',
    name: '立绘',
    icon: '🎭',
    order: 1,
    mount(container, ctx) {
      const settings = ctx.getSettings()
      const characterName = ctx.getCharacterName()
      const pack = getActivePack(settings, characterName)

      const info = el('div', 'so-app-section')
      const title = el('div', 'so-app-title')
      title.textContent = characterName ? `当前角色：${characterName}` : '尚未打开角色聊天'
      const detail = el('div', 'so-app-desc')
      detail.textContent = pack
        ? `已绑定「${pack.name}」（${pack.sprites.length} 个表情）`
        : '未绑定立绘包 — 到「图库」App 里绑定'
      info.append(title, detail)

      const actions = el('div', 'so-app-section')
      actions.append(
        appButton('把立绘窗拉回视口', () => {
          const next = { ...ctx.getSettings(), overlay: { x: 24, y: 80, width: ctx.getSettings().overlay.width } }
          ctx.updateSettings(next)
          deps.overlay.setLayout(next.overlay)
          deps.overlay.setVisible(true)
        }),
        appButton(settings.enabled ? '关闭立绘悬浮窗' : '开启立绘悬浮窗', () => {
          ctx.updateSettings({ ...ctx.getSettings(), enabled: !ctx.getSettings().enabled })
          ctx.goHome()
        }),
      )

      container.append(info, actions)

      if (pack && pack.sprites.length > 0) {
        const grid = el('div', 'so-app-sprite-strip')
        for (const sprite of pack.sprites) {
          const img = document.createElement('img')
          img.src = sprite.url
          img.alt = sprite.tag
          img.title = `点击预览「${sprite.tag}」`
          img.loading = 'lazy'
          img.addEventListener('click', () => {
            deps.overlay.setImage(sprite.url, sprite.tag)
            deps.overlay.setVisible(true)
          })
          grid.append(img)
        }
        container.append(grid)
        const hint = el('div', 'so-app-desc')
        hint.textContent = '点缩略图可直接预览表情。'
        container.append(hint)
      }
    },
  }
}

/* ---------------- 图库 App ---------------- */

function galleryApp(deps: BuiltinAppDeps): PhoneApp {
  return {
    id: 'gallery',
    name: '图库',
    icon: '🗂',
    order: 2,
    mount(container, ctx) {
      const section = el('div', 'so-app-section')
      const desc = el('div', 'so-app-desc')
      desc.textContent = '立绘包管理：新建/上传/导入导出/分享串/角色绑定。'
      section.append(
        desc,
        appButton('打开立绘包管理', () => {
          deps.manager.open()
        }),
      )
      container.append(section)

      // 概览：包列表
      const settings = ctx.getSettings()
      const list = el('div', 'so-app-section')
      const title = el('div', 'so-app-title')
      title.textContent = `共 ${settings.packs.length} 个立绘包`
      list.append(title)
      for (const pack of settings.packs) {
        const row = el('div', 'so-app-desc')
        row.textContent = `· ${pack.name}（${pack.sprites.length} 张）`
        list.append(row)
      }
      container.append(list)
    },
  }
}

/* ---------------- 设置 App ---------------- */

function settingsApp(): PhoneApp {
  return {
    id: 'settings',
    name: '设置',
    icon: '⚙️',
    order: 90,
    mount(container, ctx) {
      const settings = ctx.getSettings()

      const section = el('div', 'so-app-section')
      section.append(
        toggleRow('启用立绘悬浮窗', settings.enabled, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), enabled: v }),
        ),
        toggleRow('隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v }),
        ),
        toggleRow('渲染消息内插图', settings.renderInlineImages, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v }),
        ),
      )

      const hostSection = el('div', 'so-app-section')
      const hostLabel = el('div', 'so-app-title')
      hostLabel.textContent = '图床前缀'
      const hostInput = document.createElement('input')
      hostInput.type = 'text'
      hostInput.className = 'text_pole so-app-input'
      hostInput.value = settings.imageHost
      hostInput.placeholder = DEFAULT_IMAGE_HOST
      hostInput.addEventListener('blur', () => {
        const raw = hostInput.value.trim() || DEFAULT_IMAGE_HOST
        const value = /^https?:\/\/.+/.test(raw)
          ? raw.endsWith('/')
            ? raw
            : `${raw}/`
          : DEFAULT_IMAGE_HOST
        hostInput.value = value
        ctx.updateSettings({ ...ctx.getSettings(), imageHost: value })
      })
      hostSection.append(hostLabel, hostInput)

      container.append(section, hostSection)
    },
  }
}

/* ---------------- 小部件 ---------------- */

function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

function appButton(label: string, onClick: () => void): HTMLElement {
  const btn = el('div', 'menu_button so-app-btn')
  btn.setAttribute('role', 'button')
  btn.tabIndex = 0
  btn.textContent = label
  btn.addEventListener('click', onClick)
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  })
  return btn
}

function toggleRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el('label', 'so-app-toggle checkbox_label')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  row.append(input, span)
  return row
}

/** 供外部构造 PhoneAppContext 时复用的类型 re-export */
export type { PhoneAppContext }
