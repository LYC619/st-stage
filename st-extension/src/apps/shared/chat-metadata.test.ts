// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { AppHost } from '../../../../core/phone-registry'
import { readChatMetadata, storyIdentity, writeChatMetadata } from './chat-metadata'

afterEach(() => vi.unstubAllGlobals())
describe('shared chat metadata', () => {
  it('merges one key, saves it and rejects writes after a chat switch', async () => {
    let chatId = 'one'
    const chatMetadata: Record<string, unknown> = { unrelated: { keep: true } }, saveMetadata = vi.fn(async () => {})
    const updateChatMetadata = vi.fn((value: Record<string, unknown>) => Object.assign(chatMetadata, value))
    vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId, chatMetadata, saveMetadata, updateChatMetadata }) })
    const host = { getCharacterName: () => '角色' } as AppHost, key = storyIdentity(host)
    expect(await writeChatMetadata(host, key, 'chronicle', { entries: [] })).toBe(true)
    expect(readChatMetadata('chronicle')).toEqual({ entries: [] }); expect(chatMetadata.unrelated).toEqual({ keep: true })
    expect(updateChatMetadata).toHaveBeenCalledWith({ chronicle: { entries: [] } }, false)
    chatId = 'two'; expect(await writeChatMetadata(host, key, 'chronicle', {})).toBe(false)
    expect(saveMetadata).toHaveBeenCalledOnce()
  })
  it('supports direct metadata mutation when the host has no update helper', async () => {
    const chatMetadata = {}, saveMetadata = vi.fn(async () => {})
    vi.stubGlobal('SillyTavern', { getContext: () => ({ chatId: 'one', chatMetadata, saveMetadata }) })
    const host = { getCharacterName: () => '角色' } as AppHost
    await writeChatMetadata(host, storyIdentity(host), 'test', { v: 1 }); expect(chatMetadata).toEqual({ test: { v: 1 } })
  })
})
