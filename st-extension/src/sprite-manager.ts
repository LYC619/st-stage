/**
 * 立绘包管理弹窗（ST 端）：从悬浮窗齿轮按钮打开。
 * 两级视图：
 * - 列表页：头部工具栏（启用选择 + 新建/导入下拉浮层）、当前角色启用条（chips 可排序/停用）、
 *   包封面卡片墙（使用中绿框标识）
 * - 详情页：右上角「添加立绘」下拉（直接上传 / 粘贴编码批量添加），包信息折叠面板，
 *   立绘网格（改名/替换/删除/设封面/排序）、导出 JSON / 复制分享串
 *
 * 安全：所有用户可控文本（包名/tag/作者）一律 textContent，不进 innerHTML。
 * 预设包只读（加载时由代码清单重建，改了也会丢），仅允许绑定/导出/分享。
 */

import type { PluginSettings, Sprite, SpritePack } from '../../core/types'
import { formatAddress, getPackCover, getSpriteSource } from '../../core/types'
import {
  type BindingConflict,
  type ConflictCheckedSettingsResult,
  bindPack,
  genId,
  getGroups,
  moveSprite,
  previewBindingAddressChanges,
  removePack,
  removeSprite,
  renameSprite,
  reorderBinding,
  setBinding,
  setSpriteGroup,
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
import type { STAdapter } from './st-adapter'

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
  /** 弹窗打开时刷新内容（角色切换后调用） */
  refreshIfOpen(): void
}

type View = { kind: 'list' } | { kind: 'pack'; packId: string }

