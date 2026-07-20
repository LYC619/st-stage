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
    checkboxRow(
      '启用立绘悬浮窗',
      settings.enabled,
      (v) => deps.updateSettings({ ...deps.getSettings(), enabled: v }),
      '总开关：把可用立绘清单注入给 AI，并根据回复中的 [立绘:xxx] 标签在悬浮窗展示对应立绘。关闭后两者都停用。',
    ),
    checkboxRow(
      '显示手机框（关闭则回退纯悬浮窗）',
      settings.showPhone,
      (v) => deps.updateSettings({ ...deps.getSettings(), showPhone: v }),
      '在屏幕上显示可拖动的 📱 图标，点击展开手机面板（立绘 / 图库 / 设置 App）。关闭后仅保留立绘悬浮窗本体。',
    ),
    checkboxRow(
      '消息中隐藏 [立绘:xxx] 标签',
      settings.hideTagInMessage,
      (v) => deps.updateSettings({ ...deps.getSettings(), hideTagInMessage: v }),
      '[立绘:xxx] 是 AI 用来切换立绘的控制标签。开启后聊天气泡里不再显示这串文字，仅在后台生效；消息原文不变，可随时关闭。',
    ),
    selectRow(
      '立绘显示位置',
      settings.spriteDisplayMode,
      [
        { value: 'overlay', label: '悬浮窗（默认）' },
        { value: 'inline', label: '楼层内（消息里原位显示）' },
        { value: 'both', label: '两者都显示' },
      ],
      (v) =>
        deps.updateSettings({
          ...deps.getSettings(),
          spriteDisplayMode: v === 'inline' || v === 'both' ? v : 'overlay',
        }),
      '楼层内：把消息中的 [立绘:xxx] 标签原位替换成立绘图片，本地上传、内嵌和图床图源都支持；此模式下悬浮窗隐藏。匹配不到的标签仍按上面「隐藏标签」设置处理。只影响显示，消息原文不变。',
    ),
    checkboxRow(
      '渲染消息内插图（<img>编码</img>）',
      settings.renderInlineImages,
      (v) => deps.updateSettings({ ...deps.getSettings(), renderInlineImages: v }),
      '把 AI 回复中的 <img>图床编码</img> 渲染成真实图片，编码会自动拼接下方「图床前缀」。适合让 AI 在正文里插图。',
    ),
    checkboxRow(
      '多立绘自动轮播（一条消息含多张立绘时）',
      settings.autoSwitch,
      (v) => deps.updateSettings({ ...deps.getSettings(), autoSwitch: v }),
      '一条回复命中多张立绘时，悬浮窗按下方间隔自动逐张播放；关闭后需点击悬浮窗手动切换。',
    ),
    numberRow(
      '轮播间隔（秒）',
      settings.autoSwitchSeconds,
      (v) => deps.updateSettings({ ...deps.getSettings(), autoSwitchSeconds: v }),
      '自动轮播时每张立绘的停留时长，范围 1–60 秒。',
    ),
    checkboxRow(
      '多角色/分组模式（按 [立绘:分组/图名] 寻址）',
      settings.multiRole,
      (v) => deps.updateSettings({ ...deps.getSettings(), multiRole: v }),
      '立绘包内用「分组」区分多个角色或形态时开启：AI 会用 [立绘:分组/图名]（如 [立绘:鸣人/微笑]）精确指定立绘。单角色包保持关闭即可。',
    ),
    selectRow(
      '分组 prompt 模式',
      settings.multiRolePromptMode,
      [
        { value: 'full', label: '全量（枚举全部组合）' },
        { value: 'repeat', label: '重复（分组×共享情绪名·省 token）' },
      ],
      (v) =>
        deps.updateSettings({
          ...deps.getSettings(),
          multiRolePromptMode: v === 'repeat' ? 'repeat' : 'full',
        }),
      '注入给 AI 的立绘清单写法。全量：逐一列出每个「分组/图名」组合，最直观；重复：只列分组名和共享的表情名，各分组图名一致时更省 token。',
    ),
    hostRow(
      settings.imageHost,
      (v) => deps.updateSettings({ ...deps.getSettings(), imageHost: v }),
      '拼在「图床编码」前面的 URL，用于按编码添加立绘、分享串和消息内插图。默认 catbox，一般无需修改。',
    ),
  )

  // 功能① imgbb 直传：Key 输入（密码型+显隐）+ 自动上传开关（空 Key 拦截）+ 提示行
  const imgbbHint = document.createElement('div')
  imgbbHint.className = 'so-status'
  imgbbHint.textContent = '自动上传需 imgbb API Key（免费申请：https://api.imgbb.com/）'
  const autoRow = document.createElement('label')
  autoRow.className = 'so-row checkbox_label'
  const autoInput = document.createElement('input')
  autoInput.type = 'checkbox'
  autoInput.checked = settings.autoUpload
  autoInput.addEventListener('change', () => {
    const cur = deps.getSettings()
    if (autoInput.checked && !cur.imgbbApiKey.trim()) {
      autoInput.checked = false
      imgbbHint.textContent = '请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）'
      return
    }
    if (autoInput.checked) {
      imgbbHint.textContent =
        'API Key 仅存储在本地浏览器中，不会上传到任何服务器；申请：https://api.imgbb.com/'
    }
    deps.updateSettings({ ...cur, autoUpload: autoInput.checked })
  })
  const autoSpan = document.createElement('span')
  autoSpan.textContent = '导入时自动上传到 imgbb 图床并绑定编号'
  autoSpan.append(
    helpIcon(
      '上传立绘时自动同步到 imgbb 图床并记录编号，这样「复制分享串」分享给别人时对方才能看到图。上传失败时图片仍保留在本地。',
    ),
  )
  autoRow.append(autoInput, autoSpan)
  content.append(
    passwordRow(
      'imgbb API Key',
      settings.imgbbApiKey,
      (v) => deps.updateSettings({ ...deps.getSettings(), imgbbApiKey: v }),
      '开启「自动上传」所需的 imgbb 账号密钥，仅保存在本地浏览器、不会上传到别处。免费申请：api.imgbb.com',
    ),
    autoRow,
    imgbbHint,
  )

  const hint = document.createElement('div')
  hint.className = 'so-status'
  hint.textContent = '立绘包管理与角色绑定：点击聊天界面悬浮窗右上角的 ⚙ 按钮。'
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

