/** Visible viewport expressed in the coordinate system of fixed body children.
 * ST transforms its root element, so document scrolling moves fixed layers too.
 * An invisible probe measures that origin without changing the host's styles.
 */
export function fixedViewport() {
  const viewport = window.visualViewport
  const probe = document.createElement('div')
  probe.style.cssText = 'position:fixed;left:0;top:0;width:1px;height:1px;visibility:hidden;pointer-events:none;margin:0;padding:0;border:0;'
  document.body.append(probe)
  const origin = probe.getBoundingClientRect()
  probe.remove()
  const scaleX = origin.width || 1
  const scaleY = origin.height || 1
  return {
    width: (viewport?.width ?? window.innerWidth) / scaleX,
    height: (viewport?.height ?? window.innerHeight) / scaleY,
    left: ((viewport?.offsetLeft ?? 0) - origin.left) / scaleX,
    top: ((viewport?.offsetTop ?? 0) - origin.top) / scaleY,
  }
}

/** Subscribe only to viewport/document changes, not scrolling within a form. */
export function observeFixedViewport(update: () => void): () => void {
  const viewport = window.visualViewport
  window.addEventListener('resize', update)
  window.addEventListener('scroll', update)
  viewport?.addEventListener('resize', update)
  viewport?.addEventListener('scroll', update)
  return () => {
    window.removeEventListener('resize', update)
    window.removeEventListener('scroll', update)
    viewport?.removeEventListener('resize', update)
    viewport?.removeEventListener('scroll', update)
  }
}
