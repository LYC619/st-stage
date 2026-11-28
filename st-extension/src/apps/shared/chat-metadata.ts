import type { AppHost } from '../../../../core/phone-registry'
import { stableCharacterKey } from '../../../../core/character-identity'
import { getWeChatHostContext } from '../wechat/bridge'

export class StorySwitchedError extends Error {
  constructor(message = '聊天已切换。') {
    super(message)
    this.name = 'StorySwitchedError'
  }
}

export function isStorySwitchedError(error: unknown): boolean {
  return error instanceof StorySwitchedError || (error instanceof Error && error.name === 'StorySwitchedError')
}

export interface MetadataContext {
  name1?: string; chatMetadata?: Record<string, unknown>; getCurrentChatId?: () => string | number | undefined
  chatId?: string | number
  updateChatMetadata?: (entry: Record<string, unknown>, reset: boolean) => void
  saveMetadata?: () => Promise<unknown>
}
export function metadataContext(): MetadataContext { return (getWeChatHostContext() as MetadataContext | undefined) ?? {} }

export function storyIdentity(host: AppHost): string {
  const native = metadataContext(), context = host.getChatContext?.()
  const currentId = typeof native.getCurrentChatId === 'function' ? native.getCurrentChatId() : undefined
  const id = String(currentId ?? context?.chatId ?? native.chatId ?? '')
  return `${stableCharacterKey(host.getCharacterCard?.()) ?? host.getCharacterName()}::${id}`
}

export function readChatMetadata(key: string): unknown { return metadataContext().chatMetadata?.[key] }

export async function writeChatMetadata(host: AppHost, expectedStoryKey: string, key: string, value: unknown): Promise<boolean> {
  if (expectedStoryKey !== storyIdentity(host)) return false
  const context = metadataContext(), chatId = context.getCurrentChatId?.() ?? context.chatId ?? host.getChatContext?.()?.chatId
  if (chatId === undefined || chatId === '') throw new Error('请先打开一个主聊天。')
  if (typeof context.saveMetadata !== 'function') throw new Error('当前聊天无法保存状态。')
  const entry = { [key]: value }
  if (typeof context.updateChatMetadata === 'function') context.updateChatMetadata(entry, false)
  else if (context.chatMetadata && typeof context.chatMetadata === 'object') Object.assign(context.chatMetadata, entry)
  else throw new Error('当前聊天无法保存状态。')
  await context.saveMetadata()
  return true
}
