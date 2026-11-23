import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'
import { loadBuiltExtension } from './load-extension'

const artifactRoot = resolve(process.env.ST_STAGE_TEST_ARTIFACT_ROOT || resolve(__dirname, '..'))

async function swipe(page: Page, from: { x: number; y: number }, dx: number, dy = 0) {
  const cdp = await page.context().newCDPSession(page)
  try {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...from, id: 1 }] })
    for (let step = 1; step <= 12; step++) {
      await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: from.x + dx * step / 12, y: from.y + dy * step / 12, id: 1 }] })
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  } finally { await cdp.detach() }
}

test.beforeEach(async ({ page }) => {
  await page.goto('about:blank')
  await page.setContent('<meta name="viewport" content="width=device-width, initial-scale=1"><div id="extensions_settings"></div>')
  await page.addStyleTag({ content: '* { box-sizing: border-box } body { margin: 0 }' })
  await page.evaluate(() => {
    const metadata = {
      st_stage_story_state: { v: 1, stat_data: { 时间: { 年: 2026, 月: 11, 日: 23 } } },
      st_stage_calendar: { v: 1, days: [] },
    }
    const context = {
      extensionSettings: { sprite_overlay: { settingsVersion: 7, enabled: false, apps: { theater: { autoGenerate: false } } } },
      saveSettingsDebounced() {}, setExtensionPrompt() {},
      eventTypes: {}, eventSource: { on() {}, removeListener() {} },
      characters: [{ name: 'Gesture', avatar: 'gesture.png' }], characterId: 0, name2: 'Gesture',
      chatId: 'gesture', chatMetadata: metadata, chat: [], groups: [], saveMetadata: async () => {},
    }
    Object.assign(window, { SillyTavern: { getContext: () => context }, stStageQueue: [{
      id: 'gesture-fixture', name: 'Gesture fixture', icon: 'G', fullbleed: true,
      mount(container: HTMLElement) {
        container.innerHTML = '<div id="gesture-scroll" style="height:100%;overflow-y:auto">'
          + '<div id="gesture-start" style="height:80px">Swipe area</div>'
          + '<button id="gesture-button" type="button">Button</button><br>'
          + '<input id="gesture-input" aria-label="Gesture input"><br>'
          + '<input id="gesture-range" type="range" aria-label="Gesture range" value="0" style="width:95%">'
          + '<div id="gesture-strip" style="overflow-x:auto;height:70px"><div style="width:1000px;height:60px">Horizontal content</div></div>'
          + '<div style="height:1400px">Vertical content</div></div>'
        container.querySelector<HTMLButtonElement>('#gesture-button')!.onclick = event => {
          (event.currentTarget as HTMLButtonElement).textContent = 'Clicked'
        }
      },
    }] })
  })
  await page.addStyleTag({ path: resolve(artifactRoot, 'style.css') })
  await loadBuiltExtension(page, artifactRoot)
  await page.locator('.so-phone-fab').tap()
})

test('left-edge touch swipe returns home in all four layouts without overflow', async ({ page }) => {
  for (const [width, height] of [[320, 667], [390, 844], [667, 375], [1365, 900]]) {
    await page.setViewportSize({ width, height })
    await page.locator('[data-app-id="gesture-fixture"]').tap()
    const screen = await page.locator('.so-phone-screen').boundingBox()
    await swipe(page, { x: screen!.x + 8, y: screen!.y + 45 }, 110)
    await expect(page.locator('.so-phone-home-grid')).toBeVisible()
    await expect(page.locator('[data-app-id="gesture-fixture"]')).toBeFocused()
    const shell = await page.locator('.so-phone-shell').boundingBox()
    expect(shell!.x).toBeGreaterThanOrEqual(0)
    expect(shell!.x + shell!.width).toBeLessThanOrEqual(width)
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(width)
  }
})

test('native vertical and horizontal scroll, controls and keyboard remain usable', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 })
  await page.locator('[data-app-id="gesture-fixture"]').tap()
  const strip = page.locator('#gesture-strip')
  await strip.evaluate(el => { el.scrollLeft = 220 })
  const stripBox = (await strip.boundingBox())!
  await swipe(page, { x: stripBox.x + 8, y: stripBox.y + 35 }, 100)
  await expect.poll(() => strip.evaluate(el => el.scrollLeft)).toBeLessThan(220)
  await expect(page.locator('#gesture-scroll')).toBeVisible()

  const range = page.locator('#gesture-range'), rangeBox = (await range.boundingBox())!
  await swipe(page, { x: rangeBox.x + 9, y: rangeBox.y + rangeBox.height / 2 }, 100)
  await expect.poll(() => range.inputValue().then(Number)).toBeGreaterThan(0)
  await page.locator('#gesture-button').tap()
  await expect(page.locator('#gesture-button')).toHaveText('Clicked')
  await page.locator('#gesture-input').fill('kept text')
  await expect(page.locator('#gesture-input')).toHaveValue('kept text')

  const scroll = page.locator('#gesture-scroll'), box = (await scroll.boundingBox())!
  await swipe(page, { x: box.x + 8, y: box.y + box.height - 25 }, 0, -130)
  await expect.poll(() => scroll.evaluate(el => el.scrollTop)).toBeGreaterThan(30)
  await page.locator('.so-phone-back').focus()
  await page.keyboard.press('Enter')
  await expect(page.locator('.so-phone-home-grid')).toBeVisible()
})

test('the chronicle week chips keep their native input without triggering edge return', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 667 })
  await page.locator('[data-app-id="chronicle"]').tap()
  await page.getByRole('tab', { name: '日历', exact: true }).click()
  const strip = page.locator('.ch-week-strip')
  await expect(strip).toBeVisible()
  const first = strip.locator('button').first()
  await first.tap()
  await expect(first).toHaveClass(/is-selected/)
  const box = (await first.boundingBox())!
  await swipe(page, { x: box.x + 8, y: box.y + box.height / 2 }, 100)
  await expect(page.locator('.so-phone-status-title')).toHaveText('纪要')
})
