import {
  applyImageChanges,
  imageRefKey,
  scanEmbeddedImages,
  type ImageChange,
} from '../../core/image-storage'
import {
  createMigrationReceipt,
  createStorageBackup,
  findUnmappedEmbeddedImages,
  parseMigrationReceipt,
  parseStorageBackup,
  restoreMigratedImages,
  type MigrationReceiptV1,
  type StorageBackupV1,
} from '../../core/image-storage-backup'
import type { PluginSettings } from '../../core/types'
import type { ImageSaveOptions } from './image-persistence'
import type { STAdapter } from './st-adapter'
import { stageEmbeddedImages } from './image-storage'

export interface ImageStorageDialogDeps {
  adapter: STAdapter
  getSettings(): PluginSettings
  updateSettings(next: PluginSettings): void
  saveDataUri(dataUri: string, options?: ImageSaveOptions): Promise<string>
  onClosed(): void
}

export interface ImageStorageDialogController {
  close(): void
}

type Phase = 'inspect' | 'staging' | 'staged' | 'restore-reading' | 'restore-ready' | 'applied' | 'closed'

function sameCandidates(left: ReturnType<typeof scanEmbeddedImages>, right: ReturnType<typeof scanEmbeddedImages>): boolean {
  if (left.ambiguous.length || right.ambiguous.length || left.candidates.length !== right.candidates.length) return false
  const sources = new Map(left.candidates.map((item) => [imageRefKey(item.ref), item.sourceUrl]))
  return right.candidates.every((item) => sources.get(imageRefKey(item.ref)) === item.sourceUrl)
}

function actionButton(label: string, action: () => void): HTMLButtonElement {
  const node = document.createElement('button')
  node.type = 'button'
  node.className = 'menu_button so-btn'
  node.textContent = label
  node.addEventListener('click', action)
  return node
}

function randomId(): string {
  const bytes = new Uint8Array(16)
  if (!globalThis.crypto?.getRandomValues) throw new Error('当前环境不支持安全随机备份 ID')
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}

function downloadJson(name: string, value: unknown, onDisposed: () => void): () => void {
  const url = URL.createObjectURL(new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' }))
  let timer: number | undefined
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    window.clearTimeout(timer)
    URL.revokeObjectURL(url)
    onDisposed()
  }
  const link = document.createElement('a')
  link.href = url
  link.download = name
  link.style.display = 'none'
  document.body.append(link)
  try {
    link.click()
    timer = window.setTimeout(dispose, 60_000)
    return dispose
  } catch (error) {
    dispose()
    throw error
  } finally {
    link.remove()
  }
}

