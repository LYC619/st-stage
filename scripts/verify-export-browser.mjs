// Actual ST and emitted extension; synthetic local assets only. Never use daily data.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import JSZip from 'jszip'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply --url and --isolated-data; never use daily ST data')
const url = new URL(option('--url'))
assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const root = fileURLToPath(new URL('..', import.meta.url)), output = path.join(root, 'test-results/export-browser')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const report = { target: url.href, browser: browser.version(), buildVersion: JSON.parse(readFileSync(path.join(root, 'st-distribution/version.json'))).v,
  scope: 'Real ST with synthetic character, chats, worldbook, preset and regex; native keyboard and actual downloaded ZIP contents. One injected category HTTP failure exercises retry. Mobile is browser emulation. ZIP import is not tested.', scenarios: [] }
const characterName = 'Export用户角色', worldName = 'Export用户世界', presetName = 'Export用户预设'
const world = { entries: { 0: { uid: 0, key: ['测试'], content: '用户世界书正文', comment: '验收世界书', constant: false, disable: true } } }
const preset = { temperature: 0.7, max_tokens: 100, custom_prompt: '用户预设正文' }
const regex = [{ id: 'export-acceptance', scriptName: '用户正则', findRegex: '/never-match-acceptance/g', replaceString: '替换', trimStrings: [], placement: [2], disabled: true }]
const chatNames = ['Export聊天一', 'Export聊天二']
const chats = chatNames.map((name, index) => [{ user_name: 'Acceptance', character_name: characterName, chat_metadata: {} }, { name: characterName, is_user: false, is_system: false, send_date: '2026-10-07T00:00:00.000Z', mes: `用户聊天正文 ${index + 1}` }])
const cases = ['en', 'zh'].flatMap(language => ['desktop', 'mobile'].map(size => ({ name: `${size}-${language}`, language, size })))
async function ready(page) {
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  await page.waitForSelector('.so-phone-fab', { state: 'attached' })
}
async function focused(locator) { assert.ok(await locator.evaluate(node => node === document.activeElement), `Expected focus on ${await locator.getAttribute('data-export-focus')}; actual=${await locator.evaluate(() => document.activeElement?.outerHTML.slice(0, 240))}`) }
async function bounded(locator) {
  await locator.scrollIntoViewIfNeeded()
  const r = await locator.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height, sw: node.scrollWidth, cw: node.clientWidth, vw: innerWidth, vh: innerHeight } })
  assert.ok(r.w > 0 && r.h > 0 && r.x >= -1 && r.y >= -1 && r.right <= r.vw + 1 && r.bottom <= r.vh + 1 && r.sw <= r.cw + 1, `Overflow: ${JSON.stringify(r)}`)
  return r
}
try {
  for (const scenario of cases.filter(c => !option('--scenario') || c.name === option('--scenario'))) {
    const entry = { ...scenario, status: 'running', pageErrors: [] }; report.scenarios.push(entry)
    const d = JSON.parse(readFileSync(path.join(root, 'st-extension/locales', scenario.language === 'en' ? 'en-US.json' : 'zh-CN.json'))).cloudExport
    const context = await browser.newContext({ viewport: scenario.size === 'mobile' ? { width: 375, height: 667 } : { width: 1365, height: 900 }, isMobile: scenario.size === 'mobile', hasTouch: scenario.size === 'mobile', acceptDownloads: true })
    await context.addInitScript(language => localStorage.setItem('language', language), scenario.language === 'en' ? 'en' : 'zh-cn')
    await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
    const page = await context.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => entry.pageErrors.push(error.message))
    const shot = label => page.screenshot({ path: path.join(output, `${scenario.name}-${label}.png`) })
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready(page)
      const avatar = await page.evaluate(async fixture => {
        const ctx = window.SillyTavern.getContext()
        async function post(endpoint, data) {
          const response = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(data) })
          if (!response.ok) throw new Error(`${endpoint}: HTTP ${response.status}`)
          const text = await response.text(); try { return JSON.parse(text) } catch { return text }
        }
        await post('/api/worldinfo/edit', { name: fixture.worldName, data: fixture.world })
        await post('/api/presets/save', { apiId: 'openai', name: fixture.presetName, preset: fixture.preset })
        let characters = await post('/api/characters/all', {})
        if (!characters.some(c => c.name === fixture.characterName)) {
          await post('/api/characters/create', { ch_name: fixture.characterName, first_mes: 'Synthetic export greeting', world: fixture.worldName })
          characters = await post('/api/characters/all', {})
        }
        const character = characters.find(c => c.name === fixture.characterName)
        if (!character?.avatar) throw new Error('Missing synthetic export character')
        for (let i = 0; i < fixture.chatNames.length; i++) await post('/api/chats/save', { avatar_url: character.avatar, ch_name: fixture.characterName, file_name: fixture.chatNames[i], chat: fixture.chats[i], force: true })
        ctx.extensionSettings.regex = fixture.regex
        return character.avatar
      }, { worldName, world, presetName, preset, characterName, chatNames, chats, regex })
      const saved = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.status() === 200)
      await page.evaluate(() => window.SillyTavern.getContext().saveSettingsDebounced()); await saved
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page)
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').press('Enter')
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await page.locator('.so-phone-app-icon[data-app-id="cloud-export"]').press('Enter')
      assert.equal(await page.locator('.so-phone-status-title').textContent(), d.name)
      const app = page.locator('.so-phone-app-container'), tabs = app.getByRole('tab'), search = app.getByRole('textbox')
      const tab = id => app.locator(`[data-export-focus="tab:${id}"]`)
      const control = id => app.locator(`[data-export-focus=${JSON.stringify(id)}]`)
      await control(`character:${avatar}`).waitFor()
      assert.equal(await search.getAttribute('aria-label'), d.search)
      entry.tabs = await bounded(page.locator('.cloud-export-tabs'))
      entry.tabMarkup = await page.locator('.cloud-export-tabs').evaluate(node => node.outerHTML)
      assert.equal(await tabs.count(), 4)
      // Native tab navigation and a single injected HTTP error, followed by the actual ST endpoint.
      let failList = true
      await page.route('**/api/worldinfo/list', route => { if (failList) { failList = false; return route.fulfill({ status: 503, body: 'Synthetic category fault' }) } return route.continue() })
      await tab('characters').focus(); await page.keyboard.press('ArrowRight'); await focused(tab('worldbooks'))
      await app.getByRole('button', { name: d.retry, exact: true }).press('Enter')
      await control(`worldbook:${worldName}.json`).or(control(`worldbook:${worldName}`)).waitFor()
      await focused(app.getByRole('tabpanel'))
      await tab('worldbooks').focus(); await page.keyboard.press('End'); await focused(tab('regex'))
      await page.keyboard.press('Home'); await focused(tab('characters'))
      await search.fill(characterName)
      const character = control(`character:${avatar}`)
      await character.focus(); await page.keyboard.press('Space')
      await page.waitForFunction(() => !document.querySelector('.cloud-export-results')?.closest('[aria-busy="true"]') && document.querySelector('[data-export-focus^="character:"]')?.getAttribute('aria-disabled') !== 'true')
      await focused(character)
      assert.equal(await character.isChecked(), true)
      await control(`chats:${avatar}`).press('Enter')
      await app.locator('.cloud-export-chat input').first().waitFor({ state: 'visible' })
      assert.equal(await app.locator('.cloud-export-chat input:checked').count(), 2)
      entry.character = await bounded(app.locator('.cloud-export-character-name'))
      await shot('character')
      const chat = app.locator('.cloud-export-chat input').first()
      await chat.focus(); await page.keyboard.press('Space'); await focused(chat)
      assert.equal(await chat.isChecked(), false)
      await page.keyboard.press('Space'); await focused(chat)
      await tab('worldbooks').press('Enter'); await search.fill(worldName)
      const book = control(`worldbook:${worldName}.json`).or(control(`worldbook:${worldName}`))
      assert.equal(await book.isChecked(), true, 'Associated worldbook must be selected with the character')
      await book.focus(); await page.keyboard.press('Space'); await focused(book)
      await page.keyboard.press('Space'); await focused(book)
      await tab('presets').press('Enter'); await search.fill(presetName)
      const presetControl = control(`preset:${presetName}.json`)
      await presetControl.focus(); await page.keyboard.press('Space'); await focused(presetControl)
      await tab('regex').press('Enter'); await search.fill('')
      const regexControl = control('regex')
      await regexControl.focus(); await page.keyboard.press('Space'); await focused(regexControl)
      entry.regex = await bounded(regexControl.locator('..')); await shot('selection')
      const exportButton = app.getByRole('button', { name: d.export, exact: true })
      entry.exportButton = await bounded(exportButton)
      const downloading = page.waitForEvent('download')
      await exportButton.press('Enter')
      const download = await downloading
      assert.match(download.suggestedFilename(), /^default-user-\d{8}-\d{6}\.zip$/)
      const zipPath = path.join(output, `${scenario.name}.zip`); await download.saveAs(zipPath)
      await exportButton.waitFor(); await focused(exportButton)
      const zip = await JSZip.loadAsync(readFileSync(zipPath))
      const files = Object.keys(zip.files).filter(name => !zip.files[name].dir).sort()
      const stem = avatar.replace(/\.png$/i, '')
      assert.deepEqual(files, [`characters/${avatar}`, ...chatNames.map(name => `chats/${stem}/${name}.jsonl`), `worlds/${worldName}.json`, `OpenAI Settings/${presetName}.json`, 'settings.json'].sort())
      assert.deepEqual(JSON.parse(await zip.file(`worlds/${worldName}.json`).async('string')), world)
      assert.deepEqual(JSON.parse(await zip.file(`OpenAI Settings/${presetName}.json`).async('string')), preset)
      assert.deepEqual(JSON.parse(await zip.file('settings.json').async('string')), { extension_settings: { regex }, world_info_settings: { world_info: { globalSelect: [worldName] } } })
      for (let i = 0; i < chatNames.length; i++) assert.deepEqual((await zip.file(`chats/${stem}/${chatNames[i]}.jsonl`).async('string')).trim().split('\n').map(line => JSON.parse(line)), chats[i])
      assert.deepEqual(Array.from((await zip.file(`characters/${avatar}`).async('uint8array')).slice(0, 8)), [137, 80, 78, 71, 13, 10, 26, 10])
      entry.archiveFiles = files
      await shot('complete')
      await page.keyboard.press('Escape'); await focused(page.locator('.so-phone-app-icon[data-app-id="cloud-export"]'))
      assert.deepEqual(entry.pageErrors, [])
      entry.status = 'passed'; console.log(`PASS ${scenario.name}`)
    } catch (error) { entry.status = 'failed'; entry.error = error.stack; await shot('failure').catch(() => {}); console.error(`FAIL ${scenario.name}: ${error.message}`) }
    finally { await context.close() }
  }
} finally { await browser.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n') }
assert.ok(report.scenarios.length && report.scenarios.every(entry => entry.status === 'passed'), `Export acceptance failed: ${output}`)
console.log(`Real-ST Export acceptance: ${report.scenarios.length} passed; evidence ${output}`)
