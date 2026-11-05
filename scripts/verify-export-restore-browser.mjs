// Extracts a known synthetic export in memory and uses real ST per-type import APIs.
// This is deliberately not labelled a native whole-ZIP importer.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && option('--zip') && args.includes('--isolated-data'), 'Supply --url, --zip and --isolated-data for a fresh test user')
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const root = fileURLToPath(new URL('..', import.meta.url)), output = path.join(root, 'test-results/export-restore-browser')
mkdirSync(output, { recursive: true })
const zip = await JSZip.loadAsync(readFileSync(path.resolve(option('--zip'))))
const files = Object.keys(zip.files).filter(name => !zip.files[name].dir)
// Only the fixture emitted by verify-export-browser is authorized; never import a daily backup.
assert.equal(files.length, 6)
assert.ok(files.every(name => /^(characters\/Export用户角色[^/]*\.png|chats\/Export用户角色[^/]*\/Export聊天[一二]\.jsonl|worlds\/Export用户世界\.json|OpenAI Settings\/Export用户预设\.json|settings\.json)$/.test(name)))
const characterFile = files.find(name => name.startsWith('characters/'))
const chatFiles = files.filter(name => name.startsWith('chats/')).sort()
const fixture = {
  avatar: characterFile.slice('characters/'.length), png: await zip.file(characterFile).async('base64'),
  chats: await Promise.all(chatFiles.map(async name => ({ name: path.basename(name), text: await zip.file(name).async('string') }))),
  world: JSON.parse(await zip.file('worlds/Export用户世界.json').async('string')),
  preset: JSON.parse(await zip.file('OpenAI Settings/Export用户预设.json').async('string')),
  settings: JSON.parse(await zip.file('settings.json').async('string')),
}
const report = { target: url.href, scope: 'Synthetic ZIP extracted in memory, character PNG/chat JSONL imported through ST endpoints, world/preset saved through ST endpoints, minimal regex/world selection applied; browser reload verifies disk-backed results. Not native whole-ZIP import or full account restore.', files, checks: [], pageErrors: [] }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext()
await context.addInitScript(() => localStorage.setItem('language', 'en'))
await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
const page = await context.newPage(); page.setDefaultTimeout(20000)
page.on('pageerror', error => report.pageErrors.push(error.message))
try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' })
  const onboarding = page.locator('dialog.popup:has(.onboarding)')
  await onboarding.waitFor({ state: 'visible', timeout: 6000 }).catch(() => {})
  if (await onboarding.isVisible()) {
    await onboarding.locator('textarea.popup-input').fill('Restore Acceptance')
    const saved = page.waitForResponse(r => r.url().endsWith('/api/settings/save') && r.status() === 200)
    await onboarding.locator('.popup-button-ok').click(); await saved
  }
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  const imported = await page.evaluate(async fixture => {
    const ctx = window.SillyTavern.getContext()
    async function request(endpoint, body, multipart = false) {
      const response = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders({ omitContentType: multipart }), body: multipart ? body : JSON.stringify(body) })
      if (!response.ok) throw new Error(endpoint + ': HTTP ' + response.status)
      const text = await response.text()
      let result; try { result = JSON.parse(text) } catch { result = text }
      if (result?.error) throw new Error(endpoint + ': rejected fixture')
      return result
    }
    const characters = await request('/api/characters/all', {})
    if (characters.some(c => c.name === 'Export用户角色')) throw new Error('Target must be a fresh synthetic user; character already exists')
    const form = new FormData()
    form.append('avatar', new Blob([Uint8Array.from(atob(fixture.png), ch => ch.charCodeAt(0))], { type: 'image/png' }), fixture.avatar)
    form.append('file_type', 'png'); form.append('preserved_name', fixture.avatar)
    const card = await request('/api/characters/import', form, true)
    const avatar = card.file_name.endsWith('.png') ? card.file_name : card.file_name + '.png'
    // Opening a character creates its chat directory through /get before the UI can import chats.
    await request('/api/chats/get', { avatar_url: avatar })
    const chats = []
    for (const [index, chat] of fixture.chats.entries()) {
      const data = new FormData()
      data.append('avatar', new Blob([chat.text], { type: 'application/jsonl' }), chat.name)
      data.append('file_type', 'jsonl'); data.append('avatar_url', avatar)
      data.append('character_name', 'Restore acceptance ' + index); data.append('user_name', 'Acceptance')
      const result = await request('/api/chats/import', data, true)
      if (!result.res || result.fileNames?.length !== 1) throw new Error('Chat import failed')
      chats.push(result.fileNames[0])
    }
    await request('/api/worldinfo/edit', { name: 'Export用户世界', data: fixture.world })
    await request('/api/presets/save', { apiId: 'openai', name: 'Export用户预设', preset: fixture.preset })
    const settings = await request('/api/settings/get', {})
    const full = JSON.parse(settings.settings)
    full.extension_settings.regex = fixture.settings.extension_settings.regex
    full.world_info_settings = fixture.settings.world_info_settings
    await request('/api/settings/save', full)
    return { avatar, chats }
  }, fixture)
  await page.reload({ waitUntil: 'domcontentloaded' })
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  const actual = await page.evaluate(async imported => {
    const ctx = window.SillyTavern.getContext()
    async function post(endpoint, body) {
      const response = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) })
      if (!response.ok) throw new Error(endpoint + ': HTTP ' + response.status)
      return response.json()
    }
    const characters = await post('/api/characters/all', {})
    const chats = []
    for (const name of imported.chats) chats.push(await post('/api/chats/get', { avatar_url: imported.avatar, file_name: name.replace(/\.jsonl$/, '') }))
    const settings = await post('/api/settings/get', {})
    const presetIndex = settings.openai_setting_names.indexOf('Export用户预设')
    return { character: characters.find(c => c.avatar === imported.avatar), chats, world: await post('/api/worldinfo/get', { name: 'Export用户世界' }),
      preset: presetIndex >= 0 ? JSON.parse(settings.openai_settings[presetIndex]) : null,
      settings: JSON.parse(settings.settings) }
  }, imported)
  assert.equal(actual.character.name, 'Export用户角色')
  assert.equal(actual.character.first_mes, 'Synthetic export greeting')
  assert.equal(actual.character.data.extensions.world, 'Export用户世界')
  assert.deepEqual(actual.chats, fixture.chats.map(chat => chat.text.trim().split('\n').map(line => JSON.parse(line))))
  assert.deepEqual(actual.world, fixture.world)
  assert.deepEqual(actual.preset, fixture.preset)
  assert.deepEqual(actual.settings.extension_settings.regex, fixture.settings.extension_settings.regex)
  assert.deepEqual(actual.settings.world_info_settings, fixture.settings.world_info_settings)
  assert.deepEqual(report.pageErrors, [])
  report.checks = ['character-card', 'two-chat-histories', 'linked-worldbook', 'openai-preset', 'regex-and-world-selection'].map(name => ({ name, status: 'passed' }))
  report.imported = imported; report.status = 'passed'
  console.log('Export restore acceptance: 5 checks passed after reload')
} catch (error) {
  report.status = 'failed'; report.error = error.stack; console.error(error.stack); process.exitCode = 1
} finally {
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
