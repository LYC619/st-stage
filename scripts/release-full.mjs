import { execFileSync } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, realpathSync, renameSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { buildExtensionPair } from '../st-extension/build.mjs'
import { baseFiles, fileInfo, verifyArtifacts } from './release-artifacts.mjs'
import { syncRelease } from './sync-release.mjs'

const here = path.dirname(fileURLToPath(import.meta.url))
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trimEnd()
const run = (root, script, args = []) => execFileSync(process.execPath, [path.join(root, script), ...args], { cwd: root, stdio: 'inherit' })
const clean = root => { if (git(root, 'status', '--porcelain', '--untracked-files=all')) throw new Error('checkout must be clean: ' + root) }
const sameRoot = (a, b) => realpathSync(a) === realpathSync(b)
const inside = (a, b) => { const r = path.relative(a, b); return !r || (!r.startsWith('..' + path.sep) && r !== '..' && !path.isAbsolute(r)) }
function checkout(root, expectedRemote) {
  if (!sameRoot(root, git(root, 'rev-parse', '--show-toplevel'))) throw new Error('expected Git checkout root: ' + root)
  if (git(root, 'branch', '--show-current') !== 'main') throw new Error('release requires main: ' + root)
  if (!expectedRemote || git(root, 'remote', 'get-url', 'origin') !== expectedRemote || git(root, 'remote', 'get-url', '--push', 'origin') !== expectedRemote) throw new Error('origin identity mismatch: ' + root)
  const remotes = git(root, 'remote', 'get-url', '--push', '--all', 'origin')
  if (remotes.split('\n').filter(Boolean).length > 1) throw new Error('multiple push URLs are not supported')
}
function remoteHead(root) {
  const lines = git(root, 'ls-remote', '--heads', 'origin', 'refs/heads/main').split('\n').filter(Boolean)
  if (lines.length !== 1 || !/^[a-f0-9]{40}\s/.test(lines[0])) throw new Error('remote main unavailable')
  return lines[0].split(/\s/)[0]
}
function fetchBaseline(root) {
  git(root, 'fetch', 'origin', 'refs/heads/main:refs/remotes/origin/main')
  const head = git(root, 'rev-parse', 'HEAD'), remote = remoteHead(root)
  git(root, 'merge-base', '--is-ancestor', remote, head)
  return { head, remote }
}
function expectedFiles(receipt) {
  for (const file of receipt.files) {
    if (fileInfo(path.join(receipt.candidate, 'package'), file.path).sha256 !== file.sha256) throw new Error('candidate was modified: ' + file.path)
  }
}
function artifactPath(file, files) {
  const names = new Set(files.map(item => item.path))
  return baseFiles.filter(name => name !== 'README.md' && name !== 'manifest.json').includes(file)
    || /^chunk-[A-Z0-9]+\.js$/.test(file)
    || ['st-distribution/', 'public/'].some(prefix => file.startsWith(prefix) && (names.has(file.slice(prefix.length)) || /^chunk-[A-Z0-9]+\.js$/.test(file.slice(prefix.length))))
}
function commitArtifacts(root, message, allowed) {
  const changed = git(root, 'status', '--porcelain', '--untracked-files=all', '-z')
    .split('\0').filter(Boolean).map(line => line.slice(3))
  if (changed.some(file => !allowed(file))) throw new Error('unrelated changes appeared during release')
  if (changed.length) {
    git(root, 'add', '--', ...changed)
    git(root, 'commit', '-m', message)
  }
  clean(root)
  return git(root, 'rev-parse', 'HEAD')
}
async function checksAndBuild(root, env) {
  run(root, 'node_modules/typescript/bin/tsc', ['--noEmit', '--incremental', 'false'])
  run(root, 'node_modules/eslint/bin/eslint.js', ['core', 'st-extension/src', 'lib', 'components', 'app'])
  run(root, 'node_modules/vitest/vitest.mjs', ['run'])
  run(root, 'scripts/verify-i18n-completeness.mjs')
  execFileSync(process.execPath, ['--test', 'scripts/release-tools.test.mjs', 'scripts/sync-release.test.mjs', 'scripts/release-full.test.mjs'], { cwd: root, stdio: 'inherit' })
  run(root, 'node_modules/next/dist/bin/next', ['build'])
  await buildExtensionPair({ sourceRoot: root, env })
}

