// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import { beginExtensionLifecycle, runWhenDomReady } from './lifecycle'

describe('extension lifecycle', () => {
  it('disposes every resource from the previous bundle before installing the next disposer', () => {
    const target: { __stStageDispose?: () => void } = {}
    const cleanups = Array.from({ length: 9 }, () => vi.fn())
    const first = beginExtensionLifecycle(target)
    cleanups.forEach((cleanup) => first.track(cleanup))

    const oldDispose = target.__stStageDispose
    const second = beginExtensionLifecycle(target)

    cleanups.forEach((cleanup) => expect(cleanup).toHaveBeenCalledTimes(1))
    oldDispose?.()
    cleanups.forEach((cleanup) => expect(cleanup).toHaveBeenCalledTimes(1))
    expect(first.disposed).toBe(true)
    expect(second.disposed).toBe(false)
  })

  it('starts at most once after DOM ready and does not install resources after disposal', async () => {
    const target: { __stStageDispose?: () => void } = {}
    const lifecycle = beginExtensionLifecycle(target)
    const doc = document.implementation.createHTMLDocument('loading')
    Object.defineProperty(doc, 'readyState', { configurable: true, value: 'loading' })
    let release!: () => void
    const pending = new Promise<void>((resolve) => { release = resolve })
    const installed = vi.fn()

    runWhenDomReady(doc, lifecycle, async () => {
      await pending
      if (lifecycle.disposed) return
      lifecycle.track(installed)
    })
    doc.dispatchEvent(new Event('DOMContentLoaded'))
    doc.dispatchEvent(new Event('DOMContentLoaded'))
    target.__stStageDispose?.()
    release()
    await pending
    await Promise.resolve()

    expect(installed).not.toHaveBeenCalled()
  })

  it('removes only the stylesheet node captured by its own lifecycle', () => {
    const target: { __stStageDispose?: () => void } = {}
    const oldLink = document.createElement('link')
    oldLink.dataset.stStageStyle = ''
    document.head.append(oldLink)
    const first = beginExtensionLifecycle(target, document)

    oldLink.remove()
    const newLink = document.createElement('link')
    newLink.dataset.stStageStyle = ''
    document.head.append(newLink)
    beginExtensionLifecycle(target, document)

    expect(first.disposed).toBe(true)
    expect(newLink.isConnected).toBe(true)
  })
})
