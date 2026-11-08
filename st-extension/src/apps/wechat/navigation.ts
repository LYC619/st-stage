export type WeChatPage = 'chats' | 'contacts' | 'moments'
const pages: WeChatPage[] = ['chats', 'contacts', 'moments']
const ids = { chats: 'wt-conversations', contacts: 'wt-address-book', moments: 'wt-moments-page' }
const tabs = { chats: 'wt-tab-chats', contacts: 'wt-tab-contacts', moments: 'wt-moments' }
const titles = { chats: '微信', contacts: '通讯录', moments: '朋友圈' }

export function createWeChatNavigation(root: HTMLElement, select: (page: WeChatPage) => void) {
  const el = (id: string) => root.querySelector<HTMLElement>('#' + id)!
  let page: WeChatPage = 'chats'
  const menu = el('wt-plus-menu'), plus = el('wt-plus')
  function closeMenu(restore = false) {
    const open = !menu.hidden; menu.hidden = true; plus.setAttribute('aria-expanded', 'false')
    if (restore && open) plus.focus()
  }
  plus.onclick = () => {
    menu.hidden = !menu.hidden; plus.setAttribute('aria-expanded', String(!menu.hidden))
    if (!menu.hidden) menu.querySelector<HTMLButtonElement>('button')?.focus()
  }
  menu.onkeydown = event => {
    const buttons = [...menu.querySelectorAll<HTMLButtonElement>('button')], index = buttons.indexOf(document.activeElement as HTMLButtonElement)
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeMenu(true) }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') { event.preventDefault(); buttons[(index + (event.key === 'ArrowDown' ? 1 : buttons.length - 1)) % buttons.length].focus() }
    if (event.key === 'Tab') closeMenu()
  }
  const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node) && !plus.contains(event.target as Node)) closeMenu() }
  root.addEventListener('pointerdown', outside)
  for (const name of pages) {
    const tab = el(tabs[name]); tab.onclick = () => select(name)
    tab.onkeydown = event => {
      const index = pages.indexOf(name)
      const next = event.key === 'ArrowRight' ? (index + 1) % 3 : event.key === 'ArrowLeft' ? (index + 2) % 3 : event.key === 'Home' ? 0 : event.key === 'End' ? 2 : -1
      if (next < 0) return
      event.preventDefault(); select(pages[next]); el(tabs[pages[next]]).focus()
    }
  }
  return {
    page: () => page, closeMenu,
    show(next: WeChatPage) {
      page = next; closeMenu(); el('wt-chat').hidden = true; el('wt-back').hidden = true
      el('wt-bottom-nav').hidden = false; plus.hidden = false; el('wt-contact-name').textContent = titles[next]
      for (const name of pages) {
        el(ids[name]).hidden = name !== next
        el(tabs[name]).setAttribute('aria-selected', String(name === next)); el(tabs[name]).tabIndex = name === next ? 0 : -1
      }
    },
    showChat() {
      closeMenu(); for (const name of pages) el(ids[name]).hidden = true
      el('wt-bottom-nav').hidden = true; plus.hidden = true; el('wt-chat').hidden = false; el('wt-back').hidden = false
    },
    destroy() { root.removeEventListener('pointerdown', outside) },
  }
}
