import { test, expect, type Page } from '@playwright/test'
import { resolve } from 'node:path'

const ROOT = resolve(__dirname, '..')

const RENDERER_LONG_TEXT = '这是一段用于验证移动端自动换行的超长叙述文本，其中包含连续场景信息、行动理由与结果说明，确保窄屏和横屏都不会把消息容器撑出视口。'

const RENDERER_FIXTURES = [
  {
    version: 1,
    mode: 'gal',
    title: '雨夜车站的漫长重逢',
    scene: '被暴雨笼罩的旧车站月台',
    beats: [
      { speaker: '小雪', text: RENDERER_LONG_TEXT },
      { speaker: '旅行者', text: '我会陪你走完这一段路。' },
    ],
  },
  {
    version: 1,
    mode: 'cards',
    title: '选择接下来的调查路线',
    cards: [
      { id: 'ridge', title: '沿山脊前进', description: RENDERER_LONG_TEXT, consequence: '可能遭遇巡逻守卫', action: '我选择沿山脊继续调查。' },
      { id: 'camp', title: '返回营地整备', description: '检查装备并重新分配补给。', action: '我选择返回营地整备。' },
    ],
  },
  {
    version: 1,
    mode: 'battle',
    title: '遗迹守卫战与超长战斗标题',
    player: {
      id: 'hero', name: '旅行者与同行伙伴', hp: 80, maxHp: 100, mp: 20, maxMp: 30,
      attack: 20, defense: 6, speed: 12, crit: 0, dodge: 0,
      skills: [{ id: 'slash', name: '蓄力斩击', type: 'damage', mpCost: 5, power: 24 }],
      items: [{ id: 'potion', name: '应急治疗药水', effect: 'heal_hp', quantity: 1, power: 20 }],
      statuses: [{ id: 'focus', name: '持续专注与战术观察', duration: 2, attackDelta: 2 }],
    },
    enemy: {
      id: 'guard', name: '古代遗迹自动防御守卫', hp: 90, maxHp: 90, mp: 0, maxMp: 0,
      attack: 14, defense: 8, speed: 8, crit: 0, dodge: 0,
    },
    enemyIntent: RENDERER_LONG_TEXT,
    allowFlee: true,
  },
] as const

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
      outfit: '居家',
      promptNote: '适用于日常剧情',
      promptNotePlacement: 'before-list',
      outfitNotes: { 居家: '适用于居家场景' },
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
          outfit: '外出',
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

