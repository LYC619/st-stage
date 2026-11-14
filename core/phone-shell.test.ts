// @vitest-environment jsdom
/**
 * 手机壳交互与 App 生命周期测试（五期·阶段2）：
 * - 关闭按钮只收起手机壳（恢复图标），不销毁
 * - 圆形 Home 键只返回主屏
 * - 离开 App / 收起 / 隐藏时都调用 unmount，不残留定时器与监听
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPhoneShell, type PhoneAppearance } from './phone-shell'
import { PhoneAppRegistry, createPhoneAppContext, type PhoneApp } from './phone-registry'
import { createDefaultSettings, type PhoneState } from './types'

function makeApp(id: string, hooks: { mount?: () => void; unmount?: () => void } = {}): PhoneApp {
  return {
    id,
    name: id,
    icon: '🔧',
    mount(container) {
      container.textContent = id
      hooks.mount?.()
    },
    unmount: hooks.unmount,
  }
}

function setup(apps: PhoneApp[], initial: Partial<PhoneState> = {}) {
  const registry = new PhoneAppRegistry()
  for (const app of apps) registry.register(app)
  const settings = createDefaultSettings()
  // 假平台事件源：登记 ctx 订阅，供「离开 App 自动退订」断言
  const subs = new Set<(t: string) => void>()
  const state: PhoneState = { x: 20, y: 20, open: false, ...initial }
  const shell = createPhoneShell(state, {
    registry,
    createAppContext: (appId, goHome) =>
      createPhoneAppContext({
        appId,
        getSettings: () => settings,
        updateSettings: () => {},
        saveSettingsOnly: () => {},
        getCharacterName: () => '',
        goHome,
        openModal: () => {},
        onMessageReceived: (h) => {
          subs.add(h)
          return () => subs.delete(h)
        },
        onCharacterChanged: () => () => {},
        injectPrompt: () => {},
        toast: () => {},
      }),
    onStateChange: () => {},
  })
  return { shell, registry, subCount: () => subs.size }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('phone appearance', () => {
  const look: PhoneAppearance = { wallpaper: 'https://example.test/wall"paper.png', icons: { alpha: { emoji: '🍵' } },
    fonts: [{ name: 'hand', family: 'Handwriting', cssUrl: 'https://example.test/font.css' }], activeFont: 'hand' }
  it('applies the home wallpaper and emoji, keeps an open App mounted, and restores defaults', () => {
    const mount = vi.fn(), { shell } = setup([makeApp('alpha', { mount })], { open: true })
    shell.setAppearance(look)
    const screen = document.querySelector<HTMLElement>('.so-phone-screen')!
    expect(screen.style.getPropertyValue('--so-wallpaper')).toBe(`url(${JSON.stringify(look.wallpaper)})`)
    expect(screen.classList.contains('so-phone-screen-wallpaper')).toBe(true)
    expect(document.querySelector('.so-phone-app-glyph')!.textContent).toBe('🍵')
    shell.openApp('alpha'); expect(screen.classList.contains('so-phone-screen-wallpaper')).toBe(false)
    shell.setAppearance({ ...look, wallpaper: '/user/images/next.webp' }); expect(mount).toHaveBeenCalledOnce()
    document.querySelector<HTMLElement>('.so-phone-homebtn')!.click(); expect(screen.classList.contains('so-phone-screen-wallpaper')).toBe(true)
    shell.setAppearance({ wallpaper: '', icons: {}, fonts: [], activeFont: '' })
    expect(screen.style.getPropertyValue('--so-wallpaper')).toBe(''); expect(screen.classList.contains('so-phone-screen-wallpaper')).toBe(false)
    expect(document.querySelector('.so-phone-app-glyph')!.textContent).toBe('🔧'); shell.destroy()
  })
  it('shows image icons with app labels and falls back to the original emoji on error', () => {
    const { shell, registry } = setup([makeApp('alpha')], { open: true })
    shell.setAppearance({ ...look, icons: { alpha: { image: '/user/images/icon.webp', emoji: '🍵' }, beta: { emoji: '🎈' } } })
    const image = document.querySelector<HTMLImageElement>('.so-phone-app-glyph img')!
    expect(image.alt).toBe('alpha'); image.dispatchEvent(new Event('error'))
    expect(document.querySelector('.so-phone-app-glyph')!.textContent).toBe('🔧')
    registry.register(makeApp('beta')); expect(document.querySelector('[data-app-id=beta] .so-phone-app-glyph')!.textContent).toBe('🎈')
    shell.destroy()
  })
  it('maintains one font link, scopes the font to the shell and removes it on default or disposal', () => {
    const { shell } = setup([makeApp('alpha')], { open: true })
    shell.setAppearance(look)
    const link = document.querySelector<HTMLLinkElement>('link[data-so-font]')!
    expect(link.href).toBe(look.fonts[0].cssUrl); expect(document.querySelector<HTMLElement>('.so-phone-shell')!.style.fontFamily).toBe('Handwriting')
    expect(document.body.style.fontFamily).toBe('')
    shell.setAppearance({ ...look, fonts: [{ ...look.fonts[0], cssUrl: 'https://example.test/new.css' }] })
    expect(document.querySelectorAll('link[data-so-font]')).toHaveLength(1); expect(link.href).toBe('https://example.test/new.css')
    shell.setAppearance({ ...look, activeFont: '' }); expect(document.querySelector('link[data-so-font]')).toBeNull()
    expect(document.querySelector<HTMLElement>('.so-phone-shell')!.style.fontFamily).toBe('')
    shell.setAppearance(look); shell.destroy(); expect(document.querySelector('link[data-so-font]')).toBeNull()
  })
})

describe('role overview navigation', () => {
  it('ignores a stale asynchronous role read and leaves an open App mounted', async () => {
    const registry = new PhoneAppRegistry(), mount = vi.fn()
    registry.register(makeApp('gallery', { mount }))
    const settings = createDefaultSettings()
    let name = 'Alice'
    const pending: Array<(summary: { title: string; subtitle: string; rows: Array<{ id: string; appId: string; label: string; value: string }> }) => void> = []
    const summary = (title: string) => ({ title, subtitle: 'Chat', rows: [{ id: 'gallery', appId: 'gallery', label: 'Packs', value: title }] })
    const shell = createPhoneShell({ x: 0, y: 0, open: false }, {
      registry,
      getHomeSummary: () => summary(name),
      readHomeSummary: () => new Promise(resolve => pending.push(resolve)),
      onStateChange: () => {},
      createAppContext: (appId, goHome) => createPhoneAppContext({
        appId, goHome, getSettings: () => settings, updateSettings: () => {}, saveSettingsOnly: () => {},
        getCharacterName: () => name, onMessageReceived: () => () => {}, onCharacterChanged: () => () => {},
        injectPrompt: () => {}, toast: () => {}, openModal: () => {},
      }),
    })
    shell.setState({ x: 0, y: 0, open: true })
    name = 'Bob'; shell.refreshHome()
    pending[1](summary('Bob current')); await Promise.resolve()
    pending[0](summary('Alice stale')); await Promise.resolve()
    expect(document.querySelector('.so-phone-role-title')?.textContent).toBe('Bob current')
    const details = document.querySelector<HTMLDetailsElement>('.so-phone-role')!
    expect(details.previousElementSibling?.className).toBe('so-phone-home-grid')
    expect(details.open).toBe(false)
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    expect(localStorage.getItem('baigong:phone:role-expanded')).toBe('true')
    const action = document.querySelector<HTMLButtonElement>('[data-role-action="gallery"]')!
    action.focus(); shell.refreshHome()
    expect((document.activeElement as HTMLElement).dataset.roleAction).toBe('gallery')
    document.querySelector<HTMLButtonElement>('[data-role-action="gallery"]')!.click()
    expect(mount).toHaveBeenCalledTimes(1)
    shell.refreshHome()
    pending[2](summary('Late Bob')); await Promise.resolve()
    expect(mount).toHaveBeenCalledTimes(1)
    expect(document.querySelector('.so-phone-role')).toBeNull()
    document.querySelector<HTMLButtonElement>('.so-phone-homebtn')!.click()
    expect(document.querySelector<HTMLDetailsElement>('.so-phone-role')!.open).toBe(true)
    localStorage.removeItem('baigong:phone:role-expanded')
    shell.destroy()
  })
})

describe('手机壳交互', () => {
  it('keeps fullbleed Apps keyboard accessible and clears their layout when leaving', () => {
    const app = { ...makeApp('wechat'), fullbleed: true }
    const { shell } = setup([app, makeApp('gallery')])
    shell.openApp('wechat')
    const screen = document.querySelector('.so-phone-screen')!
    const container = document.querySelector('.so-phone-app-container') as HTMLElement
    expect(screen.classList.contains('so-phone-screen-fullbleed')).toBe(true)
    expect(container.classList.contains('so-phone-app-fullbleed')).toBe(true)
    expect(container.getAttribute('role')).toBe('group')
    expect(container.getAttribute('aria-label')).toBe('wechat')
    expect(document.activeElement).toBe(container)
    container.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(screen.classList.contains('so-phone-screen-fullbleed')).toBe(false)
    expect(document.activeElement).toBe(document.querySelector('[data-app-id="wechat"]'))
    shell.openApp('gallery')
    expect(screen.classList.contains('so-phone-screen-fullbleed')).toBe(false)
    expect(document.querySelector('.so-phone-app-fullbleed')).toBeNull()
    shell.destroy()
  })

  it('lets an App step back through its own pages before the status-bar back and Escape return home', () => {
    let depth = 2
    const unmount = vi.fn()
    const app: PhoneApp = { ...makeApp('chat', { unmount }), fullbleed: true, back: () => depth > 0 && depth-- > 0 }
    const { shell } = setup([app])
    shell.openApp('chat')
    const back = document.querySelector<HTMLElement>('.so-phone-back')!
    expect(back.getAttribute('aria-label')).toBe('返回')
    back.click()
    expect(depth).toBe(1); expect(unmount).not.toHaveBeenCalled()
    document.querySelector('.so-phone-app-container')!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(depth).toBe(0); expect(unmount).not.toHaveBeenCalled()
    back.click()
    expect(unmount).toHaveBeenCalledOnce()
    expect(document.activeElement).toBe(document.querySelector('[data-app-id="chat"]'))
    shell.openApp('chat'); depth = 3
    document.querySelector<HTMLElement>('.so-phone-homebtn')!.click()
    expect(depth).toBe(3); expect(unmount).toHaveBeenCalledTimes(2)
    shell.destroy()
  })

  it('falls back to the home screen when an App back handler throws', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { shell } = setup([{ ...makeApp('broken'), back: () => { throw new Error('boom') } }])
    shell.openApp('broken')
    document.querySelector<HTMLElement>('.so-phone-back')!.click()
    expect(document.querySelector('[data-app-id="broken"]')).not.toBeNull()
    expect(error).toHaveBeenCalled()
    error.mockRestore(); shell.destroy()
  })

  it('opens from the keyboard, returns to the App icon and collapses back to the launcher', () => {
    const { shell } = setup([makeApp('gallery')])
    const fab = document.querySelector('.so-phone-fab') as HTMLElement
    expect(fab.tabIndex).toBe(0)
    fab.focus()
    fab.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    const icon = document.querySelector('.so-phone-app-icon') as HTMLElement
    expect(document.activeElement).toBe(icon)
    icon.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    expect(document.activeElement).toBe(document.querySelector('.so-phone-app-container'))
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.activeElement).toBe(document.querySelector('.so-phone-app-icon'))
    document.activeElement!.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(document.activeElement).toBe(fab)
    shell.destroy()
  })

  it('keeps native input behavior without forwarding Enter to the host', () => {
    const host = vi.fn()
    document.body.addEventListener('keydown', host)
    const { shell } = setup([{ id: 'aa', name: 'A', icon: 'A', mount: container => { container.innerHTML = '<input>' } }])
    shell.openApp('aa')
    const input = document.querySelector('.so-phone-app-container input')!
    const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
    input.dispatchEvent(event)
    expect(event.defaultPrevented).toBe(false)
    expect(host).not.toHaveBeenCalled()
    document.body.removeEventListener('keydown', host)
    shell.destroy()
  })

  it('keeps focus and text selection on a settings-driven remount of the same App', () => {
    const { shell } = setup([{ id: 'aa', name: 'A', icon: 'A', mount: container => { container.innerHTML = '<label>Name<input value="sample"></label>' } }])
    shell.openApp('aa')
    const input = document.querySelector('.so-phone-app-container input') as HTMLInputElement
    input.focus()
    input.setSelectionRange(2, 4)
    shell.setState({ x: 20, y: 20, open: true })
    const replacement = document.querySelector('.so-phone-app-container input') as HTMLInputElement
    expect(replacement).not.toBe(input)
    expect(document.activeElement).toBe(replacement)
    expect([replacement.selectionStart, replacement.selectionEnd]).toEqual([2, 4])
    shell.destroy()
  })

  it('does not transfer focus and selection to a new field inserted at the same DOM position', () => {
    let extra = false
    const { shell } = setup([{ id: 'dynamic', name: 'Dynamic', icon: 'D', mount(container) {
      container.innerHTML = (extra ? '<label for="new">New optional field</label><input id="new" value="different">' : '')
        + '<label for="original">Original name</label><input id="original" value="sample">'
    } }])
    shell.openApp('dynamic')
    const input = document.querySelector('#original') as HTMLInputElement
    input.focus()
    input.setSelectionRange(1, 4)
    extra = true
    shell.setState({ x: 20, y: 20, open: true })
    expect(document.activeElement).toBe(document.querySelector('.so-phone-app-container'))
    const replacement = document.querySelector('#new') as HTMLInputElement
    expect(replacement.selectionStart).not.toBe(1)
    shell.destroy()
  })

  it('matches aria-labelledby text across regenerated IDs and rejects a changed label', () => {
    let revision = 0
    let label = 'Original name'
    const { shell } = setup([{ id: 'dynamic', name: 'Dynamic', icon: 'D', mount(container) {
      const labelId = `label-${++revision}`
      container.innerHTML = `<span id="${labelId}">${label}</span><input aria-labelledby="${labelId}" value="sample">`
    } }])
    shell.openApp('dynamic')
    ;(document.querySelector('.so-phone-app-container input') as HTMLElement).focus()
    shell.setState({ x: 20, y: 20, open: true })
    expect(document.activeElement).toBe(document.querySelector('.so-phone-app-container input'))
    label = 'Different field'
    shell.setState({ x: 20, y: 20, open: true })
    expect(document.activeElement).toBe(document.querySelector('.so-phone-app-container'))
    shell.destroy()
  })

  it('手机内交互不会冒泡到后方聊天控件', () => {
    const app: PhoneApp = {
      id: 'settings',
      name: '设置',
      icon: 'S',
      mount(container) {
        const input = document.createElement('input')
        input.type = 'checkbox'
        container.append(input)
      },
    }
    const outsidePointer = vi.fn()
    const outsideTouch = vi.fn()
    const outsideClick = vi.fn()
    document.body.addEventListener('pointerdown', outsidePointer)
    document.body.addEventListener('touchstart', outsideTouch)
    document.body.addEventListener('click', outsideClick)
    const { shell } = setup([app], { open: true })
    shell.openApp('settings')
    const input = document.querySelector<HTMLInputElement>('input[type="checkbox"]')!

    input.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    input.dispatchEvent(new Event('touchstart', { bubbles: true }))
    input.click()

    expect(outsidePointer).not.toHaveBeenCalled()
    expect(outsideTouch).not.toHaveBeenCalled()
    expect(outsideClick).not.toHaveBeenCalled()
    expect(input.checked).toBe(true)
    shell.destroy()
  })

  it('关闭按钮收起手机壳并恢复图标，不销毁 DOM', () => {
    const { shell } = setup([makeApp('gallery')], { open: true })
    const fab = document.querySelector('.so-phone-fab') as HTMLElement
    const shellEl = document.querySelector('.so-phone-shell') as HTMLElement
    const closeBtn = document.querySelector('.so-phone-close') as HTMLElement
    expect(shellEl.style.display).toBe('flex')

    closeBtn.click()
    expect(shellEl.style.display).toBe('none')
    expect(fab.style.display).toBe('flex')
    // 未销毁：再次展开仍可用
    shell.setState({ x: 20, y: 20, open: true })
    expect(shellEl.style.display).toBe('flex')
    shell.destroy()
  })

  it('圆形 Home 键从 App 返回主屏（Home 屏栅格重现）', () => {
    const { shell } = setup([makeApp('gallery'), makeApp('sprites')], { open: true })
    shell.openApp('gallery')
    expect(document.querySelector('.so-phone-app-container')?.textContent).toBe('gallery')

    const homeBtn = document.querySelector('.so-phone-homebtn') as HTMLElement
    homeBtn.click()
    expect(document.querySelector('.so-phone-app-container')).toBeNull()
    expect(document.querySelector('.so-phone-home-grid')).not.toBeNull()
    shell.destroy()
  })

  // 状态栏是用户可见文案：Home 屏必须是产品名，不能漏出仓库名/安装目录名
  it('状态栏标题用产品名，不出现仓库名 st-stage', () => {
    const { shell } = setup([makeApp('gallery')], { open: true })
    const title = () => document.querySelector('.so-phone-status-title')?.textContent

    expect(title()).toBe('百工')

    shell.openApp('gallery')
    expect(title()).toBe('gallery')

    ;(document.querySelector('.so-phone-homebtn') as HTMLElement).click()
    expect(title()).toBe('百工')

    expect(document.querySelector('.so-phone-status')?.textContent).not.toContain('st-stage')
    shell.destroy()
  })
})

describe('App 生命周期', () => {
  it('destroy 后忽略迟到的 openApp，不重新挂载 App', () => {
    const mount = vi.fn()
    const app = makeApp('gallery')
    app.mount = mount
    const { shell } = setup([app], { open: true })

    shell.destroy()
    shell.openApp('gallery')

    expect(mount).not.toHaveBeenCalled()
    expect(document.querySelector('.so-phone-app-container')).toBeNull()
  })

  it('返回主屏时调用 unmount', () => {
    const unmount = vi.fn()
    const { shell } = setup([makeApp('gallery', { unmount })], { open: true })
    shell.openApp('gallery')
    const homeBtn = document.querySelector('.so-phone-homebtn') as HTMLElement
    homeBtn.click()
    expect(unmount).toHaveBeenCalledTimes(1)
    shell.destroy()
  })

  it('关闭手机（✕）时卸载当前 App', () => {
    const unmount = vi.fn()
    const { shell } = setup([makeApp('gallery', { unmount })], { open: true })
    shell.openApp('gallery')
    const closeBtn = document.querySelector('.so-phone-close') as HTMLElement
    closeBtn.click()
    expect(unmount).toHaveBeenCalledTimes(1)
    shell.destroy()
  })

  it('setVisible(false) 隐藏整机时卸载当前 App', () => {
    const unmount = vi.fn()
    const { shell } = setup([makeApp('gallery', { unmount })], { open: true })
    shell.openApp('gallery')
    shell.setVisible(false)
    expect(unmount).toHaveBeenCalledTimes(1)
    shell.destroy()
  })

  it('does not remount an open App when an unrelated settings sync repeats the same visibility', () => {
    const mount = vi.fn(), unmount = vi.fn()
    const { shell } = setup([makeApp('chat', { mount, unmount }), makeApp('other')], { open: true })
    shell.openApp('chat')
    shell.setVisible(true); shell.setVisible(true)
    expect(mount).toHaveBeenCalledOnce(); expect(unmount).not.toHaveBeenCalled()
    shell.refreshApp('other')
    expect(mount).toHaveBeenCalledOnce()
    shell.destroy()
  })

  it('fully unmounts the previous instance before an App-requested refresh remounts it', () => {
    const unmount = vi.fn()
    const app: PhoneApp = { id: 'sub-app', name: 'S', icon: 'S', mount(_container, ctx) { ctx.onMessageReceived(() => {}) }, unmount }
    const { shell, subCount } = setup([app], { open: true })
    shell.openApp('sub-app')
    shell.refreshApp('sub-app'); shell.setState({ x: 20, y: 20, open: true })
    expect(unmount).toHaveBeenCalledTimes(2)
    expect(subCount()).toBe(1)
    shell.destroy()
    expect(subCount()).toBe(0)
  })

  it('skips host summary reads while the phone is collapsed and refreshes on the next open', () => {
    const registry = new PhoneAppRegistry(), read = vi.fn(async () => ({ title: 'T', subtitle: '', rows: [] }))
    const shell = createPhoneShell({ x: 0, y: 0, open: true }, {
      registry, onStateChange: () => {}, readHomeSummary: read,
      getHomeSummary: () => ({ title: 'T', subtitle: '', rows: [] }),
      createAppContext: vi.fn(),
    })
    shell.setState({ x: 0, y: 0, open: true }); read.mockClear()
    document.querySelector<HTMLElement>('.so-phone-close')!.click()
    shell.refreshHome(); shell.refreshHome()
    expect(read).not.toHaveBeenCalled()
    shell.setState({ x: 0, y: 0, open: true })
    expect(read).toHaveBeenCalledOnce()
    shell.destroy()
  })

  it('切换 App 会先卸载上一个', () => {
    const un1 = vi.fn()
    const un2 = vi.fn()
    const { shell } = setup([makeApp('app-a', { unmount: un1 }), makeApp('app-b', { unmount: un2 })], {
      open: true,
    })
    shell.openApp('app-a')
    shell.openApp('app-b')
    expect(un1).toHaveBeenCalledTimes(1)
    shell.destroy()
    expect(un2).toHaveBeenCalledTimes(1)
  })

  it('mount 抛错：立即清理订阅和资源，强清半渲染 DOM，只显示错误占位页', () => {
    const unmount = vi.fn()
    const bad: PhoneApp = {
      id: 'bad-app',
      name: 'bad',
      icon: '💥',
      mount(container, ctx) {
        ctx.onMessageReceived(() => {})
        const half = document.createElement('div')
        half.className = 'half-rendered'
        container.append(half)
        throw new Error('boom')
      },
      unmount,
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const { shell, subCount } = setup([bad], { open: true })
    shell.openApp('bad-app')
    expect(subCount()).toBe(0)
    expect(unmount).toHaveBeenCalledOnce()
    expect(document.querySelector('.half-rendered')).toBeNull()
    expect(document.querySelector('.so-phone-app-error')).not.toBeNull()
    errSpy.mockRestore()
    shell.destroy()
    expect(unmount).toHaveBeenCalledOnce()
  })

  it('离开 App 时，经 ctx 建立的订阅被框架自动退订（能力层）', () => {
    const app: PhoneApp = {
      id: 'sub-app',
      name: '订阅',
      icon: '🔔',
      mount(_container, ctx) {
        ctx.onMessageReceived(() => {})
      },
    }
    const { shell, subCount } = setup([app], { open: true })
    shell.openApp('sub-app')
    expect(subCount()).toBe(1)
    const homeBtn = document.querySelector('.so-phone-homebtn') as HTMLElement
    homeBtn.click()
    expect(subCount()).toBe(0) // dispose 契约的框架侧保证：无手写 unmount 也不泄漏
    shell.destroy()
  })
})
