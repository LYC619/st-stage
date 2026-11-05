// Scoped automated checks, not a full WCAG or human screen-reader acceptance.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply a disposable ST loopback URL and --isolated-data')
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const output = path.resolve(option('--output') || 'test-results/accessibility-browser'); mkdirSync(output, { recursive: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, scope: 'Shipped extension in real isolated ST; axe WCAG 2.0/2.1/2.2 A/AA checks scoped to extension UI. Synthetic settings. No human reader, OS IME, physical device or complete WCAG conformance claim.', scenarios: [] }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const cases = [{ name: 'desktop-en', language: 'en', width: 1365, height: 900 }, { name: 'mobile-zh', language: 'zh-cn', width: 320, height: 667 }]
try {
  for (const scenario of cases.filter(s => !option('--scenario') || s.name === option('--scenario'))) {
    const entry = { ...scenario, status: 'running', scans: [], keyboardChecks: [], pageErrors: [] }; report.scenarios.push(entry)
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height } })
    await context.addInitScript(language => localStorage.setItem('language', language), scenario.language)
    await context.route('**/*', route => {
      const target = new URL(route.request().url())
      if (target.origin !== url.origin) return route.abort()
      if (target.pathname === '/user/images/a11y/photo.png') return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') })
      return route.continue()
    })
    const page = await context.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => entry.pageErrors.push(error.message))
    const d = JSON.parse(readFileSync(`st-extension/locales/${scenario.language === 'en' ? 'en-US' : 'zh-CN'}.json`))
    async function ready() {
      await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
      await page.waitForSelector('.so-phone-fab', { state: 'attached' })
    }
    async function openApp(id) {
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await page.locator(`.so-phone-app-icon[data-app-id="${id}"]`).press('Enter')
    }
    async function scan(name, selector) {
      await expect(page.locator(selector)).toBeVisible()
      const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const compact = rule => ({ id: rule.id, impact: rule.impact, help: rule.help, helpUrl: rule.helpUrl, nodes: rule.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) })
      entry.scans.push({ name, axeVersion: result.testEngine.version, violations: result.violations.map(compact), incomplete: result.incomplete.map(compact), passedRules: result.passes.length })
      console.log(`${scenario.name}/${name}: ${result.violations.length} violations, ${result.incomplete.length} manual-review rules`)
      for (const rule of result.violations) console.log(rule.id, rule.nodes.map(node => node.target.join(' ')).join('; '))
      if (result.violations.length || ['wechat-sister', 'wechat-settings', 'wechat-settings-footer', 'wechat-packet', 'gallery-manager'].includes(name)) {
        await page.screenshot({ path: path.join(output, `${scenario.name}-${name}.png`) })
      }
    }
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready()
      const installed = await page.evaluate(async () => {
        const base = '/scripts/extensions/third-party/baigong-acceptance/'
        return { version: (await (await fetch(base + 'version.json')).json()).v,
          sha: [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(base + 'bundle.js')).arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('') }
      })
      assert.equal(installed.version, report.build)
      assert.equal(installed.sha, createHash('sha256').update(readFileSync('bundle.js')).digest('hex'))
      entry.bundleSha256 = installed.sha
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.ok())
      await page.evaluate(() => {
        const ctx = window.SillyTavern.getContext(), s = ctx.extensionSettings.sprite_overlay
        s.overlayHidden = true
        s.apps['wechat-sister'] = {
          config: { profile: { preset: 'general', openingMessage: 'Synthetic accessibility check.', contextMessageCount: 0, useBuiltinAssets: true, assetOverrides: { 'photo.bedroom1': '/user/images/a11y/photo.png' } } },
          conversations: {}, state: { hasExternalState: false, mood: 60, interest: 15, sisterLocation: '未设定', playerLocation: '未设定', money: 100 },
          messages: [
            { sender: 'sister', type: 'text', content: 'Synthetic accessibility check.', time: { day: 1, hour: 19, minute: 0 } },
            { sender: 'sister', type: 'image', content: 'bedroom1', time: { day: 1, hour: 19, minute: 0 } },
            { sender: 'player', type: 'red_packet', content: '20', time: { day: 1, hour: 19, minute: 1 } },
          ],
        }
        s.apps.butler = { version: 2, performanceModeOn: false, activeTransaction: null, pendingExperiment: null, history: [], recoveryWarnings: ['performance'] }
        s.apps['api'] = { profiles: [] }
        s.apps.newvar = { enabled: false, hideUpdateBlocks: true, schema: { id: 'a11y', name: 'Accessibility', version: 1, variables: [] } }
        ctx.saveSettingsDebounced()
      }); await saved
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready()
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await scan('home', '.so-phone-shell')
      for (const id of ['sprites', 'gallery', 'butler', 'mvu', 'newvar', 'api', 'renderer', 'cloud-export', 'wechat-sister']) {
        await openApp(id)
        if (id === 'cloud-export') await page.locator('[data-export-focus^="character:"]').first().waitFor()
        if (id === 'wechat-sister') await page.locator('#wt-input-text').waitFor()
        await scan(id, '.so-phone-shell')
      }
      await page.locator('#wt-status-pill').press('Enter')
      await expect(page.locator('#wt-close-settings')).toBeFocused()
      await scan('wechat-settings', '#wt-settings-modal')
      const advanced = page.locator('#wt-settings-modal summary'); await advanced.click()
      await scan('wechat-profile-settings', '#wt-settings-modal')
      await page.locator('#wt-btn-save-settings').focus()
      await scan('wechat-settings-footer', '#wt-settings-modal')
      await page.keyboard.press('Escape')
      await expect(page.locator('#wt-status-pill')).toBeFocused()
      entry.keyboardChecks.push('settings Escape restores its opener')
      await page.locator('#wt-emoji-btn').press('Enter')
      await expect(page.locator('#wt-tab-player')).toBeFocused()
      await expect(page.locator('#wt-emoji-grid button')).toHaveCount(15)
      await expect(page.locator('#wt-emoji-btn')).toHaveAttribute('aria-expanded', 'true')
      await scan('wechat-emojis', '.so-phone-shell')
      await page.keyboard.press('Tab'); await expect(page.locator('#wt-tab-sister')).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.locator('#wt-emoji-grid button')).toHaveCount(19)
      await scan('wechat-contact-emojis', '.so-phone-shell')
      await page.keyboard.press('Escape')
      await expect(page.locator('#wt-emoji-btn')).toBeFocused()
      await expect(page.locator('#wt-emoji-btn')).toHaveAttribute('aria-expanded', 'false')
      await page.keyboard.press('Enter')
      const chosenEmoji = await page.locator('#wt-emoji-grid button img').first().getAttribute('src')
      const emojiSaved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.ok())
      await page.locator('#wt-emoji-grid button').first().press('Enter')
      await expect(page.locator('#wt-scroll > div:last-child > div img')).toHaveAttribute('src', chosenEmoji)
      await expect(page.locator('#wt-emoji-drawer')).toBeHidden()
      await expect(page.locator('#wt-emoji-btn')).toBeFocused()
      await expect(page.locator('#wt-typing-badge')).toBeHidden({ timeout: 15000 })
      await emojiSaved
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openApp('wechat-sister')
      await expect.poll(() => page.locator('#wt-scroll img').evaluateAll((images, src) => images.filter(img => img.getAttribute('src') === src).length, chosenEmoji)).toBe(1)
      entry.keyboardChecks.push('both emoji lists are reachable; Escape and selection restore the opener')
      entry.keyboardChecks.push('chosen contact emoji retains its image after a saved reload')
      await page.locator('#wt-packet-btn').press('Enter')
      await expect(page.locator('#wt-packet-close')).toBeFocused()
      await page.keyboard.press('Shift+Tab'); await expect(page.locator('#wt-confirm-packet')).toBeFocused()
      await page.keyboard.press('Tab'); await expect(page.locator('#wt-packet-close')).toBeFocused()
      await scan('wechat-packet', '#wt-packet-modal')
      await page.keyboard.press('Escape')
      await expect(page.locator('#wt-packet-btn')).toBeFocused()
      entry.keyboardChecks.push('packet dialog enters, wraps Tab and returns after Escape')
      const photo = page.locator('#wt-scroll [data-wt-photo]').first()
      await photo.press('Enter'); await expect(page.locator('#wt-close-lightbox')).toBeFocused()
      await scan('wechat-photo', '#wt-photo-lightbox')
      await page.keyboard.press('Tab'); await expect(page.locator('#wt-close-lightbox')).toBeFocused()
      await page.keyboard.press('Escape'); await expect(photo).toBeFocused()
      await page.keyboard.press('Space'); await expect(page.locator('#wt-close-lightbox')).toBeFocused()
      await page.keyboard.press('Escape'); await expect(photo).toBeFocused()
      entry.keyboardChecks.push('photo opens with Enter and Space, traps focus and returns after Escape')
      await openApp('gallery')
      await page.getByRole('button', { name: d.apps.gallery.open_manager, exact: true }).click()
      await scan('gallery-manager', '.so-manager')
      await page.locator('.so-manager-close').press('Enter')
      await openApp('newvar')
      await page.getByRole('button', { name: d.apps.newvar.open_designer, exact: true }).press('Enter')
      await scan('variable-designer', '.so-manager')
      await page.keyboard.press('Escape')
      assert.deepEqual(entry.pageErrors, [])
      entry.status = entry.scans.some(scan => scan.violations.length) ? 'failed' : 'passed'
    } catch (error) { entry.status = 'failed'; entry.error = error.stack; console.error(error.message) }
    finally { await context.close() }
  }
} finally {
  await browser.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
assert.ok(report.scenarios.length && report.scenarios.every(s => s.status === 'passed'), `Accessibility checks failed: ${output}`)
console.log(`Scoped accessibility checks: ${report.scenarios.reduce((sum, s) => sum + s.scans.length, 0)} passed`)
