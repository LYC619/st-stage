// @vitest-environment node

import { createHash } from 'node:crypto'
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { runInNewContext } from 'node:vm'
import { afterEach, describe, expect, it } from 'vitest'
import {
  buildTimeFromVersion,
  buildVersion,
  resolveBuildTime,
} from './build-time.mjs'
import { buildExtension, buildExtensionPair, buildLoaderStub, normalizeArtifactNewlines, normalizeBundleWhitespace } from './build.mjs'

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

afterEach(() => {
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true })
})

describe('extension build timestamp & formatting helpers', () => {
  it('validates explicit build times and derives version/CI timestamps', () => {
    const buildTime = resolveBuildTime(
      { ...process.env, ST_STAGE_BUILD_TIME: '2026-07-31 09:05' },
      new Date(2026, 0, 1, 0, 0),
    )
    expect(buildTime).toBe('2026-07-31 09:05')
    expect(buildVersion('0.9.0', buildTime)).toBe('0.9.0+202607310905')
    expect(buildTimeFromVersion('0.9.0+202607312354')).toBe('2026-07-31 23:54')
    expect(() => buildTimeFromVersion('0.9.0')).toThrow(/version/)

    for (const bad of [
      '2026-7-31 9:05',
      '2026-02-30 12:00',
      '2026-07-31T09:05',
      '2026-07-31 09:05:00',
      '2026-13-01 00:00',
      '2026-00-01 00:00',
      '2026-01-01 24:00',
    ]) {
      expect(() => resolveBuildTime({ ...process.env, ST_STAGE_BUILD_TIME: bad })).toThrow(/ST_STAGE_BUILD_TIME/)
    }
  })

  it('normalizes CRLF and trailing bundle whitespace', () => {
    expect(normalizeArtifactNewlines('a\r\nb\r\n')).toBe('a\nb\n')
    expect(normalizeArtifactNewlines('a\nb\n')).toBe('a\nb\n')
    expect(normalizeBundleWhitespace('license\n  \ncode  \n')).toBe('license\n\ncode\n')
  })
})

