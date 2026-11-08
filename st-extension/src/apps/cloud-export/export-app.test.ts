// @vitest-environment jsdom

import { describe, expect, it, vi } from 'vitest'
import type { PhoneAppContext } from '../../../../core/phone-registry'
import type { CloudExportBridge } from './bridge'
import { cloudExportApp, findLinkedWorldbook } from './export-app'
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
  const target = [...container.querySelectorAll<HTMLElement>('[role="button"], [role="tab"]')]
    .find((element) => element.textContent === text)
  if (!target) throw new Error(`button not found: ${text}`)
  target.click()
}

/**
 * 勾选第一个角色的复选框。
 *
 * 角色卡按整体选中：勾选即带上全部聊天与关联世界书，所以不再有
 * 「选择角色及全部聊天」这个单独按钮。
 */
function checkCharacter(container: HTMLElement): void {
  const box = container.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (!box) throw new Error('character checkbox not found')
  box.checked = true
  box.dispatchEvent(new Event('change'))
}

/** 按顺序取第 index 个角色行的复选框，并设成 checked。 */
function setCharacterChecked(container: HTMLElement, index: number, checked: boolean): void {
  const rows = [...container.querySelectorAll<HTMLElement>('.cloud-export-character')]
  const box = rows[index]?.querySelector<HTMLInputElement>('input[type="checkbox"]')
  if (!box) throw new Error(`character checkbox not found at index ${index}`)
  box.checked = checked
  box.dispatchEvent(new Event('change'))
}

