/**
 * 立绘包管理弹窗（ST 端）：从悬浮窗齿轮按钮打开。
 * 两级视图：
 * - 列表页：当前角色绑定、包卡片（封面/统计）、新建、导入（JSON 文件 / 一行分享串）
 * - 详情页：包元数据编辑、立绘网格（改名/替换/删除/设封面/排序）、上传（自动压缩）、
 *   按图床编码批量添加、导出 JSON / 复制分享串
 *
 * 安全：所有用户可控文本（包名/tag/作者）一律 textContent，不进 innerHTML。
 * 预设包只读（加载时由代码清单重建，改了也会丢），仅允许绑定/导出/分享。
 */

import type { PluginSettings, Sprite, SpritePack } from '../../core/types'
import { getPackCover } from '../../core/types'
import {
  bindCharacter,
  genId,
  getGroups,
  moveSprite,
  removePack,
  removeSprite,
  renameSprite,
  setSpriteGroup,
  spriteGroup,
  toggleBinding,
  upsertPack,
  upsertSprite,
} from '../../core/sprite-store'
import { exportPack, importPack } from '../../core/pack-io'
import { decodeShareString, encodeShareString, isValidImageCode } from '../../core/share-code'
import {
  normalizeTag,
  parseUploadName,
  sanitizeDescription,
  sanitizePackName,
} from '../../core/naming'
import { compressImage, formatBytes } from '../../core/image-compress'
import { uploadToImgbb } from '../../core/imgbb'
import { isPresetPack } from '../../core/presets'
import type { STAdapter } from './st-adapter'

export interface ManagerDeps {
  adapter: STAdapter
  getSettings: () => PluginSettings
  updateSettings: (next: PluginSettings) => void
}

export interface ManagerController {
  open(): void
  close(): void
  /** 弹窗打开时刷新内容（角色切换后调用） */
  refreshIfOpen(): void
}

type View = { kind: 'list' } | { kind: 'pack'; packId: string }

