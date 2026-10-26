/**
 * App 全屏弹窗（ctx.openModal 的 DOM 实现，双端共用；样式 so-app-modal-* 在 phone-shell.css）。
 * 三原则：手机页只放开关+展示+入口，复杂编辑走全屏弹窗——本模块把
 * 「开遮罩 → 渲染内容 → ✕/Esc/close 关闭 → 清理 → 回到 App」的标准动作平台化。
 * 收起手机（onOpen）与回到 App（onClose）由平台钩子完成，弹窗寿命独立于 App 的 mount。
 */

import { t } from './i18n'
import { manageDialogFocus } from './dialog-focus'

/** 弹窗内容构造器：往 body 渲染 DOM；返回的清理函数在关闭时执行 */
export type ModalBuild = (body: HTMLElement, close: () => void) => void | (() => void)

export interface AppModalHooks {
  /** 打开前调用（平台：收起手机，避免手机挡在弹窗上） */
  onOpen(): void
  /** 关闭后调用（平台：重新展开手机并回到来源 App） */
  onClose(): void
}

/** 打开弹窗，返回幂等的 close（平台销毁时兜底关闭用） */
export function openAppModal(build: ModalBuild, hooks: AppModalHooks): () => void {
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null
  hooks.onOpen()

  const backdrop = document.createElement('div')
  backdrop.className = 'so-app-modal-backdrop'
  const box = document.createElement('div')
  box.className = 'so-app-modal'
  box.setAttribute('role', 'dialog')
  box.setAttribute('aria-modal', 'true')
  box.setAttribute('aria-label', t('modal.title', 'App 弹窗'))
  const head = document.createElement('div')
  head.className = 'so-app-modal-head'
  const closeBtn = document.createElement('div')
  closeBtn.className = 'so-app-modal-close'
  closeBtn.textContent = '✕'
  closeBtn.title = t('common.close', '关闭')
  closeBtn.setAttribute('role', 'button')
  closeBtn.setAttribute('aria-label', t('modal.close', '关闭弹窗'))
  closeBtn.tabIndex = 0
  const body = document.createElement('div')
  body.className = 'so-app-modal-body'
  head.append(closeBtn)
  box.append(head, body)
  backdrop.append(box)
  document.body.append(backdrop)

  let cleanup: (() => void) | void
  let closed = false
  const runCleanup = () => {
    const current = cleanup
    cleanup = undefined
    try {
      current?.()
    } catch (err) {
      console.error('[sprite-overlay] App 弹窗清理失败', err)
    }
  }
  const close = () => {
    if (closed) return
    closed = true
    focus.dispose()
    runCleanup()
    backdrop.remove()
    try {
      hooks.onClose()
    } finally {
      focus.restoreFocus()
    }
  }
  const focus = manageDialogFocus(box, { onEscape: close, opener, layer: backdrop })
  closeBtn.addEventListener('click', close)
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      e.stopPropagation()
      close()
    }
  })

  try {
    cleanup = build(body, close)
    if (closed) runCleanup()
  } catch (err) {
    console.error('[sprite-overlay] App 弹窗渲染失败', err)
    body.setAttribute('role', 'alert')
    body.textContent = t('modal.render_error', '弹窗渲染失败，详见控制台')
  }
  if (!closed) focus.focusInitial()
  return close
}

/** 打开由平台 tracker 托管的弹窗；正常关闭后立即注销兜底 close。 */
export function openTrackedAppModal(
  build: ModalBuild,
  hooks: AppModalHooks,
  track: (cleanup: () => void) => () => void,
): () => void {
  const untrackRef: { current?: () => void } = {}
  let closed = false
  const close = openAppModal(build, {
    onOpen: hooks.onOpen,
    onClose: () => {
      closed = true
      try {
        hooks.onClose()
      } finally {
        untrackRef.current?.()
      }
    },
  })
  untrackRef.current = track(close)
  if (closed) untrackRef.current()
  return close
}
