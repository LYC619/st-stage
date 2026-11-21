/**
 * 手机壳屏幕重挂载时的语义焦点与输入选区捕获/恢复。
 * 通过语义标签而非自增 DOM id 比对，防止恢复到新插入的无关表单控件上。
 */

export function focusIdentity(element: HTMLElement): string {
  const labelledBy = element.getAttribute('aria-labelledby')?.split(/\s+/)
    .map(id => document.getElementById(id)?.textContent ?? '').join(' ').trim()
  const labels = element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement
    || element instanceof HTMLSelectElement || element instanceof HTMLButtonElement
    ? Array.from(element.labels ?? []).map(label => {
      const copy = label.cloneNode(true) as HTMLElement
      copy.querySelectorAll('input, select, textarea, button, output').forEach(node => node.remove())
      return copy.textContent ?? ''
    }).join(' ')
    : ''
  const name = (labelledBy || element.getAttribute('aria-label') || labels
    || (element.matches('button, [role="button"]') ? element.textContent : '') || '').replace(/\s+/g, ' ').trim()
  const key = element.dataset.focusKey || element.getAttribute('name') || ''
  return name || key ? JSON.stringify([name, key, element.getAttribute('role')]) : ''
}

/** A settings update rebuilds the same App; keep the currently edited control usable. */
export function captureScreenFocus(screen: HTMLElement, fallbackFocus: () => void): (() => void) | null {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !screen.contains(active)) return null
  const identity = focusIdentity(active)
  const path: number[] = []
  for (let node: Element = active; node !== screen && node.parentElement; node = node.parentElement) {
    path.unshift(Array.from(node.parentElement.children).indexOf(node))
  }
  const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? [active.selectionStart, active.selectionEnd, active.selectionDirection] as const
    : null
  return () => {
    let replacement: Element | undefined = screen
    for (const index of path) replacement = replacement?.children[index]
    if (!(replacement instanceof HTMLElement) || replacement.tagName !== active.tagName
      || replacement.getAttribute('type') !== active.getAttribute('type')
      || !identity || focusIdentity(replacement) !== identity
      || replacement.closest('[hidden], [inert]') || replacement.matches(':disabled')) {
      fallbackFocus()
      return
    }
    replacement.focus({ preventScroll: true })
    if (document.activeElement !== replacement) {
      fallbackFocus()
      return
    }
    if (selection && selection[0] !== null && selection[1] !== null
      && (replacement instanceof HTMLInputElement || replacement instanceof HTMLTextAreaElement)) {
      replacement.setSelectionRange(selection[0], selection[1], selection[2] ?? undefined)
    }
  }
}
