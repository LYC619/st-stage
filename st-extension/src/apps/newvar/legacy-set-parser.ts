import { isSafePath } from '../path-utils'

export interface LegacySetCall {
  path: string
  oldValue: unknown
  newValue: unknown
}

export interface LegacySetParseResult {
  calls: LegacySetCall[]
  errors: string[]
}

interface ParsedValue {
  value: unknown
  next: number
}

interface ParsedCall {
  call: LegacySetCall
  next: number
}

export function parseLegacySetCalls(source: string): LegacySetParseResult {
  const calls: LegacySetCall[] = []
  const errors: string[] = []
  let index = 0

  while (index < source.length) {
    index = skipTrivia(source, index)
    if (index >= source.length) break

    const start = index
    try {
      const parsed = parseCall(source, start)
      let next = skipHorizontalSpace(source, parsed.next)
      const hasSemicolon = source[next] === ';'
      if (hasSemicolon) next = skipHorizontalSpace(source, next + 1)

      if (next >= source.length || isLineBreak(source[next])) {
        calls.push(parsed.call)
        index = next
        continue
      }
      if (source.startsWith('//', next)) {
        calls.push(parsed.call)
        index = skipLineComment(source, next)
        continue
      }
      if (hasSemicolon && source.startsWith('_.set', next)) {
        calls.push(parsed.call)
        index = next
        continue
      }
      throw syntaxError(source, next, '调用后存在不允许的尾随内容')
    } catch (error) {
      errors.push(error instanceof Error ? error.message : String(error))
      index = recoverAtNextLine(source, start)
    }
  }

  return { calls, errors }
}

function parseCall(source: string, start: number): ParsedCall {
  if (!source.startsWith('_.set', start)) throw syntaxError(source, start, '只允许 _.set(...) 调用')
  let index = skipWhitespace(source, start + '_.set'.length)
  if (source[index] !== '(') throw syntaxError(source, index, '_.set 后缺少左括号')

  index = skipWhitespace(source, index + 1)
  const pathArg = parseValue(source, index)
  if (typeof pathArg.value !== 'string') throw syntaxError(source, index, '第一个参数必须是字符串路径')
  const path = pathArg.value.trim()
  if (!path) throw syntaxError(source, index, '变量路径不能为空')
  if (!isSafePath(path)) throw syntaxError(source, index, '变量路径包含危险字段')

  index = expectComma(source, pathArg.next, '路径后缺少旧值参数')
  const oldArg = parseValue(source, index)
  index = expectComma(source, oldArg.next, '旧值后缺少新值参数')
  const newArg = parseValue(source, index)
  index = skipWhitespace(source, newArg.next)
  if (source[index] !== ')') throw syntaxError(source, index, '新值后必须立即结束调用')

  return {
    call: { path, oldValue: oldArg.value, newValue: newArg.value },
    next: index + 1,
  }
}

function parseValue(source: string, start: number): ParsedValue {
  const index = skipWhitespace(source, start)
  const quote = source[index]
  if (quote === "'" || quote === '"') return parseString(source, index, quote)

  for (const [token, value] of [
    ['true', true],
    ['false', false],
    ['null', null],
  ] as const) {
    if (source.startsWith(token, index) && isValueBoundary(source[index + token.length])) {
      return { value, next: index + token.length }
    }
  }

  const number = source.slice(index).match(/^-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?/)
  if (number && isValueBoundary(source[index + number[0].length])) {
    return { value: Number(number[0]), next: index + number[0].length }
  }

  throw syntaxError(source, index, '参数只能是字符串、数字、布尔值或 null')
}

function parseString(source: string, start: number, quote: string): ParsedValue {
  let value = ''
  let index = start + 1
  while (index < source.length) {
    const char = source[index]
    if (char === quote) return { value, next: index + 1 }
    if (isLineBreak(char)) throw syntaxError(source, index, '字符串引号未闭合')
    if (char !== '\\') {
      value += char
      index += 1
      continue
    }

    const escaped = source[index + 1]
    if (escaped === undefined || isLineBreak(escaped)) throw syntaxError(source, index, '字符串转义未完成')
    const simpleEscapes: Record<string, string> = {
      "'": "'",
      '"': '"',
      '\\': '\\',
      '/': '/',
      b: '\b',
      f: '\f',
      n: '\n',
      r: '\r',
      t: '\t',
    }
    if (escaped === 'u') {
      const hex = source.slice(index + 2, index + 6)
      if (!/^[0-9a-fA-F]{4}$/.test(hex)) throw syntaxError(source, index, 'Unicode 转义必须包含四位十六进制数')
      value += String.fromCharCode(Number.parseInt(hex, 16))
      index += 6
      continue
    }
    if (!(escaped in simpleEscapes)) throw syntaxError(source, index, `不支持的字符串转义 \\${escaped}`)
    value += simpleEscapes[escaped]
    index += 2
  }
  throw syntaxError(source, start, '字符串引号未闭合')
}

function expectComma(source: string, start: number, message: string): number {
  const index = skipWhitespace(source, start)
  if (source[index] !== ',') throw syntaxError(source, index, message)
  return skipWhitespace(source, index + 1)
}

function skipWhitespace(source: string, start: number): number {
  let index = start
  while (index < source.length && /\s/.test(source[index])) index += 1
  return index
}

function skipHorizontalSpace(source: string, start: number): number {
  let index = start
  while (source[index] === ' ' || source[index] === '\t') index += 1
  return index
}

function skipTrivia(source: string, start: number): number {
  let index = start
  while (index < source.length) {
    if (/\s/.test(source[index]) || source[index] === ';') {
      index += 1
      continue
    }
    if (source.startsWith('//', index)) {
      index = skipLineComment(source, index)
      continue
    }
    break
  }
  return index
}

function skipLineComment(source: string, start: number): number {
  const newline = source.indexOf('\n', start + 2)
  return newline < 0 ? source.length : newline + 1
}

function recoverAtNextLine(source: string, start: number): number {
  const newline = source.indexOf('\n', start)
  return newline < 0 ? source.length : newline + 1
}

function isLineBreak(char: string | undefined): boolean {
  return char === '\n' || char === '\r'
}

function isValueBoundary(char: string | undefined): boolean {
  return char === undefined || char === ',' || char === ')' || /\s/.test(char)
}

function syntaxError(source: string, index: number, message: string): Error {
  const before = source.slice(0, Math.max(0, index))
  const line = before.split('\n').length
  const lastNewline = before.lastIndexOf('\n')
  const column = index - lastNewline
  return new Error(`第 ${line} 行第 ${column} 列：${message}`)
}
