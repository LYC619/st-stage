import type { PhoneApp } from '../../../../core/phone-registry'
import { appButton, el } from '../widgets'
import { createSTCloudExportBridge, type CloudExportBridge } from './bridge'
import { loadSelectedExportFiles } from './export-loader'
import { downloadSTBackup } from './zip'
import type { ExportCharacter, ExportChat, ExportSelection, ExportSettingsAssets, ExportSnapshot, ExportTab, ExportWorldbook } from './types'

const TABS: Array<{ id: ExportTab; label: string }> = [
  { id: 'characters', label: '角色卡' }, { id: 'worldbooks', label: '世界书' },
  { id: 'presets', label: '预设' }, { id: 'regex', label: '正则' },
]
type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'
type LoadState<T> = { status: LoadStatus; data: T; error?: string }
type Downloader = typeof downloadSTBackup

function emptySelection(): ExportSelection { return { characterIds: new Set(), chatIds: new Set(), worldbookIds: new Set(), presetIds: new Set(), regex: false } }
function formatDate(value?: number): string { return value ? new Date(value).toLocaleString() : '更新时间未知' }
function backupFilename(now = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `default-user-${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}.zip`
}
function hasSelection(selection: ExportSelection): boolean {
  return selection.characterIds.size > 0 || selection.chatIds.size > 0 || selection.worldbookIds.size > 0 || selection.presetIds.size > 0 || selection.regex
}
function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const row = el('div', 'so-app-toggle'); const control = document.createElement('label'); const input = document.createElement('input')
  input.type = 'checkbox'; input.checked = checked; input.addEventListener('change', () => onChange(input.checked))
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
function deselectCharacter(
  characterId: string,
  selection: ExportSelection,
  chats: Map<string, { data: ExportChat[] }>,
): void {
  selection.characterIds.delete(characterId)
  for (const chat of chats.get(characterId)?.data ?? []) selection.chatIds.delete(chat.id)
}

