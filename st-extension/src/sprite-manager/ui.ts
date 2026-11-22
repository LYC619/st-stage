import { t } from '../../../core/i18n'

let managerControlId = 0
export const nextManagerId = () => 'so-manager-control-' + ++managerControlId


/* ---------------- DOM 工具 ---------------- */

export function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}


/**
 * 图墙缩略图：懒加载 + 异步解码；图床不可达时换成同尺寸的「图片加载失败」占位，
 * 不再露出浏览器的破图标和左上角原始 alt 文本。卡片本身仍可点击打开。
 */
export function thumbnail(src: string, alt: string): HTMLImageElement {
  const img = document.createElement('img')
  img.alt = alt
  img.loading = 'lazy'
  img.decoding = 'async'
  img.addEventListener('error', () => {
    const failed = el('span', 'so-img-failed')
    failed.textContent = t('sprite.manager.content.image_failed', '图片加载失败')
    failed.title = src
    img.replaceWith(failed)
  }, { once: true })
  img.src = src
  return img
}


export function textInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'text_pole'
  input.placeholder = placeholder
  input.setAttribute('aria-label', placeholder)
  input.dataset.managerFocus = `input:${placeholder}`
  return input
}


export function labeled(label: string, input: HTMLElement): HTMLElement {
  const wrap = el('label', 'so-labeled')
  const span = el('span', 'so-labeled-text')
  span.id = nextManagerId()
  span.textContent = label
  input.setAttribute('aria-labelledby', span.id)
  input.dataset.managerFocus = `field:${label}`
  wrap.append(span, input)
  return wrap
}


export function checkboxRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el('label', 'so-row checkbox_label')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.dataset.managerFocus = `checkbox:${label}`
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  row.append(input, span)
  return row
}


export function button(label: string, onClick: () => void, extraClass = ''): HTMLElement {
  const btn = el('div', `menu_button so-btn ${extraClass}`.trim())
  btn.setAttribute('role', 'button')
  btn.tabIndex = 0
  btn.textContent = label
  btn.dataset.managerFocus = `button:${label}`
  btn.addEventListener('click', onClick)
  btn.addEventListener('keydown', (e) => {
    if (!e.isComposing && (e.key === 'Enter' || e.key === ' ')) {
      e.preventDefault()
      // ST also turns bubbling Enter on .menu_button into a click.
      e.stopPropagation()
      onClick()
    }
  })
  return btn
}


export function iconButton(
  icon: string,
  title: string,
  onClick: () => void,
  className = 'so-icon-btn',
  disabled = false,
): HTMLElement {
  const btn = el('div', className)
  btn.textContent = icon
  btn.title = title
  btn.setAttribute('role', 'button')
  btn.setAttribute('aria-label', title)
  btn.setAttribute('aria-disabled', String(disabled))
  btn.tabIndex = disabled ? -1 : 0
  btn.dataset.managerFocus = `icon:${title}`
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!disabled) onClick()
  })
  btn.addEventListener('keydown', event => {
    if (event.isComposing || !['Enter', ' '].includes(event.key)) return
    event.preventDefault()
    event.stopPropagation()
    if (!disabled) onClick()
  })
  return btn
}


/** 状态提示条（toast 输出目标） */
export function statusBar(): HTMLElement {
  const status = el('div', 'so-status so-toast')
  status.setAttribute('role', 'status')
  return status
}


/** Arrow keys follow the rendered rows; Home/End visit the first/last card. */
export function addCardNavigation(card: HTMLElement, selector: string): void {
  card.addEventListener('keydown', event => {
    if (event.target !== card || event.isComposing || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return
    const cards = [...(card.closest('.so-manager-body')?.querySelectorAll<HTMLElement>(selector) ?? [])]
    const index = cards.indexOf(card)
    if (index < 0) return
    let target = index
    if (event.key === 'Home') target = 0
    else if (event.key === 'End') target = cards.length - 1
    else if (event.key === 'ArrowLeft') target--
    else if (event.key === 'ArrowRight') target++
    else {
      const rect = card.getBoundingClientRect()
      const direction = event.key === 'ArrowDown' ? 1 : -1
      const candidates = cards.map((node, i) => ({ i, rect: node.getBoundingClientRect() }))
        .filter(item => direction * (item.rect.top - rect.top) > 1)
        .sort((a, b) => Math.abs(a.rect.top - rect.top) - Math.abs(b.rect.top - rect.top)
          || Math.abs(a.rect.left - rect.left) - Math.abs(b.rect.left - rect.left))
      target = candidates[0]?.i ?? index + direction
    }
    event.preventDefault()
    event.stopPropagation()
    cards[Math.max(0, Math.min(cards.length - 1, target))]?.focus()
  })
}


export function toast(scope: HTMLElement | null, msg: string): void {
  const targets: HTMLElement[] = []
  const bar = scope?.querySelector<HTMLElement>('.so-toast')
  if (bar) targets.push(bar)
  const lightboxBar = document.querySelector<HTMLElement>('.so-lightbox .so-lightbox-toast')
  if (lightboxBar && !targets.includes(lightboxBar)) targets.push(lightboxBar)
  for (const node of targets) {
    node.textContent = msg
    setTimeout(() => {
      if (node.textContent === msg) node.textContent = ''
    }, 4000)
  }
}


export function pickFile(accept: string, multiple: boolean, onPick: (files: FileList) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.addEventListener('change', () => {
    if (input.files && input.files.length > 0) onPick(input.files)
  })
  input.click()
}


export function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}


export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 非安全上下文（http 直连 ST）没有 clipboard API，走隐藏 textarea 兜底
    const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const container = opener?.closest('[role="dialog"]') ?? document.body
    const ta = document.createElement('textarea')
    try {
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      ta.tabIndex = -1
      container.append(ta)
      ta.focus({ preventScroll: true })
      ta.select()
      // A nested dialog may own focus; never claim a copy when selection moved away.
      if (document.activeElement !== ta || ta.selectionStart !== 0 || ta.selectionEnd !== text.length) return false
      return document.execCommand('copy')
    } catch {
      return false
    } finally {
      ta.remove()
      if (opener?.isConnected) opener.focus({ preventScroll: true })
    }
  }
}