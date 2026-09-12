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
 * @returns 翻译后的文本，或回退文本，或键本身
 *
 * @example
 * t('common.confirm', '确认') // => '确认' (zh-CN) 或 'Confirm' (en-US)
 * t('missing.key', 'Default') // => 'Default'
 * t('missing.key') // => 'missing.key'
 */
export function t(key: string, fallback?: string): string {
  const keys = key.split('.')
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let value: any = state.translations[state.currentLocale]

  for (const k of keys) {
    value = value?.[k]
    if (value === undefined) break
  }

  if (typeof value === 'string') return value

  // 尝试 fallback locale
  if (state.currentLocale !== state.fallbackLocale) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let fallbackValue: any = state.translations[state.fallbackLocale]
    for (const k of keys) {
      fallbackValue = fallbackValue?.[k]
      if (fallbackValue === undefined) break
    }
    if (typeof fallbackValue === 'string') return fallbackValue
  }

  return fallback ?? key
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
export function loadTranslations(locale: Locale, dict: I18nDict): void {
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
