/**
 * 内置预设立绘包清单。
 * 图片路径为相对路径，由适配器传入 baseUrl 拼接：
 * - Web 端：baseUrl = ''（Next.js public 目录，即 /presets/...）
 * - ST 端：baseUrl = 扩展静态目录前缀
 */

import type { SpritePack } from './types'

interface PresetDef {
  id: string
  name: string
  description: string
  dir: string
  tags: string[]
}

const PRESET_DEFS: PresetDef[] = [
  {
    id: 'preset_silver_loli',
    name: '银发萝莉',
    description: '内置预设 · 银发双马尾萝莉，8 个常用表情',
    dir: 'silver-loli',
    tags: ['微笑', '害羞', '恼怒', '惊讶', '哭泣', '得意', '无奈', '开心'],
  },
  {
    id: 'preset_raven_onee',
    name: '黑长直御姐',
    description: '内置预设 · 黑长直冷艳御姐，8 个常用表情',
    dir: 'raven-onee',
    tags: ['微笑', '害羞', '恼怒', '惊讶', '哭泣', '得意', '冷淡', '温柔'],
  },
]

/** 获取全部内置预设立绘包 */
export function getPresetPacks(baseUrl = ''): SpritePack[] {
  return PRESET_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    author: '内置预设',
    description: def.description,
    sprites: def.tags.map((tag) => ({
      tag,
      url: `${baseUrl}/presets/${def.dir}/${encodeURIComponent(tag)}.png`,
    })),
  }))
}

/** 判断是否为内置预设包（预设包不可删除，只能停用） */
export function isPresetPack(packId: string): boolean {
  return PRESET_DEFS.some((d) => d.id === packId)
}
