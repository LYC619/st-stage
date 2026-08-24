import type { ExportFile, ExportSelection, ExportSnapshot } from './types'

function safeSegment(value: string, fallback: string): string {
  const clean = value
    .replace(/[\\/\0]/g, '_')
    .replace(/^(?:\.+)$/g, '_')
    .trim()
  return (clean || fallback).slice(0, 180)
}

export function buildMinimalSettings(snapshot: ExportSnapshot, selection: ExportSelection): string {
  const selectedWorldNames = snapshot.worldbooks
    .filter((worldbook) => selection.worldbookIds.has(worldbook.id))
    .map((worldbook) => worldbook.name)
  const regex = selection.regex ? snapshot.regex?.rules ?? [] : []
  return JSON.stringify({
    extensions: { regex },
    world_info_settings: {
      world_info: { globalSelect: selectedWorldNames },
    },
  }, null, 2)
}

export function buildExportFiles(snapshot: ExportSnapshot, selection: ExportSelection): ExportFile[] {
  const files: ExportFile[] = []
  const hasSelection = selection.characterIds.size > 0
    || selection.chatIds.size > 0
    || selection.worldbookIds.size > 0
    || selection.presetIds.size > 0
    || selection.regex
  if (!hasSelection) return files
  files.push({ path: 'settings.json', data: buildMinimalSettings(snapshot, selection) })
  for (const worldbook of snapshot.worldbooks) {
    if (selection.worldbookIds.has(worldbook.id)) {
      files.push({ path: `worlds/${safeSegment(worldbook.fileName, 'world.json')}`, data: JSON.stringify(worldbook.content, null, 2), updatedAt: worldbook.updatedAt })
    }
  }
  for (const preset of snapshot.presets) {
    if (selection.presetIds.has(preset.id)) {
      files.push({ path: `OpenAI Settings/${safeSegment(preset.fileName, 'preset.json')}`, data: JSON.stringify(preset.content, null, 2), updatedAt: preset.updatedAt })
    }
  }
  return files
}

export function buildCharacterFiles(
  character: ExportSnapshot['characters'][number],
  cardData: ExportFile['data'],
  chats: Map<string, string>,
  selection: ExportSelection,
): ExportFile[] {
  if (!selection.characterIds.has(character.id)) return []
  const files: ExportFile[] = [{
    path: `characters/${safeSegment(character.avatar, 'character.png')}`,
    data: cardData,
    updatedAt: character.updatedAt,
  }]
  for (const chat of character.chats) {
    const data = chats.get(chat.id)
    if (!selection.chatIds.has(chat.id) || data === undefined) continue
    files.push({
      path: `chats/${safeSegment(character.name, 'character')}/${safeSegment(chat.name, 'chat')}.jsonl`,
      data,
      updatedAt: chat.updatedAt,
    })
  }
  return files
}
