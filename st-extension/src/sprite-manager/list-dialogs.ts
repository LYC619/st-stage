import {
  addPackCustomTag,
  deletableLocalSpritePaths,
  deletePackCustomTag,
  removePacks,
  renamePackCustomTag,
} from '../../../core/sprite-store'
import { isPresetPack } from '../../../core/presets'
import { t } from '../../../core/i18n'
import type { PluginSettings } from '../../../core/types'
import { normalizeLabels } from '../../../core/sprite-metadata'
import { setPresetMetadata } from '../../../core/preset-overrides'
import { button, checkboxRow, el, labeled, statusBar, textInput, toast } from './ui'
import type { ManagerContext } from './types'

export function persistSelectedPresetMetadata(
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

export function openTagManagerDialog(ctx: ManagerContext): void {
  const { deps } = ctx
  const modal = el('div', 'so-upload-modal so-tag-manager')
  modal.setAttribute('role', 'dialog')
  modal.setAttribute('aria-label', t('sprite.manager.content.tag.dialog_title', '图包标签管理'))
  const panel = el('div', 'so-upload-panel so-tag-manager-panel')
  const heading = el('div', 'so-tag-manager-heading')
  const title = el('b')
  title.textContent = t('sprite.manager.tags', '标签管理')
  heading.append(title, button(t('common.close', '关闭'), () => closeModal()))
  const help = el('div', 'so-status')
  help.textContent = t('sprite.manager.content.tag.help', '角色和类型由图包信息自动生成，只能在包信息或批量管理中修改。这里管理自定义标签。')

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
  const newTag = textInput(t('sprite.manager.content.tag.new_placeholder', '输入新标签'))
  newTag.classList.add('so-tag-manager-new')
  const commitTags = (next: PluginSettings) => {
    closeModal()
    ctx.actions.commit(persistSelectedPresetMetadata(next, next.packs.map((pack) => pack.id)))
  }
  addRow.append(
    labeled(t('sprite.manager.content.tag.add_to_pack', '添加到图包'), packSelect),
    labeled(t('sprite.manager.content.tag.new', '新标签'), newTag),
    button(t('sprite.manager.content.tag.add_to_pack', '添加到图包'), () => {
      const tag = normalizeLabels([newTag.value])[0]
      if (!packSelect.value || !tag) {
        toast(ctx.actions.currentManagerBody(), t('sprite.manager.content.tag.select_pack', '请选择图包并输入标签'))
        return
      }
      commitTags(addPackCustomTag(deps.getSettings(), [packSelect.value], tag))
    }),
  )

  const list = el('div', 'so-tag-manager-list')
  const tags = normalizeLabels(settings.packs.flatMap((pack) => pack.customTags ?? []))
  if (tags.length === 0) {
    const empty = el('div', 'so-status')
    empty.textContent = t('sprite.manager.content.tag.empty', '还没有自定义标签')
    list.append(empty)
  }
  for (const tag of tags) {
    const row = el('div', 'so-tag-manager-row')
    row.dataset.tag = tag
    const input = textInput(t('sprite.manager.content.tag.name', '标签名称'))
    input.value = tag
    const count = settings.packs.filter((pack) => normalizeLabels(pack.customTags).includes(tag)).length
    const usage = el('span', 'so-status')
    usage.textContent = t('sprite.manager.content.pack.count', '{{p0}} 个图包', { p0: count })
    row.append(
      input,
      usage,
      button(t('sprite.manager.content.action.rename', '重命名'), () => {
        const renamed = normalizeLabels([input.value])[0]
        if (!renamed) {
          toast(ctx.actions.currentManagerBody(), t('sprite.manager.content.tag.empty_name', '标签名称不能为空'))
          return
        }
        commitTags(renamePackCustomTag(deps.getSettings(), tag, renamed))
      }),
      button(t('common.delete', '删除'), () => {
        if (!window.confirm(t('sprite.manager.content.tag.confirm_delete', '从 {{p0}} 个图包删除标签「{{p1}}」吗？', { p0: count, p1: tag }))) return
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

export async function deletePacksWithChoiceDialog(
  ctx: ManagerContext,
  packIds: string[],
  names: string[],
  preview: string,
): Promise<void> {
  const { deps } = ctx
  if (!ctx.state.backdrop || ctx.state.backdrop.querySelector('.so-delete-dialog')) return
  const current = deps.getSettings()
  packIds = packIds.filter(id => !isPresetPack(id) && current.packs.some(pack => pack.id === id))
  if (!packIds.length) return
  const localPaths = deletableLocalSpritePaths(current, packIds)
  const snapshot = JSON.stringify(current.packs.filter(pack => packIds.includes(pack.id)))
  const changed = () => snapshot !== JSON.stringify(deps.getSettings().packs.filter(pack => packIds.includes(pack.id)))
  const modal = el('div', 'so-upload-modal so-delete-dialog'), panel = el('div', 'so-upload-panel')
  modal.setAttribute('aria-label', t('sprite.manager.content.delete.title', '删除图包'))
  const title = el('b'); title.textContent = t('sprite.manager.content.delete.title', '删除图包')
  const description = el('p', 'so-status'); description.style.whiteSpace = 'pre-wrap'
  description.textContent = t('sprite.manager.content.delete.confirm_packs', '确定删除 {{p0}} 个立绘包？\n{{p1}}\n绑定关系会一并清除。', { p0: names.length, p1: preview })
  let deleteLocal = false, busy = false
  const choice = checkboxRow(t('sprite.manager.content.delete.local_choice', '同时删除本地服务器上的独占图片源文件（共 {{count}} 张）', { count: localPaths.length }), false, value => { deleteLocal = value })
  const checkbox = choice.querySelector('input')!; checkbox.disabled = !localPaths.length
  const status = statusBar(), actions = el('div', 'so-row')
  const cancel = document.createElement('button'), confirm = document.createElement('button')
  for (const control of [cancel, confirm]) { control.type = 'button'; control.className = 'so-btn' }
  cancel.textContent = t('common.cancel', '取消'); confirm.textContent = t('common.delete', '删除'); confirm.classList.add('so-btn-danger')
  actions.append(cancel, confirm); panel.append(title, description, choice, status, actions); modal.append(panel)
  ctx.state.backdrop.append(modal)
  const closeModal = ctx.actions.manageChildDialog(modal, () => !busy)
  cancel.onclick = () => { if (!busy) closeModal() }
  confirm.onclick = async () => {
    if (busy || !modal.isConnected || ctx.state.destroyed) return
    if (changed()) { status.textContent = t('sprite.manager.content.delete.changed', '图包已更改，请取消后重新选择。'); return }
    busy = true; confirm.disabled = true; cancel.disabled = true; checkbox.disabled = true
    status.textContent = t('common.loading', '加载中...')
    let deleted = 0, failed = 0
    try {
      if (deleteLocal) for (const path of localPaths) {
        if (!modal.isConnected || ctx.state.destroyed) return
        if (changed()) throw new Error(t('sprite.manager.content.delete.changed', '图包已更改，请取消后重新选择。'))
        if (!deletableLocalSpritePaths(deps.getSettings(), packIds).includes(path)) continue
        try { await deps.adapter.deleteImage(path); deleted++ }
        catch (error) { console.warn('[sprite-overlay] 删除本地图片失败', { path, error }); failed++ }
      }
      if (!modal.isConnected || ctx.state.destroyed) return
      if (changed()) throw new Error(t('sprite.manager.content.delete.changed', '图包已更改，请取消后重新选择。'))
      if (failed > 0) {
        closeModal()
        toast(ctx.actions.currentManagerBody(), t('sprite.manager.content.delete.files_partial', '本地文件删除成功 {{p0}} 张，失败 {{p1}} 张；图包尚未删除，可再次重试', { p0: deleted, p1: failed }))
        return
      }
      deps.updateSettings(removePacks(deps.getSettings(), packIds))
      closeModal(); ctx.state.selectedPackIds.clear(); ctx.state.view = { kind: 'list' }; ctx.actions.render(); ctx.actions.refreshLightbox()
      toast(ctx.actions.currentManagerBody(), deleteLocal
        ? t('sprite.manager.content.delete.packs_and_files', '已删除 {{p0}} 个立绘包及 {{p1}} 张本地文件', { p0: packIds.length, p1: deleted })
        : t('sprite.manager.content.delete.packs_kept_files', '已删除 {{p0}} 个立绘包，本地文件未删除', { p0: packIds.length }))
    } catch (error) {
      if (modal.isConnected) status.textContent = error instanceof Error ? error.message : t('common.error', '错误')
    } finally {
      busy = false; confirm.disabled = false; cancel.disabled = false; checkbox.disabled = !localPaths.length
    }
  }
}
