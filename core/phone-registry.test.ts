import { describe, expect, it, vi } from 'vitest'
import {
  PhoneAppRegistry,
  createPhoneAppContext,
  installRegisterQueue,
  type PhoneApp,
} from './phone-registry'
import { createDefaultSettings } from './types'

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

  it('形状校验：独立 App 从 JS 注册时坏对象在入口报错', () => {
    const reg = new PhoneAppRegistry()
    const bad = (v: unknown) => () => reg.register(v as PhoneApp)
    expect(bad(null)).toThrow('必须是 App 对象')
    expect(bad('dice')).toThrow('必须是 App 对象')
    expect(bad({ id: 'dice' })).toThrow('name')
    expect(bad({ id: 'dice', name: '骰子' })).toThrow('icon')
    expect(bad({ id: 'dice', name: '骰子', icon: '🎲' })).toThrow('mount')
    expect(bad({ id: 'dice', name: '骰子', icon: '🎲', mount: () => {}, unmount: 1 })).toThrow(
      'unmount',
    )
    expect(bad({ id: 'dice', name: '骰子', icon: '🎲', mount: () => {}, order: 'a' })).toThrow(
      'order',
    )
    // 报错后注册表干净，同 id 仍可正常注册
    reg.register(app('dice'))
    expect(reg.get('dice')).toBeDefined()
  })
})

describe('installRegisterQueue（独立 App 注册队列）', () => {
  it('吃掉就绪前的积压数组并按序注册；接管后 push 即时注册', () => {
    const reg = new PhoneAppRegistry()
    const backlog = [app('early-a'), app('early-b')]
    const shim = installRegisterQueue(backlog, (a) => reg.register(a))
    expect(reg.list().map((a) => a.id)).toEqual(['early-a', 'early-b'])
    shim.push(app('late'))
    expect(reg.get('late')).toBeDefined()
  })

  it('坏 App 只打控制台，不断链：积压里后面的照常注册', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const reg = new PhoneAppRegistry()
    installRegisterQueue([{ id: 'BAD' } as unknown as PhoneApp, app('good')], (a) =>
      reg.register(a),
    )
    expect(reg.get('good')).toBeDefined()
    expect(errSpy).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })

  it('bundle 同页重复执行：新实例从旧 shim 的 seen 重放到新注册表', () => {
    const reg1 = new PhoneAppRegistry()
    const shim1 = installRegisterQueue([app('queued')], (a) => reg1.register(a))
    shim1.push(app('pushed'))
    const reg2 = new PhoneAppRegistry()
    installRegisterQueue(shim1, (a) => reg2.register(a))
    expect(reg2.list().map((a) => a.id)).toEqual(['queued', 'pushed'])
  })

  it('prev 为 undefined / 垃圾值时安全为空积压', () => {
    const reg = new PhoneAppRegistry()
    installRegisterQueue(undefined, (a) => reg.register(a))
    installRegisterQueue('garbage', (a) => reg.register(a))
    expect(reg.list()).toEqual([])
  })
})

describe('createPhoneAppContext（阶段7·App 私有数据与立绘刷新解耦）', () => {
  function harness() {
    let settings = createDefaultSettings()
    const calls = { update: 0, saveOnly: 0 }
    const ctx = createPhoneAppContext({
      appId: 'dice',
      getSettings: () => settings,
      updateSettings: (next) => {
        calls.update++
        settings = next
      },
      saveSettingsOnly: (next) => {
        calls.saveOnly++
        settings = next
      },
      getCharacterName: () => '小雪',
      goHome: () => {},
    })
    return { ctx, calls, getSettings: () => settings }
  }

  it('setAppData 走 saveSettingsOnly（不触发 updateSettings/立绘刷新）', () => {
    const h = harness()
    h.ctx.setAppData({ last: 20 })
    expect(h.calls.saveOnly).toBe(1)
    expect(h.calls.update).toBe(0) // 关键：不走会触发 refresh 的核心路径
    expect(h.getSettings().apps.dice).toEqual({ last: 20 })
  })

  it('setAppData 只改自己的命名空间，不动其他 App 数据与核心设置', () => {
    const h = harness()
    h.ctx.setAppData({ a: 1 })
    h.ctx.setAppData({ a: 2 })
    expect(h.getSettings().apps.dice).toEqual({ a: 2 })
    expect(h.getSettings().enabled).toBe(true) // 核心设置未被连累
    expect(h.calls.update).toBe(0)
  })

  it('getAppData 读取自己的私有存储；updateSettings 仍走核心刷新路径', () => {
    const h = harness()
    expect(h.ctx.getAppData()).toBeUndefined()
    h.ctx.setAppData({ n: 7 })
    expect(h.ctx.getAppData()).toEqual({ n: 7 })
    h.ctx.updateSettings({ ...h.getSettings(), enabled: false })
    expect(h.calls.update).toBe(1) // 核心设置仍触发 updateSettings
  })
})
