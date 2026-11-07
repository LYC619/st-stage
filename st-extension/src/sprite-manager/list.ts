import { filterSpritePacks, genId, upsertPack, reorderBinding, unbindPack, toggleBinding, addPackCustomTag, renamePackCustomTag, deletePackCustomTag, setPackKind, removePackCustomTag, deletableLocalSpritePaths, removePacks, movePack, movePackBefore } from '../../../core/sprite-store'
import { isPresetPack } from '../../../core/presets'
import { t } from '../../../core/i18n'
import { openImageStorageDialog } from '.././image-storage-dialog'
import { sanitizePackName } from '../../../core/naming'
import type { SpritePack, PluginSettings } from '../../../core/types'
import { decodeShareString } from '../../../core/share-code'
import { importPack } from '../../../core/pack-io'
import { groupPacksByRole, normalizeLabels, packLabels } from '../../../core/sprite-metadata'
import { setPresetMetadata } from '../../../core/preset-overrides'
import { getPackCover } from '../../../core/types'
import { summarizePackResources } from '../../../core/sprite-resources'
import { button, toast, nextManagerId, el, textInput, pickFile, iconButton, checkboxRow, addCardNavigation, statusBar, labeled } from './ui'
import type { ManagerContext } from './types'
import { SPRITE_PAGE_SIZE } from './types'

