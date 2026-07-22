// @vitest-environment jsdom
/**
 * 手机壳交互与 App 生命周期测试（五期·阶段2）：
 * - 关闭按钮只收起手机壳（恢复图标），不销毁
 * - 圆形 Home 键只返回主屏
 * - 离开 App / 收起 / 隐藏时都调用 unmount，不残留定时器与监听
 */

import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPhoneShell } from './phone-shell'
import { PhoneAppRegistry, type PhoneApp } from './phone-registry'
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
  const state: PhoneState = { x: 20, y: 20, open: false, ...initial }
  const shell = createPhoneShell(state, {
    registry,
    createAppContext: (_appId, goHome) => ({
      getSettings: () => settings,
      updateSettings: () => {},
      getCharacterName: () => '',
      getAppData: () => undefined,
      setAppData: () => {},
      goHome,
    }),
    onStateChange: () => {},
  })
  return { shell, registry }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

describe('手机壳交互', () => {
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
})

describe('App 生命周期', () => {
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
})
