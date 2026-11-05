import type { ParsedRendererBlock } from './parser'
import type { ComposerInsertResult } from './composer'
import { stableCharacterKey } from '../../../../core/character-identity'
import { t } from '../../../../core/i18n'
import { readChoiceHostContext } from './bridge'
export const CARD_CHOICES_APP_ID = 'renderer-choices'
export interface CardChoiceMemory { read(): string | null; write(id: string | null): ComposerInsertResult; isCurrent(): boolean }
export interface ChoiceHostContext { characterId?: string | number; characters?: { avatar?: string }[]; groupId?: string | number; chatId?: string | number; chat?: { mes: string; send_date?: string | number; swipe_id?: number }[] }
export interface ChoiceHistory { version: 1; entries: { key: string; cardId: string }[] }
export function normalizeChoiceHistory(raw: unknown): ChoiceHistory {
  const value = raw as Partial<ChoiceHistory> | null
  if (value?.version !== 1 || !Array.isArray(value.entries)) return { version: 1, entries: [] }
  const entries = new Map<string, { key: string; cardId: string }>()
  for (const item of value.entries.slice(-1000)) {
    if (!item || typeof item !== 'object' || typeof item.key !== 'string' || !item.key || item.key.length > 2048
      || typeof item.cardId !== 'string' || !item.cardId || item.cardId.length > 100) continue
    entries.delete(item.key); entries.set(item.key, { key: item.key, cardId: item.cardId })
  }
  return { version: 1, entries: [...entries.values()].slice(-200) }
}
/** Two independent 32-bit content fingerprints plus length; never persist transcript text. */
function fingerprint(text: string): string {
  let a = 0x811c9dc5, b = 0x9e3779b9
  for (let i = 0; i < text.length; i++) { a = Math.imul(a ^ text.charCodeAt(i), 0x01000193); b = Math.imul(b ^ text.charCodeAt(i), 0x85ebca6b) }
  return `${text.length.toString(36)}-${(a >>> 0).toString(36)}-${(b >>> 0).toString(36)}`
}
export function createChoicePersistence(deps: { getContext?: () => ChoiceHostContext | undefined; getData: () => unknown; setData: (data: ChoiceHistory) => void }) {
  const context = deps.getContext ?? readChoiceHostContext
  function keyFor(root: HTMLElement, parsed: ParsedRendererBlock, index: number): string | null {
    try {
      const st = context(), id = root.closest('.mes')?.getAttribute('mesid')
      if (!st || !id || !/^\d+$/.test(id) || st.chatId === undefined || st.chatId === null || String(st.chatId) === '') return null
      const message = st.chat?.[Number(id)]
      // Timestamp + native index distinguish identical messages. No timestamp means no reliable persistence.
      if (!message || typeof message.mes !== 'string' || !message.mes.includes(parsed.raw)
        || !['string', 'number'].includes(typeof message.send_date)) return null
      const card = st.characterId !== undefined && st.characterId !== null && String(st.characterId) !== '' ? st.characters?.[Number(st.characterId)] : undefined
      const scope = st.groupId !== undefined && st.groupId !== null && String(st.groupId) !== ''
        ? `group:${st.groupId}` : stableCharacterKey(card)
      if (!scope) return null
      const key = JSON.stringify([scope, String(st.chatId), id, message.send_date, message.swipe_id ?? 0, fingerprint(message.mes), index, fingerprint(parsed.raw)])
      return key.length <= 2048 ? key : null
    } catch { return null }
  }
  return {
    forBlock(root: HTMLElement, parsed: ParsedRendererBlock, index: number): CardChoiceMemory | undefined {
      if (parsed.block.mode !== 'cards') return undefined
      const key = keyFor(root, parsed, index)
      if (!key) return undefined
      const ids = new Set(parsed.block.cards.map(card => card.id))
      const valid = () => root.isConnected && keyFor(root, parsed, index) === key
      return {
        isCurrent: valid,
        read() {
          if (!valid()) return null
          const id = normalizeChoiceHistory(deps.getData()).entries.find(item => item.key === key)?.cardId
          return id && ids.has(id) ? id : null
        },
        write(id) {
          if (!valid() || (id !== null && !ids.has(id))) return { ok: false, error: t('cardChoices.stale', '聊天或消息已变化，请重新打开当前消息。') }
          try {
            const entries = normalizeChoiceHistory(deps.getData()).entries.filter(item => item.key !== key)
            if (id !== null) entries.push({ key, cardId: id })
            deps.setData({ version: 1, entries: entries.slice(-200) })
            return { ok: true }
          } catch { return { ok: false, error: t('cardChoices.saveFailed', '保存选择失败，请稍后重试。') } }
        },
      }
    },
  }
}
