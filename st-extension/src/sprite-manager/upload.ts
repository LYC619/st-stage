import { parseSpriteFileName, normalizeTag } from '../../../core/naming'
import { type ConflictStrategy, type UploadEntry, planUploads } from '../../../core/pack-split'
import { t } from '../../../core/i18n'
import type { Sprite, SpritePack } from '../../../core/types'
import { type ConflictCheckedSettingsResult, localUserImagePath, genId, upsertPack, upsertSprite } from '../../../core/sprite-store'
import { compressImage } from '../../../core/image-compress'
import { uploadToImgbb, isValidImgbbResult } from '../../../core/imgbb'
import { getSpriteSource } from '../../../core/types'
import { urlToDataUri } from '../../../core/pack-io'
import { el, nextManagerId, textInput, labeled, checkboxRow, button, toast } from './ui'
import type { ManagerContext } from './types'

export function createUpload(ctx: ManagerContext) {
  const { deps } = ctx


  /**
   * 批量上传预览弹窗（八期）：解析文件名 → 让用户修正/选择不拆分/选重名策略 → 确认后执行。
   * 上传前必须预览，不静默落库。
   */
  function openUploadPreview(currentPackId: string, files: FileList, opener?: HTMLElement | null): void {
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
    title.textContent = t("sprite.manager.content.upload.preview_title", "批量上传预览（{{p0}} 张）", { p0: fileArr.length })
    title.id = nextManagerId()
    modal.setAttribute('aria-labelledby', title.id)
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
        const roleIn = textInput(t("sprite.manager.content.info.role", "人名"))
        const outfitIn = textInput(t("sprite.manager.content.info.outfit", "服装"))
        const tagIn = textInput(t("sprite.manager.content.info.image_name", "图名"))
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
          labeled(t("sprite.manager.content.info.role", "人名"), roleIn),
          labeled(t("sprite.manager.content.info.outfit", "服装"), outfitIn),
          labeled(t("sprite.manager.content.info.image_name", "图名"), tagIn),
        )
        rows.append(row)
      })
    }
    buildRows()

    const opts = el('div', 'so-upload-opts')
    opts.append(
      checkboxRow(t("sprite.manager.content.upload.auto_split", "按文件名前缀自动拆分人名/服装（勾选后在下方预览拆分结果，可拆出新包）"), autoSplit, (v) => {
        autoSplit = v
        buildRows()
      }),
    )
    const stratWrap = el('div', 'so-row')
    const stratLabel = el('span')
    stratLabel.textContent = t("sprite.manager.content.upload.conflict_label", "重名时：")
    stratLabel.id = nextManagerId()
    const stratSel = document.createElement('select')
    stratSel.className = 'text_pole'
    stratSel.setAttribute('aria-labelledby', stratLabel.id)
    for (const [val, lab] of [
      ['skip', t("sprite.manager.content.upload.skip", "跳过（默认）")],
      ['rename', t("sprite.manager.content.upload.rename", "自动改名")],
      ['overwrite', t("sprite.manager.content.upload.overwrite", "覆盖")],
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
    status.setAttribute('role', 'status')
    const actions = el('div', 'so-row so-upload-actions')
    const confirmBtn = button(t("sprite.manager.content.upload.start", "开始上传"), () => {
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
      void applyUploadPlan(currentPackId, fileArr, entries, strategy, status, () => closeModal()).finally(
        () => {
          uploading = false
          confirmBtn.removeAttribute('aria-disabled')
          confirmBtn.classList.remove('disabled')
        },
      )
    })
    const cancelBtn = button(
      t("common.cancel", "取消"),
      () => {
        if (!uploading) closeModal()
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
    ;(ctx.state.backdrop ?? document.body).append(modal)
    const closeModal = ctx.actions.manageChildDialog(modal, () => !uploading, opener)
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
    // 本批新建的包：同 [role, outfit, packName] 复用同一个新 id
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
          ctx.actions.showConflicts(result.conflicts)
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
        status.textContent = t("sprite.manager.content.upload.progress", "处理中 {{p0}}/{{p1}}：{{p2}}", { p0: i + 1, p1: plans.length, p2: file.name })
        if (plan.action === 'skip' || !plan.finalTag) {
          skipped++
          continue
        }
        try {
          const batchKey = JSON.stringify([plan.entry.role, plan.entry.outfit, plan.targetPackName])
          const beforeId = plan.targetPackId ?? newPackIds.get(batchKey)
          const beforeTarget = deps.getSettings().packs.find(pack => pack.id === beforeId)
          if (beforeId && !beforeTarget) throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"))
          const beforeUrl = beforeTarget ? ctx.actions.sameSprite(beforeTarget, { tag: plan.finalTag, url: '' })?.url : undefined
          const result = await compressImage(file)
          if (result.transparency === 'opaque-checkerboard') checkerboardImages += 1
          else if (result.transparency === 'opaque') opaqueImages += 1
          const url = await deps.adapter.saveImage(
            file.name,
            result.dataUri,
            plan.targetPackName, // 显示提示；物理文件身份由适配器独立生成
          )

          if (!localUserImagePath(url)) throw new Error(t("sprite.manager.content.error.unsafe_local", "保存失败：平台未返回安全的本地用户图片地址"))

          // 解析/新建目标包
          let targetId = plan.targetPackId
          if (!targetId) {
            const role = plan.entry.role
            const outfit = plan.entry.outfit
            const key = JSON.stringify([role, outfit, plan.targetPackName])
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
          const latestSprite = ctx.actions.sameSprite(target, { tag: plan.finalTag, url: '' })
          if (latestSprite?.url !== beforeUrl) throw new Error(t("sprite.manager.content.error.target_changed", "目标已更改，本次结果未应用"))
          const sprite: Sprite = { ...latestSprite, tag: plan.finalTag, url }
          delete sprite.code
          delete sprite.remoteUrl
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
                const latestSprite = latest ? ctx.actions.sameSprite(latest, sprite) : null
                if (latest && latestSprite?.url === url) {
                  // 只为本次保存的图片补远程元数据，不覆盖上传期间的编辑。
                  const hostedSprite: Sprite = { ...latestSprite, code: up.code, remoteUrl: up.url }
                  if (applyUploadSettings(upsertPack(deps.getSettings(), upsertSprite(latest, hostedSprite)), () =>
                    persisted(targetId, hostedSprite),
                  )) hosted++
                  else hostFailed++
                } else {
                  hostFailed++
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
        ctx.actions.render()
      } catch (error) {
        console.error('[sprite-overlay] 上传后刷新失败', error)
      }
      const parts = [
        t("sprite.manager.content.upload.result_success", "成功 {{p0}} 张", { p0: added }),
        t("sprite.manager.content.upload.result_conflict", "冲突 {{p0}} 张", { p0: conflicts }),
        t("sprite.manager.content.upload.result_failed", "失败 {{p0}} 张", { p0: failed }),
        t("sprite.manager.content.upload.result_unprocessed", "未处理 {{p0}} 张", { p0: unprocessed }),
      ]
      if (skipped > 0) parts.push(t("sprite.manager.content.upload.result_skipped", "跳过 {{p0}} 张（重名/无效）", { p0: skipped }))
      if (useImgbb) parts.push(t("sprite.manager.content.upload.result_hosted", "imgbb 成功 {{p0}}{{p1}}", { p0: hosted, p1: hostFailed > 0 ? t("sprite.manager.content.upload.host_failed_suffix", "、失败 {{p0}}", { p0: hostFailed }) : '' }))
      if (checkerboardImages > 0) {
        parts.push(t("sprite.manager.content.upload.checkerboard_warning", "警告：{{p0}} 张疑似把棋盘格烤进图片，插件无法安全自动去除", { p0: checkerboardImages }))
      }
      if (opaqueImages > 0) {
        parts.push(t("sprite.manager.content.upload.opaque_notice", "提示：{{p0}} 张没有透明像素，作为立绘时会显示完整背景", { p0: opaqueImages }))
      }
      try {
        toast(ctx.state.backdrop?.querySelector('.so-manager-body') as HTMLElement, parts.join('，'))
      } catch (error) {
        console.error('[sprite-overlay] 展示上传结果失败', error)
      }
    }
  }


  /** 补传待上传立绘到 imgbb（失败重试）：fetch 本地图 → 上传 → 绑 remoteUrl+code，本地 url 保留 */
  async function retryPendingUploads(body: HTMLElement, packId: string): Promise<void> {
    const { imgbbApiKey } = deps.getSettings()
    if (!imgbbApiKey.trim()) {
      toast(body, t("sprite.manager.content.upload.api_key", "请先在「图库」App 配置 imgbb API Key"))
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
      const beforeUrl = sprite.url
      toast(body, t("sprite.manager.content.upload.retry_progress", "补传中 {{p0}}/{{p1}}：{{p2}}", { p0: i + 1, p1: pending.length, p2: sprite.tag }))
      try {
        const dataUri = beforeUrl.startsWith('data:') ? beforeUrl : await urlToDataUri(beforeUrl)
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
        if (!latest || !target || target.url !== beforeUrl) {
          fail++
          continue
        }
        // 保留本地 url 作保底，补上远程 remoteUrl + code
        if (
          !ctx.actions.updateChecked(
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
    ctx.actions.render()
    toast(
      ctx.state.backdrop?.querySelector('.so-manager-body') as HTMLElement,
      t("sprite.manager.content.upload.retry_complete", "补传完成：成功 {{p0}} 张{{p1}}", { p0: ok, p1: fail > 0 ? t("sprite.manager.content.upload.retry_failed_suffix", "，失败 {{p0}} 张（可再次点击重试）", { p0: fail }) : '' }),
    )
  }

  return { openUploadPreview, applyUploadPlan, retryPendingUploads }
}
