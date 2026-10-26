import { describe, expect, it } from 'vitest'
import { verifyDictionaries, verifySource } from '../../scripts/verify-i18n-completeness.mjs'

describe('translation completeness gate', () => {
  it('accepts nested dictionaries with matching interpolation and literal protocol braces', () => {
    expect(verifyDictionaries({ app: { text: '{{count}} 张 {清单}' } }, { app: { text: '{{count}} images {清单}' } }).errors).toEqual([])
  })
  it('reports missing, extra, blank, invalid and mismatched placeholder entries', () => {
    const { errors } = verifyDictionaries(
      { app: { name: '名称', count: '{{count}}', missing: '缺少', blank: '文本' } },
      { app: { name: 2, count: '{{total}}', extra: 'Extra', blank: '' } },
    )
    expect(errors.join('\n')).toMatch(/app.name/)
    expect(errors.join('\n')).toMatch(/app.missing/)
    expect(errors.join('\n')).toMatch(/app.extra/)
    expect(errors.join('\n')).toMatch(/app.blank/)
    expect(errors.join('\n')).toMatch(/app.count.*placeholder/)
  })
  it('checks aliased runtime imports, key references, fallback and parameters without matching unrelated t calls', () => {
    const entries = new Map([['app.count', '{{count}} 张']])
    const code = `import { t as translate } from '../../core/i18n'
      translate('missing.key', '丢失')
      translate('app.count', '{{count}} 张', { total: 2 })
      translate('app.count', '{{wrong}} 张', { count: 2 })
      t('not.a.translation')`
    const result = verifySource(code, 'sample.ts', entries)
    expect(result.references).toBe(3)
    expect(result.errors.join('\n')).toMatch(/missing.key/)
    expect(result.errors.join('\n')).toMatch(/parameter.*count/)
    expect(result.errors.join('\n')).toMatch(/fallback/)
    expect(result.errors.join('\n')).not.toMatch(/not.a.translation/)
  })
  it('rejects dynamic keys that would bypass completeness verification', () => {
    const result = verifySource("import { t } from './i18n'; t('app.' + name, 'Name')", 'sample.ts', new Map())
    expect(result.errors.join('\n')).toMatch(/static/)
  })

  it('rejects fallback and parameter expressions it cannot verify statically', () => {
    const entries = new Map([['hello', '你好 {{name}}']])
    for (const call of [
      "t('hello', wrongFallback, {name: 'A'})",
      "t('hello', '你好 {{name}}', {...{}})",
      "t('hello', '你好 {{name}}', params)",
    ]) {
      expect(verifySource(`import { t } from './i18n'; ${call}`, 'sample.ts', entries).errors.join('\n')).toMatch(/static/)
    }
  })
})
