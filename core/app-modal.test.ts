// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { openAppModal } from './app-modal'

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('openAppModal', () => {
  it('打开：onOpen 先行、内容渲染进 body；关闭：清理 → 移除 DOM → onClose', () => {
    const calls: string[] = []
    const close = openAppModal(
      (body, _close) => {
        body.textContent = '内容'
        return () => calls.push('cleanup')
      },
      { onOpen: () => calls.push('open'), onClose: () => calls.push('close') },
    )
    expect(calls).toEqual(['open'])
    expect(document.querySelector('.so-app-modal-body')?.textContent).toBe('内容')

    close()
    expect(calls).toEqual(['open', 'cleanup', 'close'])
    expect(document.querySelector('.so-app-modal-backdrop')).toBeNull()
  })

  it('close 幂等：✕ 点击后再调 close 不重复清理', () => {
    const cleanup = vi.fn()
    const onClose = vi.fn()
    const close = openAppModal(() => cleanup, { onOpen: () => {}, onClose })
    ;(document.querySelector('.so-app-modal-close') as HTMLElement).click()
    close()
    expect(cleanup).toHaveBeenCalledTimes(1)
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('Esc 关闭，且事件监听随关闭移除', () => {
    const onClose = vi.fn()
    openAppModal(() => {}, { onOpen: () => {}, onClose })
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.so-app-modal-backdrop')).toBeNull()
  })

  it('build 抛错：显示错误占位，弹窗仍可关闭', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const onClose = vi.fn()
    const close = openAppModal(
      () => {
        throw new Error('boom')
      },
      { onOpen: () => {}, onClose },
    )
    expect(document.querySelector('.so-app-modal-body')?.textContent).toContain('弹窗渲染失败')
    close()
    expect(onClose).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('build 里可用 close 自闭（保存后关闭的常见形态）', () => {
    const onClose = vi.fn()
    openAppModal(
      (body, close) => {
        const btn = document.createElement('button')
        btn.addEventListener('click', close)
        body.append(btn)
        btn.click()
      },
      { onOpen: () => {}, onClose },
    )
    expect(onClose).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.so-app-modal-backdrop')).toBeNull()
  })
})
