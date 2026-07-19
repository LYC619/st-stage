/**
 * 角色立绘悬浮窗 — 核心类型定义
 * 纯 TS，零框架依赖，Web 测试环境与 SillyTavern 扩展共用。
 *
 * 数据格式版本：
 * - 存储 settingsVersion = 2（v1 无此字段，由 core/migrate.ts 自动升级）
 * - 立绘包文件 sprite-pack@2（导入兼容 @1）
 */

/** 当前设置存储版本 */
export const SETTINGS_VERSION = 2

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
   * 分组标签（功能②）：角色名 / 服装 / 状态等，缺省/空串表示未分组。
   * 开启多角色模式后按 [立绘:分组/图名] 寻址；同一包内可混放多个分组。
   */
  group?: string
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

/** 角色 → 立绘包的绑定配置 */
export interface CharacterBinding {
  /** 角色名（与 ST 角色卡名称匹配；Web 端为模拟角色名） */
  characterName: string
  /** 绑定的立绘包 ID */
  packId: string
  /** 是否启用 */
  enabled: boolean
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
  /** 是否渲染消息内插图（<img>编码</img> → 图片，M3 消息后处理） */
  renderInlineImages: boolean
  /** 图床前缀，用于分享串编码与消息内插图解析 */
  imageHost: string
  /** 悬浮窗布局 */
  overlay: OverlayLayout
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
  /** 多角色 prompt 生成模式：full=枚举全部 分组/图名 组合；repeat=分组×共享情绪名（省 token） */
  multiRolePromptMode: 'full' | 'repeat'
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
    /** 分组标签（功能②，可选） */
    group?: string
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
    renderInlineImages: false,
    imageHost: DEFAULT_IMAGE_HOST,
    overlay: { x: 24, y: 80, width: 220 },
    phone: { x: 24, y: 320, open: false },
    showPhone: true,
    autoSwitch: false,
    autoSwitchSeconds: 3,
    multiRole: false,
    multiRolePromptMode: 'full',
    imgbbApiKey: '',
    autoUpload: false,
    packs: [],
    bindings: [],
    apps: {},
  }
}
