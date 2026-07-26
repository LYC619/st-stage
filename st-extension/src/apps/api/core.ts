/**
 * 「API」App 纯逻辑：站点档案模型 + 解析工具（不依赖 DOM / ST 运行时，可单测）。
 * 切换机制学习自 reference/st-api-switcher（MIT）；数据模型在其基础上
 * 增加 ST 原生「附加参数」三项（包括主体参数/排除主体参数/包含请求标头），
 * 每站点独立保存、切换时一并写入。
 */

export const API_APP_ID = 'api'

export interface ApiProfile {
  id: string
  name: string
  /** OpenAI 兼容接口地址（保存时归一化：去尾部斜杠） */
  url: string
  /** API Key。明文存 settings —— ST 扩展设置通用机制，与参考项目一致 */
  key: string
  /** 模型 ID，可空（空 = 沿用 ST 当前值） */
  model: string
  /** ST「附加参数 · 包括主体参数」：YAML 文本原样透传，ST 自己解析 */
  includeBody: string
  /** ST「附加参数 · 排除主体参数」 */
  excludeBody: string
  /** ST「附加参数 · 包含请求标头」 */
  includeHeaders: string
}

export interface ApiAppData {
  profiles: ApiProfile[]
}

/** 站点表单草稿（编辑/新增共用） */
export type ProfileDraft = Omit<ApiProfile, 'id'>

export function emptyDraft(): ProfileDraft {
  return { name: '', url: '', key: '', model: '', includeBody: '', excludeBody: '', includeHeaders: '' }
}

export function normalizeUrl(u: string): string {
  return String(u ?? '')
    .trim()
    .replace(/\/+$/, '')
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : ''
}

/** 读 appData 兜底：旧数据/缺字段一律补默认值，非法条目丢弃 */
export function sanitizeAppData(raw: unknown): ApiAppData {
  const profiles: ApiProfile[] = []
  const list = (raw as { profiles?: unknown } | undefined)?.profiles
  if (Array.isArray(list)) {
    for (const item of list) {
      if (!item || typeof item !== 'object') continue
      const p = item as Record<string, unknown>
      const name = str(p.name).trim()
      const url = normalizeUrl(str(p.url))
      if (!name || !url) continue
      profiles.push({
        id: str(p.id) || newProfileId(),
        name,
        url,
        key: str(p.key),
        model: str(p.model).trim(),
        includeBody: str(p.includeBody),
        excludeBody: str(p.excludeBody),
        includeHeaders: str(p.includeHeaders),
      })
    }
  }
  return { profiles }
}

export function newProfileId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

/** 校验草稿；返回错误消息，通过返回 null */
export function validateDraft(draft: Pick<ProfileDraft, 'name' | 'url'>): string | null {
  if (!draft.name.trim()) return '给站点起个名称吧。'
  const url = normalizeUrl(draft.url)
  if (!url) return '接口地址 URL 还没填。'
  if (!/^https?:\/\//i.test(url)) return '接口地址要以 http:// 或 https:// 开头。'
  return null
}

/**
 * 保存草稿（editingId=null 新增，否则覆盖该 id）；
 * 与其他站点同名视为冲突返回 error（站点名是用户口中的唯一称呼）。
 */
export function upsertProfile(
  profiles: ApiProfile[],
  draft: ProfileDraft,
  editingId: string | null,
): { profiles: ApiProfile[] } | { error: string } {
  const invalid = validateDraft(draft)
  if (invalid) return { error: invalid }
  const name = draft.name.trim()
  const dup = profiles.find((p) => p.name === name && p.id !== editingId)
  if (dup) return { error: `站点名「${name}」已被占用，换一个吧。` }

  const clean: Omit<ApiProfile, 'id'> = {
    name,
    url: normalizeUrl(draft.url),
    key: draft.key,
    model: draft.model.trim(),
    includeBody: draft.includeBody,
    excludeBody: draft.excludeBody,
    includeHeaders: draft.includeHeaders,
  }
  if (editingId !== null) {
    const idx = profiles.findIndex((p) => p.id === editingId)
    if (idx < 0) return { error: '要编辑的站点已不存在。' }
    const next = [...profiles]
    next[idx] = { ...clean, id: editingId }
    return { profiles: next }
  }
  return { profiles: [...profiles, { ...clean, id: newProfileId() }] }
}

/** 找与 url 同地址的另一个站点（同 URL 多配置合法——如同一网关不同模型——仅用于保存时提示） */
export function findUrlDuplicate(
  profiles: ApiProfile[],
  url: string,
  excludeId: string | null,
): ApiProfile | undefined {
  const target = normalizeUrl(url)
  if (!target) return undefined
  return profiles.find((p) => p.id !== excludeId && normalizeUrl(p.url) === target)
}

/** 把站点在列表里上移/下移一位（delta=-1/1）；越界或找不到时原样返回 */
export function moveProfile(profiles: ApiProfile[], id: string, delta: -1 | 1): ApiProfile[] {
  const from = profiles.findIndex((p) => p.id === id)
  const to = from + delta
  if (from < 0 || to < 0 || to >= profiles.length) return profiles
  const next = [...profiles]
  const [item] = next.splice(from, 1)
  next.splice(to, 0, item)
  return next
}

/**
 * 匹配当前生效站点：先按归一化 URL（Key 出于安全读不回来，URL 是唯一可靠锚点）；
 * 同 URL 存了多个配置（同一网关不同模型）时，用当前模型进一步区分，都不中取第一个。
 */
export function findActiveProfile(
  profiles: ApiProfile[],
  currentUrl: string,
  currentModel = '',
): ApiProfile | undefined {
  const cur = normalizeUrl(currentUrl)
  if (!cur) return undefined
  const sameUrl = profiles.filter((p) => normalizeUrl(p.url) === cur)
  if (sameUrl.length <= 1) return sameUrl[0]
  return sameUrl.find((p) => p.model !== '' && p.model === currentModel) ?? sameUrl[0]
}

/**
 * 模型列表响应解析：兼容 数组 / {data:[...]} / {models:[...]}，
 * 元素为字符串或 {id|model|name}；去重升序。响应带 error 时抛错。
 */
export function parseModelList(json: unknown): string[] {
  if (json && typeof json === 'object' && 'error' in json && (json as { error: unknown }).error) {
    const msg = (json as { message?: unknown }).message
    throw new Error(typeof msg === 'string' && msg ? msg : '站点接口返回了错误')
  }
  const box = json as { data?: unknown; models?: unknown } | unknown[]
  const arr = Array.isArray(box) ? box : Array.isArray(box?.data) ? box.data : Array.isArray(box?.models) ? box.models : []
  const names = arr
    .map((m: unknown) => {
      if (typeof m === 'string') return m
      if (m && typeof m === 'object') {
        const o = m as Record<string, unknown>
        return str(o.id) || str(o.model) || str(o.name)
      }
      return ''
    })
    .filter((s: string) => s !== '')
  if (names.length === 0) throw new Error('站点没有返回任何模型')
  return [...new Set(names)].sort()
}
