import { describe, expect, it } from 'vitest'
import { createDefaultSettings } from '../../core/types'
import { buildRoleSummary } from './role-summary'

describe('current role overview', () => {
  it('shows no role actions when there is no selected character', () => {
    expect(buildRoleSummary(createDefaultSettings(), '', '', 'unavailable').rows).toEqual([])
  })
  it('distinguishes disabled bindings, missing definitions, and local WeChat replies', () => {
    const settings = createDefaultSettings()
    settings.packs = [{ id: 'one', name: 'One', sprites: [{ tag: 'smile', url: '/img/a.png' }] }]
    settings.bindings = [{ characterName: 'Alice', packIds: ['one'], enabled: false }]
    settings.apps.newvar = { enabled: true }
    const result = buildRoleSummary(settings, 'Alice', 'Chat A', 'helper')
    const row = (id: string) => result.rows.find(row => row.id === id)!.value
    expect(row('gallery')).toContain('1')
    expect(row('gallery')).toContain('已关闭')
    expect(row('sprites')).toContain('待启用')
    expect(row('newvar')).toContain('尚未定义')
    expect(row('mvu')).toContain('酒馆助手')
    expect(row('wechat')).toContain('本地回复')
    expect(buildRoleSummary(settings, 'Bob', 'Chat B', 'empty').rows[0].value).toContain('尚未绑定')
  })
  it('does not expose a configured key or claim connection verification', () => {
    const settings = createDefaultSettings()
    settings.apps['wechat-sister'] = { config: { apiKey: 'synthetic-private-key' } }
    const result = buildRoleSummary(settings, 'Alice', 'Chat', 'unavailable')
    expect(JSON.stringify(result)).not.toContain('synthetic-private-key')
    expect(result.rows.find(row => row.id === 'wechat')!.value).toContain('未验证')
  })
})
