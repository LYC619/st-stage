import type { SpritePack, Sprite } from '../../../core/types'
import { isPresetPack } from '../../../core/presets'
import { t } from '../../../core/i18n'
import { parseImageCodeEntries, encodeShareStringV2 } from '../../../core/share-code'
import { normalizeTag, sanitizePackName, sanitizeDescription } from '../../../core/naming'
import { upsertSprite, upsertPack, spriteGroup } from '../../../core/sprite-store'
import { exportPack } from '../../../core/pack-io'
import { MAX_NOTE_CODE_POINTS, MAX_INVENTORY_PROMPT_CODE_POINTS, normalizeNote, normalizeInventoryPrompt, normalizeOutfitNotes, filterSprites } from '../../../core/sprite-metadata'
import { DEFAULT_PROMPT_NOTE_PLACEMENT, getSpriteSource } from '../../../core/types'
import { setPresetMetadata, clearPresetMetadata } from '../../../core/preset-overrides'
import { previewGroupSplit, splitPackByGroup } from '../../../core/pack-split'
import { el, button, pickFile, toast, downloadJson, copyText, textInput, labeled, statusBar } from './ui'
import type { ManagerContext } from './types'
import { SPRITE_PAGE_SIZE } from './types'

export function createDetail(ctx: ManagerContext) {
  const { deps } = ctx


  /* ---------------- 详情页 ---------------- */

  function renderPackDetail(body: HTMLElement, actions: HTMLElement, pack: SpritePack): void {
    const readonly = isPresetPack(pack.id)

    // 添加立绘：头部下拉（两种方式——直接上传 / 粘贴编码），不占正文空间
    if (!readonly) {
      actions.append(
        ctx.actions.dropdownButton(t("sprite.manager.content.add.title", "添加立绘"), (panel) => {
          const upHeading = el('div', 'so-popover-title')
          upHeading.textContent = t("sprite.manager.content.add.upload_title", "直接上传")
          const upBtn = button(t("sprite.manager.content.add.choose_images", "选择图片（自动压缩+解析预览）"), () => {
            const opener = ctx.state.popoverOpener
            ctx.actions.closePopovers()
            pickFile('image/*', true, (files) => ctx.actions.openUploadPreview(pack.id, files, opener))
          })
          const upHint = el('div', 'so-status')
          upHint.textContent =
            t("sprite.manager.content.add.upload_hint", "默认整个文件名作图名、落入当前包；预览里勾选「自动拆分」可按 _ - – — 空格拆「人名/服装/图名」（如 鸣人-居家服-微笑.png）并按前缀拆分成包。")

          const codeHeading = el('div', 'so-popover-title')
          codeHeading.textContent = t("sprite.manager.content.add.codes_title", "按编码添加")
          const codeInput = document.createElement('textarea')
          codeInput.className = 'text_pole'
          codeInput.rows = 3
          codeInput.placeholder = t("sprite.manager.content.add.codes_placeholder", "粘贴编码，或「图名 编码」，可多个（空格/逗号/换行分隔）")
          const codeBtn = button(t("sprite.manager.content.add.button", "添加"), () => {
            const { entries, invalid } = parseImageCodeEntries(codeInput.value)
            if (entries.length === 0 && invalid.length === 0) {
              toast(body, t("sprite.manager.content.add.enter_code", "请填写图床编码，如 ab12cd.png，或「微笑 ab12cd.png」（可一次粘贴多个）"))
              return
            }
            if (invalid.length > 0) {
              toast(body, t("sprite.manager.content.add.invalid_codes", "认不出编码：{{p0}}{{p1}}", { p0: invalid.slice(0, 3).join('、'), p1: invalid.length > 3 ? t("sprite.manager.content.add.more", " 等") : '' }))
              return
            }
            const current = deps.getSettings()
            const target = current.packs.find((p) => p.id === pack.id)
            if (!target) return
            const host = current.imageHost.endsWith('/') ? current.imageHost : `${current.imageHost}/`
            let next = target
            let added = 0
            let named = 0
            for (const entry of entries) {
              // 给了图名就用图名，没给才回退到编码名（编码通常是随机串，当图名没有意义）
              const fromName = entry.tag ? normalizeTag(entry.tag) : ''
              const tag = fromName || normalizeTag(entry.code.replace(/\.[^.]+$/, ''))
              if (!tag) continue
              if (fromName) named++
              next = upsertSprite(next, { tag, url: host + entry.code, code: entry.code })
              added++
            }
            ctx.actions.commitPack(next)
            toast(
              body,
              named > 0
                ? t("sprite.manager.content.add.named_result", "已添加 {{p0}} 张，其中 {{p1}} 张用了你给的图名", { p0: added, p1: named })
                : t("sprite.manager.content.add.code_result", "已按编码添加 {{p0}} 张（图名取编码名，可在图卡上改名）", { p0: added }),
            )
          })
          const codeHint = el('div', 'so-status')
          codeHint.textContent =
            t("sprite.manager.content.add.code_prefix", "编码拼接图床前缀 {{p0}} 成直链。", { p0: deps.getSettings().imageHost })
            + t("sprite.manager.content.add.code_named_hint", "写「微笑 ab12cd.png」就用「微笑」当图名，连写「微笑ab12cd.png」也认；")
            + t("sprite.manager.content.add.code_rename_hint", "只给编码时图名取编码名。改名/分组用图卡上的 ✎ / 🏷。")
          panel.append(upHeading, upBtn, upHint, codeHeading, codeInput, codeBtn, codeHint)
        }),
      )
    }

    // 顶部操作（返回键在固定头部）：导出/分享靠左，删除靠右与其隔开
    const topRow = el('div', 'so-row so-detail-top')
    topRow.append(
      button(t("sprite.manager.content.export.json", "导出 JSON"), async () => {
        // 本地/预设图片自动内嵌 base64（别人导入才能看到图）；图床 URL 保持轻量
        const file = await exportPack(pack)
        downloadJson(file, `${pack.name}.sprite-pack.json`)
        toast(body, t("sprite.manager.content.export.saved", "已导出「{{p0}}」", { p0: pack.name }))
      }),
      button(t("sprite.manager.content.share.copy", "复制分享串"), async () => {
        const result = encodeShareStringV2(pack)
        if (!result) {
          toast(body, t("sprite.manager.content.share.pack_no_remote", "该包没有可分享的远程图片（本地/内嵌图请用「导出 JSON」，或先上传 imgbb）"))
          return
        }
        // 完整性预检：残缺时显示 N/M 与缺失项，必须显式确认才复制，绝不静默复制残缺串
        if (result.missing.length > 0) {
          const preview = result.missing.slice(0, 8).join('、')
          const more = result.missing.length > 8 ? t("sprite.manager.content.share.more_items", " 等 {{p0}} 项", { p0: result.missing.length }) : ''
          const go = window.confirm(
            t("sprite.manager.content.share.incomplete", "分享串不完整：{{p0}}/{{p1}} 张有远程地址。\n", { p0: result.included, p1: result.total }) +
              t("sprite.manager.content.share.missing_list", "缺少远程地址（不会包含在分享串里）：{{p0}}{{p1}}\n\n", { p0: preview, p1: more }) +
              t("sprite.manager.content.share.confirm_incomplete", "这些图片对方将看不到。仍要复制残缺分享串吗？"),
          )
          if (!go) return
        }
        const ok = await copyText(result.text)
        const note =
          result.missing.length > 0
            ? t("sprite.manager.content.share.partial_count", "（{{p0}}/{{p1}} 张，缺 {{p2}} 张）", { p0: result.included, p1: result.total, p2: result.missing.length })
            : t("sprite.manager.content.share.complete_count", "（{{p0}} 张，完整）", { p0: result.included })
        toast(body, ok ? t("sprite.manager.content.share.copied", "已复制分享串{{p0}}", { p0: note }) : t("sprite.manager.content.share.copy_failed", "复制失败，请手动复制弹出的文本"))
        if (!ok) window.prompt(t("sprite.manager.content.share.copy_prompt", "手动复制分享串："), result.text)
      }),
    )
    const spacer = el('div', 'so-spacer')
    topRow.append(spacer)
    if (!readonly) {
      topRow.append(
        button(t("sprite.manager.content.delete.pack", "删除立绘包"), () => {
          void ctx.actions.deletePacksWithChoice([pack.id], [pack.name], pack.name)
        }, 'so-btn-danger'),
      )
    }
    body.append(topRow)

    // 包信息：折叠面板（默认收起——顶部留给图墙；展开后输入框均分一行、窄屏自动换行）
    {
      const metaPanel = ctx.actions.collapsible(t("sprite.manager.content.info.title", "包信息"), false, `pack-meta:${pack.id}`)
      const metaRow = el('div', 'so-row so-meta-row')
      const nameInput = textInput(t("sprite.manager.content.info.name", "包名"))
      nameInput.value = pack.name
      const authorInput = textInput(t("sprite.manager.content.info.author", "作者"))
      authorInput.value = pack.author ?? ''
      const descInput = textInput(t("sprite.manager.content.info.description_placeholder", "描述（可选）"))
      descInput.value = pack.description ?? ''
      const roleInput = textInput(t("sprite.manager.content.info.role_placeholder", "人名（可空）"))
      roleInput.value = pack.roleName ?? ''
      const outfitInput = textInput(t("sprite.manager.content.info.outfit_placeholder", "服装（可空）"))
      outfitInput.value = pack.outfit ?? ''
      const promptNoteInput = document.createElement('textarea')
      promptNoteInput.className = 'text_pole so-pack-prompt-note'
      promptNoteInput.placeholder = t("sprite.manager.content.info.note_placeholder", "图包备注（可选）")
      promptNoteInput.rows = 3
      promptNoteInput.maxLength = MAX_NOTE_CODE_POINTS
      promptNoteInput.value = pack.promptNote ?? ''
      const placementSelect = document.createElement('select')
      placementSelect.className = 'text_pole so-pack-prompt-placement'
      placementSelect.setAttribute('aria-label', t("sprite.manager.content.info.note_placement", "图包备注插入位置"))
      for (const [value, label] of [
        ['before-list', t("sprite.manager.content.info.before_list", "立绘清单前")],
        ['after-list', t("sprite.manager.content.info.after_list", "立绘清单后")],
      ] as const) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        placementSelect.append(option)
      }
      placementSelect.value = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT

      const inventoryPromptInput = document.createElement('textarea')
      inventoryPromptInput.className = 'text_pole so-pack-inventory-prompt'
      inventoryPromptInput.placeholder = t("sprite.manager.content.info.inventory_placeholder", "自定义清单提示词（可选，替换默认的表情列表）")
      inventoryPromptInput.rows = 4
      inventoryPromptInput.maxLength = MAX_INVENTORY_PROMPT_CODE_POINTS
      inventoryPromptInput.value = pack.inventoryPrompt ?? ''

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
        title.textContent = t("sprite.manager.content.info.outfit_notes", "服装备注")
        outfitNotesBox.append(title)
        for (const outfit of outfits) {
          const input = document.createElement('textarea')
          input.className = 'text_pole so-outfit-note-input'
          input.dataset.outfit = outfit
          input.placeholder = t("sprite.manager.content.info.outfit_note_placeholder", "{{p0}}的使用场景（可选）", { p0: outfit })
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
        labeled(t("sprite.manager.content.info.note", "图包备注"), promptNoteInput),
        labeled(t("sprite.manager.content.info.placement", "插入位置"), placementSelect),
      )

      const inventoryRow = el('div', 'so-row so-pack-inventory-row')
      const inventoryHint = el('div', 'so-status so-pack-inventory-hint')
      inventoryHint.textContent =
        t("sprite.manager.content.info.inventory_hint", "填了就用它替换这个包在清单里的表情列表；留空走默认列表。")
        + t("sprite.manager.content.info.multiple_packs_hint", "多个包同场景时两段都会出现，不会互相覆盖。")
      const inventoryCell = labeled(t("sprite.manager.content.info.inventory", "自定义清单提示词"), inventoryPromptInput)
      inventoryCell.append(inventoryHint)
      inventoryRow.append(inventoryCell)
      metaRow.append(
        labeled(t("sprite.manager.content.info.name", "包名"), nameInput),
        labeled(t("sprite.manager.content.info.author", "作者"), authorInput),
        labeled(t("sprite.manager.content.info.role", "人名"), roleInput),
        labeled(t("sprite.manager.content.info.outfit", "服装"), outfitInput),
        labeled(t("sprite.manager.content.info.description", "描述"), descInput),
      )
      // 保存独占一行、主按钮样式：混在输入框里会被挤到换行尾部，窄屏上几乎看不见（用户实测反馈）
      const saveRow = el('div', 'so-row so-meta-save-row')
      saveRow.append(
        button(t("sprite.manager.content.info.save", "保存包信息"), () => {
          const name = sanitizePackName(nameInput.value)
          if (!name) {
            toast(body, t("sprite.manager.content.info.empty_name", "包名不能为空"))
            return
          }
          const roleName = normalizeTag(roleInput.value)
          const outfit = normalizeTag(outfitInput.value)
          const promptNote = normalizeNote(promptNoteInput.value)
          const inventoryPrompt = normalizeInventoryPrompt(inventoryPromptInput.value)
          syncOutfitNoteDrafts()
          const outfitNotes = normalizeOutfitNotes(Object.fromEntries(outfitNoteDrafts))
          if (readonly) {
            const current = deps.getSettings()
            const metadata: Parameters<typeof setPresetMetadata>[2] = {
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
            }
            metadata.inventoryPrompt = inventoryPrompt || null
            const next = setPresetMetadata(current, pack.id, metadata)
            const materialized = next.packs.find((candidate) => candidate.id === pack.id)
            if (!materialized || !ctx.actions.checkedSettings(upsertPack(current, materialized))) return
            ctx.actions.commit(next)
            toast(body, t("sprite.manager.content.info.saved", "已保存包信息"))
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
          if (inventoryPrompt) nextPack.inventoryPrompt = inventoryPrompt
          else delete nextPack.inventoryPrompt
          if (Object.keys(outfitNotes).length > 0) nextPack.outfitNotes = outfitNotes
          else delete nextPack.outfitNotes
          if (ctx.actions.commitChecked(upsertPack(deps.getSettings(), nextPack))) {
            toast(body, t("sprite.manager.content.info.saved", "已保存包信息"))
          }
        }, 'so-btn-primary so-meta-save'),
      )
      if (readonly) {
        saveRow.append(button(t("sprite.manager.content.info.restore", "恢复内置信息"), () => {
          if (!window.confirm(t("sprite.manager.content.info.confirm_restore", "确定恢复扩展内置的包信息吗？已保存的本地图片会保留。"))) return
          const current = deps.getSettings()
          const next = clearPresetMetadata(current, pack.id)
          const materialized = next.packs.find((candidate) => candidate.id === pack.id)
          if (!materialized || !ctx.actions.checkedSettings(upsertPack(current, materialized))) return
          ctx.actions.commit(next)
          toast(body, t("sprite.manager.content.info.restored", "已恢复内置信息，本地图片保持不变"))
        }))
      }
      const metaHint = el('div', 'so-status')
      metaHint.textContent =
        readonly
          ? t("sprite.manager.content.info.preset_hint", "可覆盖预设包信息；立绘图片本身仍不可添加、改名或删除。")
          : t("sprite.manager.content.info.address_hint", "人名/服装用于三级寻址 [立绘:人名/服装/图名]：整包同一角色时填人名，包内立绘用纯图名即可。")
      metaPanel.body.append(metaRow, promptRow, inventoryRow, outfitNotesBox, metaHint, saveRow)
      body.append(metaPanel.box)
    }

    // 搜索和标签过滤只改变图库视图，不修改包内容；分页仍按每次 60 张追加。
    if (pack.sprites.length === 0) {
      const empty = el('div', 'so-status')
      empty.textContent = t("sprite.manager.content.empty.pack_detail", "还没有立绘：点右上角「添加立绘」上传图片或粘贴编码。")
      body.append(empty)
    } else {
      const filters = el('div', 'so-gallery-filters')
      const search = document.createElement('input')
      search.type = 'search'
      search.className = 'text_pole so-gallery-search'
      search.placeholder = t("sprite.manager.content.filter.sprites_placeholder", "搜索图名、角色、服装或标签")
      search.setAttribute('aria-label', t("sprite.manager.content.filter.sprites", "搜索立绘"))
      search.value = ctx.state.spriteFilterQuery
      const labelSelect = document.createElement('select')
      labelSelect.className = 'text_pole so-gallery-label-select'
      labelSelect.setAttribute('aria-label', t("sprite.manager.content.filter.add_tag", "添加标签筛选"))
      const placeholder = document.createElement('option')
      placeholder.value = ''
      placeholder.textContent = t("sprite.manager.content.filter.by_tag", "按标签筛选…")
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
          head.textContent = group === '' ? t('sprite.manager.content.group.none', '未分组') : group
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
            grid.append(ctx.actions.renderSpriteCell(body, pack, sprite, index, readonly))
          }
        }
      }

      const updatePaging = (): void => {
        const visibleCount = Math.min(ctx.state.spriteVisibleCount, filteredEntries.length)
        count.textContent = t("sprite.manager.content.filter.shown", "已显示 {{p0}}/{{p1}}", { p0: visibleCount, p1: filteredEntries.length })
        paging.replaceChildren()
        if (visibleCount < filteredEntries.length) {
          paging.append(button(t("sprite.manager.content.filter.load_more", "加载更多"), () => {
            const previousCount = ctx.state.spriteVisibleCount
            ctx.state.spriteVisibleCount = Math.min(filteredEntries.length, previousCount + SPRITE_PAGE_SIZE)
            appendSprites(previousCount, ctx.state.spriteVisibleCount)
            updatePaging()
          }))
        }
      }

      const renderFilteredGallery = (): void => {
        const matches = new Set(filterSprites(pack, {
          query: ctx.state.spriteFilterQuery,
          labels: ctx.state.spriteFilterLabels,
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
          empty.textContent = t("sprite.manager.content.empty.filtered_sprites", "没有符合筛选条件的立绘。")
          gallery.append(empty)
        } else {
          appendSprites(0, Math.min(ctx.state.spriteVisibleCount, filteredEntries.length))
        }
        updatePaging()
      }

      const renderChips = (): void => {
        chips.replaceChildren()
        for (const label of ctx.state.spriteFilterLabels) {
          const chip = document.createElement('button')
          chip.type = 'button'
          chip.className = 'so-gallery-filter-chip'
          chip.textContent = `${label} ×`
          chip.title = t("sprite.manager.content.filter.remove_tag", "移除标签筛选「{{p0}}」", { p0: label })
          chip.addEventListener('click', () => {
            ctx.state.spriteFilterLabels = ctx.state.spriteFilterLabels.filter((current) => current !== label)
            ctx.state.spriteVisibleCount = SPRITE_PAGE_SIZE
            renderChips()
            renderFilteredGallery()
          })
          chips.append(chip)
        }
      }

      search.addEventListener('input', () => {
        ctx.state.spriteFilterQuery = search.value
        ctx.state.spriteVisibleCount = SPRITE_PAGE_SIZE
        renderFilteredGallery()
      })
      labelSelect.addEventListener('change', () => {
        const label = labelSelect.value
        labelSelect.value = ''
        if (!label || ctx.state.spriteFilterLabels.includes(label)) return
        ctx.state.spriteFilterLabels = [...ctx.state.spriteFilterLabels, label]
        ctx.state.spriteVisibleCount = SPRITE_PAGE_SIZE
        renderChips()
        renderFilteredGallery()
      })

      ctx.state.spriteVisibleCount = Math.min(
        Math.max(SPRITE_PAGE_SIZE, ctx.state.spriteVisibleCount),
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
        upTitle.textContent = t("sprite.manager.content.upload.retry_title", "图床补传")
        const upDesc = el('div', 'so-status')
        upDesc.textContent = t("sprite.manager.content.upload.pending_hint", "{{p0}} 张立绘还没有远程地址（分享时对方看不到）。补传到 imgbb 后本地图仍保留。", { p0: pending.length })
        upSection.append(
          upTitle,
          upDesc,
          button(t("sprite.manager.content.upload.retry", "补传 {{p0}} 张到 imgbb（失败可重试）", { p0: pending.length }), () => {
            void ctx.actions.retryPendingUploads(body, pack.id)
          }),
        )
        body.append(upSection)
      }
      // 旧分组拆包：包内有 ≥2 个分组时提供「按分组拆成立绘包」
      const splitPreview = previewGroupSplit(pack)
      if (splitPreview.length >= 2) {
        const splitPanel = ctx.actions.collapsible(t("sprite.manager.content.split.title", "按分组拆成立绘包"), false, `pack-split:${pack.id}`)
        const splitDesc = el('div', 'so-status')
        splitDesc.textContent = t("sprite.manager.content.split.preview", "检测到 {{p0}} 个分组：{{p1}}。拆分会新建这些包（原包与绑定保留，可稍后自行删除）。", { p0: splitPreview.length, p1: splitPreview
          .map((s) => `${s.roleName}(${s.count})`)
          .join('、') })
        splitPanel.body.append(
          splitDesc,
          button(t("sprite.manager.content.split.button", "拆分（保留原包）"), () => {
            const preview = splitPreview.map((s) => t("sprite.manager.content.split.pack_count", "{{p0}}：{{p1}} 张", { p0: s.roleName, p1: s.count })).join('\n')
            if (!window.confirm(t("sprite.manager.content.split.confirm", "将新建以下立绘包（原包保留）：\n{{p0}}\n\n确认拆分？", { p0: preview }))) return
            const newPacks = splitPackByGroup(pack)
            let next = deps.getSettings()
            for (const np of newPacks) {
              const updated = ctx.actions.checkedSettings(upsertPack(next, np))
              if (!updated) return
              next = updated
            }
            ctx.actions.commit(next)
            toast(body, t("sprite.manager.content.split.complete", "已拆出 {{p0}} 个新包（原包「{{p1}}」保留）", { p0: newPacks.length, p1: pack.name }))
          }),
        )
        body.append(splitPanel.box)
      }
    }

    body.append(statusBar())
  }

  return { renderPackDetail }
}
