/**
 * 消息渲染后处理（ST 端）：在消息气泡 DOM 渲染完成后加工显示内容。
 * - hideTagInMessage：把 [立绘:xxx] 标签文本从气泡中摘除（不改 chat 数据，只改显示）
 * - renderInlineImages：把 <img>编码</img> 标记替换为真实 <img> 元素（图床前缀 + 编码）
 * - spriteDisplayMode=inline/both：把 [立绘:xxx] 原位替换为绑定包里的立绘图片
 *
 * 可逆渲染（五期）：
 * - 加工前把气泡原始子节点深克隆存入 WeakMap 快照；恢复时整体放回，不拼 innerHTML
 * - 气泡头部插入隐藏 marker 元素：ST 流式/重渲染会重写 innerHTML（marker 消失），
 *   以此区分「我们加工过的 DOM」和「ST 刚重写的新原文」，杜绝旧指纹误跳过
 * - 指纹 = 功能开关 + 图床前缀 + 原文内容 hash：同一楼层流式增长后内容 hash 变化，
 *   自动恢复→重解析最终标签
 * - 批量补渲染只处理最近 recentFloors 个「可能含立绘标签的 AI 楼层」；
 *   最新楼层（新回复/流式）始终处理，不受窗口限制
 *
 * 挂载事件：CHARACTER_MESSAGE_RENDERED / USER_MESSAGE_RENDERED（旧版 ST 缺失时回退
 * MESSAGE_RECEIVED + 延迟）。只处理文本节点，不解析 HTML 字符串 → 无注入面。
 */

import { hasTag, replaceTags, stripTags } from '../../core/tag-parser'
import { hasInlineImageMarkup, replaceInlineImages } from '../../core/inline-image'
import { getActivePacks, resolveSprite } from '../../core/sprite-store'
import type { PluginSettings } from '../../core/types'
import { RECENT_FLOORS_MAX, RECENT_FLOORS_MIN } from '../../core/types'

export interface PostprocessDeps {
  getSettings: () => PluginSettings
}

interface STContextLike {
  eventSource: {
    on: (event: string, handler: (...args: unknown[]) => void) => void
    removeListener: (event: string, handler: (...args: unknown[]) => void) => void
  }
  eventTypes?: Record<string, string>
}

/** 指纹属性：记录该气泡按哪组设置+哪版内容加工过 */
const FP_ATTR = 'data-so-fp'
/** 加工标记元素类名：ST 重写 innerHTML 后消失，用于检测内容是否仍是我们加工的版本 */
const MARKER_CLASS = 'so-processed-marker'

interface Snapshot {
  /** 原始子节点的深克隆（恢复时整体放回） */
  nodes: Node[]
  /** 原始纯文本（用于指纹与候选判断，加工后 DOM 的文本已变） */
  originalText: string
}

const snapshots = new WeakMap<HTMLElement, Snapshot>()

export function mountMessagePostprocess(deps: PostprocessDeps): () => void {
  const st = window.SillyTavern
  if (!st) return () => {}
  const ctx = st.getContext() as unknown as STContextLike

  const renderedEvents = [
    ctx.eventTypes?.CHARACTER_MESSAGE_RENDERED,
    ctx.eventTypes?.USER_MESSAGE_RENDERED,
  ].filter((e): e is string => typeof e === 'string' && e.length > 0)

  const handler = (...args: unknown[]) => {
    const messageId = typeof args[0] === 'number' || typeof args[0] === 'string' ? args[0] : null
    // 事件回调时 DOM 已生成；保险起见排队到微任务尾
    queueMicrotask(() => processMessages(deps.getSettings(), messageId))
  }

  if (renderedEvents.length > 0) {
    for (const event of renderedEvents) ctx.eventSource.on(event, handler)
    return () => {
      for (const event of renderedEvents) ctx.eventSource.removeListener(event, handler)
    }
  }

  // 旧版 ST 回退：MESSAGE_RECEIVED 后延迟处理（等渲染完成）
  const fallbackEvent = ctx.eventTypes?.MESSAGE_RECEIVED ?? 'message_received'
  const fallbackHandler = (...args: unknown[]) => {
    const messageId = typeof args[0] === 'number' || typeof args[0] === 'string' ? args[0] : null
    setTimeout(() => processMessages(deps.getSettings(), messageId), 150)
  }
  ctx.eventSource.on(fallbackEvent, fallbackHandler)
  return () => ctx.eventSource.removeListener(fallbackEvent, fallbackHandler)
}

/** 有任一显示加工功能开启（关了就只做恢复） */
function anyFeatureOn(settings: PluginSettings): boolean {
  return (
    settings.enabled &&
    (settings.hideTagInMessage ||
      settings.renderInlineImages ||
      settings.spriteDisplayMode !== 'overlay')
  )
}

