import { t } from '../../../core/i18n'
import { unbindPack } from '../../../core/sprite-store'
import { el, nextManagerId, checkboxRow, button } from './ui'
import type { ManagerContext } from './types'

export function createControls(ctx: ManagerContext) {
  const { deps } = ctx


  function closePopovers(): void {
    for (const dispose of ctx.state.popoverListeners) dispose()
    ctx.state.popoverListeners.clear()
    ctx.state.backdrop?.querySelectorAll('.so-popover').forEach((n) => n.remove())
    ctx.state.backdrop?.querySelectorAll('[aria-haspopup="dialog"]').forEach(node => { node.setAttribute('aria-expanded', 'false'); node.removeAttribute('aria-controls') })
    ctx.state.popoverOpener = null
  }


  function closeEnableList(): void {
    ctx.state.enableListOpen = false
    ctx.state.backdrop?.querySelector('.so-enable-btn')?.setAttribute('aria-expanded', 'false')
    ctx.state.backdrop?.querySelector('.so-enable-btn')?.removeAttribute('aria-controls')
    ctx.state.backdrop?.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove())
    if (ctx.state.enableListDocHandler) {
      document.removeEventListener('click', ctx.state.enableListDocHandler, true)
      ctx.state.enableListDocHandler = null
    }
  }


  /**
   * 「启用包」勾选浮层：勾=启用、取消勾=停用，改完浮层原地保持展开——
   * 旧 <select> 每选一次都被整体重渲染销毁、必须重新点开（用户实测反馈）。
   * 每次 render() 后由 renderList 依据 enableListOpen 重建。
   */
  function renderEnableList(): void {
    const header = ctx.state.backdrop?.querySelector('.so-manager-header') as HTMLElement | null
    if (!header) return
    const previousPanel = header.querySelector('.so-enable-pop')
    const active = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const focusKey = active && previousPanel?.contains(active) ? active.dataset.managerFocus : undefined
    header.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove())
    if (!ctx.state.enableListOpen) return
    const characterName = deps.adapter.getCurrentCharacterName()
    if (!characterName) {
      closeEnableList()
      return
    }
    const body = ctx.state.backdrop?.querySelector('.so-manager-body') as HTMLElement
    const settings = deps.getSettings()
    const boundIds = settings.bindings.find((b) => b.characterName === characterName)?.packIds ?? []
    const panel = el('div', 'so-popover so-enable-pop')
    const trigger = ctx.state.backdrop?.querySelector<HTMLElement>('.so-enable-btn')
    panel.id = trigger?.getAttribute('aria-controls') || nextManagerId()
    panel.setAttribute('role', 'dialog')
    panel.setAttribute('aria-label', trigger?.getAttribute('aria-label') ?? '')
    trigger?.setAttribute('aria-expanded', 'true')
    trigger?.setAttribute('aria-controls', panel.id)
    panel.dataset.pop = '启用包'
    const heading = el('div', 'so-popover-title')
    heading.textContent = t("sprite.manager.content.binding.enable_heading", "勾选启用（{{p0}}，即时生效）", { p0: characterName })
    panel.append(heading)
    if (settings.packs.length === 0) {
      const tip = el('div', 'so-status')
      tip.textContent = t("sprite.manager.content.empty.packs", "还没有立绘包，先用「新建」或「导入」。")
      panel.append(tip)
    }
    for (const p of settings.packs) {
      const row = checkboxRow(t("sprite.manager.content.pack.image_count", "{{p0}}（{{p1}} 张）", { p0: p.name, p1: p.sprites.length }), boundIds.includes(p.id), (v) => {
          if (v) ctx.actions.bindPackWithChoices(characterName, p.id, body)
          else ctx.actions.commit(unbindPack(deps.getSettings(), characterName, p.id))
          // 启用被用户取消（冲突确认框选了否）时没有 commit 重渲染，勾选框会与实际不符——按真实状态重建
          renderEnableList()
        })
      row.querySelector<HTMLInputElement>('input')!.dataset.managerFocus = `enable:${p.id}`
      panel.append(row)
    }
    header.append(panel)
    if (focusKey) {
      [...panel.querySelectorAll<HTMLElement>('[data-manager-focus]')]
        .find(node => node.dataset.managerFocus === focusKey)?.focus({ preventScroll: true })
    } else if (active === trigger) {
      panel.querySelector<HTMLElement>('input')?.focus({ preventScroll: true })
    }
    if (!ctx.state.enableListDocHandler) {
      ctx.state.enableListDocHandler = (e: MouseEvent) => {
        const current = ctx.state.backdrop?.querySelector('.so-popover[data-pop="启用包"]')
        const btn = ctx.state.backdrop?.querySelector('.so-enable-btn')
        if (current?.contains(e.target as Node) || btn?.contains(e.target as Node)) return
        closeEnableList()
      }
      document.addEventListener('click', ctx.state.enableListDocHandler, true)
    }
  }


  /** 头部下拉：按钮 + 锚在头部下方靠右的浮层；同时只开一个，Esc/点外部/重渲染关闭 */
  function dropdownButton(label: string, build: (panel: HTMLElement) => void): HTMLElement {
    const panelId = nextManagerId()
    const btn = button(`${label} ▾`, () => {
      const header = ctx.state.backdrop?.querySelector('.so-manager-header')
      if (!header) return
      const existing = header.querySelector(`.so-popover[data-pop="${label}"]`)
      closeEnableList()
      closePopovers()
      if (existing) return
      const panel = el('div', 'so-popover')
      panel.id = panelId
      panel.setAttribute('role', 'dialog')
      panel.setAttribute('aria-label', label)
      panel.dataset.pop = label
      build(panel)
      panel.querySelectorAll<HTMLInputElement | HTMLTextAreaElement>('input, textarea').forEach(input => {
        if (!input.getAttribute('aria-label') && input.placeholder) input.setAttribute('aria-label', input.placeholder)
      })
      header.append(panel)
      ctx.state.popoverOpener = btn
      btn.setAttribute('aria-expanded', 'true')
      btn.setAttribute('aria-controls', panelId)
      ;(panel.querySelector('input, textarea') as HTMLElement | null)?.focus()
      const onDocClick = (e: MouseEvent) => {
        // 点开关按钮本身交给按钮的 toggle 逻辑处理
        if (panel.contains(e.target as Node) || btn.contains(e.target as Node)) return
        closePopovers()
      }
      document.addEventListener('click', onDocClick, true)
      ctx.state.popoverListeners.add(() => document.removeEventListener('click', onDocClick, true))
    })
    btn.setAttribute('aria-haspopup', 'dialog')
    btn.setAttribute('aria-expanded', 'false')
    return btn
  }


  /** 折叠面板：图墙占主位，次要功能区默认收起只露标题（用户实测反馈）。
      传 key 的面板在整体重渲染间保持展开态（实测：点「保存」后面板收起体验差）。 */
  function collapsible(titleText: string, open = false, key = ''): { box: HTMLElement; body: HTMLElement } {
    const box = document.createElement('details')
    box.className = 'so-section so-collapse'
    box.open = key ? ctx.state.openSections.get(key) ?? open : open
    // toggle 只在用户点击后触发（插入前赋值不触发），记录的是真实操作
    if (key) box.addEventListener('toggle', () => ctx.state.openSections.set(key, box.open))
    const summary = document.createElement('summary')
    summary.className = 'so-section-title'
    summary.textContent = titleText
    const inner = el('div', 'so-collapse-body')
    box.append(summary, inner)
    return { box, body: inner }
  }

  return { closePopovers, closeEnableList, renderEnableList, dropdownButton, collapsible }
}
