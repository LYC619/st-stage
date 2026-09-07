import { archiveSegment } from './archive-path'
import type { ExportFile, ExportSelection, ExportSnapshot } from './types'

function characterArchiveIdentity(avatar: string): { avatar: string; stem: string } {
  const name = archiveSegment(avatar, '角色头像')
  if (!/\.png$/i.test(name)) throw new Error('无法确定角色聊天目录：头像文件必须为 PNG')
  return { avatar: name, stem: archiveSegment(name.slice(0, -4), '角色目录') }
}

/**
 * 只写用户真正选中的设置分区。
 *
 * 空数组不是「没选」，导入端会把它当成「选中的值是空」。若无选中正则就写
 * `regex: []`，把包解压回 data/default-user/ 会清空用户的全局正则；世界书
 * globalSelect 同理。因此没有对应选择时整个键都不出现，返回 null 表示这次
 * 导出不需要 settings.json。
 */
export function buildMinimalSettings(snapshot: ExportSnapshot, selection: ExportSelection): string | null {
  const selectedWorldNames = snapshot.worldbooks
    .filter((worldbook) => selection.worldbookIds.has(worldbook.id))
    .map((worldbook) => worldbook.name)
  const regex = selection.regex ? snapshot.regex?.rules ?? [] : []
  const settings: Record<string, unknown> = {}
  if (regex.length > 0) settings.extension_settings = { regex }
  if (selectedWorldNames.length > 0) {
    settings.world_info_settings = { world_info: { globalSelect: selectedWorldNames } }
  }
  return Object.keys(settings).length > 0 ? JSON.stringify(settings, null, 2) : null
}

export function buildExportFiles(snapshot: ExportSnapshot, selection: ExportSelection): ExportFile[] {
  const files: ExportFile[] = []
  const hasSelection = selection.characterIds.size > 0
    || selection.chatIds.size > 0
    || selection.worldbookIds.size > 0
    || selection.presetIds.size > 0
    || selection.regex
  if (!hasSelection) return files
  const settings = buildMinimalSettings(snapshot, selection)
  if (settings !== null) files.push({ path: 'settings.json', data: settings })
  for (const worldbook of snapshot.worldbooks) {
    if (selection.worldbookIds.has(worldbook.id)) {
      if (worldbook.content !== undefined) {
        files.push({ path: `worlds/${archiveSegment(worldbook.fileName, '世界书')}`, data: JSON.stringify(worldbook.content, null, 2), updatedAt: worldbook.updatedAt })
      }
    }
  }
  for (const preset of snapshot.presets) {
    if (selection.presetIds.has(preset.id)) {
      files.push({ path: `OpenAI Settings/${archiveSegment(preset.fileName, '预设')}`, data: JSON.stringify(preset.content, null, 2), updatedAt: preset.updatedAt })
    }
  }
  return files
}

export function buildCharacterFiles(
  character: ExportSnapshot['characters'][number],
  cardData: ExportFile['data'] | undefined,
  chats: Map<string, string>,
  selection: ExportSelection,
): ExportFile[] {
  const files: ExportFile[] = []
  const selectedChats = character.chats.filter(chat => selection.chatIds.has(chat.id) && chats.has(chat.id))
  const selectedCard = selection.characterIds.has(character.id) && cardData !== undefined
  if (!selectedCard && selectedChats.length === 0) return files
  const identity = characterArchiveIdentity(character.avatar)
  if (selection.characterIds.has(character.id) && cardData !== undefined) {
    files.push({
      path: `characters/${identity.avatar}`,
      data: cardData,
      updatedAt: character.updatedAt,
    })
  }
  for (const chat of selectedChats) {
    const data = chats.get(chat.id)
    if (!selection.chatIds.has(chat.id) || data === undefined) continue
    files.push({
      path: `chats/${identity.stem}/${archiveSegment((chat.path || chat.name).replace(/\.jsonl$/i, ''), '聊天')}.jsonl`,
      data,
      updatedAt: chat.updatedAt,
    })
  }
  return files
}
