// Produces a reviewable local package. Never writes to the release repository or pushes Git.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { assetFiles, baseFiles, chunkFiles, fileInfo, option, verifyArtifacts } from './release-artifacts.mjs'

try {
  const root = option('--root'), distribution = option('--distribution'), output = option('--output')
  const release = option('--release', false), preview = option('--preview', false)
  const files = verifyArtifacts({ root, distribution, preview })
  if (existsSync(output)) throw new Error('output already exists; choose a new directory: ' + output)
  for (const protectedRoot of [distribution, release, preview].filter(Boolean)) {
    const relative = path.relative(protectedRoot, output)
    if (!relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative))) {
      throw new Error('output must be outside distribution, release and preview directories')
    }
  }
  const version = JSON.parse(readFileSync(path.join(distribution, 'version.json'), 'utf8')).v
  if (typeof version !== 'string' || !/^\d+\.\d+\.\d+\+\d{12}$/.test(version)) throw new Error('invalid build version')
  const differences = release ? { added: [], changed: [], removed: [], unchanged: [] } : null
  if (release) {
    // Only inspect install artifacts, never arbitrary files or Git internals in the release clone.
    const previousAssets = existsSync(path.join(release, 'assets/wechat')) ? assetFiles(release) : []
    for (const file of files) {
      if (!existsSync(path.join(release, file.path))) differences.added.push(file.path)
      else differences[fileInfo(release, file.path).sha256 === file.sha256 ? 'unchanged' : 'changed'].push(file.path)
    }
    differences.removed = [...previousAssets, ...chunkFiles(release)].filter(name => !files.some(file => file.path === name))
  }
  mkdirSync(output, { recursive: true })
  const packageRoot = path.join(output, 'package')
  for (const file of files) {
    const target = path.join(packageRoot, file.path)
    mkdirSync(path.dirname(target), { recursive: true })
    copyFileSync(path.join(distribution, file.path), target)
    if (fileInfo(packageRoot, file.path).sha256 !== file.sha256) throw new Error('copy verification failed: ' + file.path)
  }
  // Written last: absence of this report means preparation did not complete.
  writeFileSync(path.join(output, 'release-report.json'), JSON.stringify({
    format: 1, preparedAt: new Date().toISOString(), version,
    sourceRoot: root, distributionRoot: distribution, comparedReleaseRoot: release ?? null,
    scope: 'Local artifact copy and hash verification only; not a build, host acceptance, commit or publication.',
    baseFileCount: baseFiles.length, files, differences,
  }, null, 2) + '\n')
  console.log(`Prepared ${files.length} verified files at ${packageRoot}`)
  if (differences) console.log(`Release differences: ${differences.added.length} added, ${differences.changed.length} changed, ${differences.removed.length} removed, ${differences.unchanged.length} unchanged`)
} catch (error) {
  console.error(error.message)
  process.exitCode = 1
}
