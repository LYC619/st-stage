/**
 * 立绘包管理弹窗（ST 端）：从悬浮窗齿轮按钮打开。
 * 两级视图：
 * - 列表页：头部工具栏（启用选择 + 新建/导入下拉浮层）、当前角色启用条（chips 可排序/停用）、
 *   包封面卡片墙（使用中绿框标识）
 * - 详情页：右上角「添加立绘」下拉（直接上传 / 粘贴编码批量添加），包信息折叠面板，
 *   立绘网格（改名/替换/删除/设封面/排序，点图放大查看可左右/方向键切换）、
 *   导出 JSON / 复制分享串
 *
 * 安全：所有用户可控文本（包名/tag/作者）一律 textContent，不进 innerHTML。
 * 预设包的图片内容只读，包信息和本地图片通过 same-ID 覆盖层持久化。
 */

import type { PluginSettings, Sprite, SpritePack } from '../../core/types'
import {
  DEFAULT_PROMPT_NOTE_PLACEMENT,
  formatAddress,
  getPackCover,
  getSpriteSource,
} from '../../core/types'
import {
  type BindingConflict,
  type ConflictCheckedSettingsResult,
  addPackCustomTag,
  bindPack,
  deletableLocalSpritePaths,
  genId,
  movePack,
  movePackBefore,
  moveSprite,
  previewBindingAddressChanges,
  removePack,
  removePackCustomTag,
  removePacks,
  reorderBinding,
  setBinding,
  setPackKind,
  spriteGroup,
  toggleBinding,
  unbindPack,
  upsertPack,
  upsertSprite,
} from '../../core/sprite-store'
import {
  applyPackMerge,
  inspectPackImport,
  PackMergeChoiceError,
  previewPackMerge,
  type PackMergeChoice,
  validatePackMergeChoices,
} from '../../core/pack-merge'
import { exportPack, importPack, urlToDataUri } from '../../core/pack-io'
import { decodeShareString, encodeShareStringV2, isValidImageCode } from '../../core/share-code'
import {
  normalizeTag,
  parseSpriteFileName,
  sanitizeDescription,
  sanitizePackName,
} from '../../core/naming'
import {
  planUploads,
  previewGroupSplit,
  splitPackByGroup,
  type ConflictStrategy,
  type UploadEntry,
} from '../../core/pack-split'
import { compressImage, formatBytes } from '../../core/image-compress'
import { isValidImgbbResult, uploadToImgbb } from '../../core/imgbb'
import { isPresetPack } from '../../core/presets'
import { summarizePackResources } from '../../core/sprite-resources'
import {
  clearPresetMetadata,
  setPresetLocalSprite,
  setPresetMetadata,
} from '../../core/preset-overrides'
import {
  filterSprites,
  groupPacksByRole,
  MAX_NOTE_CODE_POINTS,
  normalizeLabels,
  normalizeNote,
  normalizeOutfitNotes,
  packLabels,
} from '../../core/sprite-metadata'
import type { STAdapter } from './st-adapter'
import { createSpriteActions, type SpriteAction, type SpriteActionContext } from './sprite-actions'
import { openSpriteLightbox, type SpriteLightboxController } from './sprite-lightbox'
import { localizeSprite } from './sprite-localize'

export interface ManagerDeps {
  adapter: STAdapter
  getSettings: () => PluginSettings
  updateSettings: (next: PluginSettings) => void
  /** 弹窗关闭回调（带打开来源）：来源=手机时由 index.ts 重新展开手机回图库页 */
  onClosed?: (source: ManagerSource) => void
}

/** 弹窗打开来源：悬浮窗齿轮 / 手机图库 App */
export type ManagerSource = 'overlay' | 'phone'

export interface ManagerController {
  open(source?: ManagerSource): void
  close(): void
  destroy(): void
  /** 弹窗打开时刷新内容（角色切换后调用） */
  refreshIfOpen(): void
}

type View = { kind: 'list' } | { kind: 'pack'; packId: string }
const SPRITE_PAGE_SIZE = 60

interface ActiveLightbox {
  controller: SpriteLightboxController | null
  packId: string
  index: number
}

