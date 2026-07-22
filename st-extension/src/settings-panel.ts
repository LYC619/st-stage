/**
 * ST 扩展设置面板（原生 DOM，挂载到 #extensions_settings）。
 * 只保留两项：启用立绘功能（总开关）、显示手机。
 * 其余设置全部在手机 App 内：「立绘」App 管显示/轮播/Prompt，「图库」App 管图包与图床。
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
    checkboxRow(
      '启用立绘功能',
      settings.enabled,
      (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v }),
      '总开关：注入立绘清单给 AI 并展示回复中的立绘。关闭后清空注入、停止解析、隐藏悬浮窗并把楼层恢复原文；手机与其他工具不受影响。',
    ),
    checkboxRow(
      '显示手机',
      settings.showPhone,
      (v) => deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
      '屏幕上显示可拖动的 📱 图标，点击展开小手机（st-stage 各功能的统一入口）。',
    ),
  )

  const hint = document.createElement('div')
  hint.className = 'so-status'
  hint.textContent =
    '立绘显示/轮播/Prompt 设置在手机「立绘」App；图包管理与图床设置在手机「图库」App。'
  content.append(hint)
}

/**
 * 悬浮说明图标：hover / 键盘聚焦 / 触屏点按（tabindex 聚焦）时经 CSS 显示 data-tip 气泡。
 * 放在 <label> 内时点击会触发 checkbox，preventDefault 拦掉。
 */
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
): HTMLElement {
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
  return row
}
