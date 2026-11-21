import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const defaultRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

function extractBuiltinAppFiles(indexSource) {
  const importMap = new Map()
  for (const match of indexSource.matchAll(/import\s+\{([^}]+)\}\s+from\s+['"](\.[^'"]+)['"]/g)) {
    const relPath = match[2]
    for (const part of match[1].split(',')) {
      const cleaned = part.trim().replace(/^type\s+/, '')
      if (!cleaned) continue
      const alias = cleaned.split(/\s+as\s+/)[1]?.trim() || cleaned
      importMap.set(alias, relPath)
    }
  }
  const bodyMatch = indexSource.match(/export\s+function\s+createBuiltinApps[\s\S]*?return\s*\[([\s\S]*?)\]/)
  if (!bodyMatch) throw new Error('Cannot locate createBuiltinApps return array in st-extension/src/apps/index.ts')
  const files = []
  for (const call of bodyMatch[1].matchAll(/([A-Za-z0-9_$]+)\s*\(/g)) {
    const rel = importMap.get(call[1])
    if (!rel) throw new Error(`Cannot resolve import for builtin app factory: ${call[1]}`)
    files.push(rel.endsWith('.ts') ? rel : `${rel}.ts`)
  }
  return files
}

function extractAppName(appSource, fileLabel) {
  const directI18n = appSource.match(/\bname\s*:\s*t\(\s*['"][^'"]+['"]\s*,\s*['"]([^'"]+)['"]\s*\)/)
  if (directI18n) return directI18n[1]
  const directLiteral = appSource.match(/\bname\s*:\s*['"]([^'"]+)['"]/)
  if (directLiteral) return directLiteral[1]
  throw new Error(`Cannot extract app display name from ${fileLabel}`)
}

function extractReadmeApps(readmeSource) {
  const sectionMatch = readmeSource.match(/当前内置 App：[\s\S]*?\n(\|[\s\S]*?)(?:\n\s*\n|$)/)
  if (!sectionMatch) throw new Error('Cannot locate "当前内置 App：" table in README.md')
  const names = []
  for (const line of sectionMatch[1].split(/\r?\n/)) {
    const trimmed = line.trim()
    if (!trimmed.startsWith('|')) continue
    if (/^\|\s*-+/.test(trimmed) || /^\|\s*App\s*\|/.test(trimmed)) continue
    const bold = trimmed.match(/^\|\s*[^|]*\*\*([^*]+)\*\*\s*\|/)
    if (bold) names.push(bold[1].trim())
  }
  return names
}

export function verifyDocsApps(root = defaultRoot) {
  const appsDir = path.join(root, 'st-extension', 'src', 'apps')
  const indexSource = readFileSync(path.join(appsDir, 'index.ts'), 'utf8')
  const appFiles = extractBuiltinAppFiles(indexSource)
  const codeApps = appFiles.map((rel) => {
    const abs = path.resolve(appsDir, rel)
    return { file: rel, name: extractAppName(readFileSync(abs, 'utf8'), rel) }
  })

  const readmeSource = readFileSync(path.join(root, 'README.md'), 'utf8')
  const docNames = extractReadmeApps(readmeSource)

  const codeSet = new Set(codeApps.map((item) => item.name))
  const docSet = new Set(docNames)
  const missingInDocs = codeApps.filter((item) => !docSet.has(item.name)).map((item) => `${item.name} (${item.file})`)
  const extraInDocs = docNames.filter((name) => !codeSet.has(name))

  const errors = []
  if (missingInDocs.length) errors.push(`README.md missing builtin apps: ${missingInDocs.join(', ')}`)
  if (extraInDocs.length) errors.push(`README.md lists non-builtin apps: ${extraInDocs.join(', ')}`)

  const pkg = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8'))
  const manifest = JSON.parse(readFileSync(path.join(root, 'manifest.json'), 'utf8'))
  if (!pkg.name || pkg.name === 'my-project') {
    errors.push(`package.json name must not be template default: got ${JSON.stringify(pkg.name)}`)
  }
  if (pkg.version !== manifest.version) {
    errors.push(`package.json version (${pkg.version}) does not match manifest.json version (${manifest.version})`)
  }

  if (errors.length) throw new Error(errors.join('\n'))
  return { count: codeApps.length, names: codeApps.map((item) => item.name) }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  try {
    const rootFlag = process.argv.indexOf('--root')
    const root = rootFlag >= 0 && process.argv[rootFlag + 1] ? path.resolve(process.argv[rootFlag + 1]) : defaultRoot
    const result = verifyDocsApps(root)
    console.log(`Docs/App parity passed: ${result.count} builtin apps (${result.names.join(', ')}).`)
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exitCode = 1
  }
}