describe('extension build & packaging integration', () => {
  const fixedEnv = { ...process.env, ST_STAGE_BUILD_TIME: '2026-07-31 09:05' }

  it('rejects an invalid explicit time before writing any artifact', async () => {
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

  it('builds deterministic LF-only CSS/locale/asset outputs across all channels and excludes simulator files', async () => {
    const root = createBuildFixture()
    writeFileSync(join(root, 'st-extension', 'style.css'), '/* BASE_FIRST */\r\n')
    writeFileSync(join(root, 'core', 'phone-shell.css'), '/* SHELL_SECOND */\r\n')
    mkdirSync(join(root, 'st-extension', 'styles'), { recursive: true })
    writeFileSync(join(root, 'st-extension', 'styles', '20-b.css'), '/* PARTIAL_20 */\r\n')
    writeFileSync(join(root, 'st-extension', 'styles', '10-a.css'), '/* PARTIAL_10 */\r\n')
    writeFileSync(join(root, 'st-extension', 'locales', 'en-US.json'), '{\r\n  "test": "test"\r\n}\r\n')
    mkdirSync(join(root, 'assets', 'wechat'), { recursive: true })
    writeFileSync(join(root, 'assets', 'wechat', 'emoji.png'), 'test-image-bytes')

    const result = await buildExtensionPair({ sourceRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    expect(result.version).toBe('1.2.3+202607310905')
    const firstHashes = artifactHashes(root)

    await buildExtension({ sourceRoot: root, outputRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    expect(artifactHashes(root)).toEqual(firstHashes)

    const css = readFileSync(join(root, 'style.css'), 'utf8')
    expect(css.indexOf('BASE_FIRST')).toBeLessThan(css.indexOf('SHELL_SECOND'))
    expect(css.indexOf('SHELL_SECOND')).toBeLessThan(css.indexOf('PARTIAL_10'))
    expect(css.indexOf('PARTIAL_10')).toBeLessThan(css.indexOf('PARTIAL_20'))

    const distRoot = join(root, 'st-distribution')
    expect(readdirSync(distRoot).sort()).toEqual([...distributionNames, 'assets'].sort())
    expect(readFileSync(join(distRoot, 'assets', 'wechat', 'emoji.png'), 'utf8')).toBe('test-image-bytes')
    expect(readFileSync(join(distRoot, 'README.md'), 'utf8')).toContain('Reference assets are intentionally excluded')
    expect(readdirSync(distRoot).includes('public')).toBe(false)
    expect(readdirSync(distRoot).includes('reference')).toBe(false)

    for (const name of [...artifactNames, 'locales/en-US.json', 'locales/zh-CN.json']) {
      const source = readFileSync(join(root, name))
      expect(readFileSync(join(distRoot, name))).toEqual(source)
      expect(source.includes(Buffer.from('\r\n'))).toBe(false)
    }
  })

  it('keeps lazy code in hashed chunks and cleans up superseded chunks across outputs', async () => {
    const root = createBuildFixture()
    writeFileSync(join(root, 'st-extension/src/index.ts'), "globalThis.loadFixture = () => import('./lazy')\n")
    writeFileSync(join(root, 'st-extension/src/lazy.ts'), "export function descriptiveFunction() { return 'LAZY_SENTINEL_ONE' }\n")
    await buildExtensionPair({ sourceRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    const chunks = readdirSync(root).filter((name) => /^chunk-.*\.js$/.test(name))
    expect(chunks.length).toBeGreaterThan(0)
    expect(readFileSync(join(root, 'bundle.js'), 'utf8')).not.toContain('LAZY_SENTINEL_ONE')
    for (const output of ['st-distribution', 'public']) {
      for (const name of ['bundle.js', ...chunks]) {
        expect(readFileSync(join(root, output, name))).toEqual(readFileSync(join(root, name)))
      }
    }

    writeFileSync(join(root, 'st-extension/src/lazy.ts'), "export function descriptiveFunction() { return 'LAZY_SENTINEL_TWO' }\n")
    await buildExtensionPair({ sourceRoot: root, env: fixedEnv, logLevel: 'silent', log: () => {} })
    const next = readdirSync(root).filter((name) => /^chunk-.*\.js$/.test(name))
    expect(next).not.toEqual(chunks)
    for (const stale of chunks.filter((name) => !next.includes(name))) {
      expect(readdirSync(root)).not.toContain(stale)
    }
  })
})

function runLoaderStub(env: {
  currentScriptSrc?: string
  stack?: string
  scripts?: string[]
  links?: string[]
  resources?: string[]
  markedStyles?: number
}) {
  const fetched: string[] = []
  const errors: unknown[][] = []
  const events: string[] = []
  const stub = buildLoaderStub().replace(/import\(/g, '__import(')
  const makeNodes = (values: string[] = [], attr: 'src' | 'href') =>
    values.map((value) => ({
      [attr]: value,
      getAttribute: (name: string) => (name === attr ? value : null),
    }))
  const markedNodes = Array.from({ length: env.markedStyles ?? 0 }, (_, idx) => ({
    remove: () => events.push(`remove:${idx}`),
  }))
  const FakeError = function FakeError(this: { stack?: string }) {
    this.stack = env.stack ?? ''
  }
  runInNewContext(stub, {
    Error: FakeError,
    document: {
      currentScript: env.currentScriptSrc ? { src: env.currentScriptSrc } : null,
      querySelectorAll(selector: string) {
        if (selector === 'link[data-st-stage-style]') return markedNodes
        if (selector === 'script[src]') return makeNodes(env.scripts, 'src')
        if (selector.startsWith('link[rel="stylesheet"]')) return makeNodes(env.links, 'href')
        return []
      },
      createElement: () => ({
        rel: '',
        href: '',
        setAttribute: (k: string) => events.push(`attr:${k}`),
      }),
      head: { appendChild: () => events.push('append') },
    },
    performance: {
      getEntriesByType: (type: string) =>
        type === 'resource' ? (env.resources ?? []).map((name) => ({ name })) : [],
    },
    fetch: (url: string) => {
      fetched.push(url)
      return Promise.resolve({ json: () => Promise.resolve({ v: '0.9.0+202611210000' }) })
    },
    __import: () => Promise.resolve(),
    console: { error: (...args: unknown[]) => errors.push(args) },
    encodeURIComponent,
    Date,
  })
  return { fetched, errors, events }
}

describe('extension loader baseUrl & stylesheet lifecycle', () => {
  it('replaces marked stylesheets cleanly and resolves baseUrl across fallback chain without hardcoded st-stage', async () => {
    expect(buildLoaderStub()).not.toContain('/scripts/extensions/third-party/st-stage')

    const fromCurrent = runLoaderStub({
      currentScriptSrc: 'https://st.local/scripts/extensions/third-party/custom-baigong/index.js?v=1',
      markedStyles: 1,
    })
    await new Promise((resolve) => setTimeout(resolve, 0))
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(fromCurrent.fetched).toEqual(['https://st.local/scripts/extensions/third-party/custom-baigong/version.json'])
    expect(fromCurrent.events).toEqual(['remove:0', 'attr:data-st-stage-style', 'append'])

    expect(runLoaderStub({
      stack: 'Error\n    at baseUrl (https://st.local/scripts/extensions/third-party/my-stage/index.js?v=2:12:15)',
    }).fetched).toEqual(['https://st.local/scripts/extensions/third-party/my-stage/version.json'])

    expect(runLoaderStub({
      stack: 'at <anonymous>:1:1',
      scripts: ['/scripts/extensions/third-party/renamed-ext/index.js'],
    }).fetched).toEqual(['/scripts/extensions/third-party/renamed-ext/version.json'])

    expect(runLoaderStub({
      stack: '',
      links: [
        '/scripts/extensions/third-party/other-ext/style.css',
        '/scripts/extensions/third-party/st-stage-ext/style.css?v=3',
      ],
    }).fetched).toEqual(['/scripts/extensions/third-party/st-stage-ext/version.json'])

    expect(runLoaderStub({
      stack: '',
      resources: ['https://st.local/scripts/extensions/third-party/custom-renamed/index.js'],
    }).fetched).toEqual(['https://st.local/scripts/extensions/third-party/custom-renamed/version.json'])

    const failed = runLoaderStub({ stack: '' })
    expect(failed.fetched).toEqual([])
    expect(failed.errors.length).toBe(1)
  })
})
