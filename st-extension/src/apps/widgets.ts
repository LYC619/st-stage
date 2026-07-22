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