export function createSpriteManager(deps: ManagerDeps): ManagerController {
  let backdrop: HTMLElement | null = null
  let destroyed = false
  let view: View = { kind: 'list' }
  let spriteVisibleCount = SPRITE_PAGE_SIZE
  let spriteFilterQuery = ''
  let spriteFilterLabels: string[] = []
  /** 同一时间只展开一个角色组，避免多组图包同时把列表撑得过长。 */
  let expandedRoleGroupKey = ''
  /** 折叠面板展开态（key → open）：commit 触发整体重渲染时保持用户手动展开的面板不收起 */
  const openSections = new Map<string, boolean>()
  /** 「启用包」勾选浮层是否展开：勾选提交会整体重渲染，靠这个标记让浮层原地重建 */
  let enableListOpen = false
  let enableListDocHandler: ((e: MouseEvent) => void) | null = null
  /** 列表页批量管理模式（多选删除 + 拖拽/按钮排序） */
  let batchMode = false
  const selectedPackIds = new Set<string>()
  let batchResourceBusy = false
  let openedFrom: ManagerSource = 'overlay'
  /** 当前放大查看器及其完整列表索引；管理器重渲染不丢失导航位置。 */
  let activeLightbox: ActiveLightbox | null = null

  /** 遮罩尺寸用 JS 按 innerWidth/Height 写死 px（与手机壳同一套定位路径）：
      移动端浏览器对 fixed+四边锚点/视口单位的解释五花八门，内联 px 最稳 */
  function applyBackdropSize(): void {
    if (!backdrop) return
    backdrop.style.left = '0'
    backdrop.style.top = '0'
    backdrop.style.width = `${window.innerWidth}px`
    backdrop.style.height = `${window.innerHeight}px`
  }

  function open(source: ManagerSource = 'overlay'): void {
    if (destroyed) return
    openedFrom = source
    if (backdrop) {
      render()
      return
    }
    view = { kind: 'list' }
    spriteVisibleCount = SPRITE_PAGE_SIZE
    spriteFilterQuery = ''
    spriteFilterLabels = []
    expandedRoleGroupKey = ''
    openSections.clear()
    enableListOpen = false
    batchMode = false
    selectedPackIds.clear()
    backdrop = el('div', 'so-manager-backdrop')
    // 点空白不再关闭（用户实测：误触退出后要重新逐层进入，受挫感强）；关闭走 ✕ 按钮或 Esc
    document.addEventListener('keydown', onEscape)
    window.addEventListener('resize', applyBackdropSize)
    applyBackdropSize()

    const dialog = el('div', 'so-manager')
    dialog.setAttribute('role', 'dialog')
    dialog.setAttribute('aria-label', '立绘包管理')

    const header = el('div', 'so-manager-header')
    // 详情页专用返回键：放在固定头部，滚到哪都能返回（移动端全屏时尤其重要）
    const backBtn = el('div', 'menu_button so-manager-back')
    backBtn.title = '返回列表'
    backBtn.textContent = '‹'
    backBtn.setAttribute('role', 'button')
    backBtn.tabIndex = 0
    const goBack = () => {
      view = { kind: 'list' }
      render()
    }
    backBtn.addEventListener('click', goBack)
    backBtn.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        goBack()
      }
    })
    const title = el('b', 'so-manager-title')
    // 头部操作区（列表页放启用选择 + 新建/导入下拉；详情页留空自动隐藏）
    const actions = el('div', 'so-manager-actions')
    const closeBtn = el('div', 'menu_button so-manager-close')
    closeBtn.title = '关闭'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => close())
    header.append(backBtn, title, actions, closeBtn)

    const body = el('div', 'so-manager-body')
    dialog.append(header, body)
    backdrop.append(dialog)
    document.body.append(backdrop)
    render()
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return
    if (e.defaultPrevented) return
    // 放大查看器自己处理 Esc（capture + stopPropagation），这里兜底不动视图
    if (backdrop?.querySelector('.so-lightbox')) return
    // 先关下拉浮层，再谈返回/关闭
    if (backdrop?.querySelector('.so-popover')) {
      closeEnableList()
      closePopovers()
      return
    }
    if (view.kind === 'pack') {
      view = { kind: 'list' }
      render()
    } else {
      close()
    }
  }

  function close(): void {
    if (!backdrop) return
    activeLightbox?.controller?.close()
    closeEnableList()
    document.removeEventListener('keydown', onEscape)
    window.removeEventListener('resize', applyBackdropSize)
    backdrop.remove()
    backdrop = null
    deps.onClosed?.(openedFrom)
  }

  function refreshIfOpen(): void {
    if (backdrop) {
      render()
      refreshLightbox()
    }
  }

  function commit(next: PluginSettings): void {
    deps.updateSettings(next)
    render()
    refreshLightbox()
  }

  function conflictText(conflicts: BindingConflict[]): string {
    return conflicts
      .slice(0, 3)
      .map(
        (conflict) =>
          `${conflict.characterName}：${conflict.formattedAddress}（${conflict.owners.map((owner) => owner.packName).join(' / ')}）`,
      )
      .join('；')
  }

  function showConflicts(conflicts: BindingConflict[]): void {
    const message = `操作未生效，存在地址冲突：${conflictText(conflicts)}`
    const body = backdrop?.querySelector('.so-manager-body') as HTMLElement | null
    if (body) toast(body, message)
    else window.alert(message)
  }

  function rejectConflicts(conflicts: BindingConflict[]): false {
    render()
    showConflicts(conflicts)
    return false
  }

  function checkedSettings(result: ConflictCheckedSettingsResult): PluginSettings | null {
    if (!result.ok) {
      showConflicts(result.conflicts)
      return null
    }
    return result.settings
  }

  function updateChecked(result: ConflictCheckedSettingsResult): boolean {
    const next = checkedSettings(result)
    if (!next) return false
    deps.updateSettings(next)
    return true
  }

  function commitChecked(result: ConflictCheckedSettingsResult): boolean {
    if (!result.ok) return rejectConflicts(result.conflicts)
    commit(result.settings)
    return true
  }

  function rejectPackMergeError(error: unknown, body: HTMLElement): null {
    if (error instanceof PackMergeChoiceError) {
      toast(body, `合并已取消：选择无效（${error.message}）`)
      return null
    }
    console.error('合并立绘包失败', error)
    toast(body, '合并失败，请查看控制台日志')
    return null
  }

  function mergeWithPrompts(
    packs: SpritePack[],
    defaultName: string,
    body: HTMLElement,
  ): SpritePack | null {
    const preview = previewPackMerge(packs)
    const choices: PackMergeChoice[] = []
    for (const conflict of preview.conflicts) {
      const options = conflict.candidates
        .map((candidate, index) => `${index + 1}. ${candidate.sourcePackName} — ${candidate.sprite.url}`)
        .join('\n')
      const raw = window.prompt(
        `地址「${formatAddress(conflict.address)}」有不同图片，请输入要保留的序号：\n${options}`,
        '1',
      )
      if (raw === null) return null
      choices.push({ key: conflict.key, candidateIndex: Number(raw) - 1 })
    }
    try {
      validatePackMergeChoices(packs, choices)
    } catch (error) {
      return rejectPackMergeError(error, body)
    }
    const rawName = window.prompt('合并结果的包名：', defaultName)
    if (rawName === null) return null
    const name = sanitizePackName(rawName)
    if (!name) {
      toast(body, '合并已取消：包名不能为空')
      return null
    }
    try {
      return applyPackMerge(packs, choices, { id: genId(), name })
    } catch (error) {
      return rejectPackMergeError(error, body)
    }
  }

  function installImportedPack(pack: SpritePack, body: HTMLElement): boolean {
    const settings = deps.getSettings()
    const related = settings.packs.filter((existing) => {
      const inspection = inspectPackImport(existing, pack)
      return inspection.sameName || inspection.conflicts.length > 0
    })
    if (related.length === 0) {
      if (!updateChecked(upsertPack(settings, pack))) return false
      toast(body, `已导入立绘包「${pack.name}」（${pack.sprites.length} 张）`)
      return true
    }

    const answer = window.prompt(
      `检测到同名或地址重叠：${related.map((item) => item.name).join('、')}\n` +
        '输入 1 合并进现有包，2 重命名后安装，3 仅安装（之后可按需启用）；其他输入取消。',
      '1',
    )
    if (answer === '1') {
      const target = related[0]
      // 二级选择：一级菜单保持 3 项防用户懵，合并去向在这里细分
      const mode = window.prompt(
        `合并到哪里？\n1 并入旧包「${target.name}」（推荐：角色绑定不变，重叠源包移除）\n2 合并为新包（所有源包保留）\n其他输入取消。`,
        '1',
      )
      if (mode === '1') {
        const merged = mergeWithPrompts([...related, pack], target.name, body)
        if (!merged) return false
        let next = settings
        for (const other of related.slice(1)) next = removePack(next, other.id)
        if (!updateChecked(upsertPack(next, { ...merged, id: target.id }))) return false
        toast(body, `已合并进「${merged.name}」（${merged.sprites.length} 张）`)
        return true
      }
      if (mode === '2') {
        const merged = mergeWithPrompts([...related, pack], `${target.name} 合并`, body)
        if (!merged || !updateChecked(upsertPack(settings, merged))) return false
        toast(body, `已生成合并包「${merged.name}」（${merged.sprites.length} 张），源包仍保留`)
        return true
      }
      return false
    }
    if (answer === '2') {
      const rawName = window.prompt('请输入新的包名：', `${pack.name} 新`)
      if (rawName === null) return false
      const name = sanitizePackName(rawName)
      if (!name || settings.packs.some((existing) => existing.name === name)) {
        toast(body, '未安装：新包名为空或仍与现有包同名')
        return false
      }
      if (!updateChecked(upsertPack(settings, { ...pack, name }))) return false
      toast(body, `已重命名并安装「${name}」（未启用）`)
      return true
    }
    if (answer === '3') {
      if (!updateChecked(upsertPack(settings, pack))) return false
      toast(body, `已安装「${pack.name}」，未加入当前角色`)
      return true
    }
    return false
  }

  function bindPackWithChoices(characterName: string, packId: string, body: HTMLElement): void {
    const settings = deps.getSettings()
    const result = bindPack(settings, characterName, packId)
    if (result.ok) {
      const changes = previewBindingAddressChanges(settings, result.settings, characterName)
      if (
        changes.removed.length > 0 &&
        !window.confirm(
          `启用后以下旧地址将变化：${changes.removed.slice(0, 6).join('、')}\n` +
            `新地址示例：${changes.added.slice(0, 6).join('、')}\n仍要继续吗？`,
        )
      ) return
      commit(result.settings)
      return
    }
    const answer = window.prompt(
      `启用会产生地址冲突：${conflictText(result.conflicts)}\n` +
        '输入 1 替换当前冲突包，2 合并为新包后启用；其他输入取消。',
      '1',
    )
    const sourceIds = new Set(result.conflicts.flatMap((conflict) => conflict.owners.map((owner) => owner.packId)))
    sourceIds.add(packId)
    const binding = settings.bindings.find((item) => item.characterName === characterName)
    const boundIds = binding?.packIds ?? []
    if (answer === '1') {
      sourceIds.delete(packId)
      const nextIds = boundIds.filter((id) => !sourceIds.has(id))
      if (!nextIds.includes(packId)) nextIds.push(packId)
      commitChecked(setBinding(settings, characterName, nextIds))
      return
    }
    if (answer === '2') {
      const sources = settings.packs.filter((candidate) => sourceIds.has(candidate.id))
      const incoming = settings.packs.find((candidate) => candidate.id === packId)
      const merged = mergeWithPrompts(sources, incoming ? `${incoming.name} 合并` : '合并立绘包', body)
      if (!merged) return
      const installed = upsertPack(settings, merged)
      if (!installed.ok) {
        rejectConflicts(installed.conflicts)
        return
      }
      const nextIds = boundIds.filter((id) => !sourceIds.has(id))
      nextIds.push(merged.id)
      const rebound = setBinding(installed.settings, characterName, nextIds)
      if (!rebound.ok) {
        rejectConflicts(rebound.conflicts)
        return
      }
      commit(rebound.settings)
      toast(body, `已生成并启用合并包「${merged.name}」；源包仍保留`)
    }
  }

  /** 修改单个包并提交 */
  function commitPack(pack: SpritePack): void {
    commitChecked(upsertPack(deps.getSettings(), pack))
  }

  function closePopovers(): void {
    backdrop?.querySelectorAll('.so-popover').forEach((n) => n.remove())
  }

  function closeEnableList(): void {
    enableListOpen = false
    backdrop?.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove())
    if (enableListDocHandler) {
      document.removeEventListener('click', enableListDocHandler, true)
      enableListDocHandler = null
    }
  }

  /**
   * 「启用包」勾选浮层：勾=启用、取消勾=停用，改完浮层原地保持展开——
   * 旧 <select> 每选一次都被整体重渲染销毁、必须重新点开（用户实测反馈）。
   * 每次 render() 后由 renderList 依据 enableListOpen 重建。
   */
  function renderEnableList(): void {
    const header = backdrop?.querySelector('.so-manager-header') as HTMLElement | null
    if (!header) return
    header.querySelectorAll('.so-popover[data-pop="启用包"]').forEach((n) => n.remove())
    if (!enableListOpen) return
    const characterName = deps.adapter.getCurrentCharacterName()
    if (!characterName) {
      closeEnableList()
      return
    }
    const body = backdrop?.querySelector('.so-manager-body') as HTMLElement
    const settings = deps.getSettings()
    const boundIds = settings.bindings.find((b) => b.characterName === characterName)?.packIds ?? []
    const panel = el('div', 'so-popover so-enable-pop')
    panel.dataset.pop = '启用包'
    const heading = el('div', 'so-popover-title')
    heading.textContent = `勾选启用（${characterName}，即时生效）`
    panel.append(heading)
    if (settings.packs.length === 0) {
      const tip = el('div', 'so-status')
      tip.textContent = '还没有立绘包，先用「新建」或「导入」。'
      panel.append(tip)
    }
    for (const p of settings.packs) {
      panel.append(
        checkboxRow(`${p.name}（${p.sprites.length} 张）`, boundIds.includes(p.id), (v) => {
          if (v) bindPackWithChoices(characterName, p.id, body)
          else commit(unbindPack(deps.getSettings(), characterName, p.id))
          // 启用被用户取消（冲突确认框选了否）时没有 commit 重渲染，勾选框会与实际不符——按真实状态重建
          renderEnableList()
        }),
      )
    }
    header.append(panel)
    if (!enableListDocHandler) {
      enableListDocHandler = (e: MouseEvent) => {
        const current = backdrop?.querySelector('.so-popover[data-pop="启用包"]')
        const btn = backdrop?.querySelector('.so-enable-btn')
        if (current?.contains(e.target as Node) || btn?.contains(e.target as Node)) return
        closeEnableList()
      }
      document.addEventListener('click', enableListDocHandler, true)
    }
  }

  /** 头部下拉：按钮 + 锚在头部下方靠右的浮层；同时只开一个，Esc/点外部/重渲染关闭 */
  function dropdownButton(label: string, build: (panel: HTMLElement) => void): HTMLElement {
    const btn = button(`${label} ▾`, () => {
      const header = backdrop?.querySelector('.so-manager-header')
      if (!header) return
      const existing = header.querySelector(`.so-popover[data-pop="${label}"]`)
      closePopovers()
      if (existing) return
      const panel = el('div', 'so-popover')
      panel.dataset.pop = label
      build(panel)
      header.append(panel)
      ;(panel.querySelector('input, textarea') as HTMLElement | null)?.focus()
      const onDocClick = (e: MouseEvent) => {
        // 点开关按钮本身交给按钮的 toggle 逻辑处理
        if (panel.contains(e.target as Node) || btn.contains(e.target as Node)) return
        panel.remove()
        document.removeEventListener('click', onDocClick, true)
      }
      document.addEventListener('click', onDocClick, true)
    })
    return btn
  }

  function render(): void {
    if (!backdrop) return
    const backBtn = backdrop.querySelector('.so-manager-back') as HTMLElement
    const title = backdrop.querySelector('.so-manager-title') as HTMLElement
    const actions = backdrop.querySelector('.so-manager-actions') as HTMLElement
    const body = backdrop.querySelector('.so-manager-body') as HTMLElement
    body.innerHTML = ''
    actions.innerHTML = ''
    backdrop.querySelector('.so-manager')?.classList.toggle('so-manager-batch-mode', batchMode)
    closePopovers()

    // 渲染兜错：任何异常都显示在弹窗里，不留“只有标题栏”的空壳（移动端无控制台可查）
    try {
      if (view.kind === 'pack') {
        const packId = view.packId
        const pack = deps.getSettings().packs.find((p) => p.id === packId)
        if (pack) {
          backBtn.style.display = 'inline-flex'
          title.textContent = pack.name
          renderPackDetail(body, actions, pack)
          return
        }
        view = { kind: 'list' }
      }
      backBtn.style.display = 'none'
      title.textContent = '立绘包管理'
      renderList(body, actions)
    } catch (err) {
      console.error('[sprite-overlay] 管理弹窗渲染失败', err)
      const msg = el('div', 'so-status')
      msg.textContent = `界面渲染出错：${err instanceof Error ? err.message : String(err)}`
      body.append(msg)
    }
  }

  /** 折叠面板：图墙占主位，次要功能区默认收起只露标题（用户实测反馈）。
      传 key 的面板在整体重渲染间保持展开态（实测：点「保存」后面板收起体验差）。 */
  function collapsible(titleText: string, open = false, key = ''): { box: HTMLElement; body: HTMLElement } {
    const box = document.createElement('details')
    box.className = 'so-section so-collapse'
    box.open = key ? openSections.get(key) ?? open : open
    // toggle 只在用户点击后触发（插入前赋值不触发），记录的是真实操作
    if (key) box.addEventListener('toggle', () => openSections.set(key, box.open))
    const summary = document.createElement('summary')
    summary.className = 'so-section-title'
    summary.textContent = titleText
    const inner = el('div', 'so-collapse-body')
    box.append(summary, inner)
    return { box, body: inner }
  }

  /* ---------------- 列表页 ---------------- */

  function renderList(body: HTMLElement, actions: HTMLElement): void {
    const settings = deps.getSettings()
    const characterName = deps.adapter.getCurrentCharacterName()
    const binding = settings.bindings.find((b) => b.characterName === characterName)
    const boundIds = binding?.packIds ?? []

    // 头部操作区：批量管理模式=全选/删除/完成；常规=启用勾选浮层 + 新建/导入下拉
    if (batchMode) {
      const selectedCount = selectedPackIds.size
      const deletablePacks = settings.packs.filter(
        (pack) => selectedPackIds.has(pack.id) && !isPresetPack(pack.id),
      )
      actions.append(
        button('全选', () => {
          const all = settings.packs
          if (all.length > 0 && all.every((p) => selectedPackIds.has(p.id))) {
            selectedPackIds.clear()
          } else {
            selectedPackIds.clear()
            for (const p of all) selectedPackIds.add(p.id)
          }
          render()
        }),
        button(`上传云端（${selectedCount}）`, () => {
          void uploadSelectedPacks()
        }),
        button(`保存本地（${selectedCount}）`, () => {
          void localizeSelectedPacks()
        }),
        button(`复制分享串（${selectedCount}）`, () => {
          void copySelectedPackShares()
        }),
        button(`删除所选（${deletablePacks.length}）`, () => {
          if (deletablePacks.length === 0) {
            toast(body, selectedPackIds.size > 0
              ? '预设包不可删除；可保存本地、上传云端或复制分享串'
              : '先点卡片勾选要删除的包')
            return
          }
          const names = deletablePacks.map((pack) => pack.name)
          const preview = names.slice(0, 8).join('、') + (names.length > 8 ? ` 等 ${names.length} 个` : '')
          const ids = deletablePacks.map((pack) => pack.id)
          void deletePacksWithChoice(ids, names, preview)
        }, 'so-btn-danger'),
        button('完成', () => {
          batchMode = false
          selectedPackIds.clear()
          render()
        }),
      )
    } else {
      if (characterName) {
        const enableBtn = button(
          boundIds.length > 0 ? `启用包（${boundIds.length}） ▾` : '启用包 ▾',
          () => {
            if (enableListOpen) {
              closeEnableList()
            } else {
              closePopovers()
              enableListOpen = true
              renderEnableList()
            }
          },
        )
        enableBtn.classList.add('so-enable-btn')
        enableBtn.setAttribute('aria-label', `为「${characterName}」勾选启用立绘包`)
        actions.append(enableBtn)
      }
      actions.append(
        dropdownButton('新建', (panel) => {
        const heading = el('div', 'so-popover-title')
        heading.textContent = '新建立绘包'
        const nameInput = textInput('输入新包名称…')
        nameInput.maxLength = 40
        const createBtn = button('创建', () => {
          const name = sanitizePackName(nameInput.value)
          if (!name) {
            toast(body, '包名不能为空（| = @ < > 等符号会被剔除）')
            return
          }
          const pack: SpritePack = { id: genId(), name, author: '我', sprites: [] }
          if (!updateChecked(upsertPack(deps.getSettings(), pack))) return
          view = { kind: 'pack', packId: pack.id }
          render()
        })
        nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) createBtn.click()
        })
        panel.append(heading, nameInput, createBtn)
      }),
      dropdownButton('导入', (panel) => {
        const shareHeading = el('div', 'so-popover-title')
        shareHeading.textContent = '从分享字符串导入'
        const shareInput = document.createElement('textarea')
        shareInput.className = 'text_pole'
        shareInput.rows = 3
        shareInput.placeholder = '粘贴 stpack2:/stpack1: 分享串…'
        const shareBtn = button('导入', () => {
          if (!shareInput.value.trim()) return
          try {
            const pack = decodeShareString(shareInput.value)
            if (!installImportedPack(pack, body)) return
            const installed = deps.getSettings().packs.find((item) => item.id === pack.id)
            if (installed) view = { kind: 'pack', packId: installed.id }
            render()
          } catch (err) {
            toast(body, err instanceof Error ? err.message : '分享串解析失败')
          }
        })
        const jsonHeading = el('div', 'so-popover-title')
        jsonHeading.textContent = '从 JSON 文件导入'
        const jsonBtn = button('选择 JSON 文件…', () => {
          pickFile('.json,application/json', false, async (files) => {
            try {
              const text = await files[0].text()
              // ponytail: 2MB 阈值是拍脑袋值——只为在大 base64 包上提醒云端内存风险，不做环境检测
              if (
                text.length > 2 * 1024 * 1024 &&
                !window.confirm(
                  `这个 JSON 有 ${(text.length / 1024 / 1024).toFixed(1)}MB（内嵌 base64 图）。云端部署的酒馆导入大包容易内存爆满，建议让对方先传图床再发分享串。仍要导入吗？`,
                )
              )
                return
              const pack = importPack(text)
              if (!installImportedPack(pack, body)) return
              const installed = deps.getSettings().packs.find((item) => item.id === pack.id)
              if (installed) view = { kind: 'pack', packId: installed.id }
              render()
            } catch (err) {
              toast(body, err instanceof Error ? err.message : '导入失败')
            }
          })
        })
        panel.append(shareHeading, shareInput, shareBtn, jsonHeading, jsonBtn)
      }),
      )
      if (settings.packs.length > 0) {
        actions.append(
          button('批量管理', () => {
            closeEnableList()
            batchMode = true
            selectedPackIds.clear()
            render()
          }),
        )
      }
    }

    // 当前角色启用条：横向 chips（可排序/停用）+ 整体启停（六期：一个聊天可启用多个包）
    const strip = el('div', 'so-row so-bind-strip')
    if (characterName) {
      const label = el('span', 'so-bind-label')
      label.textContent =
        boundIds.length > 0
          ? `${characterName} · 已启用 ${boundIds.length} 个：`
          : `${characterName} · 尚未启用立绘包（用右上角选择启用）`
      strip.append(label)
      boundIds.forEach((id, index) => {
        const pack = settings.packs.find((p) => p.id === id)
        const chip = el('span', 'so-chip')
        const name = el('span', 'so-chip-name')
        name.textContent = pack
          ? `${index + 1}. ${pack.name}（${pack.sprites.length} 张）`
          : `（已删除的包 ${id}）`
        chip.append(name)
        if (boundIds.length > 1) {
          chip.append(
            iconButton('◀', '前移（多包寻址优先级更高）', () => {
              if (index > 0) commit(reorderBinding(deps.getSettings(), characterName, index, index - 1))
            }, 'so-chip-btn'),
            iconButton('▶', '后移', () => {
              commit(reorderBinding(deps.getSettings(), characterName, index, index + 1))
            }, 'so-chip-btn'),
          )
        }
        chip.append(
          iconButton('✕', '停用此包', () => {
            commit(unbindPack(deps.getSettings(), characterName, id))
          }, 'so-chip-btn'),
        )
        strip.append(chip)
      })
      if (binding) {
        strip.append(
          el('span', 'so-spacer'),
          checkboxRow('全部启用', binding.enabled, (v) =>
            commitChecked(toggleBinding(deps.getSettings(), characterName, v)),
          ),
        )
      }
    } else {
      const tip = el('span', 'so-status')
      tip.textContent = '请先打开一个角色聊天，再回来启用立绘包。'
      strip.append(tip)
    }
    body.append(strip)

    // 包封面图墙：立绘包是图片集合，用卡片网格浏览（同 ST 角色列表的卡片墙模式）
    // 批量管理模式强制平铺网格：拖拽排序调整的是包列表的整体顺序，折叠分组下无法直观呈现
    if (batchMode) {
      const tip = el('div', 'so-status so-batch-tip')
      tip.textContent = '批量管理：先勾选图包，再统一设置类型或标签；资源操作和排序仍可在上方完成。预设包可保存本地或分享，但不可删除。'
      body.append(tip)
      body.append(renderBatchClassificationTools(body))
    }
    const useFold = settings.galleryFoldByRole && !batchMode
    const grid = el('div', useFold ? 'so-pack-list-folded' : 'so-pack-grid')
    const boundState = (pack: SpritePack): 'active' | 'off' | null =>
      boundIds.includes(pack.id) ? (binding?.enabled ? 'active' : 'off') : null
    if (useFold) {
      for (const group of groupPacksByRole(settings.packs)) {
        if (group.packCount === 1) {
          grid.append(renderPackCard(group.packs[0], boundState(group.packs[0])))
          continue
        }
        const section = el('div', 'so-role-pack-group')
        section.dataset.roleKey = group.key
        const expanded = expandedRoleGroupKey === group.key
        const toggle = () => {
          expandedRoleGroupKey = expanded ? '' : group.key
          render()
        }
        if (expanded) {
          const row = el('button', 'so-role-pack-row') as HTMLButtonElement
          row.type = 'button'
          row.setAttribute('aria-expanded', 'true')
          const title = el('b')
          title.textContent = group.role
          const counts = el('span')
          counts.textContent = `${group.packCount} 个图包 · ${group.spriteCount} 张`
          const arrow = el('span', 'so-role-pack-arrow')
          arrow.textContent = '▾'
          row.append(title, counts, arrow)
          row.addEventListener('click', toggle)
          const packs = el('div', 'so-role-pack-strip')
          packs.setAttribute('aria-label', `${group.role}的图包`)
          for (const pack of group.packs) packs.append(renderPackCard(pack, boundState(pack)))
          section.append(row, packs)
        } else {
          section.append(renderRolePackStack(group.role, group.key, group.packs, group.spriteCount, boundState, toggle))
        }
        grid.append(section)
      }
    } else {
      for (const pack of settings.packs) grid.append(renderPackCard(pack, boundState(pack)))
    }
    body.append(grid)

    body.append(statusBar())
    renderEnableList()
  }

  function selectedPacks(): SpritePack[] {
    return deps.getSettings().packs.filter((pack) => selectedPackIds.has(pack.id))
  }

  function persistSelectedPresetMetadata(
    settings: PluginSettings,
    packIds: string[],
  ): PluginSettings {
    let next = settings
    for (const packId of packIds) {
      if (!isPresetPack(packId)) continue
      const pack = next.packs.find((candidate) => candidate.id === packId)
      if (!pack) continue
      const customTags = normalizeLabels(pack.customTags)
      next = setPresetMetadata(next, packId, {
        name: pack.name,
        author: pack.author ?? null,
        description: pack.description ?? null,
        roleName: pack.roleName ?? null,
        outfit: pack.outfit ?? null,
        promptNote: pack.promptNote ?? null,
        promptNotePlacement: pack.promptNotePlacement ?? null,
        outfitNotes: pack.outfitNotes ?? null,
        kind: pack.kind ?? null,
        customTags: customTags.length > 0 ? customTags : null,
      })
    }
    return next
  }

  function renderBatchClassificationTools(body: HTMLElement): HTMLElement {
    const panel = el('div', 'so-batch-classification')
    const ids = [...selectedPackIds]

    const kindSelect = document.createElement('select')
    kindSelect.className = 'text_pole so-batch-kind-select'
    for (const [value, label] of [['sprite', '立绘'], ['illustration', '插图']] as const) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      kindSelect.append(option)
    }
    const kindRow = el('div', 'so-row')
    kindRow.append(
      labeled('类型', kindSelect),
      button('设置类型', () => {
        if (selectedPackIds.size === 0) {
          toast(body, '请先勾选要设置的图包')
          return
        }
        const selected = [...selectedPackIds]
        const changed = setPackKind(
          deps.getSettings(),
          selected,
          kindSelect.value === 'illustration' ? 'illustration' : 'sprite',
        )
        commit(persistSelectedPresetMetadata(changed, selected))
        toast(body, `已设置 ${selected.length} 个图包的类型`)
      }),
    )

    const tagInput = textInput('输入自定义标签')
    tagInput.classList.add('so-batch-tag-input')
    tagInput.maxLength = 32
    const addRow = el('div', 'so-row')
    addRow.append(
      labeled('自定义标签', tagInput),
      button('添加标签', () => {
        const tag = normalizeLabels([tagInput.value])[0]
        if (selectedPackIds.size === 0) {
          toast(body, '请先勾选要设置的图包')
          return
        }
        if (!tag) {
          toast(body, '请输入标签')
          return
        }
        const selected = [...selectedPackIds]
        const changed = addPackCustomTag(deps.getSettings(), selected, tag)
        commit(persistSelectedPresetMetadata(changed, selected))
        toast(body, `已为 ${selected.length} 个图包添加「${tag}」`)
      }),
    )

    const removeSelect = document.createElement('select')
    removeSelect.className = 'text_pole so-batch-tag-remove-select'
    const emptyOption = document.createElement('option')
    emptyOption.value = ''
    emptyOption.textContent = ids.length === 0 ? '先勾选图包' : '选择要移除的标签'
    removeSelect.append(emptyOption)
    const selectedTags = normalizeLabels(selectedPacks().flatMap((pack) => pack.customTags ?? []))
    for (const tag of selectedTags) {
      const option = document.createElement('option')
      option.value = tag
      option.textContent = tag
      removeSelect.append(option)
    }
    const removeRow = el('div', 'so-row')
    removeRow.append(
      labeled('移除标签', removeSelect),
      button('移除标签', () => {
        if (selectedPackIds.size === 0) {
          toast(body, '请先勾选要设置的图包')
          return
        }
        if (!removeSelect.value) {
          toast(body, '请选择要移除的标签')
          return
        }
        const selected = [...selectedPackIds]
        const changed = removePackCustomTag(deps.getSettings(), selected, removeSelect.value)
        commit(persistSelectedPresetMetadata(changed, selected))
        toast(body, `已从 ${selected.length} 个图包移除「${removeSelect.value}」`)
      }),
    )

    panel.append(kindRow, addRow, removeRow)
    return panel
  }

  function sameSprite(pack: SpritePack, source: Sprite): Sprite | null {
    return pack.sprites.find((candidate) =>
      candidate.tag === source.tag &&
      spriteGroup(candidate) === spriteGroup(source) &&
      (candidate.outfit ?? '') === (source.outfit ?? ''),
    ) ?? null
  }

  async function uploadSelectedPacks(): Promise<void> {
    if (batchResourceBusy) return
    const packs = selectedPacks()
    if (packs.length === 0) {
      toast(currentManagerBody(), '先勾选要上传云端的图包')
      return
    }
    const apiKey = deps.getSettings().imgbbApiKey.trim()
    if (!apiKey) {
      toast(currentManagerBody(), '请先在「图库」App 配置 imgbb API Key')
      return
    }
    batchResourceBusy = true
    let uploaded = 0
    let failed = 0
    try {
      for (const pack of packs) {
        const pending = pack.sprites.filter(
          (sprite) => getSpriteSource(sprite) !== 'hosted' &&
            !(sprite.remoteUrl && /^https?:\/\//.test(sprite.remoteUrl)),
        )
        for (const sprite of pending) {
          try {
            const dataUri = sprite.url.startsWith('data:') ? sprite.url : await urlToDataUri(sprite.url)
            const result = await uploadToImgbb(apiKey, dataUri)
            if (!isValidImgbbResult(result)) throw new Error('图床响应无效')
            const latestPack = deps.getSettings().packs.find((candidate) => candidate.id === pack.id)
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null
            if (!latestPack || !latestSprite) throw new Error('立绘在上传期间已变化')
            if (!updateChecked(upsertPack(
              deps.getSettings(),
              upsertSprite(latestPack, { ...latestSprite, code: result.code, remoteUrl: result.url }),
            ))) throw new Error('更新图包失败')
            uploaded++
          } catch (error) {
            console.warn('[sprite-overlay] 批量上传云端失败', { packId: pack.id, tag: sprite.tag, error })
            failed++
          }
        }
      }
    } finally {
      batchResourceBusy = false
      render()
      toast(currentManagerBody(), `上传云端完成：成功 ${uploaded} 张，失败 ${failed} 张${failed > 0 ? '（可再次点击重试）' : ''}`)
    }
  }

  async function localizeSelectedPacks(): Promise<void> {
    if (batchResourceBusy) return
    const packs = selectedPacks()
    if (packs.length === 0) {
      toast(currentManagerBody(), '先勾选要保存到本地的图包')
      return
    }
    batchResourceBusy = true
    let localizedCount = 0
    let failed = 0
    try {
      for (const pack of packs) {
        const remoteSprites = pack.sprites.filter((sprite) => getSpriteSource(sprite) === 'hosted')
        const preset = isPresetPack(pack.id)
        for (const sprite of remoteSprites) {
          try {
            const parts = [pack.name, spriteGroup(sprite), sprite.outfit ?? '', sprite.tag].filter(Boolean)
            const fileName = `${parts.join('-')}.webp`
            const localized = await localizeSprite(sprite, fileName, {
              fetch: window.fetch.bind(window),
              compress: compressImage,
              saveImage: (file, name) => deps.adapter.saveImageFile(
                file,
                name,
                deps.adapter.getCurrentCharacterName() || pack.name || 'shared',
              ),
            })
            const latestSettings = deps.getSettings()
            const latestPack = latestSettings.packs.find((candidate) => candidate.id === pack.id)
            const latestSprite = latestPack ? sameSprite(latestPack, sprite) : null
            if (!latestPack || !latestSprite || latestSprite.url !== sprite.url) {
              throw new Error('立绘在保存期间已变化')
            }
            if (preset) {
              const next = setPresetLocalSprite(latestSettings, pack.id, latestSprite, localized.url)
              if (next === latestSettings) throw new Error('更新预设覆盖失败')
              deps.updateSettings(next)
            } else if (!updateChecked(upsertPack(
              latestSettings,
              upsertSprite(latestPack, { ...latestSprite, url: localized.url, remoteUrl: localized.remoteUrl }),
            ))) {
              throw new Error('更新图包失败')
            }
            localizedCount++
          } catch (error) {
            console.warn('[sprite-overlay] 批量保存本地失败', { packId: pack.id, tag: sprite.tag, error })
            failed++
          }
        }
      }
    } finally {
      batchResourceBusy = false
      render()
      toast(currentManagerBody(), `保存本地完成：成功 ${localizedCount} 张，失败 ${failed} 张${failed > 0 ? '（可再次点击重试）' : ''}`)
    }
  }

  async function copySelectedPackShares(): Promise<void> {
    if (batchResourceBusy) return
    const packs = selectedPacks()
    if (packs.length === 0) {
      toast(currentManagerBody(), '先勾选要复制分享串的图包')
      return
    }
    const encoded = packs
      .map((pack) => ({ pack, result: encodeShareStringV2(pack) }))
      .filter((entry): entry is { pack: SpritePack; result: NonNullable<ReturnType<typeof encodeShareStringV2>> } => entry.result !== null)
    if (encoded.length === 0) {
      toast(currentManagerBody(), '所选图包都没有可分享的远程图片')
      return
    }
    const missingCount = encoded.reduce((count, entry) => count + entry.result.missing.length, 0)
    if (missingCount > 0 && !window.confirm(
      `所选图包中还有 ${missingCount} 张图片没有远程地址，不会进入分享串。仍要复制吗？`,
    )) return
    const text = encoded.map((entry) => entry.result.text).join('\n\n')
    const ok = await copyText(text)
    toast(
      currentManagerBody(),
      ok
        ? `已复制 ${encoded.length} 个图包的分享串${missingCount > 0 ? `，缺少 ${missingCount} 张` : ''}`
        : '复制失败，请手动复制弹出的文本',
    )
    if (!ok) window.prompt('手动复制分享串：', text)
  }

  async function deletePacksWithChoice(packIds: string[], names: string[], preview: string): Promise<void> {
    if (!window.confirm(`确定删除 ${names.length} 个立绘包？\n${preview}\n绑定关系会一并清除。`)) return
    const current = deps.getSettings()
    const localPaths = deletableLocalSpritePaths(current, packIds)
    const deleteLocal = localPaths.length > 0 && window.confirm(
      `检测到 ${localPaths.length} 个仅由这些包使用的本地图片文件。\n` +
      '同时从 SillyTavern 服务器删除它们吗？\n\n选择“取消”将只删除图包记录，文件继续保留。',
    )

    if (!deleteLocal) {
      selectedPackIds.clear()
      view = { kind: 'list' }
      commit(removePacks(current, packIds))
      toast(currentManagerBody(), `已删除 ${names.length} 个立绘包，本地文件未删除`)
      return
    }

    let deleted = 0
    let failed = 0
    for (const path of localPaths) {
      try {
        await deps.adapter.deleteImage(path)
        deleted++
      } catch (error) {
        console.warn('[sprite-overlay] 删除本地图片失败', { path, error })
        failed++
      }
    }
    if (failed > 0) {
      toast(
        currentManagerBody(),
        `本地文件删除成功 ${deleted} 张，失败 ${failed} 张；图包尚未删除，可再次重试`,
      )
      return
    }
    selectedPackIds.clear()
    view = { kind: 'list' }
    commit(removePacks(deps.getSettings(), packIds))
    toast(currentManagerBody(), `已删除 ${names.length} 个立绘包及 ${deleted} 张本地文件`)
  }

  function renderRolePackStack(
    role: string,
    roleKey: string,
    packs: SpritePack[],
    spriteCount: number,
    boundState: (pack: SpritePack) => 'active' | 'off' | null,
    expand: () => void,
  ): HTMLElement {
    const stack = el('button', 'so-role-pack-stack') as HTMLButtonElement
    stack.type = 'button'
    stack.dataset.roleKey = roleKey
    stack.setAttribute('aria-expanded', 'false')
    stack.setAttribute('aria-label', `展开「${role}」的 ${packs.length} 个图包`)
    for (let index = 2; index >= 1; index -= 1) {
      const layer = el('span', `so-role-stack-layer so-role-stack-layer-${index}`)
      layer.setAttribute('aria-hidden', 'true')
      stack.append(layer)
    }

    const face = el('span', 'so-role-stack-face')
    const coverBox = el('span', 'so-role-stack-cover')
    const first = packs[0]
    const cover = first ? getPackCover(first) : null
    if (cover) {
      const image = document.createElement('img')
      image.src = cover.url
      image.alt = ''
      image.loading = 'lazy'
      coverBox.append(image)
    } else {
      coverBox.textContent = '暂无立绘'
    }
    const activeCount = packs.filter((pack) => boundState(pack) === 'active').length
    if (activeCount > 0) {
      const badge = el('span', 'so-card-badge')
      badge.textContent = activeCount === 1 ? '使用中' : `使用中 ${activeCount}`
      coverBox.append(badge)
    }
    const info = el('span', 'so-card-info')
    const title = el('b')
    title.textContent = role
    const detail = el('small')
    detail.textContent = `${packs.length} 个图包 · ${spriteCount} 张`
    const count = el('span', 'so-role-stack-count')
    count.textContent = `${packs.length} 个图包`
    info.append(title, detail)
    face.append(coverBox, count, info)
    stack.append(face)
    stack.addEventListener('click', expand)
    return stack
  }

  function renderPackCard(pack: SpritePack, bound: 'active' | 'off' | null): HTMLElement {
    const card = el('div', 'so-pack-card')
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    card.setAttribute('aria-label', `打开立绘包「${pack.name}」`)
    card.title = '点击进入管理'

    // 封面区：大图 + 角标（使用中 / 预设）
    const coverBox = el('div', 'so-card-cover')
    const cover = getPackCover(pack)
    if (cover) {
      const img = document.createElement('img')
      img.src = cover.url
      img.alt = cover.tag
      img.loading = 'lazy'
      coverBox.append(img)
    } else {
      coverBox.textContent = '暂无立绘'
    }
    if (bound) {
      // 使用中：角标 + 卡片绿色描边双重标识（概念图）
      if (bound === 'active') card.classList.add('so-card-active')
      const badge = el('span', bound === 'active' ? 'so-card-badge' : 'so-card-badge so-card-badge-off')
      badge.textContent = bound === 'active' ? '使用中' : '已停用'
      badge.dataset.corner = 'bottom-left'
      coverBox.append(badge)
    }
    if (isPresetPack(pack.id)) {
      const chip = el('span', 'so-card-chip')
      chip.textContent = '预设'
      coverBox.append(chip)
    }
    const resources = summarizePackResources(pack)
    if (resources.total > 0) {
      const status = el('span', 'so-card-resource-status')
      status.dataset.corner = 'bottom-right'
      const resourceLabel = (kind: 'local' | 'cloud', label: string) => {
        const count = resources[kind]
        if (count === 0) return
        const chip = el('span', `so-card-resource-chip so-card-resource-${kind}`)
        chip.textContent = count === resources.total ? label : `${label} ${count}/${resources.total}`
        status.append(chip)
      }
      resourceLabel('local', '本地')
      resourceLabel('cloud', '云端')
      coverBox.append(status)
    }

    const info = el('div', 'so-card-info')
    const nameEl = el('b')
    nameEl.textContent = pack.name
    const metaEl = el('small')
    metaEl.textContent = `${pack.sprites.length} 张 · ${pack.author ?? '未知作者'}`
    const labels = packLabels(pack)
    const labelRow = el('div', 'so-pack-labels')
    for (const text of [`角色：${labels.role}`, `类型：${labels.type}`, ...labels.custom]) {
      const chip = el('span')
      chip.textContent = text
      labelRow.append(chip)
    }
    info.append(nameEl, metaEl, labelRow)

    card.append(coverBox, info)

    if (batchMode) {
      // 批量管理：点卡片勾选资源操作；删除动作单独过滤只读预设。
      const preset = isPresetPack(pack.id)
      const selected = selectedPackIds.has(pack.id)
      card.classList.add('so-card-batch')
      if (selected) card.classList.add('so-card-selected')
      const check = el('span', `so-card-check${selected ? ' so-card-check-on' : ''}`)
      check.textContent = selected ? '✓' : ''
      check.dataset.corner = 'top-left'
      coverBox.append(check)
      const orderRow = el('div', 'so-row so-card-order')
      orderRow.append(
        iconButton('◀', '前移', () => {
          commit(movePack(deps.getSettings(), pack.id, -1))
        }, 'so-chip-btn'),
        iconButton('▶', '后移', () => {
          commit(movePack(deps.getSettings(), pack.id, 1))
        }, 'so-chip-btn'),
      )
      card.append(orderRow)

      card.title = preset
        ? '点击勾选资源操作；预设包不可删除，可拖拽排序'
        : '点击勾选；可拖拽排序'
      card.setAttribute('aria-label', `选择立绘包「${pack.name}」`)
      const toggleSelect = () => {
        if (selectedPackIds.has(pack.id)) selectedPackIds.delete(pack.id)
        else selectedPackIds.add(pack.id)
        render()
      }
      card.addEventListener('click', toggleSelect)
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          toggleSelect()
        }
      })

      card.draggable = true
      card.dataset.packId = pack.id
      card.addEventListener('dragstart', (e) => {
        e.dataTransfer?.setData('text/plain', pack.id)
        if (e.dataTransfer) e.dataTransfer.effectAllowed = 'move'
        card.classList.add('so-card-dragging')
      })
      card.addEventListener('dragend', () => card.classList.remove('so-card-dragging'))
      card.addEventListener('dragover', (e) => {
        e.preventDefault()
        if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'
        card.classList.add('so-card-drop-target')
      })
      card.addEventListener('dragleave', () => card.classList.remove('so-card-drop-target'))
      card.addEventListener('drop', (e) => {
        e.preventDefault()
        card.classList.remove('so-card-drop-target')
        const fromId = e.dataTransfer?.getData('text/plain')
        if (!fromId || fromId === pack.id) return
        commit(movePackBefore(deps.getSettings(), fromId, pack.id))
      })
      return card
    }

    const enter = () => {
      view = { kind: 'pack', packId: pack.id }
      spriteVisibleCount = SPRITE_PAGE_SIZE
      spriteFilterQuery = ''
      spriteFilterLabels = []
      render()
    }
    card.addEventListener('click', enter)
    card.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        enter()
      }
    })
    return card
  }

  /* ---------------- 详情页 ---------------- */

  function renderPackDetail(body: HTMLElement, actions: HTMLElement, pack: SpritePack): void {
    const readonly = isPresetPack(pack.id)

    // 添加立绘：头部下拉（两种方式——直接上传 / 粘贴编码），不占正文空间
    if (!readonly) {
      actions.append(
        dropdownButton('添加立绘', (panel) => {
          const upHeading = el('div', 'so-popover-title')
          upHeading.textContent = '直接上传'
          const upBtn = button('选择图片（自动压缩+解析预览）', () => {
            closePopovers()
            pickFile('image/*', true, (files) => openUploadPreview(pack.id, files))
          })
          const upHint = el('div', 'so-status')
          upHint.textContent =
            '默认整个文件名作图名、落入当前包；预览里勾选「自动拆分」可按 _ - – — 空格拆「人名/服装/图名」（如 鸣人-居家服-微笑.png）并按前缀拆分成包。'

          const codeHeading = el('div', 'so-popover-title')
          codeHeading.textContent = '按编码添加'
          const codeInput = document.createElement('textarea')
          codeInput.className = 'text_pole'
          codeInput.rows = 3
          codeInput.placeholder = '粘贴编码，可多个（空格/逗号/换行分隔）'
          const codeBtn = button('添加', () => {
            const codes = codeInput.value.split(/[\s,，、;；|]+/).filter(Boolean)
            if (codes.length === 0) {
              toast(body, '请填写图床编码，如 ab12cd.png（可一次粘贴多个）')
              return
            }
            const bad = codes.filter((c) => !isValidImageCode(c))
            if (bad.length > 0) {
              toast(body, `编码格式不对：${bad.slice(0, 3).join('、')}${bad.length > 3 ? ' 等' : ''}`)
              return
            }
            const current = deps.getSettings()
            const target = current.packs.find((p) => p.id === pack.id)
            if (!target) return
            const host = current.imageHost.endsWith('/') ? current.imageHost : `${current.imageHost}/`
            let next = target
            let added = 0
            for (const code of codes) {
              const tag = normalizeTag(code.replace(/\.[^.]+$/, ''))
              if (!tag) continue
              next = upsertSprite(next, { tag, url: host + code, code })
              added++
            }
            commitPack(next)
            toast(body, `已按编码添加 ${added} 张（图名取编码名，可在图卡上改名）`)
          })
          const codeHint = el('div', 'so-status')
          codeHint.textContent = `编码拼接图床前缀 ${deps.getSettings().imageHost} 成直链，图名自动取编码名；改名/分组用图卡上的 ✎ / 🏷。`
          panel.append(upHeading, upBtn, upHint, codeHeading, codeInput, codeBtn, codeHint)
        }),
      )
    }

    // 顶部操作（返回键在固定头部）：导出/分享靠左，删除靠右与其隔开
    const topRow = el('div', 'so-row so-detail-top')
    topRow.append(
      button('导出 JSON', async () => {
        // 本地/预设图片自动内嵌 base64（别人导入才能看到图）；图床 URL 保持轻量
        const file = await exportPack(pack)
        downloadJson(file, `${pack.name}.sprite-pack.json`)
        toast(body, `已导出「${pack.name}」`)
      }),
      button('复制分享串', async () => {
        const result = encodeShareStringV2(pack)
        if (!result) {
          toast(body, '该包没有可分享的远程图片（本地/内嵌图请用「导出 JSON」，或先上传 imgbb）')
          return
        }
        // 完整性预检：残缺时显示 N/M 与缺失项，必须显式确认才复制，绝不静默复制残缺串
        if (result.missing.length > 0) {
          const preview = result.missing.slice(0, 8).join('、')
          const more = result.missing.length > 8 ? ` 等 ${result.missing.length} 项` : ''
          const go = window.confirm(
            `分享串不完整：${result.included}/${result.total} 张有远程地址。\n` +
              `缺少远程地址（不会包含在分享串里）：${preview}${more}\n\n` +
              '这些图片对方将看不到。仍要复制残缺分享串吗？',
          )
          if (!go) return
        }
        const ok = await copyText(result.text)
        const note =
          result.missing.length > 0
            ? `（${result.included}/${result.total} 张，缺 ${result.missing.length} 张）`
            : `（${result.included} 张，完整）`
        toast(body, ok ? `已复制分享串${note}` : '复制失败，请手动复制弹出的文本')
        if (!ok) window.prompt('手动复制分享串：', result.text)
      }),
    )
    const spacer = el('div', 'so-spacer')
    topRow.append(spacer)
    if (!readonly) {
      topRow.append(
        button('删除立绘包', () => {
          void deletePacksWithChoice([pack.id], [pack.name], pack.name)
        }, 'so-btn-danger'),
      )
    }
    body.append(topRow)

    // 包信息：折叠面板（默认收起——顶部留给图墙；展开后输入框均分一行、窄屏自动换行）
    {
      const metaPanel = collapsible('包信息', false, `pack-meta:${pack.id}`)
      const metaRow = el('div', 'so-row so-meta-row')
      const nameInput = textInput('包名')
      nameInput.value = pack.name
      const authorInput = textInput('作者')
      authorInput.value = pack.author ?? ''
      const descInput = textInput('描述（可选）')
      descInput.value = pack.description ?? ''
      const roleInput = textInput('人名（可空）')
      roleInput.value = pack.roleName ?? ''
      const outfitInput = textInput('服装（可空）')
      outfitInput.value = pack.outfit ?? ''
      const promptNoteInput = document.createElement('textarea')
      promptNoteInput.className = 'text_pole so-pack-prompt-note'
      promptNoteInput.placeholder = '图包备注（可选）'
      promptNoteInput.rows = 3
      promptNoteInput.maxLength = MAX_NOTE_CODE_POINTS
      promptNoteInput.value = pack.promptNote ?? ''
      const placementSelect = document.createElement('select')
      placementSelect.className = 'text_pole so-pack-prompt-placement'
      placementSelect.setAttribute('aria-label', '图包备注插入位置')
      for (const [value, label] of [
        ['before-list', '立绘清单前'],
        ['after-list', '立绘清单后'],
      ] as const) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        placementSelect.append(option)
      }
      placementSelect.value = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT

      const outfitNoteDrafts = new Map(Object.entries(pack.outfitNotes ?? {}))
      const outfitNotesBox = el('div', 'so-outfit-note-list')
      const syncOutfitNoteDrafts = (): void => {
        for (const input of outfitNotesBox.querySelectorAll<HTMLTextAreaElement>('.so-outfit-note-input')) {
          outfitNoteDrafts.set(input.dataset.outfit ?? '', input.value)
        }
      }
      const renderOutfitNotes = (): void => {
        syncOutfitNoteDrafts()
        // 备注按服装名寻址，键必须与注入端看到的服装名同源——统一过 normalizeTag，
        // 否则输入框里打的「居家:服」会存成一个永远匹配不上任何场景的死键。
        // 已有备注的键保持原样：让用户还能看见并清掉历史脏数据。
        const outfits = [...new Set([
          normalizeTag(outfitInput.value),
          ...pack.sprites.map((sprite) => normalizeTag(sprite.outfit ?? '')),
          ...outfitNoteDrafts.keys(),
        ].filter(Boolean))]
        outfitNotesBox.replaceChildren()
        if (outfits.length === 0) return

        const title = el('div', 'so-section-title')
        title.textContent = '服装备注'
        outfitNotesBox.append(title)
        for (const outfit of outfits) {
          const input = document.createElement('textarea')
          input.className = 'text_pole so-outfit-note-input'
          input.dataset.outfit = outfit
          input.placeholder = `${outfit}的使用场景（可选）`
          input.rows = 2
          input.maxLength = MAX_NOTE_CODE_POINTS
          input.value = outfitNoteDrafts.get(outfit) ?? ''
          input.addEventListener('input', () => outfitNoteDrafts.set(outfit, input.value))
          const row = labeled(outfit, input)
          row.classList.add('so-outfit-note-row')
          outfitNotesBox.append(row)
        }
      }
      outfitInput.addEventListener('change', renderOutfitNotes)
      renderOutfitNotes()

      const promptRow = el('div', 'so-row so-pack-note-row')
      promptRow.append(
        labeled('图包备注', promptNoteInput),
        labeled('插入位置', placementSelect),
      )
      metaRow.append(
        labeled('包名', nameInput),
        labeled('作者', authorInput),
        labeled('人名', roleInput),
        labeled('服装', outfitInput),
        labeled('描述', descInput),
      )
      // 保存独占一行、主按钮样式：混在输入框里会被挤到换行尾部，窄屏上几乎看不见（用户实测反馈）
      const saveRow = el('div', 'so-row so-meta-save-row')
      saveRow.append(
        button('保存包信息', () => {
          const name = sanitizePackName(nameInput.value)
          if (!name) {
            toast(body, '包名不能为空')
            return
          }
          const roleName = normalizeTag(roleInput.value)
          const outfit = normalizeTag(outfitInput.value)
          const promptNote = normalizeNote(promptNoteInput.value)
          syncOutfitNoteDrafts()
          const outfitNotes = normalizeOutfitNotes(Object.fromEntries(outfitNoteDrafts))
          if (readonly) {
            const current = deps.getSettings()
            const next = setPresetMetadata(current, pack.id, {
              name,
              author: sanitizePackName(authorInput.value) || null,
              description: sanitizeDescription(descInput.value) || null,
              roleName: roleName || null,
              outfit: outfit || null,
              promptNote: promptNote || null,
              promptNotePlacement: promptNote
                ? placementSelect.value === 'after-list' ? 'after-list' : 'before-list'
                : null,
              outfitNotes: Object.keys(outfitNotes).length > 0 ? outfitNotes : null,
            })
            const materialized = next.packs.find((candidate) => candidate.id === pack.id)
            if (!materialized || !checkedSettings(upsertPack(current, materialized))) return
            commit(next)
            toast(body, '已保存包信息')
            return
          }
          const nextPack: SpritePack = {
            ...pack,
            name,
            author: sanitizePackName(authorInput.value) || undefined,
            description: sanitizeDescription(descInput.value) || undefined,
            roleName: roleName || undefined,
            outfit: outfit || undefined,
          }
          if (promptNote) {
            nextPack.promptNote = promptNote
            nextPack.promptNotePlacement = placementSelect.value === 'after-list'
              ? 'after-list'
              : 'before-list'
          } else {
            delete nextPack.promptNote
            delete nextPack.promptNotePlacement
          }
          if (Object.keys(outfitNotes).length > 0) nextPack.outfitNotes = outfitNotes
          else delete nextPack.outfitNotes
          if (commitChecked(upsertPack(deps.getSettings(), nextPack))) {
            toast(body, '已保存包信息')
          }
        }, 'so-btn-primary so-meta-save'),
      )
      if (readonly) {
        saveRow.append(button('恢复内置信息', () => {
          if (!window.confirm('确定恢复扩展内置的包信息吗？已保存的本地图片会保留。')) return
          const current = deps.getSettings()
          const next = clearPresetMetadata(current, pack.id)
          const materialized = next.packs.find((candidate) => candidate.id === pack.id)
          if (!materialized || !checkedSettings(upsertPack(current, materialized))) return
          commit(next)
          toast(body, '已恢复内置信息，本地图片保持不变')
        }))
      }
      const metaHint = el('div', 'so-status')
      metaHint.textContent =
        readonly
          ? '可覆盖预设包信息；立绘图片本身仍不可添加、改名或删除。'
          : '人名/服装用于三级寻址 [立绘:人名/服装/图名]：整包同一角色时填人名，包内立绘用纯图名即可。'
      metaPanel.body.append(metaRow, promptRow, outfitNotesBox, metaHint, saveRow)
      body.append(metaPanel.box)
    }

    // 搜索和标签过滤只改变图库视图，不修改包内容；分页仍按每次 60 张追加。
    if (pack.sprites.length === 0) {
      const empty = el('div', 'so-status')
      empty.textContent = '还没有立绘：点右上角「添加立绘」上传图片或粘贴编码。'
      body.append(empty)
    } else {
      const filters = el('div', 'so-gallery-filters')
      const search = document.createElement('input')
      search.type = 'search'
      search.className = 'text_pole so-gallery-search'
      search.placeholder = '搜索图名、角色、服装或标签'
      search.setAttribute('aria-label', '搜索立绘')
      search.value = spriteFilterQuery
      const labelSelect = document.createElement('select')
      labelSelect.className = 'text_pole so-gallery-label-select'
      labelSelect.setAttribute('aria-label', '添加标签筛选')
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = '按标签筛选…'
      labelSelect.append(placeholder)
      const availableLabels = [...new Set(pack.sprites.flatMap((sprite) => sprite.labels ?? []))]
      for (const label of availableLabels) {
        const option = document.createElement('option')
        option.value = label
        option.textContent = label
        labelSelect.append(option)
      }
      const chips = el('div', 'so-gallery-filter-chips')
      filters.append(search, labelSelect, chips)
      body.append(filters)

      const gallery = el('div', 'so-sprite-gallery')
      const count = el('div', 'so-status so-sprite-count')
      const paging = el('div', 'so-gallery-paging')
      body.append(gallery, count, paging)

      let filteredEntries: Array<{ sprite: Sprite; index: number }> = []
      let sections: string[] = []
      let groups: string[] = []
      const grids = new Map<string, HTMLElement>()

      const ensureGrid = (group: string): HTMLElement => {
        const existing = grids.get(group)
        if (existing) return existing
        const section = el('div', 'so-sprite-section')
        if (groups.length > 0) {
          const head = el('div', 'so-group-head')
          head.textContent = group === '' ? '未分组' : group
          section.append(head)
        }
        const grid = el('div', 'so-sprite-grid')
        section.append(grid)
        const nextGrid = sections
          .slice(sections.indexOf(group) + 1)
          .map((nextGroup) => grids.get(nextGroup))
          .find((candidate) => candidate != null)
        gallery.insertBefore(section, nextGrid?.parentElement ?? null)
        grids.set(group, grid)
        return grid
      }

      const appendSprites = (start: number, end: number): void => {
        const entries = filteredEntries.slice(start, end)
        for (const group of sections) {
          const matching = entries.filter(({ sprite }) => spriteGroup(sprite) === group)
          if (matching.length === 0) continue
          const grid = ensureGrid(group)
          for (const { sprite, index } of matching) {
            grid.append(renderSpriteCell(body, pack, sprite, index, readonly))
          }
        }
      }

      const updatePaging = (): void => {
        const visibleCount = Math.min(spriteVisibleCount, filteredEntries.length)
        count.textContent = `已显示 ${visibleCount}/${filteredEntries.length}`
        paging.replaceChildren()
        if (visibleCount < filteredEntries.length) {
          paging.append(button('加载更多', () => {
            const previousCount = spriteVisibleCount
            spriteVisibleCount = Math.min(filteredEntries.length, previousCount + SPRITE_PAGE_SIZE)
            appendSprites(previousCount, spriteVisibleCount)
            updatePaging()
          }))
        }
      }

      const renderFilteredGallery = (): void => {
        const matches = new Set(filterSprites(pack, {
          query: spriteFilterQuery,
          labels: spriteFilterLabels,
        }))
        filteredEntries = pack.sprites
          .map((sprite, index) => ({ sprite, index }))
          .filter(({ sprite }) => matches.has(sprite))
        groups = [...new Set(filteredEntries.map(({ sprite }) => spriteGroup(sprite)).filter(Boolean))]
        sections = [...groups]
        if (filteredEntries.some(({ sprite }) => spriteGroup(sprite) === '')) sections.push('')
        if (sections.length === 0) sections.push('')
        gallery.replaceChildren()
        grids.clear()
        if (filteredEntries.length === 0) {
          const empty = el('div', 'so-status so-gallery-empty')
          empty.textContent = '没有符合筛选条件的立绘。'
          gallery.append(empty)
        } else {
          appendSprites(0, Math.min(spriteVisibleCount, filteredEntries.length))
        }
        updatePaging()
      }

      const renderChips = (): void => {
        chips.replaceChildren()
        for (const label of spriteFilterLabels) {
          const chip = document.createElement('button')
          chip.type = 'button'
          chip.className = 'so-gallery-filter-chip'
          chip.textContent = `${label} ×`
          chip.title = `移除标签筛选「${label}」`
          chip.addEventListener('click', () => {
            spriteFilterLabels = spriteFilterLabels.filter((current) => current !== label)
            spriteVisibleCount = SPRITE_PAGE_SIZE
            renderChips()
            renderFilteredGallery()
          })
          chips.append(chip)
        }
      }

      search.addEventListener('input', () => {
        spriteFilterQuery = search.value
        spriteVisibleCount = SPRITE_PAGE_SIZE
        renderFilteredGallery()
      })
      labelSelect.addEventListener('change', () => {
        const label = labelSelect.value
        labelSelect.value = ''
        if (!label || spriteFilterLabels.includes(label)) return
        spriteFilterLabels = [...spriteFilterLabels, label]
        spriteVisibleCount = SPRITE_PAGE_SIZE
        renderChips()
        renderFilteredGallery()
      })

      spriteVisibleCount = Math.min(
        Math.max(SPRITE_PAGE_SIZE, spriteVisibleCount),
        pack.sprites.length,
      )
      renderChips()
      renderFilteredGallery()
    }
    // 维护类功能（补传/拆分）低频，排在图墙之后
    if (!readonly) {
      // 待上传图床（失败重试）：本地/内嵌且无有效远程地址的立绘，可批量补传 imgbb
      const pending = pack.sprites.filter(
        (s) => getSpriteSource(s) !== 'hosted' && !(s.remoteUrl && /^https?:\/\//.test(s.remoteUrl)),
      )
      const { imgbbApiKey } = deps.getSettings()
      if (pending.length > 0 && imgbbApiKey.trim()) {
        const upSection = el('div', 'so-section')
        const upTitle = el('div', 'so-section-title')
        upTitle.textContent = '图床补传'
        const upDesc = el('div', 'so-status')
        upDesc.textContent = `${pending.length} 张立绘还没有远程地址（分享时对方看不到）。补传到 imgbb 后本地图仍保留。`
        upSection.append(
          upTitle,
          upDesc,
          button(`补传 ${pending.length} 张到 imgbb（失败可重试）`, () => {
            void retryPendingUploads(body, pack.id)
          }),
        )
        body.append(upSection)
      }
      // 旧分组拆包：包内有 ≥2 个分组时提供「按分组拆成立绘包」
      const splitPreview = previewGroupSplit(pack)
      if (splitPreview.length >= 2) {
        const splitPanel = collapsible('按分组拆成立绘包', false, `pack-split:${pack.id}`)
        const splitDesc = el('div', 'so-status')
        splitDesc.textContent = `检测到 ${splitPreview.length} 个分组：${splitPreview
          .map((s) => `${s.roleName}(${s.count})`)
          .join('、')}。拆分会新建这些包（原包与绑定保留，可稍后自行删除）。`
        splitPanel.body.append(
          splitDesc,
          button('拆分（保留原包）', () => {
            const preview = splitPreview.map((s) => `${s.roleName}：${s.count} 张`).join('\n')
            if (!window.confirm(`将新建以下立绘包（原包保留）：\n${preview}\n\n确认拆分？`)) return
            const newPacks = splitPackByGroup(pack)
            let next = deps.getSettings()
            for (const np of newPacks) {
              const updated = checkedSettings(upsertPack(next, np))
              if (!updated) return
              next = updated
            }
            commit(next)
            toast(body, `已拆出 ${newPacks.length} 个新包（原包「${pack.name}」保留）`)
          }),
        )
        body.append(splitPanel.box)
      }
    }

    body.append(statusBar())
  }

  /** 图片放大查看由视口级控制器承载，避免受管理器滚动容器定位影响。 */
  function openLightbox(packId: string, startIndex: number): void {
    if (!backdrop) return
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId)
    if (!pack || pack.sprites.length === 0) return
    activeLightbox?.controller?.close()
    const state: ActiveLightbox = { controller: null, packId, index: startIndex }
    const controller = openSpriteLightbox({
      pack,
      index: startIndex,
      readonly: isPresetPack(pack.id),
      actions: isPresetPack(pack.id) ? [] : lightboxActions(state),
      onNavigate: (index) => {
        state.index = index
        refreshLightbox()
      },
      onClose: () => {
        if (activeLightbox === state) activeLightbox = null
      },
    })
    state.controller = controller
    activeLightbox = state
  }

  function refreshLightbox(): void {
    const state = activeLightbox
    if (!state?.controller) return
    const pack = deps.getSettings().packs.find((candidate) => candidate.id === state.packId)
    if (!pack || pack.sprites.length === 0) {
      state.controller.close()
      return
    }
    state.index = Math.max(0, Math.min(state.index, pack.sprites.length - 1))
    const actions = isPresetPack(pack.id) ? [] : lightboxActions(state)
    state.controller.update(pack, state.index, actions)
  }

  function commitActionPack(pack: SpritePack): void {
    const result = upsertPack(deps.getSettings(), pack)
    if (!result.ok) throw new Error(`操作未生效，存在地址冲突：${conflictText(result.conflicts)}`)
    deps.updateSettings(result.settings)
  }

  function currentManagerBody(): HTMLElement | null {
    return backdrop?.querySelector('.so-manager-body') as HTMLElement | null
  }

  function runSpriteAction(action: SpriteAction): void {
    const report = (error: unknown) => {
      toast(currentManagerBody(), error instanceof Error ? error.message : '立绘操作失败')
      refreshLightbox()
    }
    try {
      const result = action.run()
      if (result instanceof Promise) void result.catch(report)
    } catch (error) {
      report(error)
    }
  }

  function pickReplacement(
    packId: string,
    getCurrentSprite: () => Sprite | null,
  ): void {
    const selected = getCurrentSprite()
    if (!selected) return
    const identity = {
      tag: selected.tag,
      group: spriteGroup(selected),
      outfit: selected.outfit ?? '',
    }
    const latestTarget = (): { pack: SpritePack; sprite: Sprite } | null => {
      const pack = deps.getSettings().packs.find((candidate) => candidate.id === packId)
      const sprite = pack?.sprites.find((candidate) =>
        candidate.tag === identity.tag &&
        spriteGroup(candidate) === identity.group &&
        (candidate.outfit ?? '') === identity.outfit,
      )
      return pack && sprite ? { pack, sprite } : null
    }

    pickFile('image/*', false, async (files) => {
      try {
        const result = await compressImage(files[0])
        const beforeSave = latestTarget()
        if (!beforeSave) return
        const url = await deps.adapter.saveImage(
          `${beforeSave.sprite.tag}.webp`,
          result.dataUri,
          deps.adapter.getCurrentCharacterName() || beforeSave.pack.name,
        )
        const target = latestTarget()
        if (!target) return
        const base: Sprite = {
          tag: target.sprite.tag,
          url,
          ...(identity.group ? { group: identity.group } : {}),
          ...(identity.outfit ? { outfit: identity.outfit } : {}),
          ...(target.sprite.labels?.length ? { labels: target.sprite.labels } : {}),
        }
        commitPack(upsertSprite(target.pack, base))

        const { autoUpload, imgbbApiKey } = deps.getSettings()
        if (autoUpload && imgbbApiKey.trim()) {
          try {
            const uploaded = await uploadToImgbb(imgbbApiKey, result.dataUri)
            if (isValidImgbbResult(uploaded)) {
              const latest = latestTarget()
              if (latest) {
                commitPack(upsertSprite(latest.pack, {
                  ...base,
                  code: uploaded.code,
                  remoteUrl: uploaded.url,
                }))
                toast(currentManagerBody(), `已替换「${identity.tag}」并重传图床（${formatBytes(result.bytes)}）`)
                return
              }
            }
            toast(currentManagerBody(), `已替换「${identity.tag}」，但图床响应无效，标记为待上传`)
          } catch {
            toast(currentManagerBody(), `已替换「${identity.tag}」，图床上传失败，标记为待上传`)
          }
        } else {
          toast(currentManagerBody(), `已替换「${identity.tag}」（${formatBytes(result.bytes)}），远程地址待上传`)
        }
      } catch (error) {
        toast(currentManagerBody(), error instanceof Error ? error.message : '替换失败')
      } finally {
        refreshLightbox()
      }
    })
  }

  function actionContext(
    packId: string,
    getSprite: (pack: SpritePack) => Sprite | null,
    closeAction: () => void,
  ): SpriteActionContext {
    const getPack = () => deps.getSettings().packs.find((candidate) => candidate.id === packId) ?? null
    const context: SpriteActionContext = {
      getPack,
      getSprite: () => {
        const pack = getPack()
        return pack ? getSprite(pack) : null
      },
      commit: commitActionPack,
      pickReplacement: () => pickReplacement(packId, () => context.getSprite()),
      localize: async (source) => {
        const identity = {
          tag: source.tag,
          group: spriteGroup(source),
          outfit: source.outfit ?? '',
        }
        const localized = await localizeSprite(source, `${source.tag}.webp`, {
          fetch: window.fetch.bind(window),
          compress: compressImage,
          saveImage: (file, fileName) => deps.adapter.saveImageFile(
            file,
            fileName,
            deps.adapter.getCurrentCharacterName() || getPack()?.name || 'shared',
          ),
        })
        const pack = getPack()
        const latest = pack?.sprites.find((candidate) =>
          candidate.tag === identity.tag &&
          spriteGroup(candidate) === identity.group &&
          (candidate.outfit ?? '') === identity.outfit,
        )
        if (!pack || !latest || latest.url !== source.url) {
          throw new Error('立绘在保存期间已发生变化，请重试')
        }
        commitActionPack(upsertSprite(pack, {
          ...latest,
          url: localized.url,
          remoteUrl: localized.remoteUrl,
        }))
        context.refresh()
        toast(currentManagerBody(), `已将「${source.tag}」保存到本地`)
      },
      refresh: () => {
        render()
        refreshLightbox()
      },
      close: closeAction,
    }
    return context
  }

  function lightboxActions(state: ActiveLightbox): SpriteAction[] {
    const context = actionContext(
      state.packId,
      (pack) => pack.sprites[state.index] ?? null,
      () => {
        render()
        state.controller?.close()
      },
    )
    return createSpriteActions(context).map((action) => ({
      ...action,
      run: () => runSpriteAction(action),
    }))
  }

  function renderSpriteCell(
    body: HTMLElement,
    pack: SpritePack,
    sprite: Sprite,
    index: number,
    readonly: boolean,
  ): HTMLElement {
    const cell = el('div', 'so-sprite-cell')
    if (pack.coverTag === sprite.tag) cell.classList.add('so-cover')

    const img = document.createElement('img')
    img.src = sprite.url
    img.alt = sprite.tag
    img.title = sprite.tag
    img.loading = 'lazy'

    const tagEl = el('div', 'so-sprite-tag')
    tagEl.textContent = sprite.tag
    tagEl.title = sprite.tag

    cell.append(img, tagEl)
    // 点击放大查看（操作按钮自带 stopPropagation，互不干扰）
    cell.addEventListener('click', () => openLightbox(pack.id, index))
    if (readonly) return cell

    const bar = el('div', 'so-sprite-actions')
    const identity = {
      tag: sprite.tag,
      group: spriteGroup(sprite),
      outfit: sprite.outfit ?? '',
    }
    const context = actionContext(
      pack.id,
      (latest) => latest.sprites.find((candidate) =>
        candidate.tag === identity.tag &&
        spriteGroup(candidate) === identity.group &&
        (candidate.outfit ?? '') === identity.outfit,
      ) ?? null,
      () => {
        render()
        refreshLightbox()
      },
    )
    const sharedActions = createSpriteActions(context)
    for (const action of sharedActions) {
      bar.append(iconButton(
        action.icon ?? action.label,
        action.label,
        () => runSpriteAction(action),
        'so-icon-btn',
        Boolean(action.disabled),
      ))
    }
    bar.append(
      iconButton('◀', '前移', () => {
        const target = context.getPack()
        if (!target) return
        commitPack(moveSprite(target, index, index - 1))
      }),
      iconButton('▶', '后移', () => {
        const target = context.getPack()
        if (!target) return
        commitPack(moveSprite(target, index, index + 1))
      }),
    )
    cell.append(bar)
    return cell
  }

  /**
   * 批量上传预览弹窗（八期）：解析文件名 → 让用户修正/选择不拆分/选重名策略 → 确认后执行。
   * 上传前必须预览，不静默落库。
   */
  function openUploadPreview(currentPackId: string, files: FileList): void {
    const fileArr = Array.from(files)
    // 每个文件解析出的可编辑条目（人名/服装/图名）
    const parsed = fileArr.map((f) => parseSpriteFileName(f.name))
    // 默认不拆分：整名作图名落当前包；用户勾选后才按前缀拆分（实测：默认拆分对多数人是惊吓）
    let autoSplit = false
    let strategy: ConflictStrategy = 'skip'
    let uploading = false

    const modal = el('div', 'so-upload-modal')
    const panel = el('div', 'so-upload-panel')
    const head = el('div', 'so-upload-head')
    const title = el('b')
    title.textContent = `批量上传预览（${fileArr.length} 张）`
    head.append(title)

    const rows = el('div', 'so-upload-rows')
    const inputs: Array<{ role: HTMLInputElement; outfit: HTMLInputElement; tag: HTMLInputElement }> = []

    function buildRows(): void {
      rows.innerHTML = ''
      inputs.length = 0
      fileArr.forEach((file, i) => {
        const row = el('div', 'so-upload-row')
        const name = el('div', 'so-upload-fname')
        name.textContent = file.name
        name.title = file.name
        const roleIn = textInput('人名')
        const outfitIn = textInput('服装')
        const tagIn = textInput('图名')
        if (autoSplit) {
          roleIn.value = parsed[i].role
          outfitIn.value = parsed[i].outfit
          tagIn.value = parsed[i].tag
        } else {
          // 不自动拆分：整名作图名，落入当前包
          roleIn.value = ''
          outfitIn.value = ''
          tagIn.value = normalizeTag(file.name.replace(/\.[^.]+$/, ''))
        }
        roleIn.disabled = !autoSplit
        outfitIn.disabled = !autoSplit
        inputs.push({ role: roleIn, outfit: outfitIn, tag: tagIn })
        row.append(
          name,
          labeled('人名', roleIn),
          labeled('服装', outfitIn),
          labeled('图名', tagIn),
        )
        rows.append(row)
      })
    }
    buildRows()

    const opts = el('div', 'so-upload-opts')
    opts.append(
      checkboxRow('按文件名前缀自动拆分人名/服装（勾选后在下方预览拆分结果，可拆出新包）', autoSplit, (v) => {
        autoSplit = v
        buildRows()
      }),
    )
    const stratWrap = el('div', 'so-row')
    const stratLabel = el('span')
    stratLabel.textContent = '重名时：'
    const stratSel = document.createElement('select')
    stratSel.className = 'text_pole'
    for (const [val, lab] of [
      ['skip', '跳过（默认）'],
      ['rename', '自动改名'],
      ['overwrite', '覆盖'],
    ] as const) {
      const o = document.createElement('option')
      o.value = val
      o.textContent = lab
      stratSel.append(o)
    }
    stratSel.addEventListener('change', () => (strategy = stratSel.value as ConflictStrategy))
    stratWrap.append(stratLabel, stratSel)
    opts.append(stratWrap)

    const status = el('div', 'so-upload-status')
    const actions = el('div', 'so-row so-upload-actions')
    const confirmBtn = button('开始上传', () => {
      if (uploading) return
      uploading = true
      confirmBtn.setAttribute('aria-disabled', 'true')
      confirmBtn.classList.add('disabled')
      const entries: UploadEntry[] = fileArr.map((file, i) => ({
        fileName: file.name,
        role: autoSplit ? inputs[i].role.value : '',
        outfit: autoSplit ? inputs[i].outfit.value : '',
        tag: inputs[i].tag.value,
      }))
      void applyUploadPlan(currentPackId, fileArr, entries, strategy, status, () => modal.remove()).finally(
        () => {
          uploading = false
          confirmBtn.removeAttribute('aria-disabled')
          confirmBtn.classList.remove('disabled')
        },
      )
    })
    const cancelBtn = button(
      '取消',
      () => {
        if (!uploading) modal.remove()
      },
      'so-btn-danger',
    )
    actions.append(
      confirmBtn,
      cancelBtn,
    )

    // 布局：设置与按钮在上、文件预览列表在下（PC 大面板；用户实测反馈的操作习惯），进度条紧跟按钮
    panel.append(head, opts, actions, status, rows)
    modal.append(panel)
    ;(backdrop ?? document.body).append(modal)
  }

  /** 执行上传计划：压缩 → saveImage 本地保底 → 落入目标包（按需新建）→ 可选 imgbb */
  async function applyUploadPlan(
    currentPackId: string,
    files: File[],
    entries: UploadEntry[],
    strategy: ConflictStrategy,
    status: HTMLElement,
    done: () => void,
  ): Promise<void> {
    const { autoUpload, imgbbApiKey } = deps.getSettings()
    const useImgbb = autoUpload && imgbbApiKey.trim() !== ''

    let added = 0
    let conflicts = 0
    let skipped = 0
    let failed = 0
    let unprocessed = 0
    let hosted = 0
    let hostFailed = 0
    let opaqueImages = 0
    let checkerboardImages = 0
    // 本批新建的包：同 (role|outfit|packName) 复用同一个新 id
    const newPackIds = new Map<string, string>()

    function persisted(targetId: string, sprite: Sprite): boolean {
      return Boolean(
        deps
          .getSettings()
          .packs.find((pack) => pack.id === targetId)
          ?.sprites.some(
            (item) =>
              item.tag === sprite.tag &&
              item.url === sprite.url &&
              item.code === sprite.code &&
              item.remoteUrl === sprite.remoteUrl,
          ),
      )
    }

    function applyUploadSettings(
      result: ConflictCheckedSettingsResult,
      wasPersisted: () => boolean,
    ): boolean {
      if (!result.ok) {
        try {
          showConflicts(result.conflicts)
        } catch (error) {
          console.error('[sprite-overlay] 展示上传冲突失败', error)
        }
        return false
      }
      try {
        deps.updateSettings(result.settings)
      } catch (error) {
        if (!wasPersisted()) throw error
        console.warn('[sprite-overlay] 图片已保存，但后续界面刷新失败', error)
      }
      return true
    }

    try {
      const current = deps.getSettings().packs.find((p) => p.id === currentPackId) ?? null
      const plans = planUploads(entries, deps.getSettings().packs, strategy, current?.name ?? '新包', current)

      for (let i = 0; i < plans.length; i++) {
        const plan = plans[i]
        const file = files[i]
        status.textContent = `处理中 ${i + 1}/${plans.length}：${file.name}`
        if (plan.action === 'skip' || !plan.finalTag) {
          skipped++
          continue
        }
        try {
          const result = await compressImage(file)
          if (result.transparency === 'opaque-checkerboard') checkerboardImages += 1
          else if (result.transparency === 'opaque') opaqueImages += 1
          const url = await deps.adapter.saveImage(
            file.name,
            result.dataUri,
            deps.adapter.getCurrentCharacterName() || plan.targetPackName,
          )

          // 解析/新建目标包
          let targetId = plan.targetPackId
          if (!targetId) {
            const role = plan.entry.role
            const outfit = plan.entry.outfit
            const key = `${role}|${outfit}|${plan.targetPackName}`
            targetId = newPackIds.get(key) ?? null
            if (!targetId) {
              const np: SpritePack = {
                id: genId(),
                name: plan.targetPackName,
                author: '我',
                ...(role ? { roleName: role } : {}),
                ...(outfit ? { outfit } : {}),
                sprites: [],
              }
              if (!applyUploadSettings(upsertPack(deps.getSettings(), np), () =>
                deps.getSettings().packs.some((pack) => pack.id === np.id),
              )) {
                conflicts++
                unprocessed = plans.length - i - 1
                break
              }
              targetId = np.id
              newPackIds.set(key, targetId)
            }
          }

          const target = deps.getSettings().packs.find((p) => p.id === targetId)
          if (!target) {
            failed++
            continue
          }
          // 自动拆分的包用 roleName/outfit，立绘只存图名；不拆分则可能带 group（此处 role 落到包级）
          const sprite: Sprite = { tag: plan.finalTag, url }
          if (!applyUploadSettings(upsertPack(deps.getSettings(), upsertSprite(target, sprite)), () =>
            persisted(targetId, sprite),
          )) {
            conflicts++
            unprocessed = plans.length - i - 1
            break
          }
          added++

          if (useImgbb) {
            try {
              const up = await uploadToImgbb(imgbbApiKey, result.dataUri)
              if (isValidImgbbResult(up)) {
                const latest = deps.getSettings().packs.find((p) => p.id === targetId)
                if (latest) {
                  // 本地 url 作保底 remoteUrl 记远程；显示仍优先本地
                  const hostedSprite: Sprite = { tag: plan.finalTag, url, code: up.code, remoteUrl: up.url }
                  if (applyUploadSettings(upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)), () =>
                    persisted(targetId, hostedSprite),
                  )) hosted++
                  else hostFailed++
                }
              } else {
                hostFailed++
              }
            } catch (err) {
              console.warn('[sprite-overlay] imgbb 上传失败（图片保留本地）', err)
              hostFailed++
            }
          }
        } catch (err) {
          console.error('[sprite-overlay] 上传失败', err)
          failed++
        }
      }
    } catch (error) {
      console.error('[sprite-overlay] 上传批次失败', error)
      failed++
      unprocessed = Math.max(0, files.length - added - conflicts - skipped - failed)
    } finally {
      try {
        done()
      } catch (error) {
        console.error('[sprite-overlay] 关闭上传窗口失败', error)
      }
      try {
        render()
      } catch (error) {
        console.error('[sprite-overlay] 上传后刷新失败', error)
      }
      const parts = [
        `成功 ${added} 张`,
        `冲突 ${conflicts} 张`,
        `失败 ${failed} 张`,
        `未处理 ${unprocessed} 张`,
      ]
      if (skipped > 0) parts.push(`跳过 ${skipped} 张（重名/无效）`)
      if (useImgbb) parts.push(`imgbb 成功 ${hosted}${hostFailed > 0 ? `、失败 ${hostFailed}` : ''}`)
      if (checkerboardImages > 0) {
        parts.push(`警告：${checkerboardImages} 张疑似把棋盘格烤进图片，插件无法安全自动去除`)
      }
      if (opaqueImages > 0) {
        parts.push(`提示：${opaqueImages} 张没有透明像素，作为立绘时会显示完整背景`)
      }
      try {
        toast(backdrop?.querySelector('.so-manager-body') as HTMLElement, parts.join('，'))
      } catch (error) {
        console.error('[sprite-overlay] 展示上传结果失败', error)
      }
    }
  }

  /** 补传待上传立绘到 imgbb（失败重试）：fetch 本地图 → 上传 → 绑 remoteUrl+code，本地 url 保留 */
  async function retryPendingUploads(body: HTMLElement, packId: string): Promise<void> {
    const { imgbbApiKey } = deps.getSettings()
    if (!imgbbApiKey.trim()) {
      toast(body, '请先在「图库」App 配置 imgbb API Key')
      return
    }
    const pack = deps.getSettings().packs.find((p) => p.id === packId)
    if (!pack) return
    const pending = pack.sprites.filter(
      (s) => getSpriteSource(s) !== 'hosted' && !(s.remoteUrl && /^https?:\/\//.test(s.remoteUrl)),
    )
    let ok = 0
    let fail = 0
    for (let i = 0; i < pending.length; i++) {
      const sprite = pending[i]
      toast(body, `补传中 ${i + 1}/${pending.length}：${sprite.tag}`)
      try {
        const dataUri = sprite.url.startsWith('data:') ? sprite.url : await urlToDataUri(sprite.url)
        const up = await uploadToImgbb(imgbbApiKey, dataUri)
        if (!isValidImgbbResult(up)) {
          fail++
          continue
        }
        const latest = deps.getSettings().packs.find((p) => p.id === packId)
        const target = latest?.sprites.find(
          (s) =>
            s.tag === sprite.tag &&
            (s.group ?? '') === (sprite.group ?? '') &&
            (s.outfit ?? '') === (sprite.outfit ?? ''),
        )
        if (!latest || !target) {
          fail++
          continue
        }
        // 保留本地 url 作保底，补上远程 remoteUrl + code
        if (
          !updateChecked(
            upsertPack(
              deps.getSettings(),
              upsertSprite(latest, { ...target, code: up.code, remoteUrl: up.url }),
            ),
          )
        ) return
        ok++
      } catch (err) {
        console.warn('[sprite-overlay] 补传失败', err)
        fail++
      }
    }
    render()
    toast(
      backdrop?.querySelector('.so-manager-body') as HTMLElement,
      `补传完成：成功 ${ok} 张${fail > 0 ? `，失败 ${fail} 张（可再次点击重试）` : ''}`,
    )
  }

  function destroy(): void {
    if (destroyed) return
    destroyed = true
    close()
  }

  return { open, close, destroy, refreshIfOpen }
}

