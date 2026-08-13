import {
  createButlerBridge,
  groupResourceTimings,
  readHealthState,
  readMobileState,
  readPerf,
  readPerfState,
  writePerf,
  type CapabilityValue,
  type ExtensionInventoryResult,
  type ExtensionWriteResult,
  type PerfHealthState,
} from './bridge'
import { createMetricsSampler, runProbeTimeline } from './metrics'
import type { MeasurementEnvironment, MeasurementSnapshot, PerformanceSettingsSnapshot } from './types'

export interface ButlerAppServices {
  collectStatic(): Promise<MeasurementSnapshot>
  sampleIdle(signal?: AbortSignal): Promise<MeasurementSnapshot>
  sampleControlledScroll(signal?: AbortSignal): Promise<MeasurementSnapshot>
  readPerformance(): PerformanceSettingsSnapshot | null
  writePerformance(fields: Partial<PerformanceSettingsSnapshot>): Promise<void>
  readMobile(): CapabilityValue<boolean>
  readHealth(): PerfHealthState
  readExtensions(): Promise<ExtensionInventoryResult>
  setExtensionEnabled(name: string, enabled: boolean): Promise<ExtensionWriteResult>
  reloadPage(): Promise<void>
  backupStorage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
  warnRecovery(command: string): void
  now(): number
  createId(): string
  confirm(message: string): boolean
}

interface MemoryPerformance extends Performance {
  memory?: { usedJSHeapSize?: number }
}

interface ScriptContract {
  isGenerating?: () => boolean
  saveSettings?: () => Promise<unknown> | unknown
}

type ButlerBridge = ReturnType<typeof createButlerBridge>
type ScriptModuleLoader = (specifier: string) => Promise<unknown>

export interface ButlerRuntimeDependencies {
  bridge?: ButlerBridge
  loadScriptModule?: ScriptModuleLoader
  runTimeline?: typeof runProbeTimeline
  now?: () => number
  createId?: () => string
  reloadNow?: () => void
  delay?: (ms: number) => Promise<void>
}

function observed<T extends string | boolean | Record<string, boolean | number>>(
  value: T | null,
  reason: string,
) {
  return value === null ? { available: false as const, reason } : { available: true as const, value }
}

function buildVersion(): string | null {
  if (typeof __EXT_VERSION__ === 'undefined' || typeof __BUILD_TIME__ === 'undefined') return null
  return `${__EXT_VERSION__}+${__BUILD_TIME__}`
}

function stVersion(): string | null {
  const text = document.querySelector('#version_display')?.textContent?.trim()
  return text || null
}

function digest(values: string[]): string {
  let hash = 0xcbf29ce484222325n
  for (const value of values.sort().join('\u0000')) {
    hash ^= BigInt(value.charCodeAt(0))
    hash = BigInt.asUintN(64, hash * 0x100000001b3n)
  }
  return hash.toString(16).padStart(16, '0')
}

function storageFallback(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  return {
    getItem() { return null },
    setItem() {},
    removeItem() {},
  }
}

function recoveryStorage(): Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  let storage: Storage
  try {
    storage = window.localStorage
  } catch {
    return storageFallback()
  }
  return {
    getItem(key) {
      try { return storage.getItem(key) } catch { return null }
    },
    setItem(key, value) {
      try { storage.setItem(key, value) } catch { /* Cross-refresh backup is best effort. */ }
    },
    removeItem(key) {
      try { storage.removeItem(key) } catch { /* A stale backup remains visible for manual cleanup. */ }
    },
  }
}

function resourceGroups() {
  if (typeof performance?.getEntriesByType !== 'function') return null
  try {
    const entries = performance.getEntriesByType('resource').map((entry) => {
      const resource = entry as PerformanceResourceTiming
      return {
        name: resource.name,
        initiatorType: resource.initiatorType,
        transferSize: resource.transferSize,
        duration: resource.duration,
      }
    })
    return groupResourceTimings(entries)
  } catch {
    return null
  }
}

function observeLongTasks(record: (durationMs: number) => void) {
  if (typeof PerformanceObserver === 'undefined'
    || !PerformanceObserver.supportedEntryTypes?.includes('longtask')) return null
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) record(entry.duration)
    })
    observer.observe({ type: 'longtask', buffered: false })
    return { disconnect: () => observer.disconnect() }
  } catch {
    return null
  }
}

function animationCount(): number | null {
  const getAnimations = (document as Document & { getAnimations?: () => Animation[] }).getAnimations
  if (typeof getAnimations !== 'function') return null
  try {
    return getAnimations.call(document).filter((animation) => animation.playState === 'running').length
  } catch {
    return null
  }
}