/** 在最小 ST DOM 中加载真实扩展，并触发三种 Renderer 楼层。 */
async function loadRealExtensionRenderer(page: Page, showPhone = true): Promise<string[]> {
  await page.goto('about:blank')
  await page.setContent(
    '<meta name="viewport" content="width=device-width, initial-scale=1">'
      + '<main id="chat"></main>'
      + '<textarea id="send_textarea" aria-label="SillyTavern 输入框"></textarea>',
  )
  const originals = await page.evaluate((blocks) => {
    const chat = document.querySelector('#chat')!
    return blocks.map((block, index) => {
      const raw = `<STStageRender>${JSON.stringify(block)}</STStageRender>`
      const message = document.createElement('article')
      message.className = 'mes'
      message.setAttribute('mesid', String(index + 1))
      message.setAttribute('is_user', 'false')
      const body = document.createElement('div')
      body.className = 'mes_text'
      body.textContent = `叙事前文 ${raw} 叙事后文`
      message.append(body)
      chat.append(message)
      return body.textContent
    })
  }, RENDERER_FIXTURES)
  await page.evaluate((phoneVisible) => {
    const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
    const context = {
      extensionSettings: {
        sprite_overlay: {
          settingsVersion: 4,
          enabled: false,
          overlayHidden: true,
          showPhone: phoneVisible,
          apps: {
            renderer: {
              enabled: true,
              galEnabled: true,
              cardsEnabled: true,
              battleEnabled: true,
              injectionDepth: 4,
              typewriter: false,
              reducedMotion: true,
            },
          },
        },
      },
      saveSettingsDebounced: () => {},
      setExtensionPrompt: () => {},
      eventTypes: {
        MESSAGE_RECEIVED: 'message_received',
        CHAT_CHANGED: 'chat_changed',
        CHARACTER_MESSAGE_RENDERED: 'character_message_rendered',
        USER_MESSAGE_RENDERED: 'user_message_rendered',
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
      chatId: 'renderer-mobile',
      chatMetadata: { name: 'Renderer 移动验证' },
      groups: [],
      chat: [],
    }
    const target = window as Window & {
      SillyTavern: unknown
      __emitRendererEvent?: (event: string, messageId: number) => void
    }
    target.SillyTavern = { getContext: () => context }
    target.__emitRendererEvent = (event, messageId) => {
      for (const handler of handlers.get(event) ?? []) handler(messageId)
    }
  }, showPhone)
  await page.addStyleTag({ path: resolve(ROOT, 'st-extension/style.css') })
  await page.addStyleTag({ path: resolve(ROOT, 'core/phone-shell.css') })
  await page.addScriptTag({ path: resolve(ROOT, 'bundle.js'), type: 'module' })
  await expect(page.locator('.so-phone-fab')).toHaveCount(1)
  await expect(page.locator('.so-phone-fab')).toBeVisible({ visible: showPhone })
  await page.evaluate(() => {
    const emit = (window as Window & { __emitRendererEvent?: (event: string, messageId: number) => void }).__emitRendererEvent
    for (const id of [1, 2, 3]) emit?.('character_message_rendered', id)
  })
  await expect(page.locator('.st-stage-renderer')).toHaveCount(3)
  return originals
}

/** 检查 Renderer 和所有可操作控件均在自身容器内，且长文本不横向溢出。 */
async function expectRendererLayout(page: Page): Promise<void> {
  const result = await page.evaluate(() => {
    const epsilon = 0.75
    const roots = Array.from(document.querySelectorAll<HTMLElement>('.st-stage-renderer'))
    const inside = (inner: DOMRect, outer: DOMRect) => (
      inner.left >= outer.left - epsilon
      && inner.top >= outer.top - epsilon
      && inner.right <= outer.right + epsilon
      && inner.bottom <= outer.bottom + epsilon
    )
    const doNotOverlap = (rects: DOMRect[]) => rects.every((a, index) => rects.slice(index + 1).every((b) => (
      Math.min(a.right, b.right) - Math.max(a.left, b.left) <= epsilon
      || Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top) <= epsilon
    )))
    const controlsInside = roots.every((root) => {
      const outer = root.getBoundingClientRect()
      return Array.from(root.querySelectorAll<HTMLElement>('button, select, input')).every((control) => {
        const rect = control.getBoundingClientRect()
        return rect.width > 0 && rect.height > 0 && inside(rect, outer)
      })
    })
    const controlsDoNotOverlap = roots.every((root) => {
      const controls = Array.from(root.querySelectorAll<HTMLElement>('button, select, input'))
        .map((control) => control.getBoundingClientRect())
      return doNotOverlap(controls)
    })
    const panelsDoNotOverlap = [
      ['.st-render-gal-header', '.st-render-gal-dialogue-box'],
      ['.st-render-card'],
      ['.st-render-battle-header', '.st-render-battle-combatants', '.st-render-battle-log', '.st-render-battle-actions', '.st-render-battle-notice'],
    ].every((selectors) => {
      const rects = selectors.flatMap((selector) => Array.from(document.querySelectorAll<HTMLElement>(selector)))
        .map((element) => element.getBoundingClientRect())
        .filter((rect) => rect.width > 0 && rect.height > 0)
      return doNotOverlap(rects)
    })
    const textWraps = Array.from(document.querySelectorAll<HTMLElement>(
      '.st-render-gal-dialogue, .st-render-card-description, .st-render-card-consequence, .st-render-battle-intent, .st-render-combatant-name, .st-render-status-chip',
    )).every((element) => element.scrollWidth <= element.clientWidth + 1)
    return {
      documentFits: document.documentElement.scrollWidth <= document.documentElement.clientWidth,
      rootsFit: roots.every((root) => {
        const rect = root.getBoundingClientRect()
        return rect.left >= -epsilon && rect.right <= document.documentElement.clientWidth + epsilon
      }),
      controlsInside,
      controlsDoNotOverlap,
      panelsDoNotOverlap,
      textWraps,
    }
  })
  expect(result).toEqual({
    documentFits: true,
    rootsFit: true,
    controlsInside: true,
    controlsDoNotOverlap: true,
    panelsDoNotOverlap: true,
    textWraps: true,
  })
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

test('真实图库在横竖屏中保持可操作，并支持角色折叠与搜索', async ({ page }, testInfo) => {
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

  const packInfo = page.locator('details.so-collapse', { hasText: '包信息' })
  await packInfo.locator('summary').tap()
  const promptNote = packInfo.locator('.so-pack-prompt-note')
  await expect(promptNote).toHaveValue('适用于日常剧情')
  await expect(packInfo.locator('.so-pack-prompt-placement')).toHaveValue('before-list')
  await expect(packInfo.locator('.so-outfit-note-input')).toHaveCount(2)
  await expect(packInfo.locator('.so-outfit-note-input[data-outfit="居家"]'))
    .toHaveValue('适用于居家场景')
  await packInfo.locator('.so-outfit-note-input[data-outfit="外出"]').fill('适用于外出场景')
  await promptNote.fill('适用于夜晚剧情')
  await packInfo.locator('.so-pack-prompt-placement').selectOption('after-list')
  await page.screenshot({ path: testInfo.outputPath('gallery-notes-mobile.png'), fullPage: true })
  await packInfo.getByRole('button', { name: '保存', exact: true }).tap()
  await page.locator('details.so-collapse', { hasText: '包信息' }).locator('summary').tap()
  await expect(page.locator('.so-pack-prompt-note')).toHaveValue('适用于夜晚剧情')
  await expect(page.locator('.so-pack-prompt-placement')).toHaveValue('after-list')
  await expect(page.locator('.so-outfit-note-input[data-outfit="外出"]'))
    .toHaveValue('适用于外出场景')

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

test('真实 Renderer 三种模式在横竖屏中无溢出重叠且控件可操作', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await loadRealExtensionRenderer(page, false)

  await expectRendererLayout(page)
  await page.locator('.st-render-gal-control').last().tap()
  await expect(page.locator('.st-render-gal-progress')).toHaveText('2 / 2')
  await page.locator('.st-render-card-select').first().tap()
  await expect(page.locator('#send_textarea')).toHaveValue('我选择沿山脊继续调查。')
  await page.locator('.st-render-battle-action[data-action="attack"]').tap()
  await expect(page.locator('.st-render-battle-turn')).toHaveText('回合 2')
  const portrait = await page.screenshot({ fullPage: true })
  expect(portrait.byteLength).toBeGreaterThan(10_000)
  await testInfo.attach('renderer-portrait', { body: portrait, contentType: 'image/png' })

  await page.setViewportSize({ width: 844, height: 390 })
  await expectRendererLayout(page)
  const landscape = await page.screenshot({ fullPage: true })
  expect(landscape.byteLength).toBeGreaterThan(10_000)
  await testInfo.attach('renderer-landscape', { body: landscape, contentType: 'image/png' })
})

test('手机设置关闭 Renderer 后逐楼层恢复原始结构化文本', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const originals = await loadRealExtensionRenderer(page)

  await page.locator('.so-phone-fab').tap()
  await page.locator('.so-phone-app-icon', { hasText: '渲染' }).tap()
  const enabled = page.locator('.so-app-toggle', { hasText: '启用渲染' }).locator('input[type="checkbox"]')
  await expect(enabled).toBeChecked()
  await enabled.tap()

  await expect(page.locator('.st-stage-renderer')).toHaveCount(0)
  const messages = page.locator('#chat .mes_text')
  for (let index = 0; index < originals.length; index += 1) {
    await expect(messages.nth(index)).toHaveText(originals[index])
  }
})
