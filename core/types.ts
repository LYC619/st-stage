/**
 * 角色立绘悬浮窗 — 核心类型定义
 * 纯 TS，零框架依赖，Web 测试环境与 SillyTavern 扩展共用。
 *
 * 数据格式版本：
 * - 存储 settingsVersion = 3（v1/v2 由 core/migrate.ts 自动升级）
 * - 立绘包文件 sprite-pack@2（导入兼容 @1）
 */

/** 当前设置存储版本 */
export const SETTINGS_VERSION = 3

/** 楼层模式补渲染的最近 AI 楼层数：默认与上下限 */
export const RECENT_FLOORS_DEFAULT = 6
export const RECENT_FLOORS_MIN = 1
export const RECENT_FLOORS_MAX = 50

/** 每次回复的立绘数量：默认与上下限 */
export const SPRITE_COUNT_DEFAULT = 1
export const SPRITE_COUNT_MIN = 1
export const SPRITE_COUNT_MAX = 10

/** 默认图床前缀（紧凑分享串中省略 host 时使用） */
export const DEFAULT_IMAGE_HOST = 'https://files.catbox.moe/'

/** 单张立绘：一个表情标签对应一张图片 */
export interface Sprite {
  /** 表情标签（经 core/naming.ts 规范化），如 "微笑" */
  tag: string
  /** 显示地址：data: base64、ST 用户数据路径（/user/...）、扩展静态路径或 https URL */
  url: string
  /**
   * 图床编码（如 catbox 的 "ab12cd.png"，即 URL 最后一段文件名）。
   * 存在时该立绘可参与紧凑分享串；与 url 同步维护。
   */
  code?: string
  /**
   * 分组标签（功能②）：角色名，缺省/空串表示未分组。旧版一包多角色时用它区分人名。
   * 三级寻址下，人名优先取 sprite.group，其次取所属包的 roleName。
   */
  group?: string
  /**
   * 服装标签（六期·三级寻址）：如「居家服」，缺省/空串表示无服装维度。
   * 服装优先取 sprite.outfit，其次取所属包的 outfit。
   */
  outfit?: string
  /**
   * 远程分享地址（九期·stpack2）：imgbb 等图床直链，仅用于分享；
   * 本机显示优先用 url（本地保底），分享导出用 remoteUrl。缺省表示无远程副本。
   */
  remoteUrl?: string
}

/** 立绘的图源类型（由 url/code 推导，不单独存储） */
export type SpriteSource = 'embedded' | 'local' | 'hosted'

