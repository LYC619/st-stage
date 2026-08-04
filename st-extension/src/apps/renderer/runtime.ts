import type { RendererSettings } from './config'
import type { ComposerInsertResult } from './composer'
import { parseRendererBlock } from './parser'
import type { RendererBlock, RendererMode } from './types'

export interface RendererMount {
  destroy(): void
}

export interface RendererModeDeps {
  getSettings: () => RendererSettings
  /** 把 sprite 地址解析为当前图库中可显示的图片 URL。 */
  resolvePortrait?: (address: string) => string | null
  /** 把结构化行动填入 ST 草稿；成功也不自动发送。 */
  insertDraft?: (text: string) => ComposerInsertResult
}

export type RendererModeFactory<TMode extends RendererMode = RendererMode> = (
  root: HTMLElement,
  block: Extract<RendererBlock, { mode: TMode }>,
  deps: RendererModeDeps,
) => RendererMount

export type RendererModeFactories = {
  [Mode in RendererMode]?: RendererModeFactory<Mode>
}

export interface RendererRuntimeDeps {
  getSettings: () => RendererSettings
  factories: RendererModeFactories
  modeDeps?: RendererModeDeps
}

export interface RendererRuntime {
  processMessage(root: HTMLElement): void
  reprocessAll(scope?: ParentNode): void
  dispose(): void
}

interface MountedState {
  mount: RendererMount
  snapshot: Node[]
  marker: HTMLElement
  source: HTMLElement
  container: HTMLElement
  mode: RendererMode
  outsideSignature: string
  destroyed: boolean
}

interface TextBoundary {
  node: Text
  offset: number
}

const RENDERER_CLASS = 'st-stage-renderer'
const SOURCE_CLASS = 'st-stage-render-source'
const MARKER_CLASS = 'st-stage-render-marker'

/** 判断当前模式是否被用户设置启用。 */
function isModeEnabled(settings: RendererSettings, mode: RendererMode): boolean {
  if (mode === 'gal') return settings.galEnabled
  if (mode === 'cards') return settings.cardsEnabled
  return settings.battleEnabled
}

/** 在文本节点序列中定位 textContent 的字符偏移。 */
function findTextBoundary(root: HTMLElement, target: number): TextBoundary | null {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  let consumed = 0
  let last: Text | null = null
  let current: Node | null
  while ((current = walker.nextNode())) {
    const node = current as Text
    const length = node.data.length
    if (target <= consumed + length) return { node, offset: target - consumed }
    consumed += length
    last = node
  }
  return target === consumed && last ? { node: last, offset: last.data.length } : null
}

/** 把原始协议块包进 hidden 元素；找不到精确文本时不改 DOM。 */
function hideSourceBlock(root: HTMLElement, raw: string): HTMLElement | null {
  const text = root.textContent ?? ''
  const startOffset = text.indexOf(raw)
  if (startOffset < 0) return null
  const start = findTextBoundary(root, startOffset)
  const end = findTextBoundary(root, startOffset + raw.length)
  if (!start || !end) return null
  const range = document.createRange()
  range.setStart(start.node, start.offset)
  range.setEnd(end.node, end.offset)
  const source = document.createElement('span')
  source.className = SOURCE_CLASS
  source.hidden = true
  source.append(range.extractContents())
  range.insertNode(source)
  return source
}

/** 序列化 renderer 容器之外的 DOM，用于识别 ST 的迟到增量更新。 */
function outsideSignature(root: HTMLElement, marker: HTMLElement, container: HTMLElement): string {
  const holder = document.createElement('div')
  for (const node of Array.from(root.childNodes)) {
    if (node !== marker && node !== container) holder.append(node.cloneNode(true))
  }
  return holder.innerHTML
}

/** 判断消息外部 DOM 自挂载后是否仍未被 ST 改写。 */
function stillOwnsDom(root: HTMLElement, state: MountedState): boolean {
  return state.marker.parentNode === root
    && state.container.parentNode === root
    && outsideSignature(root, state.marker, state.container) === state.outsideSignature
}