/** Preview builds a candidate. publish explicitly commits generated artifacts and fast-forwards both origins. */
export async function releaseFull(options, dependencies = {}) {
  const root = realpathSync(options.root), release = realpathSync(options.release), output = path.resolve(options.output)
  if (inside(root, release) || inside(release, root)) throw new Error('development and installation checkouts must be separate')
  if (inside(release, output) || inside(path.join(root, 'st-distribution'), output) || inside(path.join(root, 'public'), output) || inside(output, root)) throw new Error('unsafe output directory')
  const sourceRemote = options.sourceRemote, releaseRemote = options.releaseRemote
  checkout(root, sourceRemote); checkout(release, releaseRemote)
  const receiptPath = path.join(output, 'release-full.json')
  let receipt
  if (options.resume) {
    receipt = JSON.parse(readFileSync(receiptPath, 'utf8'))
    if (receipt.format !== 1 || receipt.root !== root || receipt.release !== release || receipt.sourceRemote !== sourceRemote || receipt.releaseRemote !== releaseRemote || receipt.output !== output) throw new Error('receipt does not match repositories')
    expectedFiles(receipt)
  } else {
    if (existsSync(output)) throw new Error('choose a new output directory, or use --resume')
    clean(root); clean(release)
    const source = fetchBaseline(root), target = fetchBaseline(release)
    if (target.head !== target.remote) throw new Error('installation checkout must equal origin/main')
    mkdirSync(output, { recursive: true })
    receipt = { format: 1, state: 'checking', root, release, output, sourceRemote, releaseRemote,
      sourceBaseline: source.head, sourceRemoteBaseline: source.remote, releaseBaseline: target.head, releaseRemoteBaseline: target.remote,
      candidate: path.join(output, 'candidate'), backup: path.join(output, 'backup'), files: [], createdAt: new Date().toISOString() }
  }
  const record = () => {
    writeFileSync(receiptPath + '.tmp', JSON.stringify(receipt, null, 2) + '\n')
    renameSync(receiptPath + '.tmp', receiptPath)
  }
  record()
  try {
    if (receipt.state === 'checking') {
      if (options.resume) throw new Error('checks were interrupted; preserve this receipt and start a new run after reviewing the worktree')
      await (dependencies.checksAndBuild ?? checksAndBuild)(root, options.env ?? process.env)
      if (git(root, 'rev-parse', 'HEAD') !== receipt.sourceBaseline || git(release, 'rev-parse', 'HEAD') !== receipt.releaseBaseline) throw new Error('HEAD changed during checks')
      receipt.files = verifyArtifacts({ root, distribution: path.join(root, 'st-distribution'), preview: path.join(root, 'public') })
      execFileSync(process.execPath, [path.join(here, 'prepare-release.mjs'), '--root', root, '--distribution', path.join(root, 'st-distribution'), '--preview', path.join(root, 'public'), '--release', release, '--output', receipt.candidate], { stdio: 'pipe' })
      syncRelease({ candidate: receipt.candidate, release }) // dry-run target identity and inventory validation
      receipt.version = JSON.parse(readFileSync(path.join(root, 'version.json'), 'utf8')).v
      receipt.state = 'prepared'; record()
    }
    expectedFiles(receipt)
    if (!options.publish) return receipt
    if (receipt.state === 'complete') {
      clean(root); clean(release)
      if (remoteHead(root) !== receipt.sourceCommit || remoteHead(release) !== receipt.releaseCommit) throw new Error('remote has advanced since completion')
      return receipt
    }
    const sourceHead = git(root, 'rev-parse', 'HEAD'), targetHead = git(release, 'rev-parse', 'HEAD')
    if (sourceHead !== (receipt.sourceCommit ?? receipt.sourceBaseline) || targetHead !== (receipt.releaseCommit ?? receipt.releaseBaseline)) throw new Error('checkout HEAD differs from receipt; inspect before resuming')
    for (const [repo, baseline, committed] of [[root, receipt.sourceRemoteBaseline, receipt.sourceCommit], [release, receipt.releaseRemoteBaseline, receipt.releaseCommit]]) {
      const remote = remoteHead(repo)
      if (remote !== baseline && remote !== committed) throw new Error('remote drift; refusing to publish')
    }
    verifyArtifacts({ root, distribution: path.join(root, 'st-distribution'), preview: path.join(root, 'public') })
    for (const file of receipt.files) if (fileInfo(path.join(root, 'st-distribution'), file.path).sha256 !== file.sha256) throw new Error('build differs from candidate')
    if (!receipt.sourceCommit) {
      receipt.sourceCommit = commitArtifacts(root, 'build: release ' + receipt.version, file => artifactPath(file, receipt.files)); record()
    } else clean(root)
    if (!receipt.releaseCommit) {
      if (existsSync(path.join(receipt.backup, 'sync-report.json'))) {
        const sync = JSON.parse(readFileSync(path.join(receipt.backup, 'sync-report.json'), 'utf8'))
        if (sync.state !== 'applied') throw new Error('synchronization requires recovery from backup: ' + receipt.backup)
        verifyArtifacts({ root, distribution: path.join(root, 'st-distribution'), release })
      } else syncRelease({ candidate: receipt.candidate, release, backup: receipt.backup, apply: true })
      receipt.state = 'synchronized'; record()
      receipt.releaseCommit = commitArtifacts(release, 'release: ' + receipt.version,
        file => baseFiles.includes(file) || /^chunk-[A-Z0-9]+\.js$/.test(file) || file.startsWith('assets/wechat/'))
      receipt.state = 'committed'; record()
    } else clean(release)
    clean(root); clean(release)
    for (const [repo, baseline, committed] of [[root, receipt.sourceRemoteBaseline, receipt.sourceCommit], [release, receipt.releaseRemoteBaseline, receipt.releaseCommit]]) {
      const remote = remoteHead(repo)
      if (remote !== baseline && remote !== committed) throw new Error('remote drift before push')
    }
    for (const [repo, key, commit] of [[root, 'sourcePushed', receipt.sourceCommit], [release, 'releasePushed', receipt.releaseCommit]]) {
      if (remoteHead(repo) !== commit) {
        git(repo, 'push', 'origin', commit + ':refs/heads/main')
        if (remoteHead(repo) !== commit) throw new Error('push did not publish expected commit')
      }
      receipt[key] = true; receipt.state = key === 'sourcePushed' ? 'source-pushed' : 'complete'; record()
    }
    return receipt
  } catch (error) {
    receipt.error = error instanceof Error ? error.message : String(error); record()
    throw new Error(receipt.error + '; receipt: ' + receiptPath, { cause: error })
  }
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const args = process.argv.slice(2), get = key => { const i = args.indexOf(key); return i < 0 ? undefined : args[i + 1] }
  if (args.includes('--help')) console.log('release:full --release <checkout> --output <new ignored directory> [--publish] [--resume]\nOptional: --root, --source-remote, --release-remote. Default is checked candidate preparation; --publish commits artifacts and pushes both main branches without force.')
  else try {
    const result = await releaseFull({ root: get('--root') || '.', release: get('--release') || '../st-stage-ext',
      output: get('--output') || (() => { throw new Error('--output is required') })(),
      sourceRemote: get('--source-remote') || 'https://github.com/LYC619/st-stage.git',
      releaseRemote: get('--release-remote') || 'https://github.com/LYC619/st-stage-ext.git',
      publish: args.includes('--publish'), resume: args.includes('--resume') })
    console.log(JSON.stringify({ state: result.state, version: result.version, output: result.output }, null, 2))
  } catch (error) { console.error(error.message); process.exitCode = 1 }
}