/** 推导立绘图源：embedded = data URI；local = ST/扩展本地路径；hosted = 图床 URL */
export function getSpriteSource(sprite: Sprite): SpriteSource {
  if (sprite.url.startsWith('data:')) return 'embedded'
  if (/^https?:\/\//.test(sprite.url)) return 'hosted'
  return 'local'
}

/** 立绘包：一套角色表情立绘的集合 */
export interface SpritePack {
  /** 唯一 ID（导入/新建时生成） */
  id: string
  /** 包名（经 sanitizePackName 清洗），如 "银发萝莉" */
  name: string
  /** 作者（可选） */
  author?: string
  /** 描述（可选） */
  description?: string
  /**
   * 包级人名（六期·三级寻址）：整包属于同一角色时填此，包内立绘用纯图名即可。
   * 批量上传「鸣人/居家服/xxx」会自动建/匹配到 roleName=鸣人 的包。缺省=无包级人名。
   */
  roleName?: string
  /** 包级服装（六期）：整包为同一服装时填此。缺省=无包级服装。 */
  outfit?: string
  /** 封面立绘的 tag（可选，缺省用第一张） */
  coverTag?: string
  /** 最后修改时间（ISO 8601，可选） */
  updatedAt?: string
  /** 立绘列表 */
  sprites: Sprite[]
}

/** 取包封面立绘（coverTag 优先，回退第一张），空包返回 null */
export function getPackCover(pack: SpritePack): Sprite | null {
  if (pack.coverTag) {
    const cover = pack.sprites.find((s) => s.tag === pack.coverTag)
    if (cover) return cover
  }
  return pack.sprites[0] ?? null
}

/** 角色 → 立绘包的绑定配置（六期起支持一个聊天启用多个包） */
export interface CharacterBinding {
  /** 角色名/聊天标识（与 ST 角色卡名称匹配；Web 端为模拟角色名） */
  characterName: string
  /** 绑定的立绘包 ID 列表（按启用顺序；旧版单 packId 迁移为单元素数组） */
  packIds: string[]
  /** 是否启用 */
  enabled: boolean
}

/**
 * 立绘的三级地址坐标：人名 / 服装 / 图名。
 * 人名、服装可为空串（表示该维度不参与寻址）。图名必填。
 */
export interface SpriteAddress {
  role: string
  outfit: string
  tag: string
}

/** 取一张立绘在其所属包内的人名（sprite.group 优先，其次 pack.roleName） */
export function spriteRole(pack: SpritePack, sprite: Sprite): string {
  return (sprite.group ?? '').trim() || (pack.roleName ?? '').trim()
}

/** 取一张立绘在其所属包内的服装（sprite.outfit 优先，其次 pack.outfit） */
export function spriteOutfit(pack: SpritePack, sprite: Sprite): string {
  return (sprite.outfit ?? '').trim() || (pack.outfit ?? '').trim()
}

/** 立绘的完整三级坐标 */
export function spriteAddress(pack: SpritePack, sprite: Sprite): SpriteAddress {
  return { role: spriteRole(pack, sprite), outfit: spriteOutfit(pack, sprite), tag: sprite.tag }
}

/** 三级坐标 → 显示字符串：省略空的前置层级（tag / 人名/tag / 人名/服装/tag） */
export function formatAddress(a: SpriteAddress): string {
  if (a.role && a.outfit) return `${a.role}/${a.outfit}/${a.tag}`
  if (a.role) return `${a.role}/${a.tag}`
  return a.tag
}

/**
 * 解析立绘地址文本为三级坐标（最多三级）。
 * - 「图名」→ role/outfit 空
 * - 「人名/图名」→ outfit 空
 * - 「人名/服装/图名」→ 三级齐全
 * 多于三段时，前两段作人名/服装，其余合并为图名（图名理论上不含 /，此为容错）。
 */
export function parseAddress(address: string): SpriteAddress {
  const parts = address.split('/').map((s) => s.trim())
  if (parts.length >= 3) {
    return { role: parts[0], outfit: parts[1], tag: parts.slice(2).join('/') }
  }
  if (parts.length === 2) return { role: parts[0], outfit: '', tag: parts[1] }
  return { role: '', outfit: '', tag: parts[0] ?? '' }
}

/** 悬浮窗位置与尺寸 */
export interface OverlayLayout {
  /** 距视口左侧 px */
  x: number
  /** 距视口顶部 px */
  y: number
  /** 悬浮窗宽度 px（高度按图片比例自适应） */
  width: number
}

/**
 * 立绘显示位置（四期）：
 * - overlay 悬浮窗（默认，旧行为）
 * - inline  楼层内：把消息里的 [立绘:xxx] 标签原位替换为立绘图片，悬浮窗隐藏
 * - both    两者都显示
 * 楼层内渲染直接用 sprite.url，三种图源（内嵌 base64 / ST 本地路径 / 图床）均可显示。
 */
export type SpriteDisplayMode = 'overlay' | 'inline' | 'both'

/** 手机壳状态：悬浮图标位置 + 是否展开 */
export interface PhoneState {
  /** 悬浮图标距视口左侧 px */
  x: number
  /** 悬浮图标距视口顶部 px */
  y: number
  /** 是否展开手机界面 */
  open: boolean
}

/** 插件全局设置（extensionSettings / localStorage 持久化的根对象） */
export interface PluginSettings {
  /** 存储格式版本，见 SETTINGS_VERSION */
  settingsVersion: number
  /** 总开关 */
  enabled: boolean
  /** 提取标签后是否在消息渲染中隐藏 [立绘:xxx] 文本 */
  hideTagInMessage: boolean
  /** 立绘显示位置（四期）：悬浮窗 / 楼层内 / 两者 */
  spriteDisplayMode: SpriteDisplayMode
  /** 是否渲染消息内插图（<img>编码</img> → 图片，M3 消息后处理） */
  renderInlineImages: boolean
  /** 图床前缀，用于分享串编码与消息内插图解析 */
  imageHost: string
  /** 悬浮窗布局 */
  overlay: OverlayLayout
  /**
   * 悬浮窗被用户手动关闭（✕）：只隐藏窗体并记住状态，不关闭立绘功能；
   * both 模式下楼层立绘继续工作。重新打开入口在「立绘」App。
   */
  overlayHidden: boolean
  /**
   * 楼层模式补渲染的最近 AI 楼层数（1–50，默认 6）。
   * 只在切换显示模式 / 加载聊天时限制补渲染范围；新收到的 AI 回复不受限。
   */
  recentFloors: number
  /** 手机壳状态（M4 手机 UI 框架） */
  phone: PhoneState
  /** 是否显示手机框；关闭时回退为纯悬浮窗模式（悬浮窗 ⚙ 仍可打开图库） */
  showPhone: boolean
  /** 多立绘序列自动轮播开关（功能③；关闭时仅点击切换） */
  autoSwitch: boolean
  /** 自动轮播间隔秒数（功能③，默认 3，范围 1–60） */
  autoSwitchSeconds: number
  /** 多角色/分组模式（功能②）：开启后按 [立绘:分组/图名] 寻址，prompt 枚举分组 */
  multiRole: boolean
  /** 多角色 prompt 生成模式：full=枚举全部完整地址；repeat=智能精简（共同图名合并） */
  multiRolePromptMode: 'full' | 'repeat'
  /** 每次回复的立绘数量（七期，默认 1，范围 1–10）：注入 prompt 要求 AI 输出 N 个标签 */
  spriteCount: number
  /** imgbb 图床 API Key（功能①，仅存本地浏览器；空串=未配置） */
  imgbbApiKey: string
  /** 导入立绘时是否自动直传 imgbb 图床并绑定编号（功能①，需先配置 API Key） */
  autoUpload: boolean
  /** 所有立绘包 */
  packs: SpritePack[]
  /** 角色绑定 */
  bindings: CharacterBinding[]
  /**
   * App 私有存储命名空间：appId → 任意可 JSON 序列化对象。
   * 见 docs/APP-SPEC.md；核心设置永远不放这里。
   */
  apps: Record<string, unknown>
}

/** 立绘包导出文件格式（sprite-pack@2） */
export interface SpritePackFile {
  format: 'sprite-pack@2'
  name: string
  author?: string
  description?: string
  roleName?: string
  outfit?: string
  coverTag?: string
  /** 导出时间（ISO 8601） */
  exportedAt?: string
  sprites: Array<{
    tag: string
    /** 图床 / 静态 URL（与 data 二选一） */
    url?: string
    /** 内嵌 base64 data URI（与 url 二选一） */
    data?: string
    /** 图床编码（可选，随 url 一起导出） */
    code?: string
    /** 分组标签/人名（功能②，可选） */
    group?: string
    /** 服装（六期，可选） */
    outfit?: string
  }>
}

/** 旧版导出格式（sprite-pack@1），仅用于导入兼容 */
export interface SpritePackFileV1 {
  format: 'sprite-pack@1'
  name: string
  author?: string
  description?: string
  sprites: Array<{ tag: string; url?: string; data?: string }>
}

/** 默认设置 */
export function createDefaultSettings(): PluginSettings {
  return {
    settingsVersion: SETTINGS_VERSION,
    enabled: true,
    hideTagInMessage: false,
    spriteDisplayMode: 'overlay',
    renderInlineImages: false,
    imageHost: DEFAULT_IMAGE_HOST,
    overlay: { x: 24, y: 80, width: 220 },
    overlayHidden: false,
    recentFloors: RECENT_FLOORS_DEFAULT,
    phone: { x: 24, y: 320, open: false },
    showPhone: true,
    autoSwitch: false,
    autoSwitchSeconds: 3,
    multiRole: false,
    multiRolePromptMode: 'full',
    spriteCount: SPRITE_COUNT_DEFAULT,
    imgbbApiKey: '',
    autoUpload: false,
    packs: [],
    bindings: [],
    apps: {},
  }
}