export function cloudExportApp(bridge: CloudExportBridge = createSTCloudExportBridge(), download: Downloader = downloadSTBackup): PhoneApp {
  let disposeMount: (() => void) | undefined
  return {
    id: 'cloud-export', name: '导出', icon: '📦', order: 15,
    mount(container, ctx) {
      let disposed = false; let activeTab: ExportTab = 'characters'; let query = ''; let busy = false; let progressText = ''
      const selection = emptySelection(); const expandedCharacters = new Set<string>()
      const characters: LoadState<ExportCharacter[]> = { status: 'idle', data: [] }
      const worldbooks: LoadState<ExportWorldbook[]> = { status: 'idle', data: [] }
      const settings: LoadState<ExportSettingsAssets | null> = { status: 'idle', data: null }
      const chats = new Map<string, LoadState<ExportChat[]>>()
      const chatRequests = new Map<string, Promise<ExportChat[]>>()
      disposeMount = () => { disposed = true }

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

      const render = () => {
        if (disposed) return; container.replaceChildren()
        const title = el('div', 'so-app-title'); title.textContent = 'SillyTavern 选择式备份'
        const desc = el('div', 'so-app-desc'); desc.textContent = '选择需要的数据，统一导出为 SillyTavern 标准 default-user ZIP。'; container.append(title, desc)
        const tabs = el('div', 'so-app-section')
        for (const tab of TABS) { const button = appButton(tab.label, () => { if (busy || activeTab === tab.id) return; activeTab = tab.id; query = ''; render(); void ensureActiveTab() }); if (activeTab === tab.id) button.classList.add('cloud-export-active'); tabs.append(button) }
        container.append(tabs)
        const search = document.createElement('input'); search.className = 'text_pole so-app-input'; search.placeholder = '搜索当前分类'; search.value = query; search.disabled = busy; search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render() }); container.append(search)
        const visibleCharacters = characters.data.filter((item) => item.name.toLowerCase().includes(query))
        const visibleWorldbooks = worldbooks.data.filter((item) => item.name.toLowerCase().includes(query))
        const visiblePresets = (settings.data?.presets ?? []).filter((item) => item.name.toLowerCase().includes(query))
        const actions = el('div', 'so-app-section')
        const addAction = (label: string, action: () => void | Promise<void>) => actions.append(appButton(label, () => { if (!busy) void action() }))
        const toggleSet = (items: Array<{ id: string }>, set: Set<string>) => items.forEach((item) => set.has(item.id) ? set.delete(item.id) : set.add(item.id))
        if (activeTab === 'characters' && characters.status === 'ready' && visibleCharacters.length) {
          addAction('全选当前结果', () => { visibleCharacters.forEach((item) => selection.characterIds.add(item.id)); render() })
          addAction('反选当前结果', () => {
            visibleCharacters.forEach((item) => selection.characterIds.has(item.id)
              ? deselectCharacter(item.id, selection, chats)
              : selection.characterIds.add(item.id))
            render()
          })
          addAction('清空当前分类', () => { selection.characterIds.clear(); selection.chatIds.clear(); render() })
          addAction('全选角色及聊天', async () => { busy = true; progressText = '正在读取聊天清单…'; render(); try { await loadWithLimit(visibleCharacters, 4, async (character) => { const items = await ensureChats(character, false); selection.characterIds.add(character.id); items.forEach((chat) => selection.chatIds.add(chat.id)) }) } catch (error) { ctx.toast('error', `批量选择失败：${String(error)}`) } finally { busy = false; progressText = ''; render() } })
        } else if (activeTab === 'worldbooks' && worldbooks.status === 'ready' && visibleWorldbooks.length) {
          addAction('全选当前结果', () => { visibleWorldbooks.forEach((item) => selection.worldbookIds.add(item.id)); render() }); addAction('反选当前结果', () => { toggleSet(visibleWorldbooks, selection.worldbookIds); render() }); addAction('清空当前分类', () => { selection.worldbookIds.clear(); render() })
        } else if (activeTab === 'presets' && settings.status === 'ready' && visiblePresets.length) {
          addAction('全选当前结果', () => { visiblePresets.forEach((item) => selection.presetIds.add(item.id)); render() }); addAction('反选当前结果', () => { toggleSet(visiblePresets, selection.presetIds); render() }); addAction('清空当前分类', () => { selection.presetIds.clear(); render() })
        }
        if (actions.childElementCount) container.append(actions)
        const list = el('div', 'so-app-section'); const state = activeTab === 'characters' ? characters : activeTab === 'worldbooks' ? worldbooks : settings
        if (state.status === 'idle' || state.status === 'loading') list.textContent = '正在读取当前分类…'
        else if (state.status === 'error') { list.textContent = `读取失败：${state.error ?? '未知错误'}`; list.append(appButton('重试', () => { void ensureActiveTab(true) })) }
        else if (activeTab === 'characters') {
          for (const character of visibleCharacters) {
            const row = el('div', 'cloud-export-character'); row.append(checkbox(`${character.name} · ${formatDate(character.updatedAt)}`, selection.characterIds.has(character.id), (checked) => { if (checked) selection.characterIds.add(character.id); else deselectCharacter(character.id, selection, chats); render() }))
            row.append(appButton('选择角色及全部聊天', async () => { if (busy) return; busy = true; progressText = `正在读取 ${character.name} 的聊天清单…`; render(); try { const items = await ensureChats(character, false); selection.characterIds.add(character.id); items.forEach((chat) => selection.chatIds.add(chat.id)) } catch (error) { ctx.toast('error', `读取聊天清单失败：${String(error)}`) } finally { busy = false; progressText = ''; render() } }))
            const details = document.createElement('details'); details.open = expandedCharacters.has(character.id); const summary = document.createElement('summary'); const chatState = chats.get(character.id); summary.textContent = chatState?.status === 'ready' ? `聊天记录（${chatState.data.length}）` : '聊天记录（展开后读取）'; details.append(summary)
            if (chatState?.status === 'loading') details.append('正在读取聊天清单…')
            else if (chatState?.status === 'error') details.append(`读取失败：${chatState.error ?? '未知错误'}`)
            else if (chatState?.status === 'ready') {
              for (const chat of chatState.data) details.append(checkbox(`${chat.name} · ${formatDate(chat.updatedAt)}`, selection.chatIds.has(chat.id), (checked) => { if (checked) { selection.chatIds.add(chat.id); selection.characterIds.add(character.id) } else selection.chatIds.delete(chat.id); render() }))
            }
            details.addEventListener('toggle', () => { if (details.open) { expandedCharacters.add(character.id); void ensureChats(character) } else expandedCharacters.delete(character.id) }); row.append(details); list.append(row)
          }
        } else if (activeTab === 'worldbooks') {
          for (const worldbook of visibleWorldbooks) list.append(checkbox(`${worldbook.name} · ${formatDate(worldbook.updatedAt)}`, selection.worldbookIds.has(worldbook.id), (checked) => { if (checked) selection.worldbookIds.add(worldbook.id); else selection.worldbookIds.delete(worldbook.id); render() }))
        } else if (activeTab === 'presets') {
          for (const preset of visiblePresets) list.append(checkbox(`${preset.name} · ${formatDate(preset.updatedAt)}`, selection.presetIds.has(preset.id), (checked) => { if (checked) selection.presetIds.add(preset.id); else selection.presetIds.delete(preset.id); render() }))
        }
        else { const regex = settings.data?.regex; list.append(checkbox(regex ? `全局正则（${regex.rules.length} 条）` : '没有发现全局正则', selection.regex, (checked) => { selection.regex = Boolean(regex) && checked; render() })) }
        container.append(list)
        const footer = el('div', 'so-app-section'); const count = el('div', 'so-app-desc'); count.textContent = `已选 ${selection.characterIds.size} 个角色、${selection.chatIds.size} 段聊天、${selection.worldbookIds.size} 本世界书、${selection.presetIds.size} 个预设${selection.regex ? '、1 组正则' : ''}`; footer.append(count)
        if (progressText) { const progress = el('div', 'so-app-desc'); progress.textContent = progressText; footer.append(progress) }
        footer.append(appButton(busy ? '正在处理…' : '导出所选备份', async () => { if (busy) return; if (!hasSelection(selection)) { ctx.toast('warning', '请先选择要导出的内容'); return }; busy = true; progressText = '正在准备所选数据…'; render(); try { const catalog: ExportSnapshot = { characters: characters.data.map((character) => ({ ...character, chats: chats.get(character.id)?.data ?? [] })), worldbooks: worldbooks.data, presets: settings.data?.presets ?? [], regex: settings.data?.regex ?? null }; const files = await loadSelectedExportFiles({ bridge, catalog, selection, concurrency: 4, onProgress: ({ completed, total, current }) => { progressText = `正在读取 ${completed}/${total}：${current}`; render() } }); await download(files, backupFilename(), ({ percent }) => { progressText = `正在压缩 ${Math.round(percent)}%`; render() }); ctx.toast('success', 'SillyTavern 标准备份已下载') } catch (error) { ctx.toast('error', `导出失败：${String(error)}`) } finally { busy = false; progressText = ''; render() } }))
        container.append(footer)
      }
      render(); void ensureActiveTab()
    },
    unmount() { disposeMount?.(); disposeMount = undefined },
  }
}
