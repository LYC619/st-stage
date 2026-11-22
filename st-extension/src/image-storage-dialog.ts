import { t } from '../../core/i18n'
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
import { manageDialogFocus } from '../../core/dialog-focus'

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
  if (!globalThis.crypto?.getRandomValues) throw new Error(t('storage.errors.random_backup', '当前环境不支持安全随机备份 ID'))
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
  dialog.setAttribute('aria-label', t('storage.title', '存储检查与迁移'))
  dialog.tabIndex = -1
  const heading = document.createElement('h3')
  heading.textContent = t('storage.title', '存储检查与迁移')
  const summary = document.createElement('div')
  summary.textContent = t('storage.summary', '发现 {{refs}} 个内嵌图片引用，{{images}} 张不同图片，约 {{bytes}} 字节文本', { refs: scan.embeddedReferenceCount, images: scan.uniqueEmbeddedCount, bytes: scan.embeddedTextBytes })
  const status = document.createElement('div')
  status.className = 'so-storage-status'
  status.setAttribute('role', 'status')
  const privacy = document.createElement('p')
  privacy.className = 'so-storage-warning'
  privacy.textContent = t('storage.privacy', '备份可能包含私人提示词和 API Key，仅保存在自己的设备，不要公开上传。')
  const progress = document.createElement('progress')
  progress.setAttribute('aria-label', t('storage.progress_label', '图片上传校验进度'))
  const errors = document.createElement('ul')
  errors.className = 'so-storage-errors'
  const controls = document.createElement('div')
  controls.className = 'so-storage-actions'
  const confirmBackup = document.createElement('input')
  confirmBackup.type = 'checkbox'
  const confirmLabel = document.createElement('label')
  confirmLabel.append(confirmBackup, document.createTextNode(t('storage.confirm_backup', '我已确认备份文件已保存在本机')))
  const backupButton = actionButton(t('storage.download_backup', '下载当前插件状态备份'), () => {
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
        ? t('storage.backup_unmapped', '备份已下载，但存在未能唯一映射的内嵌图片，不能自动迁移。请先整理为明确的自定义图包后重新下载备份。')
        : t('storage.backup_downloaded', '备份文件已开始下载，确认存好后再点「开始迁移内嵌图片」。')
    } catch (error) {
      invalidateBackup()
      status.textContent = error instanceof Error ? error.message : t('storage.backup_failed', '备份失败')
    }
    render()
  })
  const startButton = actionButton(t('storage.start', '开始迁移内嵌图片'), () => { void stage() })
  const receiptConfirmation = document.createElement('input')
  receiptConfirmation.type = 'checkbox'
  receiptConfirmation.dataset.confirm = 'receipt'
  const receiptLabel = document.createElement('label')
  receiptLabel.append(receiptConfirmation, document.createTextNode(t('storage.confirm_receipt', '我已确认迁移回执已保存在本机')))
  const receiptButton = actionButton(t('storage.download_receipt', '下载迁移回执'), () => {
    if (!receipt || phase !== 'staged') return
    receiptDownloaded = false
    receiptConfirmation.checked = false
    try {
      download('sprite-overlay-image-migration-receipt-' + receipt.backupId + '.json', receipt)
      receiptDownloaded = true
      status.textContent = t('storage.receipt_downloaded', '迁移回执已开始下载，确认存好后再点「确认应用成功项」。')
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : t('storage.receipt_failed', '回执下载失败')
    }
    render()
  })
  const applyButton = actionButton(t('storage.apply', '确认应用成功项'), () => {
    if (!receipt || !receiptDownloaded || !receiptConfirmation.checked || phase !== 'staged') return
    const result = applyImageChanges(deps.getSettings(), staged)
    finishApply(result, t('storage.applied_action', '应用'))
  })
  const cancelButton = actionButton(t('storage.cancel', '取消迁移'), () => {
    if (phase !== 'staging') return
    ++runToken
    controller?.abort()
    controller = null
    reset()
    status.textContent = t('storage.cancelled', '已取消迁移，原有设置未改动（刚转存出的本地图片文件会保留在目录中）。')
  })
  const retryButton = actionButton(t('storage.recheck', '重新检查'), () => reset())
  const restorePanel = document.createElement('details')
  restorePanel.className = 'so-storage-restore'
  const restoreHeading = document.createElement('summary')
  restoreHeading.textContent = t('storage.restore_title', '恢复迁移前图片')
  const restoreWarning = document.createElement('p')
  restoreWarning.className = 'so-storage-warning'
  restoreWarning.textContent = t('storage.restore_warning', '恢复会把图片重新塞回设置文件（体积会变大）；只还原仍与回执一致的图片，其他设置和后续改动不受影响。')
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
  const restoreBackup = fileInput(t('storage.backup_file', '迁移前备份'))
  const restoreReceipt = fileInput(t('storage.receipt_file', '迁移回执'))
  const inspectRestoreButton = actionButton(t('storage.inspect_restore', '检查恢复文件'), () => { void inspectRestore() })
  const restoreButton = actionButton(t('storage.restore', '确认恢复图片'), () => {
    if (phase !== 'restore-ready' || !restoreSource || !backupDownloaded || !confirmBackup.checked) return
    const result = restoreMigratedImages(deps.getSettings(), restoreSource.backup, restoreSource.receipt)
    finishApply(result, t('storage.restored_action', '恢复'))
  })
  restorePanel.append(inspectRestoreButton, restoreButton)

  function finishApply(result: ReturnType<typeof applyImageChanges>, action: string): void {
    if (!checkRawImages()) return
    phase = 'applied'
    try {
      if (result.applied.length > 0) deps.updateSettings(result.settings)
      status.textContent = t('storage.finished', '已{{action}} {{count}} 项，冲突 {{conflicts}} 项未修改。{{notice}}', { action, count: result.applied.length, conflicts: result.conflicts.length, notice: result.applied.length ? t('storage.save_requested', '已通知酒馆保存设置，建议刷新页面确认效果。') : t('storage.unchanged', '原设置未改变。') })
    } catch (error) {
      status.textContent = t('storage.update_failed', '设置更新或界面刷新失败，请保留备份和回执，重载后复查：{{error}}', { error: error instanceof Error ? error.message : t('storage.unknown_error', '未知错误') })
    }
    staged = []
    receipt = null
    restoreSource = null
    backup = null
    render()
  }
  const closeButton = actionButton(t('common.close', '关闭'), () => close())
  controls.append(backupButton, confirmLabel, startButton, cancelButton, receiptButton, receiptLabel, applyButton, retryButton)
  const footer = document.createElement('div')
  footer.className = 'so-storage-footer'
  footer.append(closeButton)
  dialog.append(heading, summary, privacy, status, progress, errors, controls, restorePanel, footer)
  backdrop.append(dialog)
  document.body.append(backdrop)
  const focus = manageDialogFocus(dialog, { onEscape: close, layer: backdrop })

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
    status.textContent = t('storage.raw_unmapped', '当前原始设置有未能映射的内嵌图片，操作已停止。请重新下载备份并整理图片后再继续。')
    return false
  }

  function render(): void {
    if (phase === 'closed') return
    summary.textContent = t('storage.summary', '发现 {{refs}} 个内嵌图片引用，{{images}} 张不同图片，约 {{bytes}} 字节文本', { refs: scan.embeddedReferenceCount, images: scan.uniqueEmbeddedCount, bytes: scan.embeddedTextBytes })
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
      status.textContent = t('storage.restore_ready', '可恢复 {{count}} 项，冲突 {{conflicts}} 项。请先下载并确认当前插件状态备份。', { count: result.applied.length, conflicts: result.conflicts.length })
    } catch (error) {
      if (token !== runToken) return
      phase = 'inspect'
      restoreSource = null
      status.textContent = error instanceof Error ? error.message : t('storage.restore_invalid', '恢复文件校验失败')
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
      status.textContent = t('storage.settings_changed', '备份后设置已变化，请重新下载备份并扫描后再迁移。')
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
        status.textContent = t('storage.progress', '校验进度 {{completed}}/{{total}}', { completed, total })
      } })
      if (token !== runToken || runController.signal.aborted || result.cancelled) return
      staged = result.ready
      receipt = staged.length ? createMigrationReceipt(sourceBackup, staged) : null
      phase = staged.length ? 'staged' : 'inspect'
      for (const failure of result.failed) {
        const item = document.createElement('li')
        item.textContent = t('storage.item_error', '{{tag}}：{{message}}', { tag: failure.candidate.ref.tag, message: failure.message })
        errors.append(item)
      }
      status.textContent = t('storage.stage_result', '{{status}}：成功 {{ready}} 项，失败 {{failed}} 项，未处理 {{unprocessed}} 项，未支持 {{unsupported}} 项。原设置未改变。', { status: staged.length ? t('storage.staged', '图片转存就绪') : t('storage.not_migrated', '迁移未完成'), ready: staged.length, failed: result.failed.length, unprocessed: result.unprocessed.length, unsupported: sourceBackup.unmappedEmbedded.length })
    } catch (error) {
      if (token === runToken && !runController.signal.aborted) {
        status.textContent = error instanceof Error ? error.message : t('storage.migration_failed', '迁移失败，原设置未改变')
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
    focus.dispose()
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
    try { deps.onClosed() } finally { focus.restoreFocus() }
  }

  confirmBackup.addEventListener('change', render)
  receiptConfirmation.addEventListener('change', render)
  dialog.addEventListener('keydown', (event) => {
    // Native buttons keep their default activation; ST must not also synthesize a click.
    event.stopPropagation()
  })
  render()
  focus.focusInitial()
  return { close }
}
