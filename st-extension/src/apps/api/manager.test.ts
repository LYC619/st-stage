// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import type { ApiAppData, ApiProfile } from './core'
import { createApiManager } from './manager'

function sourceSelect(): HTMLSelectElement {
  const label = Array.from(document.querySelectorAll('label'))
    .find((item) => item.textContent?.includes('来源'))
  const select = label?.querySelector('select')
  if (!(select instanceof HTMLSelectElement)) throw new Error('找不到来源选择器')
  return select
}

function openManager(data: ApiAppData) {
  const manager = createApiManager({ getData: () => data, setData: vi.fn() })
  manager.open()
  return manager
}

afterEach(() => {
  document.body.textContent = ''
  Reflect.deleteProperty(window, 'SillyTavern')
})

describe('API manager channel boundary', () => {
  it('sizes the modal explicitly for ST mobile layout and returns focus on Escape', () => {
    const opener = document.createElement('button'); document.body.append(opener); opener.focus()
    const manager = openManager({ profiles: [], nativeCharacterProfiles: { 'avatar:a.png': 'native-one' } })
    const backdrop = document.querySelector<HTMLElement>('.so-manager-backdrop')!
    expect(backdrop.style.height).toBe(`${window.innerHeight}px`)
    expect(backdrop.style.width).toBe(`${window.innerWidth}px`)
    expect(document.activeElement).toBe(document.querySelector('.so-manager-close'))
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    expect(manager.isOpen()).toBe(false); expect(document.activeElement).toBe(opener)
  })
  it('new profiles show only the common chat channels', () => {
    const manager = openManager({ profiles: [] })
    const add = Array.from(document.querySelectorAll<HTMLElement>('[role="button"]'))
      .find((button) => button.textContent?.includes('添加连接档案'))
    expect(add).toBeDefined()
    add?.click()

    expect([...sourceSelect().options].map((option) => option.value)).toEqual([
      'openai',
      'claude',
      'openrouter',
      'makersuite',
      'custom',
    ])
    const key = Array.from(document.querySelectorAll<HTMLInputElement>('input'))
      .find((input) => input.type === 'password')
    expect(key?.placeholder).toContain('明文')
    manager.close()
  })

  it('keeps a legacy niche channel visible while editing its existing profile', () => {
    const legacy: ApiProfile = {
      version: 2,
      id: 'legacy',
      name: '旧 DeepSeek',
      mainApi: 'openai',
      source: 'deepseek',
      url: '',
      key: 'secret',
      secretId: '',
      secretMode: 'stored',
      model: 'deepseek-chat',
      settings: {},
    }
    const manager = openManager({ profiles: [legacy] })
    document.querySelector<HTMLElement>('[data-profile-id="legacy"] .vm-leaf-main')?.click()

    expect([...sourceSelect().options].map((option) => option.value)).toEqual([
      'openai',
      'claude',
      'openrouter',
      'makersuite',
      'custom',
      'deepseek',
    ])
    manager.close()
  })
})
