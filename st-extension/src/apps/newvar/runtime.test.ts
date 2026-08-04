// @vitest-environment jsdom

import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PluginSettings } from '../../../../core/types'
import { createNewvarRuntime } from './runtime'
import type { VariableSchema } from './types'

const schema: VariableSchema = {
  id: 'manual-test',
  name: '手动编辑测试',
  version: 1,
  variables: [
    { key: '体力', type: 'number', default: 50, description: '', range: [0, 100] },
    { key: '心情', type: 'enum', default: '平静', description: '', enum: ['开心', '平静'] },
    { key: '在场', type: 'boolean', default: false, description: '' },
    { key: '场景', type: 'string', default: '教室', description: '' },
  ],
}

describe('newvar runtime manual edits', () => {
  let chat: Array<{ mes: string; is_user: boolean; extra?: Record<string, unknown> }>

  beforeEach(() => {
    chat = [{ mes: '楼层', is_user: false }]
    Object.defineProperty(window, 'SillyTavern', {
      configurable: true,
      value: { getContext: () => ({ chat, saveChatDebounced: vi.fn() }) },
    })
  })

  function runtime() {
    const settings = {
      apps: {
        newvar: {
          enabled: true,
          format: 'json_patch',
          injectionDepth: 4,
          schema,
          customTemplates: [],
        },
      },
    } as unknown as PluginSettings
    return createNewvarRuntime({ getSettings: () => settings, inject: vi.fn() })
  }

  it('拒绝类型错误且不写入快照', () => {
    const app = runtime()

    expect(app.setManualValue('体力', '很多')).toEqual({ ok: false, error: expect.stringContaining('数字') })
    expect(app.getCurrentState().体力).toBe(50)
    expect(chat[0].extra).toBeUndefined()
  })

  it('按引擎策略裁剪越界数字并持久化修正值', () => {
    const app = runtime()

    expect(app.setManualValue('体力', 150)).toEqual({ ok: true, value: 100 })
    expect(app.getCurrentState().体力).toBe(100)
  })

  it('拒绝枚举外值、非布尔值和未定义路径', () => {
    const app = runtime()

    expect(app.setManualValue('心情', '暴怒')).toEqual({ ok: false, error: expect.stringContaining('枚举') })
    expect(app.setManualValue('在场', 'true')).toEqual({ ok: false, error: expect.stringContaining('布尔') })
    expect(app.setManualValue('未知', 1)).toEqual({ ok: false, error: expect.stringContaining('未定义') })
    expect(app.getCurrentState()).toEqual({ 体力: 50, 心情: '平静', 在场: false, 场景: '教室' })
    expect(chat[0].extra).toBeUndefined()
  })

  it('接受定义匹配的布尔和文本值', () => {
    const app = runtime()

    expect(app.setManualValue('在场', true)).toEqual({ ok: true, value: true })
    expect(app.setManualValue('场景', '天台')).toEqual({ ok: true, value: '天台' })
    expect(app.getCurrentState()).toMatchObject({ 在场: true, 场景: '天台' })
  })
})
