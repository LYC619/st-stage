// Real isolated ST, native Connection Manager and emitted bundle. All data is synthetic.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'), 'Use a disposable ST and --isolated-data')
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname))
const output = path.resolve(option('--output') || 'test-results/character-play-browser'); mkdirSync(output, { recursive: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, bundleSha256: createHash('sha256').update(readFileSync('bundle.js')).digest('hex'), scope: 'Real isolated ST 1.18.0 and native Connection Manager, synthetic characters/chats/profiles. Backend status is intercepted; no AI generation, daily data, physical device or OS IME claim.', scenarios: [] }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const scenarios = [
  { name: 'desktop-zh', width: 1365, height: 900, locale: 'zh-CN' },
  { name: 'mobile-320-zh', width: 320, height: 667, locale: 'zh-CN', touch: true },
  { name: 'mobile-390-en', width: 390, height: 844, locale: 'en-US', touch: true },
]
try {
  for (const scenario of scenarios.filter(item => !option('--scenario') || item.name === option('--scenario'))) {
    const entry = { ...scenario, checks: [], scans: [], pageErrors: [] }; report.scenarios.push(entry)
    const context = await browser.newContext({ viewport: { width: scenario.width, height: scenario.height }, hasTouch: !!scenario.touch, isMobile: !!scenario.touch })
    await context.addInitScript(locale => localStorage.setItem('language', locale === 'en-US' ? 'en' : 'zh-cn'), scenario.locale)
    let failConnection = false, releaseRoleReply, roleRequest
    const roleCalls = []
    await context.route('**/*', route => {
      const target = new URL(route.request().url())
      if (target.origin !== url.origin) return route.abort()
      if (target.pathname === '/goal-role-reply') {
        const body = route.request().postDataJSON(); roleCalls.push(body)
        const impact = body.messages.some(message => message.content.includes('聊天状态分析器'))
        if (impact) return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"mood":0,"interest":0}' } }] }) })
        if (roleRequest) { roleRequest(); roleRequest = null; return new Promise(resolve => { releaseRoleReply = () => resolve(route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"messages":[{"type":"text","content":"STALE ROLE A REPLY"}]}' } }] }) })) }) }
        return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: '{"messages":[{"type":"text","content":"CURRENT ROLE B REPLY"}]}' } }] }) })
      }
      if (target.pathname === '/api/backends/chat-completions/status') return route.fulfill({ status: failConnection ? 503 : 200, contentType: 'application/json', body: JSON.stringify(failConnection ? { error: true } : { data: [{ id: 'goal-a' }, { id: 'goal-b' }] }) })
      if (target.pathname.includes('/generate')) return route.abort()
      return route.continue()
    })
    const page = await context.newPage(); page.setDefaultTimeout(20000)
    page.on('pageerror', error => entry.pageErrors.push(error.message))
    const d = JSON.parse(readFileSync(`st-extension/locales/${scenario.locale}.json`)), p = d.wechatProfiles, a = d.nativeApi, c = d.cardChoices
    const run = Date.now(), names = [`Goal A ${scenario.name}`, `Goal B ${scenario.name}`], chats = [`Goal-${run}-one`, `Goal-${run}-two`]
    const cardBlock = { version: 1, mode: 'cards', title: 'Possible routes', cards: [
      { id: 'road', title: 'Road route', description: 'Follow the lights along the mountain road.', action: 'I choose the road route.', branch: 'Possible development: '.repeat(50) + '\nA patrol left a sign here.' },
      { id: 'camp', title: 'Camp route', description: 'Return to the camp.', action: 'I choose the camp route.', branch: 'Possible development: a friend brings a new map.' },
    ] }
    const rawBlock = `<STStageRender>${JSON.stringify(cardBlock)}</STStageRender>`
    async function ready() {
      await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
      await page.locator('.so-phone-fab').waitFor({ state: 'attached' })
      await page.locator('#connection_profiles').waitFor({ state: 'attached' })
    }
    async function saved(action) {
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.ok())
      await Promise.all([action(), response])
    }
    async function openChat(name, chat) {
      await page.waitForFunction(name => window.SillyTavern.getContext().characters.some(card => card.name === name), name)
      await page.evaluate(async ({ name, chat }) => {
        const ctx = window.SillyTavern.getContext(), id = ctx.characters.findIndex(card => card.name === name)
        if (Number(ctx.characterId) !== id) await (await import('/script.js')).selectCharacterById(id, { switchMenu: false })
        await window.SillyTavern.getContext().openCharacterChat(chat)
      }, { name, chat })
      await page.waitForFunction(chat => window.SillyTavern.getContext().chatId === chat, chat)
    }
    async function openApp(id) {
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      const icon = page.locator(`.so-phone-app-icon[data-app-id="${id}"]`)
      if (scenario.touch) await icon.tap(); else await icon.press('Enter')
    }
    async function settings(scope) {
      await page.locator('#wt-settings-btn').click()
      if (scope) await page.locator('[data-profile-scope]').selectOption(scope)
      const summary = page.locator('.wt-profile-settings details > summary')
      if (!await summary.evaluate(node => node.parentElement.open)) await summary.click()
    }
    async function scan(name, selector) {
      const result = await new AxeBuilder({ page }).include(selector).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze()
      const compact = rule => ({ id: rule.id, impact: rule.impact, nodes: rule.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })
      entry.scans.push({ name, violations: result.violations.map(compact), incomplete: result.incomplete.map(compact) })
      assert.equal(result.violations.length, 0, `${name}: ${JSON.stringify(entry.scans.at(-1).violations)}`)
    }
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready()
      assert.equal(await page.evaluate(async () => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch('/scripts/extensions/third-party/baigong-acceptance/bundle.js')).arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('')), report.bundleSha256)
      await saved(() => page.evaluate(async ({ names, chats, rawBlock }) => {
        const ctx = window.SillyTavern.getContext()
        const post = async (endpoint, body) => { const r = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) }); if (!r.ok) throw new Error(`${endpoint}: ${r.status}`); const text = await r.text(); try { return JSON.parse(text) } catch { return text } }
        let all = await post('/api/characters/all', {})
        for (const name of names) {
          if (!all.some(card => card.name === name)) { await post('/api/characters/create', { ch_name: name, first_mes: 'Synthetic greeting' }); all = await post('/api/characters/all', {}) }
          const avatar = all.find(card => card.name === name).avatar
          await post('/api/chats/get', { avatar_url: avatar, ch_name: name, file_name: chats[0] })
          for (const file_name of chats) await post('/api/chats/save', { avatar_url: avatar, ch_name: name, file_name, force: true,
            chat: [{ user_name: 'Acceptance', character_name: name, chat_metadata: {} }, { name, is_user: false, is_system: false, send_date: `2026-11-05-${file_name}`, mes: rawBlock, swipe_id: 0, swipes: [rawBlock, rawBlock], swipe_info: [{ send_date: 'fixture' }, { send_date: 'fixture' }] }] })
        }
        const settings = ctx.extensionSettings.sprite_overlay
        settings.enabled = false; settings.showPhone = true; settings.phone = { x: 8, y: 8, open: false }
        settings.apps['wechat-sister'] = { config: { profile: { preset: 'general', contactName: 'Global default' } }, conversations: {} }
        settings.apps.api = { profiles: [] }; settings.apps['renderer-choices'] = { version: 1, entries: [] }
        settings.apps.renderer = { enabled: true, cardsEnabled: true, galEnabled: true, battleEnabled: true, typewriter: false }
        ctx.extensionSettings.connectionManager = { selectedProfile: null, profiles: [
          { id: 'goal-native-a', name: 'Goal native A ' + 'LongName'.repeat(12), mode: 'cc', api: 'custom', model: 'goal-a', 'api-url': location.origin + '/synthetic-native-a' },
          { id: 'goal-native-b', name: 'Goal native B', mode: 'cc', api: 'custom', model: 'goal-b', 'api-url': location.origin + '/synthetic-native-b' },
        ] }
        ctx.saveSettingsDebounced()
      }, { names, chats, rawBlock }))
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(names[0], chats[0]); await openApp('wechat-sister')
      await expect(page.locator('#wt-contact-name')).toHaveText('Global default')
      await settings('character')
      await page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true }).fill('Role A custom')
      await page.getByLabel('新会话开场白（不改已有记录）', { exact: true }).fill('Role A opening')
      await page.getByLabel(p.name, { exact: true }).fill('Portable role')
      await saved(() => page.getByRole('button', { name: p.saveTemplate, exact: true }).click())
      await page.getByRole('button', { name: p.export, exact: true }).click()
      const template = await page.getByLabel(p.transfer, { exact: true }).inputValue()
      assert.equal(JSON.parse(template).format, 'baigong-wechat-profile'); assert.ok(!template.includes('apiKey'))
      await saved(() => page.locator('#wt-btn-save-settings').click())
      await expect(page.locator('#wt-contact-name')).toHaveText('Role A custom')
      await openChat(names[0], chats[1])
      await expect(page.locator('#wt-contact-name')).toHaveText('Role A custom')
      await expect(page.locator('#wt-scroll')).toContainText('Role A opening')
      await openChat(names[1], chats[0]); await expect(page.locator('#wt-contact-name')).toHaveText('Global default')
      await settings()
      await page.getByLabel(p.transfer, { exact: true }).fill(template)
      await page.getByRole('button', { name: p.import, exact: true }).click()
      await expect(page.locator('[data-profile-scope]')).toHaveValue('character')
      await expect(page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true })).toHaveValue('Role A custom')
      await page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true }).fill('Role B custom')
      await saved(() => page.locator('#wt-btn-save-settings').click())
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(names[1], chats[0]); await openApp('wechat-sister')
      await expect(page.locator('#wt-contact-name')).toHaveText('Role B custom')
      await settings('inherit'); await saved(() => page.locator('#wt-btn-save-settings').click())
      await expect(page.locator('#wt-contact-name')).toHaveText('Global default')
      await settings('character'); await page.locator('[data-profile-templates]').selectOption({ label: 'Portable role' })
      await page.getByRole('button', { name: p.apply, exact: true }).click()
      await page.getByLabel(p.transfer, { exact: true }).fill('{"format":"other"}')
      await page.getByRole('button', { name: p.import, exact: true }).click()
      await expect(page.locator('.wt-profile-settings [role=status]')).toHaveText(p.invalid)
      await scan('wechat-profile-settings', '#wt-settings-modal')
      await page.screenshot({ path: path.join(output, `${scenario.name}-profile.png`) })
      await page.keyboard.press('Escape')
      entry.checks.push('role override / same-role chats / inheritance / template save, preview, export, import, rejection / reload')

      if (scenario.name === 'desktop-zh') {
        await saved(() => page.evaluate(() => {
          const ctx = window.SillyTavern.getContext(), config = ctx.extensionSettings.sprite_overlay.apps['wechat-sister'].config
          Object.assign(config, { apiKey: 'synthetic-role-key', apiUrl: location.origin + '/goal-role-reply', model: 'synthetic' }); ctx.saveSettingsDebounced()
        }))
        await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(names[0], chats[0]); await openApp('wechat-sister')
        const pending = new Promise((resolve, reject) => { const timer = setTimeout(() => reject(new Error('Role A request did not start')), 20000); roleRequest = () => { clearTimeout(timer); resolve() } })
        await page.locator('#wt-input-text').fill('ROLE A PENDING MESSAGE'); await page.locator('#wt-send-btn').click()
        await pending
        await openChat(names[1], chats[0]); await expect(page.locator('#wt-contact-name')).toHaveText('Global default')
        await settings('character'); await page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true }).fill('Role B while A pending')
        await saved(() => page.locator('#wt-btn-save-settings').click())
        releaseRoleReply(); releaseRoleReply = null
        await page.locator('#wt-input-text').fill('ROLE B CURRENT MESSAGE'); await page.locator('#wt-send-btn').click()
        await expect(page.locator('#wt-scroll')).toContainText('CURRENT ROLE B REPLY')
        await expect(page.locator('#wt-scroll')).not.toContainText('STALE ROLE A REPLY')
        await expect(page.locator('#wt-scroll')).not.toContainText('ROLE A PENDING MESSAGE')
        const replies = roleCalls.filter(body => !body.messages.some(message => message.content.includes('聊天状态分析器')))
        assert.equal(replies.length, 2); assert.match(JSON.stringify(replies[0]), /Role A custom/); assert.match(JSON.stringify(replies[1]), /Role B while A pending/)
        await openChat(names[0], chats[0]); await expect(page.locator('#wt-contact-name')).toHaveText('Role A custom')
        await expect(page.locator('#wt-scroll')).not.toContainText('CURRENT ROLE B REPLY')
        await openChat(names[1], chats[0])
        entry.checks.push('pending role A reply / switch and save role B profile / captured pipelines / no stale cross-role messages')
      }

      await openApp('api')
      const recommendation = page.getByLabel(a.recommendation, { exact: true })
      await expect(page.locator('.so-phone-app-container')).not.toContainText(a.loading)
      await saved(async () => {
        await recommendation.selectOption('goal-native-a')
        entry.apiDiagnostic = await page.evaluate(() => {
          const ctx = window.SillyTavern.getContext(), select = document.querySelector('[data-api-focus="recommendation"]')
          return { characterId: ctx.characterId, avatar: ctx.characters[Number(ctx.characterId)]?.avatar, value: select?.value, hasHandler: !!select?.onchange, refs: ctx.extensionSettings.sprite_overlay.apps.api.nativeCharacterProfiles }
        })
      })
      assert.equal(await page.locator('#connection_profiles').inputValue(), '')
      await openChat(names[0], chats[0]); await expect(recommendation).toHaveValue('')
      const row = page.locator('[data-native-profile-id="goal-native-a"]')
      await row.click()
      await expect(row).toHaveAttribute('aria-pressed', 'true')
      await page.waitForFunction(() => window.SillyTavern.getContext().chatCompletionSettings.custom_model === 'goal-a')
      await page.waitForFunction(() => window.SillyTavern.getContext().onlineStatus !== 'no_connection')
      await expect(page.locator('[data-native-profiles] [role=status]')).not.toContainText(a.applying)
      await scan('native-api', '[data-native-profiles]')
      await page.screenshot({ path: path.join(output, `${scenario.name}-api.png`) })
      failConnection = true
      await page.locator('[data-native-profile-id="goal-native-b"]').click()
      await page.waitForFunction(() => window.SillyTavern.getContext().chatCompletionSettings.custom_model === 'goal-b')
      await expect(page.locator('.so-phone-app-container')).toContainText(a.online)
      assert.match(await page.evaluate(() => window.SillyTavern.getContext().onlineStatus), /bypass|跳过/i)
      // Custom APIs intentionally bypass failed status checks in ST. Separately exercise its offline event.
      await page.evaluate(async () => { const script = await import('/script.js'); script.setOnlineStatus('no_connection'); await window.SillyTavern.getContext().eventSource.emit(window.SillyTavern.getContext().eventTypes.ONLINE_STATUS_CHANGED) })
      await expect(page.locator('.so-phone-app-container')).toContainText(a.offline)
      await expect(page.locator('[data-native-profiles] [role=status]')).not.toContainText(a.applying)
      await openChat(names[1], chats[0]); await expect(recommendation).toHaveValue('goal-native-a')
      await page.evaluate(async () => { const ctx = window.SillyTavern.getContext(); ctx.extensionSettings.connectionManager.profiles[0].name = 'Renamed native A'; await ctx.eventSource.emit(ctx.eventTypes.CONNECTION_PROFILE_UPDATED) })
      await expect(recommendation.locator('option:checked')).toHaveText('Renamed native A')
      await page.evaluate(async () => { const ctx = window.SillyTavern.getContext(); ctx.extensionSettings.connectionManager.profiles = ctx.extensionSettings.connectionManager.profiles.filter(p => p.id !== 'goal-native-a'); await ctx.eventSource.emit(ctx.eventTypes.CONNECTION_PROFILE_DELETED); ctx.saveSettingsDebounced() })
      await expect(recommendation.locator('option:checked')).toHaveText(a.missing)
      await saved(() => recommendation.selectOption(''))
      entry.checks.push('native profile ID switching / actual model, failed custom status bypass and explicit host offline event / role recommendation / no automatic switch / rename and deletion')

      await openChat(names[0], chats[0]); await page.locator('.so-phone-close').click()
      const cards = page.locator('#chat .st-render-cards').first(), first = cards.locator('[data-card-id="road"]').first()
      await expect(cards).toBeVisible()
      await first.locator('.st-render-card-branch summary').click()
      await expect(first.locator('.st-render-card-branch')).toHaveAttribute('open', '')
      await saved(() => first.locator('.st-render-card-remember').click())
      await expect(page.locator('#send_textarea')).toHaveValue('')
      await scan('branch-cards', '#chat .st-render-cards')
      await page.screenshot({ path: path.join(output, `${scenario.name}-branch.png`) })
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(names[0], chats[0])
      if (await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-close').click()
      await expect(first).toHaveClass(/st-render-card-saved/)
      await openApp('renderer')
      await saved(() => page.getByRole('checkbox', { name: '启用渲染', exact: true }).uncheck())
      await expect(cards).toHaveCount(0)
      await saved(() => page.getByRole('checkbox', { name: '启用渲染', exact: true }).check())
      await page.locator('.so-phone-close').click(); await expect(first).toHaveClass(/st-render-card-saved/)
      await page.locator('#send_textarea').fill('MY OWN DRAFT')
      await cards.locator('.st-render-card-select').last().click()
      await expect(page.locator('#send_textarea')).toHaveValue('MY OWN DRAFT')
      await expect(first).toHaveClass(/st-render-card-saved/)
      await page.locator('#send_textarea').fill('')
      await saved(() => first.locator('.st-render-card-select').click())
      await expect(page.locator('#send_textarea')).toHaveValue('I choose the road route.')
      assert.equal(await page.evaluate(() => window.SillyTavern.getContext().chat.length), 1)
      await page.locator('#send_textarea').fill('')
      await openChat(names[0], chats[1]); await expect(cards.locator('.st-render-card-saved')).toHaveCount(0)
      await openChat(names[0], chats[0]); await expect(first).toHaveClass(/st-render-card-saved/)
      await page.evaluate(async () => { const ctx = window.SillyTavern.getContext(); ctx.chat[0].swipe_id = 1; await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_SWIPED, 0) })
      await expect(cards.locator('.st-render-card-saved')).toHaveCount(0)
      await page.evaluate(async () => { const ctx = window.SillyTavern.getContext(); ctx.chat[0].swipe_id = 0; ctx.chat[0].mes += '\nEdited narrative'; await ctx.eventSource.emit(ctx.eventTypes.MESSAGE_UPDATED, 0) })
      await expect(cards.locator('.st-render-card-saved')).toHaveCount(0)
      entry.checks.push('branch preview / persistent choice / draft protection / no send / chat, swipe and edit isolation')
      assert.deepEqual(entry.pageErrors, [])
      entry.status = 'passed'; console.log(`PASS ${scenario.name}: ${entry.checks.length} workflows, ${entry.scans.length} axe scans`)
    } catch (error) {
      entry.status = 'failed'; entry.error = error.stack; console.error(`${scenario.name}: ${error.stack}`)
      await page.screenshot({ path: path.join(output, `${scenario.name}-failure.png`) }).catch(() => {})
    } finally { releaseRoleReply?.(); await context.close() }
  }
} finally { await browser.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n') }
assert.ok(report.scenarios.length && report.scenarios.every(entry => entry.status === 'passed'), `Inspect ${output}`)
