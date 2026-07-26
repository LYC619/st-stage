import { test, expect, type Page } from '@playwright/test'

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
