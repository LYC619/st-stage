import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, readFileSync, existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
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
