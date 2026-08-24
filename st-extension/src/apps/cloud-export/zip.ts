import JSZip from 'jszip'
import type { ExportFile } from './types'

export interface ZipProgress {
  percent: number
  currentFile?: string
}

export async function downloadSTBackup(
  files: ExportFile[],
  filename: string,
  onProgress: (progress: ZipProgress) => void,
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
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = filename.endsWith('.zip') ? filename : `${filename}.zip`
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}
