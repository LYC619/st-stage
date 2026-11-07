// Explicit local artifact synchronization. No commit, push, remote update or history rewrite.
import { constants, copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { assetFiles, baseFiles, chunkFiles, verifyChunks, fileInfo, option } from './release-artifacts.mjs'

const within = (parent, child) => {
  const relative = path.relative(parent, child)
  return !relative || (relative !== '..' && !relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))
}
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

function directory(input) {
  if (!input || lstatSync(input).isSymbolicLink() || !lstatSync(input).isDirectory()) throw new Error('expected a real directory: ' + input)
  return realpathSync(input)
}

function safeDestination(root, relative) {
  let current = root
  for (const part of relative.split('/')) {
    if (!part || part === '.' || part === '..' || /[\\:]/.test(part)) throw new Error('invalid artifact path: ' + relative)
    current = path.join(current, part)
    if (existsSync(current) && lstatSync(current).isSymbolicLink()) throw new Error('symbolic link in destination: ' + relative)
  }
  return current
}

function atomicCopy(source, target) {
  mkdirSync(path.dirname(target), { recursive: true })
  const temporary = target + '.sync-' + randomUUID()
  try {
    copyFileSync(source, temporary, constants.COPYFILE_EXCL)
    renameSync(temporary, target)
  } finally { if (existsSync(temporary)) rmSync(temporary) }
}

function sameFiles(root, expected) {
  for (const file of expected) {
    const actual = fileInfo(root, file.path)
    if (actual.sha256 !== file.sha256 || actual.bytes !== file.bytes) throw new Error('artifact verification failed: ' + file.path)
  }
  const assets = assetFiles(root)
  const expectedAssets = expected.filter(file => file.path.startsWith('assets/wechat/')).map(file => file.path).sort()
  if (JSON.stringify(assets) !== JSON.stringify(expectedAssets)) throw new Error('asset inventory changed')
  if (JSON.stringify(chunkFiles(root)) !== JSON.stringify(expected.filter(file => /^chunk-/.test(file.path)).map(file => file.path).sort())) throw new Error('chunk inventory changed')
}

