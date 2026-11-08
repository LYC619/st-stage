// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import { mountWeChat } from './test-fixture'
import { createProfileEditor } from './profile-editor'
import { normalizeProfile } from './profile'
import { PLAYER_EMOJIS } from './manifest-data'
import { createProfileSettings } from './profile-settings'

let fixture: ReturnType<typeof mountWeChat> | undefined
afterEach(() => { fixture?.app.unmount?.(); fixture = undefined; vi.restoreAllMocks(); document.body.replaceChildren() })

it('defers the settings form and gallery until needed, and closing discards unsaved fields', () => {
  const f = fixture = mountWeChat(); f.open(f.b.scopeKey!)
  expect(f.container.querySelector('.wt-profile-settings')).toBeNull()
  f.el('#wt-settings-btn').click()
  const form = f.el('.wt-profile-settings')
  expect(form.querySelectorAll('.wt-asset-grid img')).toHaveLength(0)
  const field = f.el<HTMLInputElement>('input[aria-label^="用户称呼"]'); field.value = 'unsaved'
  f.el('#wt-close-settings').click(); f.el('#wt-settings-btn').click()
  expect(f.el('.wt-profile-settings')).toBe(form); expect(field.value).toBe('')
})

it('preserves untouched assets on save and populates the latest gallery only when expanded', () => {
  const packs = vi.fn(() => [{ id: 'one', name: '图库', sprites: [{ tag: '船票', url: 'https://example.test/ticket.png' }] }])
  const editor = createProfileEditor(document.body, packs), id = Object.keys(PLAYER_EMOJIS)[0]
  const profile = normalizeProfile({ profile: { assetOverrides: { [`player.${id}`]: 'https://example.test/custom.png' } } })
  editor.fill(profile)
  expect(packs).not.toHaveBeenCalled(); expect(document.querySelectorAll('.wt-asset-grid img')).toHaveLength(0)
  expect(editor.read()).toEqual(profile)
  editor.showAssets(); expect(packs).toHaveBeenCalledOnce()
  const card = document.querySelector('.wt-asset-grid button'), name = document.querySelector<HTMLInputElement>('input[aria-label="素材显示名"]')!
  name.value = '未保存的素材名'
  const panel = document.querySelector<HTMLDetailsElement>('[data-asset-manager]')!
  panel.open = false; panel.dispatchEvent(new Event('toggle')); editor.showAssets()
  expect(document.querySelector('.wt-asset-grid button')).toBe(card); expect(name.value).toBe('未保存的素材名')
  expect(editor.read().assetEdits[`player.${id}`].name).toBe('未保存的素材名')
  panel.open = false; panel.dispatchEvent(new Event('toggle')); editor.fill(normalizeProfile())
  expect(packs).toHaveBeenCalledOnce(); expect(editor.read().assetOverrides).toEqual({})
  editor.showAssets(); expect(packs).toHaveBeenCalledTimes(2)
  expect(name.value).toBe(PLAYER_EMOJIS[id].name)
})

it('ignores an older prompt preview after reopening for a different contact', async () => {
  let finish!: (value: string) => void
  const preview = vi.fn().mockReturnValueOnce(new Promise<string>(resolve => { finish = resolve })).mockResolvedValueOnce('B preview')
  const form = createProfileSettings(document.body, { config: {} }, vi.fn(), { preview })
  form.open('avatar:a.png')
  const button = [...document.querySelectorAll('button')].find(node => node.textContent === '预览实际发送的提示词')!
  button.click(); form.open('avatar:b.png')
  expect(button.disabled).toBe(false)
  button.click(); await vi.waitFor(() => expect(document.querySelector<HTMLTextAreaElement>('[aria-label="实际提示词预览"]')!.value).toBe('B preview'))
  finish('A stale preview'); await Promise.resolve(); await Promise.resolve()
  expect(document.querySelector<HTMLTextAreaElement>('[aria-label="实际提示词预览"]')!.value).toBe('B preview')
})
