import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { lstatSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'

export const runtimeFiles = ['manifest.json', 'index.js', 'bundle.js', 'style.css', 'version.json', 'locales/zh-CN.json', 'locales/en-US.json']
export const baseFiles = [...runtimeFiles, 'README.md']

export function chunkFiles(root) {
  return readdirSync(root).filter(name => /^chunk-[A-Z0-9]+\.js$/.test(name)).sort()
}

export function verifyChunks(root) {
  const files = chunkFiles(root), reached = new Set(), pending = ['bundle.js']
  while (pending.length) {
    const current = pending.pop()
    if (reached.has(current)) continue
    reached.add(current)
    const source = readFileSync(checkedPath(root, current), 'utf8')
    for (const match of source.matchAll(/["']\.\/(chunk-[A-Z0-9]+\.js)["']/g)) {
      if (!files.includes(match[1])) throw new Error('missing imported chunk: ' + match[1])
      pending.push(match[1])
    }
  }
  if (files.some(file => !reached.has(file))) throw new Error('unreferenced chunk in ' + root)
  return files
}

export function option(name, required = true) {
  const index = process.argv.indexOf(name)
  if (index < 0 && !required) return undefined
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error('missing ' + name)
  return path.resolve(process.argv[index + 1])
}

function checkedPath(root, relative) {
  let current = root
  for (const segment of relative.split('/')) {
    if (!segment || segment === '.' || segment === '..') throw new Error('invalid artifact path: ' + relative)
    if (!readdirSync(current).includes(segment)) throw new Error('missing or incorrectly cased file: ' + relative)
    current = path.join(current, segment)
    if (lstatSync(current).isSymbolicLink()) throw new Error('symbolic links are not install artifacts: ' + relative)
  }
  return current
}

export function fileInfo(root, relative) {
  const file = checkedPath(root, relative), stat = lstatSync(file)
  if (!stat.isFile()) throw new Error('not a file: ' + relative)
  return { path: relative, bytes: stat.size, sha256: createHash('sha256').update(readFileSync(file)).digest('hex') }
}

export function assetFiles(root) {
  const files = []
  function walk(relative) {
    const dir = checkedPath(root, relative)
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      const name = relative + '/' + entry.name
      if (entry.isSymbolicLink()) throw new Error('symbolic links are not install artifacts: ' + name)
      if (entry.isDirectory()) walk(name)
      else if (entry.isFile()) files.push(name)
      else throw new Error('unsupported asset: ' + name)
    }
  }
  walk('assets/wechat')
  return files.sort()
}

export function compareFiles(leftRoot, rightRoot, files) {
  const errors = []
  for (const name of files) {
    try {
      const left = fileInfo(leftRoot, name), right = fileInfo(rightRoot, name)
      if (left.sha256 !== right.sha256) errors.push('artifact mismatch: ' + name + ' in ' + rightRoot)
    } catch (error) { errors.push(error.message) }
  }
  if (errors.length) throw new Error(errors.join('\n'))
}

export function verifyArtifacts({ root, distribution, release, preview }) {
  const chunks = verifyChunks(root)
  const assets = assetFiles(root)
  if (!assets.length) throw new Error('assets/wechat must not be empty')
  const targets = [distribution, ...(release ? [release] : []), ...(preview ? [preview] : [])]
  for (const target of targets) {
    if (JSON.stringify(verifyChunks(target)) !== JSON.stringify(chunks)) throw new Error('chunk inventory mismatch in ' + target)
    compareFiles(root, target, chunks)
    const actual = assetFiles(target)
    const missing = assets.filter(name => !actual.includes(name)), extra = actual.filter(name => !assets.includes(name))
    if (missing.length || extra.length) throw new Error(`assets/wechat inventory mismatch in ${target}: missing=[${missing.join(', ')}], extra=[${extra.join(', ')}]`)
    compareFiles(root, target, assets)
  }
  compareFiles(root, distribution, runtimeFiles)
  if (preview) compareFiles(root, preview, runtimeFiles)
  const sourceReadme = checkedPath(root, 'st-extension/distribution-readme.md')
  const generatedReadme = checkedPath(distribution, 'README.md')
  if (readFileSync(sourceReadme, 'utf8').replace(/\r\n/g, '\n') !== readFileSync(generatedReadme, 'utf8')) {
    throw new Error('artifact mismatch: generated README.md does not match distribution-readme.md')
  }
  if (release) compareFiles(distribution, release, baseFiles)
  return [...baseFiles, ...chunks, ...assets].map(name => fileInfo(distribution, name))
}

/** Check the committed tree as well as rebuilt bytes; Git diff alone ignores new chunks. */
export function verifyCommittedArtifacts({ root, distribution, release, preview }) {
  const files = verifyArtifacts({ root, distribution, release, preview })
  const git = (...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  if (path.resolve(root) !== path.resolve(git('rev-parse', '--show-toplevel').trim())) throw new Error('expected Git checkout root')
  const relative = target => {
    const name = path.relative(root, target).split(path.sep).join('/')
    if (!name || name === '..' || name.startsWith('../') || path.isAbsolute(name)) throw new Error('artifact channel must be inside the Git checkout')
    return name
  }
  const channels = [relative(distribution), ...(preview ? [relative(preview)] : [])]
  const generated = files.map(file => file.path)
  const expected = [...generated.filter(name => name !== 'README.md'), ...channels.flatMap(channel => generated.map(name => channel + '/' + name))]
  const committed = new Set(git('ls-tree', '-r', '--name-only', '-z', 'HEAD').split('\0').filter(Boolean))
  const missing = expected.filter(name => !committed.has(name))
  if (missing.length) throw new Error('generated artifacts are not committed: ' + missing.join(', '))
  // Include removed chunks/assets and staged edits, which are absent from the current inventory.
  const changed = git('diff', '--name-only', '-z', 'HEAD', '--', ...runtimeFiles, 'chunk-*.js', 'assets/wechat', 'locales', ...channels)
    .split('\0').filter(Boolean)
  if (changed.length) throw new Error('generated artifacts differ from HEAD: ' + changed.join(', '))
  return files
}
