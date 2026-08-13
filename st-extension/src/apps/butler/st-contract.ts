export type ExtensionToggle = (name: string, reload?: boolean) => Promise<unknown> | unknown

export interface ExtensionModuleApi {
  extensionNames: string[]
  extensionTypes: Record<string, string>
  extensionSettings: { disabledExtensions: string[] }
  findExtension: (name: string) => unknown
  getExtensionManifest: (name: string) => unknown
  enableExtension?: ExtensionToggle
  disableExtension?: ExtensionToggle
}

export type PowerUserContractResult =
  | { available: true; applyPowerUserSettings: () => void }
  | { available: false; reason: string }

export interface GovernanceCapability {
  writable: boolean
  reason?: string
}

export type ExtensionContractResult =
  | {
      status: 'ready'
      api: ExtensionModuleApi
      governance: GovernanceCapability
    }
  | {
      status: 'unavailable'
      reason: string
      governance: { writable: false; reason: string }
      api?: undefined
    }

export type StringListDeclaration =
  | { status: 'absent'; names: [] }
  | { status: 'valid'; names: string[] }
  | { status: 'invalid'; names: [] }

export interface ExtensionManifestSummary {
  displayName?: string
  version?: string
  loadingOrder?: string | number
  js?: string
  css?: string
  dependencies: StringListDeclaration
  requiredModules: StringListDeclaration
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string')
}

function isStringRecord(value: unknown): value is Record<string, string> {
  return isRecord(value) && Object.values(value).every((item) => typeof item === 'string')
}

function declaration(value: unknown): StringListDeclaration {
  if (value === undefined) return { status: 'absent', names: [] }
  if (!isStringArray(value)) return { status: 'invalid', names: [] }
  return { status: 'valid', names: [...value] }
}

/**
 * Validate the narrow ST 1.18.0 extensions.js surface used by Butler.
 * Read exports are required together; write exports are all-or-read-only.
 */
export function inspectExtensionModule(value: unknown): ExtensionContractResult {
  if (!isRecord(value)) {
    const reason = 'extensions.js 模块形状无效'
    return { status: 'unavailable', reason, governance: { writable: false, reason } }
  }

  const missing: string[] = []
  if (!isStringArray(value.extensionNames)) missing.push('extensionNames')
  if (!isStringRecord(value.extensionTypes)) missing.push('extensionTypes')
  const settings = value.extension_settings
  if (!isRecord(settings) || !isStringArray(settings.disabledExtensions)) {
    missing.push('extension_settings.disabledExtensions')
  }
  if (typeof value.findExtension !== 'function') missing.push('findExtension')
  if (typeof value.getExtensionManifest !== 'function') missing.push('getExtensionManifest')

  if (missing.length > 0) {
    const reason = `extensions.js 缺少可读契约：${missing.join('、')}`
    return { status: 'unavailable', reason, governance: { writable: false, reason } }
  }

  const writeMissing: string[] = []
  if (typeof value.enableExtension !== 'function') writeMissing.push('enableExtension')
  if (typeof value.disableExtension !== 'function') writeMissing.push('disableExtension')
  const governance: GovernanceCapability = writeMissing.length === 0
    ? { writable: true }
    : { writable: false, reason: `扩展治理只读：缺少 ${writeMissing.join('、')}` }

  return {
    status: 'ready',
    api: {
      extensionNames: [...value.extensionNames as string[]],
      extensionTypes: { ...value.extensionTypes as Record<string, string> },
      // Keep the validated live object: ST replaces disabledExtensions after enableExtension().
      extensionSettings: settings as { disabledExtensions: string[] },
      findExtension: value.findExtension as (name: string) => unknown,
      getExtensionManifest: value.getExtensionManifest as (name: string) => unknown,
      enableExtension: typeof value.enableExtension === 'function'
        ? value.enableExtension as ExtensionToggle
        : undefined,
      disableExtension: typeof value.disableExtension === 'function'
        ? value.disableExtension as ExtensionToggle
        : undefined,
    },
    governance,
  }
}

export function inspectPowerUserModule(value: unknown): PowerUserContractResult {
  if (!isRecord(value) || typeof value.applyPowerUserSettings !== 'function') {
    return { available: false, reason: 'power-user.js 缺少 applyPowerUserSettings' }
  }
  return { available: true, applyPowerUserSettings: value.applyPowerUserSettings as () => void }
}

/** Keep only extension-management metadata; arbitrary manifest fields never cross the bridge. */
export function summarizeExtensionManifest(value: unknown): ExtensionManifestSummary | null {
  if (!isRecord(value)) return null
  const summary: ExtensionManifestSummary = {
    dependencies: declaration(value.dependencies),
    requiredModules: declaration(value.requires),
  }
  if (typeof value.display_name === 'string') summary.displayName = value.display_name
  if (typeof value.version === 'string') summary.version = value.version
  if (typeof value.loading_order === 'string' || typeof value.loading_order === 'number') {
    summary.loadingOrder = value.loading_order
  }
  if (typeof value.js === 'string') summary.js = value.js
  if (typeof value.css === 'string') summary.css = value.css
  return summary
}

export function parseFoundExtension(value: unknown): { name: string; configuredEnabled: boolean } | null {
  if (!isRecord(value) || typeof value.name !== 'string' || typeof value.enabled !== 'boolean') return null
  return { name: value.name, configuredEnabled: value.enabled }
}
