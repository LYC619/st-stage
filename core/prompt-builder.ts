/**
 * prompt 构建器：根据当前角色可用立绘的三级地址，生成注入的 system prompt。
 *
 * 七期：
 * - 全量（full）：列出所有实际存在的完整地址
 * - 智能精简（repeat）：多个「场景（人名/服装）」共有的表情只列一次，
 *   各场景其余表情按行增量列出（不生成不存在的组合）
 * - 每次回复立绘数量 N：要求 AI 按情节顺序输出 N 个 [立绘:...] 标签
 * 阶段四（大图包稳定化）：
 * - 字符预算 budget：超出时二分「每场景 tag 上限 K」均衡截取，保留排前的表情
 */

import { compactNumberedTags } from './sprite-metadata'
import { addressConflictKey, effectiveSpriteAddress } from './address-policy'
import { DEFAULT_PROMPT_NOTE_PLACEMENT } from './types'
import type { PromptNotePlacement, SpriteAddress, SpritePack } from './types'

export interface PromptSceneNote {
  role: string
  outfit: string
  note: string
  placement: PromptNotePlacement
}

/** 活动包与最终地址 → 各包实际贡献场景的有序备注。 */
export function buildPromptSceneNotes(
  packs: SpritePack[],
  addresses: SpriteAddress[],
): PromptSceneNote[] {
  const notes: PromptSceneNote[] = []
  const multiPack = packs.length > 1
  const available = new Set(addresses.map(addressConflictKey))
  for (const pack of packs) {
    const scenes: SpriteAddress[] = []
    const seen = new Set<string>()
    for (const sprite of pack.sprites) {
      const scene = effectiveSpriteAddress(pack, sprite, multiPack)
      if (!available.has(addressConflictKey(scene))) continue
      const key = JSON.stringify([scene.role, scene.outfit])
      if (seen.has(key)) continue
      seen.add(key)
      scenes.push(scene)
    }

    const placement = pack.promptNotePlacement ?? DEFAULT_PROMPT_NOTE_PLACEMENT
    const packNote = pack.promptNote?.trim() ?? ''
    for (const [index, scene] of scenes.entries()) {
      if (packNote && placement === 'before-list' && index === 0) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: packNote, placement })
      }
      const outfitNote = pack.outfitNotes && Object.prototype.hasOwnProperty.call(pack.outfitNotes, scene.outfit)
        ? pack.outfitNotes?.[scene.outfit]?.trim() ?? ''
        : ''
      if (outfitNote) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: outfitNote, placement })
      }
      if (packNote && placement === 'after-list' && index === scenes.length - 1) {
        notes.push({ role: scene.role, outfit: scene.outfit, note: packNote, placement })
      }
    }
  }
  return notes
}

/** 收尾说明：N=1 保持旧的单标签语义；N>1 要求按情节顺序输出多个 */
function countInstruction(count: number): string {
  if (count <= 1) {
    return '请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。'
  }
  return `请根据回复内容，按情节顺序选择 ${count} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。`
}

/**
 * 场景键（人名/服装）：用 `|` 作分隔符区分两个维度。
 * normalizeTag 会剔除 `|`，故真实的人名/服装绝不含它，不会与内容撞键
 * （避免 role="a b"+outfit="" 与 role="a"+outfit="b" 归成同一场景）。
 */
function sceneKey(a: SpriteAddress): string {
  return `${a.role}|${a.outfit}`
}

function sceneLabel(a: SpriteAddress): string {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}`
  if (a.role) return a.role
  return '默认'
}

interface PromptScene {
  key: string
  label: string
  prefix: string
  tags: string[]
}

type PromptSceneNoteIndex = Map<
  string,
  Record<PromptNotePlacement, PromptSceneNote[]>
>

interface RenderedTags {
  text: string
  ranges: string[]
}

function scenePrefix(a: SpriteAddress): string {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}`
  if (a.role) return a.role
  return ''
}

