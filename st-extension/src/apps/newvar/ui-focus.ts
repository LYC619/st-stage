/** Native Enter and the ST menu-button shortcut must not both activate an action. */
export function variableButton(className: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.addEventListener('keydown', event => {
    if (event.key !== 'Enter' || event.isComposing) return
    event.preventDefault()
    event.stopPropagation()
    button.click()
  })
  return button
}

/** Restore the same labelled control after a variable panel rebuilds its DOM. */
export function captureVariableFocus(container: HTMLElement): (() => boolean) | null {
  const active = document.activeElement
  if (!(active instanceof HTMLElement) || !container.contains(active)) return null
  const identity = (node: HTMLElement): string | null => {
    const explicit = node.dataset.variableFocus
    if (explicit) return explicit
    const labelledBy = node.getAttribute('aria-labelledby')
    const label = node.getAttribute('aria-label')
      ?? (labelledBy ? document.getElementById(labelledBy)?.textContent : null)
      ?? node.closest('label')?.querySelector('span')?.textContent
    if (!label) return null
    const scope = node.closest<HTMLElement>('[data-variable-focus-scope]')?.dataset.variableFocusScope ?? ''
    return `${scope}:${node.tagName}:${node.getAttribute('type') ?? ''}:${label}`
  }
  const key = identity(active)
  if (!key) return null
  const selection = active instanceof HTMLInputElement || active instanceof HTMLTextAreaElement
    ? { start: active.selectionStart, end: active.selectionEnd } : null
  return () => {
    const target = [...container.querySelectorAll<HTMLElement>('button, input, select, textarea, summary, [tabindex]')]
      .find(node => identity(node) === key && !node.matches(':disabled') && !node.closest('[hidden], [inert]'))
    if (!target) return false
    target.focus({ preventScroll: true })
    if (selection?.start !== null && selection?.start !== undefined && selection.end !== null
      && (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement)) {
      target.setSelectionRange(selection.start, selection.end)
    }
    return document.activeElement === target
  }
}
