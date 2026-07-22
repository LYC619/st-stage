/**
 * 「立绘」App — 立绘功能设置中心（一期在「设置」App 里的立绘选项全部迁入）。
 * 只改 settings，具体生效（prompt 注入、悬浮窗显隐、楼层重渲染）由 index.ts 的
 * updateSettings → refresh/reprocess 统一驱动，App 本身不持有定时器与全局监听。
 */

import type { PhoneApp } from '../../../core/phone-registry'
import {
  RECENT_FLOORS_MAX,
  RECENT_FLOORS_MIN,
  SPRITE_COUNT_MAX,
  SPRITE_COUNT_MIN,
} from '../../../core/types'
import { getActivePacks } from '../../../core/sprite-store'
import { el, appButton, numberRow, selectRow, toggleRow } from './widgets'

export function spriteApp(): PhoneApp {
  return {
    id: 'sprites',
    name: '立绘',
    icon: '🎭',
    order: 1,
    mount(container, ctx) {
      const settings = ctx.getSettings()
      const characterName = ctx.getCharacterName()
      const packs = getActivePacks(settings, characterName)
      const pack = packs[0] ?? null

      // 状态 + 总开关
      const stateSection = el('div', 'so-app-section')
      const title = el('div', 'so-app-title')
      title.textContent = characterName ? `当前角色：${characterName}` : '尚未打开角色聊天'
      const detail = el('div', 'so-app-desc')
      detail.textContent = settings.enabled
        ? pack
          ? packs.length > 1
            ? `立绘功能运行中 — 已启用 ${packs.length} 个包（${packs.reduce((n, p) => n + p.sprites.length, 0)} 张）`
            : `立绘功能运行中 — 已绑定「${pack.name}」（${pack.sprites.length} 张）`
          : '立绘功能已开启，但当前角色未绑定立绘包（到「图库」绑定）'
        : '立绘功能已关闭：不注入 Prompt、不解析标签，旧楼层已恢复原文'
      stateSection.append(
        title,
        toggleRow('启用立绘功能', settings.enabled, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), enabled: v }),
        ),
        detail,
      )

      // 显示方式
      const displaySection = el('div', 'so-app-section')
      const displayTitle = el('div', 'so-app-title')
      displayTitle.textContent = '显示'
      displaySection.append(
        displayTitle,
        selectRow(
          '显示位置',
          settings.spriteDisplayMode,
          [
            { value: 'overlay', label: '悬浮窗' },
            { value: 'inline', label: '仅楼层' },
            { value: 'both', label: '两者' },
          ],
          (v) =>
            ctx.updateSettings({
              ...ctx.getSettings(),
              spriteDisplayMode: v === 'inline' || v === 'both' ? v : 'overlay',
            }),
        ),
        toggleRow('显示悬浮窗', !settings.overlayHidden, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), overlayHidden: !v }),
        ),
        appButton('把悬浮窗拉回视口', () => {
          const cur = ctx.getSettings()
          // 仅楼层模式下任何操作都不显示悬浮窗
          if (cur.spriteDisplayMode === 'inline') return
          ctx.updateSettings({
            ...cur,
            overlayHidden: false,
            overlay: { ...cur.overlay, x: 24, y: 80 },
          })
        }),
        numberRow('最近渲染楼层数', settings.recentFloors, RECENT_FLOORS_MIN, RECENT_FLOORS_MAX, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), recentFloors: v }),
        ),
        toggleRow('隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v }),
        ),
        toggleRow('渲染消息内插图', settings.renderInlineImages, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v }),
        ),
      )
      const displayHint = el('div', 'so-app-desc')
      displayHint.textContent =
        '「仅楼层」把 [立绘:xxx] 原位替换为图片且不弹悬浮窗；楼层数限制加载聊天时补渲染的范围（新回复不受限）。'
      displaySection.append(displayHint)

      // 多立绘轮播
      const autoSection = el('div', 'so-app-section')
      const autoTitle = el('div', 'so-app-title')
      autoTitle.textContent = '多立绘轮播'
      autoSection.append(
        autoTitle,
        toggleRow('自动轮播（一条回复多张立绘时）', settings.autoSwitch, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), autoSwitch: v }),
        ),
        numberRow('轮播间隔（秒）', settings.autoSwitchSeconds, 1, 60, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), autoSwitchSeconds: v }),
        ),
      )

      // Prompt 设置
      const promptSection = el('div', 'so-app-section')
      const promptTitle = el('div', 'so-app-title')
      promptTitle.textContent = 'Prompt'
      promptSection.append(
        promptTitle,
        numberRow('每次回复立绘数量', settings.spriteCount, SPRITE_COUNT_MIN, SPRITE_COUNT_MAX, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), spriteCount: v }),
        ),
        selectRow(
          'Prompt 模式',
          settings.multiRolePromptMode,
          [
            { value: 'full', label: '全量（枚举全部地址）' },
            { value: 'repeat', label: '智能精简（共有图名合并）' },
          ],
          (v) =>
            ctx.updateSettings({
              ...ctx.getSettings(),
              multiRolePromptMode: v === 'repeat' ? 'repeat' : 'full',
            }),
        ),
      )
      const promptHint = el('div', 'so-app-desc')
      promptHint.textContent =
        '多个包/含人名服装时，Prompt 用完整地址 [立绘:人名/服装/图名]；单包纯图名时用简写 [立绘:图名]。'
      promptSection.append(promptHint)

      container.append(stateSection, displaySection, autoSection, promptSection)
    },
  }
}
