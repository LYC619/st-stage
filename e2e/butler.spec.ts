import { expect, test, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

const EXTENSIONS_MODULE = String.raw`
const context = window.SillyTavern.getContext();
export const extensionNames = ['vectors', 'memory', 'regex', 'third-party/example', 'third-party/st-stage'];
export const extensionTypes = {
  vectors: 'system', memory: 'system', regex: 'system',
  'third-party/example': 'local', 'third-party/st-stage': 'local',
};
export const extension_settings = context.extensionSettings;
export function findExtension(name) {
  if (!extensionNames.includes(name)) return null;
  return { name, enabled: !extension_settings.disabledExtensions.includes(name) };
}
export function getExtensionManifest(name) {
  return {
    display_name: name === 'vectors' ? 'Vector Storage' : name,
    version: '1.0.0', dependencies: [], requires: [],
  };
}
export async function enableExtension(name) {
  extension_settings.disabledExtensions = extension_settings.disabledExtensions.filter((item) => item !== name);
}
export async function disableExtension(name) {
  if (!extension_settings.disabledExtensions.includes(name)) extension_settings.disabledExtensions.push(name);
}
`

async function loadButler(page: Page): Promise<void> {
  await page.route('http://localhost:3101/', (route) => route.fulfill({
    status: 200,
    contentType: 'text/html; charset=utf-8',
    body: '<!doctype html><html><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>'
      + '<body><span id="version_display">SillyTavern 1.18.0</span>'
      + '<main id="chat"><article class="mes"><div class="mes_text">测试消息</div></article></main></body></html>',
  }))
  await page.route('**/scripts/extensions.js', (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: EXTENSIONS_MODULE,
  }))
  await page.route('**/scripts/power-user.js', (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: 'export function applyPowerUserSettings() {}',
  }))
  await page.route('**/script.js', (route) => route.fulfill({
    status: 200,
    contentType: 'text/javascript; charset=utf-8',
    body: 'export const isGenerating = () => false; export async function saveSettings() {}',
  }))
  await page.goto('/')
  await page.evaluate(() => {
    const extensionSettings = {
      disabledExtensions: ['memory'],
      quickReply: { config: { setList: [{ name: '常用' }, { name: '工具' }] } },
      sprite_overlay: {
        settingsVersion: 4,
        showPhone: true,
        phone: { x: 24, y: 24, open: false },
        packs: [],
      },
    }
    const context = {
      extensionSettings,
      powerUserSettings: {
        fast_ui_mode: false,
        reduced_motion: false,
        noShadows: false,
        smooth_streaming: true,
        stream_fade_in: true,
        streaming_fps: 30,
        chat_truncation: 100,
      },
      saveSettingsDebounced: () => {},
      setExtensionPrompt: () => {},
      reloadCurrentChat: () => {},
      isMobile: () => window.innerWidth <= 600,
      eventTypes: {
        MESSAGE_RECEIVED: 'message_received',
        CHAT_CHANGED: 'chat_changed',
        CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
        USER_MESSAGE_RENDERED: 'user_message_rendered',
      },
      eventSource: { on: () => {}, removeListener: () => {} },
      characters: [{ name: '小雪' }],
      characterId: 0,
      name2: '小雪',
      chatId: 'butler-layout',
      chat: [
        { mes: '你好', is_user: true },
        { mes: '你好，有什么需要？', is_user: false },
      ],
      groups: [],
    }
    ;(window as Window & { SillyTavern: unknown }).SillyTavern = { getContext: () => context }
  })
  await page.addStyleTag({ path: resolve(ROOT, 'st-extension/style.css') })
  await page.addStyleTag({ path: resolve(ROOT, 'core/phone-shell.css') })
  await page.addScriptTag({ path: resolve(ROOT, 'bundle.js'), type: 'module' })
  await expect(page.locator('.so-phone-fab')).toBeVisible()
  await page.locator('.so-phone-fab').click()
  await page.locator('.so-phone-app-icon', { hasText: '管家' }).click()
  await expect(page.locator('.so-butler-app')).toContainText('环境体检')
  await expect(page.locator('.so-butler-app')).toContainText('基础检查完成')
}

