// Real SillyTavern only. The caller must supply a loopback server with disposable data.
// Example: node scripts/verify-i18n-browser.mjs --url http://127.0.0.1:18769 --isolated-data
// No host fixtures are substituted. Only named locale-failure scenarios intercept locale files.
import assert from 'node:assert/strict'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
function option(name, fallback) {
  const index = args.indexOf(name)
  return index < 0 ? fallback : args[index + 1]
}
const suppliedUrl = option('--url')
assert.ok(suppliedUrl && args.includes('--isolated-data'), 'Supply --url and --isolated-data; never point this at live user data.')
const url = new URL(suppliedUrl)
assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname), 'Only loopback ST servers are accepted')
assert.ok(!url.username && !url.password, 'Do not put credentials in the URL')
const extension = option('--extension-name', 'baigong-acceptance')
assert.match(extension, /^[a-zA-Z0-9_-]+$/)
const extensionPath = `${url.pathname.replace(/\/$/, '')}/scripts/extensions/third-party/${extension}/`
const localePaths = ['zh-CN', 'en-US'].map(locale => `${extensionPath}locales/${locale}.json`)
const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, 'test-results', 'i18n-browser')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const report = {
  target: url.href, isolatedDataAcknowledged: true, extension, browser: browser.version(), startedAt: new Date().toISOString(),
  scope: 'Real ST host + emitted extension; synthetic test persona/settings only. External assets are blocked. Deeper App/gallery content is intentionally untranslated. Mobile is browser emulation, not physical-device acceptance.',
  scenarios: [],
}
const desktop = { width: 1365, height: 900 }
const mobile = { width: 375, height: 667 }
const cases = [
  { name: 'desktop-en', host: 'en', browser: 'zh-CN', expected: 'en', viewport: desktop, layout: true, switchHost: true },
  { name: 'desktop-zh', host: 'zh-cn', browser: 'en-US', expected: 'zh', viewport: desktop, layout: true },
  { name: 'mobile-en', host: 'en', browser: 'zh-CN', expected: 'en', viewport: mobile, layout: true },
  { name: 'mobile-zh', host: 'zh-cn', browser: 'en-US', expected: 'zh', viewport: mobile, layout: true },
  { name: 'browser-fallback', host: null, browser: 'en-US', expected: 'en', viewport: desktop },
  { name: 'unsupported-host', host: 'fr-fr', browser: 'en-US', expected: 'zh', viewport: desktop },
  { name: 'english-404', host: 'en', browser: 'en-US', expected: 'zh', viewport: desktop, fault: '404' },
  { name: 'english-malformed', host: 'en', browser: 'en-US', expected: 'zh', viewport: desktop, fault: 'malformed' },
  { name: 'english-timeout', host: 'en', browser: 'en-US', expected: 'zh', viewport: desktop, fault: 'timeout' },
  { name: 'both-timeout', host: 'en', browser: 'en-US', expected: 'zh', viewport: desktop, fault: 'both-timeout' },
]
const labels = {
  en: { phone: 'Open phone panel', collapse: 'Collapse phone', back: 'Return home', gallery: 'Manage sprite packs', close: 'Close', overlayClose: 'Close sprite overlay', sprites: 'Open Sprites App', new: 'New', create: 'Create', newTitle: 'New sprite pack', newName: 'Enter pack name…', import: 'Import', share: 'Import a share string', json: 'Choose JSON file…' },
  zh: { phone: '打开手机面板', collapse: '收起手机', back: '返回主屏', gallery: '立绘包管理', close: '关闭', overlayClose: '关闭悬浮窗', sprites: '打开立绘 App', new: '新建', create: '创建', newTitle: '新建立绘包', newName: '输入新包名称…', import: '导入', share: '从分享字符串导入', json: '选择 JSON 文件…' },
}

