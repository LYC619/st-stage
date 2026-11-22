import { findComposerTextarea } from '../../st-adapter'

export type ComposerInsertResult =
  | { ok: true }
  | { ok: false; error: string }

export interface ComposerBridge {
  insertDraft(text: string): ComposerInsertResult
  /** 无损追加到输入框末尾（已有内容时换行衔接，绝不覆盖用户文字）。 */
  appendDraft(text: string): ComposerInsertResult
  dispose(): void
}

export interface ComposerBridgeDeps {
  findInput?: () => HTMLTextAreaElement | HTMLInputElement | null
}

interface OwnedDraft {
  input: HTMLTextAreaElement | HTMLInputElement
  value: string
}

function setNativeInputValue(el: HTMLTextAreaElement | HTMLInputElement, next: string): void {
  const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype
  const setter = Object.getOwnPropertyDescriptor(proto, 'value')?.set
  if (setter) setter.call(el, next)
  else el.value = next
}

/** 创建只在百工仍拥有草稿时允许替换、同时支持无损追加的输入框桥接器。 */
export function createComposerBridge(deps: ComposerBridgeDeps = {}): ComposerBridge {
  const findInput = deps.findInput ?? (() => findComposerTextarea())
  let owned: OwnedDraft | null = null

  /** 写入草稿但绝不触发发送；任何用户已有/已修改文本都保持原样。 */
  function insertDraft(text: string): ComposerInsertResult {
    const input = findInput()
    if (!input) return { ok: false, error: '未找到聊天输入框。' }
    if (owned?.input === input) {
      if (input.value === '') owned = null
      else if (input.value !== owned.value) return { ok: false, error: '输入框草稿已修改，未覆盖你的内容。' }
    } else {
      owned = null
      if (input.value !== '') return { ok: false, error: '输入框已有草稿，未覆盖你的内容。' }
    }
    setNativeInputValue(input, text)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
    owned = { input, value: text }
    return { ok: true }
  }

  /** 将文本无损追加到当前草稿末尾，保留用户已写的每一个字。 */
  function appendDraft(text: string): ComposerInsertResult {
    const input = findInput()
    if (!input) return { ok: false, error: '未找到聊天输入框。' }
    const clean = text.trim()
    if (!clean) return { ok: true }
    const current = input.value
    const separator = !current || /[\s\n]$/.test(current) ? '' : '\n'
    const next = current ? `${current}${separator}${clean}` : clean
    const wasOwned = !current || (owned?.input === input && owned.value === current)
    setNativeInputValue(input, next)
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
    owned = wasOwned ? { input, value: next } : null
    return { ok: true }
  }

  /** 释放所有权标记，不清空用户输入。 */
  function dispose(): void {
    owned = null
  }

  return { insertDraft, appendDraft, dispose }
}
