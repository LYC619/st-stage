/**
 * ST 扩展设置面板（原生 DOM，挂载到 #extensions_settings）。
 * 功能：总开关、隐藏标签、角色绑定、立绘包管理（新建/上传/删除/导入/导出）。
 */

import type { PluginSettings, SpritePack } from '../../core/types'
import { bindCharacter, genId, removePack, toggleBinding, upsertPack } from '../../core/sprite-store'
import { exportPack, importPack } from '../../core/pack-io'
import type { STAdapter } from './st-adapter'

interface PanelDeps {
  adapter: STAdapter
  getSettings: () => PluginSettings
  updateSettings: (next: PluginSettings) => void
}

export function mountSettingsPanel(deps: PanelDeps): void {
  const container = document.getElementById('extensions_settings')
  if (!container) {
    console.warn('[sprite-overlay] 未找到 #extensions_settings，设置面板未挂载')
    return
  }

  const wrapper = document.createElement('div')
  wrapper.className = 'sprite-overlay-settings'
  wrapper.innerHTML = `
    <div class="inline-drawer">
      <div class="inline-drawer-toggle inline-drawer-header">
        <b>角色立绘悬浮窗</b>
        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
      </div>
      <div class="inline-drawer-content" id="so-panel-content"></div>
    </div>
  `
  container.append(wrapper)

  const content = wrapper.querySelector('#so-panel-content') as HTMLElement
  render(content, deps)
}

function render(content: HTMLElement, deps: PanelDeps): void {
  const settings = deps.getSettings()
  const characterName = deps.adapter.getCurrentCharacterName()
  const binding = settings.bindings.find((b) => b.characterName === characterName)

  content.innerHTML = ''

  // 全局开关
  content.append(
    checkboxRow('启用立绘悬浮窗', settings.enabled, (v) =>
      commit({ ...deps.getSettings(), enabled: v }),
    ),
    checkboxRow('消息中隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
      commit({ ...deps.getSettings(), hideTagInMessage: v }),
    ),
  )

  // 当前角色绑定
  const bindRow = document.createElement('div')
  bindRow.className = 'so-row'
  const bindLabel = document.createElement('span')
  bindLabel.textContent = `当前角色「${characterName || '未选择'}」绑定：`
  const select = document.createElement('select')
  select.className = 'text_pole'
  select.innerHTML =
    '<option value="">选择立绘包…</option>' +
    settings.packs
      .map(
        (p) =>
          `<option value="${p.id}" ${binding?.packId === p.id ? 'selected' : ''}>${p.name}（${p.sprites.length} 张）</option>`,
      )
      .join('')
  select.addEventListener('change', () => {
    if (!characterName || !select.value) return
    commit(bindCharacter(deps.getSettings(), characterName, select.value))
  })
  bindRow.append(bindLabel, select)
  if (binding) {
    bindRow.append(
      checkboxRow('启用', binding.enabled, (v) =>
        commit(toggleBinding(deps.getSettings(), characterName, v)),
      ),
    )
  }
  content.append(bindRow)

  // 立绘包列表
  const list = document.createElement('div')
  list.className = 'so-pack-list'
  for (const pack of settings.packs) {
    list.append(renderPackItem(pack, deps, characterName))
  }
  content.append(list)

  // 新建 / 导入
  const actions = document.createElement('div')
  actions.className = 'so-row'
  const nameInput = document.createElement('input')
  nameInput.type = 'text'
  nameInput.className = 'text_pole'
  nameInput.placeholder = '新立绘包名称…'
  const createBtn = button('新建立绘包', () => {
    const name = nameInput.value.trim()
    if (!name) return
    commit(upsertPack(deps.getSettings(), { id: genId(), name, author: '我', sprites: [] }))
    nameInput.value = ''
  })
  const importBtn = button('导入立绘包', () => {
    pickFile('.json,application/json', false, async (files) => {
      try {
        const text = await files[0].text()
        const pack = importPack(text)
        commit(upsertPack(deps.getSettings(), pack))
        toast(`已导入「${pack.name}」（${pack.sprites.length} 张）`)
      } catch (err) {
        toast(err instanceof Error ? err.message : '导入失败')
      }
    })
  })
  actions.append(nameInput, createBtn, importBtn)
  content.append(actions)

  const status = document.createElement('div')
  status.className = 'so-status'
  content.append(status)

  function toast(msg: string) {
    status.textContent = msg
    setTimeout(() => {
      if (status.textContent === msg) status.textContent = ''
    }, 3000)
  }

  function commit(next: PluginSettings) {
    deps.updateSettings(next)
    render(content, deps)
  }
}

function renderPackItem(pack: SpritePack, deps: PanelDeps, characterName: string): HTMLElement {
  const item = document.createElement('div')
  item.className = 'so-pack-item'

  const info = document.createElement('div')
  info.innerHTML = `<b>${pack.name}</b> <small>${pack.sprites.length} 张 · ${pack.author ?? ''}</small>`

  const btns = document.createElement('div')
  btns.className = 'so-row'

  btns.append(
    button('上传图片', () => {
      pickFile('image/*', true, async (files) => {
        const current = deps.getSettings()
        const target = current.packs.find((p) => p.id === pack.id)
        if (!target) return
        const sprites = [...target.sprites]
        for (const file of Array.from(files)) {
          const tag = file.name.replace(/\.[^.]+$/, '').trim()
          if (!tag) continue
          const dataUri = await fileToDataUri(file)
          const url = await deps.adapter.saveImage(file.name, dataUri, characterName || pack.name)
          const idx = sprites.findIndex((s) => s.tag === tag)
          if (idx >= 0) sprites[idx] = { tag, url }
          else sprites.push({ tag, url })
        }
        deps.updateSettings(upsertPack(current, { ...target, sprites }))
        // 重渲染由 updateSettings 外层触发不了，这里手动刷新
        const content = item.closest('#so-panel-content') as HTMLElement | null
        if (content) render(content, deps)
      })
    }),
    button('导出', async () => {
      const file = await exportPack(pack, false)
      const blob = new Blob([JSON.stringify(file, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${pack.name}.sprite-pack.json`
      a.click()
      URL.revokeObjectURL(url)
    }),
    button('删除', () => {
      if (!window.confirm(`确定删除立绘包「${pack.name}」？`)) return
      const content = item.closest('#so-panel-content') as HTMLElement | null
      deps.updateSettings(removePack(deps.getSettings(), pack.id))
      if (content) render(content, deps)
    }),
  )

  item.append(info, btns)

  if (pack.sprites.length > 0) {
    const thumbs = document.createElement('div')
    thumbs.className = 'so-thumbs'
    for (const s of pack.sprites) {
      const img = document.createElement('img')
      img.src = s.url
      img.alt = s.tag
      img.title = s.tag
      img.loading = 'lazy'
      thumbs.append(img)
    }
    item.append(thumbs)
  }

  return item
}

function checkboxRow(label: string, checked: boolean, onChange: (v: boolean) => void): HTMLElement {
  const row = document.createElement('label')
  row.className = 'so-row checkbox_label'
  const input = document.createElement('input')
  input.type = 'checkbox'
  input.checked = checked
  input.addEventListener('change', () => onChange(input.checked))
  const span = document.createElement('span')
  span.textContent = label
  row.append(input, span)
  return row
}

function button(label: string, onClick: () => void): HTMLElement {
  const btn = document.createElement('div')
  btn.className = 'menu_button'
  btn.textContent = label
  btn.addEventListener('click', onClick)
  return btn
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

function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}
