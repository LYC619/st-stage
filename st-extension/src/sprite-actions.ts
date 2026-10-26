import { t } from '../../core/i18n'
import type { Sprite, SpritePack } from '../../core/types'
import { getSpriteSource } from '../../core/types'
import { removeSprite, renameSprite, setSpriteGroup, spriteGroup, upsertSprite } from '../../core/sprite-store'
import { normalizeLabels } from '../../core/sprite-metadata'

export interface SpriteActionContext {
  getPack(): SpritePack | null
  getSprite(): Sprite | null
  commit(pack: SpritePack): void
  pickReplacement(): void
  localize(sprite: Sprite): Promise<void>
  refresh(): void
  close(): void
}

export interface SpriteAction {
  id: string
  label: string
  icon?: string
  /** 悬浮提示；缺省时用 label。用来说明适用条件，避免用户只能靠「点了被拒」来学。 */
  hint?: string
  destructive?: boolean
  disabled?: boolean
  allowedInReadonly?: boolean
  run(): void | Promise<void>
}

function current(context: SpriteActionContext): { pack: SpritePack; sprite: Sprite } | null {
  const pack = context.getPack()
  const sprite = context.getSprite()
  return pack && sprite ? { pack, sprite } : null
}

function commitAndRefresh(context: SpriteActionContext, pack: SpritePack): void {
  try {
    context.commit(pack)
  } finally {
    context.refresh()
  }
}

export function createSpriteActions(context: SpriteActionContext): SpriteAction[] {
  const source = context.getSprite()
  return [
    {
      id: 'rename',
      label: t("sprite.manager.content.action.rename", "重命名"),
      icon: '✎',
      run() {
        const state = current(context)
        if (!state) return
        const next = window.prompt(t("sprite.manager.content.action.rename_prompt", "「{{p0}}」改名为：", { p0: state.sprite.tag }), state.sprite.tag)
        if (next === null) return
        commitAndRefresh(
          context,
          renameSprite(
            state.pack,
            state.sprite.tag,
            next,
            spriteGroup(state.sprite),
            state.sprite.outfit ?? '',
          ),
        )
      },
    },
    {
      id: 'labels',
      label: t("sprite.manager.content.action.labels", "标签"),
      icon: '#',
      run() {
        const state = current(context)
        if (!state) return
        const raw = window.prompt(
          t("sprite.manager.content.action.labels_prompt", "「{{p0}}」的标签（逗号分隔，留空=清除）：", { p0: state.sprite.tag }),
          state.sprite.labels?.join(', ') ?? '',
        )
        if (raw === null) return
        const labels = normalizeLabels(raw.split(/[,，]/))
        const nextSprite = { ...state.sprite }
        if (labels.length > 0) nextSprite.labels = labels
        else delete nextSprite.labels
        commitAndRefresh(context, upsertSprite(state.pack, nextSprite))
      },
    },
    {
      id: 'group',
      label: t("sprite.manager.content.action.group", "设分组"),
      icon: '🏷',
      run() {
        const state = current(context)
        if (!state) return
        const group = spriteGroup(state.sprite)
        const next = window.prompt(t("sprite.manager.content.action.group_prompt", "「{{p0}}」的分组（留空=移出分组）：", { p0: state.sprite.tag }), group)
        if (next === null) return
        commitAndRefresh(
          context,
          setSpriteGroup(state.pack, state.sprite.tag, group, next, state.sprite.outfit ?? ''),
        )
      },
    },
    {
      id: 'replace',
      label: t("sprite.manager.content.action.replace", "重新上传 / 替换图片"),
      icon: '🖼',
      run() {
        if (!current(context)) return
        context.pickReplacement()
      },
    },
    {
      id: 'localize',
      label: t("sprite.manager.content.action.localize", "保存到本地"),
      icon: '↓',
      hint: t("sprite.manager.content.action.localize_hint", "把图床上的图片下载成本地文件再引用，之后不再依赖外链。")
        + t("sprite.manager.content.action.preset_localize_hint", "预设包不会被改写，只记一条同 ID 的本地覆盖，随时可以删掉回到原图。"),
      // 预设包只读，但本地化是记覆盖而不是改包，所以只读态下也应当放行——
      // 这是预设立绘唯一的本地化入口。
      allowedInReadonly: true,
      disabled: !source || getSpriteSource(source) !== 'hosted',
      async run() {
        const state = current(context)
        if (!state || getSpriteSource(state.sprite) !== 'hosted') return
        await context.localize(state.sprite)
      },
    },
    {
      id: 'remote',
      label: t("sprite.manager.content.action.remote", "远程地址"),
      icon: '🔗',
      run() {
        const state = current(context)
        if (!state) return
        const remote = state.sprite.remoteUrl ||
          (getSpriteSource(state.sprite) === 'hosted' ? state.sprite.url : '')
        if (!remote) {
          throw new Error(t("sprite.manager.content.action.no_remote", "「{{p0}}」还没有远程地址（未上传图床，分享时对方看不到）", { p0: state.sprite.tag }))
        }
        window.prompt(
          t("sprite.manager.content.action.remote_prompt", "「{{p0}}」编号：{{p1}}\n远程地址（Ctrl+C 复制）：", { p0: state.sprite.tag, p1: state.sprite.code || t("sprite.manager.content.action.none", "无") }),
          remote,
        )
      },
    },
    {
      id: 'cover',
      label: t("sprite.manager.content.action.cover", "设为封面"),
      icon: '★',
      run() {
        const state = current(context)
        if (!state) return
        commitAndRefresh(context, { ...state.pack, coverTag: state.sprite.tag })
      },
    },
    {
      id: 'delete',
      label: t("common.delete", "删除"),
      icon: '✕',
      destructive: true,
      run() {
        const state = current(context)
        if (!state || !window.confirm(t("sprite.manager.content.action.confirm_delete", "删除立绘「{{p0}}」？", { p0: state.sprite.tag }))) return
        const next = removeSprite(
          state.pack,
          state.sprite.tag,
          spriteGroup(state.sprite),
          state.sprite.outfit ?? '',
        )
        context.commit(next)
        if (next.sprites.length === 0) context.close()
        else context.refresh()
      },
    },
  ]
}
