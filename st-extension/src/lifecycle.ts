import { createCapabilityTracker, type CapabilityTracker } from '../../core/capabilities'

export interface ExtensionLifecycleTarget {
  __stStageDispose?: () => void
}

/** Replace the previous bundle lifecycle immediately, before async initialization starts. */
export function beginExtensionLifecycle(
  target: ExtensionLifecycleTarget,
  doc?: Document,
): CapabilityTracker {
  target.__stStageDispose?.()

  const lifecycle = createCapabilityTracker()
  const dispose = () => lifecycle.dispose()
  target.__stStageDispose = dispose
  lifecycle.track(() => {
    if (target.__stStageDispose === dispose) delete target.__stStageDispose
  })

  const stylesheet = doc?.querySelector<HTMLLinkElement>('link[data-st-stage-style]')
  if (stylesheet) lifecycle.track(() => stylesheet.remove())
  return lifecycle
}

/** Start one initialization when DOM is ready; disposal cancels a pending start. */
export function runWhenDomReady(
  doc: Document,
  lifecycle: CapabilityTracker,
  start: () => void | Promise<void>,
): void {
  let started = false
  let untrack = () => {}
  const run = () => {
    if (started || lifecycle.disposed) return
    started = true
    untrack()
    void Promise.resolve(start()).catch((err) => {
      console.error('[sprite-overlay] 初始化失败', err)
    })
  }

  if (doc.readyState === 'loading') {
    doc.addEventListener('DOMContentLoaded', run)
    untrack = lifecycle.track(() => doc.removeEventListener('DOMContentLoaded', run))
  } else {
    run()
  }
}
