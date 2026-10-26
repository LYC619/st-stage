import type { PhoneApp } from '../../../../core/phone-registry'
import { getLocale, t } from '../../../../core/i18n'
import { appButton, el } from '../widgets'
import { createSTCloudExportBridge, type CloudExportBridge } from './bridge'
import { loadSelectedExportFiles } from './export-loader'
import { downloadSTBackup } from './zip'
import type { ExportCharacter, ExportChat, ExportSelection, ExportSettingsAssets, ExportSnapshot, ExportTab, ExportWorldbook } from './types'

function exportTabs(): Array<{ id: ExportTab; label: string }> {
  return [
    { id: 'characters', label: t('cloudExport.characters', '角色卡') },
    { id: 'worldbooks', label: t('cloudExport.worldbooks', '世界书') },
    { id: 'presets', label: t('cloudExport.presets', '预设') },
    { id: 'regex', label: t('cloudExport.regex', '正则') },
  ]
}
let mountId = 0
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type LoadState<T> = { status: LoadStatus; data: T; error?: string }
type Downloader = typeof downloadSTBackup

function emptySelection(): ExportSelection { return { characterIds: new Set(), chatIds: new Set(), worldbookIds: new Set(), presetIds: new Set(), regex: false } }
function formatDate(value?: number): string { return value ? new Date(value).toLocaleString(getLocale()) : t('cloudExport.unknown_date', '更新时间未知') }
function backupFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `default-user-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`
}
function hasSelection(selection: ExportSelection): boolean {
  return selection.characterIds.size > 0 || selection.chatIds.size > 0 || selection.worldbookIds.size > 0 || selection.presetIds.size > 0 || selection.regex
}
function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void, focusKey: string, busy: boolean, extraClass = ''): HTMLElement {
  const row = el('div', `so-app-toggle${extraClass ? ` ${extraClass}` : ''}`); const control = document.createElement('label'); const input = document.createElement('input')
  input.type = 'checkbox'; input.checked = checked; input.dataset.exportFocus = focusKey
  input.setAttribute('aria-disabled', String(busy))
  input.addEventListener('click', event => { if (busy) event.preventDefault() })
  input.addEventListener('change', () => { if (busy) { input.checked = checked; return }; onChange(input.checked) })
  const text = el('span', ''); text.textContent = label; control.append(input, text); row.append(control); return row
}
async function loadWithLimit<T>(items: T[], limit: number, task: (item: T) => Promise<void>): Promise<void> {
  let next = 0
  const worker = async () => { while (next < items.length) { const index = next; next += 1; await task(items[index]) } }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()))
}

/**
 * 取消选择角色时连它的聊天一起取消。
 *
 * 勾选聊天会自动补上角色（否则导出的聊天没有对应角色卡），所以反方向也必须成立：
 * 只删角色会留下孤立的 `chats/<角色>/*.jsonl` 而没有 `characters/<avatar>.png`，
 * 且计数器会读成「已选 0 个角色、N 段聊天」。
 *
 * 聊天 ID 由桥接层构造为 `<角色 id>:<路径或名称>`，但这里不依赖该格式：以已加载的
 * 聊天清单为准，清单未加载过就不可能有该角色的聊天被选中。
 */
/**
 * 取消选中一个角色，并撤掉「勾选角色 = 整体选中」附带选上的东西。
 *
 * 勾选时会连聊天和关联世界书一起选（见 selectCharacterBundle），取消时必须对称地放掉，
 * 否则用户取消了角色、世界书还留在清单里，导出一本自己没打算带的世界书。
 *
 * 世界书不能无条件删：多个角色可以关联同一本。这里守的不变式是
 * **只要还有被选中的角色关联它，它就留着**——按当前选择集算，不记历史，
 * 所以反复勾选取消也不会漂移。
 *
 * 已知取舍：用户在「世界书」分类里手动勾的书，如果恰好也是某个角色的关联书，
 * 取消那个角色时会被一起放掉。区分手动与自动需要引入来源状态，而那个状态要跟
 * 勾选历史同步，比它解决的问题更容易出错。整体勾选的语义下，这个结果也讲得通。
 */
