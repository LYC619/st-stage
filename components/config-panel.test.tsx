// @vitest-environment jsdom

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createDefaultSettings, type PluginSettings } from '@/core/types'
import { ConfigPanel } from './config-panel'

interface DeferredCompression {
  file: File
  resolve: (value: { dataUri: string; transparency: 'transparent' }) => void
}

const compressionQueue = vi.hoisted(() => ({
  pending: [] as DeferredCompression[],
}))

vi.mock('@/core/image-compress', () => ({
  compressImage: vi.fn((file: File) =>
    new Promise<{ dataUri: string; transparency: 'transparent' }>((resolve) => {
      compressionQueue.pending.push({ file, resolve })
    }),
  ),
  recompressDataUri: vi.fn(async (x: string) => x),
}))

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  compressionQueue.pending.length = 0
})

afterEach(() => {
  compressionQueue.pending.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function mountConfigPanel(initial: PluginSettings) {
  let current = initial
  const saved: PluginSettings[] = []
  const mount = document.createElement('div')
  document.body.append(mount)
  const root = createRoot(mount)

  const render = (next: PluginSettings) => {
    current = next
    root.render(
      <ConfigPanel
        settings={next}
        characterName="Review"
        onCharacterNameChange={() => {}}
        onSettingsChange={(value) => {
          current = value
          saved.push(value)
        }}
      />,
    )
  }

  return {
    mount,
    saved,
    getCurrent: () => current,
    render,
    unmount: async () => {
      await act(async () => root.unmount())
      mount.remove()
    },
  }
}

async function startUploadForPack(mount: HTMLElement, packIndex: number, files: File[]) {
  const uploadButtons = [...mount.querySelectorAll('button')].filter((b) => b.textContent === '上传')
  await act(async () => {
    uploadButtons[packIndex]!.click()
  })
  const input = mount.querySelector<HTMLInputElement>('input[type="file"][accept="image/*"]')!
  Object.defineProperty(input, 'files', { value: files, configurable: true })
  await act(async () => {
    input.dispatchEvent(new Event('change', { bubbles: true }))
  })
}

describe('ConfigPanel async upload state safety (STAGE-002)', () => {
  it('preserves intervening settings and newly added packs while image compression is pending', async () => {
    const initial = createDefaultSettings()
    initial.autoUpload = false
    initial.showPhone = true
    initial.packs = [{ id: 'audit-pack', name: 'Synthetic pack', sprites: [] }]

    const h = mountConfigPanel(initial)
    try {
      await act(async () => h.render(initial))
      await startUploadForPack(h.mount, 0, [new File(['synthetic'], 'smile.png', { type: 'image/png' })])
      expect(compressionQueue.pending).toHaveLength(1)

      const edited: PluginSettings = {
        ...initial,
        showPhone: false,
        packs: [...initial.packs, { id: 'new-pack', name: 'Created while upload running', sprites: [] }],
      }
      await act(async () => h.render(edited))

      await act(async () => {
        compressionQueue.pending[0]!.resolve({
          dataUri: 'data:image/webp;base64,AAAA',
          transparency: 'transparent',
        })
      })

      const latest = h.saved.at(-1)!
      expect(latest.showPhone).toBe(false)
      expect(latest.packs.map((p) => p.id)).toEqual(['audit-pack', 'new-pack'])
      expect(latest.packs[0]!.sprites).toEqual([{ tag: 'smile', url: 'data:image/webp;base64,AAAA' }])
    } finally {
      await h.unmount()
    }
  })

  it('merges concurrent uploads into the same pack without overwriting earlier results', async () => {
    const initial = createDefaultSettings()
    initial.autoUpload = false
    initial.packs = [{ id: 'audit-pack', name: 'Synthetic pack', sprites: [] }]

    const h = mountConfigPanel(initial)
    try {
      await act(async () => h.render(initial))
      await startUploadForPack(h.mount, 0, [new File(['one'], 'smile.png', { type: 'image/png' })])
      await startUploadForPack(h.mount, 0, [new File(['two'], 'angry.png', { type: 'image/png' })])
      expect(compressionQueue.pending).toHaveLength(2)

      await act(async () => {
        compressionQueue.pending[0]!.resolve({
          dataUri: 'data:image/webp;base64,AAAA',
          transparency: 'transparent',
        })
        compressionQueue.pending[1]!.resolve({
          dataUri: 'data:image/webp;base64,BBBB',
          transparency: 'transparent',
        })
      })

      const latest = h.saved.at(-1)!
      expect(latest.packs[0]!.sprites.map((s) => ({ tag: s.tag, url: s.url }))).toEqual([
        { tag: 'smile', url: 'data:image/webp;base64,AAAA' },
        { tag: 'angry', url: 'data:image/webp;base64,BBBB' },
      ])
    } finally {
      await h.unmount()
    }
  })

  it('does not resurrect a deleted target pack or clobber a concurrently modified same-tag sprite', async () => {
    const initial = createDefaultSettings()
    initial.autoUpload = false
    initial.showPhone = true
    initial.packs = [
      { id: 'audit-pack', name: 'Synthetic pack', sprites: [] },
      { id: 'keep-pack', name: 'Keep pack', sprites: [] },
    ]

    const h = mountConfigPanel(initial)
    try {
      await act(async () => h.render(initial))
      await startUploadForPack(h.mount, 0, [new File(['one'], 'smile.png', { type: 'image/png' })])
      expect(compressionQueue.pending).toHaveLength(1)

      // 期间删除了目标包并修改了设置
      const afterDelete: PluginSettings = {
        ...initial,
        showPhone: false,
        packs: [{ id: 'keep-pack', name: 'Keep pack', sprites: [] }],
      }
      await act(async () => h.render(afterDelete))
      await act(async () => {
        compressionQueue.pending[0]!.resolve({
          dataUri: 'data:image/webp;base64,AAAA',
          transparency: 'transparent',
        })
      })

      expect(h.saved).toHaveLength(0)
      expect(h.mount.querySelector('[role="status"]')?.textContent).toContain('已被删除')

      // 再次在 keep-pack 上发起上传，期间同名立绘已被外部修改，不应被旧上传覆盖
      compressionQueue.pending.length = 0
      await startUploadForPack(h.mount, 0, [new File(['two'], 'wave.png', { type: 'image/png' })])
      const externallyModified: PluginSettings = {
        ...afterDelete,
        packs: [
          {
            id: 'keep-pack',
            name: 'Keep pack',
            sprites: [{ tag: 'wave', url: 'data:image/webp;base64,NEWER' }],
          },
        ],
      }
      await act(async () => h.render(externallyModified))
      await act(async () => {
        compressionQueue.pending[0]!.resolve({
          dataUri: 'data:image/webp;base64,STALE',
          transparency: 'transparent',
        })
      })

      expect(h.saved).toHaveLength(0)
      expect(h.mount.querySelector('[role="status"]')?.textContent).toContain('冲突')
    } finally {
      await h.unmount()
    }
  })
})
