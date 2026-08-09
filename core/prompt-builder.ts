/**
 * prompt 构建器：根据当前角色可用立绘的三级地址，生成注入的 system prompt。
 *
 * 七期：
 * - 全量（full）：列出所有实际存在的完整地址
 * - 智能精简（repeat）：跨场景找「图名集高度重合的场景簇」，共有图名只列一次，
 *   簇内场景行写「共有图名，另有：…」增量（不生成不存在的组合；带场景备注同样可精简）
 * - 每次回复立绘数量 N：要求 AI 按情节顺序输出 N 个 [立绘:...] 标签
 * 阶段四（大图包稳定化）：
 * - 字符预算 budget：超出时二分「每场景 tag 上限 K」均衡截取，保留排前的图名
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
  role: string
  outfit: string
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
        role: address.role,
        outfit: address.outfit,
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

/**
 * 备注渲染：after-list（默认）缩进挂在场景行下方，不再重复场景名；
 * before-list 作为场景前的引言行保留场景名（包级引言语义）。
 * 备注内含换行时续行统一缩进，避免打散清单结构。
 */
function noteLines(scene: PromptScene, note: PromptSceneNote): string[] {
  const parts = note.note.split('\n').map((line) => line.trim()).filter(Boolean)
  if (parts.length === 0) return []
  const head = parts[0]
  const rest = parts.slice(1).map((line) => `  ${line}`)
  if (note.placement === 'before-list') {
    return [`备注（${scene.label}）：${head}`, ...rest]
  }
  return [`  备注：${head}`, ...rest.map((line) => `  ${line}`)]
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
    for (const note of matchingNotes(noteIndex, scene, 'before-list')) {
      lines.push(...noteLines(scene, note))
    }
    const rendered = renderTags(scene.tags, reservedTags)
    lines.push(`- ${scene.label}：${rendered.text}`)
    ranges.push(...rendered.ranges)
    for (const note of matchingNotes(noteIndex, scene, 'after-list')) {
      lines.push(...noteLines(scene, note))
    }
  }
  return { lines, ranges }
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

/**
 * 输出格式说明按实际场景形态收窄：全部是「角色/服装」时不再解释两段/三段地址，
 * 全部是默认场景时只给最短形式——减少与当前数据无关的说明噪音。
 */
function formatInstruction(scenes: PromptScene[]): string {
  const hasDefault = scenes.some((scene) => !scene.role)
  const hasRoleOnly = scenes.some((scene) => scene.role && !scene.outfit)
  const hasOutfit = scenes.some((scene) => scene.role && scene.outfit)
  if (hasDefault && !hasRoleOnly && !hasOutfit) {
    return '输出格式：[立绘:图名]，图名须与上方清单完全一致。'
  }
  if (hasOutfit && !hasDefault && !hasRoleOnly) {
    return '输出格式：[立绘:角色/服装/图名]，角色、服装、图名均须与上方清单完全一致。'
  }
  return '输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。'
}

const CLOSING_INSTRUCTION = '只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。'

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
    formatInstruction(scenes),
    countInstruction(count),
    ...fewShotExample(scenes, count),
    CLOSING_INSTRUCTION,
  ].join('\n')
}

/** 精简模式里「共有图名」是保留短语；真实图名撞名时放弃精简防歧义 */
const SHARED_LIST_LABEL = '共有图名'

interface SharedCluster {
  core: string[]
  members: boolean[]
}

/**
 * 找「图名集高度重合的场景簇」：任取两场景的图名交集作候选共有核，
 * 簇 = 包含该核全部图名的场景；按估算节省字符数取最优（确定性：先到先得）。
 * O(场景数² × 图名数)，实际规模（几十个场景）下开销可忽略。
 */