/** 地址列表 → 有序场景；场景内 tag 去重并保持首次出现顺序。 */
function buildScenes(addresses: SpriteAddress[]): PromptScene[] {
  const scenes = new Map<string, PromptScene & { seen: Set<string> }>()
  for (const address of addresses) {
    const key = sceneKey(address)
    let scene = scenes.get(key)
    if (!scene) {
      scene = {
        key,
        label: sceneLabel(address),
        prefix: scenePrefix(address),
        tags: [],
        seen: new Set(),
      }
      scenes.set(key, scene)
    }
    if (!scene.seen.has(address.tag)) {
      scene.seen.add(address.tag)
      scene.tags.push(address.tag)
    }
  }
  return [...scenes.values()].map(({ seen: _seen, ...scene }) => scene)
}

function renderTags(tags: string[], reservedTags: ReadonlySet<string>): RenderedTags {
  const entries = compactNumberedTags(tags, reservedTags)
  return {
    text: entries.map((entry) => entry.kind === 'range'
      ? `${entry.label}（输出时从${entry.values[0]}至${entry.values[entry.values.length - 1]}中随机选择一个完整图名）`
      : entry.label).join('、'),
    ranges: entries.filter((entry) => entry.kind === 'range').map((entry) => entry.label),
  }
}

function rangeInstruction(ranges: string[]): string[] {
  if (ranges.length === 0) return []
  return [
    `编号范围仅用于压缩展示；必须输出范围内一个实际存在的完整图名，严禁直接输出范围标签（${ranges.join('、')}）。`,
  ]
}

function indexSceneNotes(notes: PromptSceneNote[]): PromptSceneNoteIndex {
  const index: PromptSceneNoteIndex = new Map()
  for (const note of notes) {
    if (!note.note.trim()) continue
    const key = `${note.role}|${note.outfit}`
    let placements = index.get(key)
    if (!placements) {
      placements = { 'before-list': [], 'after-list': [] }
      index.set(key, placements)
    }
    placements[note.placement].push(note)
  }
  return index
}

function matchingNotes(
  noteIndex: PromptSceneNoteIndex,
  scene: PromptScene,
  placement: PromptNotePlacement,
): PromptSceneNote[] {
  return noteIndex.get(scene.key)?.[placement] ?? []
}

function noteLine(scene: PromptScene, note: PromptSceneNote): string {
  return `场景备注（${scene.label}）：${note.note}`
}

function renderGroupedSceneList(
  scenes: PromptScene[],
  noteIndex: PromptSceneNoteIndex,
  reservedTags: ReadonlySet<string>,
): {
  lines: string[]
  ranges: string[]
} {
  const lines: string[] = []
  const ranges: string[] = []
  for (const scene of scenes) {
    lines.push(...matchingNotes(noteIndex, scene, 'before-list').map((note) => noteLine(scene, note)))
    const rendered = renderTags(scene.tags, reservedTags)
    lines.push(`- ${scene.label}：${rendered.text}`)
    ranges.push(...rendered.ranges)
    lines.push(...matchingNotes(noteIndex, scene, 'after-list').map((note) => noteLine(scene, note)))
  }
  return { lines, ranges }
}

function hasMatchingNotes(scenes: PromptScene[], noteIndex: PromptSceneNoteIndex): boolean {
  return scenes.some((scene) => noteIndex.has(scene.key))
}

/**
 * N>1 时的插入位置 few-shot：演示标签随剧情分散在正文中。
 * 示例图名取第一个场景实际存在的 tag——绝不虚构，避免教 AI 拼造不存在的组合。
 */
function fewShotExample(scenes: PromptScene[], count: number): string[] {
  if (count <= 1) return []
  const scene = scenes[0]
  if (!scene || scene.tags.length === 0) return []
  const addr = (tag: string) => (scene.prefix ? `${scene.prefix}/${tag}` : tag)
  const first = scene.tags[0]
  const second = scene.tags[1] ?? scene.tags[0]
  return [
    '插入位置示例（省略号代表你的正文段落）：',
    '…剧情段落一…',
    `[立绘:${addr(first)}]`,
    '…剧情段落二…',
    `[立绘:${addr(second)}]`,
  ]
}

