/**
 * 「图库」App — 立绘包与图床管理：
 * - 打开立绘包管理弹窗（记录来源=手机：关闭弹窗后回到手机图库页）
 * - 包概览
 * - 图床设置（图床前缀 / imgbb API Key / 自动上传）——从旧「设置」App 迁入
 */

import type { PhoneApp } from '../../../core/phone-registry'
import { DEFAULT_IMAGE_HOST } from '../../../core/types'
import { el, appButton, textRow, toggleRow } from './widgets'

export interface GalleryAppDeps {
  /** 打开立绘包管理弹窗（index.ts 负责收起手机并标记来源） */
  openManager: () => void
}

export function galleryApp(deps: GalleryAppDeps): PhoneApp {
  return {
    id: 'gallery',
    name: '图库',
    icon: '🗂',
    order: 2,
    mount(container, ctx) {
      const settings = ctx.getSettings()

      const section = el('div', 'so-app-section')
      const desc = el('div', 'so-app-desc')
      desc.textContent = '立绘包管理：新建/上传/导入导出/分享串/角色绑定。'
      section.append(desc, appButton('打开立绘包管理', () => deps.openManager()))
      container.append(section)

      // 概览：包列表
      const list = el('div', 'so-app-section')
      const title = el('div', 'so-app-title')
      title.textContent = `共 ${settings.packs.length} 个立绘包`
      list.append(title)
      for (const pack of settings.packs) {
        const row = el('div', 'so-app-desc')
        row.textContent = `· ${pack.name}（${pack.sprites.length} 张）`
        list.append(row)
      }
      container.append(list)

      // 图床设置
      const hostSection = el('div', 'so-app-section')
      const hostTitle = el('div', 'so-app-title')
      hostTitle.textContent = '图床'
      const hint = el('div', 'so-app-desc')
      hint.textContent =
        'Key 仅保存在本地浏览器；上传失败时图片仍保留本地。分享串/插图编码使用上面的图床前缀。'
      hostSection.append(hostTitle)
      hostSection.append(
        textRow('图床前缀', settings.imageHost, DEFAULT_IMAGE_HOST, (raw) => {
          const v = raw.trim() || DEFAULT_IMAGE_HOST
          const value = /^https?:\/\/.+/.test(v) ? (v.endsWith('/') ? v : `${v}/`) : DEFAULT_IMAGE_HOST
          ctx.updateSettings({ ...ctx.getSettings(), imageHost: value })
        }),
        textRow(
          'imgbb API Key（仅存本地）',
          settings.imgbbApiKey,
          '免费申请：api.imgbb.com',
          (raw) => ctx.updateSettings({ ...ctx.getSettings(), imgbbApiKey: raw.trim() }),
          'password',
        ),
        toggleRow('上传时自动直传 imgbb 并绑定编号', settings.autoUpload, (v) => {
          const cur = ctx.getSettings()
          if (v && !cur.imgbbApiKey.trim()) {
            hint.textContent = '请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）'
            ctx.updateSettings({ ...cur, autoUpload: false })
            return
          }
          ctx.updateSettings({ ...cur, autoUpload: v })
        }),
      )
      hostSection.append(hint)
      container.append(hostSection)
    },
  }
}
