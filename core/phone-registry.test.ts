import { describe, expect, it } from 'vitest'
import { PhoneAppRegistry, type PhoneApp } from './phone-registry'

function app(id: string, order?: number): PhoneApp {
  return { id, name: id, icon: '📦', order, mount: () => {} }
}

describe('PhoneAppRegistry', () => {
  it('注册/查询/注销', () => {
    const reg = new PhoneAppRegistry()
    reg.register(app('sprites'))
    expect(reg.get('sprites')?.id).toBe('sprites')
    reg.unregister('sprites')
    expect(reg.get('sprites')).toBeUndefined()
  })

  it('按 order 排序，缺省 100', () => {
    const reg = new PhoneAppRegistry()
    reg.register(app('zeta'))
    reg.register(app('alpha', 1))
    reg.register(app('mid', 50))
    expect(reg.list().map((a) => a.id)).toEqual(['alpha', 'mid', 'zeta'])
  })

  it('拒绝非法与重复 id', () => {
    const reg = new PhoneAppRegistry()
    expect(() => reg.register(app('BadId'))).toThrow('非法')
    expect(() => reg.register(app('1st'))).toThrow('非法')
    expect(() => reg.register(app('a'))).toThrow('非法') // 至少 2 字符
    reg.register(app('ok-app'))
    expect(() => reg.register(app('ok-app'))).toThrow('已被注册')
  })

  it('注册/注销触发订阅回调', () => {
    const reg = new PhoneAppRegistry()
    let calls = 0
    const off = reg.subscribe(() => calls++)
    reg.register(app('one'))
    reg.unregister('one')
    expect(calls).toBe(2)
    off()
    reg.register(app('two'))
    expect(calls).toBe(2)
  })
})