export function createList(ctx: ManagerContext) {
  const { deps } = ctx


  /* ---------------- 列表页 ---------------- */

  function renderList(body: HTMLElement, actions: HTMLElement): void {
    const settings = deps.getSettings()
    const filteredPacks = filterSpritePacks(settings.packs, {
      query: ctx.state.packFilterQuery,
      roles: ctx.state.packFilterRole ? [ctx.state.packFilterRole] : [],
      kinds: ctx.state.packFilterKind === 'sprite' || ctx.state.packFilterKind === 'illustration' ? [ctx.state.packFilterKind] : [],
      customTags: ctx.state.packFilterTag ? [ctx.state.packFilterTag] : [],
    })
    const characterName = deps.adapter.getCurrentCharacterName()
    const binding = settings.bindings.find((b) => b.characterName === characterName)
    const boundIds = binding?.packIds ?? []

    // 头部操作区：批量管理模式=全选/删除/完成；常规=启用勾选浮层 + 新建/导入下拉
    if (ctx.state.batchMode) {
      const selectedCount = ctx.state.selectedPackIds.size
      const deletablePacks = settings.packs.filter(
        (pack) => ctx.state.selectedPackIds.has(pack.id) && !isPresetPack(pack.id),
      )
      actions.append(
        button(t("sprite.manager.content.batch.select_all", "全选"), () => {
          const all = filteredPacks
          if (all.length > 0 && all.every((p) => ctx.state.selectedPackIds.has(p.id))) {
            ctx.state.selectedPackIds.clear()
          } else {
            ctx.state.selectedPackIds.clear()
            for (const p of all) ctx.state.selectedPackIds.add(p.id)
          }
          ctx.actions.render()
        }),
        button(t("sprite.manager.content.batch.upload", "上传云端（{{p0}}）", { p0: selectedCount }), () => {
          void ctx.actions.uploadSelectedPacks()
        }),
        button(t("sprite.manager.content.batch.localize", "保存本地（{{p0}}）", { p0: selectedCount }), () => {
          void ctx.actions.localizeSelectedPacks()
        }),
        button(t("sprite.manager.content.batch.share", "复制分享串（{{p0}}）", { p0: selectedCount }), () => {
          void ctx.actions.copySelectedPackShares()
        }),
        button(t("sprite.manager.content.batch.delete", "删除所选（{{p0}}）", { p0: deletablePacks.length }), () => {
          if (deletablePacks.length === 0) {
            toast(body, ctx.state.selectedPackIds.size > 0
              ? t("sprite.manager.content.batch.preset_hint", "预设包不可删除；可保存本地、上传云端或复制分享串")
              : t("sprite.manager.content.batch.delete_hint", "先点卡片勾选要删除的包"))
            return
          }
          const names = deletablePacks.map((pack) => pack.name)
          const preview = names.slice(0, 8).join('、') + (names.length > 8 ? t("sprite.manager.content.batch.more", " 等 {{p0}} 个", { p0: names.length }) : '')
          const ids = deletablePacks.map((pack) => pack.id)
          void deletePacksWithChoice(ids, names, preview)
        }, 'so-btn-danger'),
        button(t("sprite.manager.content.batch.done", "完成"), () => {
          ctx.state.batchMode = false
          ctx.state.selectedPackIds.clear()
          ctx.actions.render()
        }),
      )
    } else {
      if (characterName) {
        const enableBtn = button(
          boundIds.length > 0 ? t('sprite.manager.enabled_count', '启用包（{{count}}） ▾', { count: boundIds.length }) : t('sprite.manager.enable', '启用包 ▾'),
          () => {
            if (ctx.state.enableListOpen) {
              ctx.actions.closeEnableList()
            } else {
              ctx.actions.closePopovers()
              ctx.state.enableListOpen = true
              ctx.actions.renderEnableList()
            }
          },
        )
        enableBtn.classList.add('so-enable-btn')
        enableBtn.setAttribute('aria-haspopup', 'dialog')
        enableBtn.setAttribute('aria-expanded', String(ctx.state.enableListOpen))

        enableBtn.setAttribute('aria-label', `${enableBtn.textContent}：${t('sprite.manager.enable_for', '为「{{name}}」勾选启用立绘包', { name: characterName })}`)
        actions.append(enableBtn)
      }
      actions.append(
        button(t('sprite.manager.storage', '存储检查与迁移'), () => {
          if (ctx.state.importController) {
            toast(body, t("sprite.manager.content.import.busy", "已有导入任务正在处理"))
            return
          }
          ctx.state.storageDialog?.close()
          ctx.state.storageDialog = openImageStorageDialog({
            adapter: deps.adapter,
            getSettings: deps.getSettings,
            updateSettings: deps.updateSettings,
            saveDataUri: deps.saveDataUri ?? ((dataUri, options) => deps.adapter.saveDataUri(dataUri, options)),
            onClosed: () => { ctx.state.storageDialog = null },
          })
        }),
        ctx.actions.dropdownButton(t('sprite.manager.new', '新建'), (panel) => {
        const heading = el('div', 'so-popover-title')
        heading.textContent = t('sprite.manager.new_title', '新建立绘包')
        const nameInput = textInput(t('sprite.manager.new_name', '输入新包名称…'))
        nameInput.maxLength = 40
        const createBtn = button(t('sprite.manager.create', '创建'), () => {
          const name = sanitizePackName(nameInput.value)
          if (!name) {
            toast(body, t("sprite.manager.content.pack.invalid_name", "包名不能为空（| = @ < > 等符号会被剔除）"))
            return
          }
          const pack: SpritePack = { id: genId(), name, author: '我', sprites: [] }
          if (!ctx.actions.updateChecked(upsertPack(deps.getSettings(), pack))) return
          ctx.state.view = { kind: 'pack', packId: pack.id }
          ctx.actions.render()
        })
        nameInput.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' && !e.isComposing) createBtn.click()
        })
        panel.append(heading, nameInput, createBtn)
      }),
      ctx.actions.dropdownButton(t('sprite.manager.import', '导入'), (panel) => {
        const shareHeading = el('div', 'so-popover-title')
        shareHeading.textContent = t('sprite.manager.import_share', '从分享字符串导入')
        const shareInput = document.createElement('textarea')
        shareInput.className = 'text_pole'
        shareInput.rows = 3
        shareInput.placeholder = t('sprite.manager.share_placeholder', '粘贴 stpack2:/stpack1: 分享串…')
        const shareBtn = button(t('sprite.manager.import', '导入'), () => {
          if (!shareInput.value.trim()) return
          try {
            const pack = decodeShareString(shareInput.value)
            void ctx.actions.prepareAndInstall(pack, body)
          } catch (err) {
            toast(body, err instanceof Error ? err.message : t("sprite.manager.content.import.share_failed", "分享串解析失败"))
          }
        })
        const jsonHeading = el('div', 'so-popover-title')
        jsonHeading.textContent = t('sprite.manager.import_json', '从 JSON 文件导入')
        const jsonBtn = button(t('sprite.manager.choose_json', '选择 JSON 文件…'), () => {
          pickFile('.json,application/json', false, async (files) => {
            try {
              if (ctx.state.destroyed || ctx.actions.currentManagerBody() !== body || !files[0]) return
              const file = files[0]
              if (file.size > 2 * 1024 * 1024 && !window.confirm(
                t("sprite.manager.content.import.large_json", "这个 JSON 有 {{p0}} MiB。读取会占用临时内存，内嵌图片需要逐张上传到酒馆本地文件。继续导入吗？", { p0: (file.size / 1024 / 1024).toFixed(1) }),
              )) return
              const text = await file.text()
              const pack = importPack(text)
              void ctx.actions.prepareAndInstall(pack, body)
            } catch (err) {
              toast(body, err instanceof Error ? err.message : t("sprite.manager.content.import.failed", "导入失败"))
            }
          })
        })
        panel.append(shareHeading, shareInput, shareBtn, jsonHeading, jsonBtn)
      }),
      )
      if (settings.packs.length > 0) {
        actions.append(
          button(t('sprite.manager.tags', '标签管理'), () => openTagManager()),
          button(t('sprite.manager.batch', '批量管理'), () => {
            ctx.actions.closeEnableList()
            ctx.state.batchMode = true
            ctx.state.selectedPackIds.clear()
            ctx.actions.render()
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
          ? t("sprite.manager.content.binding.enabled", "{{p0}} · 已启用 {{p1}} 个：", { p0: characterName, p1: boundIds.length })
          : t("sprite.manager.content.binding.none", "{{p0}} · 尚未启用立绘包（用右上角选择启用）", { p0: characterName })
      strip.append(label)
      boundIds.forEach((id, index) => {
        const pack = settings.packs.find((p) => p.id === id)
        const chip = el('span', 'so-chip')
        const name = el('span', 'so-chip-name')
        name.textContent = pack
          ? t("sprite.manager.content.binding.pack", "{{p0}}. {{p1}}（{{p2}} 张）", { p0: index + 1, p1: pack.name, p2: pack.sprites.length })
          : t("sprite.manager.content.binding.deleted", "（已删除的包 {{p0}}）", { p0: id })
        chip.append(name)
        if (boundIds.length > 1) {
          chip.append(
            iconButton('◀', t("sprite.manager.content.binding.move_first", "前移（多包寻址优先级更高）"), () => {
              if (index > 0) ctx.actions.commit(reorderBinding(deps.getSettings(), characterName, index, index - 1))
            }, 'so-chip-btn'),
            iconButton('▶', t("sprite.manager.content.move_later", "后移"), () => {
              ctx.actions.commit(reorderBinding(deps.getSettings(), characterName, index, index + 1))
            }, 'so-chip-btn'),
          )
        }
        chip.append(
          iconButton('✕', t("sprite.manager.content.binding.disable", "停用此包"), () => {
            ctx.actions.commit(unbindPack(deps.getSettings(), characterName, id))
          }, 'so-chip-btn'),
        )
        strip.append(chip)
      })
      if (binding) {
        strip.append(
          el('span', 'so-spacer'),
          checkboxRow(t("sprite.manager.content.binding.enable_all", "全部启用"), binding.enabled, (v) =>
            ctx.actions.commitChecked(toggleBinding(deps.getSettings(), characterName, v)),
          ),
        )
      }
    } else {
      const tip = el('span', 'so-status')
      tip.textContent = t("sprite.manager.content.binding.open_chat", "请先打开一个角色聊天，再回来启用立绘包。")
      strip.append(tip)
    }
    body.append(strip)
    body.append(renderPackFilters(settings, filteredPacks.length))

    // 包封面图墙：立绘包是图片集合，用卡片网格浏览（同 ST 角色列表的卡片墙模式）
    // 批量管理模式强制平铺网格：拖拽排序调整的是包列表的整体顺序，折叠分组下无法直观呈现
    if (ctx.state.batchMode) {
      const tip = el('div', 'so-status so-batch-tip')
      tip.textContent = t("sprite.manager.content.batch.hint", "批量管理：先勾选图包，再统一设置类型或标签；资源操作和排序仍可在上方完成。预设包可保存本地或分享，但不可删除。")
      body.append(tip)
      body.append(renderBatchClassificationTools(body))
    }
    const useFold = settings.galleryFoldByRole && !ctx.state.batchMode
    const grid = el('div', useFold ? 'so-pack-list-folded' : 'so-pack-grid')
    const boundState = (pack: SpritePack): 'active' | 'off' | null =>
      boundIds.includes(pack.id) ? (binding?.enabled ? 'active' : 'off') : null
    if (useFold) {
      for (const group of groupPacksByRole(filteredPacks)) {
        if (group.packCount === 1) {
          grid.append(renderPackCard(group.packs[0], boundState(group.packs[0])))
          continue
        }
        const section = el('div', 'so-role-pack-group')
        section.dataset.roleKey = group.key
        const expanded = ctx.state.expandedRoleGroupKey === group.key
        const toggle = () => {
          ctx.state.expandedRoleGroupKey = expanded ? '' : group.key
          ctx.actions.render()
        }
        if (expanded) {
          section.classList.add('so-role-pack-group-expanded')
          const row = el('button', 'so-role-pack-row') as HTMLButtonElement
          row.type = 'button'
          row.dataset.managerFocus = `role:${group.key}`
          row.setAttribute('aria-expanded', 'true')
          const title = el('b')
          title.textContent = group.role
          const counts = el('span')
          counts.textContent = t("sprite.manager.content.pack.counts", "{{p0}} 个图包 · {{p1}} 张", { p0: group.packCount, p1: group.spriteCount })
          const arrow = el('span', 'so-role-pack-arrow')
          arrow.textContent = '▾'
          row.append(title, counts, arrow)
          row.addEventListener('click', toggle)
          addCardNavigation(row, '.so-pack-card, .so-role-pack-stack, .so-role-pack-row')
          const packs = el('div', 'so-role-pack-strip')
          packs.id = nextManagerId()
          row.setAttribute('aria-controls', packs.id)
          packs.setAttribute('aria-label', t("sprite.manager.content.pack.role_packs", "{{p0}}的图包", { p0: group.role }))
          for (const pack of group.packs) packs.append(renderPackCard(pack, boundState(pack)))
          section.append(row, packs)
        } else {
          section.append(renderRolePackStack(group.role, group.key, group.packs, group.spriteCount, boundState, toggle))
        }
        grid.append(section)
      }
    } else {
      for (const pack of filteredPacks) grid.append(renderPackCard(pack, boundState(pack)))
    }
    body.append(grid)
    if (filteredPacks.length === 0) {
      const empty = el('div', 'so-status so-pack-filter-empty')
      empty.textContent = t("sprite.manager.content.empty.filtered_packs", "没有符合当前筛选条件的图包")
      body.append(empty)
    }

    body.append(statusBar())
    ctx.actions.renderEnableList()
  }


  function renderPackFilters(settings: PluginSettings, visibleCount: number): HTMLElement {
    const panel = el('div', 'so-pack-filters')
    const search = textInput(t("sprite.manager.content.filter.packs_placeholder", "搜索包名、角色、服装或标签"))
    search.classList.add('so-pack-filter-search')
    search.value = ctx.state.packFilterQuery
    const applySearch = () => {
      ctx.state.packFilterQuery = search.value.trim()
      ctx.state.expandedRoleGroupKey = ''
      ctx.actions.render()
    }
    search.addEventListener('change', applySearch)
    search.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter' || event.isComposing) return
      event.preventDefault()
      applySearch()
    })

    const selectFilter = (
      className: string,
      options: Array<[string, string]>,
      current: string,
      apply: (value: string) => void,
    ) => {
      const select = document.createElement('select')
      select.className = `text_pole ${className}`
      select.dataset.managerFocus = className
      select.setAttribute('aria-label', options[0]?.[1] ?? '')
      for (const [value, label] of options) {
        const option = document.createElement('option')
        option.value = value
        option.textContent = label
        select.append(option)
      }
      select.value = current
      select.addEventListener('change', () => {
        apply(select.value)
        ctx.state.expandedRoleGroupKey = ''
        ctx.actions.render()
      })
      return select
    }
    const roles = normalizeLabels(settings.packs.map((pack) => pack.roleName?.trim() || '其他'))
    const tags = normalizeLabels(settings.packs.flatMap((pack) => pack.customTags ?? []))
    const role = selectFilter(
      'so-pack-filter-role',
      [['', t("sprite.manager.content.filter.all_roles", "全部角色")], ...roles.map((item): [string, string] => [item, item === '其他' ? t('sprite.manager.content.group.other', '其他') : item])],
      ctx.state.packFilterRole,
      (value) => { ctx.state.packFilterRole = value },
    )
    const kind = selectFilter(
      'so-pack-filter-kind',
      [['', t("sprite.manager.content.filter.all_types", "全部类型")], ['sprite', t("sprite.manager.content.kind.sprite", "立绘")], ['illustration', t("sprite.manager.content.kind.illustration", "插图")]],
      ctx.state.packFilterKind,
      (value) => { ctx.state.packFilterKind = value },
    )
    const tag = selectFilter(
      'so-pack-filter-tag',
      [['', t("sprite.manager.content.filter.all_tags", "全部标签")], ...tags.map((item): [string, string] => [item, item])],
      ctx.state.packFilterTag,
      (value) => { ctx.state.packFilterTag = value },
    )
    const status = el('span', 'so-pack-filter-count')
    status.textContent = t("sprite.manager.content.filter.pack_count", "{{p0}}/{{p1}} 个图包", { p0: visibleCount, p1: settings.packs.length })
    panel.append(search, role, kind, tag, status)
    if (ctx.state.packFilterQuery || ctx.state.packFilterRole || ctx.state.packFilterKind || ctx.state.packFilterTag) {
      panel.append(button(t("sprite.manager.content.filter.clear", "清除筛选"), () => {
        ctx.state.packFilterQuery = ctx.state.packFilterRole = ctx.state.packFilterKind = ctx.state.packFilterTag = ''
        ctx.state.expandedRoleGroupKey = ''
        ctx.actions.render()
      }))
    }
    return panel
  }


  function openTagManager(): void {
    const modal = el('div', 'so-upload-modal so-tag-manager')
    modal.setAttribute('role', 'dialog')
    modal.setAttribute('aria-label', t("sprite.manager.content.tag.dialog_title", "图包标签管理"))
    const panel = el('div', 'so-upload-panel so-tag-manager-panel')
    const heading = el('div', 'so-tag-manager-heading')
    const title = el('b')
    title.textContent = t("sprite.manager.tags", "标签管理")
    heading.append(title, button(t("common.close", "关闭"), () => closeModal()))
    const help = el('div', 'so-status')
    help.textContent = t("sprite.manager.content.tag.help", "角色和类型由图包信息自动生成，只能在包信息或批量管理中修改。这里管理自定义标签。")

    const settings = deps.getSettings()
    const addRow = el('div', 'so-row so-tag-manager-add')
    const packSelect = document.createElement('select')
    packSelect.className = 'text_pole so-tag-manager-pack'
    for (const pack of settings.packs) {
      const option = document.createElement('option')
      option.value = pack.id
      option.textContent = pack.name
      packSelect.append(option)
    }
    const newTag = textInput(t("sprite.manager.content.tag.new_placeholder", "输入新标签"))
    newTag.classList.add('so-tag-manager-new')
    const commitTags = (next: PluginSettings) => {
      closeModal()
      ctx.actions.commit(persistSelectedPresetMetadata(next, next.packs.map((pack) => pack.id)))
    }
    addRow.append(
      labeled(t("sprite.manager.content.tag.add_to_pack", "添加到图包"), packSelect),
      labeled(t("sprite.manager.content.tag.new", "新标签"), newTag),
      button(t("sprite.manager.content.tag.add_to_pack", "添加到图包"), () => {
        const tag = normalizeLabels([newTag.value])[0]
        if (!packSelect.value || !tag) {
          toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.tag.select_pack", "请选择图包并输入标签"))
          return
        }
        commitTags(addPackCustomTag(deps.getSettings(), [packSelect.value], tag))
      }),
    )

    const list = el('div', 'so-tag-manager-list')
    const tags = normalizeLabels(settings.packs.flatMap((pack) => pack.customTags ?? []))
    if (tags.length === 0) {
      const empty = el('div', 'so-status')
      empty.textContent = t("sprite.manager.content.tag.empty", "还没有自定义标签")
      list.append(empty)
    }
    for (const tag of tags) {
      const row = el('div', 'so-tag-manager-row')
      row.dataset.tag = tag
      const input = textInput(t("sprite.manager.content.tag.name", "标签名称"))
      input.value = tag
      const count = settings.packs.filter((pack) => normalizeLabels(pack.customTags).includes(tag)).length
      const usage = el('span', 'so-status')
      usage.textContent = t("sprite.manager.content.pack.count", "{{p0}} 个图包", { p0: count })
      row.append(
        input,
        usage,
        button(t("sprite.manager.content.action.rename", "重命名"), () => {
          const renamed = normalizeLabels([input.value])[0]
          if (!renamed) {
            toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.tag.empty_name", "标签名称不能为空"))
            return
          }
          commitTags(renamePackCustomTag(deps.getSettings(), tag, renamed))
        }),
        button(t("common.delete", "删除"), () => {
          if (!window.confirm(t("sprite.manager.content.tag.confirm_delete", "从 {{p0}} 个图包删除标签「{{p1}}」吗？", { p0: count, p1: tag }))) return
          commitTags(deletePackCustomTag(deps.getSettings(), tag))
        }, 'so-btn-danger'),
      )
      list.append(row)
    }
    panel.append(heading, help, addRow, list)
    modal.append(panel)
    ;(ctx.state.backdrop ?? document.body).append(modal)
    const closeModal = ctx.actions.manageChildDialog(modal)
  }


  function selectedPacks(): SpritePack[] {
    return deps.getSettings().packs.filter((pack) => ctx.state.selectedPackIds.has(pack.id))
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
        inventoryPrompt: pack.inventoryPrompt ?? null,
        kind: pack.kind ?? null,
        customTags: customTags.length > 0 ? customTags : null,
      })
    }
    return next
  }


  function renderBatchClassificationTools(body: HTMLElement): HTMLElement {
    const panel = el('div', 'so-batch-classification')
    const ids = [...ctx.state.selectedPackIds]

    const kindSelect = document.createElement('select')
    kindSelect.className = 'text_pole so-batch-kind-select'
    for (const [value, label] of [['sprite', t("sprite.manager.content.kind.sprite", "立绘")], ['illustration', t("sprite.manager.content.kind.illustration", "插图")]] as const) {
      const option = document.createElement('option')
      option.value = value
      option.textContent = label
      kindSelect.append(option)
    }
    const kindRow = el('div', 'so-row')
    kindRow.append(
      labeled(t("sprite.manager.content.kind.label", "类型"), kindSelect),
      button(t("sprite.manager.content.kind.set", "设置类型"), () => {
        if (ctx.state.selectedPackIds.size === 0) {
          toast(body, t("sprite.manager.content.batch.select_first", "请先勾选要设置的图包"))
          return
        }
        const selected = [...ctx.state.selectedPackIds]
        const changed = setPackKind(
          deps.getSettings(),
          selected,
          kindSelect.value === 'illustration' ? 'illustration' : 'sprite',
        )
        ctx.actions.commit(persistSelectedPresetMetadata(changed, selected))
        toast(body, t("sprite.manager.content.kind.updated", "已设置 {{p0}} 个图包的类型", { p0: selected.length }))
      }),
    )

    const tagInput = textInput(t("sprite.manager.content.tag.custom_placeholder", "输入自定义标签"))
    tagInput.classList.add('so-batch-tag-input')
    tagInput.maxLength = 32
    const addRow = el('div', 'so-row')
    addRow.append(
      labeled(t("sprite.manager.content.tag.custom", "自定义标签"), tagInput),
      button(t("sprite.manager.content.tag.add", "添加标签"), () => {
        const tag = normalizeLabels([tagInput.value])[0]
        if (ctx.state.selectedPackIds.size === 0) {
          toast(body, t("sprite.manager.content.batch.select_first", "请先勾选要设置的图包"))
          return
        }
        if (!tag) {
          toast(body, t("sprite.manager.content.tag.enter", "请输入标签"))
          return
        }
        const selected = [...ctx.state.selectedPackIds]
        const changed = addPackCustomTag(deps.getSettings(), selected, tag)
        ctx.actions.commit(persistSelectedPresetMetadata(changed, selected))
        toast(body, t("sprite.manager.content.tag.added", "已为 {{p0}} 个图包添加「{{p1}}」", { p0: selected.length, p1: tag }))
      }),
    )

    const removeSelect = document.createElement('select')
    removeSelect.className = 'text_pole so-batch-tag-remove-select'
    const emptyOption = document.createElement('option')
    emptyOption.value = ''
    emptyOption.textContent = ids.length === 0 ? t("sprite.manager.content.tag.select_packs_first", "先勾选图包") : t("sprite.manager.content.tag.choose_remove", "选择要移除的标签")
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
      labeled(t("sprite.manager.content.tag.remove", "移除标签"), removeSelect),
      button(t("sprite.manager.content.tag.remove", "移除标签"), () => {
        if (ctx.state.selectedPackIds.size === 0) {
          toast(body, t("sprite.manager.content.batch.select_first", "请先勾选要设置的图包"))
          return
        }
        if (!removeSelect.value) {
          toast(body, t("sprite.manager.content.tag.select_remove", "请选择要移除的标签"))
          return
        }
        const selected = [...ctx.state.selectedPackIds]
        const changed = removePackCustomTag(deps.getSettings(), selected, removeSelect.value)
        ctx.actions.commit(persistSelectedPresetMetadata(changed, selected))
        toast(body, t("sprite.manager.content.tag.removed", "已从 {{p0}} 个图包移除「{{p1}}」", { p0: selected.length, p1: removeSelect.value }))
      }),
    )

    panel.append(kindRow, addRow, removeRow)
    return panel
  }


  async function deletePacksWithChoice(packIds: string[], names: string[], preview: string): Promise<void> {
    if (!window.confirm(t("sprite.manager.content.delete.confirm_packs", "确定删除 {{p0}} 个立绘包？\n{{p1}}\n绑定关系会一并清除。", { p0: names.length, p1: preview }))) return
    const current = deps.getSettings()
    const localPaths = deletableLocalSpritePaths(current, packIds)
    const deleteLocal = localPaths.length > 0 && window.confirm(
      t("sprite.manager.content.delete.local_detected", "检测到 {{p0}} 个仅由这些包使用的本地图片文件。\n", { p0: localPaths.length }) +
      t("sprite.manager.content.delete.local_confirm", "同时从 SillyTavern 服务器删除它们吗？\n\n选择“取消”将只删除图包记录，文件继续保留。"),
    )

    if (!deleteLocal) {
      ctx.state.selectedPackIds.clear()
      ctx.state.view = { kind: 'list' }
      ctx.actions.commit(removePacks(current, packIds))
      toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.delete.packs_kept_files", "已删除 {{p0}} 个立绘包，本地文件未删除", { p0: names.length }))
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
        ctx.actions.currentManagerBody(),
        t("sprite.manager.content.delete.files_partial", "本地文件删除成功 {{p0}} 张，失败 {{p1}} 张；图包尚未删除，可再次重试", { p0: deleted, p1: failed }),
      )
      return
    }
    ctx.state.selectedPackIds.clear()
    ctx.state.view = { kind: 'list' }
    ctx.actions.commit(removePacks(deps.getSettings(), packIds))
    toast(ctx.actions.currentManagerBody(), t("sprite.manager.content.delete.packs_and_files", "已删除 {{p0}} 个立绘包及 {{p1}} 张本地文件", { p0: names.length, p1: deleted }))
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
    stack.dataset.managerFocus = `role:${roleKey}`
    stack.dataset.roleKey = roleKey
    stack.setAttribute('aria-expanded', 'false')
    stack.title = t("sprite.manager.content.pack.expand_role", "展开「{{p0}}」的 {{p1}} 个图包", { p0: role, p1: packs.length })
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
      coverBox.textContent = t("sprite.manager.content.empty.sprites", "暂无立绘")
    }
    const activeCount = packs.filter((pack) => boundState(pack) === 'active').length
    if (activeCount > 0) {
      const badge = el('span', 'so-card-badge')
      badge.textContent = activeCount === 1 ? t("sprite.manager.content.pack.active", "使用中") : t("sprite.manager.content.pack.active_count", "使用中 {{p0}}", { p0: activeCount })
      coverBox.append(badge)
    }
    const info = el('span', 'so-card-info')
    const title = el('b')
    title.textContent = role
    const detail = el('small')
    detail.textContent = t("sprite.manager.content.pack.counts", "{{p0}} 个图包 · {{p1}} 张", { p0: packs.length, p1: spriteCount })
    const count = el('span', 'so-role-stack-count')
    count.textContent = t("sprite.manager.content.pack.count", "{{p0}} 个图包", { p0: packs.length })
    info.append(title, detail)
    face.append(coverBox, count, info)
    stack.append(face)
    stack.addEventListener('click', expand)
    addCardNavigation(stack, '.so-pack-card, .so-role-pack-stack, .so-role-pack-row')
    return stack
  }


  function renderPackCard(pack: SpritePack, bound: 'active' | 'off' | null): HTMLElement {
    const card = el('div', 'so-pack-card')
    card.dataset.managerFocus = `pack:${pack.id}`
    card.tabIndex = 0
    card.setAttribute('role', 'button')
    // Derive the accessible name from the visible card, including status and metadata.
    card.title = t("sprite.manager.content.pack.open", "打开立绘包「{{p0}}」", { p0: pack.name })

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
      coverBox.textContent = t("sprite.manager.content.empty.sprites", "暂无立绘")
    }
    if (bound) {
      // 使用中：角标 + 卡片绿色描边双重标识（概念图）
      if (bound === 'active') card.classList.add('so-card-active')
      const badge = el('span', bound === 'active' ? 'so-card-badge' : 'so-card-badge so-card-badge-off')
      badge.textContent = bound === 'active' ? t("sprite.manager.content.pack.active", "使用中") : t("sprite.manager.content.pack.disabled", "已停用")
      badge.dataset.corner = 'bottom-left'
      coverBox.append(badge)
    }
    if (isPresetPack(pack.id)) {
      const chip = el('span', 'so-card-chip')
      chip.textContent = t("sprite.manager.content.pack.preset", "预设")
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
      resourceLabel('local', t("sprite.manager.content.pack.local", "本地"))
      resourceLabel('cloud', t("sprite.manager.content.pack.cloud", "云端"))
      coverBox.append(status)
    }

    const info = el('div', 'so-card-info')
    const nameEl = el('b')
    nameEl.textContent = pack.name
    const metaEl = el('small')
    metaEl.textContent = t("sprite.manager.content.pack.metadata", "{{p0}} 张 · {{p1}}", { p0: pack.sprites.length, p1: pack.author ?? t("sprite.manager.content.pack.unknown_author", "未知作者") })
    const labels = packLabels(pack)
    const labelRow = el('div', 'so-pack-labels')
    const displayRole = pack.roleName?.trim() || t('sprite.manager.content.group.other', '其他')
    const displayKind = pack.kind === 'illustration' ? t('sprite.manager.content.kind.illustration', '插图') : t('sprite.manager.content.kind.sprite', '立绘')
    for (const text of [t("sprite.manager.content.pack.role_label", "角色：{{p0}}", { p0: displayRole }), t("sprite.manager.content.pack.kind_label", "类型：{{p0}}", { p0: displayKind }), ...labels.custom]) {
      const chip = el('span')
      chip.textContent = text
      labelRow.append(chip)
    }
    info.append(nameEl, metaEl, labelRow)

    card.append(coverBox, info)
    addCardNavigation(card, '.so-pack-card, .so-role-pack-stack, .so-role-pack-row')

    if (ctx.state.batchMode) {
      // 批量管理：点卡片勾选资源操作；删除动作单独过滤只读预设。
      const preset = isPresetPack(pack.id)
      const selected = ctx.state.selectedPackIds.has(pack.id)
      card.setAttribute('aria-pressed', String(selected))
      card.classList.add('so-card-batch')
      if (selected) card.classList.add('so-card-selected')
      const check = el('span', `so-card-check${selected ? ' so-card-check-on' : ''}`)
      check.textContent = selected ? '✓' : ''
      check.dataset.corner = 'top-left'
      coverBox.append(check)
      const orderRow = el('div', 'so-row so-card-order')
      orderRow.append(
        iconButton('◀', t("sprite.manager.content.move_earlier", "前移"), () => {
          ctx.actions.commit(movePack(deps.getSettings(), pack.id, -1))
        }, 'so-chip-btn'),
        iconButton('▶', t("sprite.manager.content.move_later", "后移"), () => {
          ctx.actions.commit(movePack(deps.getSettings(), pack.id, 1))
        }, 'so-chip-btn'),
      )
      card.append(orderRow)

      card.title = preset
        ? t("sprite.manager.content.batch.preset_select_hint", "点击勾选资源操作；预设包不可删除，可拖拽排序")
        : t("sprite.manager.content.batch.select_hint", "点击勾选；可拖拽排序")
      const toggleSelect = () => {
        if (ctx.state.selectedPackIds.has(pack.id)) ctx.state.selectedPackIds.delete(pack.id)
        else ctx.state.selectedPackIds.add(pack.id)
        ctx.actions.render()
      }
      card.addEventListener('click', toggleSelect)
      card.addEventListener('keydown', (e) => {
        if (e.target === card && !e.isComposing && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault()
          e.stopPropagation()
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
        ctx.actions.commit(movePackBefore(deps.getSettings(), fromId, pack.id))
      })
      return card
    }

    const enter = () => {
      ctx.state.view = { kind: 'pack', packId: pack.id }
      ctx.state.spriteVisibleCount = SPRITE_PAGE_SIZE
      ctx.state.spriteFilterQuery = ''
      ctx.state.spriteFilterLabels = []
      ctx.actions.render()
    }
    card.addEventListener('click', enter)
    card.addEventListener('keydown', (e) => {
      if (e.target === card && !e.isComposing && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        e.stopPropagation()
        enter()
      }
    })
    return card
  }

  return { renderList, renderPackFilters, openTagManager, selectedPacks, persistSelectedPresetMetadata, renderBatchClassificationTools, deletePacksWithChoice, renderRolePackStack, renderPackCard }
}
