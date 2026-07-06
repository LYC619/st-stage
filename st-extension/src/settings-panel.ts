/**
 * ST 扩展设置面板（原生 DOM，挂载到 #extensions_settings）。
 * 只保留基础设定：总开关、隐藏标签。
 * 立绘包管理与角色绑定在聊天界面的悬浮窗中进行（齿轮按钮）。
 */

import type { PluginSettings } from '../../core/types'

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
    checkboxRow('消息中隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
      deps.updateSettings({ ...deps.getSettings(), hideTagInMessage: v }),
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
