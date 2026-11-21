// Native keyboard regression for shared modal/phone focus. Synthetic DOM/data only.
import assert from 'node:assert/strict'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { build } from 'esbuild'
import { chromium } from '@playwright/test'

const root = fileURLToPath(new URL('..', import.meta.url))
const output = path.join(root, 'test-results', 'dialog-browser')
mkdirSync(output, { recursive: true })
const built = await build({ stdin: { contents: `
  import { manageDialogFocus } from './core/dialog-focus.ts'
  import { openAppModal } from './core/app-modal.ts'
  import { createPhoneShell } from './core/phone-shell.ts'
  import { PhoneAppRegistry } from './core/phone-registry.ts'
  import { openSpriteLightbox } from './st-extension/src/sprite-lightbox.ts'
  import { openImageStorageDialog } from './st-extension/src/image-storage-dialog.ts'
  import { createVariableHud } from './st-extension/src/variable-hud.ts'
  import { processMessages } from './st-extension/src/message-postprocess.ts'
  import { createStoryImageCapture } from './st-extension/src/story-image-capture.ts'
  import { createDefaultSettings } from './core/types.ts'
  import { loadTranslations, setLocale } from './core/i18n.ts'
  import en from './st-extension/locales/en-US.json'
  globalThis.audit = { manageDialogFocus, openAppModal, createPhoneShell, PhoneAppRegistry, openSpriteLightbox, openImageStorageDialog, createVariableHud, processMessages, createStoryImageCapture, createDefaultSettings,
    setEnglish: () => { loadTranslations('en-US', en); setLocale('en-US') } }
`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', write: false })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 900, height: 700 } })
const report = { browser: browser.version(), scope: 'Production DOM modules with synthetic fixtures; native Edge keyboard, not screen-reader or physical-device certification.', scenarios: [] }
const scenarios = [
  ['inline-illustration-save-and-retry-are-independent', async page => {
    let imageRequests = 0
    await page.route('https://image.test/**', route => { imageRequests++; return route.abort() })
    await page.evaluate(() => {
      window.audit.setEnglish()
      const chat = document.createElement('div'); chat.id = 'chat'
      chat.innerHTML = '<div class="mes" mesid="0" is_user="false"><div class="mes_text">[插图:fail1.png] [插图:fail2.png]</div></div>'
      document.body.append(chat)
      let settings = window.audit.createDefaultSettings()
      settings.renderInlineImages = true; settings.imageHost = 'https://image.test/'
      window.audit.processMessages(settings, 0)
      window.saveCalls = 0
      window.capture = window.audit.createStoryImageCapture({ getSettings: () => settings, updateSettings: next => { settings = next }, getStoryContext: () => ({ key: 'test', title: '用户章节', characterName: '用户角色' }), localize: async sprite => { window.saveCalls++; return { ...sprite, url: '/user/images/test.webp' } } })
      window.capture.decorate(chat)
    })
    await page.waitForFunction(() => document.querySelectorAll('.so-inline-image-error').length === 2)
    assert.equal(await page.locator('.so-inline-image [role="button"], .so-inline-image button').count(), 0)
    for (const [index, key] of ['Enter', 'Space'].entries()) {
      const save = page.locator('.so-story-save-action').nth(index)
      await save.focus(); await page.keyboard.press(key)
      await page.waitForFunction(count => window.saveCalls === count, index + 1)
      assert.equal(await save.textContent(), 'Saved')
    }
    assert.equal(imageRequests, 2, 'Saving must not trigger image retries')
    await page.evaluate(() => window.capture.cleanup())
  }],
  ['inline-image-keyboard-retry', async page => {
    await page.route('https://image.test/**', route => route.abort())
    await page.evaluate(() => {
      window.audit.setEnglish()
      const chat = document.createElement('div'); chat.id = 'chat'
      chat.innerHTML = '<div class="mes" mesid="0" is_user="false" ch_name="User character"><div class="mes_text">[立绘:用户图片]</div></div>'
      document.body.append(chat)
      const settings = window.audit.createDefaultSettings()
      settings.spriteDisplayMode = 'inline'
      settings.packs = [{ id: 'fixture', name: '用户包', sprites: [{ tag: '用户图片', url: 'https://image.test/fail.png' }] }]
      settings.bindings = [{ characterName: 'User character', packIds: ['fixture'], enabled: true }]
      window.audit.processMessages(settings, 0)
    })
    const retry = page.getByRole('button', { name: 'Image failed to load. Activate to retry.' })
    await retry.waitFor()
    await retry.focus()
    for (const key of ['Enter', 'Space']) {
      const request = page.waitForRequest(r => r.url().includes('so_retry='))
      await page.keyboard.press(key); await request
      await focused(page, '.so-inline-image-error')
    }
    assert.equal(await retry.locator('img').getAttribute('alt'), '用户图片')
    await page.screenshot({ path: path.join(output, 'inline-image-retry.png') })
  }],
  ['hud-native-keyboard-and-pointer', async page => {
    await page.evaluate(() => {
      window.audit.setEnglish()
      window.audit.createVariableHud({ readState: () => ({ x: 30, y: 30, open: false }), writeState() {}, subscribe: () => () => {}, readSections: () => [{ source: 'Synthetic', root: { '用户变量': 42 }, notice: '' }] })
      window.hostActivations = 0
      document.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') window.hostActivations++ })
    })
    for (const key of ['Enter', 'Space']) {
      await page.locator('.so-varhud-btn').focus()
      await page.keyboard.press(key)
      await focused(page, '.so-varhud-close')
      assert.equal(await page.locator('.so-varhud-btn').getAttribute('aria-expanded'), 'true')
      assert.ok(await page.locator('.so-varhud-panel').textContent().then(text => text.includes('用户变量42')))
      await page.keyboard.press('Tab')
      assert.equal(await page.locator('.so-varhud-panel').evaluate(node => node.contains(document.activeElement)), false) // The HUD is nonmodal.
      await page.locator('.so-varhud-close').focus()
      await page.keyboard.press('Escape'); await focused(page, '.so-varhud-btn')
    }
    assert.equal(await page.evaluate(() => window.hostActivations), 0)
    await page.locator('.so-varhud-btn').click()
    await focused(page, '.so-varhud-close')
    assert.equal(await page.locator('.so-varhud-panel').isVisible(), true, 'Pointer release and native click must not toggle twice')
    await page.locator('.so-varhud-close').press('Enter')
    await focused(page, '.so-varhud-btn')
  }],
  ['storage-transformed-mobile-root', async page => {
    await page.setViewportSize({ width: 375, height: 667 })
    // ST's mobile host has a transformed, zero-height root; fixed inset alone collapses here.
    await page.addStyleTag({ content: 'html { height: 0; transform: translateZ(0); perspective: 1000px } body { position: fixed; width: 100vw; height: 100vh; margin: 0 } .menu_button { width: min-content }' })
    await page.evaluate(() => {
      window.audit.setEnglish()
      const settings = window.audit.createDefaultSettings()
      window.audit.openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings }, getSettings: () => settings, updateSettings() {}, saveDataUri: async () => '', onClosed() {} })
    })
    for (const viewport of [{ width: 375, height: 667 }, { width: 667, height: 375 }]) {
      await page.setViewportSize(viewport)
      const r = await page.locator('.so-storage-dialog').boundingBox()
      assert.ok(r && r.height > 150 && r.y >= 0 && r.y + r.height <= viewport.height && r.x >= 0 && r.x + r.width <= viewport.width, `Storage collapsed/outside viewport: ${JSON.stringify(r)}`)
      const action = await page.locator('.so-storage-actions button').first().boundingBox()
      assert.ok(action && action.width >= 100 && action.height < 100, `Storage action squeezed to a vertical column: ${JSON.stringify(action)}`)
      await page.locator('.so-storage-footer button').focus()
      await hittable(page, '.so-storage-footer button')
    }
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.so-storage-dialog').count(), 0)
  }],
  ['preview-storage-nested-focus', async page => {
    await page.locator('#opener').focus()
    await page.evaluate(() => {
      window.audit.setEnglish()
      window.navigation = []
      window.audit.openSpriteLightbox({ pack: { id: 'synthetic', name: 'Synthetic', sprites: [{ tag: 'One', url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }, { tag: 'Two', url: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg"/>' }] }, index: 0, readonly: false,
        actions: [{ id: 'storage', label: 'Storage', run() {
          const settings = window.audit.createDefaultSettings()
          window.audit.openImageStorageDialog({ adapter: { getStoredSettingsForBackup: () => settings }, getSettings: () => settings, updateSettings() {}, saveDataUri: async () => '', onClosed() {} })
        } }], onNavigate(index) { window.navigation.push(index) }, onClose() {} })
    })
    await focused(page, '.so-lightbox-prev')
    await page.keyboard.press('ArrowRight')
    assert.deepEqual(await page.evaluate(() => window.navigation), [1])
    await page.getByRole('button', { name: 'Storage', exact: true }).click()
    await focused(page, '.so-storage-actions button:first-child')
    await hittable(page, '.so-storage-actions button:first-child')
    await page.keyboard.press('ArrowLeft')
    assert.deepEqual(await page.evaluate(() => window.navigation), [1], 'A nested dialog must suspend preview arrow navigation')
    await page.getByRole('button', { name: 'Close', exact: true }).focus()
    await page.keyboard.press('Tab'); await focused(page, '.so-storage-actions button:first-child')
    await page.keyboard.press('Shift+Tab'); await focused(page, '.so-storage-footer button')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.so-storage-dialog').count(), 0)
    await focused(page, '[data-action-id="storage"]')
    await page.evaluate(() => window.audit.openAppModal(body => { body.innerHTML = '<button id="nested-action">Nested action</button>' }, { onOpen() {}, onClose() {} }))
    await hittable(page, '#nested-action')
    await page.keyboard.press('Escape')
    await focused(page, '[data-action-id="storage"]')
    await page.keyboard.press('Escape')
    assert.equal(await page.locator('.so-lightbox').count(), 0)
    await focused(page, '#opener')
  }],
  ['radio-native-tab', async page => {
    await fixture(page, '<button id="first">First</button><input id="selected" type="radio" name="mode" checked><input id="tail" type="radio" name="mode">')
    await page.keyboard.press('Tab'); await focused(page, '#selected')
    await page.keyboard.press('Tab'); await focused(page, '#first')
    await page.keyboard.press('Shift+Tab'); await focused(page, '#selected')
    await page.keyboard.press('ArrowRight'); await focused(page, '#tail')
    assert.equal(await page.locator('#tail').isChecked(), true)
    await page.keyboard.press('Tab'); await focused(page, '#first')
  }],
  ['contenteditable-native-tab', async page => {
    await fixture(page, '<button id="first">First</button><div id="editor" contenteditable="true">Edit me<div contenteditable="true">Nested region</div></div>')
    await page.keyboard.press('Tab'); await focused(page, '#editor')
    await page.keyboard.type('Keyboard text')
    assert.match(await page.locator('#editor').textContent(), /Keyboard text/)
    await page.keyboard.press('Tab'); await focused(page, '#first')
    await page.keyboard.press('Shift+Tab'); await focused(page, '#editor')
  }],
  ['hidden-and-dynamic-controls', async page => {
    await fixture(page, '<button id="first">First</button><input hidden><fieldset disabled><input></fieldset><details><summary id="summary">Details</summary><input id="revealed"></details><button id="last">Last</button>')
    await page.keyboard.press('Tab'); await focused(page, '#summary')
    await page.keyboard.press('Tab'); await focused(page, '#last')
    await page.keyboard.press('Tab'); await focused(page, '#first')
    await page.keyboard.press('Tab')
    await page.keyboard.press('Space')
    await page.keyboard.press('Tab'); await focused(page, '#revealed')
    await page.keyboard.press('Tab'); await focused(page, '#last')
  }],
  ['nested-app-modal-escape-and-return', async page => {
    await page.locator('#opener').focus()
    await page.evaluate(() => {
      window.hostKeys = 0
      document.addEventListener('keydown', () => window.hostKeys++)
      window.audit.openAppModal(body => {
        body.innerHTML = '<button id="nested-opener">Open nested dialog</button>'
        body.firstElementChild.onclick = () => window.audit.openAppModal(inner => { inner.innerHTML = '<label>Name<input></label>' }, { onOpen() {}, onClose() {} })
      }, { onOpen() {}, onClose() {} })
    })
    await page.locator('#nested-opener').click()
    assert.equal(await page.getByRole('dialog').count(), 2)
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 1)
    await focused(page, '#nested-opener')
    await page.keyboard.press('Escape')
    assert.equal(await page.getByRole('dialog').count(), 0)
    await focused(page, '#opener')
    assert.equal(await page.evaluate(() => window.hostKeys), 0)
  }],
  ['empty-dialog-and-sync-cleanup', async page => {
    await fixture(page, 'No controls')
    await focused(page, '#fixture')
    await page.keyboard.press('Tab'); await focused(page, '#fixture')
    await page.evaluate(() => { window.fixtureFocus.dispose(); document.querySelector('#fixture').remove(); window.fixtureFocus.restoreFocus() })
    await focused(page, '#opener')
    const cleaned = await page.evaluate(() => {
      let cleaned = 0
      window.audit.openAppModal((_body, close) => { close(); return () => { cleaned++ } }, { onOpen() {}, onClose() {} })
      return cleaned
    })
    assert.equal(cleaned, 1)
    await page.keyboard.press('Tab'); await focused(page, '#outside')
  }],
  ['phone-keyboard-and-remount', async page => {
    await page.evaluate(() => {
      const registry = new window.audit.PhoneAppRegistry()
      let value = 'sample'
      registry.register({ id: 'test-app', name: 'Test App', icon: 'T', mount(container) {
        const label = document.createElement('label')
        label.textContent = 'Name'
        const input = document.createElement('input')
        input.id = 'app-input'; input.value = value
        input.onchange = () => { value = input.value; window.phone.setState({ x: 20, y: 20, open: true }) }
        label.append(input); container.append(label)
      } })
      window.phone = window.audit.createPhoneShell({ x: 20, y: 20, open: false }, { registry, createAppContext: () => ({ ctx: {}, dispose() {} }), onStateChange() {} })
    })
    await page.locator('.so-phone-fab').focus()
    await page.keyboard.press('Enter'); await focused(page, '.so-phone-app-icon')
    await page.keyboard.press('Space'); await focused(page, '.so-phone-app-container')
    await page.keyboard.press('Tab'); await focused(page, '#app-input')
    await page.locator('#app-input').fill('Changed')
    await page.keyboard.press('Enter')
    await focused(page, '#app-input')
    assert.equal(await page.locator('#app-input').inputValue(), 'Changed')
    await page.evaluate(() => { document.querySelector('#app-input').setSelectionRange(1, 4); window.phone.setState({ x: 20, y: 20, open: true }) })
    assert.deepEqual(await page.locator('#app-input').evaluate(input => [input.selectionStart, input.selectionEnd]), [1, 4])
    await page.keyboard.press('Escape'); await focused(page, '.so-phone-app-icon')
    await page.keyboard.press('Escape'); await focused(page, '.so-phone-fab')
    await page.evaluate(() => window.phone.destroy())
  }],
  ['phone-remount-inserted-field', async page => {
    await page.evaluate(() => {
      const registry = new window.audit.PhoneAppRegistry()
      registry.register({ id: 'dynamic', name: 'Dynamic fields', icon: 'D', mount(container) {
        container.innerHTML = (window.extra ? '<label for="new">New optional field</label><input id="new" value="different">' : '')
          + '<label for="original">Original name</label><input id="original" value="sample">'
      } })
      window.phone = window.audit.createPhoneShell({ x: 20, y: 20, open: false }, { registry, createAppContext: () => ({ ctx: {}, dispose() {} }), onStateChange() {} })
      window.phone.openApp('dynamic')
      document.querySelector('#original').focus()
      document.querySelector('#original').setSelectionRange(1, 4)
      window.extra = true
      window.phone.setState({ x: 20, y: 20, open: true })
    })
    await focused(page, '.so-phone-app-container')
    assert.equal(await page.locator('#new').inputValue(), 'different')
    await page.keyboard.press('Tab'); await focused(page, '#new')
    await page.evaluate(() => window.phone.destroy())
  }],
]

async function focused(page, selector) {
  assert.equal(await page.locator(selector).evaluate(element => document.activeElement === element), true, `Expected focus on ${selector}; got ${await page.evaluate(() => document.activeElement?.outerHTML.slice(0, 200))}`)
}
async function hittable(page, selector) {
  assert.equal(await page.locator(selector).evaluate(element => {
    const rect = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(rect.left + rect.width / 2, rect.top + rect.height / 2))
  }), true, `${selector} is covered by another layer`)
}
async function fixture(page, html) {
  await page.locator('#opener').focus()
  await page.evaluate(html => {
    const container = document.createElement('div')
    container.id = 'fixture'; container.innerHTML = html
    document.body.append(container)
    window.fixtureFocus = window.audit.manageDialogFocus(container, { onEscape() {} })
    window.fixtureFocus.focusInitial()
  }, html)
}
try {
  for (const [name, run] of scenarios) {
    const page = await context.newPage()
    const entry = { name, errors: [] }
    report.scenarios.push(entry)
    page.on('pageerror', error => entry.errors.push(error.message))
    try {
      await page.setContent('<!doctype html><html lang="en"><body><button id="opener">Open</button><button id="outside">Outside</button></body></html>')
      await page.addStyleTag({ content: readFileSync(path.join(root, 'style.css'), 'utf8') })
      await page.addScriptTag({ content: built.outputFiles[0].text })
      await run(page)
      assert.deepEqual(entry.errors, [])
      entry.status = 'passed'
      console.log(`PASS ${name}`)
    } catch (error) {
      entry.status = 'failed'; entry.error = error.stack
      await page.screenshot({ path: path.join(output, `${name}-failure.png`) }).catch(() => {})
      console.error(`FAIL ${name}: ${error.message}`)
    } finally { await page.close() }
  }
} finally {
  await browser.close()
  writeFileSync(path.join(output, 'results.json'), JSON.stringify(report, null, 2) + '\n')
}
assert.ok(report.scenarios.every(entry => entry.status === 'passed'), `Dialog browser regression failed: ${output}`)
console.log(`Dialog browser regression: ${report.scenarios.length} passed.`)
