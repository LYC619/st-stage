/**
 * 微信资源路径解析器：统一适配 SillyTavern 扩展安装与 Web 预览环境
 */

export function resolveWeChatAssetUrl(subpath: string): string {
  if (!subpath) return ''
  if (/^(?:https?:|data:)/.test(subpath)) return subpath

  let clean = subpath.replace(/^\/+/, '')
  if (clean.startsWith('assets/wechat/')) {
    clean = clean.slice('assets/wechat/'.length)
  }

  // 1. 如果在 SillyTavern 扩展 bundle 环境运行（import.meta.url）
  try {
    if (typeof import.meta !== 'undefined' && import.meta.url) {
      const url = new URL(import.meta.url)
      if (url.protocol === 'http:' || url.protocol === 'https:') {
        const baseDir = url.pathname.replace(/\/[^/]*$/, '')
        return `${baseDir}/assets/wechat/${clean}`
      }
    }
  } catch {}

  // 2. Next.js 网页预览 / 测试环境默认静态路径
  return `/assets/wechat/${clean}`
}
