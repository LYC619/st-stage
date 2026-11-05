// Actual isolated ST and emitted bundle; AI and variable providers are explicit local fixtures.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { chromium } from '@playwright/test'

const args = process.argv.slice(2), option = name => args.includes(name) ? args[args.indexOf(name) + 1] : undefined
assert.ok(option('--url') && args.includes('--isolated-data'), 'Supply a disposable ST URL and --isolated-data')
const url = new URL(option('--url'))
assert.ok(url.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname) && !url.username && !url.password)
const output = path.resolve('test-results/wechat-profile-browser'); mkdirSync(output, { recursive: true })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, browser: browser.version(),
  scope: 'Isolated real ST; synthetic character and chats. Intercepted AI and controlled TavernHelper fixture, not real AI/MVU or physical-device acceptance.', scenarios: [] }
try {
  for (const width of [1365, 320]) {
    const entry = { width, errors: [], requestCounts: [] }; report.scenarios.push(entry)
    const context = await browser.newContext({ viewport: { width, height: width === 320 ? 667 : 900 } })
    await context.addInitScript(() => localStorage.setItem('language', 'zh-cn'))
    let requests = [], failReply = false
    await context.route('**/*', async route => {
      const target = new URL(route.request().url())
      if (target.origin !== url.origin) return route.abort()
      if (target.pathname !== '/wechat-profile-acceptance') return route.continue()
      const body = route.request().postDataJSON(); requests.push(body)
      const impact = body.messages.some(message => message.content.includes('聊天状态分析器'))
      if (failReply && !impact) return route.fulfill({ status: 503, body: 'injected fixture failure' })
      const content = impact ? { mood: 0.1, interest: 0.1 } : { messages: [{ type: 'text', content: '合成测试回复' }] }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(content) } }] }) })
    })
    const page = await context.newPage(); page.setDefaultTimeout(15000)
    page.on('pageerror', error => entry.errors.push(error.message))
    const name = 'WeChat Profile Acceptance', runId = Date.now(), chatA = `Profile-A-${runId}`, chatB = `Profile-B-${runId}`
    const marker = `MAIN_CHAT_CONTEXT_${runId}`
    async function ready() {
      await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
      await page.waitForSelector('.so-phone-fab', { state: 'attached' })
    }
    async function saved(action) {
      const response = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.status() === 200)
      await action(); await response
    }
    async function openChat(chat) {
      await page.waitForFunction(name => window.SillyTavern.getContext().characters.some(c => c.name === name), name)
      await page.evaluate(async ({ name, chat }) => {
        const ctx = window.SillyTavern.getContext()
        const id = ctx.characters.findIndex(c => c.name === name)
        if (Number(ctx.characterId) !== id) await (await import('/script.js')).selectCharacterById(id, { switchMenu: false })
        await window.SillyTavern.getContext().openCharacterChat(chat)
      }, { name, chat })
      await page.waitForFunction(({ marker, chat }) => {
        const ctx = window.SillyTavern.getContext()
        return ctx.chatId === chat && ctx.chat.some(m => m.mes === marker)
      }, { marker, chat })
    }
    async function openApp() {
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      await page.locator('.so-phone-app-icon[data-app-id="wechat-sister"]').press('Enter')
      await page.locator('.wechat-root').waitFor()
    }
    async function settings() {
      await page.locator('#wt-status-pill').press('Enter')
      assert.equal(await page.locator('#wt-close-settings').evaluate(node => document.activeElement === node), true)
      await page.locator('[data-profile-scope]').selectOption('global')
      const summary = page.locator('#wt-settings-modal summary')
      if (!await summary.evaluate(node => node.parentElement.open)) await summary.click()
    }
    async function send(text, reply) {
      requests = []
      await page.locator('#wt-input-text').fill(text)
      await saved(async () => {
        await page.locator('#wt-send-btn').click()
        await page.getByText(reply, { exact: true }).last().waitFor()
      })
      entry.requestCounts.push(requests.length)
      return JSON.stringify(requests)
    }
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready()
      let assetPath
      await saved(async () => {
        assetPath = await page.evaluate(async ({ name, chatA, chatB, marker }) => {
          const ctx = window.SillyTavern.getContext()
          const post = async (endpoint, body) => {
            const response = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) })
            if (!response.ok) throw new Error(endpoint + ': ' + response.status)
            const text = await response.text(); try { return JSON.parse(text) } catch { return text }
          }
          let characters = await post('/api/characters/all', {})
          if (!characters.some(c => c.name === name)) {
            await post('/api/characters/create', { ch_name: name, description: 'Synthetic researcher character.', first_mes: 'Synthetic greeting.' })
            characters = await post('/api/characters/all', {})
          }
          const character = characters.find(c => c.name === name)
          await post('/api/chats/get', { avatar_url: character.avatar, ch_name: name, file_name: chatA })
          for (const file_name of [chatA, chatB]) await post('/api/chats/save', { avatar_url: character.avatar, ch_name: name, file_name, force: true,
            chat: [{ user_name: 'Acceptance', character_name: name, chat_metadata: {} }, { name, is_user: false, is_system: false, send_date: '2026-11-04T00:00:00.000Z', mes: marker }] })
          const imageBytes = new Uint8Array(await (await fetch('/img/user-default.png')).arrayBuffer())
          const upload = await post('/api/images/upload', { image: btoa(String.fromCharCode(...imageBytes)), format: 'png', ch_name: 'wechat_profile_acceptance', filename: 'fixture' })
          ctx.extensionSettings.sprite_overlay.apps['wechat-sister'] = { config: { apiKey: 'synthetic-local-key', apiUrl: `${location.origin}/wechat-profile-acceptance`, model: 'local-fixture' }, conversations: {} }
          ctx.saveSettingsDebounced()
          return upload.path
        }, { name, chatA, chatB, marker })
      })
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(chatA); await openApp()
      const oldMessages = await page.locator('#wt-scroll').textContent()
      await settings()
      await page.getByLabel('场景预设', { exact: true }).selectOption('general')
      await page.getByLabel('用户称呼（可留空）', { exact: true }).fill('小王')
      await page.getByLabel('联系人显示名（留空跟随角色卡）', { exact: true }).fill('陈墨 <测试>')
      await page.getByLabel('新会话开场白（不改已有记录）', { exact: true }).fill('新的通用开场')
      await page.getByLabel('读取主聊天最近消息数（0 表示不读取）', { exact: true }).fill('0')
      for (const [label, field] of [['心情', 'moodScore'], ['交流兴趣/好感', 'interestScore'], ['钱包', 'balance'], ['地点', 'place']]) {
        await page.getByLabel(`${label}变量路径（留空自动识别）`, { exact: true }).fill(`acceptance.${field}`)
      }
      await page.getByLabel('素材地址（HTTPS 或酒馆 /user/images/ 路径；留空恢复默认）', { exact: true }).fill(assetPath)
      await page.getByLabel('素材地址（HTTPS 或酒馆 /user/images/ 路径；留空恢复默认）', { exact: true }).scrollIntoViewIfNeeded()
      const assetEditable = await page.getByLabel('素材地址（HTTPS 或酒馆 /user/images/ 路径；留空恢复默认）', { exact: true }).evaluate(node => {
        const r = node.getBoundingClientRect()
        return node === document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2)
      })
      assert.equal(assetEditable, true, 'Asset field is obscured by settings actions')
      await page.screenshot({ path: path.join(output, `settings-${width}.png`) })
      await saved(() => page.locator('#wt-btn-save-settings').click())
      assert.equal(await page.locator('#wt-status-pill').evaluate(node => document.activeElement === node), true)
      assert.equal(await page.locator('#wt-contact-name').textContent(), '陈墨 <测试>')
      assert.equal(await page.locator('#wt-contact-name').evaluate(node => node.children.length), 0)
      assert.equal(await page.locator('#wt-scroll').textContent(), oldMessages)
      const disabledContext = await send('微信第一条', '合成测试回复')
      assert.ok(!disabledContext.includes(marker)); assert.match(disabledContext, /用户称呼：小王/)
      assert.match(disabledContext, /不擅自添加亲属关系/); assert.ok(!disabledContext.includes('半推半就'))
      assert.equal(requests.length, 2)
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openChat(chatA); await openApp()
      await page.getByText('微信第一条', { exact: true }).waitFor()
      assert.equal(await page.locator('#wt-contact-name').textContent(), '陈墨 <测试>')
      await page.locator('#wt-emoji-btn').click()
      assert.equal(await page.locator('#wt-emoji-grid button').count(), 1)
      assert.equal(await page.locator('#wt-emoji-grid img').getAttribute('src'), assetPath)
      await page.waitForFunction(() => document.querySelector('#wt-emoji-grid img')?.naturalWidth > 0)
      await page.locator('#wt-emoji-btn').click()
      await settings()
      assert.equal(await page.getByLabel('读取主聊天最近消息数（0 表示不读取）', { exact: true }).inputValue(), '0')
      await page.getByLabel('读取主聊天最近消息数（0 表示不读取）', { exact: true }).fill('2')
      await saved(() => page.locator('#wt-btn-save-settings').click())
      // Controlled fixture proves mapping and ownership only; never label it as installed MVU.
      await page.evaluate(() => {
        window.TavernHelper = { getVariables: () => ({ stat_data: { acceptance: { moodScore: [82, 'fixture'], interestScore: 35, balance: 1000, place: '测试图书馆' } } }) }
      })
      await openChat(chatB); await openApp()
      await page.getByText('新的通用开场', { exact: true }).waitFor()
      assert.equal(await page.getByText('微信第一条', { exact: true }).count(), 0)
      await page.waitForFunction(() => document.querySelector('#val-mood')?.textContent === '82')
      const enabledContext = await send('微信第二条', '合成测试回复')
      assert.match(enabledContext, new RegExp(marker)); assert.match(enabledContext, /测试图书馆/)
      assert.equal(requests.length, 1)
      await settings()
      assert.equal(await page.locator('#wt-set-mood-range').isDisabled(), true)
      assert.equal(await page.locator('#wt-set-interest-range').isDisabled(), true)
      assert.equal(await page.locator('#wt-wallet-bal').textContent(), '1000')
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('#wt-settings-modal').isVisible(), false)
      assert.equal(await page.locator('#wt-status-pill').evaluate(node => document.activeElement === node), true)
      failReply = true
      await send('触发合成故障', '收到你的消息了。')
      assert.equal(requests.length, 1)
      await openChat(chatA); await openApp()
      await page.getByText('微信第一条', { exact: true }).waitFor()
      assert.equal(await page.getByText('微信第二条', { exact: true }).count(), 0)
      for (const selector of ['.wechat-root', '.wechat-input-bar', '#wt-send-btn']) {
        const rect = await page.locator(selector).evaluate(node => { const r = node.getBoundingClientRect(); return { left: r.left, right: r.right, bottom: r.bottom, top: r.top, overflow: node.scrollWidth - node.clientWidth, width: innerWidth, height: innerHeight } })
        assert.ok(rect.left >= 0 && rect.top >= 0 && rect.right <= rect.width && rect.bottom <= rect.height && rect.overflow <= 1, JSON.stringify(rect))
      }
      await page.screenshot({ path: path.join(output, `chat-${width}.png`) })
      assert.deepEqual(entry.errors, []); entry.status = 'passed'; console.log(`PASS ${width}px`)
    } catch (error) {
      entry.status = 'failed'; entry.error = error.stack
      await page.screenshot({ path: path.join(output, `failure-${width}.png`) }).catch(() => {})
      console.error(error.message)
    } finally { await context.close() }
  }
} finally { await browser.close(); writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n') }
assert.ok(report.scenarios.every(entry => entry.status === 'passed'), `Inspect ${output}`)