/** full：每个 role/outfit 场景只写一次，仍完整覆盖所有实际组合。 */
function buildGroupedFull(
  addresses: SpriteAddress[],
  count: number,
  noteIndex: PromptSceneNoteIndex,
  reservedTags: ReadonlySet<string>,
): string {
  const scenes = buildScenes(addresses)
  const rendered = renderGroupedSceneList(scenes, noteIndex, reservedTags)
  return [
    '[角色立绘系统]',
    '可用立绘（按场景）：',
    ...rendered.lines,
    ...rangeInstruction(rendered.ranges),
    '输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。',
    countInstruction(count),
    ...fewShotExample(scenes, count),
    '只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。',
  ].join('\n')
}

/**
 * repeat：按场景分组，抽出所有场景共有的表情，剩余项仍按所在场景列出。
 * 两部分合起来可以还原完整的场景 × tag 关系，不生成笛卡尔积之外的组合。
 */
function buildShared(
  addresses: SpriteAddress[],
  count: number,
  noteIndex: PromptSceneNoteIndex,
  reservedTags: ReadonlySet<string>,
): string {
  const scenes = buildScenes(addresses)
  if (scenes.length <= 1 || hasMatchingNotes(scenes, noteIndex)) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags)
  }

  const allTags: string[] = []
  const seenTags = new Set<string>()
  for (const scene of scenes) {
    for (const tag of scene.tags) {
      if (seenTags.has(tag)) continue
      seenTags.add(tag)
      allTags.push(tag)
    }
  }
  const sharedTags = allTags.filter((tag) => scenes.every((scene) => scene.tags.includes(tag)))
  if (sharedTags.length === 0) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags)
  }
  const sharedSet = new Set(sharedTags)
  const remainders = scenes.map((scene) => ({
    scene,
    tags: scene.tags.filter((tag) => !sharedSet.has(tag)),
  }))

  const labels = scenes.map((scene) =>
    scene.prefix ? scene.label : `${scene.label}（直接写表情）`,
  )
  const renderedShared = renderTags(sharedTags, reservedTags)
  const ranges = [...renderedShared.ranges]
  const lines = [
    '[角色立绘系统]',
    `可用场景：${labels.join('、')}`,
    `共有表情（适用于全部场景）：${renderedShared.text}`,
  ]
  const withRemainder = remainders.filter((item) => item.tags.length > 0)
  if (withRemainder.length > 0) {
    lines.push('各场景其余表情：')
    for (const { scene, tags } of withRemainder) {
      const rendered = renderTags(tags, reservedTags)
      lines.push(`- ${scene.label}：${rendered.text}`)
      ranges.push(...rendered.ranges)
    }
  }
  lines.push(...rangeInstruction(ranges))
  lines.push('共有表情可与任一已列场景组合；各场景其余表情只按所在行使用。默认场景直接写 [立绘:表情]，其他场景写 [立绘:场景/表情]。')
  lines.push(countInstruction(count))
  lines.push(...fewShotExample(scenes, count))
  lines.push('只能使用实际存在的组合，不要自行拼造不存在的角色/服装/表情。')
  return lines.join('\n')
}

/** UTF-16 string.length 确定性比较；平局选更直观的分组精确格式。 */
export function chooseShorterPrompt(grouped: string, shared: string): string {
  return shared.length < grouped.length ? shared : grouped
}

/** 每场景最多保留前 cap 个（去重后的）tag，保持地址原序——排前的表情=作者/包序优先 */
function capAddresses(addresses: SpriteAddress[], cap: number): SpriteAddress[] {
  const perScene = new Map<string, Set<string>>()
  const kept: SpriteAddress[] = []
  for (const address of addresses) {
    const key = sceneKey(address)
    let tags = perScene.get(key)
    if (!tags) {
      tags = new Set()
      perScene.set(key, tags)
    }
    if (tags.has(address.tag)) continue // 同场景重复 tag 对清单无贡献
    if (tags.size >= cap) continue
    tags.add(address.tag)
    kept.push(address)
  }
  return kept
}

