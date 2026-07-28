/**
 * App 全屏弹窗（ctx.openModal 的 DOM 实现，双端共用；样式 so-app-modal-* 在 phone-shell.css）。
 * 三原则：手机页只放开关+展示+入口，复杂编辑走全屏弹窗——本模块把
 * 「开遮罩 → 渲染内容 → ✕/Esc/close 关闭 → 清理 → 回到 App」的标准动作平台化。
 * 收起手机（onOpen）与回到 App（onClose）由平台钩子完成，弹窗寿命独立于 App 的 mount。
 */

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
  hooks.onOpen()

  const backdrop = document.createElement('div')
  backdrop.className = 'so-app-modal-backdrop'
  const box = document.createElement('div')
  box.className = 'so-app-modal'
  const head = document.createElement('div')
  head.className = 'so-app-modal-head'
  const closeBtn = document.createElement('div')
  closeBtn.className = 'so-app-modal-close'
  closeBtn.textContent = '✕'
  closeBtn.title = '关闭'
  closeBtn.setAttribute('role', 'button')
  closeBtn.setAttribute('aria-label', '关闭弹窗')
  closeBtn.tabIndex = 0
  const body = document.createElement('div')
  body.className = 'so-app-modal-body'
  head.append(closeBtn)
  box.append(head, body)
  backdrop.append(box)
  document.body.append(backdrop)

  let cleanup: (() => void) | void
  let closed = false
  const close = () => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKey, true)
    try {
      cleanup?.()
    } catch (err) {
      console.error('[sprite-overlay] App 弹窗清理失败', err)
    }
    backdrop.remove()
    hooks.onClose()
  }
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation()
      close()
    }
  }
  document.addEventListener('keydown', onKey, true)
  closeBtn.addEventListener('click', close)
  closeBtn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      close()
    }
  })

  try {
    cleanup = build(body, close)
  } catch (err) {
    console.error('[sprite-overlay] App 弹窗渲染失败', err)
    body.textContent = '弹窗渲染失败，详见控制台'
  }
  return close
}
