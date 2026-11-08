import { fixedViewport, observeFixedViewport } from '../../../core/fixed-viewport'
import { t } from '../../../core/i18n'
import { manageDialogFocus } from '../../../core/dialog-focus'
import type { PluginSettings } from '../../../core/types'
import { el, toast } from './ui'
import type { ManagerSource, ManagerContext } from './types'
import { SPRITE_PAGE_SIZE } from './types'

export function createLifecycle(ctx: ManagerContext) {
  const { deps } = ctx
  /** Scroll memory per view; reset whenever a new manager window opens. */
  let renderedView = '', listScrollTop = 0
  const viewKey = () => ctx.state.view.kind === 'pack' ? `pack:${ctx.state.view.packId}` : 'list'

  function applyBackdropSize(): void {
    if (!ctx.state.backdrop) return
    const viewport = fixedViewport()
    ctx.state.backdrop.style.left = `${viewport.left}px`
    ctx.state.backdrop.style.top = `${viewport.top}px`
    ctx.state.backdrop.style.width = `${viewport.width}px`
    ctx.state.backdrop.style.height = `${viewport.height}px`
  }


  function open(source: ManagerSource = 'overlay'): void {
    if (ctx.state.destroyed) return
    ctx.state.openedFrom = source
    if (ctx.state.backdrop) {
      render()
      return
    }
    ctx.state.view = { kind: 'list' }
    ctx.state.spriteVisibleCount = SPRITE_PAGE_SIZE
    ctx.state.spriteFilterQuery = ''
    ctx.state.spriteFilterLabels = []
    ctx.state.packFilterQuery = ''
    ctx.state.packFilterRole = ''
    ctx.state.packFilterKind = ''
    ctx.state.packFilterTag = ''
    ctx.state.expandedRoleGroupKey = ''
    ctx.state.openSections.clear()
    ctx.state.enableListOpen = false
    ctx.state.batchMode = false
    ctx.state.selectedPackIds.clear()
    renderedView = ''; listScrollTop = 0
    ctx.state.backdrop = el('div', 'so-manager-backdrop')
    // 点空白不再关闭（用户实测：误触退出后要重新逐层进入，受挫感强）；关闭走 ✕ 按钮或 Esc
    ctx.state.stopViewport = observeFixedViewport(applyBackdropSize)
    applyBackdropSize()

    const dialog = el('div', 'so-manager')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-modal', 'true')
    dialog.setAttribute('aria-label', t('sprite.manager.title', '立绘包管理'))

    const header = el('div', 'so-manager-header')
    // 详情页专用返回键：放在固定头部，滚到哪都能返回（移动端全屏时尤其重要）
    const backBtn = el('div', 'menu_button so-manager-back')
    backBtn.title = t('sprite.manager.back', '返回列表')
    backBtn.setAttribute('aria-label', backBtn.title)
    backBtn.textContent = '‹'
    backBtn.setAttribute('role', 'button')
    backBtn.tabIndex = 0
    const goBack = () => returnToList()
    backBtn.addEventListener('click', goBack)
    backBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
        goBack()
      }
    })
    const title = el('b', 'so-manager-title')
    // 头部操作区（列表页放启用选择 + 新建/导入下拉；详情页留空自动隐藏）
    const actions = el('div', 'so-manager-actions')
    const closeBtn = el('div', 'menu_button so-manager-close')
    closeBtn.title = t('common.close', '关闭')
    closeBtn.textContent = '✕'
    closeBtn.setAttribute('role', 'button')
    closeBtn.setAttribute('aria-label', closeBtn.title)
    closeBtn.tabIndex = 0
    closeBtn.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault()
        event.stopPropagation()
        close()
      }
    })
    closeBtn.addEventListener('click', () => close())
    header.append(backBtn, title, actions, closeBtn)

    const body = el('div', 'so-manager-body')
    dialog.append(header, body)
    ctx.state.backdrop.append(dialog)
    document.body.append(ctx.state.backdrop)
    ctx.state.dialogFocus = manageDialogFocus(dialog, { onEscape, layer: ctx.state.backdrop })
    render()
    ctx.state.dialogFocus.focusInitial()
  }


  function onEscape(): void {
    // 先关下拉浮层，再谈返回/关闭
    if (ctx.state.backdrop?.querySelector('.so-popover')) {
      const opener = ctx.state.popoverOpener ?? ctx.state.backdrop.querySelector<HTMLElement>('.so-enable-btn')
      ctx.actions.closeEnableList()
      ctx.actions.closePopovers()
      opener?.focus()
      return
    }
    if (ctx.state.view.kind === 'pack') {
      returnToList()
    } else {
      close()
    }
  }


  function close(): void {
    if (!ctx.state.backdrop) return
    ctx.state.activeLightbox?.controller?.close()
    ctx.actions.closeEnableList()
    ctx.actions.closePopovers()
    ctx.state.importController?.abort()
    ctx.state.importController = null
    ctx.state.storageDialog?.close()
    ctx.state.storageDialog = null
    for (const closeChild of [...ctx.state.childDialogs].reverse()) closeChild()
    const focus = ctx.state.dialogFocus
    ctx.state.dialogFocus = null
    focus?.dispose()
    ctx.state.stopViewport?.(); ctx.state.stopViewport = null
    ctx.state.backdrop.remove()
    ctx.state.backdrop = null
    deps.onClosed?.(ctx.state.openedFrom)
    focus?.restoreFocus()
  }


  function returnToList(): void {
    const packId = ctx.state.view.kind === 'pack' ? ctx.state.view.packId : null
    ctx.state.view = { kind: 'list' }
    render()
    const origin = [...(ctx.state.backdrop?.querySelectorAll<HTMLElement>('.so-pack-card') ?? [])]
      .find(card => card.dataset.managerFocus === `pack:${packId}`)
    if (origin) origin.focus({ preventScroll: true })
    else ctx.state.dialogFocus?.focusInitial()
  }


  /** Register the nested layer before moving focus; every exit path disposes it. */
  function manageChildDialog(modal: HTMLElement, canEscape: () => boolean = () => true, opener?: HTMLElement | null): () => void {
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-modal', 'true')
    const closeChild = () => {
      focus.dispose()
      ctx.state.childDialogs.delete(closeChild)
      modal.remove()
      focus.restoreFocus()
    }
    const focus = manageDialogFocus(modal, { opener, onEscape: () => { if (canEscape()) closeChild() } })
    ctx.state.childDialogs.add(closeChild)
    focus.focusInitial()
    return closeChild
  }


  function refreshIfOpen(): void {
    if (ctx.state.backdrop) {
      render()
      ctx.actions.refreshLightbox()
    }
  }


  function commit(next: PluginSettings): void {
    deps.updateSettings(next)
    render()
    ctx.actions.refreshLightbox()
  }


  function render(): void {
    if (!ctx.state.backdrop) return
    const backBtn = ctx.state.backdrop.querySelector('.so-manager-back') as HTMLElement
    const title = ctx.state.backdrop.querySelector('.so-manager-title') as HTMLElement
    const actions = ctx.state.backdrop.querySelector('.so-manager-actions') as HTMLElement
    const body = ctx.state.backdrop.querySelector('.so-manager-body') as HTMLElement
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const restoreAfterRender = Boolean(active && (body.contains(active) || actions.contains(active) || active.closest('.so-popover')))
    const focusKey = restoreAfterRender ? active?.dataset.managerFocus : undefined
    const previousTop = body.scrollTop
    if (renderedView === 'list' && viewKey() !== 'list') listScrollTop = previousTop
    // The status bar lives inside the body; carry its message across the rebuild so results ("已导入…") stay readable.
    const message = body.querySelector('.so-toast')?.textContent ?? ''
    body.innerHTML = ''
    actions.innerHTML = ''
    ctx.state.backdrop.querySelector('.so-manager')?.classList.toggle('so-manager-batch-mode', ctx.state.batchMode)
    ctx.actions.closePopovers()

    // 渲染兜错：任何异常都显示在弹窗里，不留“只有标题栏”的空壳（移动端无控制台可查）
    try {
      if (ctx.state.view.kind === 'pack') {
        const packId = ctx.state.view.packId
        const pack = deps.getSettings().packs.find((p) => p.id === packId)
        if (pack) {
          backBtn.style.display = 'inline-flex'
          title.textContent = pack.name
          ctx.actions.renderPackDetail(body, actions, pack)
          return
        }
        ctx.state.view = { kind: 'list' }
      }
      backBtn.style.display = 'none'
      title.textContent = t('sprite.manager.title', '立绘包管理')
      ctx.actions.renderList(body, actions)
    } catch (err) {
      console.error('[sprite-overlay] 管理弹窗渲染失败', err)
      const msg = el('div', 'so-status')
      msg.textContent = t("sprite.manager.content.error.render", "界面渲染出错：{{p0}}", { p0: err instanceof Error ? err.message : String(err) })
      body.append(msg)
    } finally {
      // Re-rendering the same view keeps its place; a pack opens at its top; going back returns to the card you left.
      const shown = viewKey()
      body.scrollTop = shown === renderedView ? previousTop : shown === 'list' ? listScrollTop : 0
      renderedView = shown
      if (message && !body.querySelector('.so-toast')?.textContent) toast(body, message)
      if (restoreAfterRender && ctx.state.dialogFocus?.isTop()) {
        const candidates = focusKey ? [...ctx.state.backdrop.querySelectorAll<HTMLElement>('[data-manager-focus]')]
          .filter(node => node.dataset.managerFocus === focusKey && !node.matches(':disabled')) : []
        if (candidates.length === 1) candidates[0].focus({ preventScroll: true })
        else ctx.state.dialogFocus.focusInitial()
      }
    }
  }


  function destroy(): void {
    if (ctx.state.destroyed) return
    ctx.state.destroyed = true
    close()
  }

  return { applyBackdropSize, open, onEscape, close, returnToList, manageChildDialog, refreshIfOpen, commit, render, destroy }
}
