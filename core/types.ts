/**
 * st-stage — 核心类型定义（v2）
 * 纯 TS，零框架依赖，Web 测试环境与 SillyTavern 扩展共用。
 *
 * v2 核心变化：标签与文件名解耦。
 * 立绘条目 = { label 显示名, tags 匹配标签, source 来源, ref 引用 }，
 * 改名/改标签不再需要动图片文件。
 */

/** 立绘图片来源 */
export type SpriteSource =
  /** 扩展目录内的相对路径（随仓库分发，如内置预设） */
  | 'local'
  /** 云端图床编号（拼接 pack.cloudPrefix 得到完整 URL），主要分享渠道 */
  | 'cloud'
  /** 内嵌 data URI（本地上传压缩后存储） */
  | 'embedded'

/** 单张立绘条目（v2） */
export interface SpriteEntry {
  /** 内部唯一 ID */
  id: string
  /** 显示名（用户可改，如 "微笑"） */
  label: string
  /** 匹配标签（[立绘:xxx] 匹配用；默认含 label，可加别名如 "smile"） */
  tags: string[]
  /** 图片来源类型 */
  source: SpriteSource
  /**
   * 引用值，含义随 source 变化：
   * - local: 相对扩展目录的路径，如 "presets/silver-loli/微笑.png"
   * - cloud: 图床文件编号，如 "abc123.png"
   * - embedded: data URI
   */
  ref: string
}

/** 默认图床前缀（catbox.moe） */
export const DEFAULT_CLOUD_PREFIX = 'https://files.catbox.moe/'

/** 立绘包：一套角色表情立绘的集合（v2） */
export interface SpritePack {
  /** 唯一 ID（导入时生成） */
  id: string
  /** 包名，如 "银发萝莉" */
  name: string
  /** 格式版本 */
  version: 2
  /** 作者（可选） */
  author?: string
  /** 描述（可选） */
  description?: string
  /** 图床前缀（cloud 条目用），默认 DEFAULT_CLOUD_PREFIX */
  cloudPrefix?: string
  /** 立绘列表 */
  sprites: SpriteEntry[]
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

/** 立绘悬浮窗位置与尺寸 */
export interface OverlayLayout {
  /** 距视口左侧 px */
  x: number
  /** 距视口顶部 px */
  y: number
  /** 悬浮窗宽度 px（高度按图片比例自适应） */
  width: number
}

/** 小手机壳布局与状态 */
export interface PhoneLayout {
  /** 距视口左侧 px */
  x: number
  /** 距视口顶部 px */
  y: number
  /** 是否折叠为悬浮图标 */
  collapsed: boolean
  /** 无边框模式：隐藏手机壳只留 APP 内容（立绘纯悬浮形态） */
  frameless: boolean
  /** 当前打开的 APP id，null = 主屏 */
  activeAppId: string | null
}

/** 插件全局设置 */
export interface PluginSettings {
  /** 总开关 */
  enabled: boolean
  /** 提取标签后是否在消息渲染中隐藏 [立绘:xxx] 文本 */
  hideTagInMessage: boolean
  /** 消息内 <img:编号> 正则替换显示通道（默认关闭） */
  regexDisplay: boolean
  /** 立绘悬浮窗布局（无边框模式下沿用） */
  overlay: OverlayLayout
  /** 手机壳布局 */
  phone: PhoneLayout
  /** 所有立绘包 */
  packs: SpritePack[]
  /** 角色绑定 */
  bindings: CharacterBinding[]
}

/* ============ 导入导出文件格式 ============ */

/** 完整立绘包导出格式（sprite-pack@2） */
export interface SpritePackFileV2 {
  format: 'sprite-pack@2'
  name: string
  author?: string
  description?: string
  cloudPrefix?: string
  sprites: Array<{
    label: string
    tags?: string[]
    source: SpriteSource
    ref: string
  }>
}

/** 轻量分享格式（sprite-share@1）：全 cloud 条目，仅标签 → 图床编号映射 */
export interface SpriteShareFile {
  format: 'sprite-share@1'
  name: string
  author?: string
  cloudPrefix?: string
  /** { label, tags?, ref: 图床编号 } */
  sprites: Array<{ label: string; tags?: string[]; ref: string }>
}

/** 旧版导出格式（sprite-pack@1，仅用于兼容导入） */
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
    enabled: true,
    hideTagInMessage: false,
    regexDisplay: false,
    overlay: { x: 24, y: 80, width: 220 },
    phone: { x: 24, y: 80, collapsed: true, frameless: false, activeAppId: null },
    packs: [],
    bindings: [],
  }
}
