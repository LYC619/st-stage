// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings, type PluginSettings, type Sprite } from '../../core/types'
import { createStoryImageCapture } from './story-image-capture'

function appendImage(parent: HTMLElement, src: string, className = '', width = 512): HTMLImageElement {
  const image = document.createElement('img')
  image.src = src
  image.alt = '生成场景图'
  image.className = className
  image.width = width
  image.height = width
  parent.append(image)
  return image
}

function aiMessage(): HTMLElement {
  const message = document.createElement('div')
  message.className = 'mes'
  message.setAttribute('is_user', 'false')
  const text = document.createElement('div')
  text.className = 'mes_text'
  message.append(text)
  document.body.append(message)
  return text
}

function setup(localize = vi.fn(async (source: Sprite) => ({
  ...source,
  url: '/user/story/image.webp',
  remoteUrl: source.url,
}))) {
  let settings: PluginSettings = createDefaultSettings()
  const capture = createStoryImageCapture({
    getSettings: () => settings,
    updateSettings: (next) => { settings = next },
    getStoryContext: () => ({ key: 'c1::chat/1', title: '第一章', characterName: '小雪' }),
    localize,
  })
  return { capture, localize, getSettings: () => settings }
}

afterEach(() => {
  document.body.innerHTML = ''
  vi.restoreAllMocks()
})

describe('createStoryImageCapture', () => {
  it('adds one text action to eligible AI images without downloading during decoration', () => {
    const root = aiMessage()
    const eligible = appendImage(root, 'https://img.test/generated.png')
    const messageToolbar = document.createElement('div')
    root.parentElement!.append(messageToolbar)
    appendImage(messageToolbar, 'https://img.test/message-action.png')
    appendImage(root, 'https://img.test/tiny.png', '', 32)
    appendImage(root, 'https://img.test/sprite.png', 'so-inline-sprite')
    appendImage(root, 'https://img.test/emoji.png', 'emoji')
    const renderer = document.createElement('span')
    renderer.className = 'so-renderer-gal'
    root.append(renderer)
    appendImage(renderer, 'https://img.test/renderer.png')
    const user = document.createElement('div')
    user.className = 'mes'
    user.setAttribute('is_user', 'true')
    const userText = document.createElement('div')
    userText.className = 'mes_text'
    user.append(userText)
    document.body.append(user)
    appendImage(userText, 'https://img.test/user.png')
    const { capture, localize } = setup()

    capture.decorate(document)
    capture.decorate(document)

    const actions = document.querySelectorAll<HTMLButtonElement>('.so-story-save-action')
    expect(actions).toHaveLength(1)
    expect(actions[0].textContent).toBe('保存到图库')
    expect(actions[0].previousElementSibling).toBe(eligible)
    expect(localize).not.toHaveBeenCalled()
  })

  it('archives a localized sprite only after the explicit action succeeds', async () => {
    const root = aiMessage()
    appendImage(root, 'https://img.test/generated.png')
    const { capture, localize, getSettings } = setup()
    capture.decorate(root)

    document.querySelector<HTMLButtonElement>('.so-story-save-action')!.click()

    await vi.waitFor(() => expect(getSettings().packs).toHaveLength(1))
    expect(localize).toHaveBeenCalledTimes(1)
    expect(getSettings().packs[0].sprites[0]).toMatchObject({
      tag: '生成场景图',
      url: '/user/story/image.webp',
      remoteUrl: 'https://img.test/generated.png',
    })
    expect(document.querySelector('.so-story-save-action')?.textContent).toBe('已保存')
  })

  it('offers remote-reference storage on CORS failure without claiming a local save', async () => {
    const root = aiMessage()
    appendImage(root, 'https://img.test/cors.png')
    const confirm = vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { capture, getSettings } = setup(vi.fn(async () => {
      throw new Error('下载远程图片失败：CORS blocked')
    }))
    capture.decorate(root)

    document.querySelector<HTMLButtonElement>('.so-story-save-action')!.click()

    await vi.waitFor(() => expect(getSettings().packs).toHaveLength(1))
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining('仅保留远程引用'))
    expect(getSettings().packs[0].sprites[0].url).toBe('https://img.test/cors.png')
    expect(document.querySelector('.so-story-save-action')?.textContent).toBe('已保存远程引用')
  })

  it('keeps the clicked story context while localization is in flight', async () => {
    const root = aiMessage()
    appendImage(root, 'https://img.test/generated.png')
    let story = { key: 'c1::chat/1', title: '第一章', characterName: '小雪' }
    const localize = vi.fn(async (source: Sprite) => {
      story = { key: 'c1::chat/2', title: '第二章', characterName: '小雪' }
      return { ...source, url: '/user/story/image.webp', remoteUrl: source.url }
    })
    let settings = createDefaultSettings()
    const capture = createStoryImageCapture({
      getSettings: () => settings,
      updateSettings: (next) => { settings = next },
      getStoryContext: () => story,
      localize,
    })
    capture.decorate(root)

    document.querySelector<HTMLButtonElement>('.so-story-save-action')!.click()

    await vi.waitFor(() => expect(settings.packs).toHaveLength(1))
    expect(settings.packs[0].sourceStoryKey).toBe('c1::chat/1')
    expect(localize).toHaveBeenCalledWith(
      expect.objectContaining({ url: 'https://img.test/generated.png' }),
      '生成场景图.webp',
      expect.objectContaining({ key: 'c1::chat/1' }),
    )
  })

  it('returns to the idle action when remote-reference storage is cancelled', async () => {
    const root = aiMessage()
    appendImage(root, 'https://img.test/cors.png')
    vi.spyOn(window, 'confirm').mockReturnValue(false)
    const { capture, getSettings } = setup(vi.fn(async () => {
      throw new Error('CORS blocked')
    }))
    capture.decorate(root)
    const action = document.querySelector<HTMLButtonElement>('.so-story-save-action')!

    action.click()

    await vi.waitFor(() => expect(action.disabled).toBe(false))
    expect(action.textContent).toBe('保存到图库')
    expect(getSettings().packs).toHaveLength(0)
  })

  it('removes decorations and listeners on cleanup', () => {
    const root = aiMessage()
    appendImage(root, 'https://img.test/generated.png')
    const { capture, localize } = setup()
    capture.decorate(root)
    const action = document.querySelector<HTMLButtonElement>('.so-story-save-action')!

    capture.cleanup()
    action.click()

    expect(document.querySelector('.so-story-save-action')).toBeNull()
    expect(localize).not.toHaveBeenCalled()
  })
})