export function openImageStorageDialog(deps: ImageStorageDialogDeps): ImageStorageDialogController {
  let phase: Phase = 'inspect'
  let backup: StorageBackupV1 | null = null
  let staged: ImageChange[] = []
  let receipt: MigrationReceiptV1 | null = null
  let backupDownloaded = false
  let receiptDownloaded = false
  let controller: AbortController | null = null
  let runToken = 0
  let restoreSource: { backup: StorageBackupV1; receipt: MigrationReceiptV1 } | null = null
  const downloads = new Set<() => void>()
  let scan = scanEmbeddedImages(deps.getSettings())
  const previousFocus = document.activeElement

  function download(name: string, data: unknown): void {
    let dispose: () => void = () => {}
    dispose = downloadJson(name, data, () => downloads.delete(dispose))
    downloads.add(dispose)
  }

  const backdrop = document.createElement('div')
  backdrop.className = 'so-storage-backdrop'
  const dialog = document.createElement('section')
  dialog.className = 'so-storage-dialog'
  dialog.setAttribute('role', 'dialog')
  dialog.setAttribute('aria-modal', 'true')
  dialog.setAttribute('aria-label', '存储检查与迁移')
  dialog.tabIndex = -1
  const heading = document.createElement('h3')
  heading.textContent = '存储检查与迁移'
  const summary = document.createElement('div')
  summary.textContent = '发现 ' + scan.embeddedReferenceCount + ' 个内嵌图片引用，' +
    scan.uniqueEmbeddedCount + ' 张不同图片，约 ' + scan.embeddedTextBytes + ' 字节文本'
  const status = document.createElement('div')
  status.className = 'so-storage-status'
  status.setAttribute('role', 'status')
  const privacy = document.createElement('p')
  privacy.className = 'so-storage-warning'
  privacy.textContent = '备份可能包含私人提示词和 API Key，仅保存在自己的设备，不要公开上传。'
  const progress = document.createElement('progress')
  progress.setAttribute('aria-label', '图片上传校验进度')
  const errors = document.createElement('ul')
  errors.className = 'so-storage-errors'
  const controls = document.createElement('div')
  controls.className = 'so-storage-actions'
  const confirmBackup = document.createElement('input')
  confirmBackup.type = 'checkbox'
  const confirmLabel = document.createElement('label')
  confirmLabel.append(confirmBackup, document.createTextNode('我已确认备份文件已保存在本机'))
  const backupButton = actionButton('下载当前插件状态备份', () => {
    if (phase !== 'inspect' && phase !== 'restore-ready') return
    invalidateBackup()
    try {
      scan = scanEmbeddedImages(deps.getSettings())
      backup = createStorageBackup(
        deps.getSettings(),
        deps.adapter.getStoredSettingsForBackup(),
        randomId(),
        new Date().toISOString(),
      )
      download('sprite-overlay-storage-backup-' + backup.backupId + '.json', backup)
      backupDownloaded = true
      status.textContent = scan.ambiguous.length > 0 || backup.unmappedEmbedded.length > 0
        ? '备份已下载，但存在未能唯一映射的内嵌图片，不能自动迁移。请先整理为明确的自定义图包后重新下载备份。'
        : '备份下载请求已完成，请确认文件已保存后开始迁移。'
    } catch (error) {
      invalidateBackup()
      status.textContent = error instanceof Error ? error.message : '备份失败'
    }
    render()
  })
  const startButton = actionButton('开始迁移内嵌图片', () => { void stage() })
  const receiptConfirmation = document.createElement('input')
  receiptConfirmation.type = 'checkbox'
  receiptConfirmation.dataset.confirm = 'receipt'
  const receiptLabel = document.createElement('label')
  receiptLabel.append(receiptConfirmation, document.createTextNode('我已确认迁移回执已保存在本机'))
  const receiptButton = actionButton('下载迁移回执', () => {
    if (!receipt || phase !== 'staged') return
    receiptDownloaded = false
    receiptConfirmation.checked = false
    try {
      download('sprite-overlay-image-migration-receipt-' + receipt.backupId + '.json', receipt)
      receiptDownloaded = true
      status.textContent = '回执下载请求已完成，请确认文件已保存后应用成功项。'
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : '回执下载失败'
    }
    render()
  })
  const applyButton = actionButton('确认应用成功项', () => {
    if (!receipt || !receiptDownloaded || !receiptConfirmation.checked || phase !== 'staged') return
    const result = applyImageChanges(deps.getSettings(), staged)
    finishApply(result, '应用')
  })
  const cancelButton = actionButton('取消暂存', () => {
    if (phase !== 'staging') return
    ++runToken
    controller?.abort()
    controller = null
    reset()
    status.textContent = '暂存已取消，原设置未改变；已上传的新文件未自动删除。'
  })
  const retryButton = actionButton('重新检查', () => reset())
  const restorePanel = document.createElement('details')
  restorePanel.className = 'so-storage-restore'
  const restoreHeading = document.createElement('summary')
  restoreHeading.textContent = '恢复迁移前图片'
  const restoreWarning = document.createElement('p')
  restoreWarning.className = 'so-storage-warning'
  restoreWarning.textContent = '恢复会重新写入内嵌图片，增大 settings。仅回退仍与回执匹配的图片，其他设置和后续编辑不变。'
  function fileInput(label: string): HTMLInputElement {
    const input = document.createElement('input')
    input.type = 'file'
    input.accept = '.json,application/json'
    input.setAttribute('aria-label', label)
    input.addEventListener('change', () => {
      if (phase === 'closed' || phase === 'staging' || phase === 'staged' || phase === 'applied') return
      ++runToken
      phase = 'inspect'
      restoreSource = null
      invalidateBackup()
      render()
    })
    const field = document.createElement('label')
    field.className = 'so-storage-file'
    field.append(document.createTextNode(label), input)
    restorePanel.append(field)
    return input
  }
  restorePanel.append(restoreHeading, restoreWarning)
  const restoreBackup = fileInput('迁移前备份')
  const restoreReceipt = fileInput('迁移回执')
  const inspectRestoreButton = actionButton('检查恢复文件', () => { void inspectRestore() })
  const restoreButton = actionButton('确认恢复图片', () => {
    if (phase !== 'restore-ready' || !restoreSource || !backupDownloaded || !confirmBackup.checked) return
    const result = restoreMigratedImages(deps.getSettings(), restoreSource.backup, restoreSource.receipt)
    finishApply(result, '恢复')
  })
  restorePanel.append(inspectRestoreButton, restoreButton)

  function finishApply(result: ReturnType<typeof applyImageChanges>, action: string): void {
    if (!checkRawImages()) return
    phase = 'applied'
    try {
      if (result.applied.length > 0) deps.updateSettings(result.settings)
      status.textContent = '已' + action + ' ' + result.applied.length + ' 项，冲突 ' +
        result.conflicts.length + ' 项未修改。' + (result.applied.length ? '宿主已请求保存，请重载后复查。' : '原设置未改变。')
    } catch (error) {
      status.textContent = '设置更新或界面刷新失败，请保留备份和回执，重载后复查：' + (error instanceof Error ? error.message : '未知错误')
    }
    staged = []
    receipt = null
    restoreSource = null
    backup = null
    render()
  }
  const closeButton = actionButton('关闭', () => close())
  controls.append(backupButton, confirmLabel, startButton, cancelButton, receiptButton, receiptLabel, applyButton, retryButton)
  const footer = document.createElement('div')
  footer.className = 'so-storage-footer'
  footer.append(closeButton)
  dialog.append(heading, summary, privacy, status, progress, errors, controls, restorePanel, footer)
  backdrop.append(dialog)
  document.body.append(backdrop)
  dialog.focus()

  function invalidateBackup(): void {
    backup = null
    backupDownloaded = false
    confirmBackup.checked = false
    staged = []
    receipt = null
    receiptDownloaded = false
    receiptConfirmation.checked = false
  }

  function reset(): void {
    if (phase === 'closed') return
    ++runToken
    phase = 'inspect'
    invalidateBackup()
    restoreSource = null
    scan = scanEmbeddedImages(deps.getSettings())
    errors.replaceChildren()
    status.textContent = ''
    render()
  }

  function checkRawImages(): boolean {
    if (!findUnmappedEmbeddedImages(deps.adapter.getStoredSettingsForBackup(), deps.getSettings()).length) return true
    reset()
    status.textContent = '当前原始设置有未能映射的内嵌图片，操作已停止。请重新下载备份并整理图片后再继续。'
    return false
  }

  function render(): void {
    if (phase === 'closed') return
    summary.textContent = '发现 ' + scan.embeddedReferenceCount + ' 个内嵌图片引用，' +
      scan.uniqueEmbeddedCount + ' 张不同图片，约 ' + scan.embeddedTextBytes + ' 字节文本'
    startButton.disabled = !backupDownloaded || !confirmBackup.checked ||
      scan.candidates.length === 0 || scan.ambiguous.length > 0 ||
      (backup?.unmappedEmbedded.length ?? 0) > 0 || phase !== 'inspect'
    receiptButton.disabled = !receipt || phase !== 'staged'
    applyButton.disabled = !receipt || !receiptDownloaded || !receiptConfirmation.checked || phase !== 'staged'
    backupButton.disabled = phase !== 'inspect' && phase !== 'restore-ready'
    confirmBackup.disabled = !backupDownloaded || (phase !== 'inspect' && phase !== 'restore-ready')
    receiptConfirmation.disabled = !receiptDownloaded || phase !== 'staged'
    receiptLabel.hidden = phase !== 'staged'
    receiptButton.hidden = applyButton.hidden = phase !== 'staged'
    cancelButton.hidden = phase !== 'staging'
    progress.hidden = phase !== 'staging'
    retryButton.disabled = phase === 'staging' || phase === 'restore-reading'
    inspectRestoreButton.disabled = phase !== 'inspect' || !restoreBackup.files?.length || !restoreReceipt.files?.length
    restoreBackup.disabled = restoreReceipt.disabled = phase !== 'inspect'
    restoreButton.disabled = phase !== 'restore-ready' || !restoreSource || !backupDownloaded || !confirmBackup.checked
  }

  async function inspectRestore(): Promise<void> {
    const backupFile = restoreBackup.files?.[0]
    const receiptFile = restoreReceipt.files?.[0]
    if (phase !== 'inspect' || !backupFile || !receiptFile) return
    const token = ++runToken
    phase = 'restore-reading'
    invalidateBackup()
    render()
    try {
      const sourceBackup = parseStorageBackup(await backupFile.text())
      if (token !== runToken) return
      const sourceReceipt = parseMigrationReceipt(await receiptFile.text(), sourceBackup)
      if (token !== runToken) return
      const result = restoreMigratedImages(deps.getSettings(), sourceBackup, sourceReceipt)
      restoreSource = { backup: sourceBackup, receipt: sourceReceipt }
      phase = 'restore-ready'
      restoreButton.hidden = false
      status.textContent = '可恢复 ' + result.applied.length + ' 项，冲突 ' + result.conflicts.length + ' 项。请先下载并确认当前插件状态备份。'
    } catch (error) {
      if (token !== runToken) return
      phase = 'inspect'
      restoreSource = null
      status.textContent = error instanceof Error ? error.message : '恢复文件校验失败'
    }
    render()
  }

  async function stage(): Promise<void> {
    if (!backup || !backupDownloaded || !confirmBackup.checked || phase !== 'inspect' ||
      scan.ambiguous.length || backup.unmappedEmbedded.length || !scan.candidates.length) return
    if (!checkRawImages()) return
    const latestScan = scanEmbeddedImages(deps.getSettings())
    if (!sameCandidates(scanEmbeddedImages(backup.settings), latestScan)) {
      scan = latestScan
      invalidateBackup()
      status.textContent = '备份后设置已变化，请重新下载备份并扫描后再迁移。'
      render()
      return
    }
    phase = 'staging'
    const token = ++runToken
    const sourceBackup = backup
    const runController = new AbortController()
    controller = runController
    errors.replaceChildren()
    progress.max = scan.candidates.length
    progress.value = 0
    render()
    try {
      parseStorageBackup(JSON.stringify(sourceBackup))
      const result = await stageEmbeddedImages(scan.candidates, {
        save: (dataUri, options) => deps.saveDataUri(dataUri, options),
      }, { signal: runController.signal, onProgress: (completed, total) => {
        if (token !== runToken) return
        progress.value = completed
        status.textContent = '校验进度 ' + completed + '/' + total
      } })
      if (token !== runToken || runController.signal.aborted || result.cancelled) return
      staged = result.ready
      receipt = staged.length ? createMigrationReceipt(sourceBackup, staged) : null
      phase = staged.length ? 'staged' : 'inspect'
      for (const failure of result.failed) {
        const item = document.createElement('li')
        item.textContent = failure.candidate.ref.tag + '：' + failure.message
        errors.append(item)
      }
      status.textContent = (staged.length ? '暂存完成' : '迁移未完成') + '：成功 ' + staged.length +
        ' 项，失败 ' + result.failed.length + ' 项，未处理 ' + result.unprocessed.length +
        ' 项，未支持 ' + sourceBackup.unmappedEmbedded.length + ' 项。原设置未改变。'
    } catch (error) {
      if (token === runToken && !runController.signal.aborted) {
        status.textContent = error instanceof Error ? error.message : '迁移失败，原设置未改变'
        phase = 'inspect'
      }
    } finally {
      if (controller === runController) controller = null
      render()
    }
  }

  function close(): void {
    if (phase === 'closed') return
    phase = 'closed'
    ++runToken
    controller?.abort()
    controller = null
    for (const dispose of downloads) dispose()
    downloads.clear()
    backup = null
    staged = []
    receipt = null
    restoreSource = null
    scan = { candidates: [], ambiguous: [], embeddedReferenceCount: 0, uniqueEmbeddedCount: 0, embeddedTextBytes: 0 }
    backdrop.remove()
    if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus()
    deps.onClosed()
  }

  confirmBackup.addEventListener('change', render)
  receiptConfirmation.addEventListener('change', render)
  dialog.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      event.stopPropagation()
      close()
    }
    if (event.key !== 'Tab') return
    const focusable = [...dialog.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), summary')]
      .filter((node) => node.getClientRects().length > 0)
    const first = focusable[0]
    const last = focusable.at(-1)
    if (event.shiftKey && (document.activeElement === first || document.activeElement === dialog)) {
      event.preventDefault()
      last?.focus()
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first?.focus()
    }
  })
  render()
  return { close }
}