/** 数字输入行：失焦/回车时取整并夹到 [min,max]（用于轮播间隔秒数） */
function numberRow(
  label: string,
  value: number,
  onChange: (v: number) => void,
  help?: string,
  min = 1,
  max = 60,
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'so-row'
  const span = document.createElement('span')
  span.textContent = label
  if (help) span.append(helpIcon(help))
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

/** 密码输入行（imgbb API Key）：👁 切换明文显示，change 时去空格保存 */
function passwordRow(
  label: string,
  value: string,
  onChange: (v: string) => void,
  help?: string,
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'so-row'
  const span = document.createElement('span')
  span.textContent = label
  if (help) span.append(helpIcon(help))
  const input = document.createElement('input')
  input.type = 'password'
  input.className = 'text_pole'
  input.value = value
  input.autocomplete = 'off'
  input.addEventListener('change', () => onChange(input.value.trim()))
  const eye = document.createElement('div')
  eye.className = 'menu_button'
  eye.textContent = '👁'
  eye.title = '显示/隐藏 Key'
  eye.setAttribute('role', 'button')
  eye.setAttribute('aria-label', '显示或隐藏 API Key')
  eye.addEventListener('click', () => {
    input.type = input.type === 'password' ? 'text' : 'password'
  })
  row.append(span, input, eye)
  return row
}

/** 下拉选择行（用于分组 prompt 模式 full/repeat） */
function selectRow(
  label: string,
  value: string,
  options: Array<{ value: string; label: string }>,
  onChange: (v: string) => void,
  help?: string,
): HTMLElement {
  const row = document.createElement('div')
  row.className = 'so-row'
  const span = document.createElement('span')
  span.textContent = label
  if (help) span.append(helpIcon(help))
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

/** 图床前缀输入行：失焦时校验并保存（须为 http(s)，自动补结尾 /） */
function hostRow(value: string, onChange: (v: string) => void, help?: string): HTMLElement {
  const row = document.createElement('div')
  row.className = 'so-row'
  const span = document.createElement('span')
  span.textContent = '图床前缀'
  if (help) span.append(helpIcon(help))
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
