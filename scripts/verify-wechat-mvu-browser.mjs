// Requires actual identified TavernHelper and MVU installed in an isolated ST user.
// Replies are intercepted; only variable integration is real third-party acceptance.
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium, expect } from '@playwright/test'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'))
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const output = path.resolve('test-results/wechat-mvu-browser'); mkdirSync(output, { recursive: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, scope: 'Real ST + installed TavernHelper + unmodified identified MVU artifact, synthetic chats/variables; intercepted AI, browser desktop only.', versions: {}, checks: [], errors: [], hostFailures: [], chatSwitches: [], dependencies: {} }
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 1365, height: 900 } })
await context.addInitScript(() => localStorage.setItem('language', 'zh-cn'))
let apiCalls = 0, holdReply, releaseReply, holdImpact, releaseImpact, impactStarted, impactFinished
async function within(promise, label) {
  let timer
  try { return await Promise.race([promise, new Promise((_, reject) => { timer = setTimeout(() => reject(new Error(`Timed out waiting for ${label}`)), 20000) })]) }
  finally { clearTimeout(timer) }
}
const pendingText = '会话 A 的在途消息', pendingReply = '会话 A 的延迟回复'
const otherText = '会话 B 的消息', otherReply = '会话 B 的独立回复'
await context.route('**/*', async route => {
  const target = new URL(route.request().url())
  if (target.origin === url.origin) {
    if (target.pathname !== '/wechat-mvu-acceptance') return route.continue()
    apiCalls++
    const impact = route.request().postDataJSON().messages.some(m => m.content.includes('聊天状态分析器'))
    if (impact) {
      impactStarted?.()
      if (holdImpact) await holdImpact
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ mood: 0.4, interest: 0.4 }) } }] }) })
      impactFinished?.()
      return
    }
    const latestUser = route.request().postDataJSON().messages.filter(m => m.role === 'user').at(-1)?.content
    const content = latestUser === pendingText ? pendingReply : latestUser === otherText ? otherReply : '受控模型回复'
    if (holdReply) await holdReply
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify({ messages: [{ type: 'text', content }] }) } }] }) })
  }
  if (target.protocol === 'https:' && ['testingcf.jsdelivr.net', 'cdn.jsdelivr.net'].includes(target.hostname) && route.request().method() === 'GET') return route.continue()
  return route.abort()
})
const page = await context.newPage(); page.setDefaultTimeout(20000)
page.on('pageerror', error => report.errors.push(error.message))
const dependencies = []
page.on('response', response => {
  const target = new URL(response.url())
  if (target.origin === url.origin && target.pathname.startsWith('/api/') && !response.ok()) report.hostFailures.push({ endpoint: target.pathname, status: response.status() })
  if (target.hostname.endsWith('jsdelivr.net') && response.ok()) dependencies.push(response.body().then(bytes => {
    report.dependencies[response.url()] = createHash('sha256').update(bytes).digest('hex')
  }).catch(() => {}))
})
const name = 'MVU WeChat Acceptance', runId = Date.now(), chatA = `MVU-A-${runId}`, chatB = `MVU-B-${runId}`
const schema = { type: 'object', properties: { acceptance: { type: 'object', properties: { mood: { type: 'number' }, interest: { type: 'number' }, money: { type: 'number' }, location: { type: 'string' } } } } }
async function ready() {
  await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
  await page.waitForFunction(() => typeof window.Mvu?.getMvuData === 'function' && typeof window.TavernHelper?.createChatMessages === 'function', undefined, { timeout: 45000 })
  await page.waitForSelector('.so-phone-fab', { state: 'attached' })
}
async function openChat(chat) {
  await page.waitForFunction(name => window.SillyTavern.getContext().characters.some(c => c.name === name), name)
  await page.evaluate(async ({ name, chat }) => {
    const ctx = window.SillyTavern.getContext(), id = ctx.characters.findIndex(c => c.name === name)
    if (String(ctx.characterId) !== String(id)) await (await import('/script.js')).selectCharacterById(id, { switchMenu: false })
    await window.SillyTavern.getContext().openCharacterChat(chat)
  }, { name, chat })
  report.chatSwitches.push(await page.evaluate(requested => {
    const ctx = window.SillyTavern.getContext()
    return { requested, actual: ctx.chatId, form: document.querySelector('#selected_chat_pole')?.value, integrity: ctx.chatMetadata.integrity }
  }, chat))
  await page.waitForFunction(chat => window.SillyTavern.getContext().chatId === chat, chat)
}
async function openApp() {
  if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
  if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
  await page.locator('.so-phone-homebtn').click()
  await page.locator('[data-role-action="wechat"]').press('Enter')
  await page.locator('.wechat-root').waitFor()
}
async function saved(action, endpoint = '/api/settings/save') {
  const response = page.waitForResponse(r => new URL(r.url()).pathname === endpoint && r.ok())
  await Promise.all([action(), response])
}
async function state() { return page.evaluate(() => window.Mvu.getMvuData({ type: 'message', message_id: 'latest' }).stat_data?.acceptance) }
try {
  await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready()
  report.browser = browser.version()
  report.versions = await page.evaluate(async () => {
    const manifest = await (await fetch('/scripts/extensions/third-party/JS-Slash-Runner/manifest.json')).json()
    const sha = async endpoint => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch(endpoint)).arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('')
    const bundle = await (await fetch('/mvu-acceptance/bundle.js')).text()
    const installedVersion = await (await fetch('/scripts/extensions/third-party/baigong-acceptance/version.json')).json()
    return { installedBuild: installedVersion.v, appSha256: await sha('/scripts/extensions/third-party/baigong-acceptance/bundle.js'), helper: manifest.version, helperSha256: await sha('/scripts/extensions/third-party/JS-Slash-Runner/dist/index.js'), mvuSha256: await sha('/mvu-acceptance/bundle.js'),
      mvuBuild: bundle.match(/20\d\d-\d\d-\d\d \d\d:\d\d/)?.[0], mvuCommit: bundle.includes('74f930e') ? '74f930e' : 'unidentified',
      scriptFrame: [...document.querySelectorAll('iframe')].find(node => node.id.includes('mvu-controlled-acceptance'))?.id }
  })
  assert.equal(report.versions.helper, '4.11.3'); assert.equal(report.versions.mvuCommit, '74f930e')
  assert.equal(report.versions.helperSha256, '932c5267ad9ee0d6f36f3d70a9dd21a8f7effbcfef71cd26e87a1f310890da57')
  assert.equal(report.versions.mvuSha256, '6e4756ba99968f9eab2c20810d27ca035b28f36791f7fa7dd701a57af37241e1')
  assert.equal(report.versions.installedBuild, report.build)
  assert.equal(report.versions.appSha256, createHash('sha256').update(readFileSync('bundle.js')).digest('hex'))
  assert.ok(report.versions.scriptFrame)
  await saved(() => page.evaluate(async ({ name, chatA, chatB }) => {
    const ctx = window.SillyTavern.getContext()
    const post = async (endpoint, body) => {
      const r = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) })
      if (!r.ok) throw Error(endpoint + ': ' + r.status)
      const text = await r.text(); try { return JSON.parse(text) } catch { return text }
    }
    let characters = await post('/api/characters/all', {})
    if (!characters.some(c => c.name === name)) {
      await post('/api/characters/create', { ch_name: name, first_mes: 'Synthetic MVU greeting' })
      characters = await post('/api/characters/all', {})
    }
    const character = characters.find(c => c.name === name)
    await post('/api/chats/get', { avatar_url: character.avatar })
    for (const file_name of [chatA, chatB]) await post('/api/chats/save', { avatar_url: character.avatar, ch_name: name, file_name, force: true,
      chat: [{ user_name: 'Acceptance', character_name: name, chat_metadata: {} }, { name, is_user: false, is_system: false, mes: 'Synthetic MVU state chat.', send_date: '2026-11-04T00:00:00Z' }] })
    ctx.extensionSettings.sprite_overlay.apps['wechat-sister'] = { config: { apiKey: 'local-test-key', apiUrl: `${location.origin}/wechat-mvu-acceptance`, model: 'local-test',
      profile: { preset: 'general', contextMessageCount: 0, mappings: { mood: 'acceptance.mood', interest: 'acceptance.interest', money: 'acceptance.money', location: 'acceptance.location' } } }, conversations: {} }
    ctx.saveSettingsDebounced()
  }, { name, chatA, chatB }))
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready()
  await openChat(chatB)
  await saved(() => page.evaluate(async schema => {
    await window.Mvu.replaceMvuData({ schema, initialized_lorebooks: {}, stat_data: { acceptance: { mood: 22, interest: 15, money: 500, location: '第二会话' } } }, { type: 'message', message_id: 'latest' })
  }, schema), '/api/chats/save')
  await openChat(chatA)
  await saved(() => page.evaluate(async schema => {
    await window.Mvu.replaceMvuData({ schema, initialized_lorebooks: {}, stat_data: { acceptance: { mood: 82, interest: 35, money: 1000, location: '真实MVU测试室' } } }, { type: 'message', message_id: 'latest' })
  }, schema), '/api/chats/save')
  await openApp()
  await expect(page.locator('#val-mood')).toHaveText('82')
  await expect(page.locator('#val-interest')).toHaveText('35')
  report.checks.push({ name: 'real-mvu-read-through-helper-and-explicit-mapping', status: 'passed' })

  // Actual helper MESSAGE_RECEIVED -> actual MVU parser -> actual MVU events/persistence.
  await page.evaluate(async name => {
    window.__mvuObservedEvents = []
    const ctx = window.SillyTavern.getContext()
    ctx.eventSource.on(window.Mvu.events.VARIABLE_UPDATE_ENDED, data => window.__mvuObservedEvents.push(data.stat_data.acceptance?.mood))
    await window.TavernHelper.createChatMessages([{ role: 'assistant', name, message: "合成状态更新。<UpdateVariable>_.set('acceptance.mood', 96); _.set('acceptance.location', '真实MVU图书馆');</UpdateVariable>" }])
  }, name)
  await expect.poll(state, { timeout: 15000 }).toMatchObject({ mood: 96, location: '真实MVU图书馆' })
  await expect(page.locator('#val-mood')).toHaveText('96')
  report.mvuEvents = await page.evaluate(() => window.__mvuObservedEvents)
  assert.ok(report.mvuEvents.includes(96))
  report.checks.push({ name: 'native-mvu-parser-event-and-ui-refresh', status: 'passed' })
  apiCalls = 0
  await page.locator('#wt-packet-btn').click()
  await saved(async () => {
    await page.locator('.wt-amt-pill[data-amt="20"]').click()
    await page.getByText('受控模型回复', { exact: true }).waitFor()
  })
  assert.equal(apiCalls, 1)
  assert.deepEqual(await state(), { mood: 96, interest: 35, money: 1000, location: '真实MVU图书馆' })
  await page.locator('#wt-status-pill').press('Enter')
  assert.ok(await page.locator('#wt-set-mood-range').isDisabled())
  assert.ok(await page.locator('#wt-set-interest-range').isDisabled())
  assert.ok(await page.locator('#wt-set-sister-loc').isDisabled())
  await expect(page.locator('#wt-set-sister-loc')).toHaveValue('真实MVU图书馆')
  assert.equal(await page.locator('#wt-wallet-bal').textContent(), '1000')
  await page.keyboard.press('Escape')
  report.checks.push({ name: 'external-ownership-and-red-packet-wallet-read-only', status: 'passed' })
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(chatA); await openApp()
  await expect(page.locator('#val-mood')).toHaveText('96')
  assert.deepEqual(await state(), { mood: 96, interest: 35, money: 1000, location: '真实MVU图书馆' })
  report.checks.push({ name: 'mvu-disk-persistence-after-reload', status: 'passed' })

  holdReply = new Promise(resolve => { releaseReply = resolve })
  const started = page.waitForRequest(r => new URL(r.url()).pathname === '/wechat-mvu-acceptance')
  await page.evaluate(() => { window.__mvuWeChatRoot = document.querySelector('.wechat-root') })
  await page.locator('#wt-input-text').fill(pendingText)
  await Promise.all([page.locator('#wt-send-btn').click(), started])
  await openChat(chatB)
  releaseReply(); holdReply = undefined
  assert.ok(await page.evaluate(() => window.__mvuWeChatRoot === document.querySelector('.wechat-root')))
  await expect(page.locator('#val-mood')).toHaveText('22')
  await saved(async () => {
    await page.locator('#wt-input-text').fill(otherText); await page.locator('#wt-send-btn').click()
    await page.getByText(otherReply, { exact: true }).waitFor()
  })
  assert.equal(await page.getByText(pendingText, { exact: true }).count(), 0)
  assert.equal(await page.getByText(pendingReply, { exact: true }).count(), 0)
  assert.deepEqual(await state(), { mood: 22, interest: 15, money: 500, location: '第二会话' })
  await openChat(chatA)
  assert.ok(await page.evaluate(() => window.__mvuWeChatRoot === document.querySelector('.wechat-root')))
  await expect(page.locator('#val-mood')).toHaveText('96')
  assert.equal(await page.getByText(otherText, { exact: true }).count(), 0)
  assert.equal(await page.getByText(otherReply, { exact: true }).count(), 0)
  assert.equal(await page.getByText(pendingReply, { exact: true }).count(), 0)
  assert.deepEqual(report.hostFailures, [])
  report.checks.push({ name: 'switch-chat-during-pending-reply-keeps-mvu-and-chat-scopes', status: 'passed' })
  // Exercise the shipped Variables App with real helper/MVU writes and disk
  // persistence, after all existing WeChat checks have completed unchanged.
  const openVariables = async () => {
    if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
    await page.locator('.so-phone-homebtn').click()
    await page.locator('.so-phone-app-icon[data-app-id="mvu"]').press('Enter')
    await page.locator('.mvu-tree-host [data-variable-focus="leaf:acceptance.mood"]').waitFor()
  }
  const leaf = page.locator('.mvu-tree-host [data-variable-focus="leaf:acceptance.mood"]')
  await openVariables()
  await expect(page.locator('.mvu-tree-host')).toContainText('来源：MVU')
  await leaf.press('Enter')
  await page.locator('.mvu-tree-host .vm-edit-input').fill('73')
  await saved(() => page.locator('[data-variable-focus="save:acceptance.mood"]').press('Enter'), '/api/chats/save')
  await expect.poll(state).toMatchObject({ mood: 73 })
  await expect(leaf).toContainText('73')
  await leaf.press('Enter'); await page.locator('.mvu-tree-host .vm-edit-input').fill('99')
  await page.locator('[data-variable-focus="cancel:acceptance.mood"]').press('Enter')
  assert.equal((await state()).mood, 73)
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(chatA); await openVariables()
  await expect(leaf).toContainText('73'); assert.equal((await state()).mood, 73)
  await page.locator('[data-variable-focus="add-section"]').click()
  await page.locator('[data-variable-focus="new-path"]').fill('acceptance.readinessNote')
  await page.locator('[data-variable-focus="new-value"]').fill('新增后删除')
  await saved(() => page.locator('.mvu-tree-host').getByRole('button', { name: '添加', exact: true }).press('Enter'), '/api/chats/save')
  await expect.poll(state).toMatchObject({ readinessNote: '新增后删除' })
  page.once('dialog', dialog => dialog.accept())
  await saved(() => page.locator('[data-variable-focus="delete:acceptance.readinessNote"]').press('Enter'), '/api/chats/save')
  assert.equal((await state()).readinessNote, undefined)
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(chatA); await openVariables()
  await expect(leaf).toContainText('73')
  assert.equal((await state()).readinessNote, undefined)
  report.checks.push({ name: 'real-mvu-variables-app-edit-cancel-add-delete-and-reload', status: 'passed' })

  await openApp(); await expect(page.locator('#val-mood')).toHaveText('73')
  // Keep the actual provider and values. Delay delivery of snapshots produced
  // by its real getMvuData; the event notification/timing is explicitly injected.
  await page.evaluate(async () => {
    const api = window.Mvu, original = api.getMvuData
    const pending = []; window.__mvuDelayedReads = { armed: true, count: 0, oldMoods: [] }
    api.getMvuData = function (scope) {
      const data = original.call(api, scope)
      if (!window.__mvuDelayedReads.armed || scope.message_id !== 'latest') return data
      const snapshot = structuredClone(data)
      window.__mvuDelayedReads.count++; window.__mvuDelayedReads.oldMoods.push(snapshot.stat_data?.acceptance?.mood)
      return new Promise(resolve => pending.push(() => resolve(snapshot)))
    }
    window.__mvuRestoreReads = () => { api.getMvuData = original; for (const release of pending) release() }
    await window.SillyTavern.getContext().eventSource.emit(api.events.VARIABLE_UPDATE_ENDED, original.call(api, { type: 'message', message_id: 'latest' }))
  })
  await expect.poll(() => page.evaluate(() => window.__mvuDelayedReads.count)).toBeGreaterThan(0)
  await page.evaluate(() => { window.__mvuDelayedReads.armed = false })
  await page.evaluate(async name => {
    await window.TavernHelper.createChatMessages([{ role: 'assistant', name, message: "状态更新。<UpdateVariable>_.set('acceptance.mood', 91);</UpdateVariable>" }])
  }, name)
  await expect.poll(state).toMatchObject({ mood: 91 })
  await expect(page.locator('#val-mood')).toHaveText('91')
  report.delayedReadTiming = await page.evaluate(() => window.__mvuDelayedReads)
  assert.ok(report.delayedReadTiming.oldMoods.every(value => value === 73))
  await page.evaluate(async () => { window.__mvuRestoreReads(); delete window.__mvuRestoreReads; await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))) })
  await expect(page.locator('#val-mood')).toHaveText('91')
  assert.equal((await state()).mood, 91)
  report.checks.push({ name: 'real-mvu-snapshots-delivered-out-of-order-retain-newer-same-chat-state', status: 'passed', timing: 'Explicitly delayed real getMvuData results; actual parser creates the newer state.' })

  const replaceAndNotify = async acceptance => saved(() => page.evaluate(async acceptance => {
    const scope = { type: 'message', message_id: 'latest' }, data = window.Mvu.getMvuData(scope)
    data.stat_data.acceptance = acceptance
    await window.Mvu.replaceMvuData(data, scope)
    await window.SillyTavern.getContext().eventSource.emit(window.Mvu.events.VARIABLE_UPDATE_ENDED, window.Mvu.getMvuData(scope))
  }, acceptance), '/api/chats/save')
  await replaceAndNotify({ money: 1000, location: '管理权切换前' })
  await page.locator('#wt-status-pill').press('Enter')
  await expect(page.locator('#wt-set-mood-range')).toBeEnabled()
  await expect(page.locator('#wt-set-interest-range')).toBeEnabled()
  await page.keyboard.press('Escape')
  holdImpact = new Promise(resolve => { releaseImpact = resolve })
  const impactPending = new Promise(resolve => { impactStarted = resolve })
  const impactDone = new Promise(resolve => { impactFinished = resolve })
  await page.locator('#wt-input-text').fill('评估等待期间由外部变量接管')
  await page.locator('#wt-send-btn').click(); await within(impactPending, 'stat-impact request')
  await replaceAndNotify({ mood: 82, interest: 35, money: 1000, location: '管理权已切换' })
  await expect(page.locator('#val-mood')).toHaveText('82')
  await expect(page.locator('#val-interest')).toHaveText('35')
  const impactResponse = page.waitForResponse(r => new URL(r.url()).pathname === '/wechat-mvu-acceptance' && r.request().postDataJSON().messages.some(m => m.content.includes('聊天状态分析器')))
  releaseImpact(); holdImpact = undefined
  await within(impactDone, 'stat-impact completion'); await (await impactResponse).finished()
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await expect(page.locator('#val-mood')).toHaveText('82'); await expect(page.locator('#val-interest')).toHaveText('35')
  await page.locator('#wt-status-pill').press('Enter')
  await expect(page.locator('#wt-set-mood-range')).toBeDisabled()
  await expect(page.locator('#wt-set-interest-range')).toBeDisabled()
  await saved(() => page.locator('#wt-btn-save-settings').press('Enter'))
  await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(chatA); await openApp()
  await expect(page.locator('#val-mood')).toHaveText('82'); await expect(page.locator('#val-interest')).toHaveText('35')
  assert.deepEqual(await state(), { mood: 82, interest: 35, money: 1000, location: '管理权已切换' })
  report.checks.push({ name: 'real-mvu-ownership-takeover-during-pending-impact-preserves-external-values', status: 'passed', timing: 'Actual MVU state writes with explicit event notifications; model impact is held and intercepted.' })
  assert.deepEqual(report.hostFailures, [])
  await page.screenshot({ path: path.join(output, 'completed.png') })
  assert.deepEqual(report.errors, [])
  report.status = 'passed'; console.log(`Real MVU acceptance: ${report.checks.length} passed`)
} catch (error) {
  report.diagnostic = await page.evaluate(() => ({ name: window.SillyTavern.getContext().name2, events: window.__mvuObservedEvents,
    chat: window.SillyTavern.getContext().chat.map(m => ({ name: m.name, is_user: m.is_user, text: m.mes, variables: m.variables })) })).catch(() => null)
  report.status = 'failed'; report.error = error.stack; console.error(error.message); process.exitCode = 1
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {})
} finally {
  releaseReply?.(); releaseImpact?.()
  await page.evaluate(() => window.__mvuRestoreReads?.()).catch(() => {})
  await Promise.allSettled(dependencies)
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
  await browser.close()
}
