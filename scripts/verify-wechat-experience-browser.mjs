import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { chromium, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

const args = process.argv.slice(2), opt = key => args.includes(key) ? args[args.indexOf(key) + 1] : undefined
assert.ok(args.includes('--isolated-data') && opt('--url'), 'Use disposable data and an explicit loopback URL')
const url = new URL(opt('--url')); assert.ok(['localhost', '127.0.0.1'].includes(url.hostname))
assert.notEqual(url.port, '18771', '18771 is reserved for user testing; never reset it')
const out = opt('--output') || 'test-results/wechat-experience-browser'; mkdirSync(out, { recursive: true })
const report = { build: JSON.parse(readFileSync('version.json')).v, sha256: createHash('sha256').update(readFileSync('bundle.js')).digest('hex'), scope: 'Real isolated ST, synthetic contacts, intercepted AI responses; desktop and simulated mobile, not physical-device or real-model validation.', scenarios: [] }
const browser = await chromium.launch({ channel: 'msedge', headless: true })
try {
  for (const size of [{ width: 1365, height: 900 }, { width: 320, height: 667 }, { width: 390, height: 844 }, { width: 667, height: 375 }].filter(size => !opt('--width') || size.width === Number(opt('--width')))) {
    const result = { ...size, checks: [], scans: [], errors: [] }; report.scenarios.push(result)
    const context = await browser.newContext({ viewport: size, isMobile: size.width < 700, hasTouch: size.width < 700 })
    await context.addInitScript(() => localStorage.setItem('language', 'zh-cn'))
    const requests = [], deferred = []
    await context.route('**/*', async route => {
      const target = new URL(route.request().url())
      if (target.origin !== url.origin) return route.abort()
      if (target.pathname !== '/wechat-experience-api') return route.continue()
      const body = route.request().postDataJSON(); requests.push(body)
      const full = JSON.stringify(body.messages)
      const response = { messages: [{ type: 'text', content: full.includes('WAIT_A') ? 'A 延迟回复' : 'B 测试回复' }], inner_thought: '想一起去旅行', current_status: '正在整理行李' }
      const fulfill = () => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ choices: [{ message: { content: JSON.stringify(response) } }] }) })
      if (full.includes('WAIT_A')) { deferred.push(fulfill); return }
      await fulfill()
    })
    const page = await context.newPage(); page.setDefaultTimeout(20000)
    page.on('pageerror', error => result.errors.push(error.message))
    async function ready() {
      await page.waitForFunction(async () => (await import('/script.js')).settingsReady)
      await page.locator('.so-phone-fab').waitFor({ state: 'attached' })
      const welcome = page.locator('dialog[open] .popup-button-ok')
      if (await welcome.isVisible()) await welcome.click()
    }
    async function saved(fn) {
      const save = page.waitForResponse(r => new URL(r.url()).pathname === '/api/settings/save' && r.ok()); await Promise.all([fn(), save])
    }
    async function openApp() {
      if (await page.locator('#sprite-overlay-root').isVisible()) await page.locator('.sprite-overlay-close').click()
      if (!await page.locator('.so-phone-shell').isVisible()) await page.locator('.so-phone-fab').click()
      await page.locator('.so-phone-homebtn').click()
      const role = page.locator('.so-phone-role')
      assert.equal(await role.evaluate(node => node.previousElementSibling?.className), 'so-phone-home-grid')
      await page.locator('[data-app-id="wechat-sister"]').click()
      await page.locator('#wt-conversations').waitFor()
    }
    async function scan(name) {
      const axe = await new AxeBuilder({ page }).include('.wechat-root').withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa']).analyze()
      const compact = rule => ({ id: rule.id, nodes: rule.nodes.map(node => ({ target: node.target, failureSummary: node.failureSummary })) })
      result.scans.push({ name, violations: axe.violations.map(compact), incomplete: axe.incomplete.map(compact) })
      assert.equal(axe.violations.length, 0, JSON.stringify(result.scans.at(-1)))
    }
    async function fit(name) {
      const bounds = await page.locator('.wechat-root').evaluate(root => {
        const box = root.getBoundingClientRect()
        return { width: box.width, height: box.height, right: box.right, bottom: box.bottom, innerWidth, innerHeight, overflow: root.scrollWidth - root.clientWidth,
          clipped: [...root.querySelectorAll('button,input,textarea,select')].filter(node => node.checkVisibility() && !node.closest('details:not([open])')).filter(node => { const b = node.getBoundingClientRect(); return b.width > 0 && (b.left < box.left - 2 || b.right > box.right + 2) }).map(node => node.id || node.getAttribute('aria-label')) }
      })
      assert.ok(bounds.height > 100 && bounds.width > 200, `${name} size ${JSON.stringify(bounds)}`)
      assert.ok(bounds.overflow <= 2 && bounds.right <= bounds.innerWidth + 2 && bounds.bottom <= bounds.innerHeight + 2, `${name} overflow ${JSON.stringify(bounds)}`)
      assert.deepEqual(bounds.clipped, [], `${name} clipped`); result.checks.push(`${name}: fits`)
    }
    try {
      await page.goto(url.href, { waitUntil: 'domcontentloaded' }); await ready()
      assert.equal(await page.evaluate(async () => [...new Uint8Array(await crypto.subtle.digest('SHA-256', await (await fetch('/scripts/extensions/third-party/baigong-acceptance/bundle.js')).arrayBuffer()))].map(b => b.toString(16).padStart(2, '0')).join('')), report.sha256)
      await saved(() => page.evaluate(async () => {
        const ctx = window.SillyTavern.getContext(), post = async (endpoint, body) => { const r = await fetch(endpoint, { method: 'POST', headers: ctx.getRequestHeaders(), body: JSON.stringify(body) }); if (!r.ok) throw new Error(endpoint + ': ' + r.status); const text = await r.text(); try { return JSON.parse(text) } catch { return text } }
        let all = await post('/api/characters/all', {})
        for (const name of ['Experience A', 'Experience B']) {
          if (!all.some(card => card.name === name)) { await post('/api/characters/create', { ch_name: name, description: name === 'Experience A' ? 'PRIVATE_A_PERSONA' : 'PRIVATE_B_PERSONA', first_mes: 'Synthetic greeting' }); all = await post('/api/characters/all', {}) }
        }
        const settings = ctx.extensionSettings.sprite_overlay
        const bytes = new Uint8Array(await (await fetch('/scripts/extensions/third-party/baigong-acceptance/assets/wechat/emojies/player/angry.png')).arrayBuffer())
        const upload = await post('/api/images/upload', { image: btoa(String.fromCharCode(...bytes)), format: 'png', ch_name: 'wechat_experience', filename: 'fixture' })
        settings.packs = [{ id: 'wechat-experience-gallery', name: '验收图库', sprites: [{ tag: '船票', url: upload.path }] }]
        settings.enabled = false; settings.showPhone = true; settings.phone = { x: 8, y: 8, open: false }
        settings.apps['wechat-sister'] = { config: { apiKey: 'synthetic', apiUrl: location.origin + '/wechat-experience-api', model: 'fixture', profile: { preset: 'general' } }, conversations: {} }
        ctx.saveSettingsDebounced()
      }))
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready()
      await page.waitForFunction(() => window.SillyTavern.getContext().characters.some(c => c.name === 'Experience A'))
      await page.evaluate(async () => { const ctx = window.SillyTavern.getContext(); const id = ctx.characters.findIndex(c => c.name === 'Experience A'); await (await import('/script.js')).selectCharacterById(id, { switchMenu: false }) })
      await page.waitForFunction(() => window.SillyTavern.getContext().name2 === 'Experience A')
      await openApp(); await fit('list'); await scan('list')
      assert.equal(await page.locator('#wt-chat').isVisible(), false)
      await page.locator('#wt-add-contact').click(); await page.locator('#wt-contact-search').fill('Experience B')
      await page.locator('[data-contact]').filter({ hasText: 'Experience B' }).click()
      await expect(page.locator('#wt-contact-name')).toHaveText('Experience B')
      assert.equal(await page.evaluate(() => window.SillyTavern.getContext().name2), 'Experience A')
      await fit('chat'); await scan('chat')
      await page.locator('#wt-input-text').fill('B hello')
      await saved(async () => { await page.locator('#wt-send-btn').click(); await expect(page.locator('#wt-current-status')).toHaveText('正在整理行李') })
      assert.equal(requests.length, 1); assert.ok(JSON.stringify(requests[0]).includes('PRIVATE_B_PERSONA')); assert.ok(!JSON.stringify(requests[0]).includes('PRIVATE_A_PERSONA'))
      result.checks.push('B reply + state, one request, host A retained')
      await page.locator('#wt-emoji-btn').click(); await page.locator('#wt-emoji-grid img').first().waitFor()
      await page.waitForFunction(() => [...document.querySelectorAll('#wt-emoji-grid img')].every(img => img.complete && img.naturalWidth > 0))
      await fit('emoji'); await scan('emoji'); await page.locator('#wt-emoji-btn').click()
      await page.locator('#wt-packet-btn').click(); await page.locator('#wt-custom-amt').fill('一张去火星的船票'); await page.locator('#wt-packet-note').fill('一起出发')
      await fit('gift'); await scan('gift')
      await saved(async () => { await page.locator('#wt-confirm-packet').click(); await expect(page.locator('#wt-scroll')).toContainText('一起出发'); await expect(page.locator('#wt-send-btn')).toBeEnabled() })
      assert.ok(JSON.stringify(requests.at(-1)).includes('一张去火星的船票')); result.checks.push('custom gift + note')
      await page.locator('#wt-settings-btn').click(); await fit('settings'); await scan('settings')
      await expect(page.locator('[data-profile-scope]')).toHaveValue('global')
      assert.equal(await page.locator('[data-profile-template-panel]').evaluate(node => node.open), false)
      await page.getByLabel('场景补充（留空遵循角色卡）', { exact: true }).fill('太空旅行')
      await saved(() => page.locator('#wt-btn-save-settings').click()); await expect(page.locator('#wt-settings-feedback')).toContainText('已保存')
      await expect(page.locator('#wt-settings-feedback')).toBeInViewport()
      await page.locator('#wt-close-settings').click(); await page.locator('#wt-settings-btn').click(); await expect(page.locator('[data-profile-scope]')).toHaveValue('global')
      await page.getByText('提示词 · 查看、编辑与恢复默认', { exact: true }).click(); await expect(page.getByLabel('聊天提示词', { exact: true })).toHaveValue(/\{角色\}/)
      await page.getByLabel('聊天提示词', { exact: true }).fill('CUSTOM {角色} {人设} {场景}')
      await page.getByText('预览实际发送的提示词', { exact: true }).click(); await expect(page.getByLabel('实际提示词预览')).toHaveValue(/CUSTOM Experience B PRIVATE_B_PERSONA 太空旅行/)
      await saved(() => page.locator('#wt-btn-save-settings').click()); await page.locator('#wt-close-settings').click()
      await page.locator('#wt-emoji-btn').click(); await page.locator('#wt-manage-emojis').click()
      await page.getByLabel('从图库选择图片', { exact: true }).selectOption({ label: '验收图库 · 船票' }); await page.getByText('添加图库图片', { exact: true }).click()
      await page.getByLabel('素材显示名', { exact: true }).fill('一起旅行')
      await saved(() => page.locator('#wt-btn-save-settings').click()); await expect(page.locator('#wt-settings-feedback')).toBeInViewport(); await page.locator('#wt-close-settings').click()
      await page.locator('#wt-emoji-btn').click(); await page.locator('#wt-emoji-grid button[aria-label="一起旅行"]').click()
      await expect(page.locator('#wt-send-btn')).toBeEnabled()
      await page.waitForFunction(() => [...document.querySelectorAll('#wt-scroll img')].some(img => img.alt === '一起旅行' && img.complete && img.naturalWidth > 0))
      result.checks.push('gallery image added, renamed, sent and loaded')
      await scan('messages-with-gift-and-gallery')
      await page.locator('#wt-back').click(); await page.locator('#wt-add-contact').click(); await page.locator('#wt-contact-search').fill('Experience A'); await page.locator('[data-contact]').filter({ hasText: 'Experience A' }).click()
      await page.locator('#wt-input-text').fill('WAIT_A'); await page.locator('#wt-send-btn').click(); await expect.poll(() => deferred.length).toBe(1)
      await page.locator('#wt-back').click(); await page.locator('[data-conversation]').filter({ hasText: 'Experience B' }).click()
      await deferred.shift()(); await expect.poll(() => page.evaluate(() => Object.values(window.SillyTavern.getContext().extensionSettings.sprite_overlay.apps['wechat-sister'].conversations).find(c => c.characterName === 'Experience A').unreadCount)).toBe(1)
      await expect(page.locator('#wt-scroll')).not.toContainText('A 延迟回复'); result.checks.push('pending A reply goes to A, B stays active')
      await page.screenshot({ path: `${out}/${size.width}-chat.png` })
      await page.locator('#wt-back').click(); await page.screenshot({ path: `${out}/${size.width}-list.png` })
      await page.reload({ waitUntil: 'domcontentloaded' }); await ready(); await openApp(); await page.locator('[data-conversation]').filter({ hasText: 'Experience B' }).click()
      await page.locator('#wt-settings-btn').click(); await expect(page.locator('[data-profile-scope]')).toHaveValue('global')
      await page.getByText('提示词 · 查看、编辑与恢复默认', { exact: true }).click(); await expect(page.getByLabel('聊天提示词', { exact: true })).toHaveValue('CUSTOM {角色} {人设} {场景}')
      await page.getByText('恢复默认聊天提示词', { exact: true }).click(); await saved(() => page.locator('#wt-btn-save-settings').click())
      result.checks.push('settings scope and prompt persist across reload; defaults restored')
      await page.screenshot({ path: `${out}/${size.width}-settings.png` })
      assert.deepEqual(result.errors, []); result.passed = true
    } catch (error) { result.failure = error.stack; await page.screenshot({ path: `${out}/${size.width}-failure.png` }).catch(() => {}); throw error }
    finally { await context.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)) }
  }
} finally { await browser.close(); writeFileSync(`${out}/report.json`, JSON.stringify(report, null, 2)) }
console.log(`WeChat experience: ${report.scenarios.length} scenarios passed`)
