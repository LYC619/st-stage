import { describe, expect, it } from 'vitest'
import {
  FALLBACK_DIRECTORY_NAME,
  installDirectoryName,
  matchesSelf,
  selfExtensionNames,
} from './self-identity'

describe('installDirectoryName', () => {
  it('takes the install directory from a normal extension bundle URL', () => {
    expect(installDirectoryName('https://host/scripts/extensions/third-party/st-stage/bundle.js'))
      .toBe('st-stage')
  })

  it('follows a renamed directory instead of assuming st-stage', () => {
    // 这是整个改动的目的：换名分发后仍要认出自己
    expect(installDirectoryName('https://host/scripts/extensions/third-party/st-butler/bundle.js'))
      .toBe('st-butler')
  })

  it('strips the cache-busting query before reading the directory', () => {
    // ?v= 是加载链路一直在用的破缓存参数，不切掉会混进目录名
    expect(installDirectoryName('https://host/scripts/extensions/third-party/my-ext/bundle.js?v=0.9.0%2B202608300122'))
      .toBe('my-ext')
    expect(installDirectoryName('https://host/scripts/extensions/third-party/my-ext/bundle.js#x'))
      .toBe('my-ext')
  })

  it('falls back rather than returning a reserved path segment', () => {
    // 少一层目录时倒数第二段会是 third-party，那不是目录名
    expect(installDirectoryName('https://host/scripts/extensions/third-party/bundle.js'))
      .toBe(FALLBACK_DIRECTORY_NAME)
    expect(installDirectoryName('https://host/scripts/extensions/bundle.js'))
      .toBe(FALLBACK_DIRECTORY_NAME)
  })

  it('falls back on empty or unusable input instead of throwing', () => {
    // 认错自己只是保护失效；抛错会连管家一起炸掉，所以一律退回兜底值
    expect(installDirectoryName('')).toBe(FALLBACK_DIRECTORY_NAME)
    expect(installDirectoryName('bundle.js')).toBe(FALLBACK_DIRECTORY_NAME)
    expect(installDirectoryName(undefined as unknown as string)).toBe(FALLBACK_DIRECTORY_NAME)
  })

  it('refuses to guess outside the SillyTavern extension layout', () => {
    // 跑单测时 import.meta.url 指向源码路径。若不锚定布局，这里会算出 'butler'
    // ——一个看起来合理的错值，比退回兜底值更危险。
    expect(installDirectoryName('file:///D:/proj/st-extension/src/apps/butler/self-identity.ts'))
      .toBe(FALLBACK_DIRECTORY_NAME)
    expect(installDirectoryName('https://cdn.example.com/whatever/bundle.js'))
      .toBe(FALLBACK_DIRECTORY_NAME)
  })

  it('accepts the layout without the third-party level', () => {
    expect(installDirectoryName('https://host/scripts/extensions/st-stage/bundle.js'))
      .toBe('st-stage')
  })
})

describe('selfExtensionNames', () => {
  it('covers both the bare and third-party-prefixed forms', () => {
    expect(selfExtensionNames('st-stage')).toEqual(['st-stage', 'third-party/st-stage'])
  })

  it('does not double-prefix a name that already carries one', () => {
    expect(selfExtensionNames('third-party/st-stage')).toEqual(['third-party/st-stage'])
  })
})

describe('matchesSelf', () => {
  it('matches both forms of its own name', () => {
    expect(matchesSelf('st-stage', 'st-stage')).toBe(true)
    expect(matchesSelf('third-party/st-stage', 'st-stage')).toBe(true)
  })

  it('matches a renamed directory and stops matching the old literal', () => {
    expect(matchesSelf('third-party/st-butler', 'st-butler')).toBe(true)
    // 关键回归点：改名后不能再把旧名字当成自己，否则保护挂在了错误的扩展上
    expect(matchesSelf('third-party/st-stage', 'st-butler')).toBe(false)
  })

  it('ignores case, because Windows directory names do', () => {
    expect(matchesSelf('third-party/ST-Stage', 'st-stage')).toBe(true)
    expect(matchesSelf('third-party/st-stage', 'ST-STAGE')).toBe(true)
  })

  it('does not match other extensions or empty names', () => {
    expect(matchesSelf('expressions', 'st-stage')).toBe(false)
    expect(matchesSelf('third-party/other', 'st-stage')).toBe(false)
    expect(matchesSelf('', 'st-stage')).toBe(false)
    // 前缀相同但不是同一个扩展
    expect(matchesSelf('third-party/st-stage-fork', 'st-stage')).toBe(false)
  })
})
