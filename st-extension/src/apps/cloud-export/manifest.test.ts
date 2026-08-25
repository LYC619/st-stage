import { describe, expect, it } from 'vitest'
import { buildCharacterFiles, buildExportFiles, buildMinimalSettings } from './manifest'
import type { ExportSelection, ExportSnapshot } from './types'

const snapshot: ExportSnapshot = {
  characters: [{
    id: 'Alice.png',
    name: 'Alice/测试',
    avatar: 'Alice.png',
    chats: [{ id: 'chat-1', name: 'First/Chat', path: 'first.jsonl' }],
  }],
  worldbooks: [{ id: 'world.json', name: '世界', fileName: 'world.json', content: { entries: {} } }],
  presets: [{ id: 'preset.json', name: '预设', fileName: 'preset.json', content: { temperature: 1 } }],
  regex: { rules: [{ find: 'a' }] },
}

function selection(partial: Partial<ExportSelection> = {}): ExportSelection {
  return {
    characterIds: new Set(),
    chatIds: new Set(),
    worldbookIds: new Set(),
    presetIds: new Set(),
    regex: false,
    ...partial,
  }
}

describe('cloud export manifest', () => {
  it('does not produce an empty settings-only package', () => {
    expect(buildExportFiles(snapshot, selection())).toEqual([])
  })

  it('uses default-user paths and a minimal settings file', () => {
    const files = buildExportFiles(snapshot, selection({ worldbookIds: new Set(['world.json']), regex: true }))
    expect(files.map((file) => file.path)).toEqual(['settings.json', 'worlds/world.json'])
    const settings = JSON.parse(String(files[0].data))
    expect(settings.extension_settings.regex).toHaveLength(1)
    expect(settings.extensions).toBeUndefined()
    expect(settings.world_info_settings.world_info.globalSelect).toEqual(['世界'])
    expect(JSON.stringify(settings)).not.toContain('secret')
  })

  it('serializes presets under OpenAI Settings', () => {
    const files = buildExportFiles(snapshot, selection({ presetIds: new Set(['preset.json']) }))
    expect(files.map((file) => file.path)).toEqual(['settings.json', 'OpenAI Settings/preset.json'])
    expect(JSON.parse(String(files[1].data))).toEqual({ temperature: 1 })
  })

  it('includes selected character cards and chats under safe default-user paths', () => {
    const files = buildCharacterFiles(
      snapshot.characters[0],
      new Uint8Array([1, 2, 3]),
      new Map([['chat-1', '{"mes":"hello"}\n']]),
      selection({ characterIds: new Set(['Alice.png']), chatIds: new Set(['chat-1']) }),
    )
    expect(files.map((file) => file.path)).toEqual([
      'characters/Alice.png',
      'chats/Alice_测试/First_Chat.jsonl',
    ])
  })

  it('can build settings independently for the selected regex set', () => {
    const settings = JSON.parse(buildMinimalSettings(snapshot, selection({ regex: true })))
    expect(settings.extension_settings.regex).toEqual([{ find: 'a' }])
  })
})