/** 安全调用模式清理，单个模式异常不能阻断其他楼层恢复。 */
function destroyMount(state: MountedState): void {
  if (state.destroyed) return
  state.destroyed = true
  try {
    state.mount.destroy()
  } catch {
    // 第三方模式工厂的清理异常不能破坏平台生命周期。
  }
}

/** 创建拥有消息渲染 DOM 和模式实例生命周期的 runtime。 */
export function createRendererRuntime(deps: RendererRuntimeDeps): RendererRuntime {
  const states = new WeakMap<HTMLElement, MountedState>()
  const mountedRoots = new Set<HTMLElement>()
  const modeDeps = deps.modeDeps ?? { getSettings: deps.getSettings }
  let disposed = false

  /** 销毁单楼层实例；DOM 仍由本 runtime 持有时用快照恢复。 */
  function cleanupRoot(root: HTMLElement): void {
    const state = states.get(root)
    if (!state) return
    destroyMount(state)
    if (stillOwnsDom(root, state)) {
      root.replaceChildren(...state.snapshot)
    } else {
      state.marker.remove()
      state.container.remove()
      if (root.contains(state.source)) state.source.replaceWith(...Array.from(state.source.childNodes))
    }
    states.delete(root)
    mountedRoots.delete(root)
  }

  /** 解析并挂载一个 AI 消息楼层。 */
  function processMessage(root: HTMLElement): void {
    if (disposed) return
    const settings = deps.getSettings()
    const current = states.get(root)
    if (current && stillOwnsDom(root, current) && settings.enabled && isModeEnabled(settings, current.mode)) return
    if (current) cleanupRoot(root)
    const message = root.closest('.mes')
    if (message?.getAttribute('is_user') === 'true' || message?.getAttribute('is_system') === 'true') return
    if (!settings.enabled) return
    const parsed = parseRendererBlock(root.textContent ?? '')
    if (!parsed.ok || !isModeEnabled(settings, parsed.block.mode)) return
    const factory = deps.factories[parsed.block.mode] as RendererModeFactory | undefined
    if (!factory) return

    const container = document.createElement('section')
    container.className = RENDERER_CLASS
    let mount: RendererMount
    try {
      mount = factory(container, parsed.block, modeDeps)
      if (!mount || typeof mount.destroy !== 'function') return
    } catch {
      return
    }

    const snapshot = Array.from(root.childNodes).map((node) => node.cloneNode(true))
    const source = (() => {
      try {
        return hideSourceBlock(root, parsed.raw)
      } catch {
        return null
      }
    })()
    if (!source) {
      const failedState: MountedState = {
        mount,
        snapshot,
        marker: container,
        source: container,
        container,
        mode: parsed.block.mode,
        outsideSignature: '',
        destroyed: false,
      }
      destroyMount(failedState)
      root.replaceChildren(...snapshot)
      return
    }

    const marker = document.createElement('span')
    marker.className = MARKER_CLASS
    marker.hidden = true
    root.append(marker, container)
    states.set(root, {
      mount,
      snapshot,
      marker,
      source,
      container,
      mode: parsed.block.mode,
      outsideSignature: outsideSignature(root, marker, container),
      destroyed: false,
    })
    mountedRoots.add(root)
  }

  /** 先恢复所有旧实例，再处理当前文档或指定范围内的消息。 */
  function reprocessAll(scope: ParentNode = document): void {
    if (disposed) return
    for (const root of Array.from(mountedRoots)) cleanupRoot(root)
    const roots: HTMLElement[] = []
    if (scope instanceof HTMLElement && scope.matches('.mes_text')) roots.push(scope)
    for (const root of Array.from(scope.querySelectorAll<HTMLElement>('.mes_text'))) roots.push(root)
    for (const root of roots) processMessage(root)
  }

  /** 幂等销毁全部模式实例并恢复仍由 runtime 持有的原始 DOM。 */
  function dispose(): void {
    if (disposed) return
    for (const root of Array.from(mountedRoots)) cleanupRoot(root)
    disposed = true
  }

  return { processMessage, reprocessAll, dispose }
}
