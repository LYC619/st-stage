/**
 * 旧分组拆包 + 批量上传规划（八期，纯逻辑）。
 *
 * 旧分组拆包：把一个含多个 group（人名）的老包，按 group 拆成多个 roleName 独立包，
 * 拆出的立绘去掉 group、包设 roleName；不改动原包（成功创建新包前原包与绑定保留）。
 *
 * 批量上传规划：解析文件名的三级坐标 → 决定每张图落到哪个「人名/服装」包 →
 * 检测同包内 tag 重名并按策略（跳过/覆盖/改名）产出最终计划。上传前给 UI 预览。
 */

import type { SpritePack, Sprite } from './types'
import { genId } from './sprite-store'
import { normalizeTag, sanitizePackName } from './naming'

/* ---------------- 旧分组拆包 ---------------- */

export interface SplitPreviewItem {
  /** 拆出的人名（原 group） */
  roleName: string
  /** 新包建议名（原包名 · 人名） */
  packName: string
  /** 该组立绘数 */
  count: number
  /** 该组图名列表 */
  tags: string[]
}

/** 拆包预览：按 group 归类（忽略无分组立绘），空/单组时返回空（无需拆分） */
export function previewGroupSplit(pack: SpritePack): SplitPreviewItem[] {
  const groups = new Map<string, Sprite[]>()
  for (const s of pack.sprites) {
    const g = (s.group ?? '').trim()
    if (!g) continue
    const arr = groups.get(g) ?? []
    arr.push(s)
    groups.set(g, arr)
  }
  if (groups.size < 2) return [] // 0 或 1 个分组：拆了没意义
  return [...groups.entries()].map(([roleName, sprites]) => ({
    roleName,
    packName: sanitizePackName(`${pack.name}·${roleName}`) || roleName,
    count: sprites.length,
    tags: sprites.map((s) => s.tag),
  }))
}

/**
 * 执行拆包：按 group 生成多个新包（新 id、roleName=组名、立绘去掉 group）。
 * 返回新包数组（不含原包）；调用方负责 upsert 这些新包，原包保持不动。
 * 无分组或仅一个分组时返回空数组。
 */
export function splitPackByGroup(pack: SpritePack): SpritePack[] {
  const preview = previewGroupSplit(pack)
  if (preview.length === 0) return []
  const now = new Date().toISOString()
  return preview.map((item) => {
    const sprites = pack.sprites
      .filter((s) => (s.group ?? '').trim() === item.roleName)
      .map((s) => {
        const next: Sprite = { ...s }
        delete next.group // 人名升级到包级 roleName
        return next
      })
    return {
      id: genId(),
      name: item.packName,
      author: pack.author,
      roleName: item.roleName,
      ...(pack.outfit ? { outfit: pack.outfit } : {}),
      sprites,
      updatedAt: now,
    }
  })
}

/* ---------------- 批量上传规划 ---------------- */

export type ConflictStrategy = 'skip' | 'overwrite' | 'rename'

/** 解析后的上传条目（人名/服装/图名可被用户在预览里修正） */
export interface UploadEntry {
  fileName: string
  role: string
  outfit: string
  tag: string
}

/** 单条上传的最终计划 */
export interface PlannedUpload {
  entry: UploadEntry
  /** 目标包 id（已存在则复用），null 表示需新建 */
  targetPackId: string | null
  /** 目标包显示名 */
  targetPackName: string
  /** 与目标包内已有立绘/本批前序是否 tag 重名 */
  conflict: boolean
  /** 应用策略后的最终图名（rename 策略下可能加序号） */
  finalTag: string
  /** 最终动作 */
  action: 'add' | 'skip' | 'overwrite'
}

/** 目标包名：有人名/服装用「人名·服装」；否则回退 batchPackName */
function packNameFor(role: string, outfit: string, batchPackName: string): string {
  if (role && outfit) return sanitizePackName(`${role}·${outfit}`) || `${role}·${outfit}`
  if (role) return sanitizePackName(role) || role
  return batchPackName
}

/** 找到与 (role, outfit) 匹配的已有包（按 roleName+outfit 精确匹配），无则 null */
function findPackFor(packs: SpritePack[], role: string, outfit: string): SpritePack | null {
  return (
    packs.find(
      (p) => (p.roleName ?? '') === role && (p.outfit ?? '') === outfit && (role !== '' || outfit !== ''),
    ) ?? null
  )
}

/** 自动改名：desired 已占用时依次加「_2」「_3」…直到不冲突 */
export function autoRenameTag(taken: Set<string>, desired: string): string {
  if (!taken.has(desired)) return desired
  for (let i = 2; i < 1000; i++) {
    const candidate = `${desired}_${i}`.slice(0, 20)
    if (!taken.has(candidate)) return candidate
  }
  return `${desired}_${Date.now().toString(36)}`
}

/**
 * 生成批量上传计划。
 * @param entries 解析后的上传条目（可能已被用户修正）
 * @param packs   当前全部包（用于匹配已有「人名/服装」包与检测重名）
 * @param strategy 重名策略：跳过/覆盖/改名
 * @param batchPackName 无人名/服装且未指定 defaultPack 时的落包名
 * @param defaultPack 无人名/服装时优先落入的现有包（如「当前正在编辑的包」）
 */
export function planUploads(
  entries: UploadEntry[],
  packs: SpritePack[],
  strategy: ConflictStrategy,
  batchPackName: string,
  defaultPack?: SpritePack | null,
): PlannedUpload[] {
  // 每个目标包的「已占用 tag 集合」：初始为该包已有 tag，随本批规划增量累加
  const takenByPack = new Map<string, Set<string>>()
  // 新建包用合成键（role|outfit|packName），使同批同目标的图归到同一新包
  const newPackKey = (role: string, outfit: string, name: string) => `new:${role}|${outfit}|${name}`

  const keyTaken = (key: string, pack: SpritePack | null): Set<string> => {
    let set = takenByPack.get(key)
    if (!set) {
      set = new Set(pack ? pack.sprites.map((s) => s.tag) : [])
      takenByPack.set(key, set)
    }
    return set
  }

  const plans: PlannedUpload[] = []
  for (const entry of entries) {
    const role = normalizeTag(entry.role)
    const outfit = normalizeTag(entry.outfit)
    const tag = normalizeTag(entry.tag)
    // 无人名/服装：优先落入 defaultPack（当前编辑的包），否则按 batchPackName 新建
    const roleless = !role && !outfit
    const existing = roleless ? (defaultPack ?? null) : findPackFor(packs, role, outfit)
    const packName = existing ? existing.name : packNameFor(role, outfit, batchPackName)
    const key = existing ? `pack:${existing.id}` : newPackKey(role, outfit, packName)
    const taken = keyTaken(key, existing)

    const conflict = taken.has(tag)
    let finalTag = tag
    let action: PlannedUpload['action'] = 'add'
    if (conflict) {
      if (strategy === 'skip') {
        action = 'skip'
      } else if (strategy === 'overwrite') {
        action = 'overwrite'
      } else {
        finalTag = autoRenameTag(taken, tag)
        action = 'add'
      }
    }
    // 占用：add/overwrite 都会让该 tag 存在（overwrite 覆盖原有、finalTag 不变）
    if (action !== 'skip') taken.add(finalTag)

    plans.push({
      entry: { fileName: entry.fileName, role, outfit, tag },
      targetPackId: existing?.id ?? null,
      targetPackName: packName,
      conflict,
      finalTag,
      action,
    })
  }
  return plans
}
