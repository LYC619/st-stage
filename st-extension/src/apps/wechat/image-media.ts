/** A failed image stays readable and keyboard-retryable without changing its saved URL. */
export function createImageMedia(src: string, alt: string, open?: () => void) {
  const element = document.createElement(open ? 'button' : 'div')
  element.className = 'wt-image-media'
  const image = document.createElement('img'); image.alt = alt
  const failure = document.createElement('span'); failure.className = 'wt-image-failure'; failure.hidden = true
  const status = document.createElement('span'); status.setAttribute('role', 'status')
  const retry = open ? element : document.createElement('button')
  if (retry instanceof HTMLButtonElement) retry.type = 'button'
  const label = document.createElement('span')
  failure.append(status)
  if (open) failure.append(label)
  else { retry.append(label); failure.append(retry); element.tabIndex = -1 }
  element.append(image, failure)
  let failed = false, loading = false
  const name = () => retry.setAttribute('aria-label', `${failed ? (open ? status.textContent + ' ' : '') + label.textContent : '查看图片'}：${alt}`)
  image.onerror = () => {
    failed = true; loading = false; image.hidden = true; failure.hidden = false
    status.textContent = '⚠ 图片加载失败'; label.textContent = '点击重试'
    retry.removeAttribute('aria-disabled'); element.removeAttribute('aria-busy'); name()
  }
  image.onload = () => {
    if (!open && document.activeElement === retry) element.focus({ preventScroll: true })
    failed = false; loading = false; image.hidden = false; failure.hidden = true
    retry.removeAttribute('aria-disabled'); element.removeAttribute('aria-busy'); name()
  }
  retry.onclick = () => {
    if (loading) return
    if (!failed) { open?.(); return }
    loading = true; element.setAttribute('aria-busy', 'true'); retry.setAttribute('aria-disabled', 'true')
    status.textContent = '正在重新加载图片…'; label.textContent = '请稍候'; name()
    image.src = src
  }
  name(); image.src = src
  return { element, image }
}
