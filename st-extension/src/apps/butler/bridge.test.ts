// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createButlerBridge,
  groupResourceTimings,
  readHealthState,
  readMobileState,
  readPerf,
  readPerfState,
  type PerfSnapshot,
} from './bridge'

const completePerf: PerfSnapshot = {
  fast_ui_mode: true,
  reduced_motion: false,
  noShadows: false,
  smooth_streaming: true,
  stream_fade_in: true,
  streaming_fps: 30,
  chat_truncation: 100,
}

function installST(context: Record<string, unknown>): void {
  Object.defineProperty(window, 'SillyTavern', {
    configurable: true,
    value: { getContext: () => context },
  })
}

function extensionModule(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  const manifests: Record<string, unknown> = {
    expressions: { display_name: 'Expressions', dependencies: [] },
    'third-party/st-stage': { display_name: 'ST Stage', dependencies: ['expressions'] },
    'third-party/tool': { display_name: 'Tool', dependencies: ['third-party/st-stage'] },
  }
  const disabledExtensions = ['third-party/tool']
  return {
    extensionNames: ['expressions', 'third-party/st-stage', 'third-party/tool'],
    extensionTypes: {
      expressions: 'system',
      'third-party/st-stage': 'local',
      'third-party/tool': 'global',
    },
    extension_settings: { disabledExtensions, apiKey: 'private-key' },
    findExtension: vi.fn((name: string) => {
      const fullName = name === 'st-stage' ? 'third-party/st-stage' : name
      return manifests[fullName]
        ? { name: fullName, enabled: !disabledExtensions.includes(fullName) }
        : null
    }),
    getExtensionManifest: vi.fn((name: string) => manifests[name] ?? null),
    enableExtension: vi.fn(async () => undefined),
    disableExtension: vi.fn(async () => undefined),
    ...overrides,
  }
}

beforeEach(() => {
  document.body.innerHTML = ''
})

afterEach(() => {
  vi.restoreAllMocks()
  Reflect.deleteProperty(window, 'SillyTavern')
})

describe('performance and page summaries', () => {
  it('returns an explicit ready snapshot when every performance field is valid', () => {
    installST({ powerUserSettings: { ...completePerf } })

    expect(readPerfState()).toEqual({
      status: 'ready',
      snapshot: completePerf,
      capabilities: expect.objectContaining({
        streaming_fps: { available: true },
        chat_truncation: { available: true },
      }),
    })
    expect(readPerf()).toEqual(completePerf)
  })

  it('reports missing fields without substituting old default values', () => {
    const { streaming_fps: _missing, ...partial } = completePerf
    installST({ powerUserSettings: partial })

    const result = readPerfState()

    expect(result.status).toBe('partial')
    expect(result.snapshot).not.toHaveProperty('streaming_fps')
    expect(result.capabilities.streaming_fps).toEqual({
      available: false,
      reason: '字段缺失或类型无效',
    })
    expect(readPerf()).toBeNull()
  })

  it('summarizes chat and DOM counts without returning message text or the raw chat identity', () => {
    const privateChatName = '辨识度很高的私密聊天名称-2026-08-13'
    installST({
      chatId: privateChatName,
      characterId: 4,
      groupId: null,
      chat: [
        { mes: 'private prompt and key one', is_user: true },
        { mes: 'private prompt and key two', is_user: false },
        { mes: 'private system message', is_user: false, is_system: true },
        { mes: 'private unknown message' },
      ],
    })
    document.body.innerHTML = `
      <div id="chat">
        <div class="mes"><div class="mes_text"><span>rendered private text</span></div></div>
        <div class="mes"><div class="mes_text">second private text</div></div>
      </div>`
    const bridge = createButlerBridge()

    const summary = bridge.readPageSummary()
    const repeated = bridge.readPageSummary()
    const serialized = JSON.stringify(summary)

    expect(summary).toMatchObject({
      chat: {
        available: true,
        value: {
          chatKey: expect.stringMatching(/^chat:[0-9a-f]{16}$/),
          messageCount: 4,
          userMessageCount: 1,
          assistantMessageCount: 1,
        },
      },
      dom: {
        available: true,
        value: { renderedMessageCount: 2 },
      },
    })
    expect(summary.dom.available && summary.dom.value.chatNodeCount).toBeGreaterThan(4)
    expect(repeated.chat.available && summary.chat.available && repeated.chat.value.chatKey)
      .toBe(summary.chat.available ? summary.chat.value.chatKey : '')
    expect(serialized).not.toContain(privateChatName)
    expect(serialized).not.toContain('private')
    expect(serialized).not.toContain('prompt')
    expect(serialized).not.toContain('key one')
  })

  it('reports mobile and health capabilities instead of inventing false or zero values', () => {
    installST({})

    expect(readMobileState()).toEqual({
      available: false,
      reason: '未检测到 SillyTavern 移动端判断接口',
    })
    expect(readHealthState()).toEqual({
      disabledExtensions: {
        available: false,
        reason: '未检测到 SillyTavern 扩展设置',
      },
      quickReplySets: {
        available: false,
        reason: '未检测到 SillyTavern 扩展设置',
      },
    })

    installST({
      isMobile: () => true,
      extensionSettings: {
        disabledExtensions: ['third-party/a', 'third-party/b'],
        quickReply: { config: { setList: [{}, {}, {}] } },
      },
    })

    expect(readMobileState()).toEqual({ available: true, value: true })
    expect(readHealthState()).toEqual({
      disabledExtensions: { available: true, value: 2 },
      quickReplySets: { available: true, value: 3 },
    })
  })

  it('rejects malformed or failing environment capabilities', () => {
    installST({
      isMobile: () => 'mobile',
      extensionSettings: {
        disabledExtensions: 'third-party/tool',
        quickReply: { config: { setList: 'private data' } },
      },
    })

    expect(readMobileState()).toEqual({
      available: false,
      reason: 'SillyTavern 移动端判断返回格式无效',
    })
    expect(readHealthState()).toEqual({
      disabledExtensions: {
        available: false,
        reason: '禁用扩展清单缺失或格式无效',
      },
      quickReplySets: {
        available: false,
        reason: 'Quick Reply 设置缺失或格式无效',
      },
    })

    installST({ isMobile: () => { throw new Error('private runtime detail') } })
    expect(readMobileState()).toEqual({
      available: false,
      reason: 'SillyTavern 移动端判断失败',
    })
  })
})

