import { createHash } from 'node:crypto'
import { readFileSync, readdirSync, realpathSync, statSync } from 'node:fs'
import path from 'node:path'

const runtimeFiles = ['manifest.json', 'index.js', 'bundle.js', 'style.css', 'version.json']
const errors = []

function option(name) {
  const index = process.argv.indexOf(name)
  if (index < 0 || !process.argv[index + 1] || process.argv[index + 1].startsWith('--')) throw new Error('missing ' + name)
  return path.resolve(process.cwd(), process.argv[index + 1])
}

function fileInfo(root, relative) {
  if (!readdirSync(root).includes(relative)) throw new Error('missing or incorrectly cased file: ' + path.join(root, relative))
  const file = path.resolve(root, relative)
  const relativeResolved = path.relative(realpathSync(root), realpathSync(file))
  if (relativeResolved.startsWith('..' + path.sep) || path.isAbsolute(relativeResolved)) {
    throw new Error('path escapes root: ' + relative)
  }
  const stat = statSync(file)
  if (!stat.isFile()) throw new Error('not a file: ' + file)
  const hash = createHash('sha256').update(readFileSync(file)).digest('hex')
  return { file, bytes: stat.size, hash }
}

function compareRoots(leftRoot, rightRoot, rightLabel, files = runtimeFiles) {
  for (const relative of files) {
    try {
      const left = fileInfo(leftRoot, relative)
      const right = fileInfo(rightRoot, relative)
      console.log(relative + ' ' + left.bytes + ' bytes sha256=' + left.hash)
      console.log('  ' + rightLabel + ': ' + right.bytes + ' bytes sha256=' + right.hash)
      if (left.bytes !== right.bytes || left.hash !== right.hash) {
        errors.push('artifact mismatch (' + rightLabel + '): ' + relative)
      }
    } catch (error) {
      errors.push(error.message)
    }
  }
}

const root = option('--root')
const distribution = option('--distribution')
const release = option('--release')
compareRoots(root, distribution, 'distribution')
compareRoots(distribution, release, 'release')
compareRoots(distribution, release, 'release README', ['README.md'])
if (errors.length) {
  console.error(errors.join('\n'))
  process.exitCode = 1
}
