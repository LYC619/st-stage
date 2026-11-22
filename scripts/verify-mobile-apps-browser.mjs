// Read-only UI/layout checks on synthetic settings in a disposable local ST.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'
const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'))
const url = new URL(option('--url')); assert.ok(url.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(url.hostname))
const output = path.resolve(option('--output') || 'test-results/mobile-apps-browser'); mkdirSync(output, { recursive: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, scope: 'Real isolated ST, touch-capable Chromium with viewport resizing and synthetic visualViewport panning; no physical device or OS IME claim.', layouts: [], touchChecks: [], errors: [] }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 320, height: 667 }, hasTouch: true, isMobile: true })
await context.addInitScript(() => { try { localStorage.setItem('language', 'zh-cn') } catch {} })
await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
const page = await context.newPage(); page.setDefaultTimeout(15000)
page.on('pageerror', error => report.errors.push(error.message))
const d = JSON.parse(readFileSync('st-extension/locales/zh-CN.json'))
async function ready() { await page.waitForFunction(async () => (await import('/script.js')).settingsReady); await page.locator('.so-phone-fab').waitFor({ state: 'attached' }) }
async function openApp(id) {
  if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').tap()
  await page.locator('.so-phone-homebtn').tap()
  await page.locator(`.so-phone-app-icon[data-app-id="${id}"]`).tap()
}
async function bounds(name, selector, viewport, measureOverflow = true, vertical = true) {
  await page.locator(selector).evaluate(async node => {
    await Promise.all(node.getAnimations().filter(animation => animation.effect?.getTiming().iterations !== Infinity).map(animation => animation.finished.catch(() => {})))
  })
  const metrics = await page.locator(selector).evaluate(node => {
    const rect = node.getBoundingClientRect(), v = window.visualViewport
    return { x: rect.x, y: rect.y, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, overflow: node.scrollWidth - node.clientWidth, viewport: { width: v.width, height: v.height, left: v.offsetLeft, top: v.offsetTop } }
  })
  report.layouts.push({ name, ...viewport, ...metrics })
  assert.ok(metrics.x >= metrics.viewport.left - 1 && metrics.right <= metrics.viewport.left + metrics.viewport.width + 1
    && (!vertical || (metrics.y >= metrics.viewport.top - 1 && metrics.bottom <= metrics.viewport.top + metrics.viewport.height + 1)), `${name} outside viewport: ${JSON.stringify(metrics)}`)
  if (measureOverflow) assert.ok(metrics.overflow <= 2, `${name} horizontal overflow: ${JSON.stringify(metrics)}`)
}
try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready()
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.ok())
  await page.evaluate(() => {
    const ctx = window.SillyTavern.getContext(), settings = ctx.extensionSettings.sprite_overlay
    settings.enabled = false; settings.showPhone = true; settings.phone = { x: 8, y: 8, open: false }
    settings.apps.butler = { version: 2, history: [] }
    const data = settings.apps['wechat-sister']; data.config = { ...data.config, apiKey: '', profile: { preset: 'general', contactName: '手机适配很长的联系人名称'.repeat(5) } }; data.config.characterProfiles = {}
    ctx.saveSettingsDebounced()
  }); await response
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready()
  const ids = await page.locator('.so-phone-app-icon').evaluateAll(nodes => nodes.map(node => node.dataset.appId))
  // Open the home screen first because icons are rendered lazily.
  if (!ids.length) await page.locator('.so-phone-fab').tap()
  const appIds = await page.locator('.so-phone-app-icon').evaluateAll(nodes => nodes.map(node => node.dataset.appId))
  assert.equal(appIds.length, 13)
  for (const viewport of [{ width: 320, height: 667 }, { width: 360, height: 740 }, { width: 390, height: 844 }, { width: 412, height: 915 }, { width: 740, height: 360 }, { width: 320, height: 360 }]) {
    await page.setViewportSize(viewport)
    for (const id of appIds) {
      await openApp(id)
      await bounds(`${id}/shell`, '.so-phone-shell', viewport)
      await bounds(`${id}/app`, '.so-phone-app-container', viewport, true, false)
      if (id === 'wechat-sister') {
        await bounds('wechat/send', '#wt-send-btn', viewport)
        await page.locator('#wt-settings-btn').tap()
        await bounds('wechat/settings', '#wt-settings-modal > div', viewport)
        await page.locator('.wt-profile-settings').scrollIntoViewIfNeeded()
        const select = page.locator('[data-profile-scope]'); await select.selectOption('global')
        const summary = page.locator('.wt-profile-settings summary')
        if (!await summary.evaluate(node => node.parentElement.open)) await summary.tap()
        await page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true }).scrollIntoViewIfNeeded()
        await page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true }).fill('Long contact '.repeat(5))
        await page.locator('#wt-btn-save-settings').scrollIntoViewIfNeeded()
        await bounds('wechat/save', '#wt-btn-save-settings', viewport)
        await page.locator('#wt-btn-save-settings').tap()
      }
    }
    await page.screenshot({ path: path.join(output, `apps-${viewport.width}x${viewport.height}.png`) })
  }
  await page.setViewportSize({ width: 320, height: 667 }); await openApp('wechat-sister')
  await page.locator('#wt-input-text').tap(); await page.locator('#wt-input-text').fill('输入中的草稿')
  await page.setViewportSize({ width: 320, height: 320 }); await bounds('short-viewport/send', '#wt-send-btn', { width: 320, height: 320 })
  await expect(page.locator('#wt-input-text')).toHaveValue('输入中的草稿')
  await page.evaluate(() => {
    const viewport = Object.assign(new EventTarget(), { width: 300, height: 240, offsetLeft: 10, offsetTop: 40 })
    window.__goalViewport = viewport; Object.defineProperty(window, 'visualViewport', { configurable: true, value: viewport }); window.dispatchEvent(new Event('resize'))
  })
  await bounds('offset-viewport/shell', '.so-phone-shell', { width: 300, height: 240 })
  await bounds('offset-viewport/send', '#wt-send-btn', { width: 300, height: 240 })
  report.touchChecks.push('nine apps via tap; form scroll/edit/save; short viewport retains draft; synthetic offset viewport keeps send visible')
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await page.setViewportSize({ width: 320, height: 667 })
  await openApp('api')
  await page.evaluate(() => window.scrollTo(9, 0))
  await page.waitForFunction(() => document.querySelector('.so-phone-shell').getBoundingClientRect().left >= 7)
  await bounds('document-scroll/shell', '.so-phone-shell', { width: 320, height: 667 })
  await page.locator('[data-api-legacy] > summary').tap()
  await page.getByRole('button', { name: d.nativeApi.legacyManage, exact: true }).tap()
  await bounds('api/legacy-manager', '.so-manager', { width: 320, height: 667 })
  await page.getByRole('button', { name: '＋ 添加连接档案', exact: true }).tap()
  await bounds('api/legacy-editor', '.so-manager-body', { width: 320, height: 667 })
  await page.locator('.so-manager-close').tap()
  await openApp('gallery'); await page.getByRole('button', { name: d.apps.gallery.open_manager, exact: true }).tap()
  await bounds('gallery/manager', '.so-manager', { width: 320, height: 667 })
  await page.setViewportSize({ width: 320, height: 320 })
  await bounds('gallery/short-manager', '.so-manager', { width: 320, height: 320 })
  await page.locator('.so-manager-close').tap()
  await page.setViewportSize({ width: 320, height: 667 })
  await openApp('newvar'); await page.getByRole('button', { name: d.apps.newvar.open_designer, exact: true }).tap()
  await bounds('newvar/designer', '.so-manager', { width: 320, height: 667 })
  await page.setViewportSize({ width: 320, height: 320 })
  await bounds('newvar/short-designer', '.so-manager', { width: 320, height: 320 })
  await page.locator('.so-manager-close').tap()
  report.touchChecks.push('legacy API manager/editor, gallery manager and variable designer at 320px; modal short viewport; scrolled transformed host root')
  assert.deepEqual(report.errors, []); report.status = 'passed'
  console.log(`PASS ${report.layouts.length} layout assertions and ${report.touchChecks.length} touch workflows`)
} catch (error) {
  report.status = 'failed'; report.error = error.stack; process.exitCode = 1; console.error(error.stack)
  report.layoutDiagnostic = await page.evaluate(() => ['html', 'body', '.so-manager-backdrop', '.so-manager', '.so-manager-body'].map(selector => {
    const node = document.querySelector(selector); if (!node) return { selector, missing: true }
    const s = getComputedStyle(node)
    return { selector, parent: node.parentElement?.tagName, scrollX, scrollY, rect: node.getBoundingClientRect().toJSON(), display: s.display, position: s.position, width: s.width, height: s.height, padding: s.padding, transform: s.transform, boxSizing: s.boxSizing, style: node.getAttribute('style'), childCount: node.children.length }
  }))
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
} finally { writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n'); await browser.close() }