describe('Resource Timing summaries', () => {
  it('groups extensions by name and normal resources only by a controlled resource type', () => {
    const grouped = groupResourceTimings([
      { name: 'https://host/scripts/extensions/third-party/tool/index.js?v=secret', initiatorType: 'script', transferSize: 120, duration: 8 },
      { name: 'https://host/scripts/extensions/third-party/tool/style.css#private', initiatorType: 'link', transferSize: 30, duration: 2 },
      { name: 'https://cdn.example/private/avatar-one.png?token=private', initiatorType: 'img', transferSize: 50, duration: 5 },
      { name: 'https://other.example/user/images/secret-name.webp#private', initiatorType: 'img', transferSize: 70, duration: 7 },
      { name: 'https://host/assets/app.js', initiatorType: 'script', transferSize: 10, duration: 1 },
    ])

    expect(grouped).toEqual([
      { key: 'extension:third-party/tool', count: 2, transferSize: 150, durationMs: 10 },
      { key: 'resource:image', count: 2, transferSize: 120, durationMs: 12 },
      { key: 'resource:script', count: 1, transferSize: 10, durationMs: 1 },
    ])
    expect(JSON.stringify(grouped)).not.toMatch(/secret|private|token|avatar|user\/images|cdn\.example|other\.example|\?v=/)
  })

  it('ignores malformed URLs and clamps invalid numeric evidence', () => {
    expect(groupResourceTimings([
      { name: 'not a valid URL', initiatorType: 'script', transferSize: -1, duration: Number.NaN },
    ])).toEqual([])
  })
})

