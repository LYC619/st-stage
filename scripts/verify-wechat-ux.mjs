import assert from 'node:assert/strict'
import { expect } from '@playwright/test'

// Runs after the existing reliability flow, in its disposable ST account and network sandbox.
export async function verifyWechatUX({ page, context, saved, openApp, fit, scan, result, out, size }) {
  const svg = (w, h) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="#245b75"/><circle cx="${w / 2}" cy="${h / 2}" r="${Math.min(w,h) / 3}" fill="#ffe1a0"/></svg>`
  let retryCount = 0, late
  await context.route('**/ux-media/*', async route => {
    const name = new URL(route.request().url()).pathname.split('/').at(-1)
    if (name === 'retry' && ++retryCount === 1) return route.fulfill({ status: 404, body: 'missing' })
    await route.fulfill({ contentType: 'image/svg+xml', body: name === 'tall' ? svg(300, 900) : svg(900, 300) })
  })
  await context.route('**/user/images/ux-late.png', route => { late = () => route.fulfill({ contentType: 'image/svg+xml', body: svg(600, 900) }) })
  await page.locator('.so-phone-homebtn').click()
  await saved(() => page.evaluate(() => {
    const ctx = window.SillyTavern.getContext(), data = ctx.extensionSettings.sprite_overlay.apps['wechat-sister']
    const conv = Object.values(data.conversations).find(c => c.characterName === 'Experience B' && c.conversationType !== 'group')
    const image = (name, file = name) => ({ name, description: '测试图片 ' + name, file: location.origin + '/ux-media/' + file })
    data.config.profile.assetGroups = { player: true, contact: true, photo: true }
    data.config.profile.assetOverrides = { ...data.config.profile.assetOverrides, 'photo.bedroom1': '/user/images/ux-late.png' }
    conv.messages = ['wide','tall','retry','sticker'].map(name => ({ sender: 'contact', type: name === 'sticker' ? 'emoji' : 'image', content: name, asset: image(name, name === 'sticker' ? 'wide' : name), time: { day: 1, hour: 12, minute: 0 } }))
    const group = Object.values(data.conversations).find(c => c.conversationType === 'group')
    group.messages = conv.messages.filter(m => ['wide','tall'].includes(m.content)).map(m => ({ ...m, contactId: conv.contactId, authorName: 'Experience B' }))
    data.moments = Array.from({ length: 18 }, (_, i) => ({ id: 'ux-' + i, contactId: conv.contactId, authorName: 'Experience B', text: '阅读位置 ' + i + ' · 沿湖散步，记录今天的天气和心情。', createdAt: Date.now() - i * 60000, likedByPlayer: false, mood: 50, image: i === 4 ? image('动态缺图','retry-moment') : undefined }))
    ctx.saveSettingsDebounced()
  }))
  await context.route('**/ux-media/retry-moment', route => route.fulfill({ status: 404, body: 'missing' }))
  await openApp(); await page.locator('[data-conversation]').filter({ hasText: 'Experience B' }).click()
  await expect(page.locator('.wt-media').nth(2)).toContainText('图片加载失败')
  await page.waitForFunction(() => [...document.querySelectorAll('.wt-media img')].filter(img => !img.hidden).every(img => img.complete && img.naturalWidth))
  const media = await page.locator('.wt-media').evaluateAll(nodes => nodes.map(node => {
    const img = node.querySelector('img'), b = img.getBoundingClientRect(), parent = node.closest('.wt-message').getBoundingClientRect(), box = node.getBoundingClientRect()
    return { name: img.alt, width: b.width, height: b.height, naturalWidth: img.naturalWidth, naturalHeight: img.naturalHeight, fit: getComputedStyle(img).objectFit, max: parent.width * .72, box: box.width }
  }))
  for (const item of media.filter(m => ['wide','tall'].includes(m.name))) {
    assert.equal(item.fit, 'contain'); assert.ok(item.width <= 220 && item.height <= 220 && item.box >= 120 && item.box <= item.max + 1, JSON.stringify(item))
    assert.ok(Math.abs(item.width / item.height - item.naturalWidth / item.naturalHeight) < .02, JSON.stringify(item))
  }
  const sticker = media.find(m => m.name === 'sticker'); assert.equal(sticker.fit, 'contain'); assert.ok(sticker.width <= 110 && sticker.height <= 110)
  result.media = media
  await fit('photo-and-emoji'); await scan('photo-error')
  const retry = page.locator('.wt-media').nth(2); await retry.focus(); await page.keyboard.press('Enter')
  await expect(retry.locator('img')).toBeVisible(); await expect(retry).toBeFocused(); await expect(retry).toHaveAttribute('aria-label', '查看图片：retry')
  assert.equal(retryCount, 2)
  await page.keyboard.press('Enter'); await expect(page.locator('#wt-photo-lightbox')).toBeVisible(); await page.keyboard.press('Escape'); await expect(retry).toBeFocused()
  result.checks.push('photos preserve natural ratios; small stickers contain; failed chat image retries by keyboard and restores lightbox focus')
  await page.screenshot({ path: `${out}/${size.width}-ux-media.png` })
  await page.locator('#wt-back').click(); await page.locator('[data-conversation]').filter({ hasText: '验收群聊' }).click()
  await expect(page.locator('.wt-message-content .wt-media')).toHaveCount(2)
  const groupWidths = await page.locator('.wt-message-content .wt-media').evaluateAll(nodes => nodes.map(node => {
    const row = node.closest('.wt-message').getBoundingClientRect(), box = node.getBoundingClientRect()
    return { name: node.querySelector('img').alt, width: box.width, available: Math.min(row.width * .72,220) }
  }))
  for (const width of groupWidths) assert.ok(width.width >= 120 && width.width <= width.available + 1 && (width.name !== 'wide' || width.width >= width.available - 1), JSON.stringify(width))
  result.groupMedia = groupWidths; await fit('group-photos')
  await page.locator('#wt-back').click(); await page.locator('[data-conversation]').filter({ hasText: 'Experience B' }).click()

  await page.locator('#wt-moments').click()
  await expect(page.locator('#wt-moments-composer')).not.toHaveAttribute('open', '')
  const feed = page.locator('#wt-moments-feed')
  const closedHeight = await feed.evaluate(node => node.clientHeight)
  assert.ok(closedHeight > 70, `Feed height ${closedHeight}`)
  await page.locator('#wt-moments-composer > summary').focus(); await page.keyboard.press('Enter')
  await page.keyboard.press('Tab'); await expect(page.locator('#wt-moments-author')).toBeFocused()
  await page.locator('#wt-moments-author').selectOption({ label: 'Experience B' })
  let publish
  await context.route('**/wechat-experience-api', route => {
    publish = () => route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ text: '新增动态', photo_id: 'bedroom1' }) } }] }) })
  })
  await page.locator('#wt-generate-moment').click(); await expect.poll(() => typeof publish).toBe('function')
  await page.locator('#wt-moments-composer > summary').click()
  const oldLike = page.locator('[data-moment="ux-4"] button[aria-pressed]')
  await oldLike.click(); await oldLike.focus()
  const position = await feed.evaluate(node => {
    const card = node.querySelector('[data-moment="ux-4"]'); node.scrollTop = card.offsetTop - node.offsetTop + 10
    window.__uxCard = card; window.__uxLike = card.querySelector('[aria-pressed]')
    return card.getBoundingClientRect().top - node.getBoundingClientRect().top
  })
  await publish(); await expect(page.locator('.wt-moment')).toHaveCount(19)
  const stable = () => feed.evaluate(node => ({ same: node.querySelector('[data-moment="ux-4"]') === window.__uxCard, focused: document.activeElement === window.__uxLike, liked: window.__uxLike.getAttribute('aria-pressed'), offset: window.__uxCard.getBoundingClientRect().top - node.getBoundingClientRect().top }))
  let state = await stable(); assert.equal(state.same, true); assert.equal(state.focused, true); assert.equal(state.liked,'true'); assert.ok(Math.abs(state.offset - position) <= 1, JSON.stringify({ position, state }))
  // The newly published post has a genuinely pending image request, not an already loaded replacement.
  await expect(page.locator('.wt-moment').first().locator('.wt-moment-image')).toHaveAttribute('src', '/user/images/ux-late.png')
  await expect.poll(() => typeof late).toBe('function'); await late()
  await page.waitForFunction(() => document.querySelector('.wt-moment-image').naturalHeight === 900)
  state = await stable(); assert.ok(Math.abs(state.offset - position) <= 1); assert.equal(state.focused, true)
  result.moments = { closedFeedHeight: closedHeight, anchorBefore: position, anchorAfterLoad: state.offset, retainedFocus: state.focused }
  await fit('moments-anchor'); await scan('moments-error')
  const momentRetry = page.locator('[data-moment="ux-4"] .wt-image-failure button')
  await momentRetry.focus(); await context.unroute('**/ux-media/retry-moment')
  await expect(momentRetry).toBeFocused()
  await page.keyboard.press('Enter'); await expect(page.locator('[data-moment="ux-4"] .wt-moment-image')).toBeVisible()
  await expect(page.locator('[data-moment="ux-4"] .wt-moment-media')).toBeFocused()
  await feed.evaluate(node => { node.scrollTop = 0 }); await page.screenshot({ path: `${out}/${size.width}-ux-moments.png` })
  result.checks.push('Moments composer is keyboard reachable; prepend retains old card, like, focus and visual anchor through delayed image loading; retry recovers')
  await page.keyboard.press('Escape'); await expect(page.locator('#wt-moments')).toBeFocused()

  const targets = await page.locator('.so-phone-back,.so-phone-close').evaluateAll(nodes => nodes.map(node => {
    const b = node.getBoundingClientRect(), pseudo = getComputedStyle(node,'::after')
    const x = b.left + parseFloat(pseudo.left), y = b.top + parseFloat(pseudo.top), w = parseFloat(pseudo.width), h = parseFloat(pseudo.height)
    const misses = []
    for (let dx = 1; dx < w; dx += 7) for (let dy = 1; dy < h; dy += 7) if (!node.contains(document.elementFromPoint(x + dx,y + dy))) misses.push([dx,dy])
    const overlaps = [...document.querySelectorAll('.wechat-nav button')].filter(button => {
      if (!button.checkVisibility()) return false
      const r = button.getBoundingClientRect()
      return Math.min(x + w,r.right) - Math.max(x,r.left) > 0 && Math.min(y + h,r.bottom) - Math.max(y,r.top) > 0
    }).map(button => button.id)
    return { name: node.className, w, h, misses, overlaps, x, y }
  }))
  result.shellTargets = targets
  for (const target of targets) { assert.ok(target.w >= 44 && target.h >= 44); assert.deepEqual(target.misses, [], JSON.stringify(target)); assert.deepEqual(target.overlaps, [], JSON.stringify(target)) }
  const back = targets.find(t => t.name.includes('back')); await page.mouse.click(back.x + 42,back.y + 42); await expect(page.locator('[data-app-id="wechat-sister"]')).toBeVisible()
  const close = targets.find(t => t.name.includes('close')); await page.mouse.click(close.x + 2,close.y + 42); await expect(page.locator('.so-phone-shell')).toBeHidden(); await expect(page.locator('.so-phone-fab')).toBeFocused()
  result.checks.push('44px shell target grids hit their own controls; expanded edges activate home/close and restore focus')
}
