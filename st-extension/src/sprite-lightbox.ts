import type { SpritePack } from '../../core/types'

export interface SpriteLightboxAction {
  id: string
  label: string
  icon?: string
  disabled?: boolean
  destructive?: boolean
  run(pack: SpritePack, index: number): void | Promise<void>
}

export interface SpriteLightboxController {
  update(pack: SpritePack, index: number): void
  close(): void
}

export function openSpriteLightbox(options: {
  pack: SpritePack
  index: number
  readonly: boolean
  actions: SpriteLightboxAction[]
  onNavigate(index: number): void
  onClose(): void
}): SpriteLightboxController {
  let currentPack = options.pack
  let currentIndex = clampIndex(options.index, currentPack.sprites.length)
  let closed = false

  const layer = element('div', 'so-lightbox')
  layer.setAttribute('role', 'dialog')
  layer.setAttribute('aria-modal', 'true')
  layer.setAttribute('aria-label', '立绘预览')
  layer.dataset.readonly = String(options.readonly)

  const stage = element('div', 'so-lightbox-stage')
  const image = document.createElement('img')
  image.className = 'so-lightbox-image'
  const caption = element('div', 'so-lightbox-caption')
  const previous = control('◀', '上一张（← 方向键）', 'so-lightbox-nav so-lightbox-prev')
  const next = control('▶', '下一张（→ 方向键）', 'so-lightbox-nav so-lightbox-next')
  const closeButton = control('✕', '关闭（Esc）', 'so-lightbox-close')
  const actionRail = element('div', 'so-lightbox-actions')
  actionRail.setAttribute('role', 'toolbar')
  actionRail.setAttribute('aria-label', '立绘操作')
  stage.append(image)
  layer.append(stage, caption, previous, next, closeButton, actionRail)

  const visualViewport = window.visualViewport
  const applyViewport = (): void => {
    const left = visualViewport?.offsetLeft ?? 0
    const top = visualViewport?.offsetTop ?? 0
    const width = visualViewport?.width ?? window.innerWidth
    const height = visualViewport?.height ?? window.innerHeight
    layer.style.left = `${left}px`
    layer.style.top = `${top}px`
    layer.style.width = `${width}px`
    layer.style.height = `${height}px`
  }

  const renderActions = (): void => {
    actionRail.replaceChildren()
    const hidden = options.readonly || options.actions.length === 0
    actionRail.hidden = hidden
    layer.classList.toggle('so-lightbox-no-actions', hidden)
    if (options.readonly) return
    for (const action of options.actions) {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'so-lightbox-action'
      button.dataset.actionId = action.id
      button.disabled = Boolean(action.disabled)
      if (action.destructive) button.classList.add('so-lightbox-action-danger')
      if (action.icon) {
        const icon = element('span', 'so-lightbox-action-icon')
        icon.setAttribute('aria-hidden', 'true')
        icon.textContent = action.icon
        button.append(icon)
      }
      const label = element('span', 'so-lightbox-action-label')
      label.textContent = action.label
      button.append(label)
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        if (!button.disabled) void action.run(currentPack, currentIndex)
      })
      actionRail.append(button)
    }
  }

  const render = (): void => {
    const sprite = currentPack.sprites[currentIndex]
    if (sprite) {
      image.src = sprite.url
      image.alt = sprite.tag
      caption.textContent = `${sprite.tag}（${currentIndex + 1}/${currentPack.sprites.length}）`
    } else {
      image.removeAttribute('src')
      image.alt = ''
      caption.textContent = ''
    }
    const hasMultiple = currentPack.sprites.length > 1
    previous.disabled = !hasMultiple
    next.disabled = !hasMultiple
    renderActions()
  }

  const navigate = (delta: number): void => {
    const count = currentPack.sprites.length
    if (closed || count === 0) return
    currentIndex = (currentIndex + delta + count) % count
    render()
    options.onNavigate(currentIndex)
  }

  const close = (): void => {
    if (closed) return
    closed = true
    document.removeEventListener('keydown', onKeyDown, true)
    if (visualViewport) {
      visualViewport.removeEventListener('resize', applyViewport)
      visualViewport.removeEventListener('scroll', applyViewport)
    } else {
      window.removeEventListener('resize', applyViewport)
    }
    layer.remove()
    options.onClose()
  }

  const onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault()
      navigate(-1)
    } else if (event.key === 'ArrowRight') {
      event.preventDefault()
      navigate(1)
    } else if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
  }

  previous.addEventListener('click', (event) => {
    event.stopPropagation()
    navigate(-1)
  })
  next.addEventListener('click', (event) => {
    event.stopPropagation()
    navigate(1)
  })
  closeButton.addEventListener('click', (event) => {
    event.stopPropagation()
    close()
  })
  image.addEventListener('click', (event) => {
    event.stopPropagation()
    if (currentPack.sprites.length < 2) return
    const rect = image.getBoundingClientRect()
    navigate(event.clientX < rect.left + rect.width / 2 ? -1 : 1)
  })
  layer.addEventListener('click', (event) => {
    if (event.target === layer || event.target === stage) close()
  })
  document.addEventListener('keydown', onKeyDown, true)
  if (visualViewport) {
    visualViewport.addEventListener('resize', applyViewport)
    visualViewport.addEventListener('scroll', applyViewport)
  } else {
    window.addEventListener('resize', applyViewport)
  }

  const controller: SpriteLightboxController = {
    update(pack, index) {
      if (closed) return
      currentPack = pack
      currentIndex = clampIndex(index, pack.sprites.length)
      render()
    },
    close,
  }

  applyViewport()
  render()
  document.body.append(layer)
  return controller
}

function clampIndex(index: number, count: number): number {
  if (count === 0) return 0
  return Math.max(0, Math.min(index, count - 1))
}

function element(tag: string, className: string): HTMLElement {
  const node = document.createElement(tag)
  node.className = className
  return node
}

function control(text: string, label: string, className: string): HTMLButtonElement {
  const button = document.createElement('button')
  button.type = 'button'
  button.className = className
  button.textContent = text
  button.title = label
  button.setAttribute('aria-label', label)
  return button
}
