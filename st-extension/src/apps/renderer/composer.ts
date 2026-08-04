import { findComposerTextarea } from '../../st-adapter'

export type ComposerInsertResult =
  | { ok: true }
  | { ok: false; error: string }

export interface ComposerBridge {
  insertDraft(text: string): ComposerInsertResult
  dispose(): void
}

export interface ComposerBridgeDeps {
  findInput?: () => HTMLTextAreaElement | null
}

interface OwnedDraft {
  input: HTMLTextAreaElement
  value: string
}

/** 创建只在 renderer 仍拥有草稿时允许替换的 ST 输入框桥接器。 */
export function createComposerBridge(deps: ComposerBridgeDeps = {}): ComposerBridge {
  const findInput = deps.findInput ?? (() => findComposerTextarea())
  let owned: OwnedDraft | null = null

  /** 写入草稿但绝不触发发送；任何用户已有/已修改文本都保持原样。 */
  function insertDraft(text: string): ComposerInsertResult {
    const input = findInput()
    if (!input) return { ok: false, error: '未找到 SillyTavern 输入框。' }
    if (owned?.input === input) {
      if (input.value === '') owned = null
      else if (input.value !== owned.value) return { ok: false, error: '输入草稿已修改，未覆盖你的内容。' }
    } else {
      owned = null
      if (input.value !== '') return { ok: false, error: '输入框已有草稿，未覆盖你的内容。' }
    }
    input.value = text
    input.dispatchEvent(new Event('input', { bubbles: true }))
    input.focus()
    owned = { input, value: text }
    return { ok: true }
  }

  /** 释放所有权标记，不清空用户输入。 */
  function dispose(): void {
    owned = null
  }

  return { insertDraft, dispose }
}
