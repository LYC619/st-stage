/**
 * 内置预设立绘包清单（v2 格式，source='local'）。
 * ref 为相对扩展目录的路径，由 resolveSpriteUrl 按适配器 baseUrl 拼接：
 * - Web 端：baseUrl = ''（Next.js public 目录，即 /presets/...）
 * - ST 端：baseUrl = 扩展静态目录前缀 + '/public'
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

/**
 * 获取全部内置预设立绘包（v2）。
 * 条目 id 使用稳定值（包 id + 标签），避免每次加载生成新 id 导致设置漂移。
 */
export function getPresetPacks(_baseUrl = ''): SpritePack[] {
  return PRESET_DEFS.map((def) => ({
    id: def.id,
    name: def.name,
    version: 2 as const,
    author: '内置预设',
    description: def.description,
    sprites: def.tags.map((tag) => ({
      id: `${def.id}_${tag}`,
      label: tag,
      tags: [tag],
      source: 'local' as const,
      ref: `presets/${def.dir}/${tag}.png`,
    })),
  }))
}

/** 判断是否为内置预设包（预设包不可删除，只能停用） */
export function isPresetPack(packId: string): boolean {
  return PRESET_DEFS.some((d) => d.id === packId)
}
