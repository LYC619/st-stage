import assert from 'node:assert/strict'
import { cpSync, mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const scripts = path.dirname(fileURLToPath(import.meta.url))
const runtime = ['manifest.json', 'index.js', 'bundle.js', 'style.css', 'version.json', 'locales/zh-CN.json', 'locales/en-US.json']
function put(root, name, value = name) {
  mkdirSync(path.dirname(path.join(root, name)), { recursive: true })
  writeFileSync(path.join(root, name), value)
}
function fixture(t) {
  const base = mkdtempSync(path.join(os.tmpdir(), 'st-release-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  const root = path.join(base, 'source'), distribution = path.join(base, 'distribution')
  for (const dir of [root, distribution]) {
    for (const file of runtime) put(dir, file)
    put(dir, 'version.json', '{"v":"0.9.0+202610261121"}\n')
    put(dir, 'assets/wechat/ui/wechat.png', 'synthetic image bytes')
  }
  put(root, 'st-extension/distribution-readme.md', '# Install\r\n')
  put(distribution, 'README.md', '# Install\n')
  return { base, root, distribution }
}
function run(script, args) {
  return spawnSync(process.execPath, [path.join(scripts, script), ...args], { encoding: 'utf8' })
}
function parity(f) {
  return run('verify-runtime-parity.mjs', ['--root', f.root, '--distribution', f.distribution])
}

test('matching artifacts and assets pass', t => {
  const f = fixture(t), result = parity(f)
  assert.equal(result.status, 0, result.stderr)
})
for (const mutation of ['missing', 'changed', 'extra']) {
  test(`parity rejects ${mutation} distribution assets`, t => {
    const f = fixture(t), image = path.join(f.distribution, 'assets/wechat/ui/wechat.png')
    if (mutation === 'missing') rmSync(image)
    if (mutation === 'changed') writeFileSync(image, 'corrupt')
    if (mutation === 'extra') put(f.distribution, 'assets/wechat/obsolete.png')
    const result = parity(f)
    assert.notEqual(result.status, 0, 'asset defect must fail parity')
    assert.match(result.stderr, /assets\/wechat/)
  })
}
test('parity rejects stale generated README', t => {
  const f = fixture(t)
  put(f.distribution, 'README.md', 'outdated instructions')
  assert.notEqual(parity(f).status, 0)
})

test('prepare creates a verified isolated package and records differences without changing release', t => {
  const f = fixture(t), release = path.join(f.base, 'release'), output = path.join(f.base, 'prepared')
  mkdirSync(release)
  put(release, 'bundle.js', 'old bundle')
  put(release, 'assets/wechat/obsolete.png', 'old asset')
  const result = run('prepare-release.mjs', ['--root', f.root, '--distribution', f.distribution, '--output', output, '--release', release])
  assert.equal(result.status, 0, result.stderr)
  const report = JSON.parse(readFileSync(path.join(output, 'release-report.json'), 'utf8'))
  assert.equal(report.files.length, 9)
  assert.equal(report.version, '0.9.0+202610261121')
  assert.ok(report.differences.changed.includes('bundle.js'))
  assert.ok(report.differences.removed.includes('assets/wechat/obsolete.png'))
  assert.ok(report.files.every(file => /^[a-f0-9]{64}$/.test(file.sha256)))
  assert.equal(readFileSync(path.join(release, 'bundle.js'), 'utf8'), 'old bundle')
  assert.equal(readFileSync(path.join(output, 'package/assets/wechat/ui/wechat.png'), 'utf8'), 'synthetic image bytes')
  const again = run('prepare-release.mjs', ['--root', f.root, '--distribution', f.distribution, '--output', output])
  assert.notEqual(again.status, 0, 'must not overwrite an existing package')
})
test('invalid artifacts produce no prepared directory', t => {
  const f = fixture(t), output = path.join(f.base, 'prepared')
  put(f.distribution, 'bundle.js', 'stale')
  const result = run('prepare-release.mjs', ['--root', f.root, '--distribution', f.distribution, '--output', output])
  assert.notEqual(result.status, 0)
  assert.equal(existsSync(output), false)
})

test('chunk graph parity rejects missing, modified and orphan chunks', t => {
  const f = fixture(t)
  for (const root of [f.root, f.distribution]) {
    put(root, 'bundle.js', 'import("./chunk-ABC123.js")')
    put(root, 'chunk-ABC123.js', 'export const value = 1')
  }
  assert.equal(parity(f).status, 0)
  rmSync(path.join(f.distribution, 'chunk-ABC123.js'))
  assert.notEqual(parity(f).status, 0)
  put(f.distribution, 'chunk-ABC123.js', 'changed')
  assert.notEqual(parity(f).status, 0)
  put(f.distribution, 'chunk-ABC123.js', 'export const value = 1')
  put(f.distribution, 'chunk-ORPHAN.js', 'stale')
  assert.notEqual(parity(f).status, 0)
})

function committedFixture(t) {
  const f = fixture(t)
  const distribution = path.join(f.root, 'st-distribution'), preview = path.join(f.root, 'public')
  cpSync(f.distribution, distribution, { recursive: true })
  cpSync(f.distribution, preview, { recursive: true })
  for (const root of [f.root, distribution, preview]) {
    put(root, 'bundle.js', 'import "./chunk-SHARED.js"; import("./chunk-LAZY.js")\n')
    put(root, 'chunk-SHARED.js', 'export const shared = 1\n')
    put(root, 'chunk-LAZY.js', 'import "./chunk-SHARED.js"; export const lazy = 2\n')
  }
  const git = (...args) => execFileSync('git', ['-C', f.root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  git('init', '-q'); git('config', 'core.autocrlf', 'false')
  git('add', '.')
  git('-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'artifacts')
  const verify = () => run('verify-runtime-parity.mjs', ['--root', f.root, '--distribution', distribution, '--preview', preview, '--committed'])
  return { ...f, distribution, preview, git, verify }
}

test('committed artifact verification accepts the complete module graph and all channels', t => {
  const f = committedFixture(t), result = f.verify()
  assert.equal(result.status, 0, result.stderr)
})

for (const file of ['chunk-SHARED.js', 'st-distribution/chunk-LAZY.js', 'public/chunk-SHARED.js', 'public/locales/en-US.json']) {
  test(`committed artifact verification rejects a generated but uncommitted ${file}`, t => {
    const f = committedFixture(t)
    f.git('rm', '--cached', file)
    f.git('-c', 'user.name=Release Test', '-c', 'user.email=release@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'omit artifact')
    const result = f.verify()
    assert.notEqual(result.status, 0, 'rebuilding an omitted artifact must not conceal it from CI')
    assert.match(result.stderr, /not committed/)
    assert.ok(result.stderr.includes(file), result.stderr)
  })
}

test('committed artifact verification rejects staged and unstaged artifact changes', t => {
  const f = committedFixture(t)
  for (const root of [f.root, f.distribution, f.preview]) put(root, 'chunk-SHARED.js', 'export const shared = 9\n')
  assert.notEqual(f.verify().status, 0)
  f.git('add', '.')
  assert.notEqual(f.verify().status, 0, 'staging regenerated files is not committing them')
})

test('verify-docs-apps accepts synced README app table and rejects missing or extra entries', t => {
  const base = mkdtempSync(path.join(os.tmpdir(), 'st-docs-apps-'))
  t.after(() => rmSync(base, { recursive: true, force: true }))
  put(base, 'package.json', JSON.stringify({ name: 'st-stage', version: '0.9.0' }))
  put(base, 'manifest.json', JSON.stringify({ version: '0.9.0' }))
  put(base, 'st-extension/src/apps/index.ts', [
    "import { alphaApp } from './alpha-app'",
    "import { createBetaApp } from './beta/beta-app'",
    'export function createBuiltinApps() { return [alphaApp(), createBetaApp()] }',
  ].join('\n'))
  put(base, 'st-extension/src/apps/alpha-app.ts', "export const alphaApp = () => ({ id: 'alpha', name: t('apps.alpha', '甲') })")
  put(base, 'st-extension/src/apps/beta/beta-app.ts', "export const createBetaApp = () => ({ id: 'beta', name: '乙' })")
  put(base, 'README.md', '当前内置 App：\n\n| App | 一句话 |\n| --- | --- |\n| 🅰 **甲** | 说明 |\n| 🅱 **乙** | 说明 |\n\n')

  const ok = run('verify-docs-apps.mjs', ['--root', base])
  assert.equal(ok.status, 0, ok.stderr)

  put(base, 'README.md', '当前内置 App：\n\n| App | 一句话 |\n| --- | --- |\n| 🅰 **甲** | 说明 |\n\n')
  const missing = run('verify-docs-apps.mjs', ['--root', base])
  assert.notEqual(missing.status, 0)
  assert.match(missing.stderr, /missing builtin apps/)

  put(base, 'README.md', '当前内置 App：\n\n| App | 一句话 |\n| --- | --- |\n| 🅰 **甲** | 说明 |\n| 🅱 **乙** | 说明 |\n| 🅲 **丙** | 多余 |\n\n')
  const extra = run('verify-docs-apps.mjs', ['--root', base])
  assert.notEqual(extra.status, 0)
  assert.match(extra.stderr, /non-builtin apps/)

  put(base, 'README.md', '当前内置 App：\n\n| App | 一句话 |\n| --- | --- |\n| 🅰 **甲** | 说明 |\n| 🅱 **乙** | 说明 |\n\n')
  put(base, 'package.json', JSON.stringify({ name: 'my-project', version: '0.1.0' }))
  const badMeta = run('verify-docs-apps.mjs', ['--root', base])
  assert.notEqual(badMeta.status, 0)
  assert.match(badMeta.stderr, /my-project/)
  assert.match(badMeta.stderr, /does not match manifest\.json/)
})
