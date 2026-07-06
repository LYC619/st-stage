'use client'

/**
 * 配置面板：全局开关、角色绑定、立绘包管理（新建/上传/删除）、导入导出。
 */

import { useRef, useState } from 'react'
import type { PluginSettings, SpritePack } from '@/core/types'
import { bindCharacter, genId, removePack, toggleBinding, upsertPack } from '@/core/sprite-store'
import { isPresetPack } from '@/core/presets'
import { exportPack, importPack } from '@/core/pack-io'

interface ConfigPanelProps {
  settings: PluginSettings
  characterName: string
  onCharacterNameChange: (name: string) => void
  onSettingsChange: (settings: PluginSettings) => void
}

export function ConfigPanel({ settings, characterName, onCharacterNameChange, onSettingsChange }: ConfigPanelProps) {
  const [newPackName, setNewPackName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [uploadTargetPack, setUploadTargetPack] = useState<string | null>(null)

  const binding = settings.bindings.find((b) => b.characterName === characterName)
  const boundPack = binding ? settings.packs.find((p) => p.id === binding.packId) : null

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 2500)
  }

  /** 上传图片到指定包：文件名（去扩展名）即标签 */
  const handleUpload = async (files: FileList | null) => {
    if (!files || !uploadTargetPack) return
    const pack = settings.packs.find((p) => p.id === uploadTargetPack)
    if (!pack) return
    const newSprites = [...pack.sprites]
    for (const file of Array.from(files)) {
      const tag = file.name.replace(/\.[^.]+$/, '').trim()
      if (!tag) continue
      const dataUri = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(reader.error)
        reader.readAsDataURL(file)
      })
      const idx = newSprites.findIndex((s) => s.tag === tag)
      if (idx >= 0) newSprites[idx] = { tag, url: dataUri }
      else newSprites.push({ tag, url: dataUri })
    }
    onSettingsChange(upsertPack(settings, { ...pack, sprites: newSprites }))
    flash(`已添加 ${files.length} 张立绘到「${pack.name}」`)
  }

  const handleCreatePack = () => {
    const name = newPackName.trim()
    if (!name) return
    const pack: SpritePack = { id: genId(), name, author: '我', sprites: [] }
    onSettingsChange(upsertPack(settings, pack))
    setNewPackName('')
    flash(`已创建立绘包「${name}」，请上传图片（文件名即标签）`)
  }

  const handleExport = async (pack: SpritePack, embed: boolean) => {
    const file = await exportPack(pack, embed)
    const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${pack.name}.sprite-pack.json`
    a.click()
    URL.revokeObjectURL(url)
    flash(`已导出「${pack.name}」`)
  }

  const handleImport = async (files: FileList | null) => {
    if (!files || files.length === 0) return
    try {
      const text = await files[0].text()
      const pack = importPack(text)
      onSettingsChange(upsertPack(settings, pack))
      flash(`已导入立绘包「${pack.name}」（${pack.sprites.length} 张）`)
    } catch (err) {
      flash(err instanceof Error ? err.message : '导入失败')
    }
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">插件配置</h2>

      {/* 全局开关 */}
      <section className="flex flex-col gap-2.5">
        <label className="flex items-center justify-between text-sm text-foreground">
          启用立绘悬浮窗
          <input
            type="checkbox"
            checked={settings.enabled}
            onChange={(e) => onSettingsChange({ ...settings, enabled: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-foreground">
          消息中隐藏 [立绘:xxx] 标签
          <input
            type="checkbox"
            checked={settings.hideTagInMessage}
            onChange={(e) => onSettingsChange({ ...settings, hideTagInMessage: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>
      </section>

      {/* 当前角色与绑定 */}
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">当前角色</h3>
        <input
          type="text"
          value={characterName}
          onChange={(e) => onCharacterNameChange(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-label="当前角色名"
        />
        <div className="flex items-center gap-2">
          <select
            value={binding?.packId ?? ''}
            onChange={(e) => {
              if (e.target.value) onSettingsChange(bindCharacter(settings, characterName, e.target.value))
            }}
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="绑定立绘包"
          >
            <option value="">选择立绘包…</option>
            {settings.packs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.sprites.length} 张）
              </option>
            ))}
          </select>
          {binding && (
            <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={binding.enabled}
                onChange={(e) => onSettingsChange(toggleBinding(settings, characterName, e.target.checked))}
                className="h-4 w-4 accent-primary"
              />
              启用
            </label>
          )}
        </div>
        {boundPack && (
          <p className="text-xs text-muted-foreground">
            已绑定「{boundPack.name}」：{boundPack.sprites.map((s) => s.tag).join('、')}
          </p>
        )}
      </section>

      {/* 立绘包管理 */}
      <section className="flex flex-col gap-2.5 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">立绘包管理</h3>
        <ul className="flex flex-col gap-2">
          {settings.packs.map((pack) => (
            <li key={pack.id} className="rounded-lg border border-border p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{pack.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {pack.sprites.length} 张 · {pack.author ?? '未知作者'}
                  </p>
                </div>
                <div className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setUploadTargetPack(pack.id)
                      uploadRef.current?.click()
                    }}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    上传
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExport(pack, !isPresetPack(pack.id))}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    导出
                  </button>
                  {!isPresetPack(pack.id) && (
                    <button
                      type="button"
                      onClick={() => onSettingsChange(removePack(settings, pack.id))}
                      className="rounded-md border border-destructive/40 px-2 py-1 text-xs text-destructive transition-colors hover:bg-destructive/10"
                    >
                      删除
                    </button>
                  )}
                </div>
              </div>
              {/* 缩略图预览 */}
              {pack.sprites.length > 0 && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto pb-1">
                  {pack.sprites.map((s) => (
                    <figure key={s.tag} className="shrink-0 text-center">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={s.url || '/placeholder.svg'}
                        alt={`${pack.name} - ${s.tag}`}
                        className="h-14 w-14 rounded-md border border-border object-cover"
                        loading="lazy"
                      />
                      <figcaption className="mt-0.5 max-w-14 truncate text-[10px] text-muted-foreground">{s.tag}</figcaption>
                    </figure>
                  ))}
                </div>
              )}
            </li>
          ))}
        </ul>

        {/* 新建包 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={newPackName}
            onChange={(e) => setNewPackName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleCreatePack()
            }}
            placeholder="新立绘包名称…"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            aria-label="新立绘包名称"
          />
          <button
            type="button"
            onClick={handleCreatePack}
            className="shrink-0 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-90"
          >
            新建
          </button>
        </div>

        {/* 导入 */}
        <button
          type="button"
          onClick={() => importRef.current?.click()}
          className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:border-primary hover:text-foreground"
        >
          导入立绘包（.sprite-pack.json）
        </button>
      </section>

      {status && (
        <p className="rounded-lg bg-secondary px-3 py-2 text-xs text-secondary-foreground" role="status">
          {status}
        </p>
      )}

      {/* 隐藏文件输入 */}
      <input
        ref={uploadRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          handleUpload(e.target.files)
          e.target.value = ''
        }}
      />
      <input
        ref={importRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={(e) => {
          handleImport(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
