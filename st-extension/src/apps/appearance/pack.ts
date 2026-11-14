// Appearance data flow follows 玉子手机 modules/settings-app/services/appearance-settings/.
import type { PhoneAppearance } from '../../../../core/phone-shell'
export type AppearanceData = PhoneAppearance

const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''

function imageAddress(value: string): boolean {
  if (!value || /^\/(?!\/)/.test(value)) return true
  try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' } catch { return false }
}
function fontAddress(value: string): boolean {
  try { return new URL(value).protocol === 'https:' && value.startsWith('https://') } catch { return false }
}
export function imageUrl(value: string): string {
  const url = value.trim()
  if (!imageAddress(url)) throw new Error('请填写图片网址，或通过「上传图片」保存图片。')
  return url
}
export function fontUrl(value: string): string {
  const url = value.trim()
  if (!fontAddress(url)) throw new Error('字体 CSS 网址必须使用 https://。')
  return url
}

/** Read persisted settings permissively; user imports reject unsupported resource URLs. */
function normalize(value: unknown, strict: boolean, appIds?: string[]): AppearanceData {
  const raw = record(value), wallpaper = str(raw.wallpaper), validWallpaper = imageAddress(wallpaper)
  if (strict && !validWallpaper) throw new Error('外观包的图片必须是网址，请先上传图片。')
  const icons: AppearanceData['icons'] = Object.fromEntries(Object.entries(record(raw.icons)).flatMap(([id, value]) => {
    if (appIds && !appIds.includes(id)) return []
    const row = record(value), emoji = str(row.emoji), image = str(row.image)
    const validImage = imageAddress(image)
    if (strict && !validImage) throw new Error('外观包的图片必须是网址，请先上传图片。')
    return [[id, { ...(emoji ? { emoji } : {}), ...(image && validImage ? { image } : {}) }]]
  }))
  const fonts = (Array.isArray(raw.fonts) ? raw.fonts : []).flatMap(value => {
    const row = record(value), name = str(row.name), family = str(row.family), cssUrl = str(row.cssUrl)
    const validFont = fontAddress(cssUrl)
    if (strict && !validFont) throw new Error('字体 CSS 网址必须使用 https://。')
    return name && family && validFont ? [{ name, family, cssUrl }] : []
  })
  return { wallpaper: validWallpaper ? wallpaper : '', icons, fonts,
    activeFont: fonts.some(font => font.name === raw.activeFont) ? str(raw.activeFont) : '' }
}
export function readAppearance(value: unknown): AppearanceData { return normalize(value, false) }
export function exportAppearance(data: AppearanceData): string { return JSON.stringify(data, null, 2) }
export function importAppearance(text: string, appIds: string[]): AppearanceData {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('外观包不是有效的 JSON。') }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('外观包格式不对。')
  return normalize(raw, true, appIds)
}
