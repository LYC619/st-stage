// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { addMoment } from './moments'
let f: ReturnType<typeof mountWeChat>
afterEach(() => { f?.app.unmount?.(); vi.restoreAllMocks(); document.body.replaceChildren() })
it('navigates three full pages with a keyboard, opens friends and returns while retaining drafts', () => {
  f = mountWeChat()
  expect(f.container.querySelectorAll('#wt-bottom-nav [role=tab]')).toHaveLength(3)
  expect(f.el('#wt-plus-menu').hidden).toBe(true); f.el('#wt-plus').click(); expect(f.el('#wt-plus-menu').hidden).toBe(false)
  f.el('#wt-plus-menu').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); expect(document.activeElement).toBe(f.el('#wt-plus'))
  f.el('#wt-tab-chats').dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }))
  expect(f.el('#wt-address-book').hidden).toBe(false); expect(f.el('#wt-conversations').hidden).toBe(true)
  f.el('[data-friend="avatar:b.png"]').click(); expect(f.el('#wt-bottom-nav').hidden).toBe(true)
  f.el<HTMLInputElement>('#wt-input-text').value = '保留草稿'; f.el('#wt-back').click()
  expect(f.el('#wt-address-book').hidden).toBe(false); expect(f.b.draft).toBe('保留草稿')
  f.el('#wt-tab-contacts').dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }))
  expect(f.el('#wt-moments-page').hidden).toBe(false); expect(f.container.querySelector('[role=dialog]:not([hidden])')).toBeNull()
})
it('shows private visibility and retains liked cards across page switches', () => {
  f = mountWeChat(); addMoment(f.data(), f.data().contacts!['avatar:b.png'], '只想告诉你', undefined, f.b.state, 'private')
  f.el('#wt-moments').click(); const card = f.el('.wt-moment'); expect(card.textContent).toContain('🔒 仅你可见')
  f.el('.wt-moment [aria-pressed]').click(); f.el('#wt-tab-chats').click(); f.el('#wt-moments').click()
  expect(f.el('.wt-moment')).toBe(card); expect(f.el('.wt-moment [aria-pressed]').getAttribute('aria-pressed')).toBe('true')
})
