/**
 * 轻量国际化运行时
 *
 * 不依赖第三方库，适配 ST 宿主环境和原生 DOM 代码。
 * 支持嵌套键、缺失键回退、运行时切换语言。
 */

export type Locale = 'zh-CN' | 'en-US'

export interface I18nDict {
  [key: string]: string | I18nDict
}

export type I18nParams = Record<string, string | number>

/** JSON 词典只接受嵌套对象和字符串，避免无效数据进入运行时。 */
export function isI18nDict(value: unknown): value is I18nDict {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) return false
  const prototype = Object.getPrototypeOf(value)
  if (prototype !== Object.prototype && prototype !== null) return false
  return Object.values(value).every(entry => typeof entry === 'string' || isI18nDict(entry))
}

interface I18nState {
  currentLocale: Locale
  translations: Record<Locale, I18nDict>
  fallbackLocale: Locale
}

const state: I18nState = {
  currentLocale: 'zh-CN',
  translations: {
    'zh-CN': {},
    'en-US': {},
  },
  fallbackLocale: 'zh-CN',
}

/**
 * 翻译键到对应语言的文本
 *
 * @param key - 点分隔的嵌套键，例如 'common.confirm'
 * @param fallback - 键不存在时的回退文本（通常是原字符串）
 * @param params - 替换 {{name}} 占位符的字符串或数字；缺失参数保留原占位符
 * @returns 翻译后的文本，或回退文本，或键本身
 *
 * @example
 * t('common.confirm', '确认') // => '确认' (zh-CN) 或 'Confirm' (en-US)
 * t('missing.key', 'Default') // => 'Default'
 * t('missing.key') // => 'missing.key'
 */
export function t(key: string, fallback?: string, params?: I18nParams): string {
  const text = lookup(state.translations[state.currentLocale], key)
    ?? lookup(state.translations[state.fallbackLocale], key)
    ?? fallback
    ?? key
  if (!params) return text
  return text.replace(/\{\{([^{}]+)\}\}/g, (placeholder, name: string) => {
    if (!Object.prototype.hasOwnProperty.call(params, name)) return placeholder
    const value = params[name]
    return typeof value === 'string' || typeof value === 'number' ? String(value) : placeholder
  })
}

function lookup(dict: I18nDict, key: string): string | undefined {
  let value: string | I18nDict = dict
  for (const part of key.split('.')) {
    if (typeof value !== 'object' || !Object.prototype.hasOwnProperty.call(value, part)) return undefined
    value = value[part]
  }
  return typeof value === 'string' ? value : undefined
}

/**
 * 切换当前语言
 *
 * @param locale - 目标语言
 * @throws 如果目标语言未加载翻译数据
 */
export function setLocale(locale: Locale): void {
  const dict = state.translations[locale]
  if (!dict || Object.keys(dict).length === 0) {
    throw new Error(`Locale "${locale}" not loaded`)
  }
  state.currentLocale = locale
}

/**
 * 获取当前语言
 */
export function getLocale(): Locale {
  return state.currentLocale
}

/**
 * 加载语言的翻译数据
 *
 * @param locale - 语言标识
 * @param dict - 翻译字典
 */
export function loadTranslations(locale: Locale, dict: unknown): void {
  if (!isI18nDict(dict)) throw new TypeError(`Invalid translation dictionary for "${locale}"`)
  state.translations[locale] = dict
}

/**
 * 设置回退语言（键在当前语言中缺失时使用）
 *
 * @param locale - 回退语言标识
 */
export function setFallbackLocale(locale: Locale): void {
  state.fallbackLocale = locale
}

/**
 * 重置 i18n 状态（主要用于测试）
 */
export function resetI18n(): void {
  state.currentLocale = 'zh-CN'
  state.fallbackLocale = 'zh-CN'
  state.translations = {
    'zh-CN': {},
    'en-US': {},
  }
}
