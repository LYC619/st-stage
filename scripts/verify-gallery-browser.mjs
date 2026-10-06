// Run only against a disposable real SillyTavern host; this replaces synthetic test packs.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply --url and --isolated-data; never use daily ST data')
const url = new URL(option('--url'))
assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, 'test-results/gallery-browser')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const report = { target: url.href, browser: browser.version(), buildVersion: JSON.parse(readFileSync(path.join(root, 'st-distribution/version.json'))).v,
  scope: 'Real ST host and emitted extension; isolated synthetic packs, local image and file picker. Upload preview is cancelled before conversion/upload. Mobile is browser emulation.', scenarios: [] }
const cases = ['en', 'zh'].flatMap(language => ['desktop', 'mobile'].map(size => ({ name: `${size}-${language}`, language, size })))
const interpolate = (text, params) => text.replace(/\{\{(\w+)\}\}/g, (_, key) => String(params[key]))

async function bounded(page, selector) {
  const rects = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect()
    return { text: node.textContent?.slice(0, 60), x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height, sw: node.scrollWidth, cw: node.clientWidth, vw: innerWidth, vh: innerHeight }
  }))
  assert.ok(rects.length, selector)
  for (const r of rects) assert.ok(r.w > 0 && r.h > 0 && r.x >= -1 && r.y >= -1 && r.right <= r.vw + 1 && r.bottom <= r.vh + 1 && r.sw <= r.cw + 1, `${selector}: overflow ${JSON.stringify(r)}`)
  return rects
}
async function focused(locator) { assert.ok(await locator.evaluate(node => node === document.activeElement), `Focus not on ${await locator.getAttribute('class')}; actual=${await locator.evaluate(() => document.activeElement?.outerHTML.slice(0, 250))}`) }
async function trapped(page, selector) {
  for (const key of ['Tab', 'Shift+Tab']) for (let i = 0; i < 18; i++) {
    await page.keyboard.press(key)
    assert.ok(await page.locator(selector).evaluate(node => node.contains(document.activeElement)), `${key} escaped ${selector}`)
  }
}
async function saved(page, action) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.status() === 200)
  await action(); await response
}
async function ready(page) {
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady || document.querySelector('dialog.popup .onboarding'))
  const onboarding = page.locator('dialog.popup:has(.onboarding)')
  if (await onboarding.count()) {
    await onboarding.locator('textarea.popup-input').fill('Gallery Acceptance')
    await saved(page, () => onboarding.locator('.popup-button-ok').click())
  }
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  await page.waitForSelector('.so-phone-fab', { state: 'attached' })
}