/**
 * 预算适配：budget>0 且超出时，二分「每场景 tag 上限 K」找能塞进预算的最大 K。
 * 每个场景始终保留（至少 1 个表情），截掉的是各场景排后的 tag——均衡且确定性。
 * ponytail: K=1 仍超预算时按 K=1 尽力而为（不硬切字符串防止截出半行）；
 * 场景数本身爆预算属病态数据，升级路径是再按场景数截。
 */
function fitToBudget(
  addresses: SpriteAddress[],
  budget: number,
  build: (addrs: SpriteAddress[]) => string,
): string {
  const full = build(addresses)
  if (budget <= 0 || full.length <= budget) return full
  const maxTags = Math.max(...buildScenes(addresses).map((scene) => scene.tags.length))
  let best = build(capAddresses(addresses, 1))
  let lo = 2
  let hi = maxTags
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    const candidate = build(capAddresses(addresses, mid))
    if (candidate.length <= budget) {
      best = candidate
      lo = mid + 1
    } else {
      hi = mid - 1
    }
  }
  return best
}

/**
 * 内置提示词的模板形态，供设置 UI「填入内置底稿」——用户在此基础上修改。
 * 措辞须与 buildGroupedFull/countInstruction 保持同步（有单测把关）；
 * 不含 few-shot 示例（示例依赖实际图名，运行时由内置逻辑生成，模板放不下）。
 */
export const BUILTIN_TEMPLATE = [
  '[角色立绘系统]',
  '可用立绘（按场景）：',
  '{清单}',
  '输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。',
  '请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。',
  '只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。',
].join('\n')

/**
 * 主入口：根据三级地址列表构建注入 prompt。
 * addresses 为空时返回空字符串（不注入）。
 * template 非空时整体替换内置 prompt（用户自定义提示词），支持占位符：
 *   {清单} → 按场景分组的立绘清单（- 场景：tag、tag…）
 *   {数量} → 每次回复的立绘数量 N
 * budget > 0 时限制输出字符数：超出按每场景均衡截取（自定义模板作用于 {清单}；
 * 模板不含 {清单} 时无从截取，原样输出）。
 * notes 可选；只插入 role/outfit 与现有场景完全一致的备注。
 */
export function buildPrompt(
  addresses: SpriteAddress[],
  mode: 'full' | 'repeat',
  count: number,
  template = '',
  budget = 0,
  notes: PromptSceneNote[] = [],
): string {
  if (addresses.length === 0) return ''
  const n = Math.max(1, Math.round(count) || 1)
  const b = Math.max(0, Math.round(budget) || 0)
  const noteIndex = indexSceneNotes(notes)
  const reservedTags = new Set(addresses.map((address) => address.tag))
  const custom = template.trim()
  if (custom) {
    return fitToBudget(addresses, b, (addrs) => {
      const rendered = renderGroupedSceneList(buildScenes(addrs), noteIndex, reservedTags)
      const list = [...rendered.lines, ...rangeInstruction(rendered.ranges)].join('\n')
      return custom.replace(/\{清单\}/g, list).replace(/\{数量\}/g, String(n))
    })
  }
  return fitToBudget(addresses, b, (addrs) => {
    const grouped = buildGroupedFull(addrs, n, noteIndex, reservedTags)
    if (mode === 'full') return grouped
    return chooseShorterPrompt(grouped, buildShared(addrs, n, noteIndex, reservedTags))
  })
}

/* ---------- 向后兼容旧签名（Web 模拟器仍在用；阶段6统一迁移） ---------- */

/** 生成注入 prompt（纯图名列表）。tags 为空时返回空字符串。 */
export function buildInjectionPrompt(tags: string[]): string {
  return buildPrompt(
    tags.map((tag) => ({ role: '', outfit: '', tag })),
    'full',
    1,
  )
}

/** 分组/图名 地址项（功能②，旧签名） */
export interface AddressEntry {
  group: string
  tag: string
}

/** 多角色/分组模式的注入 prompt（旧签名，映射到 buildPrompt） */
export function buildMultiRolePrompt(entries: AddressEntry[], mode: 'full' | 'repeat'): string {
  return buildPrompt(
    entries.map((e) => ({ role: e.group, outfit: '', tag: e.tag })),
    mode,
    1,
  )
}
