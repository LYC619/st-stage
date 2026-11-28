/** Shared focus lifecycle for DOM dialogs. Only the newest connected dialog owns the keyboard. */
export interface DialogFocusOptions {
  onEscape(): void
  /** Capture before an onOpen hook removes the originating App. */
  opener?: HTMLElement | null
  /** The positioned backdrop/layer that establishes this dialog's stacking context. */
  layer?: HTMLElement
}

interface DialogEntry {
  container: HTMLElement
  layer: HTMLElement
  focusInitial(): void
}

const dialogs: DialogEntry[] = []
const selector = 'button, a[href], input, select, textarea, summary, [contenteditable], [tabindex]'

function isCandidate(element: HTMLElement): boolean {
  const editable = element.getAttribute('contenteditable')
  const parentEditable = element.parentElement?.closest('[contenteditable]')?.getAttribute('contenteditable')
  const editingHost = editable !== null && ['', 'true', 'plaintext-only'].includes(editable)
    && (parentEditable === undefined || parentEditable === 'false')
  return (element.tabIndex >= 0 || (editingHost && !element.hasAttribute('tabindex')))
    && !element.matches(':disabled')
}

function isVisible(element: HTMLElement, styleCache = new Map<HTMLElement, boolean>()): boolean {
  if (!element.isConnected || element.closest('[hidden], [inert]')) return false
  // Reject closed disclosures before asking the browser for computed styles of every
  // hidden control. Large settings forms otherwise force work for their entire tree.
  for (let node = element.parentElement; node; node = node.parentElement) {
    if (node.tagName === 'DETAILS' && !node.hasAttribute('open') && !node.querySelector(':scope > summary')?.contains(element)) return false
  }
  const checkStyle = (node: HTMLElement | null): boolean => {
    if (!node) return true
    const cached = styleCache.get(node)
    if (cached !== undefined) return cached
    if (!checkStyle(node.parentElement)) {
      styleCache.set(node, false)
      return false
    }
    const style = getComputedStyle(node)
    const visible = style.display !== 'none' && style.visibility !== 'hidden' && style.visibility !== 'collapse'
    styleCache.set(node, visible)
    return visible
  }
  return checkStyle(element)
}

function focusable(container: HTMLElement): HTMLElement[] {
  const styleCache = new Map<HTMLElement, boolean>()
  const candidates = Array.from(container.querySelectorAll<HTMLElement>(selector))
    .filter((element) => isCandidate(element) && isVisible(element, styleCache))
  return candidates.filter((element) => {
    if (!(element instanceof HTMLInputElement) || element.type !== 'radio' || !element.name) return true
    const group = candidates.filter((candidate): candidate is HTMLInputElement => candidate instanceof HTMLInputElement
      && candidate.type === 'radio' && candidate.name === element.name && candidate.form === element.form)
    return element === (group.find((radio) => radio.checked) ?? group[0])
  })
    // Match native Tab order if a consumer supplies positive tabindex values.
    .sort((a, b) => (a.tabIndex > 0 ? a.tabIndex : Infinity) - (b.tabIndex > 0 ? b.tabIndex : Infinity))
}

function firstFocusable(container: HTMLElement): HTMLElement | undefined {
  const raw = Array.from(container.querySelectorAll<HTMLElement>(selector))
  if (raw.some((el) => el.tabIndex > 0)) return focusable(container)[0]
  const styleCache = new Map<HTMLElement, boolean>()
  for (const element of raw) {
    if (!isCandidate(element) || !isVisible(element, styleCache)) continue
    if (element instanceof HTMLInputElement && element.type === 'radio' && element.name) {
      const group = raw.filter((c): c is HTMLInputElement => c instanceof HTMLInputElement
        && c.type === 'radio' && c.name === element.name && c.form === element.form
        && isCandidate(c) && isVisible(c, styleCache))
      return group.find((radio) => radio.checked) ?? group[0]
    }
    return element
  }
  return undefined
}

function topDialog(): DialogEntry | undefined {
  return dialogs.findLast((entry) => entry.container.isConnected)
}

export function manageDialogFocus(container: HTMLElement, options: DialogFocusOptions) {
  const opener = options.opener === undefined
    ? document.activeElement instanceof HTMLElement ? document.activeElement : null
    : options.opener
  const originalTabIndex = container.getAttribute('tabindex')
  const layer = options.layer ?? container
  const originalZIndex = layer.style.getPropertyValue('z-index')
  const originalZPriority = layer.style.getPropertyPriority('z-index')
  const zIndex = (node: HTMLElement) => Number.parseInt(getComputedStyle(node).zIndex, 10) || 0
  const highestLayer = Math.max(9999, zIndex(layer), ...dialogs.filter((entry) => entry.container.isConnected).map((entry) => zIndex(entry.layer)))
  layer.style.setProperty('z-index', String(highestLayer + 1))
  if (originalTabIndex === null) container.tabIndex = -1
  let disposed = false
  let restoreAllowed = false
  let lastFocused: HTMLElement | null = null
  const entry: DialogEntry = { container, layer, focusInitial }
  dialogs.push(entry)

  function focusInitial(): void {
    if (disposed || topDialog() !== entry) return
    const target = lastFocused && container.contains(lastFocused) && isVisible(lastFocused) && !lastFocused.matches(':disabled')
      ? lastFocused
      : firstFocusable(container) ?? container
    target.focus({ preventScroll: true })
  }

  function onFocus(event: FocusEvent): void {
    if (disposed || topDialog() !== entry) return
    if (event.target instanceof HTMLElement && container.contains(event.target)) {
      lastFocused = event.target
    } else {
      focusInitial()
    }
  }

  function onKey(event: KeyboardEvent): void {
    if (disposed || topDialog() !== entry || event.isComposing) return
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopImmediatePropagation()
      options.onEscape()
    } else if (event.key === 'Tab') {
      const items = focusable(container)
      const first = items[0] ?? container
      const last = items[items.length - 1] ?? container
      const active = document.activeElement
      if (!items.includes(active as HTMLElement) || (event.shiftKey ? active === first : active === last)) {
        event.preventDefault()
        event.stopPropagation()
        ;(event.shiftKey ? last : first).focus({ preventScroll: true })
      }
    }
  }

  document.addEventListener('keydown', onKey, true)
  document.addEventListener('focusin', onFocus, true)
  return {
    focusInitial,
    isTop: () => !disposed && topDialog() === entry,
    dispose(): void {
      if (disposed) return
      restoreAllowed = topDialog() === entry
      disposed = true
      dialogs.splice(dialogs.indexOf(entry), 1)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('focusin', onFocus, true)
      if (originalTabIndex === null) container.removeAttribute('tabindex')
      if (originalZIndex) layer.style.setProperty('z-index', originalZIndex, originalZPriority)
      else layer.style.removeProperty('z-index')
    },
    /** Call after removing the dialog and reopening/remounting its source App. */
    restoreFocus(): void {
      if (!disposed || !restoreAllowed) return
      restoreAllowed = false
      const parent = topDialog()
      if (opener && isVisible(opener) && !opener.matches(':disabled') && (!parent || parent.container.contains(opener))) {
        opener.focus({ preventScroll: true })
      } else {
        parent?.focusInitial()
      }
    },
  }
}
