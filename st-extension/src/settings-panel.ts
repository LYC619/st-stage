/**
 * ST 扩展设置面板（原生 DOM，挂载到 #extensions_settings）。
 * 保留核心总开关，并为「不显示手机」的纯聊天玩家提供紧凑的快捷入口（重显立绘窗/图包/HUD/临时唤起）。
 */

import { t } from '../../core/i18n'
import type { PluginSettings } from '../../core/types'

export interface PanelDeps {
  getSettings: () => PluginSettings
  updateSettings: (next: PluginSettings) => void
  subscribe?: (listener: () => void) => () => void
  openGalleryManager?: () => void
  expandPhoneTemporarily?: () => void
}

export function mountSettingsPanel(deps: PanelDeps): () => void {
  const container = document.getElementById('extensions_settings')
  if (!container) {
    console.warn('[sprite-overlay] 未找到 #extensions_settings，设置面板未挂载')
    return () => {}
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'sprite-overlay-settings'
  wrapper.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>百工</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content" id="so-panel-content"></div>
    </div>
  `
  container.append(wrapper)

  const content = wrapper.querySelector('#so-panel-content') as HTMLElement
  const settings = deps.getSettings()

  const enableRow = checkboxRow(
    t('settings.enable_sprites', '启用立绘功能'),
    settings.enabled,
    (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v }),
    t('settings.sprites_help', '总开关：注入立绘清单给 AI 并展示回复中的立绘。关闭后清空注入、停止解析、隐藏悬浮窗并把楼层恢复原文；手机与其他工具不受影响。'),
  )
  const phoneRow = checkboxRow(
    t('settings.show_phone', '显示手机'),
    settings.showPhone,
    (v) => deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
    t('settings.phone_help', '屏幕上显示可拖动的 📱 图标，点击展开小手机——所有功能 App 的统一入口。'),
  )

  content.append(enableRow.row, phoneRow.row)

  // 无手机/纯聊天快捷条：仅在提供扩展回调时附加，兼容精简测试夹具
  let hudInput: HTMLInputElement | null = null
  let restoreOverlayBtn: HTMLButtonElement | null = null
  if (deps.openGalleryManager || deps.expandPhoneTemporarily) {
    const hudRow = checkboxRow(
      '变量与状态速查浮窗',
      settings.variableHud,
      (v) => deps.updateSettings({ ...deps.getSettings(), variableHud: v }),
      '在聊天界面放一枚轻量速查胶囊，不用展开小手机也能随时看 MVU、新变量与剧情状态。',
    )
    hudInput = hudRow.input
    content.append(hudRow.row)

    const quickRow = document.createElement('div')
    quickRow.className = 'so-row so-settings-quick'
    quickRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;margin:6px 0;'

    if (deps.openGalleryManager) {
      const galleryBtn = document.createElement('button')
      galleryBtn.type = 'button'
      galleryBtn.className = 'menu_button'
      galleryBtn.textContent = '管理图包'
      galleryBtn.addEventListener('click', () => deps.openGalleryManager?.())
      quickRow.append(galleryBtn)
    }

    restoreOverlayBtn = document.createElement('button')
    restoreOverlayBtn.type = 'button'
    restoreOverlayBtn.className = 'menu_button'
    restoreOverlayBtn.textContent = '重显立绘悬浮窗'
    restoreOverlayBtn.hidden = !settings.overlayHidden
    restoreOverlayBtn.addEventListener('click', () => {
      const cur = deps.getSettings()
      deps.updateSettings({
        ...cur,
        enabled: true,
        overlayHidden: false,
        overlay: { ...cur.overlay, x: 24, y: 80 },
      })
    })
    quickRow.append(restoreOverlayBtn)

    if (deps.expandPhoneTemporarily) {
      const openBtn = document.createElement('button')
      openBtn.type = 'button'
      openBtn.className = 'menu_button'
      openBtn.textContent = '临时打开小手机'
      openBtn.addEventListener('click', () => deps.expandPhoneTemporarily?.())
      quickRow.append(openBtn)
    }

    content.append(quickRow)
  }

  const hint = document.createElement('div')
  hint.className = 'so-status'
  const version = typeof __EXT_VERSION__ === 'undefined' ? '' : ` v${__EXT_VERSION__}`
  hint.textContent =
    t('settings.hint', '酒馆里的事，百工都做。立绘显示/轮播/Prompt 设置在手机「立绘」App；图包管理与图床设置在手机「图库」App。') + version
  content.append(hint)

  const sync = () => {
    const latest = deps.getSettings()
    enableRow.input.checked = latest.enabled
    phoneRow.input.checked = latest.showPhone
    if (hudInput) hudInput.checked = latest.variableHud
    if (restoreOverlayBtn) restoreOverlayBtn.hidden = !latest.overlayHidden
  }
  const unsubscribe = deps.subscribe?.(sync)

  return () => {
    unsubscribe?.()
    wrapper.remove()
  }
}

function helpIcon(tip: string): HTMLElement {
  const icon = document.createElement('span')
  icon.className = 'so-help'
  icon.textContent = '?'
  icon.tabIndex = 0
  icon.setAttribute('aria-label', tip)
  icon.dataset.tip = tip
  icon.addEventListener('click', (e) => {
    e.preventDefault()
    e.stopPropagation()
  })
  return icon
}

function checkboxRow(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
  help?: string,
): { row: HTMLElement; input: HTMLInputElement } {
  const row = document.createElement('label')
  row.className = 'so-row checkbox_label'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  if (help) span.append(helpIcon(help))
  row.append(input, span)
  return { row, input }
}
