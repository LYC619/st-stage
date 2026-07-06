/**
 * 立绘包管理弹窗：从悬浮窗齿轮按钮打开。
 * 功能：当前角色绑定、立绘包管理（新建/上传/删除/导入/导出）。
 * （原settings-panel 中的立绘包功能迁移至此，设置面板只保留基础开关）
 */

import type { PluginSettings, SpritePack } from '../../core/types'
import { bindCharacter, genId, removePack, toggleBinding, upsertPack } from '../../core/sprite-store'
import { exportPack, importPack } from '../../core/pack-io'
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

export function createSpriteManager(deps: ManagerDeps): ManagerController {
  let backdrop: HTMLElement | null = null

  function open(): void {
    if (backdrop) {
      renderBody()
      return
    }
    backdrop = document.createElement('div')
    backdrop.className = 'so-manager-backdrop'
    backdrop.addEventListener('click', (e) => {
      if (e.target === backdrop) close()
    })

    const dialog = document.createElement('div')
    dialog.className = 'so-manager'
    dialog.innerHTML = `
      <div class="so-manager-header">
        <b>立绘包管理</b>
        <div class="menu_button so-manager-close" title="关闭">✕</div>
      </div>
      <div class="so-manager-body"></div>
    `
    dialog.querySelector('.so-manager-close')?.addEventListener('click', () => close())
    backdrop.append(dialog)
    document.body.append(backdrop)
    renderBody()
  }

  function close(): void {
    backdrop?.remove()
    backdrop = null
  }

  function refreshIfOpen(): void {
    if (backdrop) renderBody()
  }

  function renderBody(): void {
    const body = backdrop?.querySelector('.so-manager-body') as HTMLElement | null
    if (!body) return
    const settings = deps.getSettings()
    const characterName = deps.adapter.getCurrentCharacterName()
    const binding = settings.bindings.find((b) => b.characterName === characterName)

    body.innerHTML = ''

    // 当前角色绑定
    const bindRow = document.createElement('div')
    bindRow.className = 'so-row'
    const bindLabel = document.createElement('span')
    bindLabel.textContent = characterName
      ? `角色「${characterName}」绑定：`
      : '请先打开一个角色聊天再绑定立绘包'
    bindRow.append(bindLabel)
    if (characterName) {
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
    }
    body.append(bindRow)

    // 立绘包列表
    const list = document.createElement('div')
    list.className = 'so-pack-list'
    for (const pack of settings.packs) {
      list.append(renderPackItem(pack, characterName))
    }
    body.append(list)

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
    body.append(actions)

    const status = document.createElement('div')
    status.className = 'so-status'
    body.append(status)

    function toast(msg: string) {
      status.textContent = msg
      setTimeout(() => {
        if (status.textContent === msg) status.textContent = ''
      }, 3000)
    }

    function commit(next: PluginSettings) {
      deps.updateSettings(next)
      renderBody()
    }

    function renderPackItem(pack: SpritePack, charName: string): HTMLElement {
      const item = document.createElement('div')
      item.className = 'so-pack-item'

      const info = document.createElement('div')
      info.className = 'so-pack-info'
      info.innerHTML = `<b>${pack.name}</b> <small>${pack.sprites.length} 张 · ${pack.author ?? ''}</small>`

      const btns = document.createElement('div')
      btns.className = 'so-btn-row'
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
              const url = await deps.adapter.saveImage(file.name, dataUri, charName || pack.name)
              const idx = sprites.findIndex((s) => s.tag === tag)
              if (idx >= 0) sprites[idx] = { tag, url }
              else sprites.push({ tag, url })
            }
            commit(upsertPack(current, { ...target, sprites }))
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
          commit(removePack(deps.getSettings(), pack.id))
        }),
      )

      const top = document.createElement('div')
      top.className = 'so-pack-top'
      top.append(info, btns)
      item.append(top)

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
  }

  return { open, close, refreshIfOpen }
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
  btn.className = 'menu_button so-btn'
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
