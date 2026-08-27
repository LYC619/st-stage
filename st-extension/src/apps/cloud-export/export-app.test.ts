// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import type { CloudExportBridge } from './bridge'
import { cloudExportApp } from './export-app'
import type { ExportCharacter } from './types'

const alice: ExportCharacter = { id: 'Alice.png', name: 'Alice', avatar: 'Alice.png', chats: [] }

function fakeBridge(): CloudExportBridge {
  return {
    listCharacters: vi.fn(async () => [alice]),
    listChats: vi.fn(async () => [{ id: 'Alice.png:first', name: 'first', path: 'first.jsonl' }]),
    listWorldbooks: vi.fn(async () => [{ id: 'World.json', name: 'World', fileName: 'World.json' }]),
    loadSettingsAssets: vi.fn(async () => ({
      presets: [{ id: 'creative.json', name: 'creative', fileName: 'creative.json', content: {} }],
      regex: { rules: [{ find: 'x' }] },
    })),
    readWorldbook: vi.fn(async () => ({ entries: {} })),
    readCharacterCard: vi.fn(async () => new ArrayBuffer(0)),
    readChat: vi.fn(async () => '{}\n'),
  }
}

function context(): PhoneAppContext {
  return {
    toast: vi.fn(),
  } as unknown as PhoneAppContext
}

async function settle(): Promise<void> {
  await Promise.resolve()
  await new Promise((resolve) => setTimeout(resolve, 0))
}

function clickText(container: HTMLElement, text: string): void {
  const target = [...container.querySelectorAll<HTMLElement>('[role="button"]')]
    .find((element) => element.textContent === text)
  if (!target) throw new Error(`button not found: ${text}`)
  target.click()
}

describe('cloud export app', () => {
  it('loads only the character list on mount and lazily loads chats once', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    expect(bridge.listCharacters).toHaveBeenCalledOnce()
    expect(bridge.listChats).not.toHaveBeenCalled()
    expect(bridge.listWorldbooks).not.toHaveBeenCalled()
    expect(bridge.loadSettingsAssets).not.toHaveBeenCalled()

    const details = container.querySelector('details') as HTMLDetailsElement
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    await settle()
    expect(bridge.listChats).toHaveBeenCalledOnce()

    const reopened = container.querySelector('details') as HTMLDetailsElement
    reopened.open = false
    reopened.dispatchEvent(new Event('toggle'))
    reopened.open = true
    reopened.dispatchEvent(new Event('toggle'))
    await settle()
    expect(bridge.listChats).toHaveBeenCalledOnce()
  })

  it('loads each category on first visit only', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    clickText(container, '世界书')
    await settle()
    clickText(container, '角色卡')
    clickText(container, '世界书')
    await settle()
    expect(bridge.listWorldbooks).toHaveBeenCalledOnce()

    clickText(container, '预设')
    await settle()
    clickText(container, '正则')
    await settle()
    expect(bridge.loadSettingsAssets).toHaveBeenCalledOnce()
  })

  it('selects a character and all of its chats as one batch action', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    clickText(container, '选择角色及全部聊天')
    await settle()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天')
  })

  it('reuses an in-flight chat list when batch selection follows expansion', async () => {
    let resolveChats!: (value: Array<{ id: string; name: string; path: string }>) => void
    const pending = new Promise<Array<{ id: string; name: string; path: string }>>((resolve) => { resolveChats = resolve })
    const bridge = fakeBridge()
    vi.mocked(bridge.listChats).mockReturnValue(pending)
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    const details = container.querySelector('details') as HTMLDetailsElement
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    await settle()
    clickText(container, '选择角色及全部聊天')
    resolveChats([{ id: 'Alice.png:first', name: 'first', path: 'first.jsonl' }])
    await settle()

    expect(bridge.listChats).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天')
  })

  it('clears a character\'s chats when the character itself is deselected', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    clickText(container, '选择角色及全部聊天')
    await settle()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天')

    const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
    expect(box?.checked).toBe(true)
    box!.checked = false
    box!.dispatchEvent(new Event('change'))
    await settle()

    // 不能留下没有角色卡的孤立聊天
    expect(container.textContent).toContain('已选 0 个角色、0 段聊天')
  })

  it('does not strand chats when inverting a selected character', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    clickText(container, '选择角色及全部聊天')
    await settle()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天')

    clickText(container, '反选当前结果')
    await settle()
    expect(container.textContent).toContain('已选 0 个角色、0 段聊天')
  })

  it('still auto-selects the character when a single chat is checked', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    const details = container.querySelector('details') as HTMLDetailsElement
    details.open = true
    details.dispatchEvent(new Event('toggle'))
    await settle()

    const boxes = [...container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]')]
    const chatBox = boxes[boxes.length - 1]
    chatBox.checked = true
    chatBox.dispatchEvent(new Event('change'))
    await settle()

    expect(container.textContent).toContain('已选 1 个角色、1 段聊天')
  })

  it('does not download an empty package', async () => {
    const bridge = fakeBridge()
    const download = vi.fn()
    const ctx = context()
    const container = document.createElement('div')
    cloudExportApp(bridge, download).mount(container, ctx)
    await settle()

    clickText(container, '导出所选备份')
    await settle()
    expect(download).not.toHaveBeenCalled()
    expect(ctx.toast).toHaveBeenCalledWith('warning', '请先选择要导出的内容')
  })
})
