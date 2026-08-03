import { describe, expect, it } from 'vitest'
import {
  compactNumberedTags,
  filterSprites,
  groupPacksByRole,
  normalizeLabels,
  normalizeNote,
  normalizeOutfitNotes,
} from './sprite-metadata'

describe('filterSprites', () => {
  const pack = {
    id: 'p',
    name: '日常图库',
    roleName: '小雅',
    outfit: '校服',
    sprites: [
      { tag: '挥手', url: 'a', labels: ['动作', '室外'] },
      { tag: '看书', url: 'b', outfit: '居家服', labels: ['动作', '室内'] },
      { tag: '微笑', url: 'c', group: '小明', labels: ['表情'] },
    ],
  }

  it('matches a case-insensitive query across identity, labels, effective role/outfit, and pack name', () => {
    expect(filterSprites(pack, { query: '居家', labels: [] }).map((sprite) => sprite.tag)).toEqual(['看书'])
    expect(filterSprites(pack, { query: '小雅', labels: [] }).map((sprite) => sprite.tag)).toEqual(['挥手', '看书'])
    expect(filterSprites(pack, { query: '日常图库', labels: [] })).toHaveLength(3)
    expect(filterSprites(pack, { query: '室外', labels: [] }).map((sprite) => sprite.tag)).toEqual(['挥手'])
  })

  it('uses AND semantics for deduplicated labels', () => {
    expect(filterSprites(pack, { query: '', labels: ['动作', '室内', '动作'] }).map((sprite) => sprite.tag)).toEqual(['看书'])
    expect(filterSprites(pack, { query: '书', labels: ['动作', '室内'] }).map((sprite) => sprite.tag)).toEqual(['看书'])
    expect(filterSprites(pack, { query: '', labels: ['动作', '表情'] })).toEqual([])
  })
})

describe('groupPacksByRole', () => {
  it('preserves order, keeps empty-role packs independent, and reports counts', () => {
    const packs = [
      { id: 'a', name: 'A', roleName: '小雅', sprites: [{ tag: '1', url: 'a' }] },
      { id: 'empty-1', name: '独立一', sprites: [{ tag: '1', url: 'b' }] },
      { id: 'b', name: 'B', roleName: '小雅', sprites: [{ tag: '1', url: 'c' }, { tag: '2', url: 'd' }] },
      { id: 'empty-2', name: '独立二', roleName: '  ', sprites: [] },
      { id: 'c', name: 'C', roleName: '小明', sprites: [{ tag: '1', url: 'e' }] },
    ]

    const groups = groupPacksByRole(packs)

    expect(groups.map(({ role, packs }) => [role, packs.map((pack) => pack.id)])).toEqual([
      ['小雅', ['a', 'b']],
      ['', ['empty-1']],
      ['', ['empty-2']],
      ['小明', ['c']],
    ])
    expect(groups.map(({ packCount, spriteCount }) => [packCount, spriteCount])).toEqual([
      [2, 3], [1, 1], [1, 0], [1, 1],
    ])
  })
})

describe('compactNumberedTags', () => {
  it('compacts an adjacent ascending run and preserves ordinary tags in source order', () => {
    expect(compactNumberedTags(['挥手1', '挥手2', '挥手3', '微笑'])).toEqual([
      { kind: 'range', label: '挥手1-3', values: ['挥手1', '挥手2', '挥手3'] },
      { kind: 'tag', label: '微笑', values: ['微笑'] },
    ])
  })

  it('keeps gapped and shorter-than-three runs uncompressed', () => {
    expect(compactNumberedTags(['挥手1', '挥手2', '挥手4', '点头8', '点头9'])).toEqual([
      { kind: 'tag', label: '挥手1', values: ['挥手1'] },
      { kind: 'tag', label: '挥手2', values: ['挥手2'] },
      { kind: 'tag', label: '挥手4', values: ['挥手4'] },
      { kind: 'tag', label: '点头8', values: ['点头8'] },
      { kind: 'tag', label: '点头9', values: ['点头9'] },
    ])
  })

  it('preserves leading zeros and supports Unicode prefixes and separate prefix runs', () => {
    expect(compactNumberedTags([
      '挥手😀001', '挥手😀002', '挥手😀003',
      '点头7', '点头8', '点头9',
    ])).toEqual([
      {
        kind: 'range',
        label: '挥手😀001-003',
        values: ['挥手😀001', '挥手😀002', '挥手😀003'],
      },
      { kind: 'range', label: '点头7-9', values: ['点头7', '点头8', '点头9'] },
    ])
  })

  it('does not compact when the generated range label is itself a real tag', () => {
    expect(compactNumberedTags(['act1', 'act2', 'act3', 'act1-3'])).toEqual([
      { kind: 'tag', label: 'act1', values: ['act1'] },
      { kind: 'tag', label: 'act2', values: ['act2'] },
      { kind: 'tag', label: 'act3', values: ['act3'] },
      { kind: 'tag', label: 'act1-3', values: ['act1-3'] },
    ])
  })

  it('honors range labels reserved by another collection', () => {
    expect(compactNumberedTags(['act1', 'act2', 'act3'], new Set(['act1-3']))).toEqual([
      { kind: 'tag', label: 'act1', values: ['act1'] },
      { kind: 'tag', label: 'act2', values: ['act2'] },
      { kind: 'tag', label: 'act3', values: ['act3'] },
    ])
  })

  it('does not compact mixed numeric suffix padding', () => {
    expect(compactNumberedTags(['act8', 'act09', 'act10'])).toEqual([
      { kind: 'tag', label: 'act8', values: ['act8'] },
      { kind: 'tag', label: 'act09', values: ['act09'] },
      { kind: 'tag', label: 'act10', values: ['act10'] },
    ])
  })

  it('compacts canonical decimals across a digit-width boundary', () => {
    expect(compactNumberedTags(['act8', 'act9', 'act10'])).toEqual([
      { kind: 'range', label: 'act8-10', values: ['act8', 'act9', 'act10'] },
    ])
  })

  it('compacts consecutive integer suffixes beyond Number.MAX_SAFE_INTEGER', () => {
    expect(compactNumberedTags([
      'act9007199254740992',
      'act9007199254740993',
      'act9007199254740994',
    ])).toEqual([{
      kind: 'range',
      label: 'act9007199254740992-9007199254740994',
      values: ['act9007199254740992', 'act9007199254740993', 'act9007199254740994'],
    }])
  })

  it('deduplicates exact tags before compaction while preserving first-occurrence order', () => {
    expect(compactNumberedTags([
      '挥手1', '挥手2', '挥手2', '挥手3',
      '点头1', '挥手4',
      '跳跃3', '跳跃2', '跳跃1',
    ])).toEqual([
      { kind: 'range', label: '挥手1-3', values: ['挥手1', '挥手2', '挥手3'] },
      { kind: 'tag', label: '点头1', values: ['点头1'] },
      { kind: 'tag', label: '挥手4', values: ['挥手4'] },
      { kind: 'tag', label: '跳跃3', values: ['跳跃3'] },
      { kind: 'tag', label: '跳跃2', values: ['跳跃2'] },
      { kind: 'tag', label: '跳跃1', values: ['跳跃1'] },
    ])
  })
})

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
