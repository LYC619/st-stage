import { t } from '../../../../core/i18n'
import { createProfileEditor } from './profile-editor'
import { normalizeProfile } from './profile'
import { addProfileTemplate, decodeProfileTemplate, encodeProfileTemplate, hasCharacterProfile, inheritProfile, normalizeTemplates, ProfileLibraryError, resolveProfile, saveScopedProfile } from './profile-library'
import type { WeChatAppData, WeChatConfig } from './types'
import type { SpritePack } from '../../../../core/types'

/** The form is a draft. Applying/importing a template never changes a conversation until Save. */
export function createProfileSettings(parent: HTMLElement, data: WeChatAppData, persist: () => void, options: { packs?: () => SpritePack[]; preview?: (profile: ReturnType<typeof normalizeProfile>) => string } = {}) {
  const root = document.createElement('section')
  root.className = 'wt-profile-settings'
  root.style.cssText = 'display:flex;flex-direction:column;gap:10px;min-width:0;flex-shrink:0;font-size:12px;color:#222;'
  parent.insertBefore(root, parent.querySelector('#wt-settings-actions'))
  const label = <T extends HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(text: string, input: T): T => {
    const wrapper = document.createElement('label'); wrapper.textContent = text
    wrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;min-width:0;'
    input.style.cssText = 'width:100%;min-width:0;min-height:40px;box-sizing:border-box;border:1px solid #aaa;border-radius:5px;padding:7px;font:inherit;background:#fff;color:#222;'
    input.setAttribute('aria-label', text); wrapper.append(input); root.append(wrapper); return input
  }
  const scope = label('正在编辑', document.createElement('select')); scope.dataset.profileScope = ''
  const status = document.createElement('p'); status.setAttribute('role', 'status'); status.style.cssText = 'margin:0;line-height:1.5;overflow-wrap:anywhere;'
  const hint = document.createElement('p'); hint.style.cssText = 'margin:0;line-height:1.5;'
  root.append(hint)
  const editor = createProfileEditor(root, options.packs)
  let characterKey: string | null = null
  let resetOverride = false
  const reset = document.createElement('button'); reset.type = 'button'; reset.textContent = '此联系人改用通用设置'
  root.insertBefore(reset, editor.element)
  function fillScope() {
    editor.fill(scope.value === 'global' ? normalizeProfile(data.config) : resolveProfile(data.config, characterKey))
    editor.setDisabled(false)
    reset.hidden = !characterKey || !hasCharacterProfile(data.config, characterKey) || resetOverride
    hint.textContent = scope.value === 'global'
      ? (characterKey && hasCharacterProfile(data.config, characterKey) && !resetOverride ? '修改所有使用通用设置的联系人。此联系人目前有专用设置；下方按钮可将其改回通用设置。' : '所有没有专用设置的联系人都会使用这里的内容。')
      : '只影响此联系人，其他联系人继续使用各自的设置。首次保存时会建立专用设置。'
  }
  reset.onclick = () => { resetOverride = true; scope.value = 'global'; fillScope(); status.textContent = '此联系人将在保存后改用通用设置。' }
  scope.onchange = () => { resetOverride = false; fillScope(); status.textContent = '' }
  const templatePanel = document.createElement('details'); templatePanel.dataset.profileTemplatePanel = ''
  const templateSummary = document.createElement('summary'); templateSummary.textContent = '场景模板 · 保存、导入与导出'
  templatePanel.append(templateSummary); root.append(templatePanel)
  const templates = label(t('wechatProfiles.templates', '场景模板'), document.createElement('select')); templates.dataset.profileTemplates = ''
  const name = label(t('wechatProfiles.name', '模板名称'), document.createElement('input')); name.maxLength = 60
  const controls = document.createElement('div'); controls.style.cssText = 'display:flex;flex-wrap:wrap;gap:6px;'
  root.append(controls)
  function action(text: string, run: () => void) {
    const button = document.createElement('button'); button.type = 'button'; button.textContent = text
    button.style.cssText = 'min-height:40px;padding:7px 10px;border:1px solid #aaa;border-radius:5px;background:#f7f7f7;color:#222;font:inherit;white-space:normal;'
    button.onclick = () => {
      try { run() } catch (error) {
        status.textContent = error instanceof ProfileLibraryError
          ? ({ invalid: t('wechatProfiles.invalid', '模板格式或内容无效（最多 64 KB，只接受场景字段）。'), name: t('wechatProfiles.nameError', '模板名称需为 1–60 个字符。'), duplicate: t('wechatProfiles.duplicate', '模板名称已存在，请换一个名称。'), limit: t('wechatProfiles.limit', '最多保存 30 个模板，请先删除不用的模板。') })[error.code]
          : error instanceof Error ? error.message : t('wechatProfiles.invalid', '模板格式或内容无效（最多 64 KB，只接受场景字段）。')
      }
    }; controls.append(button); return button
  }
  const selected = () => normalizeTemplates(data.profileTemplates).find(item => item.id === templates.value)
  function refreshTemplates(id?: string) {
    templates.replaceChildren(new Option(t('wechatProfiles.choose', '选择已保存模板'), ''))
    for (const item of normalizeTemplates(data.profileTemplates)) templates.add(new Option(item.name, item.id))
    templates.value = id ?? ''; remove.dataset.confirm = ''; remove.textContent = t('wechatProfiles.delete', '删除模板')
  }
  function preview(profile: ReturnType<typeof normalizeProfile>) {
    editor.fill(profile)
    status.textContent = t('wechatProfiles.previewed', '已填入表单供预览。点击下方“保存”后才会用于会话。')
  }
  action(t('wechatProfiles.apply', '预览套用'), () => { const item = selected(); if (item) { preview(item.profile); name.value = item.name } else { status.textContent = '请先选择模板。' } })
  action(t('wechatProfiles.saveTemplate', '保存为模板'), () => {
    data.profileTemplates = addProfileTemplate(normalizeTemplates(data.profileTemplates), name.value, editor.read())
    persist(); refreshTemplates(data.profileTemplates.at(-1)?.id); status.textContent = t('wechatProfiles.saved', '模板已保存。会话配置尚未改变。')
  })
  const remove = action(t('wechatProfiles.delete', '删除模板'), () => {
    const item = selected(); if (!item) { status.textContent = '请先选择要删除的模板。'; return }
    if (remove.dataset.confirm !== item.id) { remove.dataset.confirm = item.id; remove.textContent = t('wechatProfiles.confirmDelete', '再次点击确认删除'); status.textContent = item.name; return }
    data.profileTemplates = normalizeTemplates(data.profileTemplates).filter(entry => entry.id !== item.id)
    persist(); refreshTemplates(); status.textContent = t('wechatProfiles.deleted', '模板已删除。已保存的角色配置保留。')
  })
  templates.onchange = () => { remove.dataset.confirm = ''; remove.textContent = t('wechatProfiles.delete', '删除模板'); const item = selected(); if (item) name.value = item.name }
  const transfer = label(t('wechatProfiles.transfer', '模板 JSON（粘贴导入或复制导出）'), document.createElement('textarea')); transfer.rows = 3; transfer.maxLength = 65536; transfer.spellcheck = false
  root.append(controls)
  action(t('wechatProfiles.import', '导入并预览'), () => { const item = decodeProfileTemplate(transfer.value); name.value = item.name; preview(item.profile) })
  action(t('wechatProfiles.export', '导出当前表单'), () => { transfer.value = encodeProfileTemplate(name.value, editor.read()); transfer.focus(); transfer.select(); status.textContent = t('wechatProfiles.exported', '已生成 JSON，可复制保存；仅包含场景配置。') })
  // Templates are deliberately low frequency; keep their controls together and collapsed.
  templatePanel.append(templates.parentElement!, name.parentElement!, transfer.parentElement!, controls)
  if (options.preview) {
    const previewButton = document.createElement('button'); previewButton.type = 'button'; previewButton.textContent = '预览实际发送的提示词'
    const previewText = document.createElement('textarea'); previewText.readOnly = true; previewText.rows = 10; previewText.hidden = true; previewText.setAttribute('aria-label', '实际提示词预览')
    previewButton.onclick = () => { try { previewText.value = options.preview!(editor.read()); previewText.hidden = false; status.textContent = '以下预览使用当前表单与当前联系人，尚未保存。' } catch (error) { status.textContent = (error as Error).message } }
    root.insertBefore(previewButton, templatePanel); root.insertBefore(previewText, templatePanel)
  }
  root.append(status)

  return {
    open(key: string | null, assets = false) {
      characterKey = key; resetOverride = false
      scope.replaceChildren(new Option('通用设置', 'global'))
      if (key) scope.append(new Option('此联系人专用设置', 'character'))
      scope.value = data.profileEditorScopes?.[key ?? 'global'] ?? (key && hasCharacterProfile(data.config, key) ? 'character' : 'global')
      fillScope(); refreshTemplates(); name.value = ''; transfer.value = ''; status.textContent = ''; templatePanel.open = false
      if (assets) editor.showAssets()
    },
    save(config: WeChatConfig): WeChatConfig {
      const target = scope.value === 'character' ? characterKey : null
      const next = saveScopedProfile(resetOverride && characterKey ? inheritProfile(config, characterKey) : config, target, editor.read())
      data.profileEditorScopes = { ...data.profileEditorScopes, [characterKey ?? 'global']: target ? 'character' : 'global' }
      status.textContent = ''
      return next
    },
  }
}
