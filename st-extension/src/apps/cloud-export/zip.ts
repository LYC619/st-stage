import type JSZip from 'jszip'
import { t } from '../../../../core/i18n'
import { isArchiveSegment } from './archive-path'
import type { ExportFile } from './types'

export interface ZipProgress {
  percent: number
  currentFile?: string
}

/**
 * 浏览器接手 blob 下载是异步的：点击后立刻 revokeObjectURL 会让大包下载中断。
 * 因此延后回收，给下载留出接手时间；页面关闭时浏览器会自行释放。
 */
export const REVOKE_DELAY_MS = 60_000

/** 仅供测试注入，避免为了验证「不同步回收」去伪造全局定时器（会卡死 JSZip 的异步分块）。 */
export interface DownloadSchedulers {
  scheduleRevoke?: (revoke: () => void, delayMs: number) => void
  signal?: AbortSignal
}

/** Module fetching cannot be aborted, but a cancelled export must stop waiting for it. */
async function loadJSZip(signal?: AbortSignal) {
  signal?.throwIfAborted()
  const loading = import('jszip')
  if (!signal) return loading
  let onAbort!: () => void
  const cancelled = new Promise<never>((_, reject) => {
    onAbort = () => reject(signal.reason)
    signal.addEventListener('abort', onAbort, { once: true })
  })
  try { return await Promise.race([loading, cancelled]) }
  finally { signal.removeEventListener('abort', onAbort) }
}

/** 使用可暂停的公共流接口，取消时释放已收集的字节并停止压缩后续块。 */
function compress(zip: JSZip, onProgress: (progress: ZipProgress) => void, signal?: AbortSignal): Promise<Blob> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const stream = zip.generateInternalStream({ type: 'uint8array', compression: 'DEFLATE', compressionOptions: { level: 6 } })
    let chunks: Uint8Array[] = []
    let settled = false
    const cleanup = () => { signal?.removeEventListener('abort', onAbort); chunks = [] }
    const fail = (error: unknown) => {
      if (settled) return
      settled = true; stream.pause(); cleanup(); reject(error)
    }
    const onAbort = () => fail(signal?.reason)
    signal?.addEventListener('abort', onAbort, { once: true })
    stream.on('data', (chunk, metadata) => {
      if (settled) return
      chunks.push(chunk)
      try { onProgress({ percent: metadata.percent, currentFile: metadata.currentFile ?? undefined }) }
      catch (error) { fail(error) }
    }).on('error', fail).on('end', () => {
      if (settled) return
      settled = true
      try { resolve(new Blob(chunks, { type: 'application/zip' })) }
      catch (error) { reject(error) }
      cleanup()
    }).resume()
  })
}

/** 在 JSZip 可以覆盖条目前预检全部路径，不自动重命名资源。 */
export function assertUniqueArchivePaths(files: Pick<ExportFile, 'path'>[]): void {
  const seen = new Map<string, string>()
  for (const { path } of files) {
    if (!path.split('/').every(isArchiveSegment)) throw new Error(t('cloudExport.invalid_path', '备份路径不合法：{{path}}', { path }))
    const canonical = path.normalize('NFC').toLowerCase()
    if (seen.has(canonical)) throw new Error(t('cloudExport.path_collision', '备份路径冲突：{{first}} 与 {{second}}', { first: seen.get(canonical)!, second: path }))
    seen.set(canonical, path)
  }
  for (const [canonical, path] of seen) {
    const parts = canonical.split('/')
    for (let length = 1; length < parts.length; length += 1) {
      const parent = parts.slice(0, length).join('/')
      if (seen.has(parent)) throw new Error(t('cloudExport.path_collision', '备份路径冲突：{{first}} 与 {{second}}', { first: seen.get(parent)!, second: path }))
    }
  }
}

export async function downloadSTBackup(
  files: ExportFile[],
  filename: string,
  onProgress: (progress: ZipProgress) => void,
  schedulers: DownloadSchedulers = {},
): Promise<void> {
  schedulers.signal?.throwIfAborted()
  if (!files.length) throw new Error(t('cloudExport.no_assets', '没有选择任何可导出的资产'))
  assertUniqueArchivePaths(files)
  const { default: JSZip } = await loadJSZip(schedulers.signal)
  schedulers.signal?.throwIfAborted()
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.path, file.data, file.updatedAt ? { date: new Date(file.updatedAt) } : undefined)
  }
  const blob = await compress(zip, onProgress, schedulers.signal)
  schedulers.signal?.throwIfAborted()
  const scheduleRevoke = schedulers.scheduleRevoke
    ?? ((revoke, delayMs) => { setTimeout(revoke, delayMs) })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.zip') ? filename : `${filename}.zip`
  anchor.style.display = 'none'
  document.body.append(anchor)
  try {
    anchor.click()
  } finally {
    anchor.remove()
    scheduleRevoke(() => URL.revokeObjectURL(url), REVOKE_DELAY_MS)
  }
}
