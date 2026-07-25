/**
 * prompt 构建器：根据当前角色可用立绘的三级地址，生成注入的 system prompt。
 *
 * 七期：
 * - 全量（full）：列出所有实际存在的完整地址
 * - 智能精简（repeat）：多个「场景（人名/服装）」共有的表情只列一次，
 *   各场景其余表情按行增量列出（不生成不存在的组合）
 * - 每次回复立绘数量 N：要求 AI 按情节顺序输出 N 个 [立绘:...] 标签
 */

import type { SpriteAddress } from './types'

/** 收尾说明：N=1 保持旧的单标签语义；N>1 要求按情节顺序输出多个 */
function countInstruction(count: number): string {
  if (count <= 1) {
    return '请在每次回复的末尾，选择一个最贴合当前情境与角色情绪的立绘，以 [立绘:名称] 的格式单独标注。'
  }
  return `请根据回复内容，按情节顺序选择 ${count} 张立绘，并依次输出 ${count} 个 [立绘:...] 标签（每个单独一行）。`
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

/** full：每个 role/outfit 场景只写一次，仍完整覆盖所有实际组合。 */
function buildGroupedFull(addresses: SpriteAddress[], count: number): string {
  const scenes = buildScenes(addresses)
  return [
    '[角色立绘系统]',
    '可用立绘（按场景）：',
    ...scenes.map((scene) => `- ${scene.label}：${scene.tags.join('、')}`),
    '输出格式：默认场景直接写 [立绘:表情]；其他场景写 [立绘:场景/表情]。两段地址表示无服装，三级地址表示指定服装。',
    countInstruction(count),
    '只能使用上述场景中实际列出的表情，不要自行拼造不存在的角色/服装/表情组合。',
  ].join('\n')
}

/**
 * repeat：按场景分组，抽出所有场景共有的表情，剩余项仍按所在场景列出。
 * 两部分合起来可以还原完整的场景 × tag 关系，不生成笛卡尔积之外的组合。
 */
function buildShared(addresses: SpriteAddress[], count: number): string {
  const scenes = buildScenes(addresses)
  if (scenes.length <= 1) return buildGroupedFull(addresses, count)

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
  if (sharedTags.length === 0) return buildGroupedFull(addresses, count)
  const sharedSet = new Set(sharedTags)
  const remainders = scenes.map((scene) => ({
    scene,
    tags: scene.tags.filter((tag) => !sharedSet.has(tag)),
  }))

  const labels = scenes.map((scene) =>
    scene.prefix ? scene.label : `${scene.label}（直接写表情）`,
  )
  const lines = [
    '[角色立绘系统]',
    `可用场景：${labels.join('、')}`,
    `共有表情（适用于全部场景）：${sharedTags.join('、')}`,
  ]
  const withRemainder = remainders.filter((item) => item.tags.length > 0)
  if (withRemainder.length > 0) {
    lines.push('各场景其余表情：')
    lines.push(...withRemainder.map(({ scene, tags }) => `- ${scene.label}：${tags.join('、')}`))
  }
  lines.push('共有表情可与任一已列场景组合；各场景其余表情只按所在行使用。默认场景直接写 [立绘:表情]，其他场景写 [立绘:场景/表情]。')
  lines.push(countInstruction(count))
  lines.push('只能使用实际存在的组合，不要自行拼造不存在的角色/服装/表情。')
  return lines.join('\n')
}

/** UTF-16 string.length 确定性比较；平局选更直观的分组精确格式。 */
export function chooseShorterPrompt(grouped: string, shared: string): string {
  return shared.length < grouped.length ? shared : grouped
}

/**
 * 主入口：根据三级地址列表构建注入 prompt。
 * addresses 为空时返回空字符串（不注入）。
 */
export function buildPrompt(
  addresses: SpriteAddress[],
  mode: 'full' | 'repeat',
  count: number,
): string {
  if (addresses.length === 0) return ''
  const n = Math.max(1, Math.round(count) || 1)
  const grouped = buildGroupedFull(addresses, n)
  if (mode === 'full') return grouped
  return chooseShorterPrompt(grouped, buildShared(addresses, n))
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
