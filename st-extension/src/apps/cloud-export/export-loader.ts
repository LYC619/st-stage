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
  signal?: AbortSignal
  onProgress?: (progress: ExportLoadProgress) => void
}

async function runTasks(
  tasks: ExportTask[],
  concurrency: number,
  controller: AbortController,
  onProgress?: (progress: ExportLoadProgress) => void,
): Promise<void> {
  const { signal } = controller
  signal.throwIfAborted()
  if (!tasks.length) return
  let nextIndex = 0
  let completed = 0
  const worker = async () => {
    while (!signal.aborted) {
      const index = nextIndex
      nextIndex += 1
      if (index >= tasks.length) return
      const task = tasks[index]
      try {
        await task.run()
        if (signal.aborted) return
        completed += 1
        onProgress?.({ completed, total: tasks.length, current: task.label })
      } catch (error) {
        if (!signal.aborted) controller.abort(new Error(t('cloudExport.asset_read_failed', '读取{{label}}失败：{{error}}', { label: task.label, error: error instanceof Error ? error.message : String(error) })))
        return
      }
    }
  }
  const workerCount = Math.min(Number.isFinite(concurrency) ? Math.max(1, Math.floor(concurrency)) : 4, tasks.length)
  let onAbort!: () => void
  const cancelled = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try {
    await Promise.race([Promise.all(Array.from({ length: workerCount }, () => worker())), cancelled])
    signal.throwIfAborted()
  } finally { signal.removeEventListener('abort', onAbort) }
}

export async function loadSelectedExportFiles({
  bridge,
  catalog,
  selection,
  concurrency = 4,
  signal,
  onProgress,
}: LoadSelectedExportFilesOptions): Promise<ExportFile[]> {
  signal?.throwIfAborted()
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  const cardData = new Map<string, ArrayBuffer>()
  const chatData = new Map<string, string>()
  const worldbookContent = new Map<string, unknown>()
  const tasks: ExportTask[] = []

  for (const character of catalog.characters) {
    if (selection.characterIds.has(character.id)) {
      tasks.push({
        label: t('cloudExport.asset_character', '角色卡 {{name}}', { name: character.name }),
        run: async () => { cardData.set(character.id, await bridge.readCharacterCard(character, controller.signal)) },
      })
    }
    for (const chat of character.chats) {
      if (!selection.chatIds.has(chat.id)) continue
      tasks.push({
        label: t('cloudExport.asset_chat', '聊天 {{character}}/{{chat}}', { character: character.name, chat: chat.name }),
        run: async () => { chatData.set(chat.id, await bridge.readChat(character, chat, controller.signal)) },
      })
    }
  }
  for (const worldbook of catalog.worldbooks) {
    if (!selection.worldbookIds.has(worldbook.id)) continue
    tasks.push({
      label: t('cloudExport.asset_worldbook', '世界书 {{name}}', { name: worldbook.name }),
      run: async () => { worldbookContent.set(worldbook.id, await bridge.readWorldbook(worldbook, controller.signal)) },
    })
  }

  try { await runTasks(tasks, concurrency, controller, onProgress) }
  finally { signal?.removeEventListener('abort', onAbort) }

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
