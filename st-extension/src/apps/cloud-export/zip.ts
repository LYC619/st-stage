import JSZip from 'jszip'
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
}

export async function downloadSTBackup(
  files: ExportFile[],
  filename: string,
  onProgress: (progress: ZipProgress) => void,
  schedulers: DownloadSchedulers = {},
): Promise<void> {
  if (!files.length) throw new Error('没有选择任何可导出的资产')
  const zip = new JSZip()
  for (const file of files) {
    zip.file(file.path, file.data, file.updatedAt ? { date: new Date(file.updatedAt) } : undefined)
  }
  const blob = await zip.generateAsync(
    { type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } },
    (metadata) => onProgress({ percent: metadata.percent }),
  )
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
