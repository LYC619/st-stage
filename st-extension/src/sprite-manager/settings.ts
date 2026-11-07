import { type BindingConflict, type ConflictCheckedSettingsResult, genId, upsertPack, removePack, bindPack, previewBindingAddressChanges, setBinding } from '../../../core/sprite-store'
import { t } from '../../../core/i18n'
import type { PluginSettings, SpritePack } from '../../../core/types'
import { PackMergeChoiceError, previewPackMerge, type PackMergeChoice, validatePackMergeChoices, applyPackMerge, inspectPackImport } from '../../../core/pack-merge'
import { formatAddress } from '../../../core/types'
import { sanitizePackName } from '../../../core/naming'
import { prepareImportedPack } from '.././image-storage'
import { toast } from './ui'
import type { ManagerContext } from './types'

export function createSettings(ctx: ManagerContext) {
  const { deps } = ctx


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
    const message = t("sprite.manager.content.conflict.address", "操作未生效，存在地址冲突：{{p0}}", { p0: conflictText(conflicts) })
    const body = ctx.state.backdrop?.querySelector('.so-manager-body') as HTMLElement | null
    if (body) toast(body, message)
    else window.alert(message)
  }


  function rejectConflicts(conflicts: BindingConflict[]): false {
    ctx.actions.render()
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
    ctx.actions.commit(result.settings)
    return true
  }


  function rejectPackMergeError(error: unknown, body: HTMLElement): null {
    if (error instanceof PackMergeChoiceError) {
      toast(body, t("sprite.manager.content.merge.invalid", "合并已取消：选择无效（{{p0}}）", { p0: error.message }))
      return null
    }
    console.error('合并立绘包失败', error)
    toast(body, t("sprite.manager.content.merge.failed", "合并失败，请查看控制台日志"))
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
        t("sprite.manager.content.merge.choose_image", "地址「{{p0}}」有不同图片，请输入要保留的序号：\n{{p1}}", { p0: formatAddress(conflict.address), p1: options }),
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
    const rawName = window.prompt(t("sprite.manager.content.merge.name", "合并结果的包名："), defaultName)
    if (rawName === null) return null
    const name = sanitizePackName(rawName)
    if (!name) {
      toast(body, t("sprite.manager.content.merge.empty_name", "合并已取消：包名不能为空"))
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
      toast(body, t("sprite.manager.content.import.installed", "已导入立绘包「{{p0}}」（{{p1}} 张）", { p0: pack.name, p1: pack.sprites.length }))
      return true
    }

    const answer = window.prompt(
      t("sprite.manager.content.import.overlap", "检测到同名或地址重叠：{{p0}}\n", { p0: related.map((item) => item.name).join('、') }) +
        t("sprite.manager.content.import.choices", "输入 1 合并进现有包，2 重命名后安装，3 仅安装（之后可按需启用）；其他输入取消。"),
      '1',
    )
    if (answer === '1') {
      const target = related[0]
      // 二级选择：一级菜单保持 3 项防用户懵，合并去向在这里细分
      const mode = window.prompt(
        t("sprite.manager.content.merge.destination", "合并到哪里？\n1 并入旧包「{{p0}}」（推荐：角色绑定不变，重叠源包移除）\n2 合并为新包（所有源包保留）\n其他输入取消。", { p0: target.name }),
        '1',
      )
      if (mode === '1') {
        const merged = mergeWithPrompts([...related, pack], target.name, body)
        if (!merged) return false
        let next = settings
        for (const other of related.slice(1)) next = removePack(next, other.id)
        if (!updateChecked(upsertPack(next, { ...merged, id: target.id }))) return false
        toast(body, t("sprite.manager.content.merge.into_existing", "已合并进「{{p0}}」（{{p1}} 张）", { p0: merged.name, p1: merged.sprites.length }))
        return true
      }
      if (mode === '2') {
        const merged = mergeWithPrompts([...related, pack], `${target.name} 合并`, body)
        if (!merged || !updateChecked(upsertPack(settings, merged))) return false
        toast(body, t("sprite.manager.content.merge.created", "已生成合并包「{{p0}}」（{{p1}} 张），源包仍保留", { p0: merged.name, p1: merged.sprites.length }))
        return true
      }
      return false
    }
    if (answer === '2') {
      const rawName = window.prompt(t("sprite.manager.content.import.new_name", "请输入新的包名："), `${pack.name} 新`)
      if (rawName === null) return false
      const name = sanitizePackName(rawName)
      if (!name || settings.packs.some((existing) => existing.name === name)) {
        toast(body, t("sprite.manager.content.import.invalid_name", "未安装：新包名为空或仍与现有包同名"))
        return false
      }
      if (!updateChecked(upsertPack(settings, { ...pack, name }))) return false
      toast(body, t("sprite.manager.content.import.renamed", "已重命名并安装「{{p0}}」（未启用）", { p0: name }))
      return true
    }
    if (answer === '3') {
      if (!updateChecked(upsertPack(settings, pack))) return false
      toast(body, t("sprite.manager.content.import.not_enabled", "已安装「{{p0}}」，未加入当前角色", { p0: pack.name }))
      return true
    }
    return false
  }


  async function prepareAndInstall(pack: SpritePack, body: HTMLElement): Promise<void> {
    if (ctx.state.destroyed || !ctx.state.backdrop || ctx.actions.currentManagerBody() !== body) return
    if (ctx.state.storageDialog) {
      toast(body, t("sprite.manager.content.import.close_storage", "请先关闭存储检查与迁移窗口"))
      return
    }
    if (ctx.state.importController) {
      toast(body, t("sprite.manager.content.import.busy", "已有导入任务正在处理"))
      return
    }
    const controller = new AbortController()
    ctx.state.importController = controller
    try {
      toast(body, t("sprite.manager.content.import.preparing", "正在准备导入图片"))
      const prepared = await prepareImportedPack(pack, {
        save: (dataUri, options) => deps.saveDataUri
          ? deps.saveDataUri(dataUri, options)
          : deps.adapter.saveDataUri(dataUri, options),
      }, {
        signal: controller.signal,
        onProgress: (completed, total) => {
          if (!ctx.state.destroyed && !controller.signal.aborted && ctx.actions.currentManagerBody() === body) {
            toast(body, t("sprite.manager.content.import.progress", "导入图片校验 {{p0}}/{{p1}}", { p0: completed, p1: total }))
          }
        },
      })
      if (ctx.state.destroyed || controller.signal.aborted || !ctx.state.backdrop) return
      const activeBody = ctx.actions.currentManagerBody()
      if (!activeBody || activeBody !== body) return
      if (!installImportedPack(prepared, activeBody)) return
      const installed = deps.getSettings().packs.find((item) => item.id === prepared.id)
      if (installed) ctx.state.view = { kind: 'pack', packId: installed.id }
      ctx.actions.render()
    } catch (error) {
      if (!controller.signal.aborted && !ctx.state.destroyed) toast(body, error instanceof Error ? error.message : t("sprite.manager.content.import.failed", "导入失败"))
    } finally {
      if (ctx.state.importController === controller) ctx.state.importController = null
    }
  }


  function bindPackWithChoices(characterName: string, packId: string, body: HTMLElement): void {
    const settings = deps.getSettings()
    const result = bindPack(settings, characterName, packId)
    if (result.ok) {
      const changes = previewBindingAddressChanges(settings, result.settings, characterName)
      if (
        changes.removed.length > 0 &&
        !window.confirm(
          t("sprite.manager.content.binding.address_changes", "启用后以下旧地址将变化：{{p0}}\n", { p0: changes.removed.slice(0, 6).join('、') }) +
            t("sprite.manager.content.binding.new_addresses", "新地址示例：{{p0}}\n仍要继续吗？", { p0: changes.added.slice(0, 6).join('、') }),
        )
      ) return
      ctx.actions.commit(result.settings)
      return
    }
    const answer = window.prompt(
      t("sprite.manager.content.binding.conflict", "启用会产生地址冲突：{{p0}}\n", { p0: conflictText(result.conflicts) }) +
        t("sprite.manager.content.binding.choices", "输入 1 替换当前冲突包，2 合并为新包后启用；其他输入取消。"),
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
      ctx.actions.commit(rebound.settings)
      toast(body, t("sprite.manager.content.binding.merged", "已生成并启用合并包「{{p0}}」；源包仍保留", { p0: merged.name }))
    }
  }


  /** 修改单个包并提交 */
  function commitPack(pack: SpritePack): void {
    commitChecked(upsertPack(deps.getSettings(), pack))
  }

  return { conflictText, showConflicts, rejectConflicts, checkedSettings, updateChecked, commitChecked, rejectPackMergeError, mergeWithPrompts, installImportedPack, prepareAndInstall, bindPackWithChoices, commitPack }
}
