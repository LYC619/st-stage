/**
 * imgbb 图床浏览器直传（功能①）。
 *
 * 为什么用 imgbb 而不是 catbox：imgbb 的 /1/upload 接口返回 CORS 头，
 * 浏览器可直接 POST；catbox 不带 CORS，只能服务端代理，故 catbox 保留给
 * 「按编码手动添加」与分享串（stpack1）编解码，两个图床并存互不影响。
 *
 * 纯逻辑（fetch 可注入），便于在 node 测试环境用假 fetch 覆盖成功/失败路径。
 * API Key 仅由调用方从本地设置读取传入，本模块不接触任何持久化。
 */

/** 上传结果：url = imgbb 直链；code = imgbb 分配的文件名（response.data.image.filename） */
export interface ImgbbResult {
  url: string
  code: string
}

/**
 * 直传一张图到 imgbb，返回直链与编号。
 * @param apiKey   imgbb API Key（本地设置，永久有效，无过期）
 * @param base64DataUri  data:image/...;base64,xxx 或裸 base64（自动剥前缀）
 * @param fetchImpl 可注入的 fetch（测试用），默认全局 fetch
 * 失败（无 Key / 网络 / imgbb 返回 success:false）时抛出带中文说明的 Error。
 */
export async function uploadToImgbb(
  apiKey: string,
  base64DataUri: string,
  fetchImpl: typeof fetch = fetch,
): Promise<ImgbbResult> {
  const key = apiKey.trim()
  if (!key) throw new Error('未配置 imgbb API Key')

  // imgbb 的 image 字段要裸 base64，剥掉可能的 data:...;base64, 前缀
  const rawBase64 = base64DataUri.replace(/^data:[^;]*;base64,/, '')

  const form = new FormData()
  form.append('key', key)
  form.append('image', rawBase64)

  const res = await fetchImpl('https://api.imgbb.com/1/upload', { method: 'POST', body: form })
  const json = (await res.json().catch(() => null)) as {
    success?: boolean
    data?: { url?: string; image?: { filename?: string } }
    error?: { message?: string }
  } | null

  if (!json?.success || !json.data?.image) {
    throw new Error(`imgbb 上传失败：${json?.error?.message ?? `HTTP ${res.status}`}`)
  }
  return { url: json.data.url ?? '', code: json.data.image.filename ?? '' }
}
