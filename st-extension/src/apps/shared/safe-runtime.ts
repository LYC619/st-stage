/**
 * 兼容局域网非 HTTPS（如 http://192.168.x.x:8000）的浏览器安全运行时工具。
 * crypto.randomUUID 与 navigator.clipboard 在非安全上下文可能不可用，此处统一降级。
 */

export function safeRandomId(prefix = ''): string {
  const uuid = typeof globalThis.crypto?.randomUUID === 'function'
    ? globalThis.crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}-${Math.random().toString(36).slice(2, 6)}`
  return prefix ? `${prefix}${uuid}` : uuid
}

export async function safeCopyText(value: string): Promise<boolean> {
  try {
    if (typeof navigator !== 'undefined' && typeof navigator.clipboard?.writeText === 'function') {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch (err) {
    console.warn('[st-stage] navigator.clipboard 写入失败，尝试降级复制', err)
  }

  if (typeof document === 'undefined' || !document.body) return false
  try {
    const textarea = document.createElement('textarea')
    textarea.value = value
    textarea.setAttribute('readonly', '')
    textarea.style.cssText = 'position:fixed;left:-9999px;top:0;opacity:0;pointer-events:none;'
    document.body.append(textarea)
    textarea.select()
    const copied = typeof document.execCommand === 'function' && document.execCommand('copy')
    textarea.remove()
    return Boolean(copied)
  } catch (err) {
    console.warn('[st-stage] 剪贴板降级复制失败', err)
    return false
  }
}