export function createSpriteManager(deps: ManagerDeps): ManagerController {
  let backdrop: HTMLElement | null = null
  let view: View = { kind: 'list' }

  function open(): void {
    if (backdrop) {
      render()
      return
    }
    view = { kind: 'list' }
    backdrop = el('div', 'so-manager-backdrop')
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close()
    })
    document.addEventListener('keydown', onEscape)

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
    const closeBtn = el('div', 'menu_button so-manager-close')
    closeBtn.title = '关闭'
    closeBtn.textContent = '✕'
    closeBtn.addEventListener('click', () => close())
    header.append(backBtn, title, closeBtn)

    const body = el('div', 'so-manager-body')
    dialog.append(header, body)
    backdrop.append(dialog)
    document.body.append(backdrop)
    render()
  }

  function onEscape(e: KeyboardEvent): void {
    if (e.key !== 'Escape') return
    if (view.kind === 'pack') {
      view = { kind: 'list' }
      render()
    } else {
      close()
    }
  }

  function close(): void {
    document.removeEventListener('keydown', onEscape)
    backdrop?.remove()
    backdrop = null
  }

  function refreshIfOpen(): void {
    if (backdrop) render()
  }

  function commit(next: PluginSettings): void {
    deps.updateSettings(next)
    render()
  }

  /** 修改单个包并提交 */
  function commitPack(pack: SpritePack): void {
    commit(upsertPack(deps.getSettings(), pack))
  }

  function render(): void {
    if (!backdrop) return
    const backBtn = backdrop.querySelector('.so-manager-back') as HTMLElement
    const title = backdrop.querySelector('.so-manager-title') as HTMLElement
    const body = backdrop.querySelector('.so-manager-body') as HTMLElement
    body.innerHTML = ''

    if (view.kind === 'pack') {
      const packId = view.packId
      const pack = deps.getSettings().packs.find((p) => p.id === packId)
      if (pack) {
        backBtn.style.display = 'inline-flex'
        title.textContent = pack.name
        renderPackDetail(body, pack)
        return
      }
      view = { kind: 'list' }
    }
    backBtn.style.display = 'none'
    title.textContent = '立绘包管理'
    renderList(body)
  }

  /* ---------------- 列表页 ---------------- */

  function renderList(body: HTMLElement): void {
    const settings = deps.getSettings()
    const characterName = deps.adapter.getCurrentCharacterName()
    const binding = settings.bindings.find((b) => b.characterName === characterName)

    // 当前角色绑定
    const bindSection = el('div', 'so-section')
    const bindTitle = el('div', 'so-section-title')
    bindTitle.textContent = characterName ? `当前角色：${characterName}` : '当前角色绑定'
    bindSection.append(bindTitle)
    if (characterName) {
      const bindRow = el('div', 'so-row so-bind-row')
      const select = document.createElement('select')
      select.className = 'text_pole'
      select.setAttribute('aria-label', `为「${characterName}」绑定立绘包`)
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = '选择立绘包…'
      select.append(placeholder)
      for (const p of settings.packs) {
        const opt = document.createElement('option')
        opt.value = p.id
        opt.textContent = `${p.name}（${p.sprites.length} 张）`
        opt.selected = binding?.packId === p.id
        select.append(opt)
      }
      select.addEventListener('change', () => {
        if (!select.value) return
        commit(bindCharacter(deps.getSettings(), characterName, select.value))
      })
      bindRow.append(select)
      if (binding) {
        bindRow.append(
          checkboxRow('启用', binding.enabled, (v) =>
            commit(toggleBinding(deps.getSettings(), characterName, v)),
          ),
        )
      }
      bindSection.append(bindRow)
    } else {
      const tip = el('div', 'so-status')
      tip.textContent = '请先打开一个角色聊天，再回来绑定立绘包。'
      bindSection.append(tip)
    }
    body.append(bindSection)

    // 包封面图墙：立绘包是图片集合，用卡片网格浏览（同 ST 角色列表的卡片墙模式）
    const grid = el('div', 'so-pack-grid')
    for (const pack of settings.packs) {
      const bound = binding?.packId === pack.id ? (binding.enabled ? 'active' : 'off') : null
      grid.append(renderPackCard(pack, bound))
    }
    body.append(grid)

    // 新建 / 导入
    const addSection = el('div', 'so-section')
    const addTitle = el('div', 'so-section-title')
    addTitle.textContent = '新建 / 导入'
    const createRow = el('div', 'so-row')
    const nameInput = textInput('新立绘包名称…')
    nameInput.classList.add('so-grow')
    const createBtn = button('新建立绘包', () => {
      const name = sanitizePackName(nameInput.value)
      if (!name) {
        toast(body, '包名不能为空（| = @ < > 等符号会被剔除）')
        return
      }
      const pack: SpritePack = { id: genId(), name, author: '我', sprites: [] }
      deps.updateSettings(upsertPack(deps.getSettings(), pack))
      view = { kind: 'pack', packId: pack.id }
      render()
    })
    nameInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.isComposing) createBtn.click()
    })
    createRow.append(nameInput, createBtn)

    const importRow = el('div', 'so-row')
    const shareInput = textInput('粘贴 stpack1: 开头的分享串…')
    shareInput.classList.add('so-grow')
    const shareBtn = button('导入分享串', () => {
      if (!shareInput.value.trim()) return
      try {
        const pack = decodeShareString(shareInput.value)
        deps.updateSettings(upsertPack(deps.getSettings(), pack))
        shareInput.value = ''
        view = { kind: 'pack', packId: pack.id }
        render()
      } catch (err) {
        toast(body, err instanceof Error ? err.message : '分享串解析失败')
      }
    })
    importRow.append(
      shareInput,
      shareBtn,
      button('导入 JSON 文件', () => {
        pickFile('.json,application/json', false, async (files) => {
          try {
            const pack = importPack(await files[0].text())
            deps.updateSettings(upsertPack(deps.getSettings(), pack))
            view = { kind: 'pack', packId: pack.id }
            render()
          } catch (err) {
            toast(body, err instanceof Error ? err.message : '导入失败')
          }
        })
      }),
    )
    addSection.append(addTitle, createRow, importRow)
    body.append(addSection)

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

  function renderPackDetail(body: HTMLElement, pack: SpritePack): void {
    const readonly = isPresetPack(pack.id)

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
        const result = encodeShareString(pack)
        if (!result) {
          toast(body, '该包没有图床图片，无法生成分享串（本地/内嵌图请用「导出 JSON」）')
          return
        }
        const ok = await copyText(result.text)
        const skipNote = result.skipped.length > 0 ? `；跳过非图床立绘：${result.skipped.join('、')}` : ''
        toast(body, ok ? `已复制分享串（${result.included} 张）${skipNote}` : '复制失败，请手动复制弹出的文本')
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

    // 元数据编辑
    if (readonly) {
      const note = el('div', 'so-status')
      note.textContent = '预设包随扩展分发、只读；想改动可先「导出 JSON」再导入为自定义包。'
      body.append(note)
    } else {
      const metaSection = el('div', 'so-section')
      const metaTitle = el('div', 'so-section-title')
      metaTitle.textContent = '包信息'
      const metaRow = el('div', 'so-row so-meta-row')
      const nameInput = textInput('包名')
      nameInput.value = pack.name
      const authorInput = textInput('作者')
      authorInput.value = pack.author ?? ''
      const descInput = textInput('描述（可选）')
      descInput.value = pack.description ?? ''
      metaRow.append(
        labeled('包名', nameInput),
        labeled('作者', authorInput),
        labeled('描述', descInput),
        button('保存信息', () => {
          const name = sanitizePackName(nameInput.value)
          if (!name) {
            toast(body, '包名不能为空')
            return
          }
          commitPack({
            ...pack,
            name,
            author: sanitizePackName(authorInput.value) || undefined,
            description: sanitizeDescription(descInput.value) || undefined,
          })
        }),
      )
      metaSection.append(metaTitle, metaRow)
      body.append(metaSection)
    }

    // 立绘网格：有分组则按分组分区展示（功能②），否则单一网格
    if (pack.sprites.length === 0) {
      const empty = el('div', 'so-status')
      empty.textContent = '还没有立绘，用下方按钮上传图片（文件名即表情名）。'
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

    // 添加立绘
    if (!readonly) {
      const addSection = el('div', 'so-section')
      const addTitle = el('div', 'so-section-title')
      addTitle.textContent = '添加立绘'
      addSection.append(addTitle)

      const addRow = el('div', 'so-row')
      const batchGroupInput = textInput('本批分组，可空')
      addRow.append(
        labeled('分组', batchGroupInput),
        button('上传图片（自动压缩）', () => {
          pickFile('image/*', true, (files) =>
            void handleUpload(body, pack.id, files, batchGroupInput.value),
          )
        }),
      )
      const upHint = el('div', 'so-status')
      upHint.textContent =
        '文件名含下划线自动拆分组：鸣人_微笑.png → 分组「鸣人」表情「微笑」；否则用「本批分组」。'
      addSection.append(addRow, upHint)

      const codeRow = el('div', 'so-row so-code-row')
      const tagInput = textInput('表情名，如 微笑')
      const codeInput = textInput('图床编码，如 ab12cd.png')
      const codeGroupInput = textInput('分组，可空')
      codeRow.append(
        labeled('表情', tagInput),
        labeled('编码', codeInput),
        labeled('分组', codeGroupInput),
        button('按编码添加', () => {
          const tag = normalizeTag(tagInput.value)
          const code = codeInput.value.trim()
          if (!tag) {
            toast(body, '表情名不能为空（[ ] / : | = @ 等符号会被剔除）')
            return
          }
          if (!isValidImageCode(code)) {
            toast(body, '编码格式不对：应为图床文件名，如 ab12cd.png')
            return
          }
          const current = deps.getSettings()
          const target = current.packs.find((p) => p.id === pack.id)
          if (!target) return
          const host = current.imageHost.endsWith('/') ? current.imageHost : `${current.imageHost}/`
          const group = normalizeTag(codeGroupInput.value)
          commitPack(upsertSprite(target, { tag, url: host + code, code, ...(group ? { group } : {}) }))
          tagInput.value = ''
          codeInput.value = ''
          codeGroupInput.value = ''
        }),
      )
      const codeHint = el('div', 'so-status')
      codeHint.textContent = `编码将拼接当前图床前缀：${deps.getSettings().imageHost}`
      addSection.append(codeRow, codeHint)
      body.append(addSection)
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
          commitPack(renameSprite(target, sprite.tag, next, spriteGroup(sprite)))
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
          commitPack(setSpriteGroup(target, sprite.tag, cur, next))
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
            commitPack(upsertSprite(target, { tag: sprite.tag, url, ...(g ? { group: g } : {}) }))
            toast(body, `已替换「${sprite.tag}」（${formatBytes(result.bytes)}）`)
          } catch (err) {
            toast(body, err instanceof Error ? err.message : '替换失败')
          }
        })
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
        commitPack(removeSprite(target, sprite.tag, spriteGroup(sprite)))
      }),
    )
    cell.append(bar)
    return cell
  }

  /** 批量上传：压缩 → saveImage 本地保底 → upsertSprite；开了自动上传再异步传 imgbb 绑编号 */
  async function handleUpload(
    body: HTMLElement,
    packId: string,
    files: FileList,
    batchGroup: string,
  ): Promise<void> {
    let added = 0
    let skipped = 0
    let hosted = 0
    let hostFailed = 0
    let savedBytes = ''
    const { autoUpload, imgbbApiKey } = deps.getSettings()
    const useImgbb = autoUpload && imgbbApiKey.trim() !== ''
    for (const file of Array.from(files)) {
      const { group, tag } = parseUploadName(file.name, batchGroup)
      if (!tag) {
        skipped++
        continue
      }
      try {
        const result = await compressImage(file)
        savedBytes = formatBytes(result.bytes)
        const url = await deps.adapter.saveImage(
          file.name,
          result.dataUri,
          deps.adapter.getCurrentCharacterName() || packId,
        )
        const target = deps.getSettings().packs.find((p) => p.id === packId)
        if (!target) return
        const sprite: Sprite = group ? { tag, url, group } : { tag, url }
        deps.updateSettings(upsertPack(deps.getSettings(), upsertSprite(target, sprite)))
        added++
        if (useImgbb) {
          // 本地已保底；imgbb 成功则换成图床直链+编号，失败仅计数不回滚
          try {
            const up = await uploadToImgbb(imgbbApiKey, result.dataUri)
            const latest = deps.getSettings().packs.find((p) => p.id === packId)
            if (latest) {
              const hostedSprite: Sprite = group
                ? { tag, url: up.url, code: up.code, group }
                : { tag, url: up.url, code: up.code }
              deps.updateSettings(upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)))
              hosted++
            }
          } catch (err) {
            console.warn('[sprite-overlay] imgbb 上传失败（图片保留本地）', err)
            hostFailed++
          }
        }
      } catch (err) {
        console.error('[sprite-overlay] 上传失败', err)
        skipped++
      }
    }
    render()
    const note = skipped > 0 ? `，跳过 ${skipped} 张（文件名无效或保存失败）` : ''
    const hostNote = useImgbb
      ? `，imgbb 成功 ${hosted} 张${hostFailed > 0 ? `、失败 ${hostFailed} 张（已保留本地，可稍后手动补编号）` : ''}`
      : ''
    toast(
      backdrop?.querySelector('.so-manager-body') as HTMLElement,
      `已添加 ${added} 张立绘${added === 1 ? `（${savedBytes}）` : ''}${note}${hostNote}`,
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

function iconButton(icon: string, title: string, onClick: () => void): HTMLElement {
  const btn = el('div', 'so-icon-btn')
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
