import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

function spriteData(label: string, color: string): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="960"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" fill="white" font-size="64" text-anchor="middle">${label}</text></svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

async function loadRealExtensionGallery(page: Page): Promise<void> {
  await page.goto('about:blank')
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<main id="chat"></main><section id="extensions_settings"></section>',
  )
  const packs = [
    {
      id: 'snow-home',
      name: '小雪居家',
      roleName: '小雪',
      sprites: [
        {
          tag: '挥手1',
          url: spriteData('挥手1', '#387a65'),
          labels: ['超长动作标签用于移动端布局验证'],
        },
        {
          tag: '挥手2',
          url: spriteData('挥手2', '#a34855'),
          labels: ['超长动作标签用于移动端布局验证'],
        },
      ],
    },
    {
      id: 'snow-outdoor',
      name: '小雪外出',
      roleName: '小雪',
      sprites: [{ tag: '散步', url: spriteData('散步', '#4e6092'), labels: ['户外'] }],
    },
  ]
  await page.evaluate((fixturePacks) => {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
    const context = {
      extensionSettings: {
        sprite_overlay: {
          settingsVersion: 4,
          galleryFoldByRole: true,
          packs: fixturePacks,
        },
      },
      saveSettingsDebounced: () => {},
      setExtensionPrompt: () => {},
      eventTypes: {
        MESSAGE_RECEIVED: 'message_received',
        CHAT_CHANGED: 'chat_changed',
        CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
      },
      eventSource: {
        on: (event: string, handler: (...args: unknown[]) => void) => {
          const listeners = handlers.get(event) ?? new Set()
          listeners.add(handler)
          handlers.set(event, listeners)
        },
        removeListener: (event: string, handler: (...args: unknown[]) => void) => {
          handlers.get(event)?.delete(handler)
        },
      },
      characters: [{ name: '小雪' }],
      characterId: 0,
      name2: '小雪',
      chatId: 'chapter-1',
      chatMetadata: { name: '第一章' },
      groups: [],
      chat: [],
    }
    ;(window as Window & { SillyTavern: unknown }).SillyTavern = { getContext: () => context }
  }, packs)
  await page.addStyleTag({ path: resolve(ROOT, 'st-extension/style.css') })
  await page.addStyleTag({ path: resolve(ROOT, 'core/phone-shell.css') })
  await page.addScriptTag({ path: resolve(ROOT, 'bundle.js'), type: 'module' })
  await expect(page.locator('.so-phone-fab')).toBeVisible()
}

async function openRealGalleryManager(page: Page): Promise<void> {
  await page.locator('.so-phone-fab').tap()
  await page.locator('.so-phone-app-icon', { hasText: '图库' }).tap()
  await page.locator('.so-app-btn', { hasText: '打开立绘包管理' }).tap()
  await expect(page.locator('.so-manager')).toBeVisible()
}

async function expectInsideViewport(page: Page, selector: string): Promise<void> {
  const locator = page.locator(selector)
  await expect(locator).toBeVisible()
  await expect.poll(async () => {
    const box = await locator.boundingBox()
    const viewport = page.viewportSize()
    return Boolean(
      box && viewport
      && box.x >= -0.5
      && box.y >= -0.5
      && box.x + box.width <= viewport.width + 0.5
      && box.y + box.height <= viewport.height + 0.5,
    )
  }, { message: `${selector} should stay inside the viewport` }).toBe(true)
}

async function expectLightboxLayout(page: Page): Promise<void> {
  await expectInsideViewport(page, '.so-lightbox')
  await expectInsideViewport(page, '.so-lightbox-image')
  await expectInsideViewport(page, '.so-lightbox-actions')
  const overlap = await page.evaluate(() => {
    const image = document.querySelector('.so-lightbox-image')!.getBoundingClientRect()
    const actions = document.querySelector('.so-lightbox-actions')!.getBoundingClientRect()
    return Math.max(0, Math.min(image.right, actions.right) - Math.max(image.left, actions.left))
      * Math.max(0, Math.min(image.bottom, actions.bottom) - Math.max(image.top, actions.top))
  })
  expect(overlap).toBe(0)
  for (const selector of ['.so-lightbox-close', '.so-lightbox-action']) {
    const receivesPointer = await page.locator(selector).first().evaluate((element) => {
      const box = element.getBoundingClientRect()
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2)
      return hit === element || element.contains(hit)
    })
    expect(receivesPointer, `${selector} should remain clickable`).toBe(true)
  }
}