async function expectNoOverflowOrOverlap(page: Page, rootSelector: string): Promise<void> {
  const result = await page.locator(rootSelector).evaluate((root) => {
    const epsilon = 1
    const visibleBox = (node: HTMLElement) => {
      const box = node.getBoundingClientRect()
      let left = box.left
      let right = box.right
      let top = box.top
      let bottom = box.bottom
      for (let ancestor = node.parentElement; ancestor; ancestor = ancestor.parentElement) {
        const style = getComputedStyle(ancestor)
        const clip = ancestor.getBoundingClientRect()
        if (/(auto|scroll|hidden|clip)/.test(style.overflowX)) {
          left = Math.max(left, clip.left)
          right = Math.min(right, clip.right)
        }
        if (/(auto|scroll|hidden|clip)/.test(style.overflowY)) {
          top = Math.max(top, clip.top)
          bottom = Math.min(bottom, clip.bottom)
        }
        if (ancestor === root) break
      }
      return { left, right, top, bottom, width: Math.max(0, right - left), height: Math.max(0, bottom - top) }
    }
    const controls = [...root.querySelectorAll<HTMLElement>('[role="button"], button, input, select')]
      .filter((node) => {
        const style = getComputedStyle(node)
        const box = visibleBox(node)
        return style.visibility !== 'hidden' && style.display !== 'none' && box.width > 0 && box.height > 0
      })
      .map((node) => ({
        label: node.getAttribute('aria-label') || node.textContent?.trim().slice(0, 60) || node.tagName,
        box: visibleBox(node),
      }))
    const overlapPairs = controls.flatMap((left, index) => controls.slice(index + 1).flatMap((right) => {
      const width = Math.min(left.box.right, right.box.right) - Math.max(left.box.left, right.box.left)
      const height = Math.min(left.box.bottom, right.box.bottom) - Math.max(left.box.top, right.box.top)
      return width > epsilon && height > epsilon ? [`${left.label} <> ${right.label}`] : []
    }))
    return {
      fits: root.scrollWidth <= root.clientWidth + epsilon,
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth + epsilon,
      overlapPairs,
    }
  })
  expect(result).toEqual({ fits: true, documentFits: true, overlapPairs: [] })
}

test('管家主屏和三个全屏弹窗在桌面与移动视口均可读可操作', async ({ page }, testInfo) => {
  await loadButler(page)

  await expectNoOverflowOrOverlap(page, '.so-phone-shell')
  const shellShot = await page.screenshot({ path: testInfo.outputPath('butler-main.png') })
  expect(shellShot.byteLength).toBeGreaterThan(8_000)

  const modals = [
    ['查看详细结果', '详细检查结果'],
    ['临时关闭扩展找卡顿', '第三方扩展'],
    ['记忆与服务器设置建议', 'Vector Storage：当前启用'],
  ] as const
  for (const [button, expected] of modals) {
    await page.getByRole('button', { name: button, exact: true }).click()
    const modal = page.locator('.so-app-modal')
    await expect(modal).toBeVisible()
    await expect(modal).toContainText(expected)
    await expectNoOverflowOrOverlap(page, '.so-app-modal')
    await page.locator('.so-app-modal-close').click()
    await expect(modal).toBeHidden()
    await expect(page.locator('.so-butler-app')).toBeVisible()
  }

  await expect(page.getByRole('button', { name: /立即应用 \d+ 项建议/, exact: true })).toBeVisible()
  await page.getByRole('button', { name: '开始 6 秒体检', exact: true }).click()
  await expect(page.getByRole('button', { name: '取消本次检查', exact: true })).toBeVisible()
  await page.getByRole('button', { name: '取消本次检查', exact: true }).click()
  await expect(page.getByRole('button', { name: '开始 6 秒体检', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /立即应用 \d+ 项建议/, exact: true }).click()
  await expect(page.getByRole('button', { name: '恢复本次性能设置', exact: true })).toBeVisible({ timeout: 12_000 })
  await expect(page.locator('.so-butler-app')).toContainText('已应用 7 项')
  const optimized = await page.evaluate(() => {
    const st = (window as unknown as {
      SillyTavern: { getContext(): { powerUserSettings: Record<string, unknown> } }
    }).SillyTavern
    return st.getContext().powerUserSettings
  })
  expect(optimized).toMatchObject({
    fast_ui_mode: true,
    reduced_motion: true,
    noShadows: true,
    streaming_fps: 15,
  })
  await expectNoOverflowOrOverlap(page, '.so-phone-shell')

  await page.getByRole('button', { name: '恢复本次性能设置', exact: true }).click()
  await expect(page.locator('.so-butler-app')).toContainText('已恢复到优化前设置')
  const restored = await page.evaluate(() => {
    const st = (window as unknown as {
      SillyTavern: { getContext(): { powerUserSettings: Record<string, unknown> } }
    }).SillyTavern
    return st.getContext().powerUserSettings
  })
  expect(restored).toMatchObject({
    fast_ui_mode: false,
    reduced_motion: false,
    noShadows: false,
    streaming_fps: 30,
  })
  await expectNoOverflowOrOverlap(page, '.so-phone-shell')
})