describe('cloud export app', () => {
  it('prefers the exact worldbook filename and refuses an ambiguous case-insensitive fallback', () => {
    const books = ['World', 'world'].map(name => ({ id: `${name}.json`, name, fileName: `${name}.json` }))
    expect(findLinkedWorldbook({ ...alice, linkedWorldName: 'world' }, books)?.id).toBe('world.json')
    expect(findLinkedWorldbook({ ...alice, linkedWorldName: 'WORLD' }, books)).toBeUndefined()
    expect(findLinkedWorldbook({ ...alice, linkedWorldName: 'WORLD.json' }, books.slice(0, 1))?.id).toBe('World.json')
  })

  it.each(['cancel', 'unmount'] as const)('%s stops in-flight reads and prevents late downloads', async mode => {
    const bridge = fakeBridge(), download = vi.fn(), ctx = context()
    let signal: AbortSignal | undefined, release!: (value: ArrayBuffer) => void
    vi.mocked(bridge.readCharacterCard).mockImplementation((_character, incoming) => {
      signal = incoming
      return new Promise(resolve => { release = resolve })
    })
    const app = cloudExportApp(bridge, download), container = document.createElement('div')
    document.body.append(container)
    app.mount(container, ctx); await settle()
    checkCharacter(container); await settle()
    clickText(container, '导出所选备份'); await settle()
    if (mode === 'cancel') clickText(container, '取消导出')
    else app.unmount?.()
    release(new ArrayBuffer(0)); await settle()
    expect(signal?.aborted).toBe(true)
    expect(download).not.toHaveBeenCalled()
    expect(ctx.toast).not.toHaveBeenCalledWith('success', expect.anything())
    if (mode === 'cancel') expect(container.querySelector('[data-export-focus="export"]')?.getAttribute('aria-disabled')).toBe('false')
    app.unmount?.(); container.remove()
  })

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

  it('selects a character together with all of its chats', async () => {
    const bridge = fakeBridge()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    checkCharacter(container)
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
    checkCharacter(container)
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

    checkCharacter(container)
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

    checkCharacter(container)
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

  // 真机反馈的 bug：角色卡与它的聊天、关联世界书是一体的，只导出 PNG 会缺件。
  // 内嵌世界书（data.character_book）和局部正则（data.extensions.regex_scripts）
  // 写在卡里，PNG 导出自带；但 data.extensions.world 只是个指向独立文件的名字。
  it('bundles the linked worldbook when a character is selected', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
    ])
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    // 角色分类挂载时不该预读世界书清单
    expect(bridge.listWorldbooks).not.toHaveBeenCalled()
    // 清单未读时只说会一起导出，不能说"没找到"——那是冤枉
    expect(container.textContent).toContain('关联世界书「World」按酒馆里的当前内容导出')
    expect(container.textContent).not.toContain('没找到')

    checkCharacter(container)
    await settle()

    expect(bridge.listWorldbooks).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天、1 本世界书')
  })

  it('matches the linked worldbook regardless of the .json suffix', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World.json' },
    ])
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    checkCharacter(container)
    await settle()
    expect(container.textContent).toContain('1 本世界书')
  })

  it('still selects the character but warns when the linked worldbook is missing', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'Vanished' },
    ])
    const ctx = context()
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, ctx)
    await settle()

    checkCharacter(container)
    await settle()

    // 角色卡本身一定导得出，缺件必须明说而不是静默
    expect(container.textContent).toContain('已选 1 个角色')
    expect(container.textContent).toContain('0 本世界书')
    expect(ctx.toast).toHaveBeenCalledWith(
      'warning',
      expect.stringContaining('Vanished'),
    )
  })

  it('reads the worldbook list once for a batch of characters', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
      { id: 'Bob.png', name: 'Bob', avatar: 'Bob.png', chats: [], linkedWorldName: 'World' },
    ])
    vi.mocked(bridge.listChats).mockImplementation(async (character) => [
      { id: `${character.id}:first`, name: 'first', path: 'first.jsonl' },
    ])
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    clickText(container, '全选当前结果')
    await settle()

    expect(bridge.listWorldbooks).toHaveBeenCalledOnce()
    expect(container.textContent).toContain('已选 2 个角色、2 段聊天、1 本世界书')
  })

  // 「清空当前分类」等于逐个取消角色：整体勾选带进来的关联世界书也要一起放掉
  it('releases bundled worldbooks when the character category is cleared', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
      { id: 'Bob.png', name: 'Bob', avatar: 'Bob.png', chats: [], linkedWorldName: 'World' },
    ])
    vi.mocked(bridge.listChats).mockImplementation(async (character) => [
      { id: `${character.id}:first`, name: 'first', path: 'first.jsonl' },
    ])
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()
    clickText(container, '全选当前结果')
    await settle()
    expect(container.textContent).toContain('已选 2 个角色、2 段聊天、1 本世界书')
    clickText(container, '清空当前分类')
    await settle()
    expect(container.textContent).toContain('已选 0 个角色、0 段聊天、0 本世界书')
  })

  // 勾选是整体选中，取消也必须对称：否则用户取消了角色，世界书还留在导出清单里
  it('releases the linked worldbook when the character is deselected', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
    ])
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    setCharacterChecked(container, 0, true)
    await settle()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天、1 本世界书')

    setCharacterChecked(container, 0, false)
    await settle()
    expect(container.textContent).toContain('已选 0 个角色、0 段聊天、0 本世界书')
  })

  // 多个角色可以关联同一本：放掉一个不能把另一个还需要的书一起带走
  it('keeps a shared worldbook while another selected character still links to it', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
      { id: 'Bob.png', name: 'Bob', avatar: 'Bob.png', chats: [], linkedWorldName: 'World' },
    ])
    vi.mocked(bridge.listChats).mockImplementation(async (character) => [
      { id: `${character.id}:first`, name: 'first', path: 'first.jsonl' },
    ])
    const container = document.createElement('div')
    cloudExportApp(bridge).mount(container, context())
    await settle()

    clickText(container, '全选当前结果')
    await settle()
    expect(container.textContent).toContain('已选 2 个角色、2 段聊天、1 本世界书')

    // 取消 Alice：Bob 还在，World 必须留着
    setCharacterChecked(container, 0, false)
    await settle()
    expect(container.textContent).toContain('已选 1 个角色、1 段聊天、1 本世界书')

    // 再取消 Bob：没人需要了，才放掉
    setCharacterChecked(container, 1, false)
    await settle()
    expect(container.textContent).toContain('已选 0 个角色、0 段聊天、0 本世界书')
  })

  // 计数器涨了不等于文件进了包，这里验证到实际产出的文件路径
  it('writes the linked worldbook into the exported archive', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
    ])
    const download = vi.fn()
    const container = document.createElement('div')
    cloudExportApp(bridge, download).mount(container, context())
    await settle()

    checkCharacter(container)
    await settle()
    clickText(container, '导出所选备份')
    await settle()

    expect(bridge.readWorldbook).toHaveBeenCalledOnce()
    expect(download).toHaveBeenCalledOnce()
    const paths = (download.mock.calls[0][0] as Array<{ path: string }>).map((file) => file.path)
    expect(paths).toContain('characters/Alice.png')
    expect(paths).toContain('worlds/World.json')
    expect(paths.some((path) => path.startsWith('chats/'))).toBe(true)
  })

  /**
   * 导出的必须是酒馆里那本实时世界书，不是卡内嵌的快照。
   *
   * 用户在玩的过程中改世界书，改动只落在 worlds/<名称>.json 上；卡里的
   * character_book 还是做卡时的旧内容。拿快照导出等于丢掉用户的修改。
   */
  it('exports the live worldbook content rather than the card snapshot', async () => {
    const bridge = fakeBridge()
    vi.mocked(bridge.listCharacters).mockResolvedValue([
      { ...alice, linkedWorldName: 'World' },
    ])
    // 磁盘上的实时内容：用户后来加过条目
    vi.mocked(bridge.readWorldbook).mockResolvedValue({
      entries: { '1': { content: '用户后来改过的条目' } },
    })
    const download = vi.fn()
    const container = document.createElement('div')
    cloudExportApp(bridge, download).mount(container, context())
    await settle()

    checkCharacter(container)
    await settle()
    clickText(container, '导出所选备份')
    await settle()

    // 内容取自 /api/worldinfo/get，而不是角色卡里的 character_book
    expect(bridge.readWorldbook).toHaveBeenCalledOnce()
    const files = download.mock.calls[0][0] as Array<{ path: string; data: string }>
    const world = files.find((file) => file.path === 'worlds/World.json')
    expect(world).toBeDefined()
    expect(String(world!.data)).toContain('用户后来改过的条目')
  })

  it('keeps the scroll position when a checkbox triggers a re-render', async () => {
    // jsdom 没有布局，scrollHeight/clientHeight 默认都是 0，滚动容器探测会一个都找不到。
    // 这里手动搭出一个"真的在滚"的祖先：手机外壳 .so-phone-screen 就是这个角色。
    const screen = document.createElement('div')
    screen.style.overflowY = 'auto'
    Object.defineProperty(screen, 'scrollHeight', { value: 2000, configurable: true })
    Object.defineProperty(screen, 'clientHeight', { value: 400, configurable: true })
    let scrollTop = 0
    Object.defineProperty(screen, 'scrollTop', {
      configurable: true,
      get: () => scrollTop,
      set: (value: number) => { scrollTop = value },
    })
    const container = document.createElement('div')
    screen.append(container)
    document.body.append(screen)

    try {
      cloudExportApp(fakeBridge()).mount(container, context())
      await settle()

      screen.scrollTop = 640
      checkCharacter(container)
      await settle()

      // 勾选会重渲染（计数器、进度、勾选态同在一棵树里）。回到顶部就没法连续勾选了。
      expect(screen.scrollTop).toBe(640)
    } finally {
      screen.remove()
    }
  })

  /**
   * 样式靠选择器匹配 DOM 才生效，改结构时很容易把选择器甩掉（标签管理弹窗就是
   * 这么失效的：弹窗挂到了 backdrop 上，`.so-manager` 后代选择器全部落空）。
   * 这里直接用 phone-shell.css 里写的那几个选择器去 matches()，结构一改就红。
   */
  it('keeps the cloud-export style hooks matching the rendered structure', async () => {
    const container = document.createElement('div')
    cloudExportApp(fakeBridge()).mount(container, context())
    await settle()

    // 分类网格依赖 `.cloud-export-tabs > .so-app-btn`：必须是直接子元素
    const tabs = container.querySelector('.cloud-export-tabs')
    expect(tabs).not.toBeNull()
    const tabButtons = [...tabs!.querySelectorAll<HTMLElement>('[role="tab"]')]
    expect(tabButtons).toHaveLength(4)
    for (const button of tabButtons) {
      expect(button.matches('.cloud-export-tabs > .so-app-btn')).toBe(true)
    }
    // 选中态此前只有类名没有样式，现在有了，别再把类名丢掉
    expect(tabs!.querySelectorAll('.cloud-export-active')).toHaveLength(1)

    // 层级三层：卡片 → 角色名（加粗）→ 聊天（缩进 + 左竖线）
    const row = container.querySelector('.cloud-export-character')
    expect(row).not.toBeNull()
    expect(row!.querySelector('.cloud-export-character-name')).not.toBeNull()
    expect(row!.querySelector('.cloud-export-bundle-note')).not.toBeNull()

    const chats = row!.querySelector('details')
    expect(chats!.matches('.cloud-export-chats')).toBe(true)

    chats!.open = true
    chats!.dispatchEvent(new Event('toggle'))
    await settle()
    const chatRow = container.querySelector('.cloud-export-chat')
    expect(chatRow).not.toBeNull()
    // 聊天行必须在 details 内部，缩进与左竖线是靠 .cloud-export-chats 提供的
    expect(container.querySelector('.cloud-export-chats .cloud-export-chat')).not.toBeNull()
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


describe('stable search input', () => {
  it('retains focus, caret and raw query while typing, editing, pasting and selecting results', async () => {
    const container = document.createElement('div')
    document.body.append(container)
    const app = cloudExportApp(fakeBridge(), vi.fn())
    app.mount(container, context())
    await settle()
    const input = container.querySelector<HTMLInputElement>('input.so-app-input')!
    input.focus()
    const check = () => {
      expect(container.querySelector('input.so-app-input')).toBe(input)
      expect(document.activeElement).toBe(input)
    }
    for (const char of ['A', 'l', 'i']) {
      input.setRangeText(char, input.selectionStart ?? 0, input.selectionEnd ?? 0, 'end')
      input.dispatchEvent(new InputEvent('input', { bubbles: true, data: char }))
      check()
    }
    expect(input.value).toBe('Ali')
    expect(input.selectionStart).toBe(3)
    input.setSelectionRange(1, 1)
    input.setRangeText('X', 1, 1, 'end')
    input.dispatchEvent(new InputEvent('input', { bubbles: true, data: 'X' }))
    check()
    expect(input.selectionStart).toBe(2)
    input.setRangeText('', 1, 2, 'end')
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'deleteContentBackward' }))
    check()
    input.setRangeText('Alice ', 0, input.value.length, 'end')
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertFromPaste' }))
    check()
    checkCharacter(container)
    await settle()
    check()
    expect(input.value).toBe('Alice ')
    expect(input.selectionStart).toBe(6)
    app.unmount?.()
    container.remove()
  })

  it('preserves an IME draft when lazy loading renders and commits only on compositionend', async () => {
    const bridge = fakeBridge()
    let resolve!: (value: ExportCharacter[]) => void
    vi.mocked(bridge.listCharacters).mockReturnValue(new Promise(done => { resolve = done }))
    const container = document.createElement('div')
    document.body.append(container)
    const app = cloudExportApp(bridge)
    app.mount(container, context())
    const input = container.querySelector<HTMLInputElement>('input.so-app-input')!
    input.focus()
    input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    input.value = ' 测试 '
    input.setSelectionRange(1, 3)
    input.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }))
    resolve([alice])
    await settle()
    expect(container.querySelector('input.so-app-input')).toBe(input)
    expect(document.activeElement).toBe(input)
    expect(input.value).toBe(' 测试 ')
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 3])
    expect(container.querySelectorAll('.cloud-export-character')).toHaveLength(1)
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true }))
    expect(container.querySelectorAll('.cloud-export-character')).toHaveLength(0)
    app.unmount?.()
    container.remove()
  })
})
