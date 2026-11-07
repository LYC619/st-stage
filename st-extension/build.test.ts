// @vitest-environment node

import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildTimeFromVersion,
  buildVersion,
  resolveBuildTime,
} from './build-time.mjs'
import { buildExtension, buildExtensionPair, normalizeArtifactNewlines, normalizeBundleWhitespace } from './build.mjs'

const artifactNames = ['index.js', 'bundle.js', 'style.css', 'version.json'] as const
const distributionNames = ['README.md', 'bundle.js', 'index.js', 'locales', 'manifest.json', 'style.css', 'version.json'] as const
const tempDirs: string[] = []

function createBuildFixture(): string {
  const root = mkdtempSync(join(tmpdir(), 'st-stage-build-'))
  tempDirs.push(root)
  mkdirSync(join(root, 'st-extension', 'src'), { recursive: true })
  mkdirSync(join(root, 'st-extension', 'locales'), { recursive: true })
  mkdirSync(join(root, 'core'), { recursive: true })
  mkdirSync(join(root, 'public'), { recursive: true })
  mkdirSync(join(root, 'reference', 'assets'), { recursive: true })
  writeFileSync(join(root, 'manifest.json'), JSON.stringify({ version: '1.2.3' }))
  writeFileSync(
    join(root, 'st-extension', 'src', 'index.ts'),
    "globalThis.__buildFixture = 'first:' + __BUILD_TIME__\n",
  )
  writeFileSync(join(root, 'st-extension', 'style.css'), '.fixture { color: red; }\n')
  writeFileSync(
    join(root, 'st-extension', 'distribution-readme.md'),
    '# Generated ST install output\nReference assets are intentionally excluded.\n',
  )
  writeFileSync(join(root, 'core', 'phone-shell.css'), '.phone { color: blue; }\n')
  writeFileSync(join(root, 'st-extension', 'locales', 'zh-CN.json'), '{"test":"测试"}\n')
  writeFileSync(join(root, 'st-extension', 'locales', 'en-US.json'), '{"test":"test"}\n')
  return root
}

function artifactHashes(root: string): Record<string, string> {
  return Object.fromEntries(artifactNames.map((name) => [
    name,
    createHash('sha256').update(readFileSync(join(root, name))).digest('hex'),
  ]))
}

