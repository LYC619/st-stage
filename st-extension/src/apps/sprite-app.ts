/**
 * 「立绘」App — 立绘功能设置中心（一期在「设置」App 里的立绘选项全部迁入）。
 * 只改 settings，具体生效（prompt 注入、悬浮窗显隐、楼层重渲染）由 index.ts 的
 * updateSettings → refresh/reprocess 统一驱动，App 本身不持有定时器与全局监听。
 */

import type { PhoneApp } from '../../../core/phone-registry'
import { buildActiveSpritePrompt } from '../../../core/active-prompt'
import {
  INJECTION_DEPTH_MAX,
  INJECTION_DEPTH_MIN,
  PROMPT_BUDGET_MAX,
  PROMPT_BUDGET_MIN,
  RECENT_FLOORS_MAX,
  RECENT_FLOORS_MIN,
  SPRITE_COUNT_MAX,
  SPRITE_COUNT_MIN,
  SPRITE_OPACITY_MAX,
  SPRITE_OPACITY_MIN,
} from '../../../core/types'
import { getActivePacks } from '../../../core/sprite-store'
import { el, appButton, foldSection, hintField, numberRow, selectRow, textareaRow, toggleRow } from './widgets'
import { BUILTIN_TEMPLATE } from '../../../core/prompt-builder'

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

      // 显示方式（默认折叠：标题常显，防止长页漏看分区）
      const displaySection = foldSection('显示', false, 'sprites:display')
      displaySection.body.append(
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
        numberRow(
          '悬浮窗立绘不透明度（%）',
          settings.spriteOpacity,
          SPRITE_OPACITY_MIN,
          SPRITE_OPACITY_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), spriteOpacity: v }),
        ),
        toggleRow('隐藏 [立绘:xxx] 标签', settings.hideTagInMessage, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v }),
        ),
        hintField(
          toggleRow('解析 <img>编码</img> 插图标签', settings.renderInlineImages, (v) =>
            ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v }),
          ),
          '把 AI 正文中的 <img>文件编码</img> 按图床前缀渲染为剧情插图。它与 [立绘:图名] 的悬浮窗/楼层显示位置互相独立。',
        ),
        toggleRow('同角色图包折叠', settings.galleryFoldByRole, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), galleryFoldByRole: v }),
        ),
      )
      const displayHint = el('div', 'so-app-desc')
      displayHint.textContent =
        '「仅楼层」把 [立绘:xxx] 原位替换为图片且不弹悬浮窗；楼层数限制加载聊天时补渲染的范围（新回复不受限）。不透明度只调悬浮窗，楼层立绘始终清晰显示。'
      displaySection.body.append(displayHint)

      // 多立绘轮播（默认折叠）
      const autoSection = foldSection('多立绘轮播', false, 'sprites:auto')
      autoSection.body.append(
        toggleRow('自动轮播（一条回复多张立绘时）', settings.autoSwitch, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), autoSwitch: v }),
        ),
        numberRow('轮播间隔（秒）', settings.autoSwitchSeconds, 1, 60, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), autoSwitchSeconds: v }),
        ),
      )

      // Prompt 设置（默认折叠）
      const promptSection = foldSection('Prompt', false, 'sprites:prompt')
      promptSection.body.append(
        numberRow('每次回复立绘数量', settings.spriteCount, SPRITE_COUNT_MIN, SPRITE_COUNT_MAX, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), spriteCount: v }),
        ),
        numberRow(
          '注入深度（距末尾楼层数）',
          settings.injectionDepth,
          INJECTION_DEPTH_MIN,
          INJECTION_DEPTH_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), injectionDepth: v }),
        ),
        selectRow(
          'Prompt 模式',
          settings.multiRolePromptMode,
          [
            { value: 'repeat', label: '自动精简（默认：重合图名列一次）' },
            { value: 'full', label: '全量（枚举全部地址）' },
          ],
          (v) =>
            ctx.updateSettings({
              ...ctx.getSettings(),
              multiRolePromptMode: v === 'full' ? 'full' : 'repeat',
            }),
        ),
        numberRow(
          'Prompt 预算（字符，0=不限）',
          settings.promptBudget,
          PROMPT_BUDGET_MIN,
          PROMPT_BUDGET_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), promptBudget: v }),
        ),
      )
      // 预算反馈：算一遍实际会注入的 prompt，超预算时同时给出截取前的长度
      const budgeted = buildActiveSpritePrompt(settings, characterName)
      const unlimited =
        settings.promptBudget > 0
          ? buildActiveSpritePrompt(settings, characterName, 0)
          : budgeted
      const budgetHint = el('div', 'so-app-desc')
      budgetHint.textContent = budgeted
        ? `预计注入 ${budgeted.length} 字符` +
          (budgeted.length < unlimited.length
            ? `（超预算，已从 ${unlimited.length} 字符每场景均衡截取，保留排前的图名）`
            : '')
        : '预计注入：无（当前角色没有可用立绘地址）'
      promptSection.body.append(budgetHint)
      const promptHint = el('div', 'so-app-desc')
      promptHint.textContent =
        '同角色多服装时，默认服装可写 [立绘:图名]，其他服装写 [立绘:服装/图名]；完整三级地址仍兼容。' +
        '自动精简会抽取基础图名池和服装增量；默认服装不在重合簇或压缩后不更短时，会自动保留原格式。'
      promptSection.body.append(promptHint)
      const tplRow = textareaRow(
        '自定义提示词（留空=用内置）',
        settings.promptTemplate,
        '整体替换内置提示词。占位符：{清单}=按场景分组的立绘清单，{数量}=每次回复立绘数',
        (v) => ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: v }),
      )
      const tplInput = tplRow.querySelector('textarea') as HTMLTextAreaElement
      promptSection.body.append(
        tplRow,
        appButton('填入内置底稿（未修改时仍自动精简）', () => {
          if (tplInput.value.trim() && !window.confirm('用内置底稿覆盖当前已填写的自定义提示词？')) return
          tplInput.value = BUILTIN_TEMPLATE
          ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: BUILTIN_TEMPLATE })
        }),
      )

      container.append(stateSection, displaySection.box, autoSection.box, promptSection.box)
    },
  }
}