/* ---------------- DOM 工具 ---------------- */

function el(tag: string, className?: string): HTMLElement {
  const node = document.createElement(tag)
  if (className) node.className = className
  return node
}

function textInput(placeholder: string): HTMLInputElement {
  const input = document.createElement('input')
  input.type = 'text'
  input.className = 'text_pole'
  input.placeholder = placeholder
  return input
}

function labeled(label: string, input: HTMLElement): HTMLElement {
  const wrap = el('label', 'so-labeled')
  const span = el('span', 'so-labeled-text')
  span.textContent = label
  wrap.append(span, input)
  return wrap
}

function checkboxRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = el('label', 'so-row checkbox_label')
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  row.append(input, span)
  return row
}

function button(label: string, onClick: () => void, extraClass = ''): HTMLElement {
  const btn = el('div', `menu_button so-btn ${extraClass}`.trim())
  btn.setAttribute('role', 'button')
  btn.tabIndex = 0
  btn.textContent = label
  btn.addEventListener('click', onClick)
  btn.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      onClick()
    }
  })
  return btn
}

function iconButton(
  icon: string,
  title: string,
  onClick: () => void,
  className = 'so-icon-btn',
  disabled = false,
): HTMLElement {
  const btn = el('div', className)
  btn.textContent = icon
  btn.title = title
  btn.setAttribute('role', 'button')
  btn.setAttribute('aria-label', title)
  btn.setAttribute('aria-disabled', String(disabled))
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    if (!disabled) onClick()
  })
  return btn
}

/** 状态提示条（toast 输出目标） */
function statusBar(): HTMLElement {
  return el('div', 'so-status so-toast')
}

function toast(scope: HTMLElement | null, msg: string): void {
  const bar = scope?.querySelector('.so-toast') as HTMLElement | null
  if (!bar) return
  bar.textContent = msg
  setTimeout(() => {
    if (bar.textContent === msg) bar.textContent = ''
  }, 4000)
}

function pickFile(accept: string, multiple: boolean, onPick: (files: FileList) => void): void {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = accept
  input.multiple = multiple
  input.addEventListener('change', () => {
    if (input.files && input.files.length > 0) onPick(input.files)
  })
  input.click()
}

function downloadJson(data: unknown, fileName: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
  a.click()
  URL.revokeObjectURL(url)
}

async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    // 非安全上下文（http 直连 ST）没有 clipboard API，走隐藏 textarea 兜底
    try {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.position = 'fixed'
      ta.style.opacity = '0'
      document.body.append(ta)
      ta.select()
      const ok = document.execCommand('copy')
      ta.remove()
      return ok
    } catch {
      return false
    }
  }
}
