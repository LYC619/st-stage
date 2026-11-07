// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { WeChatPipeline } from './pipeline'
import { addMoment } from './moments'

let f: ReturnType<typeof mountWeChat>
afterEach(() => { f?.app.unmount?.(); vi.restoreAllMocks(); document.body.replaceChildren() })
const photo = { name: '旅行照片', description: '湖边的树', file: 'https://example.test/lake.png' }
const event = (image: HTMLElement, type: string) => image.dispatchEvent(new Event(type))

describe('media recovery and incremental Moments', () => {
  it('keeps a failed chat photo, keyboard focus and immutable asset through a reply, then retries and opens it', async () => {
    f = mountWeChat()
    f.b.messages.push({ sender: 'contact', type: 'image', content: 'lake', asset: { ...photo }, time: { day: 1, hour: 12, minute: 0 } })
    vi.spyOn(WeChatPipeline.prototype, 'requestContactReply').mockResolvedValue({ messages: [{ type: 'text', content: 'later reply' }] })
    f.open(f.b.scopeKey!)
    const button = f.el<HTMLButtonElement>('.wt-media'), img = button.querySelector('img')!
    event(img, 'error'); button.focus()
    expect(button.textContent).toContain('图片加载失败'); expect(button.getAttribute('aria-label')).toContain('点击重试：旅行照片')
    expect(img.hidden).toBe(true); expect(img.alt).toBe('旅行照片')
    f.el<HTMLInputElement>('#wt-input-text').value = 'next'; f.el('#wt-send-btn').click()
    button.focus()
    await vi.waitFor(() => expect(f.el('#wt-scroll').textContent).toContain('later reply'))
    expect(f.el('.wt-media')).toBe(button); expect(document.activeElement).toBe(button)
    expect(button.textContent).toContain('图片加载失败')
    button.click(); expect(button.getAttribute('aria-busy')).toBe('true'); expect(f.el('#wt-photo-lightbox').hidden).toBe(true)
    event(img, 'error'); expect(button.textContent).toContain('点击重试')
    button.click(); event(img, 'load'); expect(document.activeElement).toBe(button); expect(img.hidden).toBe(false)
    button.click(); expect(f.el('#wt-photo-lightbox').hidden).toBe(false)
    expect(f.el<HTMLImageElement>('#wt-lightbox-img').alt).toBe(photo.name)
    f.el('#wt-close-lightbox').click(); expect(document.activeElement).toBe(button)
    expect(f.b.messages[0].asset).toEqual(photo)
  })

  it('retains old cards, likes and retry focus while prepending, and recovers a Moments image without losing focus', async () => {
    f = mountWeChat(); const data = f.data(), contact = data.contacts!['avatar:b.png']
    const old = addMoment(data, contact, 'old', photo)
    vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockResolvedValue({ text: 'new' })
    f.el('#wt-moments').click()
    expect(f.el<HTMLDetailsElement>('#wt-moments-composer').open).toBe(false)
    const card = f.el('.wt-moment'), img = card.querySelector<HTMLImageElement>('.wt-moment-image')!
    card.querySelector<HTMLButtonElement>('[aria-pressed]')!.click()
    event(img, 'error'); const retry = card.querySelector<HTMLButtonElement>('.wt-image-failure button')!; retry.focus()
    f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(data.moments).toHaveLength(2))
    expect(f.el('#wt-moments-feed').lastElementChild).toBe(card)
    expect(card.dataset.moment).toBe(old.id); expect(old.likedByPlayer).toBe(true)
    expect(document.activeElement).toBe(retry); expect(img.hidden).toBe(true)
    retry.click(); event(img, 'load')
    expect(document.activeElement).toBe(img.parentElement); expect(img.hidden).toBe(false)
    expect(old.image).toEqual(photo)
  })

  it('does not insert on persistence failure and trims only the expired card at the 200-post cap', async () => {
    f = mountWeChat(); const data = f.data(), contact = data.contacts!['avatar:b.png']
    for (let i = 0; i < 200; i++) addMoment(data, contact, `old ${i}`)
    vi.spyOn(WeChatPipeline.prototype, 'requestMoment').mockResolvedValue({ text: 'new' })
    f.el('#wt-moments').click()
    const feed = f.el('#wt-moments-feed'), cards = [...feed.children], prior = data.moments
    const persist = vi.spyOn(f.ctx, 'setAppData').mockImplementationOnce(() => { throw new Error('save failed') })
    f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(f.el('#wt-moments-feedback').textContent).toBe('save failed'))
    expect(data.moments).toBe(prior); expect([...feed.children]).toEqual(cards)
    persist.mockRestore(); f.el('#wt-generate-moment').click()
    await vi.waitFor(() => expect(data.moments![0].text).toBe('new'))
    expect(feed.children).toHaveLength(200); expect(feed.children[1]).toBe(cards[0]); expect(cards.at(-1)!.isConnected).toBe(false)
  })
})
