/**
 * 云端图床直传（catbox.moe）。
 * 浏览器直传可能被 CORS/风控拦截，调用方需捕获错误并降级到「手动粘贴编号」通道。
 */

const CATBOX_API = 'https://catbox.moe/user/api.php'

/**
 * 上传文件到 catbox.moe，成功返回图床文件编号（如 "abc123.png"）。
 * 失败抛出 Error（网络失败 / CORS / 图床拒绝）。
 */
export async function uploadToCatbox(file: File | Blob, fileName?: string): Promise<string> {
  const form = new FormData()
  form.append('reqtype', 'fileupload')
  form.append('fileToUpload', file, fileName ?? (file instanceof File ? file.name : 'upload.png'))

  const res = await fetch(CATBOX_API, { method: 'POST', body: form })
  if (!res.ok) throw new Error(`图床返回错误：HTTP ${res.status}`)
  const text = (await res.text()).trim()
  // 成功时返回完整 URL：https://files.catbox.moe/xxxxx.png
  const match = text.match(/^https:\/\/files\.catbox\.moe\/(\S+)$/)
  if (!match) throw new Error(`图床返回异常：${text.slice(0, 120)}`)
  return match[1]
}

/**
 * 解析「手动批量添加」文本：每行 `标签=编号` 或 `标签 编号`。
 * 返回 { label, ref } 列表；忽略空行和非法行。
 */
export function parseManualEntries(text: string): Array<{ label: string; ref: string }> {
  const out: Array<{ label: string; ref: string }> = []
  for (const line of text.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(.+?)[=\s]+(\S+)$/)
    if (!m) continue
    const label = m[1].trim()
    // 允许粘贴完整 URL，自动截取文件编号
    const ref = m[2].replace(/^https?:\/\/[^/]+\//, '')
    if (label && ref) out.push({ label, ref })
  }
  return out
}