function clampFloors(settings: PluginSettings): number {
  const n = Math.round(settings.recentFloors)
  if (!Number.isFinite(n)) return RECENT_FLOORS_MIN
  return Math.min(RECENT_FLOORS_MAX, Math.max(RECENT_FLOORS_MIN, n))
}

/** 气泡的原文（加工过的取快照，未加工的取当前文本） */
function originalTextOf(el: HTMLElement): string {
  return snapshots.get(el)?.originalText ?? el.textContent ?? ''
}

/** 收集「可能含立绘标签/插图标记的 AI 楼层」气泡（按楼层顺序） */
function collectCandidates(): HTMLElement[] {
  const out: HTMLElement[] = []
  for (const mes of Array.from(document.querySelectorAll('#chat .mes'))) {
    if (mes.getAttribute('is_user') === 'true' || mes.getAttribute('is_system') === 'true') continue
    const textEl = mes.querySelector('.mes_text') as HTMLElement | null
    if (!textEl) continue
    const text = originalTextOf(textEl)
    if (hasTag(text) || hasInlineImageMarkup(text)) out.push(textEl)
  }
  return out
}

/**
 * 对指定消息（或批量按窗口）执行后处理。
 * - messageId 给定：只处理该楼层；仅当它是最新楼层，或落在最近 N 个候选 AI 楼层内
 *   （聊天加载时 ST 会对每条历史消息触发渲染事件，窗口限制避免全量重加工）
 * - messageId 为空：批量处理最近 N 个候选 AI 楼层
 */
export function processMessages(settings: PluginSettings, messageId: unknown = null): void {
  if (!anyFeatureOn(settings)) return

  if (messageId !== null && messageId !== undefined && `${messageId}` !== '') {
    // 不用 CSS.escape（部分环境无 CSS 全局）：直接按属性值比较定位楼层
    const idStr = `${messageId}`
    const allMes = Array.from(document.querySelectorAll('#chat .mes'))
    const scope = allMes
      .filter((m) => m.getAttribute('mesid') === idStr)
      .map((m) => m.querySelector('.mes_text'))
      .filter((el): el is HTMLElement => el !== null)
    const lastMes = allMes.length > 0 ? allMes[allMes.length - 1] : null
    // 窗口集合按需构建：最新楼层（流式事件高频触发）无需全量扫描
    let windowSet: Set<HTMLElement> | null = null
    for (const el of scope) {
      if (lastMes !== null && el.closest('.mes') === lastMes) {
        processMessageElement(el, settings)
        continue
      }
      windowSet ??= new Set(collectCandidates().slice(-clampFloors(settings)))
      if (windowSet.has(el)) processMessageElement(el, settings)
    }
    return
  }

  for (const el of collectCandidates().slice(-clampFloors(settings))) {
    processMessageElement(el, settings)
  }
}

/**
 * 设置变更入口：先把所有加工过的楼层恢复为原始 DOM，再按新设置补渲染窗口内楼层。
 * 总开关/功能全关时只恢复不再加工 —— 旧楼层立即回到原文，不依赖 ST 重新渲染。
 */
export function reprocessAllMessages(settings: PluginSettings): void {
  restoreAllMessages()
  if (anyFeatureOn(settings)) processMessages(settings)
}

/** 恢复全部加工过的楼层为原始 DOM */
export function restoreAllMessages(): void {
  for (const node of Array.from(document.querySelectorAll(`#chat .mes_text[${FP_ATTR}]`))) {
    restoreElement(node as HTMLElement)
  }
}

/** 恢复单个气泡：快照节点放回；快照丢失（如脚本热重载）时仅清标记 */
function restoreElement(root: HTMLElement): void {
  const snap = snapshots.get(root)
  const isOurs = root.querySelector(`.${MARKER_CLASS}`) !== null
  if (snap && isOurs) {
    root.replaceChildren(...snap.nodes)
  }
  snapshots.delete(root)
  root.removeAttribute(FP_ATTR)
}

/** 简单字符串 hash（djb2，base36），用于内容版本指纹 */
function hashText(text: string): string {
  let h = 5381
  for (let i = 0; i < text.length; i++) {
    h = ((h << 5) + h + text.charCodeAt(i)) | 0
  }
  return (h >>> 0).toString(36)
}

