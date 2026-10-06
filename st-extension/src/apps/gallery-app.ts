/**
 * 「图库」App — 立绘包与图床管理：
 * - 打开立绘包管理弹窗（记录来源=手机：关闭弹窗后回到手机图库页）
 * - 包概览
 * - 图床设置（图床前缀 / imgbb API Key / 自动上传）——从旧「设置」App 迁入
 */

import type { PhoneApp } from '../../../core/phone-registry'
import { t } from '../../../core/i18n'
import { DEFAULT_IMAGE_HOST } from '../../../core/types'
import { el, appButton, textRow, toggleRow } from './widgets'

export interface GalleryAppDeps {
  /** 打开立绘包管理弹窗（index.ts 负责收起手机并标记来源） */
  openManager: () => void
}

export function galleryApp(deps: GalleryAppDeps): PhoneApp {
  return {
    id: 'gallery',
    name: t('apps.gallery.name', '图库'),
    icon: '🗂',
    order: 2,
    mount(container, ctx) {
      const settings = ctx.getSettings()

      const section = el('div', 'so-app-section')
      const desc = el('div', 'so-app-desc')
      desc.textContent = t('apps.gallery.description', '立绘包管理：新建/上传/导入导出/分享串/角色绑定。')
      section.append(desc, appButton(t('apps.gallery.open_manager', '打开立绘包管理'), () => deps.openManager()))
      container.append(section)

      // 概览：包列表——包多了会把手机页拉得很长，只露使用中的 + 截断提示（用户实测反馈）
      const list = el('div', 'so-app-section')
      const title = el('div', 'so-app-title')
      title.textContent = t('apps.gallery.pack_count', '共 {{count}} 个立绘包', { count: settings.packs.length })
      list.append(title)
      const boundIds = new Set(settings.bindings.flatMap((b) => b.packIds))
      // ponytail: 没有使用时间戳，「最近使用」用「绑定到任意角色」近似；要真按时间排得给包加 lastUsedAt
      const sorted = [...settings.packs].sort(
        (a, b) => Number(boundIds.has(b.id)) - Number(boundIds.has(a.id)),
      )
      const MAX_SHOWN = 5
      for (const pack of sorted.slice(0, MAX_SHOWN)) {
        const row = el('div', 'so-app-desc')
        row.textContent = t('apps.gallery.pack_row', '· {{name}}（{{count}} 张）', { name: pack.name, count: pack.sprites.length })
          + (boundIds.has(pack.id) ? t('apps.gallery.in_use', '　使用中') : '')
        list.append(row)
      }
      if (settings.packs.length > MAX_SHOWN) {
        const more = el('div', 'so-app-desc')
        more.textContent = t('apps.gallery.more_packs', '…还有 {{count}} 个，全部在「立绘包管理」查看', { count: settings.packs.length - MAX_SHOWN })
        list.append(more)
      }
      container.append(list)

      /*
       * 图床设置：两条通道并存。
       *
       * 实测反馈：第一次用的人看不懂为什么有两个图床、自己该配哪个。原来的文案只标了
       * 「①自动直传」「②手动编码通道」，说的是机制，没说清两者的分工——真正的区别是
       * **一个负责把你的图传上去，一个负责把别人的编号还原成地址**，多数人只需要其中一个。
       * 所以这里先用一句话让人对号入座，再展开每条通道。
       */
      const hostSection = el('div', 'so-app-section')
      const hostTitle = el('div', 'so-app-title')
      hostTitle.textContent = t('apps.gallery.hosting', '图床')
      hostSection.append(hostTitle)

      const hostIntro = el('div', 'so-app-desc')
      hostIntro.textContent = t('apps.gallery.host_intro', '两条通道各管一件事，按需要配，不用都配：要把自己的图变成能分享的链接 → 配 ①；只是想用别人给的图包/编号 → 什么都不用配，② 已有默认值。')
      hostSection.append(hostIntro)

      const autoDesc = el('div', 'so-app-desc')
      autoDesc.textContent = t('apps.gallery.auto_description', '① 自动直传（imgbb，需要 Key）：上传/替换图片时自动传到 imgbb 并绑定编号，本地图保留作显示保底，直链用于分享串。别人才能看到你分享的图，靠的是这条。')
      const autoWhy = el('div', 'so-app-desc')
      autoWhy.textContent = t('apps.gallery.auto_why', '为什么是 imgbb 而不是 catbox：浏览器里只能传 imgbb。catbox 的接口不返回 CORS 头，网页无法直接上传，所以它只能用在下面那条「按编号还原地址」的通道上。')
      const hint = el('div', 'so-app-desc')
      hint.setAttribute('role', 'status')
      hint.setAttribute('aria-live', 'polite')
      hint.textContent =
        t('apps.gallery.key_storage_hint', 'Key 明文保存在 ST 扩展设置里（随 ST 服务端 settings.json 落盘），不会写入分享串或导出文件；上传失败时图片仍保留本地，可稍后补传。')
      const autoUploadRow = toggleRow(t('apps.gallery.auto_upload', '上传时自动直传 imgbb 并绑定编号'), settings.autoUpload, (v) => {
        const cur = ctx.getSettings()
        if (v && !cur.imgbbApiKey.trim()) {
          hint.textContent = t('apps.gallery.key_required', '请先填写 imgbb API Key（免费申请：https://api.imgbb.com/）')
          // Do not remount the App for a rejected change: it would erase the feedback.
          autoUploadRow.querySelector('input')!.checked = false
          return
        }
        ctx.updateSettings({ ...cur, autoUpload: v })
      })
      hostSection.append(
        autoDesc,
        autoWhy,
        textRow(
          t('apps.gallery.api_key', 'imgbb API Key（存 ST 设置，明文）'),
          settings.imgbbApiKey,
          t('apps.gallery.key_placeholder', '免费申请：api.imgbb.com'),
          (raw) => ctx.updateSettings({ ...ctx.getSettings(), imgbbApiKey: raw.trim() }),
          'password',
        ),
        autoUploadRow,
        hint,
      )

      const manualDesc = el('div', 'so-app-desc')
      manualDesc.textContent = t('apps.gallery.manual_description', '② 按编号还原地址（默认 catbox，不需要 Key）：「按编码添加」以及解析分享串和插图编码时，把编号接在下面这个前缀后面拼成完整地址。它只读不写，不会上传任何东西。')
      const manualWhen = el('div', 'so-app-desc')
      manualWhen.textContent =
        t('apps.gallery.manual_when', '只有当对方的图不在 catbox 上时才需要改前缀——改成他们用的图床域名即可。')
      hostSection.append(
        manualDesc,
        manualWhen,
        textRow(t('apps.gallery.host_prefix', '图床前缀'), settings.imageHost, DEFAULT_IMAGE_HOST, (raw) => {
          const v = raw.trim() || DEFAULT_IMAGE_HOST
          const value = /^https?:\/\/.+/.test(v) ? (v.endsWith('/') ? v : `${v}/`) : DEFAULT_IMAGE_HOST
          ctx.updateSettings({ ...ctx.getSettings(), imageHost: value })
        }),
      )
      container.append(hostSection)
    },
  }
}
