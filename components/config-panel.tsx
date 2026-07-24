'use client'

/**
 * 配置面板：全局开关、角色绑定、立绘包管理（新建/上传/删除）、导入导出。
 */

import { useRef, useState } from 'react'
import type { PluginSettings, SpritePack } from '@/core/types'
import { DEFAULT_IMAGE_HOST } from '@/core/types'
import {
  bindPack,
  genId,
  getActivePacks,
  removePack,
  toggleBinding,
  unbindPack,
  upsertPack,
  upsertSprite,
} from '@/core/sprite-store'
import { isPresetPack } from '@/core/presets'
import { exportPack, importPack } from '@/core/pack-io'
import { decodeShareString, encodeShareStringV2 } from '@/core/share-code'
import { normalizeTag, parseSpriteFileName, sanitizePackName } from '@/core/naming'
import { compressImage } from '@/core/image-compress'
import { uploadToImgbb } from '@/core/imgbb'

interface ConfigPanelProps {
  settings: PluginSettings
  characterName: string
  onCharacterNameChange: (name: string) => void
  onSettingsChange: (settings: PluginSettings) => void
}

export function ConfigPanel({ settings, characterName, onCharacterNameChange, onSettingsChange }: ConfigPanelProps) {
  const [newPackName, setNewPackName] = useState('')
  const [uploadGroup, setUploadGroup] = useState('')
  const [showKey, setShowKey] = useState(false)
  const [status, setStatus] = useState<string | null>(null)
  const uploadRef = useRef<HTMLInputElement>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [uploadTargetPack, setUploadTargetPack] = useState<string | null>(null)

  const binding = settings.bindings.find((b) => b.characterName === characterName)
  const boundIds = binding?.packIds ?? []
  const activePacks = getActivePacks(settings, characterName)

  const flash = (msg: string) => {
    setStatus(msg)
    setTimeout(() => setStatus(null), 2500)
  }

  /**
   * 上传图片到指定包（三级寻址）：文件名按 parseSpriteFileName 拆「人名/服装/图名」，
   * 未拆出人名时用「本批分组」兜底；压缩后先写本地 data URI 保底，开了自动上传再传 imgbb，
   * 成功仅补 remoteUrl+code（保留本地 url 显示），失败仅计数、本地图不动。
   */
  const handleUpload = async (files: FileList | null) => {
    if (!files || !uploadTargetPack) return
    const pack = settings.packs.find((p) => p.id === uploadTargetPack)
    if (!pack) return
    const useImgbb = settings.autoUpload && settings.imgbbApiKey.trim() !== ''
    const fallbackGroup = normalizeTag(uploadGroup)
    let target = pack
    let added = 0
    let hosted = 0
    let hostFailed = 0
    for (const file of Array.from(files)) {
      const parsed = parseSpriteFileName(file.name)
      const tag = parsed.tag
      if (!tag) continue
      const group = parsed.role || fallbackGroup
      const { dataUri } = await compressImage(file)
      // 本地 data URI 先保底；三级身份 group+outfit+tag 唯一
      const local = {
        tag,
        url: dataUri,
        ...(group ? { group } : {}),
        ...(parsed.outfit ? { outfit: parsed.outfit } : {}),
      }
      target = upsertSprite(target, local)
      added++
      if (useImgbb) {
        try {
          const up = await uploadToImgbb(settings.imgbbApiKey, dataUri)
          // 保留本地 url 显示与保底，仅补远程 remoteUrl + code（不覆盖本地图）
          target = upsertSprite(target, { ...local, code: up.code, remoteUrl: up.url })
          hosted++
        } catch {
          hostFailed++
        }
      }
    }
    onSettingsChange(upsertPack(settings, target))
    const hostNote = useImgbb
      ? `，imgbb 成功 ${hosted} 张${hostFailed > 0 ? `、失败 ${hostFailed} 张（保留本地）` : ''}`
      : ''
    flash(`已添加 ${added} 张立绘到「${pack.name}」（自动压缩为 WebP）${hostNote}`)
  }

  const handleCreatePack = () => {
    const name = sanitizePackName(newPackName)
    if (!name) return
    const pack: SpritePack = { id: genId(), name, author: '我', sprites: [] }
    onSettingsChange(upsertPack(settings, pack))
    setNewPackName('')
    flash(`已创建立绘包「${name}」，请上传图片（文件名即标签）`)
  }

  const handleExport = async (pack: SpritePack) => {
    // 本地/预设图片自动内嵌 base64；图床 URL 保持轻量
    const file = await exportPack(pack)
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

  const [shareInput, setShareInput] = useState('')

  const handleImportShare = () => {
    if (!shareInput.trim()) return
    try {
      const pack = decodeShareString(shareInput)
      onSettingsChange(upsertPack(settings, pack))
      setShareInput('')
      flash(`已导入分享串「${pack.name}」（${pack.sprites.length} 张）`)
    } catch (err) {
      flash(err instanceof Error ? err.message : '分享串解析失败')
    }
  }

  const handleCopyShare = async (pack: SpritePack) => {
    const result = encodeShareStringV2(pack)
    if (!result) {
      flash('该包没有可分享的远程图片（本地图请用「导出」，或先配 imgbb 上传）')
      return
    }
    if (result.missing.length > 0) {
      const go = window.confirm(
        `分享串不完整：${result.included}/${result.total} 张有远程地址。缺失项对方看不到，仍要复制吗？`,
      )
      if (!go) return
    }
    try {
      await navigator.clipboard.writeText(result.text)
      const note =
        result.missing.length > 0
          ? `（${result.included}/${result.total} 张，缺 ${result.missing.length}）`
          : `（${result.included} 张，完整）`
      flash(`已复制分享串${note}`)
    } catch {
      window.prompt('手动复制分享串：', result.text)
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
          显示手机框（关闭则回退纯悬浮窗）
          <input
            type="checkbox"
            checked={settings.showPhone}
            onChange={(e) => onSettingsChange({ ...settings, showPhone: e.target.checked })}
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
        <label className="flex items-center justify-between gap-2 text-sm text-foreground">
          立绘显示位置
          <select
            value={settings.spriteDisplayMode}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                spriteDisplayMode:
                  e.target.value === 'inline' || e.target.value === 'both'
                    ? e.target.value
                    : 'overlay',
              })
            }
            className="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="立绘显示位置"
          >
            <option value="overlay">悬浮窗（默认）</option>
            <option value="inline">楼层内（消息里原位显示）</option>
            <option value="both">两者都显示</option>
          </select>
        </label>
        <label className="flex items-center justify-between text-sm text-foreground">
          渲染消息内插图（[插图:编码]）
          <input
            type="checkbox"
            checked={settings.renderInlineImages}
            onChange={(e) => onSettingsChange({ ...settings, renderInlineImages: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-foreground">
          多立绘自动轮播（一条消息多张时）
          <input
            type="checkbox"
            checked={settings.autoSwitch}
            onChange={(e) => onSettingsChange({ ...settings, autoSwitch: e.target.checked })}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <label className="flex items-center justify-between text-sm text-foreground">
          轮播间隔（秒）
          <input
            type="number"
            min={1}
            max={60}
            step={1}
            defaultValue={settings.autoSwitchSeconds}
            onBlur={(e) => {
              const n = Math.round(Number(e.target.value))
              const v = Number.isFinite(n) ? Math.min(60, Math.max(1, n)) : 3
              e.target.value = String(v)
              onSettingsChange({ ...settings, autoSwitchSeconds: v })
            }}
            className="w-20 rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="轮播间隔秒数"
          />
        </label>
        <label className="flex items-center justify-between gap-2 text-sm text-foreground">
          分组 prompt 模式
          <select
            value={settings.multiRolePromptMode}
            onChange={(e) =>
              onSettingsChange({
                ...settings,
                multiRolePromptMode: e.target.value === 'repeat' ? 'repeat' : 'full',
              })
            }
            className="rounded-lg border border-input bg-background px-2 py-1 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="分组 prompt 模式"
          >
            <option value="full">全量（枚举全部组合）</option>
            <option value="repeat">重复（分组×共享情绪名·省 token）</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          <span className="text-xs text-muted-foreground">imgbb API Key（仅存本地，申请：api.imgbb.com）</span>
          <span className="flex gap-1.5">
            <input
              type={showKey ? 'text' : 'password'}
              defaultValue={settings.imgbbApiKey}
              autoComplete="off"
              onBlur={(e) => onSettingsChange({ ...settings, imgbbApiKey: e.target.value.trim() })}
              className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
              aria-label="imgbb API Key"
            />
            <button
              type="button"
              onClick={() => setShowKey((v) => !v)}
              className="shrink-0 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              aria-label={showKey ? '隐藏 API Key' : '显示 API Key'}
            >
              {showKey ? '隐藏' : '显示'}
            </button>
          </span>
        </label>
        <label className="flex items-center justify-between text-sm text-foreground">
          导入时自动上传到 imgbb 并绑定编号
          <input
            type="checkbox"
            checked={settings.autoUpload}
            onChange={(e) => {
              if (e.target.checked && !settings.imgbbApiKey.trim()) {
                flash('请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）')
                return
              }
              if (e.target.checked) {
                flash('API Key 仅存储在本地浏览器中，不会上传到任何服务器')
              }
              onSettingsChange({ ...settings, autoUpload: e.target.checked })
            }}
            className="h-4 w-4 accent-primary"
          />
        </label>
        <label className="flex flex-col gap-1 text-sm text-foreground">
          <span className="text-xs text-muted-foreground">图床前缀（分享串与插图编码拼接用）</span>
          <input
            type="text"
            defaultValue={settings.imageHost}
            placeholder={DEFAULT_IMAGE_HOST}
            onBlur={(e) => {
              const raw = e.target.value.trim() || DEFAULT_IMAGE_HOST
              const value = /^https?:\/\/.+/.test(raw) ? (raw.endsWith('/') ? raw : `${raw}/`) : DEFAULT_IMAGE_HOST
              e.target.value = value
              onSettingsChange({ ...settings, imageHost: value })
            }}
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="图床前缀"
          />
        </label>
      </section>

      {/* 当前角色与绑定（多包） */}
      <section className="flex flex-col gap-2 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">当前角色</h3>
        <input
          type="text"
          value={characterName}
          onChange={(e) => onCharacterNameChange(e.target.value)}
          className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-label="当前角色名"
        />

        {/* 已启用的包（可移除、整体启停；顺序即多包寻址优先级） */}
        {boundIds.length > 0 && (
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">
                已启用 {boundIds.length} 个包（顺序影响多包寻址优先级）
              </span>
              {binding && (
                <label className="flex shrink-0 items-center gap-1.5 text-xs text-muted-foreground">
                  <input
                    type="checkbox"
                    checked={binding.enabled}
                    onChange={(e) => onSettingsChange(toggleBinding(settings, characterName, e.target.checked))}
                    className="h-4 w-4 accent-primary"
                  />
                  全部启用
                </label>
              )}
            </div>
            <ul className="flex flex-col gap-1">
              {boundIds.map((id, index) => {
                const p = settings.packs.find((pk) => pk.id === id)
                return (
                  <li
                    key={id}
                    className="flex items-center justify-between gap-2 rounded-md border border-border px-2 py-1 text-xs text-foreground"
                  >
                    <span className="min-w-0 truncate">
                      {index + 1}. {p ? `${p.name}（${p.sprites.length} 张）` : `（已删除的包 ${id}）`}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSettingsChange(unbindPack(settings, characterName, id))}
                      className="shrink-0 rounded border border-border px-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      aria-label={`停用包 ${p?.name ?? id}`}
                    >
                      停用
                    </button>
                  </li>
                )
              })}
            </ul>
          </div>
        )}

        {/* 追加一个包 */}
        <select
          value=""
          onChange={(e) => {
            if (e.target.value) onSettingsChange(bindPack(settings, characterName, e.target.value))
          }}
          className="min-w-0 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
          aria-label="添加启用立绘包"
        >
          <option value="">{boundIds.length > 0 ? '再启用一个包…' : '选择要启用的包…'}</option>
          {settings.packs
            .filter((p) => !boundIds.includes(p.id))
            .map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}（{p.sprites.length} 张）
              </option>
            ))}
        </select>

        {activePacks.length > 0 && (
          <p className="text-xs text-muted-foreground">
            当前生效：{activePacks.map((p) => p.name).join('、')}
          </p>
        )}
      </section>

      {/* 立绘包管理 */}
      <section className="flex flex-col gap-2.5 border-t border-border pt-4">
        <h3 className="text-xs font-semibold text-muted-foreground">立绘包管理</h3>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          本批分组（上传时兜底；文件名 鸣人-居家服-微笑.png 会自动拆人名/服装/图名）
          <input
            type="text"
            value={uploadGroup}
            onChange={(e) => setUploadGroup(e.target.value)}
            placeholder="留空 = 不分组"
            className="rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring"
            aria-label="本批分组"
          />
        </label>
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
                    onClick={() => handleExport(pack)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    导出
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopyShare(pack)}
                    className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    分享串
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
                  {pack.sprites.map((s, i) => (
                    <figure
                      key={`${s.group ?? ''}/${s.outfit ?? ''}/${s.tag}#${i}`}
                      className="shrink-0 text-center"
                    >
                      <img
                        src={s.url || '/placeholder.svg'}
                        alt={`${pack.name} - ${s.tag}`}
                        className="h-14 w-14 rounded-md border border-border object-cover"
                        loading="lazy"
                      />
                      <figcaption className="mt-0.5 max-w-14 truncate text-[10px] text-muted-foreground">
                        {[s.group, s.outfit, s.tag].filter(Boolean).join('/')}
                      </figcaption>
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

        {/* 导入分享串 */}
        <div className="flex gap-2">
          <input
            type="text"
            value={shareInput}
            onChange={(e) => setShareInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleImportShare()
            }}
            placeholder="粘贴 stpack2:/stpack1: 分享串…"
            className="min-w-0 flex-1 rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground focus:ring-2 focus:ring-ring"
            aria-label="分享串输入框"
          />
          <button
            type="button"
            onClick={handleImportShare}
            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
          >
            导入
          </button>
        </div>
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
