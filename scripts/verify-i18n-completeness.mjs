import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const placeholders = text => [...new Set(Array.from(text.matchAll(/\{\{([^{}]+)\}\}/g), match => match[1]))].sort()

function flatten(value, locale, errors, prefix = '', entries = new Map()) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    errors.push(`${locale}:${prefix || '<root>'}: expected a dictionary`)
    return entries
  }
  for (const [name, text] of Object.entries(value)) {
    const key = prefix ? `${prefix}.${name}` : name
    if (!name || name.includes('.')) errors.push(`${locale}:${key}: invalid key segment`)
    if (typeof text === 'string') {
      if (!text.trim()) errors.push(`${locale}:${key}: blank translation`)
      entries.set(key, text)
    } else {
      flatten(text, locale, errors, key, entries)
    }
  }
  return entries
}

export function verifyDictionaries(zh, en) {
  const errors = []
  const source = flatten(zh, 'zh-CN', errors)
  const translated = flatten(en, 'en-US', errors)
  if (!source.size) errors.push('zh-CN: dictionary is empty')
  for (const key of new Set([...source.keys(), ...translated.keys()])) {
    if (!source.has(key) || !translated.has(key)) {
      errors.push(`${key}: missing in ${source.has(key) ? 'en-US' : 'zh-CN'}`)
    } else if (JSON.stringify(placeholders(source.get(key))) !== JSON.stringify(placeholders(translated.get(key)))) {
      errors.push(`${key}: placeholder names differ across locales`)
    }
  }
  return { errors, entries: source }
}

function literal(node) {
  if (!node) return undefined
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = literal(node.left), right = literal(node.right)
    if (left !== undefined && right !== undefined) return left + right
  }
}

export function verifySource(code, filename, entries) {
  const errors = []
  let references = 0
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true)
  const aliases = new Set()
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement) || !ts.isStringLiteral(statement.moduleSpecifier)
      || !/(?:^|\/)i18n(?:\.[cm]?[jt]s)?$/.test(statement.moduleSpecifier.text)) continue
    const bindings = statement.importClause?.namedBindings
    if (bindings && ts.isNamedImports(bindings)) {
      for (const binding of bindings.elements) if ((binding.propertyName ?? binding.name).text === 't') aliases.add(binding.name.text)
    }
  }
  function visit(node) {
    if (ts.isCallExpression(node) && ts.isIdentifier(node.expression) && aliases.has(node.expression.text)) {
      references++
      const key = literal(node.arguments[0])
      const location = `${filename}:${source.getLineAndCharacterOfPosition(node.getStart()).line + 1}`
      const error = message => errors.push(`${location}: ${key ?? '<dynamic>'}: ${message}`)
      if (key === undefined) error('use a static translation key')
      else if (!entries.has(key)) error('key missing from dictionaries')
      else {
        const fallback = literal(node.arguments[1])
        const text = entries.get(key)
        if (node.arguments[1] && fallback === undefined) error('use a static string fallback')
        if (fallback !== undefined && fallback !== text) error('fallback differs from zh-CN translation')
        const required = placeholders(text)
        const params = node.arguments[2]
        if (required.length && !params) error(`missing parameter(s): ${required.join(', ')}`)
        else if (params && (!ts.isObjectLiteralExpression(params) || params.properties.some(ts.isSpreadAssignment))) {
          error('use a static parameter object without spreads')
        } else if (params) {
          const names = params.properties.map(property => property.name && (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) ? property.name.text : '')
          const missing = required.filter(name => !names.includes(name))
          if (missing.length) error(`missing parameter(s): ${missing.join(', ')}`)
        }
      }
    }
    ts.forEachChild(node, visit)
  }
  visit(source)
  return { errors, references }
}

function sourceFiles(directory) {
  return readdirSync(directory, { withFileTypes: true }).flatMap(entry => {
    const filename = path.join(directory, entry.name)
    return entry.isDirectory() ? sourceFiles(filename) : /\.[jt]sx?$/.test(entry.name) && !/\.(test|spec)\./.test(entry.name) ? [filename] : []
  })
}

export function verifyProject(root) {
  const read = locale => JSON.parse(readFileSync(path.join(root, 'st-extension', 'locales', `${locale}.json`), 'utf8'))
  const { errors, entries } = verifyDictionaries(read('zh-CN'), read('en-US'))
  let references = 0
  for (const directory of ['core', 'st-extension/src']) for (const filename of sourceFiles(path.join(root, directory))) {
    const result = verifySource(readFileSync(filename, 'utf8'), path.relative(root, filename), entries)
    errors.push(...result.errors)
    references += result.references
  }
  return { errors, keys: entries.size, references }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyProject(fileURLToPath(new URL('..', import.meta.url)))
    if (result.errors.length) {
      console.error(result.errors.join('\n'))
      process.exitCode = 1
    } else console.log(`i18n verified: ${result.keys} matching keys, ${result.references} source references and interpolation parameters.`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
