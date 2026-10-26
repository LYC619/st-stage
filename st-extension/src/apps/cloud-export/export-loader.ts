import type { CloudExportBridge } from './bridge'
import { t } from '../../../../core/i18n'
import { buildCharacterFiles, buildExportFiles } from './manifest'
import type { ExportFile, ExportSelection, ExportSnapshot, ExportWorldbook } from './types'

export interface ExportLoadProgress {
  completed: number
  total: number
  current: string
}

interface ExportTask {
  label: string
  run: () => Promise<void>
}

interface LoadSelectedExportFilesOptions {
  bridge: CloudExportBridge
  catalog: ExportSnapshot
  selection: ExportSelection
  concurrency?: number
  onProgress?: (progress: ExportLoadProgress) => void
}

async function runTasks(
  tasks: ExportTask[],
  concurrency: number,
  onProgress?: (progress: ExportLoadProgress) => void,
): Promise<void> {
  if (!tasks.length) return
  let nextIndex = 0
  let completed = 0
  let failed: unknown
  const worker = async () => {
    while (failed === undefined) {
      const index = nextIndex
      nextIndex += 1
      if (index >= tasks.length) return
      const task = tasks[index]
      try {
        await task.run()
      } catch (error) {
        failed = new Error(t('cloudExport.asset_read_failed', '读取{{label}}失败：{{error}}', { label: task.label, error: error instanceof Error ? error.message : String(error) }))
        return
      }
      completed += 1
      onProgress?.({ completed, total: tasks.length, current: task.label })
    }
  }
  const workerCount = Math.min(Math.max(1, Math.floor(concurrency)), tasks.length)
  await Promise.all(Array.from({ length: workerCount }, () => worker()))
  if (failed !== undefined) throw failed
}

export async function loadSelectedExportFiles({
  bridge,
  catalog,
  selection,
  concurrency = 4,
  onProgress,
}: LoadSelectedExportFilesOptions): Promise<ExportFile[]> {
  const cardData = new Map<string, ArrayBuffer>()
  const chatData = new Map<string, string>()
  const worldbookContent = new Map<string, unknown>()
  const tasks: ExportTask[] = []

  for (const character of catalog.characters) {
    if (selection.characterIds.has(character.id)) {
      tasks.push({
        label: t('cloudExport.asset_character', '角色卡 {{name}}', { name: character.name }),
        run: async () => { cardData.set(character.id, await bridge.readCharacterCard(character)) },
      })
    }
    for (const chat of character.chats) {
      if (!selection.chatIds.has(chat.id)) continue
      tasks.push({
        label: t('cloudExport.asset_chat', '聊天 {{character}}/{{chat}}', { character: character.name, chat: chat.name }),
        run: async () => { chatData.set(chat.id, await bridge.readChat(character, chat)) },
      })
    }
  }
  for (const worldbook of catalog.worldbooks) {
    if (!selection.worldbookIds.has(worldbook.id)) continue
    tasks.push({
      label: t('cloudExport.asset_worldbook', '世界书 {{name}}', { name: worldbook.name }),
      run: async () => { worldbookContent.set(worldbook.id, await bridge.readWorldbook(worldbook)) },
    })
  }

  await runTasks(tasks, concurrency, onProgress)

  const hydratedWorldbooks: ExportWorldbook[] = catalog.worldbooks.map((worldbook) => (
    worldbookContent.has(worldbook.id)
      ? { ...worldbook, content: worldbookContent.get(worldbook.id) }
      : worldbook
  ))
  const hydratedCatalog: ExportSnapshot = { ...catalog, worldbooks: hydratedWorldbooks }
  const files = buildExportFiles(hydratedCatalog, selection)
  for (const character of catalog.characters) {
    files.push(...buildCharacterFiles(character, cardData.get(character.id), chatData, selection))
  }
  return files
}