function createNativeServices(deps: ButlerRuntimeDependencies = {}): ButlerAppServices {
  const bridge = deps.bridge ?? createButlerBridge()
  const loadScriptModule = deps.loadScriptModule ?? ((specifier: string) => import(specifier))
  const now = deps.now ?? (() => Date.now())
  const createId = deps.createId ?? (() => crypto.randomUUID?.() ?? `butler-${Date.now()}-${Math.random().toString(36).slice(2)}`)
  const reloadNow = deps.reloadNow ?? (() => window.location.reload())
  const delay = deps.delay ?? ((ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms)))
  let generationReader: (() => boolean) | null = null
  let settingsWriter: (() => Promise<unknown> | unknown) | null = null
  let generationContractPromise: Promise<boolean> | null = null

  const loadGenerationContract = async () => {
    if (generationReader) return true
    generationContractPromise ??= (async () => {
      try {
        const specifier = '/script.js'
        const module = await loadScriptModule(specifier) as ScriptContract
        if (typeof module.isGenerating === 'function') {
          generationReader = module.isGenerating
        }
        if (typeof module.saveSettings === 'function') settingsWriter = module.saveSettings
        return generationReader !== null
      } catch {
        generationReader = null
      }
      return false
    })().finally(() => { generationContractPromise = null })
    return generationContractPromise
  }

  const readEnvironment = async (): Promise<MeasurementEnvironment> => {
    const perf = readPerfState()
    const extensions = await bridge.readExtensions()
    const mobile = readMobileState()
    return {
      stVersion: observed(stVersion(), '当前页面未公开 SillyTavern 版本文本'),
      stageBuild: observed(buildVersion(), '开发源码未注入构建戳'),
      mobile: mobile.available
        ? { available: true, value: mobile.value }
        : { available: false, reason: mobile.reason },
      settingsSummary: perf.status === 'unavailable'
        ? { available: false, reason: perf.reason ?? '性能设置不可用' }
        : { available: true, value: { ...perf.snapshot } },
      disabledExtensionsHash: extensions.status === 'ready'
        ? { available: true, value: digest([...extensions.disabledExtensions]) }
        : { available: false, reason: extensions.reason },
    }
  }

  const sampler = createMetricsSampler({
    now,
    createId,
    readEnvironment,
    readPageSummary: bridge.readPageSummary,
    readPerfState,
    readResourceGroups: resourceGroups,
    async estimateStorage() {
      try {
        if (typeof navigator.storage?.estimate !== 'function') return null
        const estimate = await navigator.storage.estimate()
        return typeof estimate.usage === 'number' && typeof estimate.quota === 'number'
          ? { usage: estimate.usage, quota: estimate.quota }
          : null
      } catch {
        return null
      }
    },
    readHeapBytes() {
      const used = (performance as MemoryPerformance).memory?.usedJSHeapSize
      return typeof used === 'number' && Number.isFinite(used) ? used : null
    },
    getChatScroller: () => document.querySelector<HTMLElement>('#chat'),
    getViewport: () => ({
      width: window.visualViewport?.width ?? window.innerWidth,
      height: window.visualViewport?.height ?? window.innerHeight,
    }),
    countAnimations: animationCount,
    isForeground: () => document.visibilityState === 'visible',
    isGenerating: () => {
      if (!generationReader) return null
      try {
        return generationReader()
      } catch {
        return null
      }
    },
    observeLongTasks,
    runTimeline: deps.runTimeline ?? ((durationMs, signal, handlers) => runProbeTimeline(durationMs, signal, handlers)),
  })

  const beforeDynamicProbe = async () => {
    await loadGenerationContract()
  }

  const reloadPage = async () => {
    await loadGenerationContract()
    if (settingsWriter) {
      try {
        await settingsWriter()
      } catch {
        await delay(1100)
      }
    } else {
      await delay(1100)
    }
    reloadNow()
  }

  return {
    collectStatic: () => sampler.collectStatic(),
    async sampleIdle(signal) {
      await beforeDynamicProbe()
      return sampler.sampleIdle(signal)
    },
    async sampleControlledScroll(signal) {
      await beforeDynamicProbe()
      return sampler.sampleControlledScroll(signal)
    },
    readPerformance: () => readPerf(),
    writePerformance: (fields) => writePerf(fields),
    readMobile: readMobileState,
    readHealth: readHealthState,
    readExtensions: bridge.readExtensions,
    setExtensionEnabled: bridge.setExtensionEnabled,
    reloadPage,
    backupStorage: recoveryStorage(),
    warnRecovery: (command) => console.warn('[st-stage] 管家扩展治理紧急恢复命令：', command),
    now,
    createId,
    confirm: (message) => window.confirm(message),
  }
}

export function createButlerAppServices(deps: ButlerRuntimeDependencies = {}): ButlerAppServices {
  return createNativeServices(deps)
}