export function syncRelease({ candidate, release, backup, apply = false }, replaceFile = atomicCopy) {
  candidate = directory(candidate); release = directory(release)
  const packageRoot = directory(path.join(candidate, 'package'))
  const report = JSON.parse(readFileSync(path.join(candidate, 'release-report.json'), 'utf8'))
  if (report.format !== 1 || !Array.isArray(report.files)) throw new Error('unsupported candidate report')
  const version = JSON.parse(readFileSync(path.join(packageRoot, 'version.json'), 'utf8')).v
  if (version !== report.version || !/^\d+\.\d+\.\d+\+\d{12}$/.test(version)) throw new Error('candidate version mismatch')
  const expected = [...baseFiles, ...verifyChunks(packageRoot), ...assetFiles(packageRoot)].map(name => fileInfo(packageRoot, name))
  const declared = new Map(report.files.map(file => [file.path, file]))
  if (declared.size !== expected.length || declared.size !== report.files.length || expected.some(file => {
    const entry = declared.get(file.path)
    return entry?.sha256 !== file.sha256 || entry?.bytes !== file.bytes
  })) throw new Error('candidate does not match its hash manifest')
  const portable = new Set(expected.map(file => file.path.normalize('NFC').toLowerCase()))
  if (portable.size !== expected.length) throw new Error('case or Unicode collision in candidate')
  for (const protectedRoot of [candidate, report.sourceRoot, report.distributionRoot].filter(Boolean)) {
    const resolved = existsSync(protectedRoot) ? realpathSync(protectedRoot) : path.resolve(protectedRoot)
    if (within(resolved, release) || within(release, resolved)) throw new Error('release must be separate from candidate and development roots')
  }
  if (report.comparedReleaseRoot && realpathSync(report.comparedReleaseRoot) !== release) throw new Error('release differs from the candidate comparison target')
  if (realpathSync(git(release, 'rev-parse', '--show-toplevel')) !== release) throw new Error('release must be the Git checkout root')
  if (git(release, 'status', '--porcelain', '--untracked-files=all')) throw new Error('release checkout must be clean')
  const head = git(release, 'rev-parse', 'HEAD')
  const tracked = git(release, 'ls-files', '-z').split('\0').filter(Boolean)
  if (baseFiles.some(name => !tracked.includes(name)) || tracked.some(name => !baseFiles.includes(name)
    && !/^chunk-[A-Z0-9]+\.js$/.test(name) && !name.startsWith('assets/wechat/') && !['.gitignore', '.gitattributes', 'LICENSE'].includes(name))) {
    throw new Error('target is not a standalone install-artifact checkout')
  }
  const previous = [...baseFiles, ...chunkFiles(release), ...assetFiles(release)].map(name => fileInfo(release, name))
  const old = new Map(previous.map(file => [file.path, file]))
  const changes = {
    added: expected.filter(file => !old.has(file.path)).map(file => file.path),
    changed: expected.filter(file => old.has(file.path) && old.get(file.path).sha256 !== file.sha256).map(file => file.path),
    removed: previous.filter(file => !declared.has(file.path)).map(file => file.path),
  }
  for (const file of expected) {
    const target = safeDestination(release, file.path)
    if (!old.has(file.path) && existsSync(target)) throw new Error('untracked or incorrectly cased destination exists: ' + file.path)
  }
  const result = { format: 1, state: 'preview', release, sourceHead: head, version, changes }
  if (!apply) return result
  if (!backup || existsSync(backup)) throw new Error('apply requires a new --backup directory')
  backup = path.join(directory(path.dirname(path.resolve(backup))), path.basename(backup))
  for (const protectedRoot of [release, candidate]) {
    if (within(protectedRoot, backup) || within(backup, protectedRoot)) throw new Error('backup must be separate from release and candidate')
  }
  mkdirSync(backup)
  const originals = path.join(backup, 'originals')
  for (const file of previous) atomicCopy(path.join(release, file.path), path.join(originals, file.path))
  sameFiles(originals, previous)
  const receipt = { ...result, state: 'prepared', previous, expected, createdAt: new Date().toISOString() }
  const record = () => writeFileSync(path.join(backup, 'sync-report.json'), JSON.stringify(receipt, null, 2) + '\n')
  record()
  // Recheck immediately before writing: a preview or backup is not permission to
  // replace edits that arrived after the initial inventory.
  sameFiles(release, previous)
  if (git(release, 'rev-parse', 'HEAD') !== head || git(release, 'status', '--porcelain', '--untracked-files=all')) throw new Error('release changed during preparation')
  try {
    for (const name of changes.removed) rmSync(safeDestination(release, name))
    for (const name of [...changes.changed, ...changes.added]) replaceFile(path.join(packageRoot, name), safeDestination(release, name))
    sameFiles(release, expected)
    receipt.state = 'applied'; record()
    return receipt
  } catch (error) {
    const rollbackErrors = []
    for (const name of changes.added) {
      try { const target = safeDestination(release, name); if (existsSync(target)) rmSync(target) }
      catch (failure) { rollbackErrors.push(String(failure)) }
    }
    for (const file of previous) {
      try { atomicCopy(path.join(originals, file.path), safeDestination(release, file.path)) }
      catch (failure) { rollbackErrors.push(String(failure)) }
    }
    try { sameFiles(release, previous) } catch (failure) { rollbackErrors.push(String(failure)) }
    receipt.state = rollbackErrors.length ? 'rollback-failed' : 'rolled-back'
    receipt.error = String(error); receipt.rollbackErrors = rollbackErrors; record()
    throw new Error(`${receipt.state}: ${error.message}; backup: ${backup}`)
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = syncRelease({ candidate: option('--candidate'), release: option('--release'), backup: option('--backup', false), apply: process.argv.includes('--apply') })
    console.log(JSON.stringify(result.state === 'preview' ? result : { state: result.state, version: result.version, changes: result.changes }, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
