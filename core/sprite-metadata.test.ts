import { describe, expect, it } from 'vitest'
import { normalizeLabels, normalizeNote, normalizeOutfitNotes } from './sprite-metadata'

describe('normalizeLabels', () => {
  it('trims whitespace exposed exactly at the truncation boundary', () => {
    expect(normalizeLabels([`${'a'.repeat(31)} x`])).toEqual(['a'.repeat(31)])
  })

  it('clips astral characters by Unicode code point without splitting surrogates', () => {
    const label = normalizeLabels([`${'😀'.repeat(32)}x`])[0]

    expect(label).toBe('😀'.repeat(32))
    expect(Array.from(label)).toHaveLength(32)
  })

  it('deduplicates truncation collisions after final normalization', () => {
    const prefix = 'a'.repeat(32)

    expect(normalizeLabels([`${prefix}x`, `${prefix}y`, ` ${prefix} `])).toEqual([prefix])
  })

  it('ignores malformed values and keeps at most 24 normalized labels', () => {
    const values: unknown[] = [null, 7, {}, ...Array.from({ length: 30 }, (_, index) => ` label-${index} `)]

    const labels = normalizeLabels(values)

    expect(labels).toHaveLength(24)
    expect(labels[0]).toBe('label-0')
    expect(labels[23]).toBe('label-23')
  })
})

describe('normalizeNote', () => {
  it('trims whitespace exposed exactly at the truncation boundary', () => {
    expect(normalizeNote(`${'n'.repeat(499)} x`)).toBe('n'.repeat(499))
  })

  it('clips notes to 500 Unicode code points without splitting surrogates', () => {
    const note = normalizeNote(`${'😀'.repeat(500)}x`)

    expect(note).toBe('😀'.repeat(500))
    expect(Array.from(note)).toHaveLength(500)
  })
})

describe('normalizeOutfitNotes', () => {
  it('preserves special own keys without inherited-value ambiguity', () => {
    const raw = JSON.parse(
      '{"__proto__":" prototype note ","toString":" method note ","  ":"drop","empty":"   ","invalid":7}',
    ) as unknown

    const notes = normalizeOutfitNotes(raw)

    expect(Object.getPrototypeOf(notes)).toBeNull()
    expect(Object.prototype.hasOwnProperty.call(notes, '__proto__')).toBe(true)
    expect(Object.prototype.hasOwnProperty.call(notes, 'toString')).toBe(true)
    expect(notes['__proto__']).toBe('prototype note')
    expect(notes.toString).toBe('method note')
    expect(Object.keys(notes)).toEqual(['__proto__', 'toString'])
  })
})
