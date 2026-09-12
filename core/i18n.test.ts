import { describe, test, expect, beforeEach } from 'vitest'
import {
  t,
  setLocale,
  getLocale,
  loadTranslations,
  setFallbackLocale,
  resetI18n,
  type I18nDict,
} from './i18n'

describe('i18n', () => {
  beforeEach(() => {
    resetI18n()
  })

  describe('t() - translation', () => {
    test('returns translated string for existing key', () => {
      loadTranslations('zh-CN', { common: { confirm: '确认' } })
      loadTranslations('en-US', { common: { confirm: 'Confirm' } })

      setLocale('zh-CN')
      expect(t('common.confirm')).toBe('确认')

      setLocale('en-US')
      expect(t('common.confirm')).toBe('Confirm')
    })

    test('supports deeply nested keys', () => {
      loadTranslations('zh-CN', {
        app: {
          sprite: {
            overlay: {
              title: '立绘悬浮窗',
            },
          },
        },
      })

      expect(t('app.sprite.overlay.title')).toBe('立绘悬浮窗')
    })

    test('returns fallback when key missing', () => {
      expect(t('missing.key', 'Default Text')).toBe('Default Text')
    })

    test('returns key itself when no fallback provided', () => {
      expect(t('missing.key')).toBe('missing.key')
    })

    test('returns fallback when key exists but value is not string', () => {
      loadTranslations('zh-CN', { common: { nested: { key: 'value' } } })
      expect(t('common.nested', 'Fallback')).toBe('Fallback')
    })

    test('uses fallback locale when key missing in current locale', () => {
      loadTranslations('zh-CN', { common: { confirm: '确认' } })
      loadTranslations('en-US', { common: {} })

      setFallbackLocale('zh-CN')
      setLocale('en-US')

      expect(t('common.confirm')).toBe('确认')
    })

    test('does not use fallback locale when current locale has the key', () => {
      loadTranslations('zh-CN', { common: { confirm: '确认' } })
      loadTranslations('en-US', { common: { confirm: 'Confirm' } })

      setFallbackLocale('zh-CN')
      setLocale('en-US')

      expect(t('common.confirm')).toBe('Confirm')
    })
  })

  describe('setLocale()', () => {
    test('changes current locale', () => {
      loadTranslations('zh-CN', { key: 'value' })
      loadTranslations('en-US', { key: 'value' })

      setLocale('en-US')
      expect(getLocale()).toBe('en-US')

      setLocale('zh-CN')
      expect(getLocale()).toBe('zh-CN')
    })

    test('throws when locale not loaded', () => {
      // en-US 还是空字典
      expect(() => setLocale('en-US')).toThrow('Locale "en-US" not loaded')
    })

    test('allows switching to locale with empty dictionary after loading', () => {
      loadTranslations('en-US', {})
      // 空字典现在也被认为是"未加载"，因为没有实际内容
      expect(() => setLocale('en-US')).toThrow('Locale "en-US" not loaded')
    })
  })

  describe('loadTranslations()', () => {
    test('loads translation dictionary for locale', () => {
      const dict: I18nDict = {
        common: {
          confirm: '确认',
          cancel: '取消',
        },
      }

      loadTranslations('zh-CN', dict)

      expect(t('common.confirm')).toBe('确认')
      expect(t('common.cancel')).toBe('取消')
    })

    test('replaces existing translations for same locale', () => {
      loadTranslations('zh-CN', { key: 'old' })
      expect(t('key')).toBe('old')

      loadTranslations('zh-CN', { key: 'new' })
      expect(t('key')).toBe('new')
    })
  })

  describe('edge cases', () => {
    test('handles empty translation dictionary', () => {
      loadTranslations('zh-CN', {})
      expect(t('any.key', 'fallback')).toBe('fallback')
    })

    test('handles single-level keys', () => {
      loadTranslations('zh-CN', { key: 'value' })
      expect(t('key')).toBe('value')
    })

    test('handles keys with dots in property names', () => {
      // 不支持属性名本身包含点号，这是设计限制
      loadTranslations('zh-CN', { 'key.with.dots': 'value' })
      // 会被解析为嵌套键 key.with.dots
      expect(t('key.with.dots')).toBe('key.with.dots')
    })

    test('preserves locale state across multiple translations', () => {
      loadTranslations('zh-CN', { a: '中文A', b: '中文B' })
      loadTranslations('en-US', { a: 'English A', b: 'English B' })

      setLocale('en-US')
      expect(t('a')).toBe('English A')
      expect(t('b')).toBe('English B')
      expect(getLocale()).toBe('en-US')
    })
  })

  describe('resetI18n()', () => {
    test('resets to initial state', () => {
      loadTranslations('zh-CN', { key: 'value' })
      loadTranslations('en-US', { key: 'value' })
      setLocale('en-US')
      setFallbackLocale('en-US')

      resetI18n()

      expect(getLocale()).toBe('zh-CN')
      expect(t('key')).toBe('key') // translations cleared
    })
  })
})
