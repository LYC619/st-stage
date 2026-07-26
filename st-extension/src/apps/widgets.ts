/**
 * 手机 App 共享小部件（原生 DOM）：按钮、开关行、下拉行、数字行、输入行。
 * 样式类名沿用 so-app-*（core/phone-shell.css）。
 */

export function el(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

export function appButton(label: string, onClick: () => void): HTMLElement {
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

export function toggleRow(
  label: string,
  checked: boolean,
  onChange: (v: boolean) => void,
): HTMLElement {
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

/** 下拉行 */
export function selectRow(
  label: string,
  value: string,
  options: Array<{ value: string; label: string }>,
  onChange: (v: string) => void,
): HTMLElement {
  const row = el('label', 'so-app-toggle')
  const span = document.createElement('span')
  span.textContent = label
  const select = document.createElement('select')
  select.className = 'text_pole so-app-input'
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

/** 数字输入行：change 时取整并夹到 [min,max] */
export function numberRow(
  label: string,
  value: number,
  min: number,
  max: number,
  onChange: (v: number) => void,
): HTMLElement {
  const row = el('label', 'so-app-toggle')
  const span = document.createElement('span')
  span.textContent = label
  const input = document.createElement('input')
  input.type = 'number'
  input.className = 'text_pole so-app-num'
  input.min = String(min)
  input.max = String(max)
  input.step = '1'
  input.value = String(value)
  input.addEventListener('change', () => {
    const n = Math.round(Number(input.value))
    const clamped = Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min
    input.value = String(clamped)
    onChange(clamped)
  })
  row.append(span, input)
  return row
}

/** 折叠分区（details/summary）：标题常显、内容默认收起，防止长页漏看分区 */
export function foldSection(title: string, open = false): { box: HTMLElement; body: HTMLElement } {
  const box = document.createElement('details')
  box.className = 'so-app-section so-app-fold'
  box.open = open
  const summary = document.createElement('summary')
  summary.className = 'so-app-title'
  summary.textContent = title
  const body = el('div', 'so-app-fold-body')
  box.append(summary, body)
  return { box, body }
}

/** 多行文本行（change 提交）：用于自定义 prompt 模板等长文本 */
export function textareaRow(
  label: string,
  value: string,
  placeholder: string,
  onCommit: (v: string) => void,
): HTMLElement {
  const wrap = el('div', 'so-app-field')
  const title = el('div', 'so-app-title')
  title.textContent = label
  const input = document.createElement('textarea')
  input.className = 'text_pole so-app-input'
  input.rows = 5
  input.value = value
  input.placeholder = placeholder
  input.addEventListener('change', () => onCommit(input.value))
  wrap.append(title, input)
  return wrap
}

/**
 * 给任意一行挂一个 ⓘ 说明：
 * - 桌面：悬浮到 ⓘ 上由浏览器原生 title 气泡显示（“悬浮的解释”）
 * - 移动端（无 hover）：点 ⓘ 展开/收起行内说明块
 * 传入的 row 会被塞进弹性行，ⓘ 固定在右侧。
 */
export function hintField(row: HTMLElement, hint: string): HTMLElement {
  const wrap = el('div', 'so-app-hintwrap')
  const line = el('div', 'so-app-hintrow')
  row.classList.add('so-app-hintrow-main')

  const badge = document.createElement('button')
  badge.type = 'button'
  badge.className = 'so-app-hint-badge'
  badge.textContent = 'ⓘ'
  badge.title = hint
  badge.setAttribute('aria-label', '说明')
  badge.setAttribute('aria-expanded', 'false')

  const detail = el('div', 'so-app-hint')
  detail.textContent = hint
  detail.hidden = true

  badge.addEventListener('click', (e) => {
    e.preventDefault()
    detail.hidden = !detail.hidden
    badge.classList.toggle('so-app-hint-badge-on', !detail.hidden)
    badge.setAttribute('aria-expanded', String(!detail.hidden))
  })

  line.append(row, badge)
  wrap.append(line, detail)
  return wrap
}

/** 文本输入行（blur 提交），transform 可在保存前清洗/校验值 */
export function textRow(
  label: string,
  value: string,
  placeholder: string,
  onCommit: (v: string) => void,
  type: 'text' | 'password' = 'text',
): HTMLElement {
  const wrap = el('div', 'so-app-field')
  const title = el('div', 'so-app-title')
  title.textContent = label
  const input = document.createElement('input')
  input.type = type
  input.className = 'text_pole so-app-input'
  input.value = value
  input.placeholder = placeholder
  input.autocomplete = 'off'
  input.addEventListener('change', () => onCommit(input.value))
  wrap.append(title, input)
  return wrap
}
