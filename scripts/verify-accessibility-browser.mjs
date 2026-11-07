// Scoped automated checks, not a full WCAG or human screen-reader acceptance.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { isolatedReady } from './isolated-browser-ready.mjs'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply a disposable ST loopback URL and --isolated-data')
const url = new URL(option('--url'))
assert.notEqual(url.port, '18771', '18771 is reserved for user testing')
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
      await isolatedReady(page)
    }
    async function openApp(id) {
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await page.locator(`.so-phone-app-icon[data-app-id="${id}"]`).press('Enter')
      if (id === 'wechat-sister') await page.locator('[data-conversation="direct:avatar:a11y-fixture.png"]').click()
    }
    async function scan(name, selector) {
      await expect(page.locator(selector)).toBeVisible()
      const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const compact = rule => ({ id: rule.id, impact: rule.impact, help: rule.help, helpUrl: rule.helpUrl, nodes: rule.nodes.map(node => ({ target: node.target, html: node.html, failureSummary: node.failureSummary })) })
      entry.scans.push({ name, axeVersion: result.testEngine.version, violations: result.violations.map(compact), incomplete: result.incomplete.map(compact), passedRules: result.passes.length })
      // Retain browser-computed evidence for uncertain nodes without suppressing axe rules.
      entry.scans.at(-1).nodeReview = []
      for (const rule of result.incomplete) for (const node of rule.nodes) {
        if (node.target.length !== 1 || typeof node.target[0] !== 'string') continue
        const target = page.locator(node.target[0]).first()
        const evidence = await target.evaluate(element => {
          const style = getComputedStyle(element), bounds = element.getBoundingClientRect(), backgrounds = []
          let current = element
          while (current) { const css = getComputedStyle(current); backgrounds.push({ tag: current.tagName, color: css.backgroundColor, image: css.backgroundImage, opacity: css.opacity }); current = current.parentElement }
          const ids = (element.getAttribute('aria-controls') || '').split(/\s+/).filter(Boolean)
          return { text: element.textContent, label: element.getAttribute('aria-label'), foreground: style.color,
            backgrounds, bounds: bounds.toJSON(), controls: ids.map(id => ({ id, exists: !!document.getElementById(id) })),
            centerHit: document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2)?.outerHTML.slice(0, 300) }
        })
        const item = { rule: rule.id, target: node.target, reason: node.failureSummary, ...evidence }
        if (node.failureSummary?.includes('Element has no value')) {
          const original = await target.inputValue()
          await target.evaluate(element => { element.value = 'Aa 123' })
          const populated = await new AxeBuilder({ page }).include(node.target[0]).withRules(['color-contrast']).analyze()
          item.populatedContrast = { violations: populated.violations.map(compact), incomplete: populated.incomplete.map(compact) }
          await target.evaluate((element, value) => { element.value = value }, original)
          assert.equal(populated.violations.length, 0, 'populated input contrast: ' + node.target[0])
        }
        entry.scans.at(-1).nodeReview.push(item)
      }
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
        const contactId = 'avatar:a11y-fixture.png', scopeKey = 'direct:' + contactId
        s.apps['wechat-sister'] = {
          config: { profile: { preset: 'general', openingMessage: 'Synthetic accessibility check.', contextMessageCount: 0, useBuiltinAssets: true, assetOverrides: { 'photo.bedroom1': '/user/images/a11y/photo.png' } } },
          contacts: { [contactId]: { id: contactId, name: 'A11y Contact', card: { name: 'A11y Contact', avatar: 'a11y-fixture.png' } } },
          conversations: { [scopeKey]: { scopeKey, contactId, characterName: 'A11y Contact', conversationType: 'direct', memberIds: [contactId], currentDay: 1,
          state: { mood: 60, interest: 15, contactLocation: '', playerLocation: '', money: 0 }, messages: [
            { sender: 'sister', type: 'text', content: 'Synthetic accessibility check.', time: { day: 1, hour: 19, minute: 0 } },
            { sender: 'sister', type: 'image', content: 'bedroom1', time: { day: 1, hour: 19, minute: 0 } },
            { sender: 'player', type: 'red_packet', content: '20', time: { day: 1, hour: 19, minute: 1 } },
          ], } },
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
      await page.locator('#wt-settings-btn').press('Enter')
      await expect(page.locator('#wt-close-settings')).toBeFocused()
      await scan('wechat-settings', '#wt-settings-modal')
      const advanced = page.getByText('提示词 · 查看、编辑与恢复默认', { exact: true }); await advanced.click()
      await scan('wechat-profile-settings', '#wt-settings-modal')
      await page.locator('#wt-btn-save-settings').focus()
      await scan('wechat-settings-footer', '#wt-settings-modal')
      await page.keyboard.press('Escape')
      await expect(page.locator('#wt-settings-btn')).toBeFocused()
      entry.keyboardChecks.push('settings Escape restores its opener')
      await page.locator('#wt-emoji-btn').press('Enter')
      await expect(page.locator('#wt-tab-player')).toBeFocused()
      await expect(page.locator('#wt-emoji-grid button')).toHaveCount(15)
      await expect(page.locator('#wt-emoji-btn')).toHaveAttribute('aria-expanded', 'true')
      await scan('wechat-emojis', '.so-phone-shell')
      await page.keyboard.press('Tab'); await expect(page.locator('#wt-tab-contact')).toBeFocused()
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
      await expect.poll(() => page.locator('#wt-scroll img').evaluateAll((images, src) => images.filter(img => img.getAttribute('src') === src).length, chosenEmoji)).toBe(1)
      await expect(page.locator('#wt-emoji-drawer')).toBeHidden()
      await expect(page.locator('#wt-emoji-btn')).toBeFocused()
      await expect(page.locator('#wt-typing-badge')).toBeHidden({ timeout: 15000 })
      await emojiSaved
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openApp('wechat-sister')
      await expect.poll(() => page.locator('#wt-scroll img').evaluateAll((images, src) => images.filter(img => img.getAttribute('src') === src).length, chosenEmoji)).toBe(1)
      entry.keyboardChecks.push('both emoji lists are reachable; Escape and selection restore the opener')
      entry.keyboardChecks.push('chosen contact emoji retains its image after a saved reload')
      await page.locator('#wt-packet-btn').press('Enter')
      await expect(page.locator('#wt-custom-amt')).toBeFocused()
      await page.locator('#wt-packet-close').focus()
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
      const popovers = page.locator('.so-manager [aria-haspopup="dialog"]')
      for (let i = 0; i < await popovers.count(); i++) {
        const opener = popovers.nth(i)
        if (!await opener.isVisible() || await opener.isDisabled()) continue
        assert.equal(await opener.getAttribute('aria-controls'), null)
        await opener.click()
        const controls = await opener.getAttribute('aria-controls')
        if (controls) await expect(page.locator('#' + controls)).toBeVisible()
        await scan('gallery-popover-' + i, '.so-manager')
        await page.keyboard.press('Escape')
        assert.equal(await opener.getAttribute('aria-controls'), null)
      }
      entry.keyboardChecks.push('gallery popup references exist only while the popup is mounted')
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