function deselectCharacter(
  characterId: string,
  selection: ExportSelection,
  chats: Map<string, { data: ExportChat[] }>,
  allCharacters: ExportCharacter[],
  worldbooks: ExportWorldbook[],
): void {
  selection.characterIds.delete(characterId)
  for (const chat of chats.get(characterId)?.data ?? []) selection.chatIds.delete(chat.id)

  const character = allCharacters.find((item) => item.id === characterId)
  if (!character?.linkedWorldName) return
  const linked = findLinkedWorldbook(character, worldbooks)
  if (!linked) return
  const stillNeeded = allCharacters.some((item) => (
    item.id !== characterId
    && selection.characterIds.has(item.id)
    && item.linkedWorldName
    && findLinkedWorldbook(item, worldbooks)?.id === linked.id
  ))
  if (!stillNeeded) selection.worldbookIds.delete(linked.id)
}

/**
 * 把角色卡声明的世界书名匹配到世界书清单里的条目。
 *
 * 卡里写的是名称（如 `枫丹设定`），清单条目的 id 可能带 `.json` 后缀，
 * 两边都归一后再比，避免因后缀差异漏掉本该一起导出的世界书。
 */
export function findLinkedWorldbook(
  character: ExportCharacter,
  worldbooks: ExportWorldbook[],
): ExportWorldbook | undefined {
  const target = character.linkedWorldName?.trim().toLowerCase().replace(/\.json$/i, '')
  if (!target) return undefined
  return worldbooks.find((book) => {
    const byId = book.id.trim().toLowerCase().replace(/\.json$/i, '')
    const byName = book.name.trim().toLowerCase().replace(/\.json$/i, '')
    return byId === target || byName === target
  })
}

