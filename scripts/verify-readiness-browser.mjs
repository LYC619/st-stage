// Shipped bundle in an isolated ST. Synthetic settings/messages only; no AI.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'))
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const output = path.resolve('test-results/readiness-browser'); mkdirSync(output, { recursive: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, scope: 'Real isolated ST and shipped bundle. Synthetic message/pack/recovery state, injected image HTTP error, in-page clipboard sink. No AI, no physical-device claim.', checks: [], errors: [] }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.addInitScript(() => localStorage.setItem('language', 'zh-cn'))
await context.route('**/*', async route => {
  const target = new URL(route.request().url())
  if (target.origin !== url.origin) return route.abort()
  if (target.pathname === '/readiness-broken.png') {
    if (!target.searchParams.has('so_retry')) return route.fulfill({ status: 503, body: 'Synthetic initial image failure' })
    return route.fulfill({ status: 200, contentType: 'image/png', body: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64') })
  }
  return route.continue()
})
const page = await context.newPage(); page.setDefaultTimeout(20000)
page.on('pageerror', error => report.errors.push(error.message))
const character = 'Readiness Acceptance', chat = `Readiness-${Date.now()}`
const packName = 'Readiness Cover', importedName = 'Readiness Imported'
async function ready() {
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  await page.waitForSelector('.so-phone-fab', { state: 'attached' })
}
async function saved(action) {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.ok())
  await Promise.all([action(), response])
}
async function openApp(id) {
  if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
  await page.locator('.so-phone-homebtn').click()
  await page.locator(`.so-phone-app-icon[data-app-id="${id}"]`).press('Enter')
}
async function hostState() {
  return page.evaluate(() => {
    const ctx = window.SillyTavern.getContext(), keys = ['fast_ui_mode', 'reduced_motion', 'noShadows', 'smooth_streaming', 'stream_fade_in', 'streaming_fps', 'chat_truncation']
    return { performance: Object.fromEntries(keys.map(key => [key, ctx.powerUserSettings[key]])), disabled: ctx.extensionSettings.disabledExtensions }
  })
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
  report.bundleSha256 = installed.sha
  await saved(() => page.evaluate(async ({ character, chat, packName }) => {
    const ctx = window.SillyTavern.getContext()
    async function post(endpoint, body) {
      const response = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) })
      if (!response.ok) throw new Error(endpoint + ': HTTP ' + response.status)
      const text = await response.text(); try { return JSON.parse(text) } catch { return text }
    }
    let characters = await post('/api/characters/all', {})
    if (!characters.some(c => c.name === character)) {
      await post('/api/characters/create', { ch_name: character, first_mes: 'Readiness synthetic greeting' })
      characters = await post('/api/characters/all', {})
    }
    const avatar = characters.find(c => c.name === character).avatar
    const block = JSON.stringify({ version: 1, mode: 'gal', scene: '算式测试', beats: [{ speaker: '测试', text: 'x<y+3 且 z>4' }] })
    await post('/api/chats/get', { avatar_url: avatar })
    await post('/api/chats/save', { avatar_url: avatar, ch_name: character, file_name: chat, force: true,
      chat: [{ user_name: 'Acceptance', character_name: character, chat_metadata: {} }, { name: character, is_user: false, is_system: false, send_date: '2026-11-04T00:00:00Z', mes: '[立绘:Broken]\n\n```json\n<STStageRender>' + block + '</STStageRender>\n```' }] })
    const settings = ctx.extensionSettings.sprite_overlay
    settings.enabled = true; settings.spriteDisplayMode = 'inline'; settings.hideTagInMessage = false
    settings.packs = [
      { id: 'readiness-broken', name: 'Retry fixture', sprites: [{ tag: 'Broken', url: location.origin + '/readiness-broken.png' }] },
      { id: 'readiness-cover', name: packName, coverTag: 'Cover', sprites: [{ tag: 'First', url: location.origin + '/img/user-default.png?first' }, { tag: 'Cover', url: location.origin + '/img/user-default.png?cover' }] },
    ]
    settings.bindings = [{ characterName: character, packIds: ['readiness-broken'], enabled: true }]
    settings.apps.renderer = { enabled: false, typewriter: false }
    settings.apps.butler = { version: 2, performanceModeOn: true, activeTransaction: { corrupted: true }, pendingExperiment: { corrupted: true }, history: [] }
    ctx.saveSettingsDebounced()
  }, { character, chat, packName }))
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready()
  await page.waitForFunction(name => window.SillyTavern.getContext().characters.some(c => c.name === name), character)
  await page.evaluate(async ({ character, chat }) => {
    const ctx = window.SillyTavern.getContext()
    await (await import('/script.js')).selectCharacterById(ctx.characters.findIndex(c => c.name === character), { switchMenu: false })
    await window.SillyTavern.getContext().openCharacterChat(chat)
  }, { character, chat })
  const broken = page.locator('#chat .so-inline-image').first()
  await expect(broken).toHaveClass(/so-inline-image-error/)
  await page.evaluate(() => { window.__readinessImage = document.querySelector('#chat .so-inline-image') })
  await openApp('renderer')
  await page.getByLabel('启用渲染', { exact: true }).check()
  await expect(page.locator('#chat .st-stage-renderer')).toContainText('x<y+3 且 z>4')
  await page.screenshot({ path: path.join(output, 'renderer.png') })
  await page.getByLabel('启用渲染', { exact: true }).uncheck()
  assert.ok(await page.evaluate(() => window.__readinessImage === document.querySelector('#chat .so-inline-image')), 'Restoration must retain the actual image node')
  await page.locator('.so-phone-close').click()
  await broken.press('Enter')
  await expect(broken).not.toHaveClass(/so-inline-image-error/)
  assert.match(await broken.locator('img').getAttribute('src'), /so_retry=/)
  report.checks.push({ name: 'renderer-comparison-text-and-restored-image-keyboard-retry', status: 'passed' })

  const originalHost = await hostState()
  await openApp('butler')
  const warning = page.locator('.so-butler-pending[role="note"]')
  await expect(warning).toContainText('保存的恢复记录已损坏')
  await expect(warning).toContainText('上次扩展排查的恢复记录已损坏')
  await saved(() => page.evaluate(() => window.SillyTavern.getContext().saveSettingsDebounced()))
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openApp('butler')
  await expect(warning).toContainText('保存的恢复记录已损坏')
  assert.deepEqual(await hostState(), originalHost)
  await page.screenshot({ path: path.join(output, 'butler-warning.png') })
  await saved(() => warning.getByRole('button', { name: '我已检查，清除此提示', exact: true }).press('Enter'))
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openApp('butler')
  await expect(warning).toHaveCount(0)
  assert.deepEqual(await hostState(), originalHost)
  report.checks.push({ name: 'butler-recovery-warning-persists-and-acknowledgement-only-clears-notice', status: 'passed' })

  await openApp('gallery')
  const d = JSON.parse(readFileSync('st-extension/locales/zh-CN.json'))
  await page.getByRole('button', { name: d.apps.gallery.open_manager, exact: true }).click()
  const packCard = page.locator('.so-pack-card').filter({ has: page.locator('.so-card-info > b', { hasText: packName }) })
  assert.equal(await packCard.locator('.so-card-cover img').getAttribute('alt'), 'Cover')
  await packCard.press('Enter')
  // Capture the actual UI-generated string without replacing the user's clipboard.
  await page.evaluate(() => Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText: async text => { window.__readinessShare = text } } }))
  await page.getByRole('button', { name: '复制分享串', exact: true }).press('Enter')
  await page.waitForFunction(() => typeof window.__readinessShare === 'string')
  const share = await page.evaluate(() => window.__readinessShare)
  assert.match(share, /\|@cover=Cover\|/)
  await page.locator('.so-manager-back').press('Enter')
  await page.getByRole('button', { name: d.sprite.manager.import + ' ▾', exact: true }).click()
  await page.getByPlaceholder(d.sprite.manager.share_placeholder, { exact: true }).fill(share.replace('stpack2:' + packName + '|', 'stpack2:' + importedName + '|'))
  await saved(() => page.locator('.so-popover').getByRole('button', { name: d.sprite.manager.import, exact: true }).press('Enter'))
  const imported = await page.evaluate(name => window.SillyTavern.getContext().extensionSettings.sprite_overlay.packs.find(pack => pack.name === name), importedName)
  assert.equal(imported.coverTag, 'Cover'); assert.deepEqual(imported.sprites.map(sprite => sprite.tag), ['First', 'Cover'])
  await page.locator('.so-manager-back').press('Enter')
  const importedCard = page.locator(`[data-manager-focus="pack:${imported.id}"]`)
  assert.equal(await importedCard.locator('.so-card-cover img').getAttribute('alt'), 'Cover')
  await page.screenshot({ path: path.join(output, 'shared-cover.png') })
  report.checks.push({ name: 'share-ui-encode-import-and-cover-with-original-order', status: 'passed' })
  assert.deepEqual(report.errors, [])
  report.status = 'passed'; console.log(`Readiness acceptance: ${report.checks.length} passed`)
} catch (error) {
  report.status = 'failed'; report.error = error.stack; console.error(error.stack); process.exitCode = 1
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
} finally {
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
