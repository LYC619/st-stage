// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { getScopedConversation } from './wechat-app'
import { WeChatPipeline } from './pipeline'
import { messageToRagText } from './rag'
import { PLAYER_EMOJIS, SISTER_EMOJIS } from './manifest-data'
let fixture: ReturnType<typeof mountWeChat> | undefined
afterEach(() => { fixture?.app.unmount?.(); fixture = undefined; vi.restoreAllMocks(); document.body.replaceChildren() })
function mount() {
  const send = vi.spyOn(WeChatPipeline.prototype, 'requestSisterReply').mockImplementation(() => new Promise(() => {}))
  const f = fixture = mountWeChat(); f.open(f.a.scopeKey!)
  return { ...f, send }
}
function key(key: string, shiftKey = false) {
  const event = new KeyboardEvent('keydown', { key, shiftKey, bubbles: true, cancelable: true })
  document.activeElement!.dispatchEvent(event); return event
}
describe('WeChat keyboard surfaces', () => {
  it('enters and traps the gift dialog, returns focus after Escape and explicit sending', () => {
    const { el, send } = mount(); const opener = el('#wt-packet-btn'); opener.focus(); opener.click()
    expect(document.activeElement).toBe(el('#wt-custom-amt'))
    el('#wt-packet-close').focus(); key('Tab', true); expect(document.activeElement).toBe(el('#wt-confirm-packet'))
    key('Tab'); expect(document.activeElement).toBe(el('#wt-packet-close'))
    expect(key('Escape').defaultPrevented).toBe(true); expect(el('#wt-packet-modal').hidden).toBe(true); expect(document.activeElement).toBe(opener)
    opener.click(); el<HTMLInputElement>('#wt-custom-amt').value = '一杯奶茶'; el('#wt-confirm-packet').click()
    expect(send).toHaveBeenCalledOnce(); expect(el('#wt-packet-modal').hidden).toBe(true); expect(document.activeElement).toBe(opener)
  })
  it('opens images with native buttons and restores their focus after Escape', () => {
    const f = mount(); f.a.messages.push({ sender: 'sister', type: 'image', content: 'bedroom1', time: { day: 1, hour: 19, minute: 0 } }); f.open(f.a.scopeKey!)
    const photo = f.el<HTMLButtonElement>('#wt-scroll button'); photo.focus(); photo.click()
    expect(document.activeElement).toBe(f.el('#wt-close-lightbox')); key('Escape')
    expect(f.el('#wt-photo-lightbox').hidden).toBe(true); expect(document.activeElement).toBe(photo)
  })
  it('moves into emoji drawer and restores its opener after Escape and selection', () => {
    const { el, send } = mount(); const opener = el('#wt-emoji-btn'); opener.click()
    expect(opener.getAttribute('aria-expanded')).toBe('true'); expect(el('#wt-emoji-drawer').contains(document.activeElement)).toBe(true)
    key('Escape'); expect(document.activeElement).toBe(opener)
    opener.click(); el('#wt-emoji-grid button').click()
    expect(send).toHaveBeenCalledOnce(); expect(el('#wt-emoji-drawer').hidden).toBe(true); expect(document.activeElement).toBe(opener)
  })
  it('returns image focus to its replacement when a reply arrives while the lightbox is open', async () => {
    let finish!: (value: { messages: { type: 'text'; content: string }[] }) => void
    const f = mount()
    f.send.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    f.a.messages.push({ sender: 'sister', type: 'image', content: 'bedroom1', time: { day: 1, hour: 19, minute: 0 } }); f.open(f.a.scopeKey!)
    f.el<HTMLInputElement>('#wt-input-text').value = 'hello'; f.el('#wt-send-btn').click()
    const photo = f.el<HTMLButtonElement>('#wt-scroll button'); photo.click()
    finish({ messages: [{ type: 'text', content: 'new reply' }] }); await vi.waitFor(() => expect(photo.isConnected).toBe(false))
    key('Escape'); expect(document.activeElement).toBe(f.el('#wt-scroll button'))
  })
  it.each([0, 1])('preserves chosen contact emoji %s after disabling its group and remounting', index => {
    const f = mount(); f.el('#wt-emoji-btn').click(); f.el('#wt-tab-sister').click()
    const choice = f.el(`#wt-emoji-grid button:nth-child(${index + 1})`), src = choice.querySelector('img')!.src
    choice.click(); expect(f.el<HTMLImageElement>('#wt-scroll .wt-media img').src).toBe(src)
    f.data().config.profile = { assetGroups: { player: true, contact: false, photo: false } }
    f.remount(); f.open(f.a.scopeKey!); expect(f.el<HTMLImageElement>('#wt-scroll .wt-media img').src).toBe(src)
    f.el('#wt-emoji-btn').click(); f.el('#wt-tab-sister').click(); expect(f.el('#wt-emoji-grid').textContent).toContain('未启用')
  })
  it('uses the selected emoji meaning in current prompts and recalled history while retaining legacy behavior', () => {
    const msg = { sender: 'player', type: 'emoji', content: 'angry', emojiSource: 'sister', time: { day: 1, hour: 19, minute: 0 } } as const
    const pipeline = new WeChatPipeline({}, PLAYER_EMOJIS, SISTER_EMOJIS, {})
    const conv = getScopedConversation({ config: {} }, 'Alice')
    expect(pipeline.buildContextMessages([msg], conv.state, 1, '19:00').at(-1)?.content).toContain(SISTER_EMOJIS.angry.description)
    expect(messageToRagText(msg, PLAYER_EMOJIS, SISTER_EMOJIS, {})).toContain(SISTER_EMOJIS.angry.description)
    expect(messageToRagText({ ...msg, emojiSource: undefined }, PLAYER_EMOJIS, SISTER_EMOJIS, {})).toContain(PLAYER_EMOJIS.angry.description)
  })

  it.each(['#wt-packet-btn', '#wt-settings-btn', '#wt-emoji-btn'])('keeps independent surface %s when host switches and closes it on WeChat navigation', opener => {
    const f = mount(); f.el(opener).click(); f.hostChange('B')
    expect(f.el('#wt-contact-name').textContent).toBe('A')
    f.el('#wt-back').click()
    for (const selector of ['#wt-packet-modal', '#wt-settings-modal', '#wt-emoji-drawer']) expect(f.el(selector).hidden).toBe(true)
  })
  it.each(['#wt-packet-btn', '#wt-settings-btn'])('removes focus handling on unmount after %s', opener => {
    const f = mount(); f.el(opener).click(); f.app.unmount?.(); f.container.remove()
    const outside = document.createElement('button'); document.body.append(outside); outside.focus()
    expect(document.activeElement).toBe(outside); expect(key('Escape').defaultPrevented).toBe(false)
  })
})
