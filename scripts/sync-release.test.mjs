import assert from 'node:assert/strict'
import { copyFileSync, cpSync, existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { baseFiles, assetFiles, fileInfo } from './release-artifacts.mjs'
import { syncRelease } from './sync-release.mjs'

const scripts = path.dirname(fileURLToPath(import.meta.url))
function put(root, file, value) {
  mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
  writeFileSync(path.join(root, file), value)
}
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
const snapshot = root => [...baseFiles, ...assetFiles(root)].map(file => fileInfo(root, file))
function fixture(t) {
  const base = mkdtempSync(path.join(os.tmpdir(), 'st-sync-release-'))
  t.after(() => {
    assert.ok(path.dirname(base) === os.tmpdir(), 'cleanup stays in the generated temp directory')
    rmSync(base, { recursive: true, force: true })
  })
  const root = path.join(base, 'source'), distribution = path.join(base, 'distribution'), release = path.join(base, 'release')
  for (const file of baseFiles) put(distribution, file, file + '\n')
  put(distribution, 'version.json', '{"v":"0.9.0+202611042200"}\n')
  put(distribution, 'assets/wechat/a.png', 'new image')
  cpSync(distribution, root, { recursive: true })
  put(root, 'st-extension/distribution-readme.md', 'README.md\n')
  cpSync(distribution, release, { recursive: true })
  put(release, 'bundle.js', 'old bundle')
  put(release, 'style.css', 'old style')
  put(release, 'assets/wechat/old.png', 'obsolete image')
  rmSync(path.join(release, 'assets/wechat/a.png'))
  git(release, 'init', '-q')
  git(release, 'config', 'core.autocrlf', 'false')
  git(release, 'add', '.')
  git(release, '-c', 'user.name=Release Test', '-c', 'user.email=release-test@example.invalid', 'commit', '--no-gpg-sign', '-qm', 'fixture')
  const candidate = path.join(base, 'candidate'), backup = path.join(base, 'backup')
  execFileSync(process.execPath, [path.join(scripts, 'prepare-release.mjs'), '--root', root, '--distribution', distribution, '--release', release, '--output', candidate], { stdio: 'pipe' })
  return { base, root, distribution, release, candidate, backup }
}

test('preview has no side effects; explicit apply matches the candidate and preserves Git history', t => {
  const f = fixture(t), before = snapshot(f.release), head = git(f.release, 'rev-parse', 'HEAD')
  const preview = syncRelease(f)
  assert.equal(preview.state, 'preview')
  assert.deepEqual(preview.changes, { added: ['assets/wechat/a.png'], changed: ['bundle.js', 'style.css'], removed: ['assets/wechat/old.png'] })
  assert.deepEqual(snapshot(f.release), before)
  assert.equal(existsSync(f.backup), false)
  const applied = syncRelease({ ...f, apply: true })
  assert.equal(applied.state, 'applied')
  assert.deepEqual(snapshot(f.release), snapshot(path.join(f.candidate, 'package')))
  assert.deepEqual(snapshot(path.join(f.backup, 'originals')), before)
  assert.equal(git(f.release, 'rev-parse', 'HEAD'), head)
  assert.match(git(f.release, 'status', '--porcelain'), /bundle.js/)
})

test('an interrupted file write rolls back every artifact and preserves the backup', t => {
  const f = fixture(t), before = snapshot(f.release)
  let count = 0
  assert.throws(() => syncRelease({ ...f, apply: true }, (source, target) => {
    if (++count === 2) throw new Error('simulated disk failure')
    copyFileSync(source, target)
  }), /rolled-back: simulated disk failure/)
  assert.deepEqual(snapshot(f.release), before)
  assert.equal(git(f.release, 'status', '--porcelain'), '')
  assert.equal(JSON.parse(readFileSync(path.join(f.backup, 'sync-report.json'))).state, 'rolled-back')
})

test('dirty targets and a different checkout are rejected before making a backup', t => {
  const f = fixture(t)
  put(f.release, 'bundle.js', 'local work')
  assert.throws(() => syncRelease({ ...f, apply: true }), /clean/)
  assert.equal(readFileSync(path.join(f.release, 'bundle.js'), 'utf8'), 'local work')
  assert.equal(existsSync(f.backup), false)
  assert.throws(() => syncRelease({ ...f, release: f.root, apply: true }), /separate/)
})

test('tampered candidates are rejected, including forged manifest paths', t => {
  const f = fixture(t), before = snapshot(f.release)
  put(path.join(f.candidate, 'package'), 'bundle.js', 'tampered')
  assert.throws(() => syncRelease({ ...f, apply: true }), /hash manifest/)
  copyFileSync(path.join(f.distribution, 'bundle.js'), path.join(f.candidate, 'package/bundle.js'))
  const reportPath = path.join(f.candidate, 'release-report.json'), report = JSON.parse(readFileSync(reportPath))
  report.files[0].path = '../outside'
  writeFileSync(reportPath, JSON.stringify(report))
  assert.throws(() => syncRelease({ ...f, apply: true }), /hash manifest/)
  assert.deepEqual(snapshot(f.release), before)
})

test('requires a separate new backup directory and does not follow a destination junction', t => {
  const f = fixture(t), before = snapshot(f.release)
  assert.throws(() => syncRelease({ ...f, backup: path.join(f.release, 'backup'), apply: true }), /separate/)
  assert.throws(() => syncRelease({ ...f, backup: f.candidate, apply: true }), /new --backup/)
  const outside = path.join(f.base, 'outside')
  cpSync(path.join(f.release, 'assets/wechat'), outside, { recursive: true })
  rmSync(path.join(f.release, 'assets/wechat'), { recursive: true })
  symlinkSync(outside, path.join(f.release, 'assets/wechat'), process.platform === 'win32' ? 'junction' : 'dir')
  assert.throws(() => syncRelease({ ...f, apply: true }), /symbolic|clean/)
  assert.equal(readFileSync(path.join(outside, 'old.png'), 'utf8'), 'obsolete image')
  assert.equal(existsSync(f.backup), false)
  assert.deepEqual(snapshot(f.distribution).filter(file => file.path === 'version.json'), before.filter(file => file.path === 'version.json'))
})
