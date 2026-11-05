// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createProfileSettings } from './profile-settings'
import { resolveProfile } from './profile-library'
import type { WeChatAppData } from './types'

afterEach(() => { vi.restoreAllMocks(); document.body.replaceChildren() })
const field = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!
const change = (input: HTMLSelectElement, value: string) => { input.value = value; input.dispatchEvent(new Event('change')) }
const click = (text: string) => [...document.querySelectorAll('button')].find(button => button.textContent === text)!.click()

describe('scoped WeChat settings', () => {
  it('previews, saves and deletes templates independently from applying the current role', () => {
    const data: WeChatAppData = { config: { apiKey: 'PRIVATE', profile: { contactName: 'Default' } } }
    const persist = vi.fn(); const form = createProfileSettings(document.body, data, persist)
    form.open('avatar:a.png')
    expect(field<HTMLSelectElement>('[data-profile-scope]').value).toBe('global')
    change(field('[data-profile-scope]'), 'character')
    field<HTMLInputElement>('input[aria-label^="联系人"]').value = 'Role'
    field<HTMLInputElement>('input[aria-label="模板名称"]').value = 'One'
    click('保存为模板')
    expect(persist).toHaveBeenCalledOnce()
    expect(data.config.characterProfiles).toBeUndefined()
    const next = form.save(data.config); data.config = next
    expect(resolveProfile(next, 'avatar:a.png').contactName).toBe('Role')
    expect(resolveProfile(next, 'avatar:b.png').contactName).toBe('Default')
    click('导出当前表单')
    expect(field<HTMLTextAreaElement>('textarea[aria-label^="模板 JSON"]').value).not.toContain('PRIVATE')
    click('删除模板'); expect(data.profileTemplates).toHaveLength(1)
    click('再次点击确认删除'); expect(data.profileTemplates).toHaveLength(0)
    click('此联系人改用通用设置')
    expect(resolveProfile(form.save(next), 'avatar:a.png').contactName).toBe('Default')
  })
  it('remembers the saved edit target across reopening and remount without locking common fields', () => {
    const data: WeChatAppData = { config: { characterProfiles: { 'avatar:a.png': { contactName: 'Role A' } } } }
    const form = createProfileSettings(document.body, data, vi.fn()); form.open('avatar:a.png')
    change(field('[data-profile-scope]'), 'global')
    field<HTMLInputElement>('input[aria-label^="用户称呼"]').value = 'Me'
    data.config = form.save(data.config)
    form.open('avatar:a.png'); expect(field<HTMLSelectElement>('[data-profile-scope]').value).toBe('global')
    expect(field<HTMLInputElement>('input[aria-label^="用户称呼"]').disabled).toBe(false)
    document.body.replaceChildren()
    createProfileSettings(document.body, data, vi.fn()).open('avatar:a.png')
    expect(field<HTMLSelectElement>('[data-profile-scope]').value).toBe('global')
    expect(resolveProfile(data.config, 'avatar:a.png').contactName).toBe('Role A')
    expect(field<HTMLDetailsElement>('[data-profile-template-panel]').open).toBe(false)
  })
})
