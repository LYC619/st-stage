// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { PhoneApp, PhoneAppContext } from '../../../core/phone-registry'
import { createDefaultSettings } from '../../../core/types'
import { apiApp } from './api-app'
import type { ApiAppData } from './api/core'
import * as native from './api/native-profiles'
import * as bridge from './api/bridge'

let app: PhoneApp | undefined
afterEach(() => { app?.unmount?.(); app = undefined; vi.restoreAllMocks(); document.body.replaceChildren() })
function mount() {
  let data: ApiAppData = { profiles: [] }, avatar = 'a.png', changed = () => {}
  vi.spyOn(native, 'readNativeProfiles').mockReturnValue({ available: true, selectedId: '', profiles: [{ id: 'one', name: 'Native', mode: 'cc', model: 'test' }] })
  vi.spyOn(native, 'onNativeProfilesChanged').mockReturnValue(() => {})
  vi.spyOn(bridge, 'onOnlineStatusChanged').mockReturnValue(() => {})
  vi.spyOn(bridge, 'readConnection').mockResolvedValue(null)
  const switchProfile = vi.spyOn(native, 'switchNativeProfile').mockResolvedValue()
  const ctx: PhoneAppContext = {
    apiVersion: 2, getSettings: createDefaultSettings, getCharacterName: () => 'Same name', getCharacterCard: () => ({ avatar }),
    getAppData: <T>() => data as T, setAppData: <T>(value: T) => { data = value as ApiAppData },
    onCharacterChanged: handler => { changed = handler; return () => {} }, onMessageReceived: () => () => {},
    injectPrompt: () => {}, toast: vi.fn(), updateSettings: () => {}, goHome: () => {}, openModal: () => {},
    setTimeout: window.setTimeout.bind(window), setInterval: window.setInterval.bind(window),
  }
  const root = document.createElement('div'); document.body.append(root)
  app = apiApp({ openManager: vi.fn() }); app.mount(root, ctx)
  return { root, switchProfile, data: () => data, switchRole: () => { avatar = 'b.png'; changed() } }
}
describe('native API phone page', () => {
  it('stores only role references, never switches automatically, and separates selection from connection', async () => {
    const h = mount(); await Promise.resolve()
    const select = h.root.querySelector<HTMLSelectElement>('select')!
    select.value = 'one'; select.dispatchEvent(new Event('change'))
    expect(h.data().nativeCharacterProfiles).toEqual({ 'avatar:a.png': 'one' })
    expect(h.switchProfile).not.toHaveBeenCalled()
    h.switchRole(); await Promise.resolve()
    expect(h.root.querySelector<HTMLSelectElement>('select')!.value).toBe('')
    h.root.querySelector<HTMLButtonElement>('[data-native-profile-id]')!.click()
    await vi.waitFor(() => expect(h.root.textContent).toContain('当前仍未连接'))
    expect(h.switchProfile).toHaveBeenCalledExactlyOnceWith('one')
    expect(h.root.querySelector('details[data-api-legacy]')).not.toBeNull()
  })
  it('leaving during a switch prevents the old completion from rewriting the next page', async () => {
    const h = mount(); await Promise.resolve()
    let finish!: () => void
    h.switchProfile.mockImplementation(() => new Promise(resolve => { finish = resolve }))
    h.root.querySelector<HTMLButtonElement>('[data-native-profile-id]')!.click()
    h.root.querySelector<HTMLButtonElement>('[data-native-profile-id]')!.click()
    expect(h.switchProfile).toHaveBeenCalledOnce()
    app!.unmount!(); h.root.textContent = 'Next app'
    finish(); await Promise.resolve(); await Promise.resolve()
    expect(h.root.textContent).toBe('Next app')
  })
})
