import type { PhoneApp } from '../../../../core/phone-registry'
import { appButton, el } from '../widgets'
import { buildCharacterFiles, buildExportFiles } from './manifest'
import { createSTCloudExportBridge, type CloudExportBridge } from './bridge'
import { downloadSTBackup } from './zip'
import type { ExportSelection, ExportSnapshot, ExportTab } from './types'

const TABS: Array<{ id: ExportTab; label: string }> = [
  { id: 'characters', label: '角色卡' },
  { id: 'worldbooks', label: '世界书' },
  { id: 'presets', label: '预设' },
  { id: 'regex', label: '正则' },
]

function emptySelection(): ExportSelection {
  return { characterIds: new Set(), chatIds: new Set(), worldbookIds: new Set(), presetIds: new Set(), regex: false }
}

function formatDate(value?: number): string {
  return value ? new Date(value).toLocaleString() : '更新时间未知'
}

function checkbox(label: string, checked: boolean, onChange: (value: boolean) => void): HTMLElement {
  const row = el('div', 'so-app-toggle')
  const control = document.createElement('label')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const text = el('span', '')
  text.textContent = label
  control.append(input, text)
  row.append(control)
  return row
}

export function cloudExportApp(bridge: CloudExportBridge = createSTCloudExportBridge()): PhoneApp {
  let disposeMount: (() => void) | undefined
  return {
    id: 'cloud-export',
    name: '导出',
    icon: '📦',
    order: 15,
    mount(container, ctx) {
      let disposed = false
      disposeMount = () => { disposed = true }
      let activeTab: ExportTab = 'characters'
      let query = ''
      let snapshot: ExportSnapshot | null = null
      const selection = emptySelection()
      const render = () => {
        if (disposed) return
        container.replaceChildren()
        const title = el('div', 'so-app-title')
        title.textContent = 'SillyTavern 数据导出'
        container.append(title)

        const tabs = el('div', 'so-app-section')
        for (const tab of TABS) {
          const button = appButton(tab.label, () => { activeTab = tab.id; render() })
          if (activeTab === tab.id) button.classList.add('cloud-export-active')
          tabs.append(button)
        }
        container.append(tabs)

        const search = document.createElement('input')
        search.className = 'text_pole so-app-input'
        search.placeholder = '搜索名称'
        search.value = query
        search.addEventListener('input', () => { query = search.value.trim().toLowerCase(); render() })
        container.append(search)

        const visibleCharacters = snapshot?.characters.filter((item) => item.name.toLowerCase().includes(query)) ?? []
        const visibleWorldbooks = snapshot?.worldbooks.filter((item) => item.name.toLowerCase().includes(query)) ?? []
        const visiblePresets = snapshot?.presets.filter((item) => item.name.toLowerCase().includes(query)) ?? []
        const selectableCount = activeTab === 'characters'
          ? visibleCharacters.length
          : activeTab === 'worldbooks'
            ? visibleWorldbooks.length
            : activeTab === 'presets' ? visiblePresets.length : 0
        if (snapshot && selectableCount > 0 && activeTab !== 'regex') {
          const allSelected = activeTab === 'characters'
            ? visibleCharacters.every((item) => selection.characterIds.has(item.id))
            : activeTab === 'worldbooks'
              ? visibleWorldbooks.every((item) => selection.worldbookIds.has(item.id))
              : visiblePresets.every((item) => selection.presetIds.has(item.id))
          const selectAll = appButton(allSelected ? '取消全选当前列表' : '全选当前列表', () => {
            if (activeTab === 'characters') {
              visibleCharacters.forEach((item) => allSelected ? selection.characterIds.delete(item.id) : selection.characterIds.add(item.id))
            } else if (activeTab === 'worldbooks') {
              visibleWorldbooks.forEach((item) => allSelected ? selection.worldbookIds.delete(item.id) : selection.worldbookIds.add(item.id))
            } else {
              visiblePresets.forEach((item) => allSelected ? selection.presetIds.delete(item.id) : selection.presetIds.add(item.id))
            }
            render()
          })
          selectAll.classList.add('cloud-export-select-all')
          container.append(selectAll)
        }

        const list = el('div', 'so-app-section')
        if (!snapshot) {
          list.textContent = '正在读取 SillyTavern 数据…'
        } else if (activeTab === 'characters') {
          for (const character of visibleCharacters) {
            const row = checkbox(`${character.name} · ${formatDate(character.updatedAt)}`, selection.characterIds.has(character.id), (checked) => {
              if (checked) selection.characterIds.add(character.id)
              else selection.characterIds.delete(character.id)
              render()
            })
            const details = document.createElement('details')
            const summary = document.createElement('summary')
            summary.textContent = `聊天记录（${character.chats.length}）`
            details.append(summary)
            for (const chat of character.chats) {
              details.append(checkbox(`${chat.name} · ${formatDate(chat.updatedAt)}`, selection.chatIds.has(chat.id), (checked) => {
                if (checked) {
                  selection.chatIds.add(chat.id)
                  selection.characterIds.add(character.id)
                } else {
                  selection.chatIds.delete(chat.id)
                }
                render()
              }))
            }
            row.append(details)
            list.append(row)
          }
        } else if (activeTab === 'worldbooks') {
          for (const worldbook of visibleWorldbooks) {
            list.append(checkbox(`${worldbook.name} · ${formatDate(worldbook.updatedAt)}`, selection.worldbookIds.has(worldbook.id), (checked) => {
              if (checked) selection.worldbookIds.add(worldbook.id)
              else selection.worldbookIds.delete(worldbook.id)
              render()
            }))
          }
        } else if (activeTab === 'presets') {
          for (const preset of visiblePresets) {
            list.append(checkbox(`${preset.name} · ${formatDate(preset.updatedAt)}`, selection.presetIds.has(preset.id), (checked) => {
              if (checked) selection.presetIds.add(preset.id)
              else selection.presetIds.delete(preset.id)
              render()
            }))
          }
        } else {
          list.append(checkbox(snapshot.regex ? `全局正则（${snapshot.regex.rules.length} 条）` : '没有发现全局正则', selection.regex, (checked) => {
            selection.regex = checked
            render()
          }))
        }
        container.append(list)

        const footer = el('div', 'so-app-section')
        const count = el('div', 'so-app-desc')
        count.textContent = `已选 ${selection.characterIds.size} 个角色、${selection.chatIds.size} 段聊天、${selection.worldbookIds.size} 本世界书、${selection.presetIds.size} 个预设${selection.regex ? '、1 组正则' : ''}`
        footer.append(count)
        const exportButton = appButton('导出 ZIP', async () => {
          if (!snapshot) return
          try {
            exportButton.textContent = '正在准备…'
            const files = buildExportFiles(snapshot, selection)
            for (const character of snapshot.characters.filter((item) => selection.characterIds.has(item.id))) {
              const chatData = new Map<string, string>()
              for (const chat of character.chats.filter((item) => selection.chatIds.has(item.id))) {
                chatData.set(chat.id, await bridge.readChat(character, chat))
              }
              files.push(...buildCharacterFiles(
                character,
                await bridge.readCharacterCard(character),
                chatData,
                selection,
              ))
            }
            await downloadSTBackup(files, `sillytavern-export-${new Date().toISOString().slice(0, 10)}.zip`, ({ percent }) => {
              exportButton.textContent = `打包中 ${Math.round(percent)}%`
            })
            ctx.toast('success', 'SillyTavern 数据包已下载')
          } catch (error) {
            ctx.toast('error', `导出失败：${String(error)}`)
          } finally {
            exportButton.textContent = '导出 ZIP'
          }
        })
        footer.append(exportButton)
        container.append(footer)
      }

      render()
      void bridge.loadSnapshot().then((next) => {
        if (!disposed) { snapshot = next; render() }
      }).catch((error) => {
        if (!disposed) {
          container.replaceChildren()
          const message = el('div', 'so-app-section')
          message.textContent = `读取 SillyTavern 数据失败：${String(error)}`
          container.append(message)
        }
      })
    },
    unmount() {
      disposeMount?.()
      disposeMount = undefined
    },
  }
}
