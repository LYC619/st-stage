/**
 * ST 扩展设置面板（原生 DOM，挂载到 #extensions_settings）。
 * 基础设定：总开关、隐藏标签、消息内插图、图床前缀。
 * 立绘包管理与角色绑定在聊天界面的悬浮窗中进行（齿轮按钮）。
 */

import type { PluginSettings } from '../../core/types'
import { DEFAULT_IMAGE_HOST } from '../../core/types'

interface PanelDeps {
  getSettings: () => PluginSettings
  updateSettings: (next: PluginSettings) => void
}

export function mountSettingsPanel(deps: PanelDeps): void {
  const container = document.getElementById('extensions_settings')
  if (!container) {
    console.warn('[sprite-overlay] 未找到 #extensions_settings，设置面板未挂载')
    return
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'sprite-overlay-settings'
  wrapper.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>角色立绘悬浮窗</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content" id="so-panel-content"></div>
    </div>
  `
  container.append(wrapper)

  const content = wrapper.querySelector('#so-panel-content') as HTMLElement
  const settings = deps.getSettings()

  content.append(
    checkboxRow('启用立绘悬浮窗', settings.enabled, (v) =>
      deps.updateSettings({ ...deps.getSettings(), enabled: v }),
    ),
    checkboxRow('显示手机框（关闭则回退纯悬浮窗）', settings.showPhone, (v) =>
      deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
    ),
    checkboxRow('消息中隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
      deps.updateSettings({ ...deps.getSettings(), hideTagInMessage: v }),
    ),
    checkboxRow('渲染消息内插图（<img>编码</img>）', settings.renderInlineImages, (v) =>
      deps.updateSettings({ ...deps.getSettings(), renderInlineImages: v }),
    ),
    checkboxRow('多立绘自动轮播（一条消息含多张立绘时）', settings.autoSwitch, (v) =>
      deps.updateSettings({ ...deps.getSettings(), autoSwitch: v }),
    ),
    numberRow('轮播间隔（秒）', settings.autoSwitchSeconds, (v) =>
      deps.updateSettings({ ...deps.getSettings(), autoSwitchSeconds: v }),
    ),
    hostRow(settings.imageHost, (v) =>
      deps.updateSettings({ ...deps.getSettings(), imageHost: v }),
    ),
  )

  const hint = document.createElement('div')
  hint.className = 'so-status'
  hint.textContent = '立绘包管理与角色绑定：点击聊天界面悬浮窗右上角的 ⚙ 按钮。'
  content.append(hint)
}

function checkboxRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = document.createElement('label')
  row.className = 'so-row checkbox_label'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  row.append(input, span)
  return row
}

/** 数字输入行：失焦/回车时取整并夹到 [min,max]（用于轮播间隔秒数） */
function numberRow(
  label: string,
  value: number,
  onChange: (v: number) => void,
  min = 1,
  max = 60,
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'so-row'
  const span = document.createElement('span')
  span.textContent = label
  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'text_pole'
  input.min = String(min)
  input.max = String(max)
  input.step = '1'
  input.value = String(value)
  input.style.maxWidth = '90px'
  input.addEventListener('change', () => {
    const n = Math.round(Number(input.value))
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
    input.value = String(clamped)
    onChange(clamped)
  })
  row.append(span, input)
  return row
}

/** 图床前缀输入行：失焦时校验并保存（须为 http(s)，自动补结尾 /） */
function hostRow(value: string, onChange: (v: string) => void): HTMLElement {
  const row = document.createElement('div')
  row.className = 'so-row'
  const span = document.createElement('span')
  span.textContent = '图床前缀'
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'text_pole'
  input.value = value
  input.placeholder = DEFAULT_IMAGE_HOST
  input.addEventListener('blur', () => {
    const raw = input.value.trim() || DEFAULT_IMAGE_HOST
    if (!/^https?:\/\/.+/.test(raw)) {
      input.value = DEFAULT_IMAGE_HOST
      onChange(DEFAULT_IMAGE_HOST)
      return
    }
    const normalized = raw.endsWith('/') ? raw : `${raw}/`
    input.value = normalized
    onChange(normalized)
  })
  row.append(span, input)
  return row
}
