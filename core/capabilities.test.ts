import { describe, expect, it, vi } from 'vitest'
import { createCapabilityTracker, createEventHub } from './capabilities'

describe('CapabilityTracker', () => {
  it('dispose 逆序执行全部清理且幂等', () => {
    const order: number[] = []
    const t = createCapabilityTracker()
    t.track(() => order.push(1))
    t.track(() => order.push(2))
    t.track(() => order.push(3))
    t.dispose()
    t.dispose()
    expect(order).toEqual([3, 2, 1])
    expect(t.disposed).toBe(true)
  })

  it('track 返回的句柄执行并注销：dispose 时不再重复执行', () => {
    const cleanup = vi.fn()
    const t = createCapabilityTracker()
    const off = t.track(cleanup)
    off()
    off() // 重复调用安全
    t.dispose()
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('dispose 后再 track：清理立即执行（迟到订阅不泄漏）', () => {
    const t = createCapabilityTracker()
    t.dispose()
    const cleanup = vi.fn()
    t.track(cleanup)
    expect(cleanup).toHaveBeenCalledTimes(1)
  })

  it('单个清理抛错不拦其他清理', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const good = vi.fn()
    const t = createCapabilityTracker()
    t.track(good)
    t.track(() => {
      throw new Error('boom')
    })
    t.dispose()
    expect(good).toHaveBeenCalledTimes(1)
    expect(errSpy).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })
})

describe('EventHub', () => {
  it('扇出到全部订阅者；退订后不再收到', () => {
    const hub = createEventHub<string>()
    const a: string[] = []
    const b: string[] = []
    const offA = hub.subscribe((v) => a.push(v))
    hub.subscribe((v) => b.push(v))
    hub.emit('一')
    offA()
    hub.emit('二')
    expect(a).toEqual(['一'])
    expect(b).toEqual(['一', '二'])
  })

  it('单个 handler 抛错只打日志，其余照常收到', () => {
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
    const hub = createEventHub<number>()
    const got: number[] = []
    hub.subscribe(() => {
      throw new Error('bad handler')
    })
    hub.subscribe((v) => got.push(v))
    hub.emit(7)
    expect(got).toEqual([7])
    expect(errSpy).toHaveBeenCalledTimes(1)
    errSpy.mockRestore()
  })
})