describe('official extension API bridge', () => {
  it('loads /scripts/extensions.js through a variable-specifier loader and returns safe inventory', async () => {
    const mod = extensionModule()
    const loadModule = vi.fn(async () => mod)
    const bridge = createButlerBridge({ loadModule })

    const result = await bridge.readExtensions()

    expect(loadModule).toHaveBeenCalledWith('/scripts/extensions.js')
    expect(result.status).toBe('ready')
    expect(result.governance).toEqual({ writable: true })
    expect(result.disabledExtensions).toEqual(['third-party/tool'])
    expect(result.extensions).toEqual([
      expect.objectContaining({ name: 'expressions', type: 'system', configuredEnabled: true, isSelf: false }),
      expect.objectContaining({
        name: 'third-party/st-stage',
        type: 'local',
        configuredEnabled: true,
        isSelf: true,
        manifest: expect.objectContaining({ dependencies: { status: 'valid', names: ['expressions'] } }),
      }),
      expect.objectContaining({ name: 'third-party/tool', type: 'global', configuredEnabled: false, isSelf: false }),
    ])
    expect(JSON.stringify(result)).not.toContain('private-key')
  })

  it('labels findExtension.enabled only as configuredEnabled', async () => {
    const bridge = createButlerBridge({ loadModule: async () => extensionModule() })

    const result = await bridge.findExtension('st-stage')

    expect(result).toEqual({
      ok: true,
      extension: { name: 'third-party/st-stage', configuredEnabled: true },
    })
    expect(result).not.toHaveProperty('extension.active')
  })

  it('distinguishes a malformed findExtension response from a missing extension', async () => {
    const bridge = createButlerBridge({
      loadModule: async () => extensionModule({ findExtension: vi.fn(() => ({ name: 42, enabled: 'yes' })) }),
    })

    await expect(bridge.findExtension('third-party/tool')).resolves.toEqual({
      ok: false,
      code: 'invalid-response',
      error: 'SillyTavern findExtension 返回格式无效',
    })
  })

  it.each([
    [true, 'enableExtension'],
    [false, 'disableExtension'],
  ] as const)('calls the official %s operation with reload=false', async (enabled, method) => {
    const mod = extensionModule()
    const bridge = createButlerBridge({ loadModule: async () => mod })

    const result = await bridge.setExtensionEnabled('third-party/tool', enabled)

    expect(mod[method]).toHaveBeenCalledWith('third-party/tool', false)
    expect(result).toEqual({
      ok: true,
      name: 'third-party/tool',
      configuredEnabled: enabled,
      reloadRequired: true,
    })
  })

  it('makes all governance read-only when either write export is missing', async () => {
    const disableExtension = vi.fn(async () => undefined)
    const mod = extensionModule({ enableExtension: undefined, disableExtension })
    const bridge = createButlerBridge({ loadModule: async () => mod })

    const inventory = await bridge.readExtensions()
    const result = await bridge.setExtensionEnabled('third-party/tool', false)

    expect(inventory.status).toBe('ready')
    expect(inventory.governance.writable).toBe(false)
    expect(result).toMatchObject({ ok: false, code: 'read-only' })
    expect(disableExtension).not.toHaveBeenCalled()
  })

  it('returns structured errors for missing extensions and official API failures', async () => {
    const failing = vi.fn(async () => { throw new Error('sensitive remote detail') })
    const bridge = createButlerBridge({
      loadModule: async () => extensionModule({ disableExtension: failing }),
    })

    await expect(bridge.setExtensionEnabled('missing', false)).resolves.toMatchObject({
      ok: false,
      code: 'not-found',
    })
    await expect(bridge.setExtensionEnabled('third-party/tool', false)).resolves.toEqual({
      ok: false,
      code: 'api-error',
      error: 'SillyTavern 扩展接口调用失败',
    })
  })

  it('never edits disabledExtensions directly', async () => {
    const mod = extensionModule()
    const disabled = (mod.extension_settings as { disabledExtensions: string[] }).disabledExtensions
    const bridge = createButlerBridge({ loadModule: async () => mod })

    await bridge.setExtensionEnabled('third-party/tool', true)

    expect(disabled).toEqual(['third-party/tool'])
  })

  it('reads the live disabled list after the official API replaces its array', async () => {
    const mod = extensionModule()
    mod.enableExtension = vi.fn(async (name: string) => {
      const settings = mod.extension_settings as { disabledExtensions: string[] }
      settings.disabledExtensions = settings.disabledExtensions.filter((item) => item !== name)
    })
    const bridge = createButlerBridge({ loadModule: async () => mod })

    await bridge.setExtensionEnabled('third-party/tool', true)
    const inventory = await bridge.readExtensions()

    expect(inventory.disabledExtensions).toEqual([])
    expect(inventory.extensions.find((item) => item.name === 'third-party/tool')?.configuredEnabled).toBe(true)
  })

  it('protects st-stage itself without calling the official disable API', async () => {
    const mod = extensionModule()
    const bridge = createButlerBridge({ loadModule: async () => mod })

    const result = await bridge.setExtensionEnabled('st-stage', false)

    expect(result).toEqual({
      ok: false,
      code: 'protected',
      error: '管家不能禁用 st-stage 自身',
    })
    expect(mod.disableExtension).not.toHaveBeenCalled()
  })
})