async function settle(page) {
  await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))))
}
async function bounded(page, selector) {
  const geometry = await page.locator(selector).evaluateAll(nodes => nodes.map(node => {
    const r = node.getBoundingClientRect()
    return { text: node.textContent?.slice(0, 80), x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height, scrollWidth: node.scrollWidth, clientWidth: node.clientWidth, vw: innerWidth, vh: innerHeight }
  }))
  assert.ok(geometry.length, `${selector}: missing`)
  for (const r of geometry) {
    assert.ok(r.width > 0 && r.height > 0 && r.x >= -1 && r.y >= -1 && r.right <= r.vw + 1 && r.bottom <= r.vh + 1, `${selector}: outside viewport ${JSON.stringify(r)}`)
    assert.ok(r.scrollWidth <= r.clientWidth + 1, `${selector}: horizontal overflow ${JSON.stringify(r)}`)
  }
  return geometry
}
async function disjoint(page, selector) {
  const rects = await page.locator(selector).evaluateAll(nodes => nodes.map(n => {
    const r = n.getBoundingClientRect()
    return { text: n.textContent, x: r.x, y: r.y, right: r.right, bottom: r.bottom, width: r.width, height: r.height }
  }).filter(r => r.width && r.height))
  for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
    const a = rects[i], b = rects[j]
    assert.ok(Math.min(a.right, b.right) - Math.max(a.x, b.x) <= 1 || Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y) <= 1, `overlap: ${JSON.stringify(a)} / ${JSON.stringify(b)}`)
  }
}
async function checkLanguage(page, lang) {
  const t = labels[lang]
  assert.equal(await page.locator('.so-phone-fab').getAttribute('aria-label'), t.phone)
  assert.equal(await page.locator('.sprite-overlay-gear').getAttribute('aria-label'), t.gallery)
  assert.equal(await page.locator('.sprite-overlay-close').getAttribute('aria-label'), t.overlayClose)
  assert.equal(await page.locator('.sprite-overlay-sprites').getAttribute('aria-label'), t.sprites)
}
async function screenshot(page, name) {
  await settle(page)
  await page.screenshot({ path: path.join(output, name + '.png') })
}
async function waitForHost(page) {
  // The extension is loaded during getSettings(), before ST may open onboarding.
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady || document.querySelector('dialog.popup .onboarding'))
  const onboarding = page.locator('dialog.popup:has(.onboarding)')
  if (await onboarding.count()) {
    await onboarding.locator('textarea.popup-input').fill('I18n Acceptance')
    const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.status() === 200)
    await onboarding.locator('.popup-button-ok').click()
    await onboarding.waitFor({ state: 'detached' })
    await saved
  }
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
}
async function saveTestSettings(page) {
  const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.status() === 200)
  await page.evaluate(() => window.SillyTavern.getContext().saveSettingsDebounced())
  await saved
}
async function restoreOverlay(page) {
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
  await page.locator('.so-phone-homebtn').click()
  await page.locator('.so-phone-app-icon').filter({ has: page.locator('.so-phone-app-label', { hasText: /^立绘$/ }) }).click()
  const display = page.locator('.so-phone-shell details').filter({ has: page.locator('summary', { hasText: /^显示$/ }) })
  if (!await display.getAttribute('open').then(value => value !== null)) await display.locator('summary').click()
  await page.getByText('把悬浮窗拉回视口', { exact: true }).click()
  assert.equal(await page.locator('#sprite-overlay-root').isVisible(), true)
  await page.locator('.so-phone-close').click()
  await saveTestSettings(page)
}
async function checkLayout(page, scenario, entry) {
  const t = labels[scenario.expected]
  if (!await page.locator('#sprite-overlay-root').isVisible()) await restoreOverlay(page)
  if (await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-close').click()
  await page.locator('.so-phone-fab').click()
  await settle(page)
  assert.equal(await page.locator('.so-phone-close').getAttribute('aria-label'), t.collapse)
  assert.equal(await page.locator('.so-phone-homebtn').getAttribute('aria-label'), t.back)
  entry.phone = await bounded(page, '.so-phone-shell, .so-phone-status, .so-phone-close, .so-phone-homebtn')
  await disjoint(page, '.so-phone-status-title, .so-phone-clock, .so-phone-close')
  await screenshot(page, scenario.name + '-phone')
  await page.locator('.so-phone-close').press('Enter')
  assert.equal(await page.locator('.so-phone-shell').isVisible(), false)
  await page.locator('#sprite-overlay-root').hover()
  entry.overlay = await bounded(page, '#sprite-overlay-root, .sprite-overlay-gear, .sprite-overlay-sprites, .sprite-overlay-close')
  await disjoint(page, '.sprite-overlay-gear, .sprite-overlay-sprites, .sprite-overlay-close')
  await screenshot(page, scenario.name + '-overlay')
  await page.locator('.sprite-overlay-gear').press('Enter')
  await settle(page)
  assert.equal(await page.locator('.so-manager').getAttribute('aria-label'), t.gallery)
  assert.equal(await page.locator('.so-manager-title').textContent(), t.gallery)
  assert.equal(await page.locator('.so-manager-close').getAttribute('aria-label'), t.close)
  // Save before assertions so a layout regression also has useful evidence.
  await screenshot(page, scenario.name + '-gallery')
  entry.gallery = await bounded(page, '.so-manager, .so-manager-header, .so-manager-title, .so-manager-actions, .so-manager-actions > [role="button"], .so-manager-close')
  await disjoint(page, '.so-manager-title, .so-manager-actions, .so-manager-close')
  await disjoint(page, '.so-manager-actions > [role="button"]')
  await page.locator('.so-manager-actions').getByRole('button', { name: t.new + ' ▾', exact: true }).press('Enter')
  assert.equal(await page.locator('.so-popover-title').textContent(), t.newTitle)
  assert.equal(await page.locator('.so-popover input').getAttribute('placeholder'), t.newName)
  assert.equal(await page.locator('.so-popover').getByRole('button').textContent(), t.create)
  entry.newPopup = await bounded(page, '.so-popover, .so-popover input, .so-popover [role="button"]')
  await screenshot(page, scenario.name + '-new')
  await page.keyboard.press('Escape')
  await page.locator('.so-manager-actions').getByRole('button', { name: t.import + ' ▾', exact: true }).click()
  assert.equal(await page.locator('.so-popover-title').first().textContent(), t.share)
  assert.equal(await page.locator('.so-popover').getByRole('button').last().textContent(), t.json)
  entry.importPopup = await bounded(page, '.so-popover, .so-popover textarea, .so-popover [role="button"]')
  await screenshot(page, scenario.name + '-import')
  await page.keyboard.press('Escape')
  await page.locator('.so-manager-close').press('Space')
  assert.equal(await page.locator('.so-manager').count(), 0)
  // Check overlay close through the keyboard, then restore through the real Sprites App.
  await page.locator('.sprite-overlay-close').press('Enter')
  assert.equal(await page.locator('#sprite-overlay-root').isVisible(), false)
  await restoreOverlay(page)
  entry.keyboard = ['phone-close Enter', 'overlay-gear Enter', 'gallery-new Enter', 'gallery-close Space', 'overlay-close Enter', 'Sprites App restore']
}

try {
  for (const scenario of cases.filter(c => !option('--scenario') || c.name === option('--scenario'))) {
    const entry = { name: scenario.name, injectedFault: scenario.fault ?? null, hostPreference: scenario.host, browserLocale: scenario.browser, expected: scenario.expected, viewport: scenario.viewport, localeResponses: [], localeRequests: [], warnings: [], pageErrors: [], blockedExternal: [], injectedRequests: [], requestFailures: [] }
    report.scenarios.push(entry)
    const context = await browser.newContext({ viewport: scenario.viewport, locale: scenario.browser, isMobile: scenario.viewport === mobile, hasTouch: scenario.viewport === mobile })
    const page = await context.newPage()
    page.setDefaultTimeout(12_000)
    page.on('pageerror', e => entry.pageErrors.push(e.message))
    page.on('console', msg => { if (msg.type() === 'warning' && msg.text().includes('[sprite-overlay]')) entry.warnings.push(msg.text()) })
    page.on('request', req => { const u = new URL(req.url()); if (u.pathname.includes('/locales/') && /(?:en-US|zh-CN)\.json$/.test(u.pathname)) entry.localeRequests.push(u.pathname) })
    page.on('response', res => { const u = new URL(res.url()); if (localePaths.includes(u.pathname)) entry.localeResponses.push({ path: u.pathname, status: res.status() }) })
    page.on('requestfailed', req => { if (new URL(req.url()).origin === url.origin) entry.requestFailures.push({ url: new URL(req.url()).pathname, error: req.failure()?.errorText }) })
    await context.route('**/*', async route => {
      const requestUrl = new URL(route.request().url())
      if (requestUrl.origin !== url.origin) { entry.blockedExternal.push(requestUrl.origin); await route.abort(); return }
      const target = requestUrl.pathname === localePaths[1] || scenario.fault === 'both-timeout' && requestUrl.pathname === localePaths[0]
      if (scenario.fault && target) {
        entry.injectedRequests.push({ path: requestUrl.pathname, at: Date.now() })
        if (scenario.fault.endsWith('timeout')) return // Hold only this locale request until context cleanup; the production deadline must unblock startup.
        await route.fulfill({ status: scenario.fault === '404' ? 404 : 200, contentType: 'application/json', body: scenario.fault === '404' ? '{}' : '{ malformed json' })
        return
      }
      await route.continue()
    })
    await context.addInitScript(host => {
      if (!sessionStorage.getItem('i18n-acceptance-seeded')) {
        if (host === null) localStorage.removeItem('language')
        else localStorage.setItem('language', host)
        sessionStorage.setItem('i18n-acceptance-seeded', '1')
      }
    }, scenario.host)
    try {
      const start = Date.now()
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForSelector('.so-phone-fab', { state: 'attached' })
      entry.startupMs = Date.now() - start
      assert.ok(await page.evaluate(() => typeof window.SillyTavern?.getContext === 'function' && typeof window.stStage?.registerApp === 'function'), 'A real initialized ST host and extension are required')
      await waitForHost(page)
      await checkLanguage(page, scenario.expected)
      for (const pathname of localePaths) assert.ok(entry.localeRequests.includes(pathname), `Missing bundle-relative request ${pathname}`)
      assert.ok(entry.localeRequests.every(p => localePaths.includes(p)), `Unexpected locale fallback path: ${entry.localeRequests}`)
      if (!scenario.fault) {
        assert.equal(entry.warnings.length, 0)
        for (const pathname of localePaths) assert.ok(entry.localeResponses.some(r => r.path === pathname && r.status === 200), `${pathname} did not return 200`)
      } else {
        assert.ok(entry.injectedRequests.length > 0)
        assert.ok(entry.warnings.length >= (scenario.fault === 'both-timeout' ? 2 : 1), 'Expected a locale-loader warning')
        if (scenario.fault.endsWith('timeout')) {
          entry.localeDeadlineElapsedMs = Date.now() - Math.min(...entry.injectedRequests.map(r => r.at))
          assert.ok(entry.localeDeadlineElapsedMs >= 2900 && entry.localeDeadlineElapsedMs < 8000, `Unbounded/early locale deadline: ${entry.localeDeadlineElapsedMs}`)
        }
      }
      if (scenario.layout) await checkLayout(page, scenario, entry)
      if (scenario.switchHost) {
        entry.hostSwitches = []
        for (const [value, expected] of [['zh-cn', 'zh'], ['en', 'en']]) {
          await page.locator('#user-settings-button').click()
          await page.locator('#ui_language_select').selectOption(value)
          await page.waitForLoadState('domcontentloaded')
          await page.waitForFunction(v => localStorage.getItem('language') === v && document.querySelector('.so-phone-fab')?.getAttribute('aria-label') === (v === 'en' ? 'Open phone panel' : '打开手机面板'), value)
          await checkLanguage(page, expected)
          await waitForHost(page)
          await page.reload({ waitUntil: 'domcontentloaded' })
          await page.waitForSelector('.so-phone-fab', { state: 'attached' })
          await waitForHost(page)
          await checkLanguage(page, expected)
          assert.equal(await page.evaluate(() => localStorage.getItem('language')), value)
          entry.hostSwitches.push({ value, expected, retainedAfterSecondReload: true })
        }
      }
      assert.deepEqual(entry.pageErrors, [])
      entry.status = 'passed'
      console.log(`PASS ${scenario.name} (${entry.startupMs} ms startup)`)
    } catch (error) {
      entry.status = 'failed'
      entry.error = error.stack
      await screenshot(page, scenario.name + '-failure').catch(() => {})
      console.error(`FAIL ${scenario.name}: ${error.message}`)
    } finally {
      entry.blockedExternal = [...new Set(entry.blockedExternal)]
      await context.close()
      writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
    }
  }
} finally {
  await browser.close()
  report.finishedAt = new Date().toISOString()
  report.passed = report.scenarios.length > 0 && report.scenarios.every(s => s.status === 'passed')
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
assert.ok(report.passed, `Real-ST i18n acceptance failed; inspect ${path.join(output, 'results.json')}`)
console.log(`Real-ST i18n acceptance: ${report.scenarios.length} passed; evidence ${output}`)
