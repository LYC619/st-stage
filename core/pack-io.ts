/**
 * 立绘包导入导出（sprite-pack@1 JSON 格式）。
 * 导出可选「内嵌 base64」（离线分享）或「仅 URL」（轻量分享，依赖图床）。
 */

import type { SpritePack, SpritePackFile } from './types'
import { genId } from './sprite-store'

/** 将 SpritePack 序列化为导出文件对象。embedBase64 时会尝试把 URL 图片转 base64（需 fetch 可用）。 */
export async function exportPack(pack: SpritePack, embedBase64 = false): Promise<SpritePackFile> {
  const sprites: SpritePackFile['sprites'] = []
  for (const sprite of pack.sprites) {
    if (sprite.url.startsWith('data:')) {
      sprites.push({ tag: sprite.tag, data: sprite.url })
    } else if (embedBase64) {
      try {
        const data = await urlToDataUri(sprite.url)
        sprites.push({ tag: sprite.tag, data })
      } catch {
        // 转换失败则回退为 URL
        sprites.push({ tag: sprite.tag, url: sprite.url })
      }
    } else {
      sprites.push({ tag: sprite.tag, url: sprite.url })
    }
  }
  return {
    format: 'sprite-pack@1',
    name: pack.name,
    author: pack.author,
    description: pack.description,
    sprites,
  }
}

/** 解析导入的 JSON 文本为 SpritePack。格式非法时抛出带说明的 Error。 */
export function importPack(jsonText: string): SpritePack {
  let raw: unknown
  try {
    raw = JSON.parse(jsonText)
  } catch {
    throw new Error('导入失败：不是合法的 JSON 文件')
  }
  const file = raw as Partial<SpritePackFile>
  if (file.format !== 'sprite-pack@1') {
    throw new Error('导入失败：不是 sprite-pack@1 格式的立绘包')
  }
  if (!file.name || !Array.isArray(file.sprites) || file.sprites.length === 0) {
    throw new Error('导入失败：立绘包缺少名称或立绘列表为空')
  }
  const sprites = file.sprites
    .filter((s) => s && typeof s.tag === 'string' && (s.url || s.data))
    .map((s) => ({ tag: s.tag.trim(), url: (s.data ?? s.url) as string }))
  if (sprites.length === 0) {
    throw new Error('导入失败：没有可用的立绘条目')
  }
  return {
    id: genId(),
    name: file.name,
    author: file.author,
    description: file.description,
    sprites,
  }
}

/** 把远程/本地 URL 图片转为 data URI */
async function urlToDataUri(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`fetch ${url} failed: ${res.status}`)
  const blob = await res.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}
