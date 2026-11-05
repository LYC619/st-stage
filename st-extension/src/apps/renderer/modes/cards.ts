import type { RendererModeDeps, RendererMount } from '../runtime'
import type { CardsRenderBlock, ChoiceCard } from '../types'
import { t } from '../../../../../core/i18n'

/** 创建只写 textContent 的卡片文本节点。 */
function textElement(tag: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

/** 创建单张选择卡及其命令按钮。 */
function createCard(card: ChoiceCard): HTMLElement {
  const article = document.createElement('article')
  article.className = 'st-render-card'
  article.dataset.cardId = card.id
  article.append(
    textElement('h3', 'st-render-card-title', card.title),
    textElement('p', 'st-render-card-description', card.description),
  )
  if (card.consequence) article.append(textElement('p', 'st-render-card-consequence', card.consequence))
  if (card.branch) {
    const preview = document.createElement('details'); preview.className = 'st-render-card-branch'
    preview.append(textElement('summary', '', t('cardChoices.preview', '预览可能的分支')), textElement('p', '', card.branch))
    article.append(preview)
  }
  const remember = document.createElement('button'); remember.type = 'button'; remember.className = 'st-render-card-remember'
  remember.dataset.cardId = card.id; remember.setAttribute('aria-pressed', 'false'); remember.textContent = t('cardChoices.remember', '记住此选择')
  article.append(remember)
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'st-render-card-select'
  button.dataset.cardId = card.id
  button.setAttribute('aria-pressed', 'false')
  button.textContent = t('cardChoices.insert', '✓ 填入输入框')
  article.append(button)
  return article
}

/** 挂载 SLG 卡片选择界面，选择只写草稿、不发送消息。 */
export function mountCardsMode(root: HTMLElement, block: CardsRenderBlock, deps: RendererModeDeps): RendererMount {
  const section = document.createElement('section')
  section.className = 'st-render-cards'
  const title = textElement('h2', 'st-render-cards-title', block.title)
  const note = textElement('p', 'st-render-cards-note', t('cardChoices.note', '分支是可能的发展。预览或记住选择不会修改主剧情；填入输入框后，仍需你确认发送。'))
  const grid = document.createElement('div')
  grid.className = 'st-render-cards-grid'
  for (const card of block.cards) grid.append(createCard(card))
  const status = textElement('div', 'st-render-cards-status', '')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'st-render-cards-reset'; reset.textContent = t('cardChoices.reset', '清除记住的选择')
  section.append(title, note, grid, reset, status)
  root.replaceChildren(section)

  const cards = new Map(block.cards.map((card) => [card.id, card]))
  let destroyed = false
  let remembered = deps.choiceMemory?.read() ?? null
  function showRemembered() {
    for (const element of grid.querySelectorAll<HTMLElement>('.st-render-card')) {
      const selected = element.dataset.cardId === remembered
      element.classList.toggle('st-render-card-saved', selected)
      const button = element.querySelector<HTMLButtonElement>('.st-render-card-remember')!
      button.setAttribute('aria-pressed', String(selected)); button.textContent = selected ? t('cardChoices.remembered', '已记住此选择') : t('cardChoices.remember', '记住此选择')
    }
    reset.disabled = remembered === null
  }
  function remember(id: string | null): boolean {
    const result = deps.choiceMemory?.write(id)
    if (result && !result.ok) { status.textContent = result.error; status.className = 'st-render-cards-status st-render-cards-status-error'; return false }
    remembered = id; showRemembered(); return true
  }
  showRemembered()
  if (remembered) status.textContent = t('cardChoices.restored', '已恢复上次记住的选择；未写入输入框。')

  /** 同步单选视觉与 aria-pressed；空 ID 表示当前草稿不再归属任何卡片。 */
  function setSelected(selectedId: string | null): void {
    for (const element of Array.from(grid.querySelectorAll<HTMLElement>('.st-render-card'))) {
      const selected = selectedId !== null && element.dataset.cardId === selectedId
      element.classList.toggle('st-render-card-selected', selected)
      element.querySelector<HTMLButtonElement>('.st-render-card-select')?.setAttribute('aria-pressed', String(selected))
    }
  }

  /** 处理卡片命令并仅在草稿写入成功后更新单选视觉状态。 */
  function onClick(event: MouseEvent): void {
    if (destroyed || !(event.target instanceof Element)) return
    const button = event.target.closest<HTMLButtonElement>('.st-render-card-select, .st-render-card-remember, .st-render-cards-reset')
    if (!button || !root.contains(button)) return
    if (deps.choiceMemory && !deps.choiceMemory.isCurrent()) { status.textContent = t('cardChoices.stale', '聊天或消息已变化，请重新打开当前消息。'); return }
    if (button === reset) {
      if (remember(null)) { setSelected(null); status.textContent = t('cardChoices.cleared', '已清除选择；输入框和聊天记录保持原样。') }
      return
    }
    const card = cards.get(button.dataset.cardId ?? '')
    if (!card) return
    if (button.classList.contains('st-render-card-remember')) {
      if (remember(card.id)) {
        status.className = 'st-render-cards-status st-render-cards-status-success'
        status.textContent = deps.choiceMemory ? t('cardChoices.saved', '选择已保存；未写入输入框。') : t('cardChoices.local', '选择仅在本次打开时保留，当前消息缺少可用于恢复的身份。')
      }
      return
    }
    const result = deps.insertDraft?.(card.action) ?? { ok: false as const, error: t('cardChoices.noComposer', '未找到 SillyTavern 输入框。') }
    if (!result.ok) {
      setSelected(null)
      status.textContent = result.error
      status.className = 'st-render-cards-status st-render-cards-status-error'
      return
    }
    setSelected(card.id)
    if (deps.choiceMemory && !remember(card.id)) return
    status.className = 'st-render-cards-status st-render-cards-status-success'
    status.textContent = `${t('cardChoices.inserted', '已填入，请检查后发送：')}${card.title}`
  }

  root.addEventListener('click', onClick)
  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      root.removeEventListener('click', onClick)
    },
  }
}