export function createSpriteManager(deps: ManagerDeps): ManagerController {
  let backdrop: HTMLElement | null = null
  let view: View = { kind: 'list' }
  let openedFrom: ManagerSource = 'overlay'

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
    openedFrom = source
    if (backdrop) {
      render()
      return
    }
    view = { kind: 'list' }
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
    // 先关下拉浮层，再谈返回/关闭
    if (backdrop?.querySelector('.so-popover')) {
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
    document.removeEventListener('keydown', onEscape)
    window.removeEventListener('resize', applyBackdropSize)
    backdrop.remove()
    backdrop = null
    deps.onClosed?.(openedFrom)
  }

  function refreshIfOpen(): void {
    if (backdrop) render()
  }

  function commit(next: PluginSettings): void {
    deps.updateSettings(next)
    render()
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

  /** 折叠面板：图墙占主位，次要功能区默认收起只露标题（用户实测反馈） */
  function collapsible(titleText: string, open = false): { box: HTMLElement; body: HTMLElement } {
    const box = document.createElement('details')
    box.className = 'so-section so-collapse'
    box.open = open
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

    // 头部操作区：启用选择 + 新建/导入下拉（替代旧的底部折叠面板）
    if (characterName) {
      const select = document.createElement('select')
      select.className = 'text_pole so-header-select'
      select.setAttribute('aria-label', `为「${characterName}」添加启用立绘包`)
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = boundIds.length > 0 ? '再启用一个包…' : '选择要启用的包…'
      select.append(placeholder)
      for (const p of settings.packs) {
        if (boundIds.includes(p.id)) continue
        const opt = document.createElement('option')
        opt.value = p.id
        opt.textContent = `${p.name}（${p.sprites.length} 张）`
        select.append(opt)
      }
      select.addEventListener('change', () => {
        const packId = select.value
        if (!packId) return
        select.value = ''
        bindPackWithChoices(characterName, packId, body)
      })
      actions.append(select)
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
    const grid = el('div', 'so-pack-grid')
    for (const pack of settings.packs) {
      const bound = boundIds.includes(pack.id) ? (binding?.enabled ? 'active' : 'off') : null
      grid.append(renderPackCard(pack, bound))
    }
    body.append(grid)

    body.append(statusBar())
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
      coverBox.append(badge)
    }
    if (isPresetPack(pack.id)) {
      const chip = el('span', 'so-card-chip')
      chip.textContent = '预设'
      coverBox.append(chip)
    }

    const info = el('div', 'so-card-info')
    const nameEl = el('b')
    nameEl.textContent = pack.name
    const metaEl = el('small')
    metaEl.textContent = `${pack.sprites.length} 张 · ${pack.author ?? '未知作者'}`
    info.append(nameEl, metaEl)

    card.append(coverBox, info)
    const enter = () => {
      view = { kind: 'pack', packId: pack.id }
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
            '文件名按 _ - – — 空格拆「人名/服装/图名」（如 鸣人-居家服-微笑.png），上传前可预览修正。'

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
          if (!window.confirm(`确定删除立绘包「${pack.name}」？绑定关系会一并清除。`)) return
          view = { kind: 'list' }
          commit(removePack(deps.getSettings(), pack.id))
        }, 'so-btn-danger'),
      )
    }
    body.append(topRow)

    // 包信息：折叠面板（默认收起——顶部留给图墙；展开后输入框均分一行、窄屏自动换行）
    if (readonly) {
      const note = el('div', 'so-status')
      note.textContent = '预设包随扩展分发、只读；想改动可先「导出 JSON」再导入为自定义包。'
      body.append(note)
    } else {
      const metaPanel = collapsible('包信息')
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
      metaRow.append(
        labeled('包名', nameInput),
        labeled('作者', authorInput),
        labeled('人名', roleInput),
        labeled('服装', outfitInput),
        labeled('描述', descInput),
        button('保存', () => {
          const name = sanitizePackName(nameInput.value)
          if (!name) {
            toast(body, '包名不能为空')
            return
          }
          const roleName = normalizeTag(roleInput.value)
          const outfit = normalizeTag(outfitInput.value)
          commitPack({
            ...pack,
            name,
            author: sanitizePackName(authorInput.value) || undefined,
            description: sanitizeDescription(descInput.value) || undefined,
            roleName: roleName || undefined,
            outfit: outfit || undefined,
          })
        }),
      )
      const metaHint = el('div', 'so-status')
      metaHint.textContent =
        '人名/服装用于三级寻址 [立绘:人名/服装/图名]：整包同一角色时填人名，包内立绘用纯图名即可。'
      metaPanel.body.append(metaRow, metaHint)
      body.append(metaPanel.box)
    }

    // 立绘网格：有分组则按分组分区展示（功能②），否则单一网格
    if (pack.sprites.length === 0) {
      const empty = el('div', 'so-status')
      empty.textContent = '还没有立绘：点右上角「添加立绘」上传图片或粘贴编码。'
      body.append(empty)
    } else {
      const groups = getGroups(pack)
      const sections: string[] = groups.length === 0 ? [''] : [...groups]
      if (groups.length > 0 && pack.sprites.some((s) => spriteGroup(s) === '')) sections.push('')
      for (const g of sections) {
        if (groups.length > 0) {
          const head = el('div', 'so-group-head')
          head.textContent = g === '' ? '未分组' : g
          body.append(head)
        }
        const grid = el('div', 'so-sprite-grid')
        pack.sprites.forEach((sprite, index) => {
          if (spriteGroup(sprite) === g) {
            grid.append(renderSpriteCell(body, pack, sprite, index, readonly))
          }
        })
        body.append(grid)
      }
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
        const splitPanel = collapsible('按分组拆成立绘包')
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
    if (readonly) return cell

    const latestPack = () => deps.getSettings().packs.find((p) => p.id === pack.id)

    const bar = el('div', 'so-sprite-actions')
    bar.append(
      iconButton('✎', '重命名', () => {
        const next = window.prompt(`「${sprite.tag}」改名为：`, sprite.tag)
        if (next === null) return
        const target = latestPack()
        if (!target) return
        try {
          commitPack(renameSprite(target, sprite.tag, next, spriteGroup(sprite), sprite.outfit ?? ''))
        } catch (err) {
          toast(body, err instanceof Error ? err.message : '改名失败')
        }
      }),
      iconButton('🏷', '设分组', () => {
        const cur = spriteGroup(sprite)
        const next = window.prompt(`「${sprite.tag}」的分组（留空=移出分组）：`, cur)
        if (next === null) return
        const target = latestPack()
        if (!target) return
        try {
          commitPack(setSpriteGroup(target, sprite.tag, cur, next, sprite.outfit ?? ''))
        } catch (err) {
          toast(body, err instanceof Error ? err.message : '改分组失败')
        }
      }),
      iconButton('🖼', '替换图片', () => {
        pickFile('image/*', false, async (files) => {
          try {
            const result = await compressImage(files[0])
            const url = await deps.adapter.saveImage(
              `${sprite.tag}.webp`,
              result.dataUri,
              deps.adapter.getCurrentCharacterName() || pack.name,
            )
            const target = latestPack()
            if (!target) return
            const g = spriteGroup(sprite)
            const o = sprite.outfit
            // 替换图片：旧远程地址已失效，先只保留新本地 url（去掉旧 code/remoteUrl）
            const base: Sprite = {
              tag: sprite.tag,
              url,
              ...(g ? { group: g } : {}),
              ...(o ? { outfit: o } : {}),
            }
            commitPack(upsertSprite(target, base))

            // 按自动上传设置决定：开了就重新上传 imgbb 绑新远程，否则留待上传（无 remoteUrl）
            const { autoUpload, imgbbApiKey } = deps.getSettings()
            if (autoUpload && imgbbApiKey.trim()) {
              try {
                const up = await uploadToImgbb(imgbbApiKey, result.dataUri)
                if (isValidImgbbResult(up)) {
                  const latest = latestPack()
                  if (latest) {
                    commitPack(
                      upsertSprite(latest, { ...base, code: up.code, remoteUrl: up.url }),
                    )
                    toast(body, `已替换「${sprite.tag}」并重传图床（${formatBytes(result.bytes)}）`)
                    return
                  }
                }
                toast(body, `已替换「${sprite.tag}」，但图床响应无效，标记为待上传`)
              } catch {
                toast(body, `已替换「${sprite.tag}」，图床上传失败，标记为待上传`)
              }
            } else {
              toast(body, `已替换「${sprite.tag}」（${formatBytes(result.bytes)}），远程地址待上传`)
            }
          } catch (err) {
            toast(body, err instanceof Error ? err.message : '替换失败')
          }
        })
      }),
      iconButton('🔗', '远程地址', () => {
        // 图床图的 url 本身就是远程地址（按编码添加）；本地保底图的远程副本在 remoteUrl
        const remote = sprite.remoteUrl || (getSpriteSource(sprite) === 'hosted' ? sprite.url : '')
        if (!remote) {
          toast(body, `「${sprite.tag}」还没有远程地址（未上传图床，分享时对方看不到）`)
          return
        }
        window.prompt(`「${sprite.tag}」编号：${sprite.code || '无'}\n远程地址（Ctrl+C 复制）：`, remote)
      }),
      iconButton('★', '设为封面', () => {
        const target = latestPack()
        if (!target) return
        commitPack({ ...target, coverTag: sprite.tag })
      }),
      iconButton('◀', '前移', () => {
        const target = latestPack()
        if (!target) return
        commitPack(moveSprite(target, index, index - 1))
      }),
      iconButton('▶', '后移', () => {
        const target = latestPack()
        if (!target) return
        commitPack(moveSprite(target, index, index + 1))
      }),
      iconButton('✕', '删除', () => {
        if (!window.confirm(`删除立绘「${sprite.tag}」？`)) return
        const target = latestPack()
        if (!target) return
        commitPack(removeSprite(target, sprite.tag, spriteGroup(sprite), sprite.outfit ?? ''))
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
    let autoSplit = true
    let strategy: ConflictStrategy = 'skip'

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
      checkboxRow('自动拆分人名/服装（关闭则整名作图名落当前包）', autoSplit, (v) => {
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
      const entries: UploadEntry[] = fileArr.map((file, i) => ({
        fileName: file.name,
        role: autoSplit ? inputs[i].role.value : '',
        outfit: autoSplit ? inputs[i].outfit.value : '',
        tag: inputs[i].tag.value,
      }))
      void applyUploadPlan(currentPackId, fileArr, entries, strategy, status, () => modal.remove())
    })
    actions.append(
      confirmBtn,
      button('取消', () => modal.remove(), 'so-btn-danger'),
    )

    panel.append(head, rows, opts, status, actions)
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
    const current = deps.getSettings().packs.find((p) => p.id === currentPackId) ?? null
    const plans = planUploads(entries, deps.getSettings().packs, strategy, current?.name ?? '新包', current)
    const { autoUpload, imgbbApiKey } = deps.getSettings()
    const useImgbb = autoUpload && imgbbApiKey.trim() !== ''

    let added = 0
    let skipped = 0
    let failed = 0
    let hosted = 0
    let hostFailed = 0
    // 本批新建的包：同 (role|outfit|packName) 复用同一个新 id
    const newPackIds = new Map<string, string>()

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
            if (!updateChecked(upsertPack(deps.getSettings(), np))) return
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
        if (!updateChecked(upsertPack(deps.getSettings(), upsertSprite(target, sprite)))) return
        added++

        if (useImgbb) {
          try {
            const up = await uploadToImgbb(imgbbApiKey, result.dataUri)
            if (isValidImgbbResult(up)) {
              const latest = deps.getSettings().packs.find((p) => p.id === targetId)
              if (latest) {
                // 本地 url 作保底 remoteUrl 记远程；显示仍优先本地
                const hostedSprite: Sprite = { tag: plan.finalTag, url, code: up.code, remoteUrl: up.url }
                if (!updateChecked(upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)))) return
                hosted++
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

    done()
    render()
    const parts = [`已添加 ${added} 张`]
    if (skipped > 0) parts.push(`跳过 ${skipped} 张（重名/无效）`)
    if (failed > 0) parts.push(`失败 ${failed} 张`)
    if (useImgbb) parts.push(`imgbb 成功 ${hosted}${hostFailed > 0 ? `、失败 ${hostFailed}` : ''}`)
    toast(backdrop?.querySelector('.so-manager-body') as HTMLElement, parts.join('，'))
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

  return { open, close, refreshIfOpen }
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

function iconButton(icon: string, title: string, onClick: () => void, className = 'so-icon-btn'): HTMLElement {
  const btn = el('div', className)
  btn.textContent = icon
  btn.title = title
  btn.setAttribute('role', 'button')
  btn.setAttribute('aria-label', title)
  btn.addEventListener('click', (e) => {
    e.stopPropagation()
    onClick()
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