export function cloudExportApp(bridge: CloudExportBridge = createSTCloudExportBridge(), download: Downloader = downloadSTBackup): PhoneApp {
  let disposeMount: (() => void) | undefined
  return {
    id: 'cloud-export', name: t('cloudExport.name', '导出'), icon: '📦', order: 15,
    mount(container, ctx) {
      let disposed = false; let activeTab: ExportTab = 'characters'; let query = ''; let busy = false; let progressText = ''
      const selection = emptySelection(); const expandedCharacters = new Set<string>()
      const characters: LoadState<ExportCharacter[]> = { status: 'idle', data: [] }
      const worldbooks: LoadState<ExportWorldbook[]> = { status: 'idle', data: [] }
      const settings: LoadState<ExportSettingsAssets | null> = { status: 'idle', data: null }
      const chats = new Map<string, LoadState<ExportChat[]>>()
      const chatRequests = new Map<string, Promise<ExportChat[]>>()
      disposeMount = () => { disposed = true }
      // 输入节点和其祖先只挂载一次，避免输入法、焦点和选区在 render 时丢失。
      const prefix = `cloud-export-${++mountId}`
      const title = el('div', 'so-app-title'); title.textContent = t('cloudExport.title', 'SillyTavern 选择式备份')
      const desc = el('div', 'so-app-desc'); desc.textContent = t('cloudExport.description', '选择需要的数据，统一导出为 SillyTavern 标准 default-user ZIP。')
      const tabs = el('div', 'so-app-section cloud-export-tabs')
      tabs.setAttribute('role', 'tablist'); tabs.setAttribute('aria-label', t('cloudExport.categories', '备份分类'))
      const search = document.createElement('input')
      search.className = 'text_pole so-app-input'
      search.placeholder = t('cloudExport.search', '搜索当前分类')
      search.setAttribute('aria-label', t('cloudExport.search', '搜索当前分类'))
      const results = el('div', 'cloud-export-results')
      results.id = `${prefix}-results`; results.setAttribute('role', 'tabpanel'); results.tabIndex = 0
      const footer = el('div', 'so-app-section')
      const count = el('div', 'so-app-desc')
      const status = el('div', 'so-app-desc')
      status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite'); status.setAttribute('aria-atomic', 'true')
      const exportButton = appButton(t('cloudExport.export', '导出所选备份'), () => { void exportSelected() })
      exportButton.dataset.exportFocus = 'export'
      footer.append(count, status, exportButton)
      let composing = false
      const applyQuery = () => { query = search.value.trim().toLowerCase(); render() }
      search.addEventListener('compositionstart', () => { composing = true })
      search.addEventListener('compositionend', () => { composing = false; applyQuery() })
      search.addEventListener('input', event => { if (!composing && !(event as InputEvent).isComposing) applyQuery() })
      container.replaceChildren(title, desc, tabs, search, results, footer)

      const ensureCharacters = async (retry = false): Promise<ExportCharacter[]> => {
        if (!retry && characters.status === 'ready') return characters.data
        characters.status = 'loading'; characters.error = undefined; render()
        try { const data = await bridge.listCharacters(); if (disposed) return data; characters.data = data; characters.status = 'ready'; render(); return data }
        catch (error) { if (!disposed) { characters.status = 'error'; characters.error = String(error); render() }; throw error }
      }
      const ensureWorldbooks = async (retry = false): Promise<ExportWorldbook[]> => {
        if (!retry && worldbooks.status === 'ready') return worldbooks.data
        worldbooks.status = 'loading'; worldbooks.error = undefined; render()
        try { const data = await bridge.listWorldbooks(); if (disposed) return data; worldbooks.data = data; worldbooks.status = 'ready'; render(); return data }
        catch (error) { if (!disposed) { worldbooks.status = 'error'; worldbooks.error = String(error); render() }; throw error }
      }
      const ensureSettings = async (retry = false): Promise<ExportSettingsAssets> => {
        if (!retry && settings.status === 'ready' && settings.data) return settings.data
        settings.status = 'loading'; settings.error = undefined; render()
        try { const data = await bridge.loadSettingsAssets(); if (disposed) return data; settings.data = data; settings.status = 'ready'; render(); return data }
        catch (error) { if (!disposed) { settings.status = 'error'; settings.error = String(error); render() }; throw error }
      }
      const ensureChats = async (character: ExportCharacter, shouldRender = true): Promise<ExportChat[]> => {
        const current = chats.get(character.id); if (current?.status === 'ready') return current.data
        const pending = chatRequests.get(character.id); if (pending) return pending
        const state: LoadState<ExportChat[]> = { status: 'loading', data: [] }; chats.set(character.id, state); if (shouldRender) render()
        const request = bridge.listChats(character).then((data) => { if (!disposed) { state.data = data; state.status = 'ready'; if (shouldRender) render() }; return data }).catch((error) => { state.status = 'error'; state.error = String(error); if (shouldRender) render(); throw error }).finally(() => { chatRequests.delete(character.id) })
        chatRequests.set(character.id, request)
        return request
      }
      const ensureActiveTab = async (retry = false): Promise<void> => { try { if (activeTab === 'characters') await ensureCharacters(retry); else if (activeTab === 'worldbooks') await ensureWorldbooks(retry); else await ensureSettings(retry) } catch { /* category renders retry */ } }

      /**
       * 勾选一个角色 = 把它当成一个整体选中：角色卡 + 全部聊天 + 关联世界书。
       *
       * 需要两次异步读取（聊天清单、世界书清单），所以勾选是个异步动作。
       * 任一步失败都不静默：角色本身仍然选上（PNG 一定能导出），但用 toast 说明
       * 哪一部分没能带上，避免用户以为整体已完整而实际缺件。
       */
      const selectCharacterBundle = async (character: ExportCharacter): Promise<void> => {
        if (busy) return
        selection.characterIds.add(character.id)
        busy = true; progressText = t('cloudExport.collect_character', '正在收集 {{name}} 的关联数据…', { name: character.name }); render()
        const missing: string[] = []
        try {
          try {
            const items = await ensureChats(character, false)
            items.forEach((chat) => selection.chatIds.add(chat.id))
          } catch { missing.push(t('cloudExport.chat_list', '聊天清单')) }

          if (character.linkedWorldName) {
            try {
              const books = await ensureWorldbooks()
              const linked = findLinkedWorldbook(character, books)
              if (linked) selection.worldbookIds.add(linked.id)
              else missing.push(t('cloudExport.linked_missing', '关联世界书「{{name}}」在清单里没找到', { name: character.linkedWorldName }))
            } catch { missing.push(t('cloudExport.worldbook_list', '世界书清单')) }
          }
        } finally {
          busy = false; progressText = ''; render()
        }
        if (!disposed && missing.length > 0) {
          ctx.toast('warning', t('cloudExport.bundle_incomplete', '{{name}} 已选中，但这些没能带上：{{items}}', { name: character.name, items: missing.join(t('cloudExport.list_separator', '、')) }))
        }
      }

      /** 批量按整体选中：并发读聊天清单，世界书清单只读一次。 */
      const selectVisibleBundles = async (targets: ExportCharacter[]): Promise<void> => {
        if (busy) return
        busy = true; progressText = t('cloudExport.collect_characters', '正在收集角色的关联数据…'); render()
        const unresolved: string[] = []
        try {
          // 只要有任一角色声明了关联世界书，就先把清单读进来（一次，不是每角色一次）
          let books: ExportWorldbook[] = worldbooks.data
          if (targets.some((item) => item.linkedWorldName)) {
            try { books = await ensureWorldbooks() } catch { unresolved.push(t('cloudExport.worldbook_list_failed', '世界书清单读取失败')) }
          }
          await loadWithLimit(targets, 4, async (character) => {
            selection.characterIds.add(character.id)
            try {
              const items = await ensureChats(character, false)
              items.forEach((chat) => selection.chatIds.add(chat.id))
            } catch { unresolved.push(t('cloudExport.character_chat_list', '{{name}} 的聊天清单', { name: character.name })) }
            if (!character.linkedWorldName) return
            const linked = findLinkedWorldbook(character, books)
            if (linked) selection.worldbookIds.add(linked.id)
            else unresolved.push(t('cloudExport.character_worldbook', '{{name}} 的关联世界书「{{worldbook}}」', { name: character.name, worldbook: character.linkedWorldName }))
          })
        } catch (error) {
          if (!disposed) ctx.toast('error', t('cloudExport.batch_failed', '批量选择失败：{{error}}', { error: String(error) }))
        } finally {
          busy = false; progressText = ''; render()
        }
        if (!disposed && unresolved.length > 0) {
          ctx.toast('warning', t('cloudExport.batch_incomplete', '已选中，但这些没能带上：{{items}}', { items: unresolved.join(t('cloudExport.list_separator', '、')) }))
        }
      }

      /**
       * 找到真正滚动的祖先。
       *
       * 滚动容器是手机外壳的 `.so-phone-screen`，在 app 容器**之外**，所以不能靠
       * 记录 container 自己的 scrollTop —— 它不滚动，永远是 0。
       */
      const scrollParent = (): HTMLElement | null => {
        let node: HTMLElement | null = container
        while (node) {
          const style = node.ownerDocument.defaultView?.getComputedStyle(node)
          const overflowY = style?.overflowY
          if ((overflowY === 'auto' || overflowY === 'scroll') && node.scrollHeight > node.clientHeight) return node
          node = node.parentElement
        }
        return null
      }

      const exportSelected = async (): Promise<void> => {
        if (busy || disposed) return
        if (!hasSelection(selection)) { ctx.toast('warning', t('cloudExport.select_first', '请先选择要导出的内容')); return }
        busy = true; progressText = t('cloudExport.preparing', '正在准备所选数据…'); render()
        try {
          const catalog: ExportSnapshot = {
            characters: characters.data.map(character => ({ ...character, chats: chats.get(character.id)?.data ?? [] })),
            worldbooks: worldbooks.data, presets: settings.data?.presets ?? [], regex: settings.data?.regex ?? null,
          }
          const files = await loadSelectedExportFiles({
            bridge, catalog, selection, concurrency: 4,
            onProgress: ({ completed, total, current }) => {
              progressText = t('cloudExport.read_progress', '正在读取 {{completed}}/{{total}}：{{current}}', { completed, total, current }); render()
            },
          })
          await download(files, backupFilename(), ({ percent }) => {
            progressText = t('cloudExport.compress_progress', '正在压缩 {{percent}}%', { percent: Math.round(percent) }); render()
          })
          if (!disposed) ctx.toast('success', t('cloudExport.downloaded', 'SillyTavern 标准备份已下载'))
        } catch (error) {
          if (!disposed) ctx.toast('error', t('cloudExport.export_failed', '导出失败：{{error}}', { error: String(error) }))
        } finally { busy = false; progressText = ''; render() }
      }

      /**
       * 全量重建会把滚动位置弹回顶部：replaceChildren() 瞬间把内容高度清成 0，
       * 浏览器于是把祖先的 scrollTop 夹到 0，重新填充后也不会自己弹回去。
       *
       * 勾选一个角色就要重渲染（计数器、进度、勾选态都在同一棵树里），所以不还原
       * 滚动位置的话，长角色列表里每勾一个都会跳回顶部，根本没法连续勾选。
       */
      const render = () => {
        if (disposed) return
        const scroller = scrollParent()
        const previousScrollTop = scroller?.scrollTop ?? 0
        // Capture only the control that owns focus now. Never retain a restore callback across awaits.
        const active = document.activeElement
        const focusKey = active instanceof HTMLElement && container.contains(active) ? active.dataset.exportFocus : undefined
        tabs.replaceChildren()
        const currentTabs = exportTabs()
        for (const [index, tab] of currentTabs.entries()) {
          const activate = () => {
            if (busy || activeTab === tab.id) return
            activeTab = tab.id; query = ''; composing = false; search.value = ''; render(); void ensureActiveTab()
          }
          // ST rewrites every .menu_button to role=button; tabs need their own native controls.
          const button = document.createElement('button')
          button.type = 'button'; button.className = 'so-app-btn'; button.textContent = tab.label
          button.addEventListener('click', activate)
          button.id = `${prefix}-tab-${tab.id}`; button.dataset.exportFocus = `tab:${tab.id}`
          button.setAttribute('role', 'tab'); button.setAttribute('aria-selected', String(activeTab === tab.id))
          button.setAttribute('aria-controls', results.id); button.setAttribute('aria-disabled', String(busy))
          button.tabIndex = activeTab === tab.id ? 0 : -1
          button.addEventListener('keydown', event => {
            // Keep native activation while preventing a host ancestor shortcut from clicking twice.
            if (event.key === 'Enter' || event.key === ' ') { event.stopPropagation(); return }
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? currentTabs.length - 1
              : event.key === 'ArrowRight' ? (index + 1) % currentTabs.length
                : event.key === 'ArrowLeft' ? (index + currentTabs.length - 1) % currentTabs.length : -1
            if (next < 0 || event.isComposing) return
            event.preventDefault(); event.stopPropagation()
            if (busy) return
            const target = tabs.children[next] as HTMLElement
            target.focus({ preventScroll: true }); target.click()
          })
          if (activeTab === tab.id) button.classList.add('cloud-export-active')
          tabs.append(button)
        }
        results.setAttribute('aria-labelledby', `${prefix}-tab-${activeTab}`)
        search.readOnly = busy; search.setAttribute('aria-disabled', String(busy))
        const visibleCharacters = characters.data.filter((item) => item.name.toLowerCase().includes(query))
        const visibleWorldbooks = worldbooks.data.filter((item) => item.name.toLowerCase().includes(query))
        const visiblePresets = (settings.data?.presets ?? []).filter((item) => item.name.toLowerCase().includes(query))
        const actions = el('div', 'so-app-section')
        const addAction = (key: string, label: string, action: () => void | Promise<void>) => {
          const button = appButton(label, () => { if (!busy) void action() })
          button.dataset.exportFocus = `${activeTab}:${key}`; button.setAttribute('aria-disabled', String(busy)); actions.append(button)
        }
        const toggleSet = (items: Array<{ id: string }>, set: Set<string>) => items.forEach((item) => set.has(item.id) ? set.delete(item.id) : set.add(item.id))
        if (activeTab === 'characters' && characters.status === 'ready' && visibleCharacters.length) {
          addAction('select-all', t('cloudExport.select_all', '全选当前结果'), () => { void selectVisibleBundles(visibleCharacters) })
          addAction('invert', t('cloudExport.invert', '反选当前结果'), () => {
            const toAdd = visibleCharacters.filter((item) => !selection.characterIds.has(item.id))
            visibleCharacters
              .filter((item) => selection.characterIds.has(item.id))
              .forEach((item) => deselectCharacter(item.id, selection, chats, characters.data, worldbooks.data))
            if (toAdd.length === 0) { render(); return }
            void selectVisibleBundles(toAdd)
          })
          addAction('clear', t('cloudExport.clear', '清空当前分类'), () => { selection.characterIds.clear(); selection.chatIds.clear(); render() })
        } else if (activeTab === 'worldbooks' && worldbooks.status === 'ready' && visibleWorldbooks.length) {
          addAction('select-all', t('cloudExport.select_all', '全选当前结果'), () => { visibleWorldbooks.forEach((item) => selection.worldbookIds.add(item.id)); render() }); addAction('invert', t('cloudExport.invert', '反选当前结果'), () => { toggleSet(visibleWorldbooks, selection.worldbookIds); render() }); addAction('clear', t('cloudExport.clear', '清空当前分类'), () => { selection.worldbookIds.clear(); render() })
        } else if (activeTab === 'presets' && settings.status === 'ready' && visiblePresets.length) {
          addAction('select-all', t('cloudExport.select_all', '全选当前结果'), () => { visiblePresets.forEach((item) => selection.presetIds.add(item.id)); render() }); addAction('invert', t('cloudExport.invert', '反选当前结果'), () => { toggleSet(visiblePresets, selection.presetIds); render() }); addAction('clear', t('cloudExport.clear', '清空当前分类'), () => { selection.presetIds.clear(); render() })
        }
        const list = el('div', 'so-app-section'); const state = activeTab === 'characters' ? characters : activeTab === 'worldbooks' ? worldbooks : settings
        const loading = state.status === 'idle' || state.status === 'loading'
        results.setAttribute('aria-busy', String(busy || loading))
        if (loading) list.textContent = t('cloudExport.loading_category', '正在读取当前分类…')
        else if (state.status === 'error') {
          list.textContent = t('cloudExport.read_failed', '读取失败：{{error}}', { error: state.error ?? t('cloudExport.unknown_error', '未知错误') })
          const retry = appButton(t('cloudExport.retry', '重试'), () => { if (!busy) void ensureActiveTab(true) })
          retry.dataset.exportFocus = `${activeTab}:retry`; retry.setAttribute('aria-disabled', String(busy)); list.append(retry)
        }
        else if (activeTab === 'characters') {
          for (const character of visibleCharacters) {
            const row = el('div', 'cloud-export-character')
            // 勾选角色 = 连它的聊天与关联世界书一起选：角色卡是一个整体，
            // 只导出 PNG 会丢掉独立成文件的关联世界书（内嵌世界书和局部正则在 PNG 里，不用单独收）
            row.append(checkbox(`${character.name} · ${formatDate(character.updatedAt)}`, selection.characterIds.has(character.id), (checked) => {
              if (!checked) { deselectCharacter(character.id, selection, chats, characters.data, worldbooks.data); render(); return }
              void selectCharacterBundle(character)
            }, `character:${character.id}`, busy, 'cloud-export-character-name'))
            const bundleNote = el('div', 'cloud-export-bundle-note')
            // 三态而非两态：世界书清单是懒加载的，"还没读"不等于"没找到"。
            // 混为一谈会在挂载时就冤枉一本其实存在的世界书。
            const linkedLabel = !character.linkedWorldName
              ? t('cloudExport.no_linked_worldbook', '没有关联独立世界书')
              : worldbooks.status !== 'ready'
                ? t('cloudExport.linked_current', '关联世界书「{{name}}」按酒馆里的当前内容导出', { name: character.linkedWorldName })
                : findLinkedWorldbook(character, worldbooks.data)
                  ? t('cloudExport.linked_current', '关联世界书「{{name}}」按酒馆里的当前内容导出', { name: character.linkedWorldName })
                  : t('cloudExport.linked_unavailable', '关联世界书「{{name}}」在酒馆世界书清单里没找到', { name: character.linkedWorldName })
            bundleNote.textContent = t('cloudExport.bundle_note', '勾选即整体导出：角色卡 + 全部聊天 + {{linked}}', { linked: linkedLabel })
            row.append(bundleNote)
            const details = document.createElement('details'); details.className = 'so-app-fold cloud-export-chats'; details.open = expandedCharacters.has(character.id)
            const summary = document.createElement('summary'); const chatState = chats.get(character.id)
            summary.textContent = chatState?.status === 'ready' ? t('cloudExport.chats_count', '聊天记录（{{count}}）', { count: chatState.data.length }) : t('cloudExport.chats_expand', '聊天记录（展开后读取）')
            summary.dataset.exportFocus = `chats:${character.id}`
            summary.setAttribute('aria-label', t('cloudExport.character_chats', '{{name}} 的{{chats}}', { name: character.name, chats: summary.textContent }))
            summary.setAttribute('aria-expanded', String(details.open))
            const chatBody = el('div', 'cloud-export-chat-list'); chatBody.id = `${prefix}-chats-${characters.data.indexOf(character)}`
            summary.setAttribute('aria-controls', chatBody.id); chatBody.setAttribute('aria-busy', String(chatState?.status === 'loading'))
            details.append(summary, chatBody)
            if (chatState?.status === 'loading') chatBody.append(t('cloudExport.loading_chats', '正在读取聊天清单…'))
            else if (chatState?.status === 'error') chatBody.append(t('cloudExport.read_failed', '读取失败：{{error}}', { error: chatState.error ?? t('cloudExport.unknown_error', '未知错误') }))
            else if (chatState?.status === 'ready') {
              for (const chat of chatState.data) chatBody.append(checkbox(`${chat.name} · ${formatDate(chat.updatedAt)}`, selection.chatIds.has(chat.id), (checked) => { if (checked) { selection.chatIds.add(chat.id); selection.characterIds.add(character.id) } else selection.chatIds.delete(chat.id); render() }, `chat:${chat.id}`, busy, 'cloud-export-chat'))
            }
            details.addEventListener('toggle', () => {
              if (disposed || !container.contains(details)) return
              summary.setAttribute('aria-expanded', String(details.open))
              // Restoring open details queues a native toggle too; only a user state change loads data.
              if (details.open === expandedCharacters.has(character.id)) return
              if (details.open) { expandedCharacters.add(character.id); void ensureChats(character).catch(() => { /* shown in the chat list */ }) }
              else { expandedCharacters.delete(character.id); render() }
            }); row.append(details); list.append(row)
          }
        } else if (activeTab === 'worldbooks') {
          for (const worldbook of visibleWorldbooks) list.append(checkbox(`${worldbook.name} · ${formatDate(worldbook.updatedAt)}`, selection.worldbookIds.has(worldbook.id), (checked) => { if (checked) selection.worldbookIds.add(worldbook.id); else selection.worldbookIds.delete(worldbook.id); render() }, `worldbook:${worldbook.id}`, busy))
        } else if (activeTab === 'presets') {
          for (const preset of visiblePresets) list.append(checkbox(`${preset.name} · ${formatDate(preset.updatedAt)}`, selection.presetIds.has(preset.id), (checked) => { if (checked) selection.presetIds.add(preset.id); else selection.presetIds.delete(preset.id); render() }, `preset:${preset.id}`, busy))
        }
        else { const regex = settings.data?.regex; list.append(checkbox(regex ? t('cloudExport.regex_count', '全局正则（{{count}} 条）', { count: regex.rules.length }) : t('cloudExport.no_regex', '没有发现全局正则'), selection.regex, (checked) => { selection.regex = Boolean(regex) && checked; render() }, 'regex', busy || !regex)) }
        if (state.status === 'ready' && !list.childNodes.length) list.textContent = t('cloudExport.no_matches', '没有匹配的项目')
        results.replaceChildren(...(actions.childElementCount ? [actions, list] : [list]))
        const countText = t('cloudExport.count', '已选 {{characters}} 个角色、{{chats}} 段聊天、{{worldbooks}} 本世界书、{{presets}} 个预设{{regex}}', {
          characters: selection.characterIds.size, chats: selection.chatIds.size, worldbooks: selection.worldbookIds.size,
          presets: selection.presetIds.size, regex: selection.regex ? t('cloudExport.regex_selected', '、1 组正则') : '',
        })
        if (count.textContent !== countText) count.textContent = countText
        const chatStatus = activeTab === 'characters' ? visibleCharacters
          .filter(character => expandedCharacters.has(character.id))
          .map(character => chats.get(character.id))
          .find(state => state?.status === 'loading' || state?.status === 'error') : undefined
        const statusText = progressText || (loading ? t('cloudExport.loading_category', '正在读取当前分类…') : state.status === 'error'
          ? t('cloudExport.read_failed', '读取失败：{{error}}', { error: state.error ?? t('cloudExport.unknown_error', '未知错误') })
          : chatStatus?.status === 'loading' ? t('cloudExport.loading_chats', '正在读取聊天清单…') : chatStatus?.status === 'error'
            ? t('cloudExport.read_failed', '读取失败：{{error}}', { error: chatStatus.error ?? t('cloudExport.unknown_error', '未知错误') }) : countText)
        // Keep the live region in place; repeated renders must not repeatedly announce unchanged text.
        if (status.textContent !== statusText) status.textContent = statusText
        count.hidden = statusText === countText
        exportButton.textContent = busy ? t('cloudExport.processing', '正在处理…') : t('cloudExport.export', '导出所选备份')
        exportButton.setAttribute('aria-disabled', String(busy))
        if (focusKey && active !== document.activeElement && container.isConnected && document.activeElement === document.body) {
          const target = [...container.querySelectorAll<HTMLElement>('[data-export-focus]')].find(node => node.dataset.exportFocus === focusKey)
          ;(target ?? results).focus({ preventScroll: true })
        }
        // 内容已重新填充，此时才能把滚动位置放回去（早了会被夹到 0）。
        // 内容变短时 scrollTop 会被浏览器自动夹到新的最大值，不需要自己算边界。
        if (scroller && previousScrollTop > 0) scroller.scrollTop = previousScrollTop
      }
      render(); void ensureActiveTab()
    },
    unmount() { disposeMount?.(); disposeMount = undefined },
  }
}
