// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as library from './profile-library'
import { normalizeProfile } from './profile'
import type { WeChatConfig } from './types'

describe('WeChat character profile library', () => {
  it('uses avatar identity and refuses unstable numeric IDs and display names', () => {
    expect(library.profileCharacterKey({ avatar: 'Alice.png' })).toBe('avatar:Alice.png')
    expect(library.profileCharacterKey({ avatar: '../Alice.png' })).toBeNull()
    expect(library.profileCharacterKey({ name: 'Alice' })).toBeNull()
  })
  it('retains the legacy default, isolates same-name cards and shares a role profile across chats', () => {
    const old: WeChatConfig = { apiKey: 'PRIVATE', profile: { contactName: 'Default', contextMessageCount: 2 } }
    const custom = normalizeProfile({ profile: { preset: 'general', contactName: 'One', contextMessageCount: 0 } })
    const next = library.saveScopedProfile(old, 'avatar:one.png', custom)
    expect(library.resolveProfile(next, 'avatar:one.png')).toEqual(custom)
    expect(library.resolveProfile(next, 'avatar:two.png').contactName).toBe('Default')
    expect(old).toEqual({ apiKey: 'PRIVATE', profile: { contactName: 'Default', contextMessageCount: 2 } })
    expect(next.apiKey).toBe('PRIVATE')
    const changedDefault = library.saveScopedProfile(next, null, normalizeProfile({ profile: { contactName: 'New default' } }))
    expect(library.resolveProfile(changedDefault, 'avatar:one.png').contactName).toBe('One')
    expect(library.resolveProfile(library.inheritProfile(changedDefault, 'avatar:one.png'), 'avatar:one.png').contactName).toBe('New default')
  })
  it('ignores malformed overrides and prototype properties', () => {
    const config = { profile: { contactName: 'Default' }, characterProfiles: Object.create({ 'avatar:one.png': { contactName: 'Wrong' } }) }
    expect(library.resolveProfile(config, 'avatar:one.png').contactName).toBe('Default')
    expect(library.resolveProfile({ ...config, characterProfiles: { 'avatar:one.png': [] } } as unknown as WeChatConfig, 'avatar:one.png').contactName).toBe('Default')
  })
  it('exports only normalized scene fields, never connection settings or messages', () => {
    const profile = { ...normalizeProfile({ profile: { contactName: 'Alice' } }), apiKey: 'PRIVATE', messages: [{ content: 'PRIVATE CHAT' }] }
    const encoded = library.encodeProfileTemplate('My template', profile)
    expect(encoded).not.toContain('PRIVATE')
    const decoded = library.decodeProfileTemplate(encoded)
    expect(decoded.name).toBe('My template')
    expect(decoded.profile).toEqual(normalizeProfile({ profile: { contactName: 'Alice' } }))
  })
  it('rejects wrong formats, oversized input, unsafe fields and invalid values instead of silently importing', () => {
    const good = JSON.parse(library.encodeProfileTemplate('Safe', normalizeProfile()))
    for (const value of [
      { ...good, format: 'other' }, { ...good, version: 99 },
      { ...good, profile: { ...good.profile, apiKey: 'secret' } },
      { ...good, profile: { ...good.profile, contextMessageCount: -1 } },
      { ...good, profile: { ...good.profile, mappings: { mood: '__proto__.score' } } },
      { ...good, profile: { ...good.profile, assetOverrides: { 'player.angry': 'javascript:alert(1)' } } },
    ]) expect(() => library.decodeProfileTemplate(JSON.stringify(value))).toThrow()
    expect(() => library.decodeProfileTemplate(' '.repeat(100_000))).toThrow()
  })
  it('adds independent templates with bounded names and explicit duplicate-name errors', () => {
    const profile = normalizeProfile({ profile: { preset: 'general' } })
    const first = library.addProfileTemplate([], 'General', profile)
    expect(first).toHaveLength(1)
    expect(() => library.addProfileTemplate(first, 'General', profile)).toThrow()
    const next = library.addProfileTemplate(first, 'Other', profile)
    expect(next[0].id).not.toBe(next[1].id)
    profile.contactName = 'Changed'
    expect(next[1].profile.contactName).toBe('')
    expect(library.normalizeTemplates([{ ...next[0] }, null, { ...next[1], id: next[0].id }])).toHaveLength(1)
  })
})
