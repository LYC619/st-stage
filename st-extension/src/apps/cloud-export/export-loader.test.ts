import { describe, expect, it } from 'vitest'
import type { CloudExportBridge } from './bridge'
import { loadSelectedExportFiles } from './export-loader'
import type { ExportSelection, ExportSnapshot } from './types'

const catalog: ExportSnapshot = {
  characters: [
    {
      id: 'Alice.png',
      name: 'Alice',
      avatar: 'Alice.png',
      chats: [
        { id: 'Alice.png:first', name: 'first', path: 'first.jsonl' },
        { id: 'Alice.png:second', name: 'second', path: 'second.jsonl' },
      ],
    },
    { id: 'Bob.png', name: 'Bob', avatar: 'Bob.png', chats: [] },
  ],
  worldbooks: [
    { id: 'World.json', name: 'World', fileName: 'World.json' },
    { id: 'Unused.json', name: 'Unused', fileName: 'Unused.json' },
  ],
  presets: [{ id: 'creative.json', name: 'creative', fileName: 'creative.json', content: { temperature: 0.7 } }],
  regex: { rules: [{ find: 'x' }] },
}

function selected(): ExportSelection {
  return {
    characterIds: new Set(['Alice.png']),
    chatIds: new Set(['Alice.png:first']),
    worldbookIds: new Set(['World.json']),
    presetIds: new Set(['creative.json']),
    regex: true,
  }
}

function bridge(overrides: Partial<CloudExportBridge> = {}): CloudExportBridge {
  return {
    listCharacters: async () => catalog.characters,
    listChats: async (character) => character.chats,
    listWorldbooks: async () => catalog.worldbooks,
    loadSettingsAssets: async () => ({ presets: catalog.presets, regex: catalog.regex }),
    readWorldbook: async (worldbook) => ({ entries: { name: worldbook.name } }),
    readCharacterCard: async () => new ArrayBuffer(0),
    readChat: async (_character, chat) => `${chat.name}\n`,
    ...overrides,
  }
}

describe('cloud export selected asset loader', () => {
  it('aborts sibling reads on failure and suppresses late progress even if a reader ignores cancellation', async () => {
    let siblingSignal: AbortSignal | undefined
    let release!: (value: string) => void
    const progress: number[] = []
    const done = loadSelectedExportFiles({ catalog, selection: selected(), concurrency: 2,
      bridge: bridge({
        readCharacterCard: async () => { throw new Error('card failed') },
        readChat: (_character, _chat, signal) => { siblingSignal = signal; return new Promise(resolve => { release = resolve }) },
      }), onProgress: p => progress.push(p.completed),
    }).catch(error => error)
    await new Promise(resolve => setTimeout(resolve, 0))
    const cancelled = siblingSignal?.aborted
    release('{}\n')
    expect(await done).toBeInstanceOf(Error)
    expect(cancelled).toBe(true)
    expect(progress).toEqual([])
  })

  it('rejects a cancelled export without scheduling any reads', async () => {
    const controller = new AbortController(); controller.abort()
    const reads: string[] = []
    await expect(loadSelectedExportFiles({ catalog, selection: selected(), signal: controller.signal,
      bridge: bridge({ readCharacterCard: async () => { reads.push('card'); return new ArrayBuffer(0) } }),
    })).rejects.toMatchObject({ name: 'AbortError' })
    expect(reads).toEqual([])
  })

  it('reads only selected assets and emits standard default-user paths', async () => {
    const read: string[] = []
    const files = await loadSelectedExportFiles({
      bridge: bridge({
        readWorldbook: async (worldbook) => { read.push(`world:${worldbook.name}`); return { entries: {} } },
        readCharacterCard: async (character) => { read.push(`card:${character.name}`); return new ArrayBuffer(0) },
        readChat: async (_character, chat) => { read.push(`chat:${chat.name}`); return '{}\n' },
      }),
      catalog,
      selection: selected(),
    })

    expect(read).toEqual(expect.arrayContaining(['world:World', 'card:Alice', 'chat:first']))
    expect(read).not.toEqual(expect.arrayContaining(['world:Unused', 'card:Bob', 'chat:second']))
    expect(files.map((file) => file.path).sort()).toEqual([
      'settings.json',
      'OpenAI Settings/creative.json',
      'characters/Alice.png',
      'chats/Alice/first.jsonl',
      'worlds/World.json',
    ].sort())
  })

  it('limits simultaneous reads and reports asset progress', async () => {
    let active = 0
    let peak = 0
    const progress: number[] = []
    const wait = async () => {
      active += 1
      peak = Math.max(peak, active)
      await new Promise((resolve) => setTimeout(resolve, 5))
      active -= 1
    }
    const many: ExportSnapshot = {
      ...catalog,
      characters: Array.from({ length: 8 }, (_, index) => ({
        id: `C${index}.png`, name: `C${index}`, avatar: `C${index}.png`, chats: [],
      })),
      worldbooks: [],
      presets: [],
      regex: null,
    }
    const selection: ExportSelection = {
      characterIds: new Set(many.characters.map((item) => item.id)),
      chatIds: new Set(), worldbookIds: new Set(), presetIds: new Set(), regex: false,
    }
    await loadSelectedExportFiles({
      bridge: bridge({ readCharacterCard: async () => { await wait(); return new ArrayBuffer(0) } }),
      catalog: many,
      selection,
      concurrency: 4,
      onProgress: ({ completed }) => progress.push(completed),
    })
    expect(peak).toBe(4)
    expect(progress.at(-1)).toBe(8)
  })

  it('rejects the whole export with an asset-labelled error', async () => {
    await expect(loadSelectedExportFiles({
      bridge: bridge({ readWorldbook: async () => { throw new Error('offline') } }),
      catalog,
      selection: selected(),
    })).rejects.toThrow('世界书 World')
  })
})
