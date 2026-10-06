/**
 * 「立绘」App — 立绘功能设置中心（一期在「设置」App 里的立绘选项全部迁入）。
 * 只改 settings，具体生效（prompt 注入、悬浮窗显隐、楼层重渲染）由 index.ts 的
 * updateSettings → refresh/reprocess 统一驱动，App 本身不持有定时器与全局监听。
 */

import type { PhoneApp } from '../../../core/phone-registry'
import { t } from '../../../core/i18n'
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
import { el, appButton, foldSection, hintField, numberRow, rangeRow, selectRow, textareaRow, toggleRow } from './widgets'
import { BUILTIN_TEMPLATE } from '../../../core/prompt-builder'

export interface SpriteAppDeps {
  /** 拖动滑块时仅预览悬浮窗透明度；松手后仍由 updateSettings 持久化。 */
  previewOpacity?: (percent: number) => void
}

export function spriteApp(deps: SpriteAppDeps = {}): PhoneApp {
  return {
    id: 'sprites',
    name: t('apps.sprites.name', '立绘'),
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
      title.textContent = characterName ? t('apps.sprites.current_character', '当前角色：{{name}}', { name: characterName }) : t('apps.sprites.no_character', '尚未打开角色聊天')
      const detail = el('div', 'so-app-desc')
      detail.textContent = settings.enabled
        ? pack
          ? packs.length > 1
            ? t('apps.sprites.active_packs', '立绘功能运行中 — 已启用 {{packs}} 个包（{{images}} 张）', { packs: packs.length, images: packs.reduce((n, p) => n + p.sprites.length, 0) })
            : t('apps.sprites.active_pack', '立绘功能运行中 — 已绑定「{{name}}」（{{images}} 张）', { name: pack.name, images: pack.sprites.length })
          : t('apps.sprites.unbound', '立绘功能已开启，但当前角色未绑定立绘包（到「图库」绑定）')
        : t('apps.sprites.disabled', '立绘功能已关闭：不注入 Prompt、不解析标签，旧楼层已恢复原文')
      stateSection.append(
        title,
        toggleRow(t('apps.sprites.enable', '启用立绘功能'), settings.enabled, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), enabled: v }),
        ),
        detail,
      )

      // 显示方式（默认折叠：标题常显，防止长页漏看分区）
      const displaySection = foldSection(t('apps.sprites.display', '显示'), false, 'sprites:display')
      displaySection.body.append(
        selectRow(
          t('apps.sprites.location', '显示位置'),
          settings.spriteDisplayMode,
          [
            { value: 'overlay', label: t('apps.sprites.overlay', '悬浮窗') },
            { value: 'inline', label: t('apps.sprites.inline', '仅楼层') },
            { value: 'both', label: t('apps.sprites.both', '两者') },
          ],
          (v) =>
            ctx.updateSettings({
              ...ctx.getSettings(),
              spriteDisplayMode: v === 'inline' || v === 'both' ? v : 'overlay',
            }),
        ),
        toggleRow(t('apps.sprites.show_overlay', '显示悬浮窗'), !settings.overlayHidden, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), overlayHidden: !v }),
        ),
        appButton(t('apps.sprites.reset_overlay', '把悬浮窗拉回视口'), () => {
          const cur = ctx.getSettings()
          // 仅楼层模式下任何操作都不显示悬浮窗
          if (cur.spriteDisplayMode === 'inline') return
          ctx.updateSettings({
            ...cur,
            overlayHidden: false,
            overlay: { ...cur.overlay, x: 24, y: 80 },
          })
        }),
        numberRow(t('apps.sprites.recent_messages', '最近渲染楼层数'), settings.recentFloors, RECENT_FLOORS_MIN, RECENT_FLOORS_MAX, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), recentFloors: v }),
        ),
        rangeRow(
          t('apps.sprites.opacity', '悬浮窗立绘不透明度（%）'),
          settings.spriteOpacity,
          SPRITE_OPACITY_MIN,
          SPRITE_OPACITY_MAX,
          (v) => deps.previewOpacity?.(v),
          (v) => ctx.updateSettings({ ...ctx.getSettings(), spriteOpacity: v }),
          (v) => `${v}%`,
        ),
        toggleRow(t('apps.sprites.hide_tags', '隐藏 [立绘:xxx] 标签'), settings.hideTagInMessage, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), hideTagInMessage: v }),
        ),
        hintField(
          toggleRow(t('apps.sprites.parse_images', '解析 <img>编码</img> 插图标签'), settings.renderInlineImages, (v) =>
            ctx.updateSettings({ ...ctx.getSettings(), renderInlineImages: v }),
          ),
          t('apps.sprites.images_hint', '把 AI 正文中的 <img>文件编码</img> 按图床前缀渲染为剧情插图。它与 [立绘:图名] 的悬浮窗/楼层显示位置互相独立。'),
        ),
        toggleRow(t('apps.sprites.fold_roles', '同角色图包折叠'), settings.galleryFoldByRole, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), galleryFoldByRole: v }),
        ),
      )
      const displayHint = el('div', 'so-app-desc')
      displayHint.textContent =
        t('apps.sprites.display_hint', '「仅楼层」把 [立绘:xxx] 原位替换为图片且不弹悬浮窗；楼层数限制加载聊天时补渲染的范围（新回复不受限）。不透明度只调悬浮窗，楼层立绘始终清晰显示。')
      displaySection.body.append(displayHint)

      // 多立绘轮播（默认折叠）
      const autoSection = foldSection(t('apps.sprites.slideshow', '多立绘轮播'), false, 'sprites:auto')
      autoSection.body.append(
        toggleRow(t('apps.sprites.auto_switch', '自动轮播（一条回复多张立绘时）'), settings.autoSwitch, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), autoSwitch: v }),
        ),
        numberRow(t('apps.sprites.interval', '轮播间隔（秒）'), settings.autoSwitchSeconds, 1, 60, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), autoSwitchSeconds: v }),
        ),
      )

      // Prompt 设置（默认折叠）
      const promptSection = foldSection(t('apps.sprites.prompt', 'Prompt'), false, 'sprites:prompt')
      promptSection.body.append(
        numberRow(t('apps.sprites.sprite_count', '每次回复立绘数量'), settings.spriteCount, SPRITE_COUNT_MIN, SPRITE_COUNT_MAX, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), spriteCount: v }),
        ),
        numberRow(
          t('apps.sprites.injection_depth', '注入深度（距末尾楼层数）'),
          settings.injectionDepth,
          INJECTION_DEPTH_MIN,
          INJECTION_DEPTH_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), injectionDepth: v }),
        ),
        selectRow(
          t('apps.sprites.prompt_mode', 'Prompt 模式'),
          settings.multiRolePromptMode,
          [
            { value: 'repeat', label: t('apps.sprites.compact_mode', '自动精简（默认：重合图名列一次）') },
            { value: 'full', label: t('apps.sprites.full_mode', '全量（枚举全部地址）') },
          ],
          (v) =>
            ctx.updateSettings({
              ...ctx.getSettings(),
              multiRolePromptMode: v === 'full' ? 'full' : 'repeat',
            }),
        ),
        numberRow(
          t('apps.sprites.prompt_budget', 'Prompt 预算（字符，0=不限）'),
          settings.promptBudget,
          PROMPT_BUDGET_MIN,
          PROMPT_BUDGET_MAX,
          (v) => ctx.updateSettings({ ...ctx.getSettings(), promptBudget: v }),
        ),
        toggleRow(t('apps.sprites.approx_match', '近似匹配（实验，默认关闭）'), settings.approxMatch, (v) =>
          ctx.updateSettings({ ...ctx.getSettings(), approxMatch: v }),
        ),
      )
      const approxHint = el('div', 'so-app-desc')
      approxHint.textContent = t('apps.sprites.approx_hint', '开启后，[立绘:...] 里写的不是准确地址时，会拿它当描述去找最像的一张（如「穿连衣裙逛街」命中 连衣裙/逛街）。只在准确地址找不到时才生效，同分打平就放弃，所以不会改变原本能命中的结果。')
      promptSection.body.append(approxHint)
      // 预算反馈：算一遍实际会注入的 prompt，超预算时同时给出截取前的长度
      const budgeted = buildActiveSpritePrompt(settings, characterName)
      const unlimited =
        settings.promptBudget > 0
          ? buildActiveSpritePrompt(settings, characterName, 0)
          : budgeted
      const budgetHint = el('div', 'so-app-desc')
      budgetHint.textContent = budgeted
        ? t('apps.sprites.budget_count', '预计注入 {{count}} 字符', { count: budgeted.length }) +
          (budgeted.length < unlimited.length
            ? t('apps.sprites.budget_trimmed', '（超预算，已从 {{count}} 字符每场景均衡截取，保留排前的图名）', { count: unlimited.length })
            : '')
        : t('apps.sprites.budget_empty', '预计注入：无（当前角色没有可用立绘地址）')
      promptSection.body.append(budgetHint)
      const promptHint = el('div', 'so-app-desc')
      promptHint.textContent = t('apps.sprites.prompt_hint', '同角色多服装时，默认服装可写 [立绘:图名]，其他服装写 [立绘:服装/图名]；完整三级地址仍兼容。自动精简会抽取基础图名池和服装增量；适合相对地址时优先使用角色级格式（只要比全量短），否则在旧场景压缩和全量格式中取更短者。')
      promptSection.body.append(promptHint)
      const tplRow = textareaRow(
        t('apps.sprites.custom_prompt', '自定义提示词（留空=用内置）'),
        settings.promptTemplate,
        t('apps.sprites.template_placeholder', '整体替换内置提示词。占位符：{清单}=按场景分组的立绘清单，{数量}=每次回复立绘数'),
        (v) => ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: v }),
      )
      const tplInput = tplRow.querySelector('textarea') as HTMLTextAreaElement
      promptSection.body.append(
        tplRow,
        appButton(t('apps.sprites.fill_builtin', '填入内置底稿（未修改时仍自动精简）'), () => {
          if (tplInput.value.trim() && !window.confirm(t('apps.sprites.overwrite_confirm', '用内置底稿覆盖当前已填写的自定义提示词？'))) return
          tplInput.value = BUILTIN_TEMPLATE
          ctx.updateSettings({ ...ctx.getSettings(), promptTemplate: BUILTIN_TEMPLATE })
        }),
      )

      container.append(stateSection, displaySection.box, autoSection.box, promptSection.box)
    },
  }
}
