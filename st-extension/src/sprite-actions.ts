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
  cleanCheckerboard(sprite: Sprite): Promise<void>
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

export const CHECKERBOARD_HINT =
  '检测并去除棋盘格：只适用于「棋盘格被烤成不透明像素」的图片，' +
  '要求四边连通且是两级浅灰交替的方格。已带透明通道的图不需要处理，' +
  '纯色/深色/彩色背景会被拒绝，以免误删画面内容。'

export function createCheckerboardAction(context: SpriteActionContext): SpriteAction {
  return {
    id: 'checkerboard',
    label: '检测并去除棋盘格',
    hint: CHECKERBOARD_HINT,
    icon: '▦',
    destructive: false,
    allowedInReadonly: true,
    async run() {
      const state = current(context)
      if (!state) return
      await context.cleanCheckerboard(state.sprite)
    },
  }
}

export function createSpriteActions(context: SpriteActionContext): SpriteAction[] {
  const source = context.getSprite()
  return [
    {
      id: 'rename',
      label: '重命名',
      icon: '✎',
      run() {
        const state = current(context)
        if (!state) return
        const next = window.prompt(`「${state.sprite.tag}」改名为：`, state.sprite.tag)
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
      label: '标签',
      icon: '#',
      run() {
        const state = current(context)
        if (!state) return
        const raw = window.prompt(
          `「${state.sprite.tag}」的标签（逗号分隔，留空=清除）：`,
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
      label: '设分组',
      icon: '🏷',
      run() {
        const state = current(context)
        if (!state) return
        const group = spriteGroup(state.sprite)
        const next = window.prompt(`「${state.sprite.tag}」的分组（留空=移出分组）：`, group)
        if (next === null) return
        commitAndRefresh(
          context,
          setSpriteGroup(state.pack, state.sprite.tag, group, next, state.sprite.outfit ?? ''),
        )
      },
    },
    {
      id: 'replace',
      label: '重新上传 / 替换图片',
      icon: '🖼',
      run() {
        if (!current(context)) return
        context.pickReplacement()
      },
    },
    createCheckerboardAction(context),
    {
      id: 'localize',
      label: '保存到本地',
      icon: '↓',
      disabled: !source || getSpriteSource(source) !== 'hosted',
      async run() {
        const state = current(context)
        if (!state || getSpriteSource(state.sprite) !== 'hosted') return
        await context.localize(state.sprite)
      },
    },
    {
      id: 'remote',
      label: '远程地址',
      icon: '🔗',
      run() {
        const state = current(context)
        if (!state) return
        const remote = state.sprite.remoteUrl ||
          (getSpriteSource(state.sprite) === 'hosted' ? state.sprite.url : '')
        if (!remote) {
          throw new Error(`「${state.sprite.tag}」还没有远程地址（未上传图床，分享时对方看不到）`)
        }
        window.prompt(
          `「${state.sprite.tag}」编号：${state.sprite.code || '无'}\n远程地址（Ctrl+C 复制）：`,
          remote,
        )
      },
    },
    {
      id: 'cover',
      label: '设为封面',
      icon: '★',
      run() {
        const state = current(context)
        if (!state) return
        commitAndRefresh(context, { ...state.pack, coverTag: state.sprite.tag })
      },
    },
    {
      id: 'delete',
      label: '删除',
      icon: '✕',
      destructive: true,
      run() {
        const state = current(context)
        if (!state || !window.confirm(`删除立绘「${state.sprite.tag}」？`)) return
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
