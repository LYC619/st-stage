// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { readNativeProfiles, switchNativeProfile, onNativeProfilesChanged } from './native-profiles'
import { sanitizeAppData } from './core'

afterEach(() => { vi.unstubAllGlobals(); document.body.replaceChildren(); vi.useRealTimers() })
function host() {
  const handlers = new Map<string, Set<(...args: unknown[]) => void>>()
  const manager = { selectedProfile: '', profiles: [
    { id: 'one', name: 'One | /echo hello', mode: 'cc', model: 'm1', get 'secret-id'() { throw new Error('must not read credentials') } },
    { id: 'two', name: 'Two', mode: 'tc', model: 'm2' },
  ] }
  const context = { extensionSettings: { connectionManager: manager, disabledExtensions: [] as string[] }, event_types: { CONNECTION_PROFILE_LOADED: 'loaded', CONNECTION_PROFILE_UPDATED: 'updated' }, eventSource: {
    on(event: string, handler: (...args: unknown[]) => void) { if (!handlers.has(event)) handlers.set(event, new Set()); handlers.get(event)!.add(handler) },
    removeListener(event: string, handler: (...args: unknown[]) => void) { handlers.get(event)?.delete(handler) },
  } }
  vi.stubGlobal('SillyTavern', { getContext: () => context })
  const select = document.createElement('select'); select.id = 'connection_profiles'; select.add(new Option('None', ''))
  manager.profiles.forEach(p => select.add(new Option(p.name, p.id))); document.body.append(select)
  const emit = (event: string, ...args: unknown[]) => handlers.get(event)?.forEach(handler => handler(...args))
  select.onchange = () => { manager.selectedProfile = select.value }
  return { manager, context, select, emit, handlers }
}
describe('native connection profiles', () => {
  it('projects safe fields and switches the native select by ID without executing names as commands', async () => {
    const h = host()
    expect(readNativeProfiles()).toMatchObject({ available: true, profiles: [{ id: 'one', name: 'One | /echo hello', mode: 'cc', model: 'm1' }, { id: 'two' }] })
    const promise = switchNativeProfile('one')
    expect(h.select.value).toBe('one')
    await expect(switchNativeProfile('two')).rejects.toThrow('busy')
    h.emit('loaded', 'One | /echo hello'); await promise
    expect(h.handlers.get('loaded')?.size).toBe(0)
  })
  it('rejects disabled, missing and timed-out profiles, and removes its listeners', async () => {
    const h = host()
    h.context.extensionSettings.disabledExtensions.push('connection-manager')
    expect(readNativeProfiles().available).toBe(false)
    await expect(switchNativeProfile('one')).rejects.toThrow('unavailable')
    h.context.extensionSettings.disabledExtensions.length = 0
    await expect(switchNativeProfile('gone')).rejects.toThrow('missing')
    vi.useFakeTimers()
    const timeout = expect(switchNativeProfile('two', 20)).rejects.toThrow('timeout')
    await vi.advanceTimersByTimeAsync(21); await timeout
    expect(h.handlers.get('loaded')?.size).toBe(0)
  })
  it('observes external updates and releases subscriptions', () => {
    const h = host(), callback = vi.fn(), dispose = onNativeProfilesChanged(callback)
    h.emit('updated'); expect(callback).toHaveBeenCalledOnce()
    dispose(); h.emit('updated'); expect(callback).toHaveBeenCalledOnce()
  })
  it('retains only stable character references when sanitizing legacy data', () => {
    const data = sanitizeAppData({ profiles: [], nativeCharacterProfiles: { 'avatar:a.png': 'one', 'name:Alice': 'two', '__proto__': 'bad', 'avatar:b.png': { key: 'PRIVATE' } } })
    expect(data.nativeCharacterProfiles).toEqual({ 'avatar:a.png': 'one' })
    expect(sanitizeAppData(data)).toEqual(data)
  })
})
