// Run: node scripts/verify-maintenance-browser.mjs
// Uses one isolated system Edge session, production modules/CSS and synthetic data only.
// Screenshots and traces are written under the ignored test-results/ directory.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'
import { build } from 'esbuild'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, 'test-results', 'maintenance-browser')
mkdirSync(output, { recursive: true })
const built = await build({
  stdin: {
    contents: `
      import { createVariableHud } from './st-extension/src/variable-hud.ts'
      import { cloudExportApp } from './st-extension/src/apps/cloud-export/export-app.ts'
      import { openImageStorageDialog } from './st-extension/src/image-storage-dialog.ts'
      import { createDefaultSettings } from './core/types.ts'
      const rows = (count) => Object.fromEntries(Array.from({length: count}, (_, i) => ['variable-' + i, 'value-' + i]))
      const audit = globalThis.audit = {
        state: { x: 331, y: 623, open: true }, sections: [], writes: [], hud: null,
        lateRead: null, unsubscribeCount: 0, storageWrites: 0, compositionEvents: [],
      }
      audit.createHud = (count = 80) => {
        audit.hud?.dispose()
        audit.writes = []
        audit.sections = [{ source: 'Newvar', root: rows(count), notice: '' }]
        audit.hud = createVariableHud({
          readSections: () => audit.lateRead ?? audit.sections,
          subscribe: (refresh) => { audit.refresh = refresh; return () => { audit.unsubscribeCount++ } },
          readState: () => ({ ...audit.state }),
          writeState: (state) => { audit.state = state; audit.writes.push(state) },
        })
      }
      audit.grow = () => { audit.sections[0].root = rows(300); audit.refresh() }
      audit.mountSearch = () => {
        const container = document.createElement('main')
        container.style.cssText = 'max-width:440px;margin:16px auto;padding:12px'
        document.body.append(container)
        audit.searchApp = cloudExportApp({
          listCharacters: async () => ['Alice', 'Bob', '\u963f\u73cd'].map((name, i) => ({id: i + '.png', name, avatar: i + '.png', chats: []})),
          listChats: async () => [], listWorldbooks: async () => [],
          loadSettingsAssets: async () => ({presets: [], regex: null}),
        })
        audit.searchApp.mount(container, { toast: () => {} })
        audit.search = container.querySelector('input.so-app-input')
        for (const type of ['compositionstart', 'compositionupdate', 'compositionend']) {
          audit.search.addEventListener(type, () => audit.compositionEvents.push(type))
        }
        audit.removeSearch = () => { audit.searchApp.unmount(); container.remove() }
      }
      audit.mountStorage = () => {
        audit.settings = { ...createDefaultSettings(), packs: [{id:'synthetic', name:'synthetic', sprites:[{tag:'one', url:'data:image/png;base64,QUFB'}]}] }
        audit.storage = openImageStorageDialog({
          adapter: { getStoredSettingsForBackup: () => audit.settings },
          getSettings: () => audit.settings,
          updateSettings: (next) => { audit.settings = next; audit.storageWrites++ },
          saveDataUri: async () => '/user/images/synthetic.png', onClosed: () => {},
        })
      }
    `,
    resolveDir: root, loader: 'ts',
  },
  bundle: true, format: 'iife', platform: 'browser', write: false,
})
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 375, height: 667 }, acceptDownloads: true })
const page = await context.newPage()
const errors = []
page.on('pageerror', (error) => errors.push(error.message))
page.setDefaultTimeout(10_000)
await context.tracing.start({ screenshots: true, snapshots: true })
const report = { browser: browser.version(), hud: [], search: [], storage: [] }

async function layout() {
  await page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))))
}

async function visible(selector) {
  const rect = await page.locator(selector).evaluate((node) => {
    const rect = node.getBoundingClientRect()
    return { left: rect.left, top: rect.top, right: rect.right, bottom: rect.bottom, width: rect.width, height: rect.height, vw: innerWidth, vh: innerHeight }
  })
  assert.ok(rect.width > 0 && rect.height > 0, selector + ' is blank')
  assert.ok(rect.left >= -0.5 && rect.top >= -0.5 && rect.right <= rect.vw + 0.5 && rect.bottom <= rect.vh + 0.5,
    selector + ' outside viewport: ' + JSON.stringify(rect))
  return rect
}

