// UI flow adapted from 玉子手机 modules/settings-app/pages/appearance.js; resources use ST's existing image storage.
import type { PhoneApp } from '../../../../core/phone-registry'
import { compressImage } from '../../../../core/image-compress'
import { exportAppearance, fontUrl, imageUrl, importAppearance, readAppearance, type AppearanceData } from './pack'

export interface AppearanceDeps {
  applyAppearance(data: AppearanceData): void
  saveImage(dataUri: string): Promise<string>
  listApps(): PhoneApp[]
}
function text(tag: string, className: string, value: string): HTMLElement {
  const node = document.createElement(tag); node.className = className; node.textContent = value; return node
}

export function createAppearanceApp(deps: AppearanceDeps): PhoneApp {
  let cleanup: (() => void) | undefined
  return {
    id: 'appearance', name: '外观', icon: '🎨', order: 90,
    mount(container, ctx) {
      let alive = true
      const root = text('div', 'ap-root', ''), status = text('p', 'ap-status', '')
      status.setAttribute('role', 'status')
      const content = text('div', 'ap-content', '')
      root.append(text('h2', '', '外观'), status, content); container.append(root)
      const current = () => readAppearance(ctx.getAppData())
      function save(data: AppearanceData) { ctx.setAppData(data); deps.applyAppearance(data); render(); status.textContent = '已应用。' }
      async function act(work: () => void | Promise<void>) {
        status.textContent = ''
        try { await work() } catch (error) { if (alive) status.textContent = (error as Error).message }
      }
      function button(label: string, work: () => void | Promise<void>): HTMLButtonElement {
        const node = document.createElement('button'); node.type = 'button'; node.textContent = label
        node.onclick = () => { void act(work) }; return node
      }
      function section(title: string): HTMLElement {
        const node = text('section', 'ap-section', ''); node.append(text('h3', '', title)); content.append(node); return node
      }
      function field(label: string, value = '', type = 'text'): { row: HTMLElement; input: HTMLInputElement } {
        const row = text('label', 'ap-field', label), input = document.createElement('input')
        input.type = type; input.value = value; row.append(input); return { row, input }
      }
      function upload(label: string, size: number, apply: (url: string) => void): HTMLElement {
        const row = text('label', 'ap-upload', label), input = document.createElement('input')
        input.type = 'file'; input.accept = 'image/*'; row.append(input)
        input.onchange = () => {
          const file = input.files?.[0]; if (!file) return
          void act(async () => {
            input.disabled = true; status.textContent = '正在保存图片…'
            const image = await compressImage(file, { maxDimension: size })
            const url = await deps.saveImage(image.dataUri)
            if (alive) apply(url)
          }).finally(() => { input.disabled = false })
        }
        return row
      }
      function preview(url: string, emoji: string, label: string): HTMLElement {
        const box = text('div', 'ap-preview', '')
        if (url) { const image = document.createElement('img'); image.src = url; image.alt = label; image.onerror = () => { box.textContent = emoji }; box.append(image) }
        else box.textContent = emoji
        return box
      }
      function applyPack(value: string) {
        const pack = importAppearance(value, deps.listApps().map(app => app.id))
        if (window.confirm('导入会覆盖当前壁纸、图标和字体，继续吗？')) save(pack)
      }
      function render() {
        const data = current(); content.replaceChildren()
        const wallpaper = section('壁纸'), wallpaperPreview = preview(data.wallpaper, '默认壁纸', '主屏壁纸')
        wallpaperPreview.classList.add('ap-wallpaper')
        const wallpaperUrl = field('图片网址', data.wallpaper, 'url')
        wallpaper.append(wallpaperPreview, upload('上传图片', 1280, wallpaper => save({ ...current(), wallpaper })), wallpaperUrl.row,
          button('应用壁纸网址', () => save({ ...current(), wallpaper: imageUrl(wallpaperUrl.input.value) })),
          button('恢复默认壁纸', () => save({ ...current(), wallpaper: '' })))

        const icons = section('图标')
        for (const app of deps.listApps()) {
          const custom = data.icons[app.id], row = text('details', 'ap-icon-row', ''), summary = document.createElement('summary')
          summary.append(preview(custom?.image || '', custom?.emoji || app.icon, app.name), text('strong', '', app.name), text('span', 'ap-hint', '换图标'))
          const emoji = field(`${app.name} emoji`, custom?.emoji || ''), image = field(`${app.name}图片网址`, custom?.image || '', 'url')
          const change = (icon: { emoji?: string; image?: string }) => { const latest = current(); save({ ...latest, icons: { ...latest.icons, [app.id]: icon } }) }
          row.append(summary, emoji.row, button('应用 emoji', () => change({ emoji: emoji.input.value.trim() })),
            upload(`上传${app.name}图标`, 128, image => change({ image })), image.row,
            button('应用图标网址', () => change({ image: imageUrl(image.input.value) })), button('恢复图标', () => {
              const latest = current(); delete latest.icons[app.id]; save(latest)
            }))
          icons.append(row)
        }

        const fonts = section('字体'), selectLabel = text('label', 'ap-field', '当前字体'), select = document.createElement('select')
        const choices = [{ name: '', label: '系统默认' }, ...data.fonts.map(font => ({ name: font.name, label: font.name }))]
        for (const choice of choices) { const option = document.createElement('option'); option.value = choice.name; option.textContent = choice.label; select.append(option) }
        select.value = data.activeFont; select.onchange = () => save({ ...current(), activeFont: select.value })
        selectLabel.append(select)
        const css = field('字体 CSS 网址', '', 'url'), family = field('字体名（font-family）')
        fonts.append(selectLabel, css.row, family.row, button('添加网络字体', () => {
          const cssUrl = fontUrl(css.input.value), name = family.input.value.trim()
          if (!name) throw new Error('请填写字体名。')
          const latest = current(); save({ ...latest, fonts: [...latest.fonts.filter(font => font.name !== name), { name, family: name, cssUrl }], activeFont: name })
        }))

        const packs = section('外观包'), pasteLabel = text('label', 'ap-field', '粘贴外观包 JSON'), paste = document.createElement('textarea')
        paste.rows = 5; pasteLabel.append(paste)
        const fileLabel = text('label', 'ap-upload', '选择外观包文件'), file = document.createElement('input')
        file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file)
        file.onchange = () => {
          const selected = file.files?.[0]; if (!selected) return
          void act(async () => { const value = await selected.text(); if (alive) applyPack(value) })
        }
        packs.append(button('导出外观包', async () => {
          const value = exportAppearance(current()), url = URL.createObjectURL(new Blob([value], { type: 'application/json' })), link = document.createElement('a')
          link.href = url; link.download = '百工外观.json'; link.click(); URL.revokeObjectURL(url)
          await navigator.clipboard.writeText(value)
          if (alive) status.textContent = '外观包已复制并下载。'
        }), pasteLabel, button('导入粘贴的外观包', () => applyPack(paste.value)), fileLabel)
      }
      render(); cleanup = () => { alive = false; root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}
