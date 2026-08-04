import { describe, expect, it } from 'vitest'
import { defaultRendererSettings, normalizeRendererSettings } from './config'

describe('normalizeRendererSettings', () => {
  it('空值和损坏输入回退为默认配置', () => {
    expect(normalizeRendererSettings(undefined)).toEqual(defaultRendererSettings())
    expect(normalizeRendererSettings('bad')).toEqual(defaultRendererSettings())
  })

  it('默认关闭总开关并启用三种模式', () => {
    expect(defaultRendererSettings()).toEqual({
      enabled: false,
      galEnabled: true,
      cardsEnabled: true,
      battleEnabled: true,
      injectionDepth: 4,
      typewriter: true,
      reducedMotion: false,
    })
  })

  it('保留合法布尔值和注入深度', () => {
    expect(normalizeRendererSettings({
      enabled: true,
      galEnabled: false,
      cardsEnabled: false,
      battleEnabled: true,
      injectionDepth: 12,
      typewriter: false,
      reducedMotion: true,
    })).toEqual({
      enabled: true,
      galEnabled: false,
      cardsEnabled: false,
      battleEnabled: true,
      injectionDepth: 12,
      typewriter: false,
      reducedMotion: true,
    })
  })

  it('忽略错误类型并把整数深度限制在 0-20', () => {
    expect(normalizeRendererSettings({ enabled: 'yes', injectionDepth: -10 })).toMatchObject({
      enabled: false,
      injectionDepth: 0,
    })
    expect(normalizeRendererSettings({ injectionDepth: 99 })).toMatchObject({ injectionDepth: 20 })
    expect(normalizeRendererSettings({ injectionDepth: 3.5 })).toMatchObject({ injectionDepth: 4 })
  })
})
