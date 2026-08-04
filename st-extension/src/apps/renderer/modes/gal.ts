import type { RendererModeDeps, RendererMount } from '../runtime'
import type { GalRenderBlock } from '../types'

const TYPEWRITER_INTERVAL_MS = 24

/** 创建只写 textContent 的文本元素。 */
function textElement(tag: string, className: string, text: string): HTMLElement {
  const element = document.createElement(tag)
  element.className = className
  element.textContent = text
  return element
}

/** 创建舞台图片；加载失败时隐藏，避免残留破图图标。 */
function stageImage(className: string, src: string, alt: string): HTMLImageElement {
  const image = document.createElement('img')
  image.className = className
  image.src = src
  image.alt = alt
  image.draggable = false
  image.addEventListener('error', () => { image.hidden = true })
  return image
}

/** 解析普通图片 URL 或显式图库 sprite 地址。 */
function resolvePortrait(value: string | undefined, deps: RendererModeDeps): string | null {
  if (!value) return null
  if (!value.startsWith('sprite:')) return value
  try {
    return deps.resolvePortrait?.(value.slice('sprite:'.length)) ?? null
  } catch {
    return null
  }
}

/** 挂载消息内 Galgame 舞台，并返回定时器/键盘监听清理器。 */
export function mountGalMode(root: HTMLElement, block: GalRenderBlock, deps: RendererModeDeps): RendererMount {
  const stage = document.createElement('div')
  stage.className = 'st-render-gal'
  stage.setAttribute('role', 'group')
  stage.setAttribute('aria-label', block.title ?? block.scene)

  const backgroundLayer = document.createElement('div')
  backgroundLayer.className = 'st-render-gal-background-layer'
  const header = document.createElement('header')
  header.className = 'st-render-gal-header'
  if (block.title) header.append(textElement('div', 'st-render-gal-title', block.title))
  header.append(textElement('div', 'st-render-gal-scene', block.scene))

  const portraitLayer = document.createElement('div')
  portraitLayer.className = 'st-render-gal-portrait-layer'
  const dialogueBox = document.createElement('div')
  dialogueBox.className = 'st-render-gal-dialogue-box'
  const speaker = textElement('div', 'st-render-gal-speaker', '')
  const dialogue = textElement('div', 'st-render-gal-dialogue', '')
  dialogue.setAttribute('aria-live', 'polite')

  const controls = document.createElement('div')
  controls.className = 'st-render-gal-controls'
  const previous = document.createElement('button')
  previous.type = 'button'
  previous.className = 'st-render-gal-control'
  previous.setAttribute('aria-label', '上一句')
  previous.title = '上一句'
  previous.textContent = '←'
  const progress = textElement('span', 'st-render-gal-progress', '')
  const skip = document.createElement('button')
  skip.type = 'button'
  skip.className = 'st-render-gal-control st-render-gal-skip'
  skip.setAttribute('aria-label', '跳过')
  skip.textContent = '跳过'
  const next = document.createElement('button')
  next.type = 'button'
  next.className = 'st-render-gal-control'
  next.setAttribute('aria-label', '下一句')
  next.title = '下一句'
  next.textContent = '→'
  controls.append(previous, progress, skip, next)
  dialogueBox.append(speaker, dialogue, controls)
  stage.append(backgroundLayer, header, portraitLayer, dialogueBox)
  root.replaceChildren(stage)
  root.tabIndex = 0

  let index = 0
  let timer: ReturnType<typeof setInterval> | null = null
  let fullDialogue = ''
  let dialogueUnits: string[] = []
  let cursor = 0
  let destroyed = false

  /** 停止打字机；需要时立即补齐当前句。 */
  function stopTyping(complete: boolean): boolean {
    if (timer === null) return false
    clearInterval(timer)
    timer = null
    if (complete) dialogue.textContent = fullDialogue
    return true
  }

  /** 按当前设置显示全文或启动逐字显示。 */
  function renderDialogue(text: string, forceInstant = false): void {
    stopTyping(false)
    fullDialogue = text
    dialogueUnits = Array.from(text)
    cursor = 0
    const settings = deps.getSettings()
    if (forceInstant || settings.reducedMotion || !settings.typewriter) {
      dialogue.textContent = text
      return
    }
    dialogue.textContent = ''
    timer = setInterval(() => {
      if (destroyed) return
      cursor += 1
      dialogue.textContent = dialogueUnits.slice(0, cursor).join('')
      if (cursor >= dialogueUnits.length) stopTyping(false)
    }, TYPEWRITER_INTERVAL_MS)
  }

  /** 更新当前节拍的媒体、文字和控制状态。 */
  function renderBeat(forceInstant = false): void {
    const beat = block.beats[index]
    speaker.textContent = beat.speaker
    renderDialogue(beat.text, forceInstant)

    backgroundLayer.replaceChildren()
    const background = beat.background ?? block.background
    if (background) backgroundLayer.append(stageImage('st-render-gal-background', background, ''))

    portraitLayer.replaceChildren()
    const portrait = resolvePortrait(beat.portrait, deps)
    if (portrait) portraitLayer.append(stageImage('st-render-gal-portrait', portrait, beat.speaker))

    previous.disabled = index === 0
    next.disabled = index === block.beats.length - 1
    skip.disabled = false
    progress.textContent = `${index + 1} / ${block.beats.length}`
  }

  /** 上一节拍。 */
  function goPrevious(): void {
    if (index === 0) return
    stopTyping(false)
    index -= 1
    renderBeat()
  }

  /** 打字中先补齐当前句，再次触发才进入下一节拍。 */
  function goNext(): void {
    if (stopTyping(true)) return
    if (index >= block.beats.length - 1) return
    index += 1
    renderBeat()
  }

  /** 跳至最后一节拍并立即显示。 */
  function goLast(): void {
    stopTyping(false)
    index = block.beats.length - 1
    renderBeat(true)
  }

  /** 舞台键盘导航。 */
  function onKeyDown(event: KeyboardEvent): void {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      goPrevious()
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      goNext()
    } else if (event.key === 'End') {
      event.preventDefault()
      goLast()
    }
  }

  previous.addEventListener('click', goPrevious)
  next.addEventListener('click', goNext)
  skip.addEventListener('click', goLast)
  root.addEventListener('keydown', onKeyDown)
  renderBeat()

  return {
    destroy() {
      if (destroyed) return
      destroyed = true
      stopTyping(false)
      root.removeEventListener('keydown', onKeyDown)
      previous.removeEventListener('click', goPrevious)
      next.removeEventListener('click', goNext)
      skip.removeEventListener('click', goLast)
    },
  }
}
