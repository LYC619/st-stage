import { safeCopyText } from '../shared/safe-runtime'
// UI flow adapted from 玉子手机 modules/settings-app/pages/appearance.js; resources use ST's existing image storage.
import type { PhoneApp } from '../../../../core/phone-registry'
import { getPackCover } from '../../../../core/types'
import { getActivePacks } from '../../../../core/sprite-store'
import { compressImage } from '../../../../core/image-compress'
import {
  exportAppearance,
  fontUrl,
  imageUrl,
  importAppearance,
  PHONE_THEMES,
  readAppearance,
  resolveEffectiveAppearance,
  type AppearanceData,
} from './pack'

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
    id: 'appearance',
    name: '外观',
    icon: '🎨',
    order: 90,
    fullbleed: true,
    mount(container, ctx) {
      let alive = true
      const openIconIds = new Set<string>()
      const root = text('div', 'ap-root', ''), status = text('p', 'ap-status', '')
      status.setAttribute('role', 'status')
      const content = text('div', 'ap-content', '')
      root.append(text('h2', '', '外观'), status, content)
      container.append(root)

      const current = () => readAppearance(ctx.getAppData())
      function save(data: AppearanceData, msg = '已应用。') {
        const clean = readAppearance(data)
        ctx.setAppData(clean)
        deps.applyAppearance(clean)
        render()
        status.textContent = msg
      }
      async function act(work: () => void | Promise<void>) {
        status.textContent = ''
        try { await work() } catch (error) { if (alive) status.textContent = (error as Error).message }
      }
      function button(label: string, work: () => void | Promise<void>, className = ''): HTMLButtonElement {
        const node = document.createElement('button')
        node.type = 'button'
        if (className) node.className = className
        node.textContent = label
        node.onclick = () => { void act(work) }
        return node
      }
      function section(title: string): HTMLElement {
        const node = text('section', 'ap-section', '')
        node.append(text('h3', '', title))
        content.append(node)
        return node
      }
      function field(label: string, value = '', type = 'text'): { row: HTMLElement; input: HTMLInputElement } {
        const row = text('label', 'ap-field', label), input = document.createElement('input')
        input.type = type; input.value = value; row.append(input)
        return { row, input }
      }
      function sliderField(label: string, value: number, min: number, max: number, unit: string, onCommit: (val: number) => void): HTMLElement {
        const row = text('label', 'ap-field ap-slider-row', '')
        const top = text('span', 'ap-slider-head', '')
        const valOut = text('small', 'ap-hint', `${value}${unit}`)
        top.append(text('span', '', label), valOut)
        const input = document.createElement('input')
        input.type = 'range'
        input.min = String(min)
        input.max = String(max)
        input.value = String(value)
        input.oninput = () => { valOut.textContent = `${input.value}${unit}` }
        input.onchange = () => onCommit(Number(input.value))
        row.append(top, input)
        return row
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
        if (url) {
          const image = document.createElement('img')
          image.src = url; image.alt = label
          image.onerror = () => { box.textContent = emoji }
          box.append(image)
        } else {
          box.textContent = emoji
        }
        return box
      }
      function applyPack(value: string) {
        const pack = importAppearance(value, deps.listApps().map(app => app.id))
        if (window.confirm('导入会覆盖当前壁纸、主题、图标和字体，继续吗？')) save(pack)
      }

      function withBoundSync(base: AppearanceData, charName: string, patch: { theme?: AppearanceData['theme']; wallpaper?: string }): AppearanceData {
        if (!charName || !base.characterSkins?.[charName]) return base
        return {
          ...base,
          characterSkins: {
            ...base.characterSkins,
            [charName]: {
              ...base.characterSkins[charName],
              ...(patch.theme !== undefined ? { theme: patch.theme || 'midnight' } : {}),
              ...(patch.wallpaper !== undefined ? { wallpaper: patch.wallpaper } : {}),
            },
          },
        }
      }

      function render() {
        const rawData = current()
        const charName = typeof ctx.getCharacterName === 'function' ? ctx.getCharacterName().trim() : ''
        const data = resolveEffectiveAppearance(rawData, charName)
        content.replaceChildren()

        // 1. 主题气韵
        const themeSec = section('主题风格')
        const themeGrid = text('div', 'ap-theme-grid', '')
        const activeTheme = data.theme || 'midnight'
        for (const preset of PHONE_THEMES) {
          const chip = document.createElement('button')
          chip.type = 'button'
          chip.className = `ap-theme-chip${activeTheme === preset.id ? ' is-active' : ''}`
          chip.dataset.themeId = preset.id
          chip.append(text('strong', '', preset.label), text('small', '', preset.desc))
          chip.onclick = () => {
            const nextTheme = preset.id === 'midnight' ? undefined : preset.id
            save(withBoundSync({ ...current(), theme: nextTheme }, charName, { theme: preset.id }), `已切换至「${preset.label}」主题。`)
          }
          themeGrid.append(chip)
        }
        themeSec.append(themeGrid)

        // 2. 壁纸与角色专属皮肤
        const wallpaper = section('壁纸')
        const wallpaperPreview = preview(data.wallpaper, '默认壁纸', '主屏壁纸')
        wallpaperPreview.classList.add('ap-wallpaper')
        const wallpaperUrl = field('图片网址', data.wallpaper, 'url')
        wallpaper.append(
          wallpaperPreview,
          upload('上传图片', 1280, w => save(withBoundSync({ ...current(), wallpaper: w }, charName, { wallpaper: w }))),
          wallpaperUrl.row,
          button('应用壁纸网址', () => {
            const w = imageUrl(wallpaperUrl.input.value)
            save(withBoundSync({ ...current(), wallpaper: w }, charName, { wallpaper: w }))
          }),
          button('恢复默认壁纸', () => save(withBoundSync({ ...current(), wallpaper: '' }, charName, { wallpaper: '' }))),
        )

        if (typeof ctx.getSettings === 'function' && charName) {
          const activePacks = getActivePacks(ctx.getSettings(), charName)
          const coverUrl = activePacks[0] ? getPackCover(activePacks[0])?.url : undefined
          if (coverUrl && imageUrlSafe(coverUrl)) {
            wallpaper.append(
              button(
                `用「${charName}」立绘作壁纸`,
                () => save(withBoundSync({ ...current(), wallpaper: coverUrl, wallpaperDim: current().wallpaperDim ?? 28 }, charName, { wallpaper: coverUrl }), `已将「${charName}」立绘设为主屏壁纸。`),
                'ap-accent-btn',
              ),
            )
          }
          const boundSkin = data.characterSkins?.[charName]
          wallpaper.append(
            button(
              boundSkin ? `更新「${charName}」专属外观` : `绑定为「${charName}」专属外观`,
              () => {
                const latest = current()
                const effective = resolveEffectiveAppearance(latest, charName)
                const skins = { ...(latest.characterSkins ?? {}) }
                skins[charName] = {
                  theme: effective.theme || 'midnight',
                  ...(effective.wallpaper ? { wallpaper: effective.wallpaper } : {}),
                }
                save({ ...latest, characterSkins: skins }, `已为「${charName}」记住当前主题与壁纸，切到 TA 时自动换装。`)
              },
            ),
          )
          if (boundSkin) {
            wallpaper.append(
              button(`解除「${charName}」专属外观`, () => {
                const latest = current()
                const skins = { ...(latest.characterSkins ?? {}) }
                delete skins[charName]
                save({ ...latest, characterSkins: Object.keys(skins).length ? skins : undefined }, `已解除「${charName}」的专属外观绑定。`)
              }),
            )
          }
        }

        wallpaper.append(
          sliderField('壁纸压暗', data.wallpaperDim ?? 0, 0, 75, '%', val => save({ ...current(), wallpaperDim: val || undefined })),
          sliderField('背景柔焦', data.wallpaperBlur ?? 0, 0, 20, 'px', val => save({ ...current(), wallpaperBlur: val || undefined })),
        )

        // 3. 图标定制（保持展开状态不回弹）
        const icons = section('图标')
        for (const app of deps.listApps()) {
          const custom = data.icons[app.id]
          const row = document.createElement('details')
          row.className = 'ap-icon-row'
          if (openIconIds.has(app.id)) row.open = true
          row.addEventListener('toggle', () => {
            if (row.open) openIconIds.add(app.id)
            else openIconIds.delete(app.id)
          })
          const summary = document.createElement('summary')
          summary.append(preview(custom?.image || '', custom?.emoji || app.icon, app.name), text('strong', '', app.name), text('span', 'ap-hint', '换图标'))
          const emoji = field(`${app.name} emoji`, custom?.emoji || '')
          const image = field(`${app.name}图片网址`, custom?.image || '', 'url')
          const change = (icon: { emoji?: string; image?: string }) => {
            openIconIds.add(app.id)
            const latest = current()
            save({ ...latest, icons: { ...latest.icons, [app.id]: icon } })
          }
          row.append(
            summary,
            emoji.row,
            button('应用 emoji', () => change({ emoji: emoji.input.value.trim() })),
            upload(`上传${app.name}图标`, 128, img => change({ image: img })),
            image.row,
            button('应用图标网址', () => change({ image: imageUrl(image.input.value) })),
            button('恢复图标', () => {
              openIconIds.add(app.id)
              const latest = current()
              delete latest.icons[app.id]
              save(latest)
            }),
          )
          icons.append(row)
        }

        // 4. 网络字体
        const fonts = section('字体'), selectLabel = text('label', 'ap-field', '当前字体'), select = document.createElement('select')
        const choices = [{ name: '', label: '系统默认' }, ...data.fonts.map(font => ({ name: font.name, label: font.name }))]
        for (const choice of choices) {
          const option = document.createElement('option')
          option.value = choice.name; option.textContent = choice.label
          select.append(option)
        }
        select.value = data.activeFont
        select.onchange = () => save({ ...current(), activeFont: select.value })
        selectLabel.append(select)
        const css = field('字体 CSS 网址', '', 'url'), family = field('字体名（font-family）')
        fonts.append(
          selectLabel,
          css.row,
          family.row,
          button('添加网络字体', () => {
            const cssUrl = fontUrl(css.input.value), name = family.input.value.trim()
            if (!name) throw new Error('请填写字体名。')
            const latest = current()
            save({ ...latest, fonts: [...latest.fonts.filter(font => font.name !== name), { name, family: name, cssUrl }], activeFont: name })
          }),
        )
        if (data.activeFont) {
          fonts.append(
            button('移除当前网络字体', () => {
              const latest = current()
              save({ ...latest, fonts: latest.fonts.filter(f => f.name !== latest.activeFont), activeFont: '' }, '已移除该网络字体。')
            }),
          )
        }

        // 5. 外观包导入导出
        const packs = section('外观包'), pasteLabel = text('label', 'ap-field', '粘贴外观包 JSON'), paste = document.createElement('textarea')
        paste.rows = 5; pasteLabel.append(paste)
        const fileLabel = text('label', 'ap-upload', '选择外观包文件'), file = document.createElement('input')
        file.type = 'file'; file.accept = '.json,application/json'; fileLabel.append(file)
        file.onchange = () => {
          const selected = file.files?.[0]; if (!selected) return
          void act(async () => { const value = await selected.text(); if (alive) applyPack(value) })
        }
        packs.append(
          button('导出外观包', async () => {
            const value = exportAppearance(current()), url = URL.createObjectURL(new Blob([value], { type: 'application/json' })), link = document.createElement('a')
            link.href = url; link.download = '百工外观.json'; link.click(); URL.revokeObjectURL(url)
            const copied = await safeCopyText(value)
            if (alive) status.textContent = copied ? '外观包已复制并下载。' : '外观包已下载（当前环境无法自动复制到剪贴板）。'
          }),
          pasteLabel,
          button('导入粘贴的外观包', () => applyPack(paste.value)),
          fileLabel,
        )
      }

      if (typeof ctx.onCharacterChanged === 'function') {
        ctx.onCharacterChanged(() => { if (alive) render() })
      }
      render()
      cleanup = () => { alive = false; root.remove() }
    },
    unmount() { cleanup?.(); cleanup = undefined },
  }
}

function imageUrlSafe(url: string): boolean {
  try { return Boolean(imageUrl(url)) } catch { return false }
}