/**
 * 移动端冒烟测试：Web 模拟器与 ST 端共用同一套手机壳（core/phone-shell）与样式，
 * 这里在移动视口下锁住小屏关键行为——壳的视口钳位、触摸点按、拖拽、设置持久化、聊天链路。
 * 注意：Web 端只装配 sprites/gallery 简化版 App（components/phone-mount.tsx），
 * butler/mvu/newvar 仅在 ST 内，不在本套件覆盖范围。
 */

async function openPhone(page: Page): Promise<void> {
  await page.locator('.so-phone-fab').tap()
  await expect(page.locator('.so-phone-shell')).toBeVisible()
}

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  // 设置从 localStorage 异步加载完成后手机图标才出现
  await expect(page.locator('.so-phone-fab')).toBeVisible()
})

test('页面在移动视口无横向溢出，手机图标完整落在可视区内', async ({ page }) => {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  )
  expect(overflow).toBeLessThanOrEqual(0)

  const box = (await page.locator('.so-phone-fab').boundingBox())!
  const viewport = page.viewportSize()!
  expect(box.x).toBeGreaterThanOrEqual(0)
  expect(box.y).toBeGreaterThanOrEqual(0)
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width)
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height)
})

test('点按图标展开手机壳：整机钳入视口，Home 屏显示 App 栅格', async ({ page }) => {
  await openPhone(page)

  const shell = (await page.locator('.so-phone-shell').boundingBox())!
  const viewport = page.viewportSize()!
  expect(shell.x).toBeGreaterThanOrEqual(0)
  expect(shell.y).toBeGreaterThanOrEqual(0)
  expect(shell.x + shell.width).toBeLessThanOrEqual(viewport.width)
  expect(shell.y + shell.height).toBeLessThanOrEqual(viewport.height)

  await expect(page.locator('.so-phone-app-icon', { hasText: '立绘' })).toBeVisible()
  await expect(page.locator('.so-phone-app-icon', { hasText: '图库' })).toBeVisible()
})

test('进入 App → 顶部返回键回主屏 → ✕ 收起手机恢复图标', async ({ page }) => {
  await openPhone(page)

  await page.locator('.so-phone-app-icon', { hasText: '立绘' }).tap()
  await expect(page.locator('.so-app-section').first()).toBeVisible()
  await expect(page.locator('.so-phone-status-title')).toHaveText('立绘')

  await page.locator('.so-phone-back').tap()
  await expect(page.locator('.so-phone-home-grid')).toBeVisible()

  await page.locator('.so-phone-close').tap()
  await expect(page.locator('.so-phone-shell')).toBeHidden()
  await expect(page.locator('.so-phone-fab')).toBeVisible()
})

test('App 内改设置在刷新后保持（localStorage 持久化）', async ({ page }) => {
  await openPhone(page)
  await page.locator('.so-phone-app-icon', { hasText: '立绘' }).tap()

  const toggle = page
    .locator('.so-app-toggle', { hasText: '启用立绘悬浮窗' })
    .locator('input[type="checkbox"]')
  const before = await toggle.isChecked()
  await toggle.tap()
  await expect(toggle).toBeChecked({ checked: !before })

  // 设置落盘走 400ms 防抖
  await page.waitForTimeout(700)
  await page.reload()
  // 手机开合状态同样持久化：刷新后直接恢复为展开态（图标保持隐藏）
  await expect(page.locator('.so-phone-shell')).toBeVisible()
  await page.locator('.so-phone-app-icon', { hasText: '立绘' }).tap()
  await expect(
    page
      .locator('.so-app-toggle', { hasText: '启用立绘悬浮窗' })
      .locator('input[type="checkbox"]'),
  ).toBeChecked({ checked: !before })
})