function processMessageElement(root: HTMLElement, settings: PluginSettings): void {
  const inlineSprites = settings.spriteDisplayMode !== 'overlay'
  const host = settings.imageHost.endsWith('/') ? settings.imageHost : `${settings.imageHost}/`

  const snap = snapshots.get(root)
  const contentIsOurs = snap !== undefined && root.querySelector(`.${MARKER_CLASS}`) !== null
  const originalText = contentIsOurs ? snap.originalText : (root.textContent ?? '')

  // 指纹 = 功能开关 + 图床前缀 + 原文 hash：任一变化都会走恢复→重加工
  const fingerprint = `${settings.hideTagInMessage ? 'T' : ''}${settings.renderInlineImages ? 'I' : ''}${inlineSprites ? 'S' : ''}|${hashText(host)}|${hashText(originalText)}`
  if (contentIsOurs && root.getAttribute(FP_ATTR) === fingerprint) return

  // 内容还是我们加工的旧版本 → 先恢复原始 DOM；
  // marker 已消失说明 ST 重写过 innerHTML（流式增长/重渲染），当前内容就是新原文
  if (contentIsOurs) {
    root.replaceChildren(...snap.nodes)
  }
  snapshots.delete(root)
  root.removeAttribute(FP_ATTR)

  // 楼层内立绘：按气泡所属消息的角色名解析全部启用包（多包严格寻址）
  const chName = inlineSprites ? (root.closest('.mes')?.getAttribute('ch_name') ?? '') : ''
  const packs = chName ? getActivePacks(settings, chName) : []
  const hasPacks = packs.length > 0

  const freshText = root.textContent ?? ''
  const tagged = hasTag(freshText)
  const needsWork =
    (settings.hideTagInMessage && tagged) ||
    (inlineSprites && hasPacks && tagged) ||
    (settings.renderInlineImages && hasInlineImageMarkup(freshText))
  if (!needsWork) return

  // 加工前快照原始子节点（深克隆），恢复时整体放回
  snapshots.set(root, {
    nodes: Array.from(root.childNodes).map((n) => n.cloneNode(true)),
    originalText: freshText,
  })

  // 只遍历文本节点：不碰已有元素/属性，无 HTML 注入面
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  const textNodes: Text[] = []
  let current: Node | null
  while ((current = walker.nextNode())) {
    textNodes.push(current as Text)
  }

  for (const textNode of textNodes) {
    const text = textNode.nodeValue ?? ''
    if (!text) continue

    const nodeTagged = hasTag(text)
    const needsSprites = inlineSprites && hasPacks && nodeTagged
    const needsStrip = settings.hideTagInMessage && nodeTagged && !needsSprites
    const needsImages = settings.renderInlineImages && hasInlineImageMarkup(text)
    if (!needsSprites && !needsStrip && !needsImages) continue

    let processed = needsStrip ? stripTags(text) : text

    // 带序号的 NUL 占位符标记待插入元素：两类替换先后执行也能保持文本顺序；
    // HTML 解析产物的文本节点不可能含 NUL，占位符不会与正文撞车。
    const elements: HTMLElement[] = []
    const marker = (el: HTMLElement) => `\0${elements.push(el) - 1}\0`

    if (needsSprites && hasPacks) {
      processed = replaceTags(processed, (address) => {
        const sprite = resolveSprite(packs, address)
        // 匹配不到的标签退回「隐藏标签」语义：开了隐藏就摘除，否则保留原文
        if (!sprite) return settings.hideTagInMessage ? '' : null
        return marker(createImage(sprite.url, sprite.tag, 'so-inline-sprite'))
      })
    }
    if (needsImages) {
      processed = replaceInlineImages(processed, (m) => marker(createImage(host + m.code, m.code)))
    }

    if (elements.length === 0) {
      if (processed !== text) textNode.nodeValue = processed
      continue
    }
    const fragment = document.createDocumentFragment()
    // marker 产出 \0序号\0：按 \0 切分后奇数位天然是元素序号
    processed.split('\0').forEach((part, i) => {
      if (i % 2 === 1) fragment.append(elements[Number(part)])
      else if (part) fragment.append(document.createTextNode(part))
    })
    textNode.replaceWith(fragment)
  }

  // 隐藏 marker 元素放最前：检测 ST 是否重写过内容（重写后 marker 消失）
  const processedMark = document.createElement('span')
  processedMark.className = MARKER_CLASS
  processedMark.hidden = true
  root.prepend(processedMark)
  root.setAttribute(FP_ATTR, fingerprint)
}

/** 气泡内图片（插图 / 楼层内立绘共用）：加载失败套破图样式并支持点击重试 */
function createImage(src: string, alt: string, extraClass = ''): HTMLElement {
  const wrap = document.createElement('span')
  wrap.className = extraClass ? `so-inline-image ${extraClass}` : 'so-inline-image'
  const img = document.createElement('img')
  img.src = src
  img.alt = alt
  img.loading = 'lazy'
  img.addEventListener('error', () => {
    wrap.classList.add('so-inline-image-error')
    wrap.title = '图片加载失败，点击重试'
  })
  img.addEventListener('load', () => {
    wrap.classList.remove('so-inline-image-error')
    wrap.removeAttribute('title')
  })
  wrap.addEventListener('click', () => {
    if (!wrap.classList.contains('so-inline-image-error')) return
    // 重试：重设 src 触发重新加载（时间戳参数绕过失败缓存，data: 图源不加）
    img.src = src.startsWith('data:') ? src : `${src}${src.includes('?') ? '&' : '?'}so_retry=${Date.now()}`
  })
  wrap.append(img)
  return wrap
}
