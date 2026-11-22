// Appearance data flow follows 玉子手机 modules/settings-app/services/appearance-settings/.
import type { PhoneAppearance, PhoneThemeId } from '../../../../core/phone-shell'
export type AppearanceData = PhoneAppearance

export const PHONE_THEMES: ReadonlyArray<{ id: PhoneThemeId; label: string; desc: string }> = [
  { id: 'midnight', label: '暗夜墨玉', desc: '深邃沉稳，适合夜读与微光场景' },
  { id: 'tavern', label: '酒馆暖灯', desc: '琥珀壁炉暖调，浸润木吧台气息' },
  { id: 'parchment', label: '羊皮书页', desc: '温润米金护眼纸感，契合奇幻手记' },
  { id: 'aurora', label: '雾凇极光', desc: '清冷青蓝流光，契合都市与科幻' },
  { id: 'daylight', label: '清透白昼', desc: '明净通透浅色毛玻璃，日光感十足' },
]

const THEME_IDS = new Set<string>(PHONE_THEMES.map(item => item.id))
const record = (value: unknown): Record<string, unknown> => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}
const str = (value: unknown) => typeof value === 'string' ? value.trim() : ''
const clampNum = (value: unknown, min: number, max: number): number =>
  typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, Math.round(value))) : 0

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

/** Read persisted settings permissively; omit default optional keys so legacy 4-key exports stay compact. */
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
  const rawTheme = str(raw.theme)
  const theme = THEME_IDS.has(rawTheme) && rawTheme !== 'midnight' ? (rawTheme as PhoneThemeId) : undefined
  const wallpaperDim = clampNum(raw.wallpaperDim, 0, 75)
  const wallpaperBlur = clampNum(raw.wallpaperBlur, 0, 20)

  const characterSkins: NonNullable<AppearanceData['characterSkins']> = {}
  for (const [charName, skinVal] of Object.entries(record(raw.characterSkins))) {
    const cleanName = charName.trim()
    if (!cleanName) continue
    const sRow = record(skinVal)
    const sThemeRaw = str(sRow.theme)
    const sTheme = THEME_IDS.has(sThemeRaw) ? (sThemeRaw as PhoneThemeId) : undefined
    const sWall = str(sRow.wallpaper)
    const sValidWall = imageAddress(sWall)
    if (strict && !sValidWall) throw new Error('外观包的图片必须是网址，请先上传图片。')
    if (sTheme || (sWall && sValidWall)) {
      characterSkins[cleanName] = {
        ...(sTheme ? { theme: sTheme } : {}),
        ...(sWall && sValidWall ? { wallpaper: sWall } : {}),
      }
    }
  }

  return {
    wallpaper: validWallpaper ? wallpaper : '',
    icons,
    fonts,
    activeFont: fonts.some(font => font.name === raw.activeFont) ? str(raw.activeFont) : '',
    ...(theme ? { theme } : {}),
    ...(wallpaperDim > 0 ? { wallpaperDim } : {}),
    ...(wallpaperBlur > 0 ? { wallpaperBlur } : {}),
    ...(Object.keys(characterSkins).length ? { characterSkins } : {}),
  }
}

export function readAppearance(value: unknown): AppearanceData { return normalize(value, false) }

/** 根据当前角色名称合成最终生效的手机外观（角色专属皮肤优先于全局默认）。 */
export function resolveEffectiveAppearance(data: AppearanceData, characterName = ''): AppearanceData {
  const skin = characterName.trim() ? data.characterSkins?.[characterName.trim()] : undefined
  if (!skin) return data
  return {
    ...data,
    ...(skin.wallpaper !== undefined ? { wallpaper: skin.wallpaper } : {}),
    ...(skin.theme ? { theme: skin.theme } : {}),
  }
}

export function exportAppearance(data: AppearanceData): string { return JSON.stringify(data, null, 2) }

export function importAppearance(text: string, appIds: string[]): AppearanceData {
  let raw: unknown
  try { raw = JSON.parse(text) } catch { throw new Error('外观包不是有效的 JSON。') }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('外观包格式不对。')
  return normalize(raw, true, appIds)
}
