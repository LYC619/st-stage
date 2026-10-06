// Actual SillyTavern host, synthetic character/chat/settings only. Never use daily data.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2)
const option = (name, fallback) => args.includes(name) ? args[args.indexOf(name) + 1] : fallback
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply --url and --isolated-data; never use daily ST data')
const url = new URL(option('--url'))
assert.ok(['http:', 'https:'].includes(url.protocol) && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const root = fileURLToPath(new URL('..', import.meta.url)), output = path.join(root, 'test-results/variables-browser')
mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const report = { target: url.href, browser: browser.version(), buildVersion: JSON.parse(readFileSync(path.join(root, 'st-distribution/version.json'))).v,
  scope: 'Real ST + emitted extension. Synthetic character and saved chats; definition/edit/reload through actual host. MVU unavailable state is checked when third-party MVU/Tavern Helper is absent. No AI generation. Mobile is browser emulation.', scenarios: [] }
const runId = Date.now()
const cases = ['en', 'zh'].flatMap(language => ['desktop', 'mobile'].map(size => ({ name: `${size}-${language}`, language, size })))
async function ready(page) {
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  await page.waitForSelector('.so-phone-fab', { state: 'attached' })
}
async function saved(page, action, endpoint = '/api/settings/save') {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.status() === 200)
  await action(); await response
}
async function focused(locator) { assert.ok(await locator.evaluate(node => node === document.activeElement), `Expected focus on ${await locator.getAttribute('class')}; actual=${await locator.evaluate(() => document.activeElement?.outerHTML.slice(0, 200))}`) }
async function bounded(locator) {
  await locator.scrollIntoViewIfNeeded()
  const r = await locator.evaluate(node => { const r = node.getBoundingClientRect(); return { x: r.x, y: r.y, right: r.right, bottom: r.bottom, w: r.width, h: r.height, sw: node.scrollWidth, cw: node.clientWidth, vw: innerWidth, vh: innerHeight } })
  assert.ok(r.x >= -1 && r.y >= -1 && r.right <= r.vw + 1 && r.bottom <= r.vh + 1 && r.sw <= r.cw + 1, `Overflow: ${JSON.stringify(r)}`)
  return r
}
async function phoneApp(page, id) {
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
  await page.locator('.so-phone-homebtn').click()
  await page.locator(`.so-phone-app-icon[data-app-id="${id}"]`).press('Enter')
}
async function openTestChat(page, name) {
  await page.evaluate(async chat => {
    const ctx = window.SillyTavern.getContext(), id = ctx.characters.findIndex(c => c.name === 'Variable Acceptance')
    if (id < 0) throw new Error('Missing synthetic character')
    await (await import('/script.js')).selectCharacterById(id, { switchMenu: false })
    await window.SillyTavern.getContext().openCharacterChat(chat)
  }, name)
  await page.waitForFunction(() => window.SillyTavern.getContext().chat.length > 0)
}
try {
  for (const scenario of cases.filter(c => !option('--scenario') || c.name === option('--scenario'))) {
    const entry = { ...scenario, status: 'running', pageErrors: [] }; report.scenarios.push(entry)
    const d = JSON.parse(readFileSync(path.join(root, 'st-extension/locales', scenario.language === 'en' ? 'en-US.json' : 'zh-CN.json')))
    const v = d.apps.newvar, designer = d.variableDesigner, tree = d.variableTree
    const context = await browser.newContext({ viewport: scenario.size === 'mobile' ? { width: 375, height: 667 } : { width: 1365, height: 900 }, isMobile: scenario.size === 'mobile', hasTouch: scenario.size === 'mobile' })
    await context.addInitScript(language => localStorage.setItem('language', language), scenario.language === 'en' ? 'en' : 'zh-cn')
    await context.route('**/*', route => new URL(route.request().url()).origin === url.origin ? route.continue() : route.abort())
    const page = await context.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => entry.pageErrors.push(error.message))
    const shot = label => page.screenshot({ path: path.join(output, `${scenario.name}-${label}.png`) })
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready(page)
      const created = await page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext()
        if (ctx.characters.some(c => c.name === 'Variable Acceptance')) return false
        const response = await fetch('/api/characters/create', { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify({ ch_name: 'Variable Acceptance', first_mes: 'Synthetic acceptance greeting.' }) })
        if (!response.ok) throw new Error(`Synthetic character creation: HTTP ${response.status}`)
        return true
      })
      if (created) { await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page) }
      await saved(page, () => page.evaluate(() => {
        const ctx = window.SillyTavern.getContext(), settings = ctx.extensionSettings.sprite_overlay
        settings.variableHud = false
        settings.apps.newvar = { enabled: false, hideUpdateBlocks: true, format: 'json_patch', injectionDepth: 4,
          schema: { id: 'acceptance', name: '用户方案', version: 1, variables: [] }, customTemplates: [] }
        ctx.saveSettingsDebounced()
      }))
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page)
      const chatName = `VariableAcceptance-${runId}-${scenario.name}`
      await openTestChat(page, chatName)
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').press('Enter')
      await phoneApp(page, 'mvu')
      const mvu = page.locator('.so-phone-app-container')
      const hasMvu = await page.evaluate(() => !!window.Mvu || !!window.TavernHelper)
      entry.mvuThirdPartyAvailable = hasMvu
      if (!hasMvu) await mvu.getByText(d.apps.mvu.unavailable, { exact: true }).waitFor()
      await bounded(mvu.getByRole('button', { name: tree.refresh, exact: true })); await shot('mvu')
      await phoneApp(page, 'newvar')
      assert.equal(await page.locator('.so-phone-status-title').textContent(), v.name)
      const enabled = page.getByLabel(v.enable, { exact: true })
      await enabled.check(); await focused(enabled)
      const hudToggle = page.getByLabel(v.hud, { exact: true })
      await hudToggle.check(); await focused(hudToggle)
      await page.getByRole('button', { name: v.open_designer, exact: true }).press('Enter')
      assert.equal(await page.locator('.nv-designer, .so-manager').first().getAttribute('aria-label'), designer.title)
      entry.designerHeader = await bounded(page.locator('.so-manager-header'))
      await page.locator('.nv-tpl-card').first().scrollIntoViewIfNeeded()
      entry.template = await bounded(page.locator('.nv-tpl-card').first()); await shot('templates')
      const add = page.locator('.nv-defs-editor').getByRole('button', { name: designer.add, exact: true })
      await add.press('Enter')
      const inputPath = page.getByLabel(designer.path, { exact: true })
      await focused(inputPath)
      await inputPath.fill('状态.体力')
      const type = page.getByLabel(designer.type, { exact: true })
      await inputPath.press('Tab'); await focused(type)
      await type.selectOption('enum'); await focused(type)
      await type.selectOption('number'); await focused(type)
      await page.getByLabel(designer.default, { exact: true }).fill('20')
      await page.getByLabel(designer.description, { exact: true }).fill('用户描述')
      await page.getByLabel(designer.range, { exact: true }).fill('0~100')
      await page.getByLabel(designer.rules, { exact: true }).fill('用户规则 +1')
      entry.editor = await bounded(page.locator('.nv-defs-editor .vm-editing')); await shot('definition')
      await page.getByRole('button', { name: designer.save_definition, exact: true }).press('Enter')
      assert.deepEqual(await page.evaluate(() => window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps.newvar.schema.variables), [{ key: '状态.体力', type: 'number', default: 20, description: '用户描述', range: [0, 100], updateRule: '用户规则 +1' }])
      const format = page.getByLabel(designer.format, { exact: true })
      await format.focus()
      await format.selectOption('lodash_set'); await focused(format)
      await format.selectOption('json_patch'); await focused(format)
      await page.keyboard.press('Escape')
      await focused(page.locator('.so-phone-app-container'))
      const leaf = page.locator('[data-variable-focus="leaf:状态.体力"]')
      await leaf.press('Enter'); await focused(page.locator('.vm-edit-input'))
      await page.locator('.vm-edit-input').fill('200')
      await saved(page, () => page.getByRole('button', { name: tree.save, exact: true }).press('Enter'), '/api/chats/save')
      await focused(leaf)
      assert.ok(await leaf.textContent().then(text => text.includes('100')), 'Schema range must still clamp the manual value')
      await leaf.press('Enter'); await page.locator('.vm-edit-input').fill('77')
      await page.getByRole('button', { name: tree.cancel, exact: true }).press('Enter'); await focused(leaf)
      assert.ok(await leaf.textContent().then(text => text.includes('100')), 'Cancel must preserve committed value')
      await shot('tree')
      await page.locator('.so-phone-close').press('Enter')
      await page.locator('.so-varhud-btn').press('Space'); await focused(page.locator('.so-varhud-close'))
      await page.getByText(d.variableHud.title, { exact: true }).waitFor()
      // Exercise the real draggable HUD after closing the independent sprite overlay above.
      const hudHead = await page.locator('.so-varhud-head').boundingBox()
      assert.ok(await page.locator('.so-varhud-head').evaluate(node => { const r = node.getBoundingClientRect(); return node.contains(document.elementFromPoint(r.x + 50, r.y + 12)) }), 'HUD drag handle is covered')
      await page.mouse.move(hudHead.x + 50, hudHead.y + 12); await page.mouse.down()
      await page.mouse.move(hudHead.x + 65, Math.min(page.viewportSize().height - 190, hudHead.y + 240), { steps: 8 }); await page.mouse.up()
      entry.hud = await bounded(page.locator('.so-varhud-panel')); await shot('hud')
      await page.locator('.so-varhud-close').focus()
      await page.keyboard.press('Escape'); await focused(page.locator('.so-varhud-btn'))
      await saved(page, () => page.evaluate(() => window.SillyTavern.getContext().saveSettingsDebounced()))
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(page)
      // Reopen the same chat explicitly; ST settingsReady can precede automatic chat loading.
      await openTestChat(page, chatName)
      await phoneApp(page, 'newvar')
      await page.locator('[data-variable-focus="leaf:状态.体力"]').waitFor()
      assert.ok(await page.locator('[data-variable-focus="leaf:状态.体力"]').textContent().then(text => text.includes('100')), 'Saved snapshot did not survive reload')
      assert.equal(await page.evaluate(() => window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps.newvar.schema.name), '用户方案')
      entry.definitionAndChatSurvivedReload = true
      await page.getByRole('button', { name: v.open_designer, exact: true }).press('Enter')
      const replace = page.locator('.nv-tpl-card').first().getByRole('button', { name: designer.replace, exact: true })
      let confirmations = 0
      const confirm = dialog => { confirmations++; return dialog.accept() }
      page.on('dialog', confirm)
      await saved(page, () => replace.press('Enter'))
      page.off('dialog', confirm)
      assert.equal(confirmations, 1, 'Native Enter should replace the template only once')
      await focused(replace)
      const imported = await page.evaluate(() => window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps.newvar.schema)
      assert.equal(imported.name, '恋爱 · 单角色', 'The template display translation must not change its persisted name')
      assert.ok(imported.variables.length > 1)
      entry.templateImportedWithOriginalData = true
      await page.keyboard.press('Escape')
      assert.deepEqual(entry.pageErrors, []); entry.status = 'passed'; console.log(`PASS ${scenario.name}`)
    } catch (error) {
      entry.status = 'failed'; entry.error = error.stack
      await shot('failure').catch(() => {}); console.error(`FAIL ${scenario.name}: ${error.message}`)
    } finally { await context.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n') }
  }
} finally {
  await browser.close(); report.passed = report.scenarios.length > 0 && report.scenarios.every(s => s.status === 'passed')
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
assert.ok(report.passed, `Variable acceptance failed; inspect ${output}`)
console.log(`Real-ST variables acceptance: ${report.scenarios.length} passed; evidence ${output}`)
