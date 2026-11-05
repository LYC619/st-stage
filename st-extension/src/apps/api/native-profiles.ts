import { getApiHostContext } from './bridge'
export interface NativeProfile { id: string; name: string; mode: string; model: string }
type Handler = (...args: unknown[]) => void
interface NativeContext {
  extensionSettings?: { disabledExtensions?: string[]; connectionManager?: { profiles?: unknown; selectedProfile?: unknown } }
  event_types?: Record<string, string>
  eventTypes?: Record<string, string>
  eventSource?: { on(event: string, handler: Handler): void; removeListener(event: string, handler: Handler): void }
}
function context(): NativeContext | undefined {
  return getApiHostContext()
}
export class NativeProfileError extends Error {
  constructor(public code: 'unavailable' | 'missing' | 'busy' | 'timeout' | 'interrupted') { super(code) }
}
export function readNativeProfiles(): { available: boolean; selectedId: string; profiles: NativeProfile[] } {
  const st = context(), manager = st?.extensionSettings?.connectionManager
  const profiles: NativeProfile[] = []
  if (Array.isArray(manager?.profiles)) for (const raw of manager.profiles) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) continue
    // Deliberately project display fields; never read, spread, or persist the secret-id / credential fields.
    const { id, name, mode, model } = raw
    if (typeof id !== 'string' || !id || id.length > 256 || typeof name !== 'string' || !name.trim() || profiles.some(item => item.id === id)) continue
    profiles.push({ id, name, mode: typeof mode === 'string' ? mode.slice(0, 20) : '', model: typeof model === 'string' ? model.slice(0, 240) : '' })
  }
  return {
    available: !!st?.eventSource && !!document.querySelector('select#connection_profiles') && !st.extensionSettings?.disabledExtensions?.includes('connection-manager'),
    selectedId: typeof manager?.selectedProfile === 'string' ? manager.selectedProfile : '', profiles,
  }
}
let switching = false
export function isNativeSwitching(): boolean { return switching }
export async function switchNativeProfile(id: string, timeoutMs = 15000): Promise<void> {
  if (switching) throw new NativeProfileError('busy')
  const snapshot = readNativeProfiles(), st = context(), source = st?.eventSource
  const select = document.querySelector<HTMLSelectElement>('select#connection_profiles')
  if (!snapshot.available || !source || !select) throw new NativeProfileError('unavailable')
  if (!snapshot.profiles.some(item => item.id === id) || ![...select.options].some(option => option.value === id)) throw new NativeProfileError('missing')
  const event = st?.eventTypes?.CONNECTION_PROFILE_LOADED ?? st?.event_types?.CONNECTION_PROFILE_LOADED ?? 'connection_profile_loaded'
  switching = true
  try {
    await new Promise<void>((resolve, reject) => {
      const cleanup = () => { clearTimeout(timer); source.removeListener(event, loaded) }
      const loaded = (name: unknown) => {
        if (name !== snapshot.profiles.find(item => item.id === id)?.name) return
        cleanup()
        if (readNativeProfiles().selectedId === id) resolve()
        else reject(new NativeProfileError('interrupted'))
      }
      const timer = setTimeout(() => { cleanup(); reject(new NativeProfileError('timeout')) }, timeoutMs)
      source.on(event, loaded)
      try { select.value = id; select.dispatchEvent(new Event('change', { bubbles: true })) }
      catch (error) { cleanup(); reject(error) }
    })
  } finally { switching = false }
}
export function onNativeProfilesChanged(handler: () => void): () => void {
  const st = context(), source = st?.eventSource
  if (!source) return () => {}
  const events = ['CONNECTION_PROFILE_LOADED', 'CONNECTION_PROFILE_CREATED', 'CONNECTION_PROFILE_UPDATED', 'CONNECTION_PROFILE_DELETED']
    .map(key => st?.eventTypes?.[key] ?? st?.event_types?.[key] ?? key.toLowerCase())
  for (const event of events) source.on(event, handler)
  return () => { for (const event of events) source.removeListener(event, handler) }
}