test('拖拽图标改变位置且不误触展开', async ({ page }) => {
  const fab = page.locator('.so-phone-fab')
  const start = (await fab.boundingBox())!

  await page.mouse.move(start.x + start.width / 2, start.y + start.height / 2)
  await page.mouse.down()
  await page.mouse.move(start.x + start.width / 2 + 120, start.y + start.height / 2 - 80, {
    steps: 8,
  })
  await page.mouse.up()

  const end = (await fab.boundingBox())!
  expect(Math.abs(end.x - start.x)).toBeGreaterThan(60)
  await expect(page.locator('.so-phone-shell')).toBeHidden()
})

test('横竖屏切换后手机壳重新钳位不出界', async ({ page }) => {
  await openPhone(page)
  const viewport = page.viewportSize()!
  // 模拟旋转为横屏（矮视口压高）
  await page.setViewportSize({ width: viewport.height, height: viewport.width })

  const shell = (await page.locator('.so-phone-shell').boundingBox())!
  expect(shell.x).toBeGreaterThanOrEqual(0)
  expect(shell.y).toBeGreaterThanOrEqual(0)
  expect(shell.x + shell.width).toBeLessThanOrEqual(viewport.height)
  expect(shell.y + shell.height).toBeLessThanOrEqual(viewport.width)
})

test('移动端聊天链路：发送消息收到模拟 AI 回复', async ({ page }) => {
  const input = page.getByLabel('聊天输入框')
  await input.tap()
  await input.fill('你好')
  await page.getByRole('button', { name: '发送' }).tap()

  // 自己的气泡立即出现；模拟 AI 500ms 后回复（有无绑定立绘包都会回一条）
  await expect(page.getByText('你好').first()).toBeVisible()
  await expect(page.locator('.bg-secondary.text-secondary-foreground').first()).toBeVisible({
    timeout: 5_000,
  })
})

test('真实图库在横竖屏中保持可操作，并支持角色折叠与搜索', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loadRealExtensionGallery(page)
  expect(await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))).toEqual({
    width: 390,
    height: 844,
  })
  await openRealGalleryManager(page)
  await expectInsideViewport(page, '.so-manager')

  const roleRow = page.locator('.so-role-pack-row', { hasText: '小雪' })
  await expect(roleRow).toContainText('2 个图包')
  await roleRow.tap()
  await expect(roleRow).toHaveAttribute('aria-expanded', 'true')
  await page.locator('.so-pack-card', { hasText: '小雪居家' }).tap()

  const search = page.getByRole('searchbox', { name: '搜索立绘' })
  await search.fill('挥手2')
  await expect(page.locator('.so-sprite-cell')).toHaveCount(1)
  await expect(page.locator('.so-sprite-tag')).toHaveText('挥手2')
  await page.locator('.so-gallery-label-select').selectOption('超长动作标签用于移动端布局验证')
  const chip = page.locator('.so-gallery-filter-chip')
  await expect(chip).toBeVisible()
  expect(await chip.evaluate((element) => element.scrollWidth <= element.clientWidth)).toBe(true)

  await page.locator('.so-sprite-cell img').tap()
  await expect(page.locator('.so-lightbox')).toBeVisible()
  await expectLightboxLayout(page)
  await page.locator('.so-lightbox-close').tap()

  await page.setViewportSize({ width: 844, height: 390 })
  expect(await page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }))).toEqual({
    width: 844,
    height: 390,
  })
  await expectInsideViewport(page, '.so-manager')
  await expect(search).toBeVisible()
  await page.locator('.so-sprite-cell img').tap()
  await expect(page.locator('.so-lightbox')).toBeVisible()
  await expectLightboxLayout(page)
})
