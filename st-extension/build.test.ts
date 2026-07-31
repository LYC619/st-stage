// @vitest-environment node

import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import {
  buildTimeFromVersion,
  buildVersion,
  resolveBuildTime,
} from './build-time.mjs'

describe('extension loader stylesheet lifecycle', () => {
  it('removes the previous marked stylesheet before appending the next marked link', () => {
    const source = readFileSync(new URL('../index.js', import.meta.url), 'utf8')
    const removeAt = source.indexOf("querySelectorAll('link[data-st-stage-style]')")
    const markAt = source.indexOf("setAttribute('data-st-stage-style', '')")
    const appendAt = source.indexOf('document.head.appendChild(link)')

    expect(removeAt).toBeGreaterThanOrEqual(0)
    expect(markAt).toBeGreaterThan(removeAt)
    expect(appendAt).toBeGreaterThan(markAt)
  })
})

describe('extension build timestamp', () => {
  it('accepts an explicit YYYY-MM-DD HH:mm build time and derives the compact version suffix', () => {
    const buildTime = resolveBuildTime(
      { ...process.env, ST_STAGE_BUILD_TIME: '2026-07-31 09:05' },
      new Date(2026, 0, 1, 0, 0),
    )

    expect(buildTime).toBe('2026-07-31 09:05')
    expect(buildVersion('0.9.0', buildTime)).toBe('0.9.0+202607310905')
  })

  it.each([
    '2026-7-31 9:05',
    '2026-02-30 12:00',
    '2026-07-31T09:05',
    '2026-07-31 09:05:00',
    '2026-13-01 00:00',
    '2026-00-01 00:00',
    '2026-01-01 24:00',
  ])('rejects invalid explicit build time %s', (value) => {
    expect(() => resolveBuildTime({ ...process.env, ST_STAGE_BUILD_TIME: value })).toThrow(
      /ST_STAGE_BUILD_TIME/,
    )
  })

  it('extracts the committed build time from version.json format for CI', () => {
    expect(buildTimeFromVersion('0.9.0+202607312354')).toBe('2026-07-31 23:54')
    expect(() => buildTimeFromVersion('0.9.0')).toThrow(/version/)
  })

  it('validates the explicit build time before esbuild or artifact writes can run', () => {
    const source = readFileSync(new URL('./build.mjs', import.meta.url), 'utf8')
    const parseAt = source.indexOf('const buildTime = resolveBuildTime')
    const buildAt = source.indexOf('await build(')
    const writeAt = source.indexOf('writeFileSync(')

    expect(parseAt).toBeGreaterThanOrEqual(0)
    expect(buildAt).toBeGreaterThan(parseAt)
    expect(writeAt).toBeGreaterThan(parseAt)
  })
})
