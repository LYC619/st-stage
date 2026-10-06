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
  globalThis.audit = { manageDialogFocus, openAppModal, createPhoneShell, PhoneAppRegistry }
`, resolveDir: root, loader: 'ts' }, bundle: true, platform: 'browser', format: 'iife', write: false })
const browser = await chromium.launch({ channel: process.env.PLAYWRIGHT_CHANNEL || 'msedge', headless: true })
const context = await browser.newContext({ viewport: { width: 900, height: 700 } })
const report = { browser: browser.version(), scope: 'Production DOM modules with synthetic fixtures; native Edge keyboard, not screen-reader or physical-device certification.', scenarios: [] }
const scenarios = [
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
      await page.addStyleTag({ content: readFileSync(path.join(root, 'core/phone-shell.css'), 'utf8') })
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
