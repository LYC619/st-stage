import { describe, expect, it, vi } from 'vitest'
import {
  inspectExtensionModule,
  inspectPowerUserModule,
  summarizeExtensionManifest,
} from './st-contract'

function extensionModule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    extensionNames: ['expressions', 'third-party/st-stage', 'third-party/tool'],
    extensionTypes: {
      expressions: 'system',
      'third-party/st-stage': 'local',
      'third-party/tool': 'global',
    },
    extension_settings: { disabledExtensions: ['third-party/tool'], apiKey: 'must-not-leak' },
    findExtension: vi.fn((name: string) => ({ name, enabled: name !== 'third-party/tool' })),
    getExtensionManifest: vi.fn(() => null),
    enableExtension: vi.fn(async () => undefined),
    disableExtension: vi.fn(async () => undefined),
    ...overrides,
  }
}

describe('SillyTavern extension module contract', () => {
  it('accepts the complete ST 1.18 extension API shape', () => {
    const result = inspectExtensionModule(extensionModule())

    expect(result.status).toBe('ready')
    expect(result.governance).toEqual({ writable: true })
    expect(result.api?.extensionNames).toEqual([
      'expressions',
      'third-party/st-stage',
      'third-party/tool',
    ])
  })

  it.each(['extensionNames', 'extensionTypes', 'extension_settings', 'findExtension', 'getExtensionManifest'])(
    'rejects a module missing the read export %s',
    (name) => {
      const mod = extensionModule()
      Reflect.deleteProperty(mod, name)

      const result = inspectExtensionModule(mod)

      expect(result.status).toBe('unavailable')
      if (result.status !== 'unavailable') throw new Error('expected unavailable contract')
      expect(result.api).toBeUndefined()
      expect(result.reason).toContain(name)
    },
  )

  it.each(['enableExtension', 'disableExtension'])(
    'keeps inventory readable but makes all governance read-only when %s is missing',
    (name) => {
      const mod = extensionModule()
      Reflect.deleteProperty(mod, name)

      const result = inspectExtensionModule(mod)

      expect(result.status).toBe('ready')
      expect(result.api).toBeDefined()
      expect(result.governance.writable).toBe(false)
      expect(result.governance.reason).toContain(name)
    },
  )

  it('rejects unsafe collection shapes instead of coercing them', () => {
    const result = inspectExtensionModule(extensionModule({
      extensionNames: ['ok', 42],
      extension_settings: { disabledExtensions: 'third-party/tool' },
    }))

    expect(result.status).toBe('unavailable')
    if (result.status !== 'unavailable') throw new Error('expected unavailable contract')
    expect(result.reason).toContain('extensionNames')
    expect(result.reason).toContain('extension_settings.disabledExtensions')
  })
})

describe('SillyTavern power-user module contract', () => {
  it('accepts only an exported applyPowerUserSettings function', () => {
    const applyPowerUserSettings = vi.fn()

    expect(inspectPowerUserModule({ applyPowerUserSettings })).toEqual({
      available: true,
      applyPowerUserSettings,
    })
    expect(inspectPowerUserModule({ applyPowerUserSettings: true })).toEqual({
      available: false,
      reason: 'power-user.js 缺少 applyPowerUserSettings',
    })
  })
})

describe('extension manifest summary', () => {
  it('preserves valid dependencies and raw fields needed for self/dependency protection', () => {
    const summary = summarizeExtensionManifest({
      display_name: 'Tool',
      version: '1.2.3',
      loading_order: 100,
      js: 'index.js',
      css: 'style.css',
      dependencies: ['third-party/base'],
      requires: ['chromadb'],
      api_key: 'must-not-leak',
      prompt: 'must-not-leak',
    })

    expect(summary).toEqual({
      displayName: 'Tool',
      version: '1.2.3',
      loadingOrder: 100,
      js: 'index.js',
      css: 'style.css',
      dependencies: { status: 'valid', names: ['third-party/base'] },
      requiredModules: { status: 'valid', names: ['chromadb'] },
    })
    expect(JSON.stringify(summary)).not.toContain('must-not-leak')
  })

  it('distinguishes absent and malformed dependency declarations', () => {
    expect(summarizeExtensionManifest({})?.dependencies).toEqual({ status: 'absent', names: [] })
    expect(summarizeExtensionManifest({ dependencies: 'third-party/base' })?.dependencies)
      .toEqual({ status: 'invalid', names: [] })
  })

  it('returns null for non-object manifests', () => {
    expect(summarizeExtensionManifest('secret prompt text')).toBeNull()
  })
})
