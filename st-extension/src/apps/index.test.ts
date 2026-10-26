import { describe, expect, it } from 'vitest'
import { createBuiltinApps, type BuiltinAppDeps } from './index'

describe('builtin app assembly', () => {
  it('registers the cloud export app in the built-in app list', () => {
    const deps = {
      previewSpriteOpacity: () => {},
      openGalleryManager: () => {},
      newvarRuntime: {} as BuiltinAppDeps['newvarRuntime'],
      openNewvarDesigner: () => {},
      openApiManager: () => {},
      rendererRuntime: {} as BuiltinAppDeps['rendererRuntime'],
    } satisfies BuiltinAppDeps

    const apps = createBuiltinApps(deps)

    expect(apps.map((app) => app.id)).toContain('cloud-export')
    expect(apps.map((app) => app.id)).toContain('wechat-sister')
    expect(apps.find((app) => app.id === 'wechat-sister')).toMatchObject({
      name: '微信',
      icon: '💬',
      order: 25,
      fullbleed: true,
    })
    expect(apps.find((app) => app.id === 'cloud-export')).toMatchObject({
      name: '导出',
      icon: '📦',
      order: 15,
    })
  })
})
