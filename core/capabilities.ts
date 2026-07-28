/**
 * ctx 能力层基础设施（阶段五·5a，设计稿 docs/superpowers/specs/2026-07-28-ctx-capability-layer-design.md）：
 * - CapabilityTracker：清理函数登记表。mount 级（unmount 批量回收）与平台级（销毁回收）共用，
 *   把 dispose 契约里「清订阅/定时器」的义务从 App 作者手里收归框架。
 * - EventHub：平台对 ST 只保持一份订阅，经 hub 扇出给各 App；单个 handler 抛错不拖垮别人。
 * 纯逻辑零 DOM，双端共用。
 */

/** 清理函数登记表；dispose 逆序执行且幂等，dispose 后再 track 立即执行（迟到订阅不泄漏） */
export interface CapabilityTracker {
  /** 登记清理函数，返回「执行并注销」句柄（重复调用安全） */
  track(cleanup: () => void): () => void
  /** 逆序执行全部未注销的清理（逐个 try/catch），之后进入已销毁态 */
  dispose(): void
  readonly disposed: boolean
}

export function createCapabilityTracker(): CapabilityTracker {
  const cleanups = new Set<() => void>()
  let disposed = false
  const run = (fn: () => void) => {
    try {
      fn()
    } catch (err) {
      console.error('[sprite-overlay] 能力清理失败', err)
    }
  }
  return {
    get disposed() {
      return disposed
    },
    track(cleanup) {
      if (disposed) {
        run(cleanup)
        return () => {}
      }
      cleanups.add(cleanup)
      return () => {
        // 只在仍登记时执行：dispose 已跑过/句柄已用过则跳过，保证不重复清理
        if (cleanups.delete(cleanup)) run(cleanup)
      }
    },
    dispose() {
      if (disposed) return
      disposed = true
      // 逆序：后建立的资源可能依赖先建立的
      for (const fn of [...cleanups].reverse()) run(fn)
      cleanups.clear()
    },
  }
}

/** 事件扇出：subscribe 返回退订函数；emit 时单个 handler 抛错只打日志 */
export interface EventHub<T> {
  emit(value: T): void
  subscribe(handler: (value: T) => void): () => void
}

export function createEventHub<T>(): EventHub<T> {
  const handlers = new Set<(value: T) => void>()
  return {
    emit(value) {
      // 快照遍历：handler 内退订/新订不影响本轮分发
      for (const handler of [...handlers]) {
        try {
          handler(value)
        } catch (err) {
          console.error('[sprite-overlay] App 事件处理器抛错', err)
        }
      }
    },
    subscribe(handler) {
      handlers.add(handler)
      return () => {
        handlers.delete(handler)
      }
    },
  }
}
