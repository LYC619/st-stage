import type { RendererModeDeps, RendererMount } from '../runtime'
import type { CardsRenderBlock, ChoiceCard } from '../types'

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
  const button = document.createElement('button')
  button.type = 'button'
  button.className = 'st-render-card-select'
  button.dataset.cardId = card.id
  button.setAttribute('aria-pressed', 'false')
  button.textContent = '✓ 填入输入框'
  article.append(button)
  return article
}

/** 挂载 SLG 卡片选择界面，选择只写草稿、不发送消息。 */
export function mountCardsMode(root: HTMLElement, block: CardsRenderBlock, deps: RendererModeDeps): RendererMount {
  const section = document.createElement('section')
  section.className = 'st-render-cards'
  const title = textElement('h2', 'st-render-cards-title', block.title)
  const grid = document.createElement('div')
  grid.className = 'st-render-cards-grid'
  for (const card of block.cards) grid.append(createCard(card))
  const status = textElement('div', 'st-render-cards-status', '')
  status.setAttribute('role', 'status')
  status.setAttribute('aria-live', 'polite')
  section.append(title, grid, status)
  root.replaceChildren(section)

  const cards = new Map(block.cards.map((card) => [card.id, card]))
  let destroyed = false

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
    const button = event.target.closest<HTMLButtonElement>('.st-render-card-select')
    if (!button || !root.contains(button)) return
    const card = cards.get(button.dataset.cardId ?? '')
    if (!card) return
    const result = deps.insertDraft?.(card.action) ?? { ok: false as const, error: '未找到 SillyTavern 输入框。' }
    if (!result.ok) {
      setSelected(null)
      status.textContent = result.error
      status.className = 'st-render-cards-status st-render-cards-status-error'
      return
    }
    setSelected(card.id)
    status.className = 'st-render-cards-status st-render-cards-status-success'
    status.textContent = `已填入，请检查后发送：${card.title}`
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
