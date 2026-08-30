// @vitest-environment jsdom

/**
 * 改名安装后的自我保护回归。
 *
 * 上面那些单测只证明 matchesSelf 的算法对；这个文件证明**调用点真的走了运行时目录名**。
 * 用 vi.mock 把 self-identity 换成"装在 st-butler 目录下"的样子，然后要求：
 * 新名字受保护、旧字面量 st-stage 不再受保护。
 *
 * 单独一个文件是必要的：vi.mock 作用于整个模块图，和 bridge.test.ts 里
 * 按兜底名跑的那些用例混在一起会互相干扰。
 */

import { describe, expect, it, vi } from 'vitest'

const RENAMED = 'st-butler'

vi.mock('./self-identity', () => {
  const names = (dir: string) => (dir.includes('/') ? [dir] : [dir, `third-party/${dir}`])
  const matches = (name: string, dir: string) =>
    names(dir).some((c) => c.toLowerCase() === name?.trim().toLowerCase())
  return {
    FALLBACK_DIRECTORY_NAME: 'st-stage',
    SELF_DIRECTORY_NAME: RENAMED,
    installDirectoryName: () => RENAMED,
    selfExtensionNames: names,
    matchesSelf: matches,
    isSelfExtensionName: (name: string) => matches(name, RENAMED),
  }
})

const { createButlerBridge } = await import('./bridge')
const { applyDesiredDisabledExtensions } = await import('./experiments')

/** 形状照抄 bridge.test.ts 的 fake，只把自己的目录名换成改名后的那个。 */
function extensionModule(selfName = `third-party/${RENAMED}`): Record<string, unknown> {
  const manifests: Record<string, unknown> = {
    expressions: { display_name: 'Expressions', dependencies: [] },
    [selfName]: { display_name: 'Butler', dependencies: [] },
  }
  const disabledExtensions: string[] = []
  return {
    extensionNames: ['expressions', selfName],
    extensionTypes: { expressions: 'system', [selfName]: 'local' },
    extension_settings: { disabledExtensions },
    findExtension: vi.fn((name: string) => (
      manifests[name] ? { name, enabled: !disabledExtensions.includes(name) } : null
    )),
    getExtensionManifest: vi.fn((name: string) => manifests[name] ?? null),
    enableExtension: vi.fn(async () => undefined),
    disableExtension: vi.fn(async () => undefined),
  }
}

describe('自我保护跟随运行时目录名', () => {
  it('装在改名目录下时，保护的是新名字', async () => {
    const mod = extensionModule()
    const bridge = createButlerBridge({ loadModule: async () => mod })

    const result = await bridge.setExtensionEnabled(`third-party/${RENAMED}`, false)

    expect(result).toMatchObject({ ok: false, code: 'protected' })
    // 提示语也报实际目录名，不是写死的 st-stage
    expect((result as { error: string }).error).toContain(RENAMED)
    expect((result as { error: string }).error).not.toContain('st-stage')
    expect(mod.disableExtension).not.toHaveBeenCalled()
  })

  it('改名后不再把旧字面量 st-stage 当成自己', async () => {
    // 必须让 fake 真的认识 third-party/st-stage，否则会先在 findExtension 里
    // 返回 not-found，根本走不到自我判断那一步——那样这条断言就是空的。
    const mod = extensionModule('third-party/st-stage')
    const bridge = createButlerBridge({ loadModule: async () => mod })

    const result = await bridge.setExtensionEnabled('third-party/st-stage', false)

    // 关键点：把保护挂在错误的扩展上，等于既不保护自己又误伤别人
    expect((result as { code?: string }).code).not.toBe('protected')
    expect(result.ok).toBe(true)
    expect(mod.disableExtension).toHaveBeenCalled()
  })

  it('批量禁用时同样按运行时名字拦下自己', async () => {
    const names = [`third-party/${RENAMED}`, 'third-party/a']
    const setExtensionEnabled = vi.fn(async (name: string) => ({
      ok: true as const, name, configuredEnabled: false, reloadRequired: true as const,
    }))
    const deps = {
      readExtensions: vi.fn(async () => ({
        status: 'ready' as const,
        governance: { writable: true },
        disabledExtensions: [] as string[],
        extensions: names.map((name) => ({
          name,
          type: 'local',
          configuredEnabled: true,
          // isSelf 由 experiments.ts 内部按运行时目录名判定，这里给 false 更严格：
          // 就算清单说"不是自己"，也必须被拦下
          isSelf: false,
          manifest: {
            dependencies: { status: 'valid' as const, names: [] },
            requiredModules: { status: 'absent' as const, names: [] },
          },
        })),
      })),
      setExtensionEnabled,
      persistExperiment: vi.fn(async () => undefined),
      reloadPage: vi.fn(),
      readBackup: vi.fn(() => null),
      writeBackup: vi.fn(),
      clearBackup: vi.fn(),
    }

    const result = await applyDesiredDisabledExtensions(
      names,
      deps as unknown as Parameters<typeof applyDesiredDisabledExtensions>[1],
    )

    expect(result.ok).toBe(false)
    expect(result.failed[0]).toMatchObject({ name: `third-party/${RENAMED}` })
    expect(result.failed[0].error).toContain(RENAMED)
    expect(setExtensionEnabled).not.toHaveBeenCalledWith(`third-party/${RENAMED}`, expect.anything())
  })
})