function findSharedCluster(scenes: PromptScene[]): SharedCluster | null {
  const sets = scenes.map((scene) => new Set(scene.tags))
  const joinedLen = (tags: string[]): number =>
    tags.reduce((sum, tag) => sum + tag.length, 0) + Math.max(0, tags.length - 1)
  const seenCores = new Set<string>()
  let best: SharedCluster | null = null
  let bestSavings = 0
  for (let i = 0; i < scenes.length; i++) {
    for (let j = i + 1; j < scenes.length; j++) {
      const core = scenes[i].tags.filter((tag) => sets[j].has(tag))
      if (core.length < 2) continue
      const signature = core.join(' ')
      if (seenCores.has(signature)) continue
      seenCores.add(signature)
      const members = sets.map((set) => core.every((tag) => set.has(tag)))
      const memberCount = members.filter(Boolean).length
      const coreLen = joinedLen(core)
      // 每个成员行省下核心清单、换上「共有图名，另有：」前缀；
      // 额外付出核心行与用法解释行（合计约 60 字符固定成本）
      const savings = memberCount * (coreLen - SHARED_LIST_LABEL.length - 5) - (coreLen + 60)
      if (savings > bestSavings) {
        bestSavings = savings
        best = { core, members }
      }
    }
  }
  return best
}

/**
 * repeat：按场景簇抽出共有图名列一次，簇内场景行写增量，簇外场景完整列出。
 * 每个场景保留自己的行（场景备注有锚点，带备注同样可精简），
 * 整体仍可还原完整的场景 × 图名关系，不生成笛卡尔积之外的组合。
 */
function buildShared(
  addresses: SpriteAddress[],
  count: number,
  noteIndex: PromptSceneNoteIndex,
  reservedTags: ReadonlySet<string>,
): string {
  const scenes = buildScenes(addresses)
  if (scenes.length <= 1 || reservedTags.has(SHARED_LIST_LABEL)) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags)
  }
  const cluster = findSharedCluster(scenes)
  if (!cluster) {
    return buildGroupedFull(addresses, count, noteIndex, reservedTags)
  }

  const coreSet = new Set(cluster.core)
  const renderedCore = renderTags(cluster.core, reservedTags)
  const ranges = [...renderedCore.ranges]
  const lines = [
    '[角色立绘系统]',
    `${SHARED_LIST_LABEL}：${renderedCore.text}`,
    '可用立绘（按场景）：',
  ]
  for (const [index, scene] of scenes.entries()) {
    for (const note of matchingNotes(noteIndex, scene, 'before-list')) {
      lines.push(...noteLines(scene, note))
    }
    if (cluster.members[index]) {
      const remainder = scene.tags.filter((tag) => !coreSet.has(tag))
      if (remainder.length === 0) {
        lines.push(`- ${scene.label}：${SHARED_LIST_LABEL}`)
      } else {
        const rendered = renderTags(remainder, reservedTags)
        lines.push(`- ${scene.label}：${SHARED_LIST_LABEL}，另有：${rendered.text}`)
        ranges.push(...rendered.ranges)
      }
    } else {
      const rendered = renderTags(scene.tags, reservedTags)
      lines.push(`- ${scene.label}：${rendered.text}`)
      ranges.push(...rendered.ranges)
    }
    for (const note of matchingNotes(noteIndex, scene, 'after-list')) {
      lines.push(...noteLines(scene, note))
    }
  }
  lines.push(`场景行写「${SHARED_LIST_LABEL}」表示最上方共有清单里的图名整组可用；「另有」及直接列出的图名只属于所在场景。`)
  lines.push(...rangeInstruction(ranges))
  lines.push(formatInstruction(scenes))
  lines.push(countInstruction(count))
  lines.push(...fewShotExample(scenes, count))
  lines.push(CLOSING_INSTRUCTION)
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
  '输出格式：默认场景直接写 [立绘:图名]；其他场景写 [立绘:场景/图名]。两段地址表示无服装，三级地址表示指定服装。',
  '请根据回复内容，按情节顺序选择 {数量} 张立绘。每个 [立绘:...] 标签单独占一行，插在触发它的剧情段落之后——随剧情分散在正文中，不要集中堆在回复结尾。',
  '只能使用上述场景中实际列出的图名，不要自行拼造不存在的角色/服装/图名组合。',
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
