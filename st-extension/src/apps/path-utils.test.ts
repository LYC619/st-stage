import { describe, expect, it } from 'vitest'
import { deleteNested, getNested, setNested, splitPath } from './path-utils'

const pollutionKey = '__stStagePathPolluted__'

describe('nested path safety', () => {
  it.each([
    '__proto__.polluted',
    'safe.__proto__.polluted',
    'prototype.polluted',
    'safe.prototype.polluted',
    'constructor.polluted',
    'safe.constructor.polluted',
  ])('rejects the dangerous path %s', (path) => {
    expect(splitPath(path)).toEqual([])
  })

  it.each(['__proto__', 'prototype', 'constructor'])(
    'does not write through the dangerous segment %s',
    (segment) => {
      const target: Record<string, unknown> = {}
      try {
        setNested(target, `${segment}.${pollutionKey}`, true)
        expect(({} as Record<string, unknown>)[pollutionKey]).toBeUndefined()
      } finally {
        delete (Object.prototype as Record<string, unknown>)[pollutionKey]
      }
    },
  )

  it('does not read or delete paths containing dangerous segments', () => {
    const target = Object.create(null) as Record<string, unknown>
    target.safe = { constructor: { keep: true } }

    expect(getNested(target, 'safe.constructor.keep')).toBeUndefined()
    deleteNested(target, 'safe.constructor.keep')

    expect(target).toEqual({ safe: { constructor: { keep: true } } })
  })

  it('preserves normal dotted paths', () => {
    const target: Record<string, unknown> = {}

    setNested(target, '状态.体力', 100)
    expect(getNested(target, '状态.体力')).toBe(100)

    deleteNested(target, '状态.体力')
    expect(getNested(target, '状态.体力')).toBeUndefined()
    expect(target).toEqual({ 状态: {} })
  })
})