try {
  for (const scenario of cases.filter(c => !option('--scenario') || c.name === option('--scenario'))) {
    const entry = { ...scenario, status: 'running', pageErrors: [] }; report.scenarios.push(entry)
    const d = JSON.parse(readFileSync(path.join(root, 'st-extension/locales', scenario.language === 'en' ? 'en-US.json' : 'zh-CN.json')))
    const m = d.sprite.manager, c = m.content
    const context = await browser.newContext({ viewport: scenario.size === 'mobile' ? { width: 375, height: 667 } : { width: 1365, height: 900 }, isMobile: scenario.size === 'mobile', hasTouch: scenario.size === 'mobile' })
    await context.addInitScript(language => localStorage.setItem('language', language), scenario.language === 'en' ? 'en' : 'zh-cn')
    await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
    const page = await context.newPage(); page.setDefaultTimeout(12000)
    page.on('pageerror', error => entry.pageErrors.push(error.message))
    const shot = label => page.screenshot({ path: path.join(output, `${scenario.name}-${label}.png`) })
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready(page)
      // All fields touched belong to the throwaway test user's extension settings.
      await saved(page, () => page.evaluate(() => {
        const ctx = window.SillyTavern.getContext(), settings = ctx.extensionSettings.sprite_overlay
        Object.assign(settings, { galleryFoldByRole: false, packs: ['Alice', 'Bob', 'Clara'].map(name => ({ id: `acceptance-${name}`, name: `Acceptance ${name}`, customTags: ['Favorite'], sprites: [{ tag: 'Smile', url: '/img/user-default.png' }, { tag: 'Wave', url: '/img/user-default.png' }] })) })
        ctx.saveSettingsDebounced()
      }))
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page)
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await page.locator('.so-phone-app-icon[data-app-id="gallery"]').press('Enter')
      const opener = page.getByRole('button', { name: d.apps.gallery.open_manager, exact: true })
      await opener.press('Enter')
      await trapped(page, '.so-manager')
      const search = page.locator('.so-pack-filter-search')
      assert.equal(await search.getAttribute('placeholder'), c.filter.packs_placeholder)
      await search.fill('Acceptance')
      await search.press('Enter')
      assert.equal(await page.locator('.so-pack-card').count(), 3)
      await focused(search)
      entry.filters = await bounded(page, '.so-pack-filters, .so-pack-filter-search, .so-pack-filter-kind')
      await shot('filters')
      const cards = page.locator('.so-pack-card')
      await cards.nth(0).focus(); await page.keyboard.press('ArrowRight'); await focused(cards.nth(1))
      await page.keyboard.press('End'); await focused(cards.nth(2))
      await page.keyboard.press('Home'); await focused(cards.nth(0))

      const tags = page.getByRole('button', { name: m.tags, exact: true })
      await tags.press('Enter')
      assert.equal(await page.locator('.so-tag-manager').getAttribute('aria-modal'), 'true')
      await trapped(page, '.so-tag-manager')
      entry.tags = await bounded(page, '.so-tag-manager-panel, .so-tag-manager-new, .so-tag-manager-pack')
      await shot('tags'); await page.keyboard.press('Escape'); await focused(tags)
      assert.equal(await page.locator('.so-manager').count(), 1)

      await cards.nth(0).press('Enter')
      const detail = page.locator('.so-manager-body details').filter({ has: page.getByText(c.info.title, { exact: true }) })
      await detail.locator('summary').click()
      const name = detail.getByLabel(c.info.name, { exact: true })
      assert.equal(await name.inputValue(), 'Acceptance Alice')
      await name.scrollIntoViewIfNeeded(); entry.metadata = await bounded(page, '.so-meta-row')
      await shot('metadata'); await detail.locator('summary').click()
      const sprites = page.locator('.so-sprite-cell')
      await sprites.nth(0).press('Enter')
      assert.equal(await page.locator('.so-lightbox').getAttribute('aria-label'), d.lightbox.title)
      await page.keyboard.press('ArrowRight')
      assert.equal(await page.locator('.so-lightbox-image').getAttribute('alt'), 'Wave')
      assert.equal(await page.locator('.so-lightbox-caption').textContent(), interpolate(d.lightbox.caption, { tag: 'Wave', index: 2, count: 2 }))
      await trapped(page, '.so-lightbox')
      entry.lightbox = await bounded(page, '.so-lightbox, .so-lightbox-actions, .so-lightbox-close')
      await shot('lightbox'); await page.keyboard.press('Escape'); await focused(sprites.nth(0))

      const add = page.getByRole('button', { name: c.add.title + ' ▾', exact: true })
      await add.press('Enter')
      assert.equal(await add.getAttribute('aria-expanded'), 'true')
      entry.addMenu = await bounded(page, '.so-popover')
      await shot('add-menu')
      const picking = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: c.add.choose_images, exact: true }).click()
      await (await picking).setFiles({ name: 'Acceptance-Casual-Smile.png', mimeType: 'image/png', buffer: readFileSync(path.join(root, 'test-results/real-st/runtime/public/img/user-default.png')) })
      await page.locator('.so-upload-modal').waitFor()
      await trapped(page, '.so-upload-modal')
      assert.equal(await page.getByLabel(c.upload.conflict_label, { exact: true }).inputValue(), 'skip')
      await page.getByLabel(c.upload.auto_split, { exact: true }).check()
      assert.equal(await page.locator('.so-upload-row').getByLabel(c.info.role, { exact: true }).inputValue(), 'Acceptance')
      entry.upload = await bounded(page, '.so-upload-panel, .so-upload-opts, .so-upload-row, .so-upload-actions')
      assert.ok(await page.locator('.so-upload-row input').evaluateAll(nodes => nodes.every(node => node.getBoundingClientRect().width >= 72)), 'Upload-preview inputs are too narrow to edit')
      await shot('upload-preview'); await page.keyboard.press('Escape'); await focused(add)
      assert.equal(await page.locator('.so-upload-modal').count(), 0)
      await page.locator('.so-manager-back').press('Enter')

      const storage = page.getByRole('button', { name: m.storage, exact: true })
      await storage.press('Enter')
      assert.equal(await page.locator('.so-storage-dialog').getAttribute('aria-label'), d.storage.title)
      await trapped(page, '.so-storage-dialog')
      entry.storage = await bounded(page, '.so-storage-dialog')
      const storageAction = await page.locator('.so-storage-actions button').first().boundingBox()
      assert.ok(storageAction && storageAction.width >= 100 && storageAction.height < 100, `Storage action is too narrow: ${JSON.stringify(storageAction)}`)
      await page.locator('.so-storage-dialog button').first().scrollIntoViewIfNeeded()
      assert.ok(await page.locator('.so-storage-dialog button').first().evaluate(node => {
        const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2))
      }), 'Storage is behind the manager')
      await page.locator('.so-storage-dialog').evaluate(node => { node.scrollTop = 0 })
      await shot('storage'); await page.keyboard.press('Escape'); await focused(storage)

      const newTrigger = page.getByRole('button', { name: m.new + ' ▾', exact: true })
      await newTrigger.press('Enter')
      await page.locator('.so-popover input').fill('Acceptance Created')
      await page.locator('.so-popover').getByRole('button', { name: m.create, exact: true }).press('Enter')
      await page.waitForFunction(() => window.SillyTavern.getContext().extensionSettings.sprite_overlay.packs.some(p => p.name === 'Acceptance Created'))
      await page.locator('.so-manager-back').press('Enter')
      const importTrigger = page.getByRole('button', { name: m.import + ' ▾', exact: true })
      await importTrigger.press('Enter')
      const choose = page.waitForEvent('filechooser')
      await page.getByRole('button', { name: m.choose_json, exact: true }).click()
      await (await choose).setFiles({ name: 'acceptance.sprite-pack.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'sprite-pack@3', name: 'Acceptance Imported', sprites: [{ tag: 'Smile', url: '/img/user-default.png' }] })) })
      await page.waitForFunction(() => window.SillyTavern.getContext().extensionSettings.sprite_overlay.packs.some(p => p.name === 'Acceptance Imported'))
      await page.locator('.so-manager-close').press('Space')
      // Returning to the phone remounts the App, so focus should enter its content region.
      assert.ok(await page.locator('.so-phone-screen').evaluate(node => node.contains(document.activeElement)), `Focus escaped returned Gallery App: ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 250))}`)
      await saved(page, () => page.evaluate(() => window.SillyTavern.getContext().saveSettingsDebounced()))
      assert.deepEqual(entry.pageErrors, [])
      entry.status = 'passed'; console.log(`PASS ${scenario.name}`)
    } catch (error) {
      entry.status = 'failed'; entry.error = error.stack
      await shot('failure').catch(() => {}); console.error(`FAIL ${scenario.name}: ${error.message}`)
    } finally {
      await context.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
    }
  }
} finally {
  await browser.close(); report.passed = report.scenarios.length > 0 && report.scenarios.every(s => s.status === 'passed')
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
assert.ok(report.passed, `Gallery acceptance failed; inspect ${output}`)
console.log(`Real-ST gallery acceptance: ${report.scenarios.length} passed; evidence ${output}`)