function runGit(root: string, args: string[]): ReturnType<typeof spawnSync> {
  return spawnSync('git', args, { cwd: root, encoding: 'utf8' })
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

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

describe('extension artifact newlines', () => {
  it('collapses CRLF so artifact bytes do not depend on checkout settings', () => {
    expect(normalizeArtifactNewlines('a\r\nb\r\n')).toBe('a\nb\n')
    expect(normalizeArtifactNewlines('a\nb\n')).toBe('a\nb\n')
  })

  it('writes LF-only style.css even when the source CSS is checked out as CRLF', async () => {
    const root = createBuildFixture()
    // core.autocrlf=true 的机器上源 CSS 就是这个样子
    writeFileSync(join(root, 'st-extension', 'style.css'), '.fixture {\r\n  color: red;\r\n}\r\n')
    writeFileSync(join(root, 'core', 'phone-shell.css'), '.phone {\r\n  color: blue;\r\n}\r\n')

    await buildExtension({
      sourceRoot: root,
      env: { ...process.env, ST_STAGE_BUILD_TIME: '2026-01-02 03:04' },
      logLevel: 'silent',
      log: () => {},
    })

    for (const name of artifactNames) {
      const bytes = readFileSync(join(root, name))
      expect(bytes.includes(Buffer.from('\r\n')), `${name} must not contain CRLF`).toBe(false)
    }
  })
})

describe('extension bundle formatting', () => {
  it('removes trailing whitespace without changing bundle content', () => {
    expect(normalizeBundleWhitespace('license\n  \ncode  \n')).toBe('license\n\ncode\n')
  })
})

describe('extension lazy chunk packaging', () => {
  it('keeps lazy code out of the main bundle and refreshes hashed chunks across all outputs', async () => {
    const root = createBuildFixture()
    writeFileSync(join(root, 'st-extension/src/index.ts'), "globalThis.loadFixture = () => import('./lazy')\n")
    writeFileSync(join(root, 'st-extension/src/lazy.ts'), "export function descriptiveFunction() { return 'LAZY_SENTINEL_ONE' }\n")
    const env = { ...process.env, ST_STAGE_BUILD_TIME: '2026-11-06 23:00' }
    await buildExtensionPair({ sourceRoot: root, env, logLevel: 'silent', log: () => {} })
    const chunks = readdirSync(root).filter(name => /^chunk-.*\.js$/.test(name))
    expect(chunks.length).toBeGreaterThan(0)
    expect(readFileSync(join(root, 'bundle.js'), 'utf8')).not.toContain('LAZY_SENTINEL_ONE')
    expect(chunks.map(name => readFileSync(join(root, name), 'utf8')).join('')).toContain('descriptiveFunction')
    for (const output of ['st-distribution', 'public']) for (const name of ['bundle.js', ...chunks]) {
      expect(readFileSync(join(root, output, name))).toEqual(readFileSync(join(root, name)))
    }
    writeFileSync(join(root, 'st-extension/src/lazy.ts'), "export function descriptiveFunction() { return 'LAZY_SENTINEL_TWO' }\n")
    await buildExtensionPair({ sourceRoot: root, env, logLevel: 'silent', log: () => {} })
    const next = readdirSync(root).filter(name => /^chunk-.*\.js$/.test(name))
    expect(next).not.toEqual(chunks)
    for (const name of chunks.filter(name => !next.includes(name))) expect(readdirSync(root)).not.toContain(name)
  })
})

describe('extension build integration', () => {
  const fixedEnv = { ...process.env, ST_STAGE_BUILD_TIME: '2026-07-31 09:05' }

  it('builds both destinations with one timestamp and identical locale bytes', async () => {
    const root = createBuildFixture()
    writeFileSync(join(root, 'st-extension/locales/en-US.json'), '{\r\n  "test": "test"\r\n}\r\n')
    const result = await buildExtensionPair({ sourceRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    expect(result.version).toBe('1.2.3+202607310905')
    for (const name of [...artifactNames, 'locales/en-US.json', 'locales/zh-CN.json']) {
      const source = readFileSync(join(root, name))
      expect(readFileSync(join(root, 'st-distribution', name))).toEqual(source)
      expect(source.includes(Buffer.from('\r\n'))).toBe(false)
    }
  })

  it('rejects an invalid explicit time before changing any artifact', async () => {
    const root = createBuildFixture()
    for (const name of artifactNames) writeFileSync(join(root, name), `${name}:sentinel`)

    await expect(buildExtension({
      sourceRoot: root,
      outputRoot: root,
      env: { ...process.env, ST_STAGE_BUILD_TIME: '2026-02-30 12:00' },
      logLevel: 'silent',
      log: () => {},
    })).rejects.toThrow(/ST_STAGE_BUILD_TIME/)

    for (const name of artifactNames) {
      expect(readFileSync(join(root, name), 'utf8')).toBe(`${name}:sentinel`)
    }
  })

  it('produces byte-identical artifacts for the same explicit time', async () => {
    const root = createBuildFixture()
    await buildExtension({ sourceRoot: root, outputRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    const firstHashes = artifactHashes(root)

    await buildExtension({ sourceRoot: root, outputRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })

    expect(artifactHashes(root)).toEqual(firstHashes)
    expect(readFileSync(join(root, 'version.json'), 'utf8')).toContain('1.2.3+202607310905')
    expect(readFileSync(join(root, 'bundle.js'), 'utf8')).toContain('2026-07-31 09:05')
  })

  it('makes the artifact diff fail after a source change and rebuild', async () => {
    const root = createBuildFixture()
    await buildExtension({ sourceRoot: root, outputRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    expect(runGit(root, ['init', '--quiet']).status).toBe(0)
    expect(runGit(root, ['config', 'core.autocrlf', 'false']).status).toBe(0)
    expect(runGit(root, ['config', 'user.email', 'build-test@example.invalid']).status).toBe(0)
    expect(runGit(root, ['config', 'user.name', 'Build Test']).status).toBe(0)
    expect(runGit(root, ['add', ...artifactNames]).status).toBe(0)
    expect(runGit(root, ['commit', '--quiet', '-m', 'fixture artifacts']).status).toBe(0)

    writeFileSync(
      join(root, 'st-extension', 'src', 'index.ts'),
      "globalThis.__buildFixture = 'second:' + __BUILD_TIME__\n",
    )
    await buildExtension({ sourceRoot: root, outputRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })

    expect(runGit(root, ['diff', '--exit-code', '--', ...artifactNames]).status).toBe(1)
  })

  it('exports a self-contained ST distribution without simulator or reference assets', async () => {
    const root = createBuildFixture()
    const outputRoot = join(root, 'st-distribution')

    await buildExtension({
      sourceRoot: root,
      outputRoot,
      env: fixedEnv,
      logLevel: 'silent',
      log: () => {},
    })

    expect(readdirSync(outputRoot).sort()).toEqual([...distributionNames].sort())
    expect(readFileSync(join(outputRoot, 'manifest.json'), 'utf8')).toBe(
      readFileSync(join(root, 'manifest.json'), 'utf8'),
    )
    expect(readFileSync(join(outputRoot, 'README.md'), 'utf8')).toContain(
      'Reference assets are intentionally excluded',
    )
    expect(readdirSync(outputRoot, { withFileTypes: true }).some((entry) => entry.name === 'public')).toBe(false)
    expect(readdirSync(outputRoot, { withFileTypes: true }).some((entry) => entry.name === 'reference')).toBe(false)
  })

  it('copies extension assets to distribution output when present (W5 / P2)', async () => {
    const root = createBuildFixture()
    mkdirSync(join(root, 'assets', 'wechat'), { recursive: true })
    writeFileSync(join(root, 'assets', 'wechat', 'emoji.png'), 'test-image-bytes')
    const outputRoot = join(root, 'st-distribution')

    await buildExtension({
      sourceRoot: root,
      outputRoot,
      env: fixedEnv,
      logLevel: 'silent',
      log: () => {},
    })

    expect(readFileSync(join(outputRoot, 'assets', 'wechat', 'emoji.png'), 'utf8')).toBe('test-image-bytes')
  })
})
