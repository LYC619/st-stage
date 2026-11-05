import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'))
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const output = path.resolve('test-results/role-browser'); mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, scope: 'Real isolated ST, synthetic characters, desktop and emulated 320px; not physical-device or usability study.', scenarios: [] }
try {
  for (const language of ['en', 'zh']) for (const width of [1365, 320]) {
    const entry = { language, width, errors: [] }; report.scenarios.push(entry)
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 667 : 900 } })
    await context.addInitScript(lang => localStorage.setItem('language', lang), language === 'zh' ? 'zh-cn' : 'en')
    await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
    const page = await context.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => entry.errors.push(error.message))
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' })
      await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
      await page.waitForSelector('.so-phone-fab', { state: 'attached' })
      const saved = page.waitForResponse(r => r.url().endsWith('/api/settings/save') && r.status() === 200)
      await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext()
        const post = async (endpoint, body) => {
          const response = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) })
          if (!response.ok) throw new Error(endpoint + ': ' + response.status)
          const text = await response.text(); try { return JSON.parse(text) } catch { return text }
        }
        const characters = await post('/api/characters/all', {})
        for (const name of ['Role Alice', 'Role Bob']) if (!characters.some(c => c.name === name)) await post('/api/characters/create', { ch_name: name, first_mes: 'Synthetic role greeting' })
        const settings = ctx.extensionSettings.sprite_overlay
        settings.packs = [{ id: 'role-fixture', name: 'Role pack', sprites: [{ tag: 'Smile', url: '/img/user-default.png' }] }]
        settings.bindings = [{ characterName: 'Role Alice', packIds: ['role-fixture'], enabled: true }]
        settings.enabled = true
        settings.apps.newvar = { enabled: false }
        settings.apps.renderer = { enabled: false }
        settings.apps['wechat-sister'] = { config: {} }
        ctx.saveSettingsDebounced()
      }); await saved
      await page.reload({ waitUntil: 'domcontentloaded' })
      await page.waitForFunction(() => window.SillyTavern?.getContext().characters?.some(c => c.name === 'Role Bob'))
      await page.waitForSelector('.so-phone-fab', { state: 'attached' })
      async function select(name) {
        await page.evaluate(async name => {
          const ctx = window.SillyTavern.getContext()
          await (await import('/script.js')).selectCharacterById(ctx.characters.findIndex(c => c.name === name), { switchMenu: false })
        }, name)
      }
      await select('Role Alice')
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await page.waitForFunction(() => document.querySelector('.so-phone-role-title')?.textContent === 'Role Alice')
      assert.match(await page.locator('[data-role-action="gallery"]').textContent(), /1/)
      assert.match(await page.locator('[data-role-action="wechat"]').textContent(), language === 'en' ? /Local replies/ : /本地回复/)
      await page.locator('[data-role-action="gallery"]').press('Enter')
      assert.ok(await page.locator('.so-phone-app-container').isVisible())
      await page.locator('.so-phone-homebtn').click()
      assert.equal(await page.locator('.so-phone-role-title').textContent(), 'Role Alice')
      await select('Role Bob')
      await page.waitForFunction(() => document.querySelector('.so-phone-role-title')?.textContent === 'Role Bob')
      assert.match(await page.locator('[data-role-action="gallery"]').textContent(), language === 'en' ? /No packs/ : /尚未绑定/)
      const dictionary = JSON.parse(readFileSync(`st-extension/locales/${language === 'en' ? 'en-US' : 'zh-CN'}.json`))
      await page.locator('[data-role-action="gallery"]').press('Enter')
      await page.getByRole('button', { name: dictionary.apps.gallery.open_manager, exact: true }).click()
      await page.locator('.so-manager').waitFor()
      await page.locator('.so-enable-btn').click()
      const boundSaved = page.waitForResponse(r => r.url().endsWith('/api/settings/save') && r.status() === 200)
      await page.locator('.so-enable-pop').getByLabel('Role pack', { exact: false }).check()
      await boundSaved
      await page.keyboard.press('Escape')
      await page.locator('.so-manager-close').press('Enter')
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      assert.match(await page.locator('[data-role-action="gallery"]').textContent(), /1/)
      assert.match(await page.locator('[data-role-action="sprites"]').textContent(), language === 'en' ? /Enabled/ : /已启用/)
      entry.firstConfiguration = 'Overview → Gallery → pack manager; bind synthetic pack → Home'
      const box = await page.locator('.so-phone-role').evaluate(node => {
        const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, width: innerWidth, scroll: node.scrollWidth, client: node.clientWidth }
      })
      assert.ok(box.left >= 0 && box.right <= box.width && box.scroll <= box.client + 1)
      for (const action of await page.locator('.so-phone-role-action').all()) assert.ok((await action.boundingBox()).height >= 44)
      await page.screenshot({ path: path.join(output, `${language}-${width}.png`) })
      assert.deepEqual(entry.errors, [])
      entry.status = 'passed'; console.log(`PASS ${language}-${width}`)
    } catch (error) {
      entry.status = 'failed'; entry.error = error.stack
      await page.screenshot({ path: path.join(output, `${language}-${width}-failure.png`) }).catch(() => {})
      console.error(error.message)
    } finally { await context.close() }
  }
} finally { await browser.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n') }
assert.ok(report.scenarios.every(entry => entry.status === 'passed'))
