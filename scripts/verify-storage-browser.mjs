// Real host UI, synthetic images only. External requests are blocked.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply --url and --isolated-data; never target daily ST data')
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, 'test-results/storage-browser')
mkdirSync(output, { recursive: true })
const d = JSON.parse(readFileSync(path.join(root, 'st-extension/locales/en-US.json'), 'utf8'))
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ acceptDownloads: true, viewport: { width: 1365, height: 900 } })
await context.addInitScript(() => localStorage.setItem('language', 'en'))
await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
const page = await context.newPage()
page.setDefaultTimeout(15000)
const report = { target: url.href, browser: browser.version(), buildVersion: JSON.parse(readFileSync(path.join(root, 'version.json'))).v,
  scope: 'Real ST emitted extension: explicit migration, image upload/readback, settings save/reload, receipt restore, injected upload failure/cancellation, JSON import. Synthetic data; desktop browser, no physical-device acceptance.', checks: [], pageErrors: [] }
page.on('pageerror', error => report.pageErrors.push(error.message))
page.on('dialog', dialog => dialog.accept())
const button = key => page.locator('.so-storage-dialog').getByRole('button', { name: d.storage[key], exact: true })
async function ready() {
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  await page.waitForSelector('.so-phone-fab', { state: 'attached' })
}
async function saved(action) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.status() === 200)
  await action(); await response
}
async function reload() { await page.reload({ waitUntil: 'domcontentloaded' }); await ready() }
async function snapshot() {
  return page.evaluate(() => JSON.parse(JSON.stringify(window.SillyTavern.getContext().extensionSettings.sprite_overlay)))
}
async function seed(dataUri) {
  await saved(() => page.evaluate(data => {
    const ctx = window.SillyTavern.getContext()
    Object.assign(ctx.extensionSettings.sprite_overlay, { packs: [{ id: 'storage-acceptance', name: 'Storage acceptance', inventoryPrompt: 'Keep this inventory instruction', sprites: [{ tag: 'Smile', url: data }, { tag: 'Wave', url: data }] }] })
    ctx.extensionSettings.sprite_overlay.apps['storage-sentinel'] = { untouched: 'synthetic private app state' }
    ctx.saveSettingsDebounced()
  }, dataUri))
  await reload()
}
async function manager() {
  if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
  await page.locator('.so-phone-homebtn').click()
  await page.locator('.so-phone-app-icon[data-app-id="gallery"]').click()
  await page.getByRole('button', { name: d.apps.gallery.open_manager, exact: true }).click()
}
async function storage() {
  await manager()
  await page.getByRole('button', { name: d.sprite.manager.storage, exact: true }).click()
}
async function download(key, filename) {
  const pending = page.waitForEvent('download')
  await button(key).click()
  const result = await pending, destination = path.join(output, filename)
  await result.saveAs(destination)
  return destination
}
async function backup(name) {
  const destination = await download('download_backup', name)
  await page.locator('.so-storage-dialog').getByLabel(d.storage.confirm_backup, { exact: true }).check()
  return destination
}
async function importJson(name, dataUri) {
  await page.getByRole('button', { name: d.sprite.manager.import + ' ▾', exact: true }).click()
  const chooser = page.waitForEvent('filechooser')
  await page.getByRole('button', { name: d.sprite.manager.choose_json, exact: true }).click()
  await (await chooser).setFiles({ name: 'synthetic.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify({ format: 'sprite-pack@3', name, inventoryPrompt: 'Imported instruction', sprites: [{ tag: 'Smile', data: dataUri }] })) })
}

try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const onboarding = page.locator('dialog.popup:has(.onboarding)')
  await onboarding.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
  if (await onboarding.isVisible()) {
    await onboarding.locator('textarea.popup-input').fill('Storage Acceptance')
    await saved(() => onboarding.locator('.popup-button-ok').click())
  }
  await ready()
  const imageBytes = await page.evaluate(async () => Array.from(new Uint8Array(await (await fetch('/img/user-default.png')).arrayBuffer())))
  const dataUri = 'data:image/png;base64,' + Buffer.from(imageBytes).toString('base64')
  await seed(dataUri)
  const original = await snapshot()
  await storage()
  assert.ok(await button('start').isDisabled(), 'migration requires a downloaded/confirmed backup')
  const backupPath = await backup('before-migration.json')
  let uploads = 0
  const count = request => { if (new URL(request.url()).pathname === '/api/images/upload') uploads++ }
  page.on('request', count)
  await button('start').click()
  await button('download_receipt').waitFor({ state: 'visible' })
  await page.waitForFunction(() => [...document.querySelectorAll('.so-storage-actions button')].some(b => b.textContent === 'Download migration receipt' && !b.disabled))
  page.off('request', count)
  assert.equal(uploads, 1, 'identical images should upload once')
  assert.deepEqual((await snapshot()).packs, original.packs, 'staging must not change settings')
  const receiptPath = await download('download_receipt', 'receipt.json')
  assert.ok(await button('apply').isDisabled(), 'apply requires receipt confirmation')
  await page.locator('.so-storage-dialog').getByLabel(d.storage.confirm_receipt, { exact: true }).check()
  await saved(() => button('apply').click())
  await reload()
  const migrated = await snapshot(), migratedPack = migrated.packs.find(p => p.id === 'storage-acceptance')
  assert.equal(migratedPack.sprites[0].url, migratedPack.sprites[1].url)
  assert.match(migratedPack.sprites[0].url, /^\/user\/images\/sprite_overlay\//)
  assert.equal(migratedPack.inventoryPrompt, 'Keep this inventory instruction')
  const uploaded = await page.evaluate(async source => {
    const response = await fetch(source)
    if (!response.ok) throw new Error('Saved image failed: ' + response.status)
    return Array.from(new Uint8Array(await response.arrayBuffer()))
  }, migratedPack.sprites[0].url)
  assert.deepEqual(uploaded, imageBytes)
  report.checks.push({ name: 'migration-save-reload-image-byte-readback', status: 'passed', uploadedFiles: uploads, imageBytes: imageBytes.length })

  // A later change must survive selective rollback.
  await saved(() => page.evaluate(() => {
    const ctx = window.SillyTavern.getContext(), pack = ctx.extensionSettings.sprite_overlay.packs.find(p => p.id === 'storage-acceptance')
    pack.sprites[1].url = '/img/user-default.png'
    pack.name = 'Later user rename'
    ctx.saveSettingsDebounced()
  }))
  await reload(); await storage()
  await page.locator('.so-storage-restore summary').click()
  await page.getByLabel(d.storage.backup_file, { exact: true }).setInputFiles(backupPath)
  await page.getByLabel(d.storage.receipt_file, { exact: true }).setInputFiles(receiptPath)
  await button('inspect_restore').click()
  await page.waitForFunction(() => document.querySelector('.so-storage-status')?.textContent.includes('1 item(s) can be restored'))
  await backup('before-restore.json')
  await saved(() => button('restore').click())
  await reload()
  const restored = await snapshot(), restoredPack = restored.packs.find(p => p.id === 'storage-acceptance')
  assert.equal(restoredPack.sprites[0].url, dataUri)
  assert.equal(restoredPack.sprites[1].url, '/img/user-default.png')
  assert.equal(restoredPack.name, 'Later user rename')
  assert.deepEqual(restored.apps['storage-sentinel'], original.apps['storage-sentinel'])
  report.checks.push({ name: 'receipt-selective-restore-reload-preserves-later-edits', status: 'passed' })

  await seed(dataUri); await storage(); await backup('before-failure.json')
  await context.route('**/api/images/upload', route => route.fulfill({ status: 503, body: 'synthetic upload failure' }))
  await button('start').click()
  await page.locator('.so-storage-errors li').first().waitFor()
  assert.deepEqual((await snapshot()).packs, original.packs)
  await context.unroute('**/api/images/upload')
  await reload()
  assert.deepEqual((await snapshot()).packs, original.packs)
  report.checks.push({ name: 'upload-failure-keeps-original-settings-after-reload', status: 'passed' })

  await storage(); await backup('before-cancel.json')
  let cancelRoute
  const intercepted = new Promise(resolve => { cancelRoute = resolve })
  let releaseRoute
  const held = new Promise(resolve => { releaseRoute = resolve })
  await context.route('**/api/images/upload', async route => { cancelRoute(); await held; await route.abort().catch(() => {}) })
  await button('start').click(); await intercepted
  await button('cancel').click(); releaseRoute()
  await context.unroute('**/api/images/upload')
  assert.deepEqual((await snapshot()).packs, original.packs)
  await reload()
  assert.deepEqual((await snapshot()).packs, original.packs)
  report.checks.push({ name: 'cancel-staging-keeps-original-settings-after-reload', status: 'passed' })

  await manager()
  await saved(() => importJson('Imported storage fixture', dataUri))
  await reload()
  const imported = (await snapshot()).packs.find(p => p.name === 'Imported storage fixture')
  assert.ok(imported)
  assert.match(imported.sprites[0].url, /^\/user\/images\/sprite_overlay\//)
  assert.equal(imported.inventoryPrompt, 'Imported instruction')
  const beforeFailedImport = (await snapshot()).packs
  await manager()
  await context.route('**/api/images/upload', route => route.fulfill({ status: 503, body: 'synthetic upload failure' }))
  await importJson('Failed import must not install', dataUri)
  await page.getByText(d.storage.errors.prepare_failed.replace('{{count}}', '1'), { exact: true }).waitFor()
  await context.unroute('**/api/images/upload')
  await reload()
  assert.deepEqual((await snapshot()).packs, beforeFailedImport)
  report.checks.push({ name: 'json-import-localizes-before-install-and-failure-is-atomic', status: 'passed' })
  assert.deepEqual(report.pageErrors, [])
  report.status = 'passed'
  console.log(`Storage acceptance: ${report.checks.length} checks passed`)
} catch (error) {
  report.status = 'failed'; report.error = error.stack
  await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {})
  console.error(error.stack); process.exitCode = 1
} finally {
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
