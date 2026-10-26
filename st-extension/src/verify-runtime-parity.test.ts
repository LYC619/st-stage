import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, renameSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

const runtimeFiles = ['manifest.json', 'index.js', 'bundle.js', 'style.css', 'version.json', 'locales/zh-CN.json', 'locales/en-US.json']

describe('verify-runtime-parity', { timeout: 15000 }, () => {
  let temp: string
  let roots: Record<'root' | 'distribution' | 'release', string>

  beforeEach(() => {
    temp = mkdtempSync(path.join(os.tmpdir(), 'st-stage-parity-'))
    roots = { root: path.join(temp, 'root'), distribution: path.join(temp, 'distribution'), release: path.join(temp, 'release') }
    for (const directory of Object.values(roots)) {
      mkdirSync(directory)
      mkdirSync(path.join(directory, 'locales'))
      for (const file of [...runtimeFiles, 'README.md']) writeFileSync(path.join(directory, file), 'synthetic-' + file)
    }
    writeFileSync(path.join(roots.root, 'README.md'), 'development README is intentionally different')
  })

  afterEach(() => { rmSync(temp, { recursive: true, force: true }) })

  function run(withRelease = true) {
    return spawnSync(process.execPath, [
      'scripts/verify-runtime-parity.mjs', '--root', roots.root,
      '--distribution', roots.distribution, ...(withRelease ? ['--release', roots.release] : []),
    ], { cwd: process.cwd(), encoding: 'utf8' })
  }

  it('accepts all matching runtime files and only the distribution README', () => {
    const result = run()
    expect(result.status, result.stderr).toBe(0)
    expect(result.stdout).toContain('sha256=')
  })

  it('checks local build parity without requiring an independent release', () => {
    writeFileSync(path.join(roots.release, 'bundle.js'), 'old release')
    expect(run(false).status).toBe(0)
    writeFileSync(path.join(roots.distribution, 'locales/en-US.json'), 'drift')
    expect(run(false).status).toBe(1)
  })

  it.each(['missing', 'drift', 'directory', 'case', 'parent-case', 'escape'])('rejects invalid locale assets: %s', (mode) => {
    const file = path.join(roots.release, 'locales/en-US.json')
    if (mode === 'drift') writeFileSync(file, 'drift')
    if (mode === 'missing' || mode === 'directory' || mode === 'case') rmSync(file)
    if (mode === 'directory') mkdirSync(file)
    if (mode === 'case') writeFileSync(path.join(roots.release, 'locales/en-us.json'), 'synthetic-locales/en-US.json')
    if (mode === 'parent-case') renameSync(path.join(roots.release, 'locales'), path.join(roots.release, 'Locales'))
    if (mode === 'escape') {
      const outside = path.join(temp, 'outside')
      renameSync(path.join(roots.release, 'locales'), outside)
      symlinkSync(outside, path.join(roots.release, 'locales'), 'junction')
    }
    const result = run()
    expect(result.status, result.stdout).toBe(1)
    expect(result.stderr).toContain('locales')
  })

  it.each(['root', 'distribution', 'release'] as const)('rejects bundle drift in %s', (directory) => {
    writeFileSync(path.join(roots[directory], 'bundle.js'), 'drift')
    const result = run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('bundle.js')
  })

  it('reports every runtime and README mismatch in one run', () => {
    for (const file of ['bundle.js', 'style.css', 'README.md']) writeFileSync(path.join(roots.release, file), 'drift')
    const result = run()
    expect(result.status).not.toBe(0)
    for (const file of ['bundle.js', 'style.css', 'README.md']) expect(result.stderr).toContain(file)
  })

  it.each(['missing', 'directory', 'case'])('rejects an invalid release file: %s', (mode) => {
    const file = path.join(roots.release, 'README.md')
    rmSync(file)
    if (mode === 'directory') mkdirSync(file)
    if (mode === 'case') writeFileSync(path.join(roots.release, 'readme.md'), 'synthetic-README.md')
    const result = run()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('README.md')
  })
})