async function searchState(value, caret = value.length) {
  const actual = await page.evaluate(() => {
    const input = globalThis.audit.search
    return { same: input === document.querySelector('input.so-app-input'), focused: document.activeElement === input,
      value: input.value, start: input.selectionStart, end: input.selectionEnd }
  })
  assert.deepEqual(actual, { same: true, focused: true, value, start: caret, end: caret })
  report.search.push(actual)
}

try {
  await context.route('**/*', (route) => route.fulfill({ contentType: 'text/html', body: '<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body></body></html>' }))
  await page.goto('https://st-stage.test/')
  await page.addStyleTag({ content: readFileSync(path.join(root, 'style.css'), 'utf8') })
  await page.addStyleTag({ content: 'body{margin:0;background:#303034;color:#eee;font:14px Arial,sans-serif} input,button{font:inherit} input{max-width:100%}' })
  await page.addScriptTag({ content: built.outputFiles[0].text })

  for (const [width, height] of [[375, 667], [360, 740], [390, 844], [844, 390], [1366, 900]]) {
    await page.setViewportSize({ width, height })
    await page.evaluate(() => { globalThis.audit.state = { x: 331, y: 623, open: true }; globalThis.audit.createHud() })
    await page.locator('.so-varhud-row').first().waitFor()
    await layout()
    report.hud.push({ panel: await visible('.so-varhud-panel'), close: await visible('.so-varhud-close') })
    await page.screenshot({ path: path.join(output, 'hud-' + width + 'x' + height + '.png') })
    await page.locator('.so-varhud-close').click()
    await layout()
    await visible('.so-varhud-btn')
    assert.equal(await page.evaluate(() => globalThis.audit.state.open), false)
  }
  await page.setViewportSize({ width: 375, height: 667 })
  await page.evaluate(() => { globalThis.audit.state = { x: 331, y: 623, open: true }; globalThis.audit.createHud(1) })
  await layout()
  await page.evaluate(() => globalThis.audit.grow())
  await page.waitForFunction(() => document.querySelectorAll('.so-varhud-row').length === 300)
  await layout()
  await visible('.so-varhud-panel')
  assert.ok(await page.locator('.so-varhud-body').evaluate((node) => node.scrollHeight > node.clientHeight))
  const head = await page.locator('.so-varhud-head').boundingBox()
  await page.mouse.move(head.x + 20, head.y + 10)
  await page.mouse.down()
  await page.mouse.move(374, 666, { steps: 5 })
  await page.mouse.up()
  await layout()
  await visible('.so-varhud-panel')
  await visible('.so-varhud-close')
  await page.setViewportSize({ width: 667, height: 375 })
  await page.evaluate(() => { visualViewport.dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll')) })
  await layout()
  await visible('.so-varhud-panel')
  await visible('.so-varhud-close')
  const writesAfterDispose = await page.evaluate(() => {
    const audit = globalThis.audit
    audit.lateRead = new Promise((done) => { audit.resolveLate = done })
    audit.hud.refresh()
    audit.hud.dispose()
    audit.hud.dispose()
    audit.resolveLate([{ source: 'late', root: { late: true }, notice: '' }])
    return audit.writes.length
  })
  await page.evaluate(() => { dispatchEvent(new Event('resize')); visualViewport.dispatchEvent(new Event('scroll')) })
  await layout()
  assert.equal(await page.locator('#st-stage-varhud').count(), 0)
  assert.equal(await page.evaluate(() => globalThis.audit.writes.length), writesAfterDispose)

  await page.setViewportSize({ width: 375, height: 667 })
  await page.evaluate(() => globalThis.audit.mountSearch())
  await page.locator('.cloud-export-character').first().waitFor()
  const input = page.locator('input.so-app-input')
  await input.click()
  let typed = ''
  for (const key of 'Alice') { await page.keyboard.type(key); typed += key; await searchState(typed) }
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.press('ArrowLeft')
  await page.keyboard.type('X')
  await searchState('AliXce', 4)
  await page.keyboard.press('Backspace')
  await searchState('Alice', 3)
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: 'https://st-stage.test' })
  await page.evaluate(() => navigator.clipboard.writeText('Bob'))
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Control+V')
  await searchState('Bob')
  assert.equal(await page.locator('.cloud-export-character').count(), 1)
  await page.keyboard.press('Control+A')
  await page.keyboard.press('Backspace')
  await searchState('')
  const cdp = await context.newCDPSession(page)
  await cdp.send('Input.imeSetComposition', { text: '\u963f', selectionStart: 1, selectionEnd: 1 })
  await searchState('\u963f')
  assert.equal(await page.locator('.cloud-export-character').count(), 3)
  await cdp.send('Input.imeSetComposition', { text: '\u963f\u73cd', selectionStart: 2, selectionEnd: 2 })
  await searchState('\u963f\u73cd')
  assert.equal(await page.locator('.cloud-export-character').count(), 3)
  await cdp.send('Input.insertText', { text: '\u963f\u73cd' })
  await searchState('\u963f\u73cd')
  assert.equal(await page.locator('.cloud-export-character').count(), 1)
  const compositionEvents = await page.evaluate(() => globalThis.audit.compositionEvents)
  for (const event of ['compositionstart', 'compositionupdate', 'compositionend']) assert.ok(compositionEvents.includes(event))
  report.compositionEvents = compositionEvents
  await page.screenshot({ path: path.join(output, 'search-mobile.png') })
  await cdp.detach()
  await page.evaluate(() => globalThis.audit.removeSearch())

  await page.evaluate(() => globalThis.audit.mountStorage())
  for (const [width, height] of [[375, 667], [360, 740], [844, 390], [1366, 900]]) {
    await page.setViewportSize({ width, height })
    await layout()
    report.storage.push(await visible('.so-storage-dialog'))
    assert.ok(await page.locator('.so-storage-dialog').evaluate((node) => node.scrollWidth <= node.clientWidth))
    await page.locator('.so-storage-footer button').scrollIntoViewIfNeeded()
    await visible('.so-storage-footer button')
    await page.screenshot({ path: path.join(output, 'storage-' + width + 'x' + height + '.png') })
  }
  const actions = page.locator('.so-storage-actions button')
  const backupDownload = page.waitForEvent('download')
  await actions.nth(0).click()
  const backup = await backupDownload
  await backup.saveAs(path.join(output, 'synthetic-backup.json'))
  await page.locator('.so-storage-actions input[type=checkbox]').first().check()
  await actions.nth(1).click()
  await actions.nth(3).waitFor({ state: 'visible' })
  assert.equal(await page.evaluate(() => globalThis.audit.storageWrites), 0)
  const receiptDownload = page.waitForEvent('download')
  await actions.nth(3).click()
  const receipt = await receiptDownload
  await receipt.saveAs(path.join(output, 'synthetic-receipt.json'))
  await page.locator('[data-confirm=receipt]').check()
  await actions.nth(4).click()
  assert.equal(await page.evaluate(() => globalThis.audit.storageWrites), 1)
  assert.equal(await page.evaluate(() => globalThis.audit.settings.packs[0].sprites[0].url), '/user/images/synthetic.png')
  await page.locator('.so-storage-footer button').click()
  assert.equal(await page.locator('.so-storage-dialog').count(), 0)
  assert.deepEqual(errors, [])
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2))
  console.log('PASS: 5 HUD viewports; growth, drag, rotation, disposal; keyboard, caret, paste, native composition; 4 storage layouts and backup/apply workflow.')
  console.log('Artifacts: ' + output)
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
  throw error
} finally {
  await context.tracing.stop({ path: path.join(output, 'trace.zip') })
  await browser.close()
}
